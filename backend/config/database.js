const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    console.log('🔄 Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 5000, // Increased for Lambda cold starts
      socketTimeoutMS: 10000,
      maxPoolSize: process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 5, // Limit connections in Lambda
      minPoolSize: 0, // Allow closing connections in Lambda
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    };

    console.log('🔗 Creating new MongoDB connection...');
    cached.promise = mongoose.connect(process.env.MONGODB_URI, options);
  }

  try {
    cached.conn = await cached.promise;
    console.log(`✅ MongoDB Connected: ${cached.conn.connection.host}`);
    
    if (!mongoose.connection._events || !mongoose.connection._events.error) {
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
      console.log('📧 Contact Akrm Al-Hakimi for MongoDB configuration');
      process.exit(1);
    }
    
    throw error;
  }
};

module.exports = connectDB;
