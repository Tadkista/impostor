const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function listUsers() {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'name nick role createdAt');
    console.log('Users found:');
    users.forEach(u => {
      console.log('- ' + u.name + ' (Nick: ' + u.nick + ') | Role: ' + (u.role || 'player') + ' | Created: ' + u.createdAt);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
