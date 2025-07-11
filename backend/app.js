const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

dotenv.config();

const app = express();

// Trust proxy when running in Lambda/API Gateway
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.set('trust proxy', true);
}

connectDB();

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
      ['https://wayneaws.dev', 'https://www.wayneaws.dev', 'http://localhost:5173', 'http://localhost:3000'];
    
    if (allowedOrigins.includes(origin)) {
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

app.use('/auth', authRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/upload', uploadRoutes);
app.use('/discord', discordInviteRoutes);
app.use('/admin', adminRoutes);

app.get('/api/health', (req, res) => {
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
  res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app; 