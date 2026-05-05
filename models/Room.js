const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 6-char unique
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  players: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nick: String
  }],
  settings: {
    maxPlayers: { type: Number, required: true, min: 3 },
    impostorsCount: { type: Number, required: true },
    timePerPlayer: { type: Number, required: true },
    multiDeviceMode: { type: Boolean, default: false }
  },
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
