/* Fine Print: the back end, running inside the browser. Used when there is no server, e.g. on GitHub Pages.
   It answers the same /api routes as server/index.js, keeps everything in this browser's IndexedDB,
   talks to Open Beauty Facts directly, and calls the AI with a key the person saved on this device. */

const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
await loadScript('shared/ingredients.js'); await loadScript('shared/engine.js'); await loadScript('shared/brain.js'); await loadScript('shared/obf.js');
const engine = window.FP_ENGINE, brain = window.FP_BRAIN, OBF = window.FP_OBF;

/* ---------- storage: IndexedDB ---------- */
const DB_NAME = 'fineprint', SESSION_KEY = 'fp_local_session', AI_KEY = 'fp_ai';
const dbp = new Promise((ok, no) => {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    d.createObjectStore('users', { keyPath: 'id' }).createIndex('login', 'login', { unique: true });
    d.createObjectStore('products', { keyPath: 'id' }).createIndex('user', 'userId');
  };
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
async function tx(store, mode, fn) {
  const t = (await dbp).transaction(store, mode), out = await fn(t.objectStore(store));
  await new Promise((ok, no) => { t.oncomplete = ok; t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
  return out;
}
const users = {
  get: (id) => tx('users', 'readonly', (s) => req(s.get(id))),
  byLogin: (login) => tx('users', 'readonly', (s) => req(s.index('login').get(login))),
  put: (u) => tx('users', 'readwrite', (s) => req(s.put(u))),
  remove: (id) => tx('users', 'readwrite', (s) => req(s.delete(id))),
};
const products = {
  list: async (userId) => (await tx('products', 'readonly', (s) => req(s.index('user').getAll(userId)))).sort((a, b) => b.addedAt - a.addedAt),
  get: async (userId, id) => { const p = await tx('products', 'readonly', (s) => req(s.get(id))); return p && p.userId === userId ? p : null; },
  put: (p) => tx('products', 'readwrite', (s) => req(s.put(p))),
  remove: (id) => tx('products', 'readwrite', (s) => req(s.delete(id))),
};
const strip = (p) => { if (!p) return p; const { userId, ...rest } = p; return rest; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

/* ---------- accounts (on this device) ---------- */
const enc = new TextEncoder(), hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 }, key, 256));
}
async function hashPassword(pw) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); return salt + ':' + await pbkdf2(pw, salt); }
async function checkPassword(pw, stored) { if (!stored) return false; const [s, h] = stored.split(':'); return (await pbkdf2(pw, s)) === h; }
const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function normPhone(p) {
  const raw = String(p || '').trim(), digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (raw.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email || null, phone: u.phone || null, google: false });
async function currentUser() { const id = store.get(SESSION_KEY); return id ? (await users.get(id)) || null : null; }

/* ---------- AI with the person's own key ---------- */
function aiSettings() { try { const a = JSON.parse(store.get(AI_KEY) || 'null'); return a && a.provider && a.key ? { ...a, browser: true } : null; } catch { return null; } }
export function setAI(a) { store.set(AI_KEY, a && a.key ? JSON.stringify({ provider: a.provider === 'gemini' ? 'gemini' : 'claude', key: String(a.key).trim() }) : null); }
export function aiProvider() { return aiSettings()?.provider || null; }

/* ---------- Open Beauty Facts, straight from the browser ---------- */
const cache = new Map();
const obf = OBF.client(async (url) => {
  const hit = cache.get(url); if (hit && Date.now() - hit.t < 3600000) return hit.v;
  const r = await fetch(url);
  if (r.status === 404) return {};
  if (!r.ok) throw new Error('Open Beauty Facts ' + r.status);
  const v = await r.json(); cache.set(url, { t: Date.now(), v }); return v;
});

/* ---------- analysis ---------- */
const historyFor = async (userId, exceptId) => brain.historyFrom(await products.list(userId), exceptId);
async function scoreIngredients(user, product, text, source) {
  const profile = user.profile || {}, history = await historyFor(user.id, product.id), ai = aiSettings();
  if (ai) {
    try {
      const what = `The product is "${[product.brand, product.name].filter(Boolean).join(' ')}". Its ingredient list (${source}) is: ${text}`;
      const a = await brain.askJSON(ai, brain.analyzePrompt({ what, profileText: brain.profileText(profile), historyText: brain.historyText(history) }));
      if (a) { const c = brain.cleanAI(a); if (!c.ingredients.length) c.ingredients = engine.parseIngredients(text); c.ingredientsSource = source; if (c.score !== null) return c; }
    } catch (e) { console.warn('AI failed, using engine:', e.message); }
  }
  const r = engine.analyze({ ingredients: text, profile: brain.engineProfile(profile), history, category: product.category });
  return { ...r, ingredientsSource: r.score === null ? 'unknown' : source, claim: null, by: 'engine' };
}
async function rescoreAll(user) {
  const profile = brain.engineProfile(user.profile || {}), all = await products.list(user.id);
  for (const p of all) {
    const a = brain.rescored(engine, p, profile, brain.historyFrom(all, p.id)); if (!a) continue;
    p.analysis = a; p.updatedAt = Date.now(); await products.put(p);
  }
}

/* ---------- routes ---------- */
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };
const routes = [];
const route = (method, pattern, fn, auth) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, auth });

route('GET', 'api/config', async () => ({ ai: aiProvider(), google: false, apple: false, local: true }));
route('GET', 'api/health', async () => ({ ok: true }));
route('POST', 'api/auth/signup', async ({ b }) => {
  const name = String(b.name || '').trim().slice(0, 60);
  if (!b.password || String(b.password).length < 8) fail('Use a password with at least 8 characters.');
  const u = { id: crypto.randomUUID(), name, profile: null, createdAt: Date.now() };
  if (b.method === 'phone') {
    const p = normPhone(b.phone); if (!p) fail('That phone number doesn’t look right.');
    if (await users.byLogin('phone:' + p)) fail('There’s already an account with that phone number on this device. Try logging in.');
    Object.assign(u, { phone: p, login: 'phone:' + p });
  } else {
    const e = normEmail(b.email); if (!validEmail(e)) fail('That email doesn’t look right.');
    if (await users.byLogin('email:' + e)) fail('There’s already an account with that email on this device. Try logging in.');
    Object.assign(u, { email: e, login: 'email:' + e });
  }
  u.passHash = await hashPassword(String(b.password));
  await users.put(u); store.set(SESSION_KEY, u.id);
  return { user: publicUser(u), profile: null };
});
route('POST', 'api/auth/login', async ({ b }) => {
  const login = b.method === 'phone' ? 'phone:' + (normPhone(b.phone) || '') : 'email:' + normEmail(b.email);
  const u = await users.byLogin(login);
  if (!u || !(await checkPassword(String(b.password || ''), u.passHash))) fail('That combination didn’t match. Check it and try again. Accounts on this version are saved on the device you signed up on.', 401);
  store.set(SESSION_KEY, u.id);
  return { user: publicUser(u), profile: u.profile };
});
route('POST', 'api/auth/logout', async () => { store.set(SESSION_KEY, null); return { ok: true }; });
route('GET', 'api/me', async ({ user }) => ({ user: publicUser(user), profile: user ? user.profile : null }));
route('PUT', 'api/profile', async ({ user, b }) => {
  user.profile = brain.cleanProfile(b.profile);
  if (typeof b.name === 'string') user.name = b.name.trim().slice(0, 60);
  await users.put(user); rescoreAll(user).catch(() => {});
  return { profile: user.profile };
}, true);
route('DELETE', 'api/account', async ({ user }) => {
  for (const p of await products.list(user.id)) await products.remove(p.id);
  await users.remove(user.id); store.set(SESSION_KEY, null);
  return { ok: true };
}, true);

route('GET', 'api/search', async ({ url }) => {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 80); if (q.length < 2) return { results: [] };
  try { return { results: await obf.search(q) }; } catch { fail('Product search is unavailable right now.', 502); }
}, true);
route('GET', 'api/product', async ({ url }) => {
  const code = String(url.searchParams.get('code') || '').replace(/\D/g, '').slice(0, 20);
  try { return { product: code ? await obf.byCode(code) : null }; } catch { fail('Lookup failed.', 502); }
}, true);

route('POST', 'api/analyze', async ({ user, b }) => {
  const product = { name: '', brand: '', size: '', category: 'face', form: 'bottle', code: '', images: [], ...(b.product || {}) };
  if (b.source === 'database' || (b.source === 'label' && b.ocrText)) {
    const text = b.source === 'database' ? product.ingredients : b.ocrText;
    return { product, analysis: await scoreIngredients(user, product, text, b.source === 'database' ? 'database' : 'label') };
  }
  const ai = aiSettings();
  if (!ai) return { needs: b.source === 'photo' ? 'barcode-or-name' : 'ingredients' };
  try {
    const history = await historyFor(user.id, product.id);
    const raw = await brain.askJSON(ai, brain.analyzePrompt({ what: brain.whatFor(b.source, product, b.query), profileText: brain.profileText(user.profile || {}), historyText: brain.historyText(history) }), b.image);
    if (!raw || raw.found === false) return { needs: 'not-found' };
    const analysis = brain.cleanAI(raw);
    Object.assign(product, { name: product.name || raw.name || 'Unknown product', brand: product.brand || raw.brand || '', size: product.size || raw.size || '',
      category: ['face', 'hair', 'body'].includes(raw.category) ? raw.category : product.category, form: raw.form || product.form });
    if (b.source !== 'label') {
      const hit = OBF.bestMatch(await obf.search([product.brand, product.name].filter(Boolean).join(' ')).catch(() => []), product.brand, product.name);
      if (hit) {
        product.code = hit.code; product.images = [hit.full || hit.image, ...hit.alts].filter(Boolean);
        if (!analysis.ingredients.length && hit.ingredients) return { product, analysis: await scoreIngredients(user, product, hit.ingredients, 'database') };
      }
    }
    return { product, analysis };
  } catch (e) {
    console.warn('analyze failed:', e.message);
    fail(e.status === 429 ? 'The AI’s free limit is used up. Try again later.' : e.status === 401 || e.status === 403 ? 'The AI key was refused. Check it on your Profile page.' : 'Something went wrong reading that. Try again.', 502);
  }
}, true);

route('GET', 'api/shelf', async ({ user }) => ({ products: (await products.list(user.id)).map(strip) }), true);
route('POST', 'api/shelf', async ({ user, b }) => {
  const now = Date.now(), p = { ...brain.pickProduct(b.product || {}), id: crypto.randomUUID(), userId: user.id, addedAt: now, updatedAt: now };
  await products.put(p);
  return { product: strip(p) };
}, true);
route('PATCH', 'api/shelf/:id', async ({ user, b, params }) => {
  const cur = await products.get(user.id, params.id); if (!cur) fail('Not found', 404);
  if (b.rating) cur.rating = brain.cleanRating(b.rating);
  if (b.image && brain.okImage(b.image)) Object.assign(cur, { image: brain.okImage(b.image), imageMode: b.imageMode || 'cut', imageCredit: b.imageCredit || '' });
  if (b.analysis) cur.analysis = b.analysis;
  if (typeof b.name === 'string' && b.name.trim()) cur.name = b.name.trim().slice(0, 120);
  cur.updatedAt = Date.now(); await products.put(cur);
  if (b.rating) await rescoreAll(user);
  return { product: strip(await products.get(user.id, params.id)) };
}, true);
route('DELETE', 'api/shelf/:id', async ({ user, params }) => { if (await products.get(user.id, params.id)) await products.remove(params.id); return { ok: true }; }, true);
route('GET', 'api/learned', async ({ user }) => engine.learn(await historyFor(user.id)), true);

// Backup: everything this account has on this device, as one JSON file, and back again.
route('GET', 'api/export', async ({ user }) => ({ app: 'fine-print', version: 1, exportedAt: new Date().toISOString(), profile: user.profile, name: user.name, products: (await products.list(user.id)).map(strip) }), true);
route('POST', 'api/import', async ({ user, b }) => {
  if (b.app !== 'fine-print' || !Array.isArray(b.products)) fail('That file isn’t a Fine Print backup.');
  const have = new Set((await products.list(user.id)).map((p) => p.id));
  let added = 0;
  for (const x of b.products.slice(0, 500)) {
    const id = typeof x.id === 'string' && x.id.length <= 64 ? x.id : crypto.randomUUID();
    if (have.has(id)) continue;
    const p = { ...brain.pickProduct(x), id, userId: user.id, addedAt: Number(x.addedAt) || Date.now(), updatedAt: Date.now() };
    if (x.rating) p.rating = { ...brain.cleanRating(x.rating), at: Number(x.rating.at) || Date.now() };
    await products.put(p); added++;
  }
  if (b.profile && !user.profile) { user.profile = brain.cleanProfile(b.profile); await users.put(user); }
  await rescoreAll(user);
  return { added };
}, true);

/* ---------- the fetch-like entry point app.js calls ---------- */
export async function localApi(path, { method = 'GET', body } = {}) {
  const url = new URL(path.replace(/^\//, ''), 'https://local.invalid/');
  const p = url.pathname.slice(1);
  const r = routes.find((x) => x.method === method && x.re.test(p));
  if (!r) fail('Not found', 404);
  const user = await currentUser();
  if (r.auth && !user) fail('Please log in.', 401);
  return r.fn({ url, user, b: body ? JSON.parse(JSON.stringify(body)) : {}, params: p.match(r.re).groups || {} });
}
