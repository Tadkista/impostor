const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Auth Error: No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Auth Error: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId: ... }
    
    // Check if user is banned
    const user = await User.findById(decoded.userId).select('isBanned');
    if (!user) {
      return res.status(401).json({ message: 'Auth Error: User not found' });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: 'Auth Error: This account has been banned.' });
    }
    
    next();
  } catch (e) {
    res.status(401).json({ message: 'Auth Error: Invalid token' });
  }
};
