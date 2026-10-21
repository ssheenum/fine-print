// Open Beauty Facts: free, open product database (data ODbL, photos CC BY-SA).
const UA = `FinePrint/1.0 (${process.env.CONTACT_EMAIL || 'contact@example.com'})`;
const FIELDS = 'code,product_name,product_name_en,brands,quantity,image_front_url,image_front_small_url,image_url,ingredients_text,ingredients_text_en,categories_tags';
const cache = new Map(); // small in-memory cache, 1 hour

const fullSize = (u) => u ? u.replace(/\.(\d+)\.jpg$/, '.full.jpg') : '';
function category(tags = [], name = '') {
  const t = tags.join(' ') + ' ' + String(name).toLowerCase();
  if (/hair|shampoo|conditioner|scalp/.test(t)) return 'hair';
  if (/body|shower|bath|deodorant|hand|foot|soap|lotion(?!.*face)/.test(t) && !/face|facial|visage/.test(t)) return 'body';
  return 'face';
}
function tidyName(name, brand) {
  let n = String(name || '').trim();
  if (brand && n.toLowerCase().startsWith(brand.toLowerCase())) n = n.slice(brand.length).replace(/^[\s\-–:,]+/, '');
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(name || '').trim();
}
function shape(p) {
  const brand = String(p.brands || '').split(',')[0].trim();
  const image = p.image_front_url || p.image_url || '';
  return {
    code: p.code || '', name: tidyName(p.product_name_en || p.product_name, brand), brand, size: /[a-z]/i.test(p.quantity || '') ? p.quantity : '',
    image, full: fullSize(image), thumb: p.image_front_small_url || image,
    ingredients: (p.ingredients_text_en || p.ingredients_text || '').trim(), category: category(p.categories_tags, p.product_name_en || p.product_name),
  };
}
async function get(url) {
  const hit = cache.get(url); if (hit && Date.now() - hit.t < 3600000) return hit.v;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('Open Beauty Facts ' + r.status);
  const v = await r.json(); cache.set(url, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
async function search(q) {
  const data = await get(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`);
  const list = (data.products || []).map(shape).filter(p => p.name)
    .map((p, i) => ({ p, i, s: (p.image ? 3 : 0) + (p.ingredients ? 3 : 0) + (p.size ? 1 : 0) }))
    .sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.p);
  const key = (p) => (p.brand + ' ' + p.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const groups = new Map();
  for (const p of list) {
    const k = key(p);
    if (!groups.has(k)) groups.set(k, { ...p, alts: [] });
    else { const g = groups.get(k); if (p.full) g.alts.push(p.full); if (!g.ingredients && p.ingredients) g.ingredients = p.ingredients; }
  }
  return [...groups.values()].map(g => ({ ...g, alts: g.alts.filter(u => u !== g.full).slice(0, 3) })).slice(0, 8);
}
async function byCode(code) {
  const data = await get(`https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  return data.product ? { ...shape(data.product), alts: [] } : null;
}
function bestMatch(hits, brand, name) {
  const words = String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const b = String(brand || '').toLowerCase().split(' ')[0];
  let best = null, top = 0;
  for (const h of hits) {
    const n = (h.name + ' ' + h.brand).toLowerCase();
    let s = words.filter(w => n.includes(w)).length / Math.max(1, words.length);
    if (b && h.brand.toLowerCase().includes(b)) s += 0.5;
    if (s > top) { top = s; best = h; }
  }
  return top >= 0.8 ? best : null;
}
async function image(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || !/(^|\.)openbeautyfacts\.org$/.test(u.hostname)) return null;
  const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const type = r.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) return null;
  return { type, buf: Buffer.from(await r.arrayBuffer()) };
}
module.exports = { search, byCode, bestMatch, image };
