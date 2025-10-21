const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Skip database connection for OPTIONS requests
  if (cached.conn) {
    console.log('🔄 Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    };

    console.log('🔗 Creating new MongoDB connection...');
    
    // Don't await connection in Lambda cold start for OPTIONS
    cached.promise = mongoose.connect(process.env.MONGODB_URI, options)
      .then(conn => {
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch(error => {
        console.error('❌ Database connection error:', error.message);
        cached.promise = null;
        // Re-throw only if not in Lambda or development
        if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
          throw error;
        }
        // In local dev, warn but don't crash
        console.log('⚠️ Running without database connection in development mode');
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
    
    if (cached.conn && (!mongoose.connection._events || !mongoose.connection._events.error)) {
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        cached.conn = null;
        cached.promise = null;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        cached.conn = null;
        cached.promise = null;
      });
    }

    return cached.conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    cached.promise = null;
    
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('⚠️ MongoDB connection failed in development');
      console.log('📧 Contact Akrm Al-Hakimi for MongoDB configuration');
      console.log('⚠️ Server will continue running but database operations will fail');
      // Don't exit in development - let the server run for testing OPTIONS
      return null;
    }
    
    throw error;
  }
};

module.exports = connectDB;
