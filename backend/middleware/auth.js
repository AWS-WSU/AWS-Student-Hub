const jwt = require('jsonwebtoken');

const checkJwt = (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'No token, authorization denied'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Token is not valid'
    });
  }
};

module.exports = checkJwt;