import mongoose from 'mongoose';
import env from './env';
import logger from './logger';

const log = logger.child({ module: 'config-database' });

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
}

const globalWithMongoose = global as typeof globalThis & {
  mongoose?: MongooseCache;
};

let cached = globalWithMongoose.mongoose;

if (!cached) {
  cached = globalWithMongoose.mongoose = { conn: null, promise: null };
}

const connectDB = async (): Promise<typeof mongoose | null> => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    log.info('database: using cached mongodb connection.');
    return cached.conn;
  }

  if (cached.conn && mongoose.connection.readyState !== 1) {
    log.info('database: cached connection is not ready; reconnecting.');
    cached.conn = null;
    cached.promise = null;
  }

  const mongoUri = env.MONGODB_URI;

  if (!mongoUri) {
    cached.promise = null;
    cached.conn = null;

    if (env.IS_LAMBDA) {
      throw new Error('MONGODB_URI is required in Lambda environment');
    }

    log.info('database: mongodb uri is missing in development mode.');
    log.info('database: contact akrm al-hakimi for mongodb configuration.');
    log.info('database: unavailable; server will continue without database operations.');
    return null;
  }

  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      maxPoolSize: env.IS_LAMBDA ? 1 : 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority' as const,
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
    };

    log.info('database: connecting to mongodb.');

    cached.promise = mongoose
      .connect(mongoUri, options)
      .then((conn) => {
        log.info(`database: connected to ${conn.connection.host}.`);
        return conn;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        log.error('database: connection error.', message);
        cached.promise = null;
        cached.conn = null;
        if (env.IS_LAMBDA) {
          throw error;
        }
        log.info('database: unavailable; continuing in development mode.');
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;

    const hasErrorListener = Boolean(mongoose.connection.listeners('error').length);

    if (cached.conn && !hasErrorListener) {
      mongoose.connection.on('error', (err) => {
        log.error('database: mongodb connection error.', err);
        cached.conn = null;
        cached.promise = null;
      });

      mongoose.connection.on('disconnected', () => {
        log.info('database: disconnected from mongodb.');
        cached.conn = null;
        cached.promise = null;
      });
    }

    return cached.conn;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('database: connection error.', message);
    cached.promise = null;
    cached.conn = null;

    if (!env.IS_LAMBDA) {
      log.info('database: connection failed in development.');
      log.info('database: unavailable; server will continue without database operations.');
      return null;
    }

    throw error;
  }
};

const checkConnection = async (): Promise<boolean> => {
  try {
    const readyState = mongoose.connection.readyState;
    if (readyState === 1) {
      if (mongoose.connection.db && mongoose.connection.db.admin) {
        await mongoose.connection.db.admin().ping();
        return true;
      }
      return true;
    }
    return false;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('database: health check failed.', message);
    return false;
  }
};

export { checkConnection };
export default connectDB;
