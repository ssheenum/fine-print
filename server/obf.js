// Open Beauty Facts on the server: shared shaping (public/shared/obf.js), plus a small cache and a photo proxy.
const shared = require('../public/shared/obf.js');
const UA = `FinePrint/1.0 (${process.env.CONTACT_EMAIL || 'contact@example.com'})`;
const cache = new Map(); // small in-memory cache, 1 hour

async function get(url) {
  const hit = cache.get(url); if (hit && Date.now() - hit.t < 3600000) return hit.v;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (r.status === 404) return {}; // unknown barcode
  if (!r.ok) throw new Error('Open Beauty Facts ' + r.status);
  const v = await r.json(); cache.set(url, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
const { search, byCode } = shared.client(get);

async function image(url) {
  if (!shared.isOBFImage(url)) return null;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const type = r.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) return null;
  return { type, buf: Buffer.from(await r.arrayBuffer()) };
}
module.exports = { search, byCode, bestMatch: shared.bestMatch, image };
