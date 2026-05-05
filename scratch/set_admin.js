const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function setAdmin(username) {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    const result = await User.updateOne({ name: username }, { $set: { role: 'admin' } });
    if (result.matchedCount === 0) {
      console.log('No user found with name: ' + username);
    } else {
      console.log('Successfully set ' + username + ' as admin.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setAdmin('admin');
