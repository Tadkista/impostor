-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  nick TEXT NOT NULL,
  password TEXT NOT NULL,
  friendCode TEXT UNIQUE NOT NULL,
  globalPoints INTEGER DEFAULT 0,
  totalGamePoints INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  isBanned INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Words table
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  categoryId TEXT NOT NULL,
  word TEXT NOT NULL,
  hint TEXT,
  FOREIGN KEY(categoryId) REFERENCES categories(id)
);

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  adminId TEXT NOT NULL,
  action TEXT NOT NULL,
  targetUserId TEXT,
  details TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(adminId) REFERENCES users(id),
  FOREIGN KEY(targetUserId) REFERENCES users(id)
);
