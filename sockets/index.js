const jwt = require('jsonwebtoken');
const gameEngine = require('./gameEngine');

module.exports = (io) => {
  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error: No token'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.user.userId}`);

    socket.on('join_room', (data) => gameEngine.handleJoinRoom(io, socket, data));
    socket.on('leave_room', (data) => gameEngine.handleLeaveRoom(io, socket, data));
    socket.on('start_game', (data) => gameEngine.handleStartGame(io, socket, data));
    socket.on('game_ready', (data) => gameEngine.handleGameReady(io, socket, data));
    socket.on('add_local_player', (data) => gameEngine.handleAddLocalPlayer(io, socket, data));
    socket.on('device:next-player', (data) => gameEngine.handleDeviceNextPlayer(io, socket, data));
    socket.on('game:pause-request', (data) => gameEngine.handlePauseRequest(io, socket, data));
    socket.on('game:timer-resume', (data) => gameEngine.handleTimerResume(io, socket, data));
    socket.on('game:host-decision', (data) => gameEngine.handleHostDecision(io, socket, data));
    socket.on('player_finished', (data) => gameEngine.handlePlayerFinished(io, socket, data));
    socket.on('host_approve', (data) => gameEngine.handleHostApprove(io, socket, data));
    socket.on('trigger_bonus', (data) => gameEngine.handleTriggerBonus(io, socket, data));
    socket.on('start_voting', (data) => gameEngine.handleStartVoting(io, socket, data));
    socket.on('cast_vote', (data) => gameEngine.handleCastVote(io, socket, data));
    socket.on('close_room', (data) => gameEngine.handleCloseRoom(io, socket, data));

    socket.on('disconnect', () => gameEngine.handleDisconnect(io, socket));
  });
};
