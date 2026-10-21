// Open Beauty Facts: free, open product database (data ODbL, photos CC BY-SA).
// Shared by the server (require) and the browser (window.FP_OBF). Each side passes its own getJSON(url).
(function (root, make) { if (typeof module === 'object' && module.exports) module.exports = make(); else root.FP_OBF = make(); })(typeof self !== 'undefined' ? self : this, function () {

const BASE = 'https://world.openbeautyfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,quantity,image_front_url,image_front_small_url,image_url,ingredients_text,ingredients_text_en,categories_tags';

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
function groupResults(data) {
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
const isOBFImage = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)openbeautyfacts\.org$/.test(x.hostname); } catch { return false; } };

function client(getJSON) {
  return {
    search: async (q) => groupResults(await getJSON(`${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`)),
    byCode: async (code) => { const d = await getJSON(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`); return d.product ? { ...shape(d.product), alts: [] } : null; },
  };
}

return { client, bestMatch, isOBFImage };
});
