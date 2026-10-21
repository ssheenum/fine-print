// Accounts: email or phone + password (scrypt-hashed), Google sign-in when keys are configured.
const crypto = require('node:crypto');
const db = require('./db');

const SESSION_DAYS = 60;
const COOKIE = 'fp_session';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [s, h] = stored.split(':');
  const hash = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(hash, Buffer.from(h, 'hex'));
}
const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function normPhone(p) {
  const raw = String(p || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (raw.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;            // assume US numbers without a country code
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

function newSession(res, userId, secure) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions.create(token, userId, SESSION_DAYS * 86400000);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
function clearSession(req, res) {
  const t = readCookie(req, COOKIE); if (t) db.sessions.remove(t);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
function readCookie(req, name) {
  const m = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function currentUser(req) {
  const t = readCookie(req, COOKIE); if (!t) return null;
  const s = db.sessions.get(t); if (!s) return null;
  return db.users.byId(s.user_id) || null;
}

// very small brute-force guard: 10 attempts per 10 minutes per IP + identifier
const attempts = new Map();
function tooMany(key) {
  const now = Date.now(), list = (attempts.get(key) || []).filter(t => now - t < 600000);
  list.push(now); attempts.set(key, list);
  return list.length > 10;
}

function signup({ method, name, email, phone, password }) {
  name = String(name || '').trim().slice(0, 60);
  if (!password || String(password).length < 8) return { error: 'Use a password with at least 8 characters.' };
  const u = { id: crypto.randomUUID(), name, pass_hash: hashPassword(String(password)) };
  if (method === 'phone') {
    const p = normPhone(phone); if (!p) return { error: 'That phone number doesn’t look right.' };
    if (db.users.byPhone(p)) return { error: 'There’s already an account with that phone number. Try logging in.' };
    u.phone = p;
  } else {
    const e = normEmail(email); if (!validEmail(e)) return { error: 'That email doesn’t look right.' };
    if (db.users.byEmail(e)) return { error: 'There’s already an account with that email. Try logging in.' };
    u.email = e;
  }
  db.users.create(u);
  return { user: db.users.byId(u.id) };
}
function login({ method, email, phone, password }) {
  const user = method === 'phone' ? db.users.byPhone(normPhone(phone) || '') : db.users.byEmail(normEmail(email));
  if (!user || !checkPassword(String(password || ''), user.pass_hash)) return { error: 'That combination didn’t match. Check it and try again.' };
  return { user };
}

/* ---- Google sign-in (OAuth 2.0). Turned on by GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + PUBLIC_URL ---- */
const googleOn = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PUBLIC_URL);
function googleStart(res, mode) {
  const state = crypto.randomBytes(16).toString('hex') + '.' + (mode === 'signup' ? 'signup' : 'login');
  res.setHeader('Set-Cookie', `fp_oauth=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.PUBLIC_URL.replace(/\/$/, '') + '/api/auth/google/callback',
    response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
  });
  res.writeHead(302, { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + q }); res.end();
}
async function googleCallback(req, url) {
  const state = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!state || state !== readCookie(req, 'fp_oauth') || !code) return { error: 'Google sign-in was cancelled or expired.' };
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.PUBLIC_URL.replace(/\/$/, '') + '/api/auth/google/callback', grant_type: 'authorization_code' }),
  });
  const tok = await r.json().catch(() => ({}));
  if (!tok.id_token) return { error: 'Google sign-in failed.' };
  const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok.id_token))).json().catch(() => ({}));
  if (info.aud !== process.env.GOOGLE_CLIENT_ID || !info.sub) return { error: 'Google sign-in failed.' };
  let user = db.users.byGoogle(info.sub), isNew = false;
  if (!user && info.email && info.email_verified === 'true') {
    user = db.users.byEmail(normEmail(info.email));
    if (user) { db.users.linkGoogle(user.id, info.sub); user = db.users.byId(user.id); }
  }
  if (!user) {
    const id = crypto.randomUUID();
    db.users.create({ id, name: info.given_name || info.name || '', email: info.email ? normEmail(info.email) : null, google_sub: info.sub });
    user = db.users.byId(id); isNew = true;
  }
  return { user, isNew };
}

module.exports = { signup, login, newSession, clearSession, currentUser, tooMany, googleOn, googleStart, googleCallback };
