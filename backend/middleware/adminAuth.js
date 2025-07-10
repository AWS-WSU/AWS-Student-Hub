const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Check if user is authenticated and has minimum required role
const requireRole = (minRole = 'member') => {
  const roleHierarchy = {
    'member': 0,
    'moderator': 1,
    'admin': 2,
    'superuser': 3
  };

  return async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.header('Authorization');
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          error: 'Access denied. No token provided.'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user with role information
      const user = await User.findById(decoded.id).select('+role +status');
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid token. User not found.'
        });
      }

      // Check if user is banned or suspended
      if (user.status !== 'active') {
        return res.status(403).json({
          error: `Account is ${user.status}. Access denied.`
        });
      }

      // Check role hierarchy
      const userRoleLevel = roleHierarchy[user.role] || 0;
      const requiredRoleLevel = roleHierarchy[minRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          error: 'Insufficient permissions. Admin access required.'
        });
      }

      // Add user info to request
      req.user = {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status
      };

      next();
    } catch (err) {
      console.error('Admin auth middleware error:', err);
      res.status(401).json({
        error: 'Invalid token.'
      });
    }
  };
};

// Specific role checkers
const requireModerator = requireRole('moderator');
const requireAdmin = requireRole('admin'); 
const requireSuperuser = requireRole('superuser');

// Check if user can manage target user (can't manage equal or higher roles)
const canManageUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    const targetUser = await User.findById(targetUserId).select('role');
    
    if (!targetUser) {
      return res.status(404).json({
        error: 'Target user not found'
      });
    }

    const roleHierarchy = {
      'member': 0,
      'moderator': 1,
      'admin': 2,
      'superuser': 3
    };

    const currentUserLevel = roleHierarchy[req.user.role];
    const targetUserLevel = roleHierarchy[targetUser.role];

    // Can only manage users with lower role level
    if (currentUserLevel <= targetUserLevel) {
      return res.status(403).json({
        error: 'Cannot manage user with equal or higher privileges'
      });
    }

    req.targetUser = targetUser;
    next();
  } catch (error) {
    console.error('Can manage user check error:', error);
    res.status(500).json({
      error: 'Error checking user permissions'
    });
  }
};

module.exports = {
  requireRole,
  requireModerator,
  requireAdmin,
  requireSuperuser,
  canManageUser
}; 