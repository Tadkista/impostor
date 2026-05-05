const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Auth Error: No token provided' });
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    
    // Pass user object down if needed
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server Error verifying admin role', error: error.message });
  }
};
