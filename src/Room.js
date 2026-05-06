export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // Map of WebSocket -> Player ID
    this.gameState = null;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    
    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    // Parse player ID from URL query or headers
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') || 'guest';

    this.sessions.set(server, playerId);

    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleMessage(server, playerId, message);
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      this.broadcast(JSON.stringify({ type: 'player_disconnected', playerId }));
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async getGameState() {
    if (!this.gameState) {
      this.gameState = await this.state.storage.get('gameState') || {
        status: 'waiting',
        players: [],
        readyPlayers: [],
        currentWord: null,
        impostorHint: null,
        timeRemaining: 0
      };
    }
    return this.gameState;
  }

  async saveGameState() {
    if (this.gameState) {
      await this.state.storage.put('gameState', this.gameState);
    }
  }

  async handleMessage(ws, playerId, message) {
    const state = await this.getGameState();

    switch (message.type) {
      case 'join_room':
        const { nick, deviceId } = message.payload;
        // Logic to add player
        if (!state.players.find(p => p.id === playerId)) {
          state.players.push({ id: playerId, nick, deviceId, score: 0 });
        }
        await this.saveGameState();
        this.broadcastRoomUpdate();
        break;

      case 'start_game':
        // Start game logic
        state.status = 'playing';
        state.timeRemaining = 60; // example 60s
        await this.saveGameState();
        
        // Setup timer alarm
        const alarmTime = Date.now() + 60 * 1000;
        await this.state.storage.setAlarm(alarmTime);

        this.broadcastRoomUpdate();
        break;

      // Add other game events...
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  async alarm() {
    // Timer expired
    const state = await this.getGameState();
    if (state.status === 'playing') {
      state.status = 'time_up';
      await this.saveGameState();
      this.broadcast(JSON.stringify({ type: 'time_expired' }));
      this.broadcastRoomUpdate();
    }
  }

  broadcast(messageStr) {
    for (const [ws] of this.sessions) {
      try {
        ws.send(messageStr);
      } catch (err) {
        console.error('Broadcast failed for a socket:', err);
      }
    }
  }

  broadcastRoomUpdate() {
    this.broadcast(JSON.stringify({
      type: 'room_update',
      payload: this.gameState
    }));
  }
}
