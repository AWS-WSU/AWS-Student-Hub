const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Trust proxy when running in Lambda/API Gateway
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.set('trust proxy', true);
}

// OPTIONS requests are handled directly in lambda.js before reaching Express
// This ensures consistent CORS behavior across all routes

// Only connect to database for non-OPTIONS requests
const connectDB = require('./config/database');
connectDB().catch(err => {
  console.error('Database connection failed:', err);
  // Don't crash the Lambda function
});

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
    [
      'https://wayneaws.dev', 
      'https://www.wayneaws.dev', 
      'https://prizeversity.com',      
      'https://www.prizeversity.com',  
      'http://localhost:5173', 
      'http://localhost:3000'
    ];
    
    // Check for Amplify domains
    const isAmplifyDomain = origin && origin.includes('.amplifyapp.com');
    
    if (allowedOrigins.includes(origin) || isAmplifyDomain) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  // Only set timeouts if not running in Lambda
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    req.setTimeout(25000);
    res.setTimeout(25000);
  }
  next();
});

const authRoutes = require('./routes/auth');
const newsletterRoutes = require('./routes/newsletter');
const uploadRoutes = require('./routes/upload');
const discordInviteRoutes = require('./routes/discordInvite');
const adminRoutes = require('./routes/admin');
const eventRoutes = require('./routes/events');
const verifyRoutes = require('./routes/verify');

app.use('/auth', authRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/upload', uploadRoutes);
app.use('/', discordInviteRoutes);
app.use('/admin', adminRoutes);
app.use('/events', eventRoutes);
app.use('/verify', verifyRoutes);  

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AWS Student Hub Backend is running on Lambda',
    timestamp: new Date().toISOString(),
    environment: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'lambda' : 'local'
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  // CORS headers are handled by lambda.js response hook
  res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;