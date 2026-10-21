// Storage: one SQLite file (built into Node, no installs). Path set by DB_PATH, default ./data/fineprint.db
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'fineprint.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    google_sub TEXT UNIQUE,
    pass_hash TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS products_user ON products(user_id);
`);

const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);

module.exports = {
  users: {
    byId: (id) => one('SELECT * FROM users WHERE id = ?', id),
    byEmail: (e) => one('SELECT * FROM users WHERE email = ?', e),
    byPhone: (p) => one('SELECT * FROM users WHERE phone = ?', p),
    byGoogle: (s) => one('SELECT * FROM users WHERE google_sub = ?', s),
    create: (u) => run('INSERT INTO users (id, name, email, phone, google_sub, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      u.id, u.name || '', u.email || null, u.phone || null, u.google_sub || null, u.pass_hash || null, Date.now()),
    setName: (id, name) => run('UPDATE users SET name = ? WHERE id = ?', name, id),
    linkGoogle: (id, sub) => run('UPDATE users SET google_sub = ? WHERE id = ?', sub, id),
    remove: (id) => run('DELETE FROM users WHERE id = ?', id),
  },
  sessions: {
    create: (token, userId, ttlMs) => run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, Date.now() + ttlMs),
    get: (token) => one('SELECT * FROM sessions WHERE token = ? AND expires_at > ?', token, Date.now()),
    remove: (token) => run('DELETE FROM sessions WHERE token = ?', token),
    sweep: () => run('DELETE FROM sessions WHERE expires_at <= ?', Date.now()),
  },
  profiles: {
    get: (userId) => { const r = one('SELECT data FROM profiles WHERE user_id = ?', userId); return r ? JSON.parse(r.data) : null; },
    set: (userId, data) => run('INSERT INTO profiles (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', userId, JSON.stringify(data)),
  },
  products: {
    list: (userId) => all('SELECT * FROM products WHERE user_id = ? ORDER BY added_at DESC', userId).map(r => ({ ...JSON.parse(r.data), id: r.id, addedAt: r.added_at })),
    get: (userId, id) => { const r = one('SELECT * FROM products WHERE user_id = ? AND id = ?', userId, id); return r ? { ...JSON.parse(r.data), id: r.id, addedAt: r.added_at } : null; },
    add: (userId, id, data, addedAt) => run('INSERT INTO products (id, user_id, data, added_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, userId, JSON.stringify(data), addedAt || Date.now(), Date.now()),
    update: (userId, id, data) => run('UPDATE products SET data = ?, updated_at = ? WHERE user_id = ? AND id = ?', JSON.stringify(data), Date.now(), userId, id),
    remove: (userId, id) => run('DELETE FROM products WHERE user_id = ? AND id = ?', userId, id),
  },
};
