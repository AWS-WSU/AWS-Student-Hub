const jwt = require('jsonwebtoken');
const User = require('../models/User');

const checkJwt = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'No token, authorization denied'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validate token version to ensure it's not revoked
    const user = await User.findById(decoded.id).select('tokenVersion status');
    
    if (!user) {
      return res.status(401).json({
        error: 'Token is not valid - user not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Account is not active'
      });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        error: 'Token has been revoked'
      });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        expired: true
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token is malformed'
      });
    }
    
    console.error('JWT verification error:', err);
    res.status(401).json({
      error: 'Token is not valid'
    });
  }
};

module.exports = checkJwt;