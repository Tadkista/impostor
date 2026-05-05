require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// Route imports
const authRoutes = require('./routes/auth');
const friendRoutes = require('./routes/friends');
const leaderboardRoutes = require('./routes/leaderboard');
const roomRoutes = require('./routes/rooms');
const adminRoutes = require('./routes/admin');
const setupSockets = require('./sockets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(express.json());

// Database connection
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('MONGO_URI missing from .env');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Initialize WebSockets
setupSockets(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
