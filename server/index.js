// Fine Print server: API + the website. Run: node server/index.js  (PORT, default 3000)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./db');
const auth = require('./auth');
const obf = require('./obf');
const ai = require('./ai');
const engine = require('./engine');
const brain = require('../public/shared/brain.js');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, '..', 'public');
const SECURE = String(process.env.PUBLIC_URL || '').startsWith('https://');
const MAX_BODY = 12 * 1024 * 1024;
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // behind Render/Railway/Fly: read the visitor's IP from X-Forwarded-For
const TYPES = { '.mjs': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const bad = (res, msg, status = 400) => send(res, status, { error: msg });
function body(req) {
  return new Promise((ok, no) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { no(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { no(Object.assign(new Error('bad json'), { status: 400 })); } });
    req.on('error', no);
  });
}
const ip = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, phone: u.phone, google: !!u.google_sub });

/* ---------- helpers for analysis ---------- */
const historyFor = (userId, exceptId) => brain.historyFrom(db.products.list(userId), exceptId);
const { profileText, historyText, engineProfile, cleanAI } = brain;

async function scoreIngredients(user, product, ingredientsText, source) {
  const profile = db.profiles.get(user.id) || {}, history = historyFor(user.id, product.id);
  if (ai.provider()) {
    try {
      const what = `The product is "${[product.brand, product.name].filter(Boolean).join(' ')}". Its ingredient list (${source}) is: ${ingredientsText}`;
      const a = await ai.askJSON(ai.analyzePrompt({ what, profileText: profileText(profile), historyText: historyText(history) }));
      if (a) { const c = cleanAI(a); if (!c.ingredients.length) c.ingredients = engine.parseIngredients(ingredientsText); c.ingredientsSource = source; if (c.score !== null) return c; }
    } catch (e) { console.warn('AI failed, using engine:', e.message); }
  }
  const r = engine.analyze({ ingredients: ingredientsText, profile: engineProfile(profile), history, category: product.category });
  return { ...r, ingredientsSource: r.score === null ? 'unknown' : source, claim: null, by: 'engine' };
}

/* ---------- routes ---------- */
const routes = [];
const route = (method, pattern, fn, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, ...opts });

route('GET', '/api/health', async (req, res) => send(res, 200, { ok: true }));
route('GET', '/api/config', async (req, res) => send(res, 200, { ai: ai.provider(), google: auth.googleOn(), apple: false }));

route('POST', '/api/auth/signup', async (req, res) => {
  const b = await body(req);
  if (auth.tooMany('su:' + ip(req))) return bad(res, 'Too many tries. Wait a few minutes.', 429);
  const r = auth.signup(b); if (r.error) return bad(res, r.error);
  auth.newSession(res, r.user.id, SECURE); send(res, 200, { user: publicUser(r.user), profile: null });
});
route('POST', '/api/auth/login', async (req, res) => {
  const b = await body(req);
  if (auth.tooMany('li:' + ip(req) + ':' + (b.email || b.phone))) return bad(res, 'Too many tries. Wait a few minutes.', 429);
  const r = auth.login(b); if (r.error) return bad(res, r.error, 401);
  auth.newSession(res, r.user.id, SECURE); send(res, 200, { user: publicUser(r.user), profile: db.profiles.get(r.user.id) });
});
route('POST', '/api/auth/logout', async (req, res) => { auth.clearSession(req, res); send(res, 200, { ok: true }); });
route('GET', '/api/auth/google', async (req, res, { url }) => {
  if (!auth.googleOn()) { res.writeHead(302, { Location: '/#google-off' }); return res.end(); }
  auth.googleStart(res, url.searchParams.get('mode'));
});
route('GET', '/api/auth/google/callback', async (req, res, { url }) => {
  const r = await auth.googleCallback(req, url);
  if (r.error) { res.writeHead(302, { Location: '/#login' }); return res.end(); }
  auth.newSession(res, r.user.id, SECURE);
  res.writeHead(302, { Location: r.isNew || !db.profiles.get(r.user.id) ? '/#setup' : '/#shelf' }); res.end();
});

route('GET', '/api/me', async (req, res, { user }) => send(res, 200, { user: publicUser(user), profile: user ? db.profiles.get(user.id) : null }));
route('PUT', '/api/profile', async (req, res, { user }) => {
  const b = await body(req), clean = brain.cleanProfile(b.profile);
  db.profiles.set(user.id, clean);
  if (typeof b.name === 'string') db.users.setName(user.id, b.name.trim().slice(0, 60));
  rescoreAll(user).catch(() => {});
  send(res, 200, { profile: clean });
}, { auth: true });
route('DELETE', '/api/account', async (req, res, { user }) => { auth.clearSession(req, res); db.users.remove(user.id); send(res, 200, { ok: true }); }, { auth: true });

route('GET', '/api/search', async (req, res, { url }) => {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 80); if (q.length < 2) return send(res, 200, { results: [] });
  try { send(res, 200, { results: await obf.search(q) }); } catch { bad(res, 'Product search is unavailable right now.', 502); }
}, { auth: true });
route('GET', '/api/product', async (req, res, { url }) => {
  const code = String(url.searchParams.get('code') || '').replace(/\D/g, '').slice(0, 20);
  try { send(res, 200, { product: code ? await obf.byCode(code) : null }); } catch { bad(res, 'Lookup failed.', 502); }
}, { auth: true });
route('GET', '/api/img', async (req, res, { url }) => {
  const r = await obf.image(String(url.searchParams.get('url') || '')).catch(() => null);
  if (!r) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': r.type, 'Cache-Control': 'public, max-age=604800' }); res.end(r.buf);
});

// Analyze a product. source: 'database' (picked from search or barcode), 'label' (photo or text of the ingredient list),
// 'photo' (front of pack, needs AI), 'name' (typed name not in the database, needs AI).
route('POST', '/api/analyze', async (req, res, { user }) => {
  const b = await body(req);
  const product = { name: '', brand: '', size: '', category: 'face', form: 'bottle', code: '', images: [], ...(b.product || {}) };
  const profile = db.profiles.get(user.id) || {}, history = historyFor(user.id, product.id);
  try {
    if (b.source === 'database' || (b.source === 'label' && b.ocrText)) {
      const text = b.source === 'database' ? product.ingredients : b.ocrText;
      const analysis = await scoreIngredients(user, product, text, b.source === 'database' ? 'database' : 'label');
      return send(res, 200, { product, analysis });
    }
    if (!ai.provider()) return send(res, 200, { needs: b.source === 'photo' ? 'barcode-or-name' : 'ingredients' });
    const what = brain.whatFor(b.source, product, b.query);
    const raw = await ai.askJSON(ai.analyzePrompt({ what, profileText: profileText(profile), historyText: historyText(history) }), b.image);
    if (!raw || raw.found === false) return send(res, 200, { needs: 'not-found' });
    const analysis = cleanAI(raw);
    Object.assign(product, { name: product.name || raw.name || 'Unknown product', brand: product.brand || raw.brand || '', size: product.size || raw.size || '',
      category: ['face', 'hair', 'body'].includes(raw.category) ? raw.category : product.category, form: raw.form || product.form });
    if (b.source !== 'label') {
      const hit = obf.bestMatch(await obf.search([product.brand, product.name].filter(Boolean).join(' ')).catch(() => []), product.brand, product.name);
      if (hit) {
        product.code = hit.code; product.images = [hit.full || hit.image, ...hit.alts].filter(Boolean);
        if (!analysis.ingredients.length && hit.ingredients) return send(res, 200, { product, analysis: await scoreIngredients(user, product, hit.ingredients, 'database') });
      }
    }
    send(res, 200, { product, analysis });
  } catch (e) {
    console.warn('analyze failed:', e.message);
    bad(res, e.status === 429 ? 'The AI’s daily free limit is used up. Try again tomorrow.' : 'Something went wrong reading that. Try again.', 502);
  }
}, { auth: true });

route('GET', '/api/shelf', async (req, res, { user }) => send(res, 200, { products: db.products.list(user.id) }), { auth: true });
route('POST', '/api/shelf', async (req, res, { user }) => {
  const b = await body(req), p = b.product || {};
  const id = crypto.randomUUID();
  const data = brain.pickProduct(p);
  db.products.add(user.id, id, data, Date.now());
  send(res, 200, { product: db.products.get(user.id, id) });
}, { auth: true });
route('PATCH', '/api/shelf/:id', async (req, res, { user, params }) => {
  const cur = db.products.get(user.id, params.id); if (!cur) return bad(res, 'Not found', 404);
  const b = await body(req);
  const next = { ...cur };
  if (b.rating) next.rating = brain.cleanRating(b.rating);
  if (b.image && brain.okImage(b.image)) Object.assign(next, { image: brain.okImage(b.image), imageMode: b.imageMode || 'cut', imageCredit: b.imageCredit || '' });
  if (b.analysis) next.analysis = b.analysis;
  if (typeof b.name === 'string' && b.name.trim()) next.name = b.name.trim().slice(0, 120);
  delete next.id; delete next.addedAt;
  db.products.update(user.id, params.id, next);
  if (b.rating) await rescoreAll(user);
  send(res, 200, { product: db.products.get(user.id, params.id) });
}, { auth: true });
route('DELETE', '/api/shelf/:id', async (req, res, { user, params }) => { db.products.remove(user.id, params.id); send(res, 200, { ok: true }); }, { auth: true });
route('GET', '/api/learned', async (req, res, { user }) => send(res, 200, engine.learn(historyFor(user.id))), { auth: true });

// After a rating or profile change, rescore everything with the engine (fast, free).
async function rescoreAll(user) {
  const profile = engineProfile(db.profiles.get(user.id) || {});
  for (const p of db.products.list(user.id)) {
    const a = brain.rescored(engine, p, profile, historyFor(user.id, p.id)); if (!a) continue;
    const next = { ...p, analysis: a }; delete next.id; delete next.addedAt;
    db.products.update(user.id, p.id, next);
  }
}

/* ---------- static files ---------- */
function serveStatic(req, res, url) {
  let p; try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { // single-page app: unknown paths get the app
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => { res.writeHead(e2 ? 404 : 200, { 'Content-Type': TYPES['.html'] }); res.end(d2); });
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p === '/index.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  let url; try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  const r = routes.find(x => x.method === req.method && x.re.test(url.pathname));
  if (!r) return bad(res, 'Not found', 404);
  try {
    const user = auth.currentUser(req);
    if (r.auth && !user) return bad(res, 'Please log in.', 401);
    await r.fn(req, res, { url, user, params: url.pathname.match(r.re).groups || {} });
  } catch (e) { console.error(e); if (!res.headersSent) bad(res, e.status === 413 ? 'That photo is too large.' : 'Something went wrong.', e.status || 500); }
});
setInterval(() => db.sessions.sweep(), 3600000).unref();
if (require.main === module) server.listen(PORT, () => console.log(`Fine Print running at http://localhost:${PORT}  (AI: ${ai.provider() || 'off, using built-in scoring'})`));
module.exports = server;
