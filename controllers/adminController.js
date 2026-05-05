const User = require('../models/User');
const AdminAuditLog = require('../models/AdminAuditLog');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const roleFilter = req.query.role || '';
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nick: { $regex: search, $options: 'i' } }
      ];
    }
    if (roleFilter) {
      query.role = roleFilter;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalUsers: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { nick, role, isBanned } = req.body;
    const updateData = {};
    
    if (nick !== undefined) updateData.nick = nick;
    if (role !== undefined) updateData.role = role;
    if (isBanned !== undefined) updateData.isBanned = isBanned;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await AdminAuditLog.create({
      adminId: req.user.userId,
      action: 'UPDATE_USER',
      targetUserId: user._id,
      details: updateData
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    user.password = hashedPassword;
    await user.save();

    await AdminAuditLog.create({
      adminId: req.user.userId,
      action: 'RESET_PASSWORD',
      targetUserId: user._id,
      details: { tempPasswordLength: tempPassword.length }
    });

    res.json({ message: 'Password reset successfully', tempPassword });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

exports.banUser = async (req, res) => {
  try {
    const { isBanned } = req.body; // allow unbanning by passing false
    const status = isBanned === undefined ? true : isBanned;
    
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: status }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await AdminAuditLog.create({
      adminId: req.user.userId,
      action: status ? 'BAN_USER' : 'UNBAN_USER',
      targetUserId: user._id,
      details: { isBanned: status }
    });

    res.json({ message: `User successfully ${status ? 'banned' : 'unbanned'}`, user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating ban status', error: error.message });
  }
};
