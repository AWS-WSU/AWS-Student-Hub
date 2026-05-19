const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Trust proxy when running in Lambda/API Gateway
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.set('trust proxy', true);
}

// OPTIONS requests are handled directly in lambda.js before reaching Express
// This ensures consistent CORS behavior across all routes

// Database connection - initialize on module load for Lambda warm starts
const connectDB = require('./config/database');
const { checkConnection } = require('./config/database');

// Initialize database connection
let dbInitialized = false;
let dbInitPromise = null;
const initDB = async () => {
  if (dbInitialized) {
    return;
  }

  // If initialization is already in progress, wait for it
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      await connectDB();
      dbInitialized = true;
      console.log('Database initialized successfully');
    } catch (err) {
      console.error('Database connection failed:', err);
      dbInitialized = false;
      dbInitPromise = null; // Allow retry
      throw err;
    }
  })();

  return dbInitPromise;
};

// Initialize DB immediately (non-blocking)
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  initDB().catch((err) => {
    console.error('Failed to initialize database:', err);
  });
} else {
  // For local development, connect synchronously
  connectDB().catch((err) => {
    console.error('Database connection failed:', err);
  });
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : [
          'https://wayneaws.dev',
          'https://www.wayneaws.dev',
          'https://prizeversity.com',
          'https://www.prizeversity.com',
          'http://localhost:5173',
          'http://localhost:3000',
        ];

    // Check for Amplify domains
    const isAmplifyDomain = origin && origin.includes('.amplifyapp.com');

    if (allowedOrigins.includes(origin) || isAmplifyDomain) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection middleware - ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  // Skip DB check for health endpoint
  if (req.path === '/health') {
    return next();
  }

  // Only set timeouts if not running in Lambda
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    req.setTimeout(25000);
    res.setTimeout(25000);
  }

  // Ensure database is connected before processing requests (Lambda only)
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      // Quick check - if connection state is ready, proceed
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        return next();
      }

      // Connection not ready, try to initialize/reconnect
      if (!dbInitialized) {
        await initDB();
      } else {
        // Connection was initialized but is now disconnected, try to reconnect
        const isConnected = await checkConnection();
        if (!isConnected) {
          dbInitialized = false;
          await initDB();
        }
      }

      // Final check
      const finalCheck = await checkConnection();
      if (!finalCheck) {
        console.error('Database not available after initialization attempt');
        return res.status(503).json({
          error: 'Service temporarily unavailable. Please try again.',
          message: 'Database connection unavailable',
        });
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      return res.status(503).json({
        error: 'Service temporarily unavailable. Please try again.',
        message: 'Database connection failed',
      });
    }
  }

  next();
});

const authRoutes = require('./routes/auth');
const newsletterRoutes = require('./routes/newsletter');
const uploadRoutes = require('./routes/upload');
const discordInviteRoutes = require('./routes/discordInvite');
const adminRoutes = require('./routes/admin');
const eventRoutes = require('./routes/events');
const verifyRoutes = require('./routes/verify');

app.use('/auth', authRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/upload', uploadRoutes);
app.use('/', discordInviteRoutes);
app.use('/admin', adminRoutes);
app.use('/events', eventRoutes);
app.use('/verify', verifyRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'AWS Student Hub Backend is running on Lambda',
    timestamp: new Date().toISOString(),
    environment: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'lambda' : 'local',
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  // CORS headers are handled by lambda.js response hook
  res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;
