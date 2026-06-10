import mongoose from 'mongoose';

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
    console.log('using cached mongodb connection.');
    return cached.conn;
  }

  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log('cached connection is not ready, reconnecting.');
    cached.conn = null;
    cached.promise = null;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    cached.promise = null;
    cached.conn = null;

    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error('MONGODB_URI is required in Lambda environment');
    }

    console.log('mongodb connection string is missing in development mode.');
    console.log('contact akrm al-hakimi for mongodb configuration.');
    console.log('server will continue running but database operations will fail.');
    return null;
  }

  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      maxPoolSize: process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority' as const,
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
    };

    console.log('creating new mongodb connection.');

    cached.promise = mongoose
      .connect(mongoUri, options)
      .then((conn) => {
        console.log(`mongodb connected ${conn.connection.host}.`);
        return conn;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('database connection error.', message);
        cached.promise = null;
        cached.conn = null;
        if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
          throw error;
        }
        console.log('running without database connection in development mode.');
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;

    const hasErrorListener = Boolean(mongoose.connection.listeners('error').length);

    if (cached.conn && !hasErrorListener) {
      mongoose.connection.on('error', (err) => {
        console.error('mongodb connection error.', err);
        cached.conn = null;
        cached.promise = null;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('mongodb disconnected.');
        cached.conn = null;
        cached.promise = null;
      });
    }

    return cached.conn;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('database connection error.', message);
    cached.promise = null;
    cached.conn = null;

    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('mongodb connection failed in development.');
      console.log('contact akrm al-hakimi for mongodb configuration.');
      console.log('server will continue running but database operations will fail.');
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
    console.error('database health check failed.', message);
    return false;
  }
};

export { checkConnection };
export default connectDB;
