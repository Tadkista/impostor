const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // login name
  nick: { type: String, required: true }, // display name
  password: { type: String, required: true },
  friendCode: { type: String, required: true, unique: true }, // 6-char unique
  globalPoints: { type: Number, default: 0 }, // voting-outcome points (+10 / -10 / 0)
  totalGamePoints: { type: Number, default: 0 }, // sum of time-based round scores across all games
  role: { type: String, enum: ['player', 'admin'], default: 'player' },
  isBanned: { type: Boolean, default: false },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
