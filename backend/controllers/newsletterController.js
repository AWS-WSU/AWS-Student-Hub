const Newsletter = require('../models/Newsletter');
const validator = require('validator');
const memoryStorage = require('../storage/memoryStorage');
const mongoose = require('mongoose');

// Check if MongoDB is connected
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Subscribe to newsletter
const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Use MongoDB if connected, otherwise use memory storage
    if (isMongoConnected()) {
      // MongoDB implementation
      const existingSubscription = await Newsletter.findOne({ email: normalizedEmail });
      
      if (existingSubscription) {
        if (existingSubscription.isActive) {
          return res.status(409).json({
            success: false,
            message: 'This email is already subscribed to our newsletter'
          });
        } else {
          existingSubscription.isActive = true;
          existingSubscription.subscribedAt = new Date();
          await existingSubscription.save();
          
          return res.status(200).json({
            success: true,
            message: 'Welcome back! Your newsletter subscription has been reactivated.'
          });
        }
      }

      const newSubscription = new Newsletter({ email: normalizedEmail });
      await newSubscription.save();
    } else {
      // Memory storage fallback
      console.warn('⚠️  Using in-memory storage. Contact Akrm Al-Hakimi for MongoDB setup.');
      
      const existingSubscription = await memoryStorage.findOne({ email: normalizedEmail });
      
      if (existingSubscription && existingSubscription.isActive) {
        return res.status(409).json({
          success: false,
          message: 'This email is already subscribed to our newsletter'
        });
      }

      if (existingSubscription && !existingSubscription.isActive) {
        await memoryStorage.updateOne(normalizedEmail, { 
          isActive: true, 
          subscribedAt: new Date() 
        });
        
        return res.status(200).json({
          success: true,
          message: 'Welcome back! Your newsletter subscription has been reactivated.'
        });
      }

      await memoryStorage.save({ email: normalizedEmail });
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter! Thank you for joining us.'
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This email is already subscribed to our newsletter'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
  }
};

// Get all subscriptions (admin endpoint)
const getAllSubscriptions = async (req, res) => {
  try {
    let subscriptions;
    
    if (isMongoConnected()) {
      subscriptions = await Newsletter.find({ isActive: true })
        .select('email subscribedAt')
        .sort({ subscribedAt: -1 });
    } else {
      subscriptions = await memoryStorage.findAll();
    }

    res.status(200).json({
      success: true,
      data: subscriptions,
      count: subscriptions.length,
      storage: isMongoConnected() ? 'MongoDB' : 'Memory (temporary)'
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving subscriptions'
    });
  }
};

// Unsubscribe from newsletter
const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const normalizedEmail = email.toLowerCase();

    if (isMongoConnected()) {
      const subscription = await Newsletter.findOne({ email: normalizedEmail });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Email not found in our newsletter list'
        });
      }

      subscription.isActive = false;
      await subscription.save();
    } else {
      const subscription = await memoryStorage.findOne({ email: normalizedEmail });
      
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Email not found in our newsletter list'
        });
      }

      await memoryStorage.updateOne(normalizedEmail, { isActive: false });
    }

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
  }
};

module.exports = {
  subscribe,
  getAllSubscriptions,
  unsubscribe
};
