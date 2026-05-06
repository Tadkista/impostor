import { Hono } from 'hono';
import { cors } from 'hono/cors';

export { Room } from './Room';

const app = new Hono();

app.use('*', cors());

app.get('/', (c) => c.text('Impostor Cloudflare Workers Backend is running!'));

// Handle WebSockets explicitly through the Room Durable Object
app.get('/ws/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  
  // Create or get the Room Durable Object
  const id = c.env.ROOM_DO.idFromName(roomId);
  const roomObject = c.env.ROOM_DO.get(id);
  
  // Forward the request to the Durable Object
  return roomObject.fetch(c.req.raw);
});

// REST endpoints mapped to Hono
app.post('/api/rooms/create', async (c) => {
  try {
    const body = await c.req.json();
    // Use D1 or KV to register room metadata if needed
    // const db = c.env.DB;
    
    // For now, generate a random 6-char code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // In a real scenario, you might initialize the DO state here, 
    // but the DO is initialized on the first fetch.
    return c.json({ message: 'Room created', roomCode });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Mock Auth endpoints for structure
app.post('/api/auth/register', async (c) => {
  return c.json({ message: 'Register endpoint not fully migrated yet' });
});

app.post('/api/auth/login', async (c) => {
  return c.json({ message: 'Login endpoint not fully migrated yet' });
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};
