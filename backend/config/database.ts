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
    console.log('🔄 Using cached MongoDB connection');
    return cached.conn;
  }

  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log('⚠️ Cached connection is not ready, reconnecting...');
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

    console.log('MongoDB connection string is missing in development mode');
    console.log('Contact Akrm Al-Hakimi for MongoDB configuration');
    console.log('Server will continue running but database operations will fail');
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

    console.log('Creating new MongoDB connection...');

    cached.promise = mongoose
      .connect(mongoUri, options)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Database connection error:', message);
        cached.promise = null;
        cached.conn = null;
        if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
          throw error;
        }
        console.log('Running without database connection in development mode');
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;

    const hasErrorListener = Boolean(mongoose.connection.listeners('error').length);

    if (cached.conn && !hasErrorListener) {
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        cached.conn = null;
        cached.promise = null;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        cached.conn = null;
        cached.promise = null;
      });
    }

    return cached.conn;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Database connection error:', message);
    cached.promise = null;
    cached.conn = null;

    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('MongoDB connection failed in development');
      console.log('Contact Akrm Al-Hakimi for MongoDB configuration');
      console.log('Server will continue running but database operations will fail');
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
    console.error('Database health check failed:', message);
    return false;
  }
};

export { checkConnection };
export default connectDB;
