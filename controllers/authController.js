const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateCode } = require('../utils/generateCode');

exports.register = async (req, res) => {
  try {
    const { name, nick, password } = req.body;
    
    if (!name || !nick || !password) {
      return res.status(400).json({ message: 'All fields (name, nick, password) are required' });
    }

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this name already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let friendCode;
    let isUnique = false;
    while (!isUnique) {
      friendCode = generateCode(6);
      const existingCode = await User.findOne({ friendCode });
      if (!existingCode) isUnique = true;
    }

    const user = new User({
      name,
      nick,
      password: hashedPassword,
      friendCode
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully', friendCode });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been banned.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        nick: user.nick,
        friendCode: user.friendCode,
        globalPoints: user.globalPoints,
        totalGamePoints: user.totalGamePoints || 0,
        role: user.role,
        isBanned: user.isBanned
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
