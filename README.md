# Multiplayer Game Backend

REST API for a realtime multiplayer web game.

## Requirements
- Node.js
- MongoDB (local or Atlas)

## Getting Started

1. **Install Dependencies**
   Run the following command in the terminal to install all required packages:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Rename `.env.example` to `.env` and fill in your values. For local development, you can usually leave `MONGO_URI` pointing to a local MongoDB instance.
   ```bash
   copy .env.example .env
   ```

3. **Seed the Database**
   Before running the game, populate the database with categories and words using the seeder script:
   ```bash
   npm run seed
   ```

4. **Start the Server**
   Start the development server with nodemon:
   ```bash
   npm run dev
   ```
   Or start normally with Node:
   ```bash
   npm start
   ```

## Endpoints

### Auth
- `POST /api/auth/register` - Register new user (requires name, nick, password)
- `POST /api/auth/login` - Login user (requires name, password)

### Friends
- `POST /api/friends/add` - Add friend by friendCode
- `GET /api/friends/` - Get user's friend list

### Leaderboard
- `GET /api/leaderboard/` - Get sorted leaderboard of friends + yourself

### Rooms
- `POST /api/rooms/create` - Create room (requires maxPlayers, impostorsCount, timePerPlayer, categoryId)
- `POST /api/rooms/join` - Join room by code
- `POST /api/rooms/leave` - Leave room by roomId
- `GET /api/rooms/:code` - Get room state by 6-char code
