import cors, { CorsOptions } from 'cors';
import express, { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

import connectDB, { checkConnection } from './config/database';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import discordInviteRoutes from './routes/discordInvite';
import eventRoutes from './routes/events';
import newsletterRoutes from './routes/newsletter';
import rewardIntegrationRoutes from './routes/rewardIntegration';
import uploadRoutes from './routes/upload';
import verifyRoutes from './routes/verify';
import env from './config/env';
import logger from './config/logger';

const log = logger.child({ module: 'app' });

const app = express();

if (env.IS_LAMBDA) {
  app.set('trust proxy', true);
}

let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const initDB = async (): Promise<void> => {
  if (dbInitialized) {
    return;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      await connectDB();
      dbInitialized = true;
      log.info('database: initialized successfully.');
    } catch (err: unknown) {
      log.error('database: connection failed.', err);
      dbInitialized = false;
      dbInitPromise = null;
      throw err;
    }
  })();

  return dbInitPromise;
};

if (env.IS_LAMBDA) {
  initDB().catch((err: unknown) => {
    log.error('database: initialization failed.', err);
  });
} else {
  connectDB().catch((err: unknown) => {
    log.error('database: connection failed.', err);
  });
}

const defaultAllowedOrigins = [
  'https://wayneaws.dev',
  'https://www.wayneaws.dev',
  'https://prizeversity.com',
  'https://www.prizeversity.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = env.CORS_ORIGINS ?? defaultAllowedOrigins;

    const isAmplifyDomain = origin.includes('.amplifyapp.com');

    if (allowedOrigins.includes(origin) || isAmplifyDomain) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.path === '/health') {
    next();
    return;
  }

  if (!env.IS_LAMBDA) {
    req.setTimeout(25000);
    res.setTimeout(25000);
  }

  if (env.IS_LAMBDA) {
    try {
      if (mongoose.connection.readyState === 1) {
        next();
        return;
      }

      if (!dbInitialized) {
        await initDB();
      } else {
        const isConnected = await checkConnection();
        if (!isConnected) {
          dbInitialized = false;
          await initDB();
        }
      }

      const finalCheck = await checkConnection();
      if (!finalCheck) {
        log.error('database: not available after initialization attempt.');
        res.status(503).json({
          error: 'Service temporarily unavailable. Please try again.',
          message: 'Database connection unavailable',
        });
        return;
      }
    } catch (error: unknown) {
      log.error('database: initialization error.', error);
      res.status(503).json({
        error: 'Service temporarily unavailable. Please try again.',
        message: 'Database connection failed',
      });
      return;
    }
  }

  next();
});

app.use('/auth', authRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/upload', uploadRoutes);
app.use('/', discordInviteRoutes);
app.use('/admin', adminRoutes);
app.use('/events', eventRoutes);
app.use('/integrations/prizeversity', rewardIntegrationRoutes);
app.use('/verify', verifyRoutes);

app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    message: 'AWS Student Hub Backend is running on Lambda',
    timestamp: new Date().toISOString(),
    environment: env.IS_LAMBDA ? 'lambda' : 'local',
  });
});

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Route not found' });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  log.error(err.stack || err);
  res.status(500).json({ message: 'Something went wrong!' });
};

app.use(errorHandler);

export default app;
