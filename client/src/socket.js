// Switch from Socket.io to native WebSockets for Cloudflare Workers compatibility
let ws = null;
const listeners = new Set();

export const socket = {
  connect: (roomId, playerId) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const wsUrl = baseUrl.replace(/^http/, 'ws') + `/ws/${roomId}?playerId=${playerId}`;
    
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      listeners.forEach(l => l(data.type, data.payload));
    };

    ws.onclose = () => {
      console.log('WebSocket closed. Reconnecting...');
      // Reconnection logic could go here
    };

    ws.onerror = (err) => console.error('WebSocket error:', err);
  },
  
  emit: (type, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  },

  on: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  disconnect: () => {
    if (ws) ws.close();
  }
};
