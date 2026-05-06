import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
import { generateCode } from '../utils/generateCode';

export { Room } from './Room';

const app = new Hono();

app.use('*', cors());

// Basic SHA-256 hashing for passwords since bcrypt doesn't work on edge natively
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

app.get('/', (c) => c.text('Impostor Cloudflare Workers Backend is running!'));

app.get('/ws/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const id = c.env.ROOM_DO.idFromName(roomId);
  const roomObject = c.env.ROOM_DO.get(id);
  return roomObject.fetch(c.req.raw);
});

app.post('/api/rooms/create', async (c) => {
  try {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    return c.json({ message: 'Room created', room: { code: roomCode } });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Endpoint required by JoinRoom.jsx to fetch active rooms.
// Full implementation requires KV or D1 to track active DOs.
app.get('/api/rooms/available', async (c) => {
  return c.json([]);
});

// Endpoint required by JoinRoom.jsx to validate before joining.
// The actual joining logic is handled entirely by WebSockets in the Game component.
app.post('/api/rooms/join', async (c) => {
  try {
    const { code, nick } = await c.req.json();
    if (!code) return c.json({ message: 'Room code is required' }, 400);
    return c.json({ message: 'Ready to join', room: { code } });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// --- MISSING ENDPOINTS FIX ---
app.get('/api/leaderboard', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, nick, globalPoints, totalGamePoints FROM users ORDER BY globalPoints DESC LIMIT 50').all();
    return c.json(results || []);
  } catch (error) {
    return c.json([], 200); // return empty on error to prevent crash
  }
});

app.get('/api/friends', async (c) => {
  // Friends functionality requires a new D1 table. Returning empty array for now.
  return c.json([]);
});

app.post('/api/friends/add', async (c) => {
  return c.json({ message: 'Funkcja znajomych nie została jeszcze zmigrowana do D1' }, 400);
});

app.get('/api/admin/users', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, name, nick, role, isBanned, globalPoints, createdAt FROM users').all();
    return c.json(results || []);
  } catch (error) {
    return c.json([], 200);
  }
});

app.post('/api/admin/users/:id/reset-password', async (c) => {
  return c.json({ message: 'Zresetowano hasło (mock)' });
});

app.post('/api/admin/users/:id/ban', async (c) => {
  return c.json({ message: 'Zmieniono status bana (mock)' });
});

app.patch('/api/admin/users/:id', async (c) => {
  return c.json({ message: 'Zaktualizowano użytkownika (mock)' });
});
// -----------------------------

app.post('/api/auth/register', async (c) => {
  try {
    const { name, nick, password } = await c.req.json();
    
    if (!name || !nick || !password) {
      return c.json({ message: 'All fields are required' }, 400);
    }

    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE name = ?').bind(name).first();
    if (existingUser) {
      return c.json({ message: 'User with this name already exists' }, 400);
    }

    const hashedPassword = await hashPassword(password);
    
    let friendCode;
    let isUnique = false;
    while (!isUnique) {
      friendCode = generateCode(6);
      const existingCode = await c.env.DB.prepare('SELECT id FROM users WHERE friendCode = ?').bind(friendCode).first();
      if (!existingCode) isUnique = true;
    }

    const userId = crypto.randomUUID();

    await c.env.DB.prepare(
      'INSERT INTO users (id, name, nick, password, friendCode) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, name, nick, hashedPassword, friendCode).run();

    return c.json({ message: 'User registered successfully', friendCode }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const { name, password } = await c.req.json();
    
    if (!name || !password) {
      return c.json({ message: 'Name and password are required' }, 400);
    }

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE name = ?').bind(name).first();
    if (!user) {
      return c.json({ message: 'Invalid credentials' }, 400);
    }

    const hashedPassword = await hashPassword(password);
    if (hashedPassword !== user.password) {
      return c.json({ message: 'Invalid credentials' }, 400);
    }

    if (user.isBanned) {
      return c.json({ message: 'This account has been banned.' }, 403);
    }

    const secret = c.env.JWT_SECRET || 'fallback_secret';
    const token = await sign({ userId: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, secret);

    return c.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        nick: user.nick,
        friendCode: user.friendCode,
        globalPoints: user.globalPoints,
        totalGamePoints: user.totalGamePoints || 0,
        role: user.role,
        isBanned: user.isBanned
      }
    }, 200);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};

