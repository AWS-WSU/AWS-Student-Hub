const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.warn('⚠️  MONGODB_URI not configured');
      console.warn('📧  Please contact project lead Akrm Al-Hakimi for MongoDB setup');
      console.warn('🔄  Falling back to in-memory storage for development');
      return null;
    }
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.warn('📧  Please contact project lead Akrm Al-Hakimi for MongoDB configuration');
    console.warn('🔄  Falling back to in-memory storage');
    return null;
  }
};

module.exports = connectDB;
