const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.warn('⚠️  MONGODB_URI not configured - newsletter signup will not work');
      console.warn('📧  Contact Akrm Al-Hakimi for MongoDB setup');
      return null;
    }
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.warn('📧  Contact Akrm Al-Hakimi for MongoDB configuration');
    return null;
  }
};

module.exports = connectDB;
