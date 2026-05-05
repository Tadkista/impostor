const Room = require('../models/Room');
const User = require('../models/User');
const { getRandomWord, cleanupRoomWords } = require('../utils/wordManager');

const games = {}; // Keyed by room code
const socketToRoom = {}; // Keyed by socket.id

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Removed old substring-based generateHint — replaced by semantic generateImpostorHint utility.

/**
 * Build the leaderboard snapshot for a set of user IDs.
 * All computation happens server-side.
 */
const buildLeaderboardSnapshot = async (userIds) => {
  const users = await User.find({ _id: { $in: userIds } })
    .select('nick globalPoints totalGamePoints')
    .lean();

  return users
    .map(u => ({
      id: u._id,
      nick: u.nick,
      globalPoints: u.globalPoints || 0,
      totalGamePoints: u.totalGamePoints || 0,
      totalScore: (u.totalGamePoints || 0) + (u.globalPoints || 0)
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((u, i) => ({ ...u, rank: i + 1 }));
};

/**
 * Broadcast game state to all sockets in the room.
 * Strips sensitive/internal fields before sending.
 */
const emitRoomUpdate = (io, roomCode) => {
  if (!games[roomCode]) return;

  const game = games[roomCode];
  const sanitised = {
    code: game.code,
    hostId: game.hostId,
    settings: game.settings,
    status: game.status,
    currentPlayerIndex: game.currentPlayerIndex,
    turnStartTime: game.turnStartTime,
    bonusTriggered: game.bonusTriggered,
    isLastRound: game.isLastRound,
    roundMultiplier: game.roundMultiplier,
    roundMultiplier: game.roundMultiplier,
    readyCount: game.readyPlayers ? game.readyPlayers.size : 0,
    readyPlayers: game.readyPlayers ? Array.from(game.readyPlayers) : [],
    totalPlayers: game.players.length,
    devices: game.devices || {},
    // Strip sensitive fields: currentWord, impostors, socketIds
    players: game.players.map(p => ({
      userId: p.userId,
      nick: p.nick,
      score: p.score,
      wantToVote: p.wantToVote,
      votedFor: p.votedFor,
      deviceId: p.deviceId,
      online: p.socketIds.size > 0
    }))
  };

  io.to(roomCode).emit('room_update', sanitised);
};

/**
 * Send role-specific game start info to a single player socket.
 * IMPOSTOR: receives ONLY { role, impostorHint }
 * PLAYER:   receives ONLY { role, password }
 * Called on game start AND on reconnect.
 */
const sendRoleInfo = (io, game, player, socketId) => {
  if (player.isImpostor) {
    io.to(socketId).emit('game_start_info', {
      role: 'impostor',
      impostorHint: game.impostorHint,
    });
  } else {
    io.to(socketId).emit('game_start_info', {
      role: 'player',
      password: game.currentWord,
    });
  }
};

const startVotingPhase = (io, roomCode) => {
  const game = games[roomCode];
  if (!game || game.status === 'voting' || game.status === 'finished') return;

  game.status = 'voting';
  io.to(roomCode).emit('voting_started', { message: 'Rozpoczęto głosowanie!' });
  emitRoomUpdate(io, roomCode);
};

const clearTurnTimeout = (game) => {
  if (game.expirationTimer) {
    clearTimeout(game.expirationTimer);
    game.expirationTimer = null;
  }
};

const triggerHostDecision = (io, roomCode) => {
  const game = games[roomCode];
  if (!game) return;

  pauseTimer(game);
  game.pendingHostDecision = true;

  const hostPlayer = game.players.find(p => p.userId === game.hostId);
  if (hostPlayer && hostPlayer.socketIds.size > 0) {
    for (const sid of hostPlayer.socketIds) {
      io.to(sid).emit('game:host-decision', { message: 'Czy gracz może kontynuować?' });
    }
  } else {
    // If host offline, auto force-end
    exports.handleHostDecision(io, null, { code: roomCode, allow: false });
  }
};

const startTurnTimeout = (io, roomCode) => {
  const game = games[roomCode];
  if (!game || game.isOvertime) return;

  clearTurnTimeout(game);

  const timePerPlayerMs = game.settings.timePerPlayer * 1000;
  const timeRemaining = timePerPlayerMs - game.accumulatedTime;

  if (timeRemaining <= 0) {
    triggerHostDecision(io, roomCode);
    return;
  }

  game.expirationTimer = setTimeout(() => {
    triggerHostDecision(io, roomCode);
  }, timeRemaining);
};

const pauseTimer = (game) => {
  if (game.isTimerPaused) return;
  game.isTimerPaused = true;
  game.accumulatedTime += Date.now() - game.turnStartTime;
  game.turnStartTime = null;
  clearTurnTimeout(game);
};

const resumeTimer = (io, roomCode) => {
  const game = games[roomCode];
  if (!game) return;
  if (!game.isTimerPaused) return;

  game.isTimerPaused = false;
  game.turnStartTime = Date.now();
  startTurnTimeout(io, roomCode);
};

const nextTurn = (io, roomCode) => {
  const game = games[roomCode];
  if (!game || game.status !== 'playing') return;

  clearTurnTimeout(game);

  game.currentPlayerIndex++;

  if (game.currentPlayerIndex >= game.players.length) {
    game.currentPlayerIndex = 0;

    if (game.bonusTriggered && !game.isLastRound) {
      game.isLastRound = true;
      game.roundMultiplier = 2;
    } else if (game.isLastRound) {
      startVotingPhase(io, roomCode);
      return;
    }
  }

  // Reset approval state for the new turn
  game.pendingApproval = false;
  game.pendingHostDecision = false;
  game.accumulatedTime = 0;
  game.isTimerPaused = false;
  game.isOvertime = false;
  game.turnStartTime = Date.now();

  io.to(roomCode).emit('turn_started', {
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    turnStartTime: game.turnStartTime,
    isLastRound: game.isLastRound,
    roundMultiplier: game.roundMultiplier
  });

  startTurnTimeout(io, roomCode);

  emitRoomUpdate(io, roomCode);
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

exports.handleJoinRoom = async (io, socket, { code }) => {
  try {
    const userId = socket.user.userId;
    const room = await Room.findOne({ code });
    if (!room) return socket.emit('error', 'Room not found');

    const isPlayer = room.players.some(p => p.userId.toString() === userId);
    if (!isPlayer) return socket.emit('error', 'You must join via REST API first');

    socket.join(code);
    socketToRoom[socket.id] = code;

    if (!games[code]) {
      games[code] = {
        code,
        roomId: room._id,
        hostId: room.hostId.toString(),
        settings: room.settings,
        players: room.players.map(p => ({
          userId: p.userId.toString(),
          nick: p.nick,
          socketIds: new Set(),
          score: 0,
          isImpostor: false,
          wantToVote: false,
          votedFor: null
        })),
        status: 'waiting',
        currentWord: null,
        impostorHint: null,
        impostors: [],
        readyPlayers: new Set(),
        devices: {},
        currentPlayerIndex: 0,
        turnStartTime: null,
        accumulatedTime: 0,
        isTimerPaused: false,
        isOvertime: false,
        expirationTimer: null,
        pendingApproval: false,
        pendingHostDecision: false,
        bonusTriggered: false,
        isLastRound: false,
        roundMultiplier: 1,
        votes: {},
        resolving: false // idempotency guard for resolveGame
      };
    } else {
      // Sync any REST-joined players not yet in memory
      for (const rp of room.players) {
        const rpId = rp.userId.toString();
        if (!games[code].players.find(p => p.userId === rpId)) {
          games[code].players.push({
            userId: rpId,
            nick: rp.nick,
            socketIds: new Set(),
            score: 0,
            isImpostor: false,
            wantToVote: false,
            votedFor: null
          });
        }
      }
    }

    const player = games[code].players.find(p => p.userId === userId);
    if (player) {
      player.socketIds.add(socket.id);
    }

    // If game is in confirming or playing phase, re-send role info to reconnecting player
    const game = games[code];
    if (game.status !== 'waiting' && player) {
      sendRoleInfo(io, game, player, socket.id);
    }

    emitRoomUpdate(io, code);
  } catch (err) {
    console.error('handleJoinRoom error:', err);
    socket.emit('error', 'Failed to join room');
  }
};

exports.handleLeaveRoom = (io, socket, { code }) => {
  socket.leave(code);
  delete socketToRoom[socket.id];

  const game = games[code];
  if (game) {
    const player = game.players.find(p => p.userId === socket.user.userId);
    if (player) player.socketIds.delete(socket.id);
    emitRoomUpdate(io, code);
  }
};

exports.handleStartGame = async (io, socket, { code }) => {
  const game = games[code];
  if (!game) return socket.emit('error', 'Game not found');
  if (game.hostId !== socket.user.userId) return socket.emit('error', 'Only host can start');
  if (game.status !== 'waiting') return socket.emit('error', 'Game already started');
  if (game.players.length < 3) return socket.emit('error', 'Need at least 3 players to start');

  try {
    const picked = getRandomWord(code);
    game.currentWord     = picked.word;
    game.impostorHint    = picked.hint || 'powiązany obiekt lub pojęcie';

    // Fisher-Yates shuffle to pick impostors
    const indices = game.players.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const impostorIndices = indices.slice(0, game.settings.impostorsCount);
    impostorIndices.forEach(idx => {
      game.players[idx].isImpostor = true;
      game.impostors.push(game.players[idx].userId);
    });

    game.status = 'confirming';
    game.readyPlayers = new Set();
    await Room.findByIdAndUpdate(game.roomId, { status: 'playing' });

    io.to(code).emit('game_started', { message: 'Gra rozpoczęta! Potwierdź gotowość.' });

    // Send role-specific info to each player's socket(s)
    game.players.forEach(p => {
      if (p.deviceId) {
        const device = game.devices[p.deviceId];
        if (device && device.activePlayerId !== p.userId) return; // Skip inactive local players
      }
      for (const sid of p.socketIds) {
        sendRoleInfo(io, game, p, sid);
      }
    });

    emitRoomUpdate(io, code);
    // Timer does NOT start yet — waiting for all players to confirm via game_ready

  } catch (err) {
    console.error('handleStartGame error:', err);
    socket.emit('error', 'Nie udało się rozpocząć gry');
  }
};

// ─── Multi-Device Management ────────────────────────────────────────────────

exports.handleAddLocalPlayer = (io, socket, { code, nick }) => {
  const game = games[code];
  if (!game || game.status !== 'waiting') return;
  if (!game.settings.multiDeviceMode) return;
  
  const ownerId = socket.user.userId;
  const guestId = `guest_${ownerId}_${Date.now()}`;
  
  game.players.push({
    userId: guestId,
    nick,
    socketIds: new Set([socket.id]),
    score: 0,
    isImpostor: false,
    wantToVote: false,
    votedFor: null,
    deviceId: ownerId
  });

  if (!game.devices) game.devices = {};
  if (!game.devices[ownerId]) {
    game.devices[ownerId] = {
      activePlayerId: ownerId,
      playerIds: [ownerId]
    };
    const ownerPlayer = game.players.find(p => p.userId === ownerId);
    if (ownerPlayer) ownerPlayer.deviceId = ownerId;
  }
  
  game.devices[ownerId].playerIds.push(guestId);
  emitRoomUpdate(io, code);
};

exports.handleDeviceNextPlayer = (io, socket, { code, targetUserId }) => {
  const game = games[code];
  if (!game) return;
  
  const ownerId = socket.user.userId;
  const device = game.devices?.[ownerId];
  if (!device) return;

  if (targetUserId && device.playerIds.includes(targetUserId)) {
    device.activePlayerId = targetUserId;
  } else {
    const currentIndex = device.playerIds.indexOf(device.activePlayerId);
    const nextIndex = (currentIndex + 1) % device.playerIds.length;
    device.activePlayerId = device.playerIds[nextIndex];
  }

  // If game is running, push role info to newly active player so they can see their UI immediately
  if (game.status === 'confirming' || game.status === 'playing' || game.status === 'voting') {
    const nextPlayer = game.players.find(p => p.userId === device.activePlayerId);
    if (nextPlayer) {
      sendRoleInfo(io, game, nextPlayer, socket.id);
    }
  }

  emitRoomUpdate(io, code);
};

// ─── Timer Control ────────────────────────────────────────────────────────────

exports.handlePauseRequest = (io, socket, { code }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.userId !== socket.user.userId) return;

  pauseTimer(game);
  io.to(code).emit('game:timer-paused', { accumulatedTime: game.accumulatedTime });
};

exports.handleTimerResume = (io, socket, { code }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.userId !== socket.user.userId) return;

  resumeTimer(io, code);
  io.to(code).emit('game:timer-resume', { turnStartTime: game.turnStartTime, accumulatedTime: game.accumulatedTime });
};

exports.handleHostDecision = (io, socket, { code, allow }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;
  
  if (socket && game.hostId !== socket.user.userId) return socket.emit('error', 'Only host can decide');
  if (!game.pendingHostDecision) return;

  game.pendingHostDecision = false;

  if (allow) {
    game.isOvertime = true;
    resumeTimer(io, code);
    io.to(code).emit('game:timer-resume', { turnStartTime: game.turnStartTime, accumulatedTime: game.accumulatedTime });
  } else {
    // Force end player turn
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer) {
      currentPlayer.lastAnswerTime = game.settings.timePerPlayer * 1000;
      const pointsEarned = 0;
      currentPlayer.score += pointsEarned;
      io.to(code).emit('approval_result', {
        userId: currentPlayer.userId,
        approved: false,
        pointsEarned,
        timeUsed: currentPlayer.lastAnswerTime,
        reason: 'Time expired'
      });
      nextTurn(io, code);
    }
  }
};

// ─── Player Ready Confirmation ────────────────────────────────────────────────

exports.handleGameReady = (io, socket, { code }) => {
  const game = games[code];
  if (!game) return;
  if (game.status !== 'confirming') return;

  const userId = socket.user.userId;
  const player = game.players.find(p => p.userId === userId);
  if (!player) return;

  // Idempotent: ignore duplicate readies
  game.readyPlayers.add(userId);

  // Broadcast updated ready count
  emitRoomUpdate(io, code);

  // When ALL players are ready, start the first turn
  if (game.readyPlayers.size >= game.players.length) {
    game.status = 'playing';
    game.currentPlayerIndex = -1;
    nextTurn(io, code);
  }
};

exports.handlePlayerFinished = (io, socket, { code }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return socket.emit('error', 'Game is not in playing state');

  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.userId !== socket.user.userId) {
    return socket.emit('error', 'Not your turn');
  }

  if (!game.isTimerPaused) {
    pauseTimer(game);
  }

  // Prevent double-finish (spam protection)
  if (game.pendingApproval) return socket.emit('error', 'Already awaiting approval');
  game.pendingApproval = true;
  game.pendingHostDecision = false; // Override any timeout

  currentPlayer.lastAnswerTime = game.accumulatedTime;

  const hostPlayer = game.players.find(p => p.userId === game.hostId);
  if (hostPlayer && hostPlayer.socketIds.size > 0) {
    const payload = { userId: currentPlayer.userId, nick: currentPlayer.nick };
    for (const sid of hostPlayer.socketIds) {
      io.to(sid).emit('approval_request', payload);
    }
  } else {
    // Host offline — auto-approve with full points
    const pointsEarned = 1000 * game.roundMultiplier;
    currentPlayer.score += pointsEarned;
    io.to(code).emit('approval_result', {
      userId: currentPlayer.userId,
      approved: true,
      pointsEarned,
      timeUsed: currentPlayer.lastAnswerTime,
      reason: 'Host unavailable, auto-approved'
    });
    nextTurn(io, code);
  }
};

exports.handleHostApprove = (io, socket, { code, approved }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;
  if (game.hostId !== socket.user.userId) return socket.emit('error', 'Only host can approve');
  if (!game.pendingApproval) return socket.emit('error', 'No pending approval');

  // Mark as handled immediately to prevent double-processing
  game.pendingApproval = false;

  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer) return;

  const timeUsed = currentPlayer.lastAnswerTime || game.accumulatedTime;
  let pointsEarned = 0;

  if (approved) {
    const timePerPlayerMs = game.settings.timePerPlayer * 1000;
    const percentUsed = timeUsed / timePerPlayerMs;

    if (percentUsed < 0.1) {
      pointsEarned = 1000;
    } else {
      pointsEarned = Math.round(1000 - (1000 * percentUsed));
      if (pointsEarned < 0) pointsEarned = 0;
    }
  } else {
    pointsEarned = -2500;
  }

  pointsEarned *= game.roundMultiplier;
  currentPlayer.score += pointsEarned;

  io.to(code).emit('approval_result', {
    userId: currentPlayer.userId,
    approved,
    pointsEarned,
    timeUsed
  });

  nextTurn(io, code);
};

exports.handleTriggerBonus = (io, socket, { code }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;
  if (game.hostId !== socket.user.userId) return socket.emit('error', 'Only host can trigger bonus');
  if (game.bonusTriggered) return socket.emit('error', 'Bonus already triggered');

  game.bonusTriggered = true;

  emitRoomUpdate(io, code);
  io.to(code).emit('game_started', {
    message: 'Bonus Round queued! Next round will be the LAST round with 2× points.'
  });
};

exports.handleStartVoting = (io, socket, { code }) => {
  const game = games[code];
  if (!game || game.status !== 'playing') return;

  const player = game.players.find(p => p.userId === socket.user.userId);
  if (!player) return;
  if (player.wantToVote) return; // Ignore spam

  player.wantToVote = true;

  if (game.players.every(p => p.wantToVote)) {
    startVotingPhase(io, code);
  } else {
    emitRoomUpdate(io, code);
  }
};

// ─── Vote resolution (idempotent) ────────────────────────────────────────────

const resolveGame = async (io, code) => {
  const game = games[code];
  if (!game) return;

  // Idempotency guard: prevent double-execution from concurrent events
  if (game.resolving) return;
  game.resolving = true;

  game.status = 'finished';

  // Tally votes
  const voteCounts = {};
  Object.values(game.votes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let maxVotes = 0;
  let votedPlayerId = null;
  for (const [id, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      votedPlayerId = id;
    }
  }

  const isCorrect = game.impostors.includes(votedPlayerId);

  // Persist points with SEPARATE atomic $inc operations
  const updates = [];
  const playerResults = [];

  for (const p of game.players) {
    let globalPointsDelta = 0;

    if (isCorrect) {
      globalPointsDelta = p.isImpostor ? 0 : 10;
    } else {
      if (p.userId === votedPlayerId) globalPointsDelta = 0;
      else if (p.isImpostor) globalPointsDelta = 10;
      else globalPointsDelta = -10;
    }

    const inc = {};
    if (globalPointsDelta !== 0) inc.globalPoints = globalPointsDelta;
    if (p.score !== 0) inc.totalGamePoints = p.score;

    if (Object.keys(inc).length > 0) {
      updates.push(User.findByIdAndUpdate(p.userId, { $inc: inc }));
    }

    playerResults.push({
      userId: p.userId,
      nick: p.nick,
      gamePoints: p.score,
      globalPointsDelta,
      isImpostor: p.isImpostor
    });
  }

  await Promise.all(updates);
  cleanupRoomWords(code);
  await Room.findByIdAndDelete(game.roomId);

  // Emit voting results with full breakdown
  io.to(code).emit('voting_results', {
    votedPlayerId,
    isCorrect,
    impostors: game.impostors,
    votes: game.votes,
    playerResults
  });

  io.to(code).emit('game_finished', { message: 'Game has ended!' });

  // Build and emit fresh leaderboard snapshot from DB
  const playerIds = game.players.map(p => p.userId);
  try {
    const leaderboard = await buildLeaderboardSnapshot(playerIds);
    io.to(code).emit('leaderboard_update', { leaderboard });
  } catch (err) {
    console.error('Failed to emit leaderboard update:', err);
  }

  delete games[code];
};

exports.handleCastVote = async (io, socket, { code, targetId }) => {
  const game = games[code];
  if (!game || game.status !== 'voting') return socket.emit('error', 'Not in voting phase');

  const voterId = socket.user.userId;
  if (voterId === targetId) return socket.emit('error', 'Cannot vote for yourself');

  const voter = game.players.find(p => p.userId === voterId);
  if (!voter) return;
  if (voter.votedFor) return socket.emit('error', 'Already voted');

  const target = game.players.find(p => p.userId === targetId);
  if (!target) return socket.emit('error', 'Target player not found');

  voter.votedFor = targetId;
  game.votes[voterId] = targetId;

  // Check if all online players have voted
  const activePlayers = game.players.filter(p => p.socketIds.size > 0);
  const allActiveVoted = activePlayers.every(p => p.votedFor !== null);

  if (allActiveVoted) {
    await resolveGame(io, code);
  } else {
    emitRoomUpdate(io, code);
  }
};

exports.handleDisconnect = (io, socket) => {
  const code = socketToRoom[socket.id];
  if (!code) return;

  delete socketToRoom[socket.id];

  const game = games[code];
  if (!game) return;

  const userId = socket.user.userId;
  const playerIndex = game.players.findIndex(p => p.userId === userId);

  if (playerIndex !== -1) {
    game.players[playerIndex].socketIds.delete(socket.id);

    // Only act on "fully disconnected" (all tabs closed)
    if (game.players[playerIndex].socketIds.size === 0) {
      // Mid-turn disconnect penalty
      if (game.status === 'playing' && game.currentPlayerIndex === playerIndex) {
        const penalty = -2500 * game.roundMultiplier;
        game.players[playerIndex].score += penalty;
        io.to(code).emit('approval_result', {
          userId,
          approved: false,
          pointsEarned: penalty,
          timeUsed: Date.now() - (game.turnStartTime || Date.now()),
          reason: 'Player disconnected'
        });
        nextTurn(io, code);
      }

      // Check if their disconnect unblocks voting resolution
      if (game.status === 'voting' && !game.resolving) {
        const activePlayers = game.players.filter(p => p.socketIds.size > 0);
        if (activePlayers.length > 0 && activePlayers.every(p => p.votedFor !== null)) {
          resolveGame(io, code).catch(console.error);
          return;
        }
      }
    }
  }

  // Host reassignment — but only if the host did NOT explicitly close the room
  if (game.hostId === userId && game.status !== 'finished' && !game.closing) {
    const hasActiveSockets = game.players[playerIndex]?.socketIds.size > 0;
    if (!hasActiveSockets) {
      const nextHost = game.players.find(p => p.socketIds.size > 0);
      if (nextHost) {
        game.hostId = nextHost.userId;
        emitRoomUpdate(io, code);
        io.to(code).emit('game_started', { message: `${nextHost.nick} is now the host.` });
      } else {
        Room.findByIdAndDelete(game.roomId).catch(() => {});
        delete games[code];
        return;
      }
    }
  }

  emitRoomUpdate(io, code);
};

// ─── Close Room (Host Only) ───────────────────────────────────────────────────

exports.handleCloseRoom = async (io, socket, { code }) => {
  const game = games[code];
  if (!game) return socket.emit('error', 'Room not found');
  if (game.hostId !== socket.user.userId) return socket.emit('error', 'Only the host can close the room');

  // Idempotency: prevent double-execution
  if (game.closing) return;
  game.closing = true;

  try {
    cleanupRoomWords(code);
    await Room.findByIdAndDelete(game.roomId);
    io.to(code).emit('room:closed', { reason: 'host_closed' });
  } catch (err) {
    console.error('handleCloseRoom DB error:', err);
  } finally {
    delete games[code];
  }
};
