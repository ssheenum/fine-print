// End-to-end API tests against a real server on a random port with a throwaway database. No network needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fineprint-test-'));
process.env.DB_PATH = path.join(dir, 'test.db');
delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY;
const server = require('../server/index.js');

let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; ok(); })));
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

// A tiny client that keeps the session cookie, like a browser.
function client() {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return { status: r.status, body: await r.json().catch(() => null) };
  };
}

test('serves the app and blocks path tricks', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<title>Fine Print<\/title>/);
  assert.equal((await fetch(base + '/shared/engine.js')).status, 200);
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(base + '/api/health')).status, 200);
});

test('API needs a login', async () => {
  const api = client();
  assert.equal((await api('GET', '/api/shelf')).status, 401);
  assert.equal((await api('GET', '/api/me')).body.user, null);
});

test('sign up, log out, log back in', async () => {
  const api = client();
  assert.equal((await api('POST', '/api/auth/signup', { method: 'email', name: 'A', email: 'a@example.test', password: 'short' })).status, 400);
  const s = await api('POST', '/api/auth/signup', { method: 'email', name: 'A', email: 'A@Example.test', password: 'password-123' });
  assert.equal(s.status, 200);
  assert.equal(s.body.user.email, 'a@example.test');
  assert.equal((await api('POST', '/api/auth/signup', { method: 'email', email: 'a@example.test', password: 'password-123' })).status, 400);
  await api('POST', '/api/auth/logout');
  assert.equal((await api('GET', '/api/me')).body.user, null);
  assert.equal((await api('POST', '/api/auth/login', { method: 'email', email: 'a@example.test', password: 'wrong-pass' })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { method: 'email', email: 'a@example.test', password: 'password-123' })).status, 200);
  assert.equal((await api('GET', '/api/me')).body.user.name, 'A');
});

test('phone sign-up normalizes US numbers', async () => {
  const api = client();
  const s = await api('POST', '/api/auth/signup', { method: 'phone', name: 'P', phone: '(510) 555-0123', password: 'password-123' });
  assert.equal(s.body.user.phone, '+15105550123');
});

test('profile, scoring, shelf, rating and rescoring', async () => {
  const api = client();
  await api('POST', '/api/auth/signup', { method: 'email', name: 'B', email: 'b@example.test', password: 'password-123' });
  const pr = await api('PUT', '/api/profile', { profile: { skin: ['Dry'], concerns: ['Redness', 'Dryness', 'Acne', 'Extra'], avoid: ['Fragrance'], fragrance: 'avoid' } });
  assert.deepEqual(pr.body.profile.concerns, ['Redness', 'Dryness', 'Acne']);

  const cream = await api('POST', '/api/analyze', { source: 'label', ocrText: 'Aqua, Glycerin, Ceramide NP, Niacinamide, Petrolatum, Phenoxyethanol', product: { name: 'Cream' } });
  assert.equal(cream.status, 200);
  assert.equal(cream.body.analysis.verdict, 'yes');
  const toner = await api('POST', '/api/analyze', { source: 'label', ocrText: 'Aqua, Alcohol Denat., Ceramide NP, Parfum, Linalool', product: { name: 'Toner' } });
  assert.equal(toner.body.analysis.verdict, 'no');

  // Without an AI key, a front-of-pack photo asks for a barcode or name instead.
  assert.equal((await api('POST', '/api/analyze', { source: 'photo', image: { data: 'x' } })).body.needs, 'barcode-or-name');

  const c = (await api('POST', '/api/shelf', { product: { ...cream.body.product, analysis: cream.body.analysis } })).body.product;
  const t = (await api('POST', '/api/shelf', { product: { ...toner.body.product, analysis: toner.body.analysis } })).body.product;
  assert.equal((await api('GET', '/api/shelf')).body.products.length, 2);

  const r = await api('PATCH', '/api/shelf/' + t.id, { rating: { value: 'no', reactions: ['Red'] } });
  assert.equal(r.body.product.rating.value, 'no');
  const after = (await api('GET', '/api/shelf')).body.products.find(p => p.id === c.id);
  assert.ok(after.analysis.score < c.analysis.score, 'cream shares ceramides with the reacted toner, so it drops');
  assert.ok((await api('GET', '/api/learned')).body.not.length > 0);

  // Another account can't see or touch these products.
  const other = client();
  await other('POST', '/api/auth/signup', { method: 'email', email: 'c@example.test', password: 'password-123' });
  assert.equal((await other('GET', '/api/shelf')).body.products.length, 0);
  assert.equal((await other('PATCH', '/api/shelf/' + c.id, { name: 'Hacked' })).status, 404);

  await api('DELETE', '/api/shelf/' + t.id);
  assert.equal((await api('GET', '/api/shelf')).body.products.length, 1);
  await api('DELETE', '/api/account');
  assert.equal((await api('GET', '/api/me')).body.user, null);
});
