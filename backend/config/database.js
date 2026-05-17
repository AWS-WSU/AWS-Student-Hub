const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Check if connection is ready and healthy
  if (cached.conn && mongoose.connection.readyState === 1) {
    console.log('🔄 Using cached MongoDB connection');
    return cached.conn;
  }

  // If connection exists but is not ready, clear it
  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log('⚠️ Cached connection is not ready, reconnecting...');
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 10000, // Increased from 5000
      socketTimeoutMS: 15000, // Increased from 10000
      maxPoolSize: process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 15000, // Increased from 10000
      heartbeatFrequencyMS: 10000,
    };

    console.log('Creating new MongoDB connection...');

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, options)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error) => {
        console.error('Database connection error:', error.message);
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

    if (cached.conn && (!mongoose.connection._events || !mongoose.connection._events.error)) {
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
  } catch (error) {
    console.error('Database connection error:', error.message);
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

// Health check function
const checkConnection = async () => {
  try {
    const readyState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (readyState === 1) {
      // Ping the database to ensure connection is alive
      if (mongoose.connection.db && mongoose.connection.db.admin) {
        await mongoose.connection.db.admin().ping();
        return true;
      }
      return true; // Connection ready but db object not available yet
    }
    return false;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
};

module.exports = connectDB;
module.exports.checkConnection = checkConnection;
