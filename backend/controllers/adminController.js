const User = require('../models/User');
const Newsletter = require('../models/Newsletter');

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      adminUsers,
      recentSignups,
      newsletterSubscribers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ role: { $in: ['admin', 'superuser'] } }),
      User.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Newsletter.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        adminUsers,
        recentSignups,
        newsletterSubscribers
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching dashboard stats'
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const roleFilter = req.query.role || '';
    const statusFilter = req.query.status || '';

    const filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (roleFilter) {
      filter.role = roleFilter;
    }
    
    if (statusFilter) {
      filter.status = statusFilter;
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('username fullName email role status profilePicture createdAt lastLogin bannedAt bannedBy banReason')
        .populate('bannedBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching users'
    });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['member', 'moderator', 'admin', 'superuser'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role specified'
      });
    }

    if ((role === 'admin' || role === 'superuser') && req.user.role !== 'superuser') {
      return res.status(403).json({
        success: false,
        error: 'Only superusers can assign admin or superuser roles'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('username fullName email role status');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating user role'
    });
  }
};

exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: 'banned',
        bannedAt: new Date(),
        bannedBy: req.user.id,
        banReason: reason || 'No reason provided'
      },
      { new: true }
    ).select('username fullName email role status bannedAt banReason');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User banned successfully',
      user
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error banning user'
    });
  }
};

exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: 'active',
        bannedAt: null,
        bannedBy: null,
        banReason: null
      },
      { new: true }
    ).select('username fullName email role status');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User unbanned successfully',
      user
    });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error unbanning user'
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.targetUser.role === 'superuser' && req.user.role !== 'superuser') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete superuser account'
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting user'
    });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('username fullName email role status profilePicture createdAt lastLogin bannedAt bannedBy banReason')
      .populate('bannedBy', 'username fullName');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching user details'
    });
  }
}; 