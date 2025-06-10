const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 15000,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 5000,
      heartbeatFrequencyMS: 3000,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('📧 Contact Akrm Al-Hakimi for MongoDB configuration');
    
    process.exit(1);
  }
};

module.exports = connectDB;
