const Room = require('../models/Room');
const Category = require('../models/Category');
const User = require('../models/User');
const { generateCode } = require('../utils/generateCode');

// Nick validation: 2-20 chars, alphanumeric + spaces + basic unicode, no leading/trailing whitespace
const validateNick = (nick) => {
  if (!nick || typeof nick !== 'string') return 'Nickname is required';
  const trimmed = nick.trim();
  if (trimmed.length < 2) return 'Nickname must be at least 2 characters';
  if (trimmed.length > 20) return 'Nickname must be at most 20 characters';
  // Reject HTML/script injection patterns
  if (/<|>|&|"|'/.test(trimmed)) return 'Nickname contains invalid characters';
  return null; // valid
};

exports.createRoom = async (req, res) => {
  try {
    const { maxPlayers, impostorsCount, timePerPlayer, multiDeviceMode, nick } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!maxPlayers || maxPlayers < 3) {
      return res.status(400).json({ message: 'maxPlayers must be at least 3' });
    }
    
    if (impostorsCount === undefined || impostorsCount < 1 || impostorsCount > Math.floor(maxPlayers / 2)) {
      return res.status(400).json({ message: 'impostorsCount must be valid (at least 1, and max 50% of maxPlayers)' });
    }

    if (!timePerPlayer || timePerPlayer < 10) {
      return res.status(400).json({ message: 'timePerPlayer must be at least 10 seconds' });
    }



    const host = await User.findById(userId);
    if (!host) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine display nick: use provided nick or fall back to account nick
    const displayNick = (nick && nick.trim()) ? nick.trim() : host.nick;
    const nickError = validateNick(displayNick);
    if (nickError) {
      return res.status(400).json({ message: nickError });
    }

    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateCode(6);
      const existingRoom = await Room.findOne({ code });
      if (!existingRoom) isUnique = true;
    }

    const room = new Room({
      code,
      hostId: userId,
      players: [{ userId: host._id, nick: displayNick }],
      settings: {
        maxPlayers,
        impostorsCount,
        timePerPlayer,
        multiDeviceMode: Boolean(multiDeviceMode)
      },
      status: 'waiting'
    });

    await room.save();

    res.status(201).json({ message: 'Room created', room });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { code, nick } = req.body;
    const userId = req.user.userId;

    if (!code) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    // Use findOneAndUpdate with conditions to prevent race conditions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine display nick
    const displayNick = (nick && nick.trim()) ? nick.trim() : user.nick;
    const nickError = validateNick(displayNick);
    if (nickError) {
      return res.status(400).json({ message: nickError });
    }

    // Atomic find-and-update: only add player if room exists, is waiting,
    // not full, player not already in, and nick not taken
    const room = await Room.findOneAndUpdate(
      {
        code,
        status: 'waiting',
        'players.userId': { $ne: user._id }, // user not already in room
        'players.nick': { $ne: displayNick }, // nick not taken in this room
        $expr: { $lt: [{ $size: '$players' }, '$settings.maxPlayers'] } // not full
      },
      {
        $push: { players: { userId: user._id, nick: displayNick } }
      },
      { new: true }
    );

    if (!room) {
      // Determine specific error
      const existing = await Room.findOne({ code });
      if (!existing) return res.status(404).json({ message: 'Nie znaleziono pokoju' });
      if (existing.status !== 'waiting') return res.status(400).json({ message: 'Nie można dołączyć: gra już się rozpoczęła lub zakończyła' });
      if (existing.players.some(p => p.userId.toString() === userId.toString())) {
        return res.status(400).json({ message: 'Jesteś już w tym pokoju' });
      }
      if (existing.players.some(p => p.nick === displayNick)) {
        return res.status(400).json({ message: `Pseudonim "${displayNick}" jest już zajęty w tym pokoju` });
      }
      if (existing.players.length >= existing.settings.maxPlayers) {
        return res.status(400).json({ message: 'Pokój jest pełny' });
      }
      return res.status(400).json({ message: 'Nie udało się dołączyć do pokoju' });
    }

    res.status(200).json({ message: 'Joined room successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.userId;

    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const playerIndex = room.players.findIndex(p => p.userId.toString() === userId.toString());
    if (playerIndex === -1) {
      return res.status(400).json({ message: 'You are not in this room' });
    }

    room.players.splice(playerIndex, 1);

    if (room.players.length === 0) {
      await Room.findByIdAndDelete(roomId);
      return res.status(200).json({ message: 'Left room successfully, room deleted as it is empty' });
    }

    if (room.hostId.toString() === userId.toString()) {
      room.hostId = room.players[0].userId; // Reassign host to the first remaining player
    }

    await room.save();
    res.status(200).json({ message: 'Left room successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRoomState = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.status(200).json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'waiting' }).populate('hostId', 'nick');
    // Filter out full rooms and format response
    const availableRooms = rooms
      .filter(room => room.players.length < room.settings.maxPlayers)
      .map(room => ({
        roomCode: room.code,
        host: room.hostId ? room.hostId.nick : 'Unknown',
        players: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        status: room.status
      }));

    res.status(200).json(availableRooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
