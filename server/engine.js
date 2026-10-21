// Scoring engine: turns an ingredient list into a personal score using the
// knowledge base, the person's profile and what they thought of past products.
// Deterministic and free; the AI (if a key is set) can replace it per product.
const KB = require('./ingredients');

// Near-universal base ingredients: never used to explain a reaction.
const BASE = new Set(['aqua', 'water', 'eau', 'glycerin', 'glycerine', 'butylene glycol', 'propylene glycol', 'propanediol', 'pentylene glycol', 'cetearyl alcohol', 'cetyl alcohol', 'stearyl alcohol', 'sodium chloride', 'citric acid', 'sodium hydroxide', 'xanthan gum', 'carbomer', 'disodium edta', 'tetrasodium edta', 'tocopherol', 'ethylhexylglycerin', 'caprylyl glycol', 'glyceryl stearate', 'sodium benzoate', 'potassium sorbate', 'sodium citrate', 'triethanolamine', 'caprylic/capric triglyceride']);

const AVOID_TAGS = {
  'Fragrance': ['fragrance'], 'Essential oils': ['essential_oil'], 'Alcohol denat.': ['alcohol'], 'Sulfates': ['sulfate'],
  'Silicones': ['silicone'], 'Parabens': ['paraben'], 'Coconut oil': ['coconut'], 'Retinoids': ['retinoid'],
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/\*|†|°/g, '').replace(/\s+/g, ' ').replace(/^[\s.,;:]+|[\s.,;:]+$/g, '').trim();
}
// Split a label's ingredient text into individual INCI names (handles brackets and slashes like "aqua/water").
function parseIngredients(text) {
  if (Array.isArray(text)) return text.map(norm).filter(Boolean);
  let t = String(text || '').replace(/^(ingredients|ingrédients|inci)\s*[:\-]/i, '').replace(/\[[^\]]*\]/g, '').replace(/\b(may contain|peut contenir)\b.*$/i, '');
  const out = []; let depth = 0, cur = '';
  for (const ch of t) {
    if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '•' || ch === '·') && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => norm(s.replace(/\([^)]*\)/g, ' ').split('/')[0].replace(/\.$/, ''))).filter(s => s && s.length < 80);
}
function lookup(name) {
  for (const e of KB) { if (e.match.test(name) && (!e.test || e.test(name))) return e; }
  return null;
}
const titleCase = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Np|Ap|Eop|Ns|Edta|Peg|Ppg|Ci|Sd)\b/g, (m) => m.toUpperCase());

/**
 * analyze({ ingredients, profile, history, category })
 * history: [{ name, rating: 'love'|'fine'|'no', reactions: [], ingredients: [] }]
 */
function analyze({ ingredients, profile = {}, history = [], category = 'face' }) {
  const list = parseIngredients(ingredients);
  if (list.length < 3) return { score: null, verdict: 'unsure', headline: 'Not sure yet.', reason: "I couldn't find the ingredient list. Snap the back and I'll give you a real answer.", good: [], catch: [], actives: [], fragrance: null, ingredients: list.map(titleCase), ingredientsSource: 'unknown' };

  const concerns = profile.concerns || [], avoid = profile.avoid || [];
  const flagFragrance = profile.fragrance === 'avoid' || avoid.includes('Fragrance');
  const sensitive = concerns.includes('Sensitivity') || concerns.includes('Redness') || ['Dry'].includes(profile.skin);
  const avoidTags = new Set(avoid.flatMap(a => AVOID_TAGS[a] || []));
  const customAvoid = avoid.filter(a => !AVOID_TAGS[a]).map(norm);

  const loved = new Map(), reacted = new Map();   // ingredient -> product name
  for (const h of history) {
    for (const i of parseIngredients(h.ingredients)) {
      if (BASE.has(i)) continue;
      if (h.rating === 'love' && !loved.has(i)) loved.set(i, h.name);
      if (h.rating === 'no' && !reacted.has(i)) reacted.set(i, h.name);
    }
  }

  let score = 68;
  const good = [], cons = [], actives = [], seen = new Set();
  let fragrance = false, helpPts = 0, lovePts = 0, reactPts = 0;
  const add = (arr, item) => { if (!arr.some(x => x.name === item.name)) arr.push(item); };

  list.forEach((ing, pos) => {
    const e = lookup(ing);
    const tags = e?.tags || [];
    if (tags.includes('fragrance')) fragrance = true;
    if (e && !seen.has(e.name)) {
      seen.add(e.name);
      if (e.role === 'active' || e.role === 'filter') actives.push({ name: e.name === 'Ceramides' ? titleCase(ing) : e.name, what: e.what });
      const hits = (e.helps || []).filter(c => concerns.includes(c));
      if (hits.length && e.good) { helpPts += 7; add(good, { name: e.name, text: e.good }); }
      const reg = e.reg || (e.regFn && e.regFn(ing));
      if (reg) add(cons, { name: titleCase(ing), text: (e.what ? e.what.replace(/\.$/, '') + '. ' : '') + reg, personal: false });
      if (tags.includes('allergen') && !tags.includes('fragrance')) add(cons, { name: titleCase(ing), text: e.what, personal: false });
      if (tags.includes('acid') && sensitive) { score -= 3; add(cons, { name: e.name, text: 'is an exfoliating acid. Start slowly, since it can sting sensitive skin.', personal: false, serious: true }); }
      if (tags.includes('drying') && (sensitive || concerns.includes('Dryness')) && pos < 8) { score -= 6; add(cons, { name: e.name, text: e.what, personal: false, serious: true }); }
    }
    for (const t of tags) if (avoidTags.has(t)) {
      reactPts += 14;
      const label = Object.keys(AVOID_TAGS).find(k => AVOID_TAGS[k].includes(t));
      add(cons, { name: t === 'fragrance' ? 'Fragrance' : (e ? e.name : titleCase(ing)), text: `is in here, and ${label === 'Fragrance' ? "it's" : label.toLowerCase() + (label.endsWith('s') ? ' are' : ' is')} on your avoid list.`, personal: true, serious: true });
    }
    if (customAvoid.some(c => c && ing.includes(c))) { reactPts += 14; add(cons, { name: titleCase(ing), text: 'is on your avoid list.', personal: true, serious: true }); }
    const meaningful = !(e && e.role === 'base');
    if (reacted.has(ing) && meaningful && !tags.some(t => avoidTags.has(t))) { reactPts += e ? 9 : 5; add(cons, { name: e && e.role !== 'base' && !e.tags?.length ? e.name : titleCase(ing), text: `is also in ${reacted.get(ing)}, which you said your skin didn't like.`, personal: true, serious: true, from: reacted.get(ing) }); }
    else if (loved.has(ing) && meaningful) { lovePts += 4; if (e && e.role !== 'base') add(good, { name: e.name, text: `is also in ${loved.get(ing)}, which you loved.` }); }
  });

  if (fragrance && flagFragrance && !cons.some(c => c.personal && c.name === 'Fragrance')) { reactPts += 14; cons.unshift({ name: 'Fragrance', text: 'is in here, and you asked me to flag fragranced products.', personal: true, serious: true }); }
  if (fragrance && !flagFragrance && sensitive) { score -= 5; add(cons, { name: 'Fragrance', text: 'is a common cause of irritation for sensitive skin.', personal: false, serious: true }); }
  if (!fragrance && (flagFragrance || sensitive)) { score += 6; add(good, { name: 'Fragrance-free', text: ", so there's nothing in it to irritate sensitive skin." }); }

  score += Math.min(helpPts, 24) + Math.min(lovePts, 12) - Math.min(reactPts, 40);
  if (!good.length) score -= 6;
  score = Math.max(5, Math.min(97, Math.round(score)));
  const verdict = score >= 70 ? 'yes' : score >= 45 ? 'maybe' : 'no';

  // never praise something that is also a personal red flag
  for (const c of cons) if (c.personal) { const k = good.findIndex(g => g.name.toLowerCase() === c.name.toLowerCase()); if (k >= 0) good.splice(k, 1); }
  // personal points first, then real concerns, then plain information
  const rank = (c) => (c.personal ? 2 : 0) + (c.serious ? 1 : 0) + (c.personal && !c.from ? 0.5 : 0);
  cons.sort((a, b) => rank(b) - rank(a));
  const g0 = good[0], c0 = cons.find(c => c.serious);
  const headline = verdict === 'yes' ? "It's a yes." : verdict === 'maybe' ? 'Maybe, with a catch.' : "I'd skip this one.";
  const short = (s) => s.toLowerCase().replace(/ \(.*\)$/, '');
  const why = (c) => !c ? 'a few things to watch' : c.from ? `${short(c.name)}, like ${c.from}, which your skin didn't like` : `${short(c.name)}${c.personal ? ', which you asked me to watch for' : ''}`;
  let reason;
  if (verdict === 'yes') reason = g0 ? `${g0.name}${/^[,.]/.test(g0.text) ? '' : ' '}${firstClause(g0.text)}${c0 ? ', with one thing to keep an eye on.' : ', and nothing you asked to avoid.'}` : 'Nothing in here works against your skin.';
  else if (verdict === 'maybe') reason = `${g0 ? g0.name + ' helps, but ' : ''}it has ${why(c0)}.`;
  else reason = `It has ${c0 ? why(c0) : 'ingredients that work against you'}${good.length ? ', and that outweighs the good stuff.' : '.'}`;
  reason = reason.charAt(0).toUpperCase() + reason.slice(1);

  return { score, verdict, headline, reason, good: good.slice(0, 3), catch: cons.slice(0, 4), actives: actives.slice(0, 6), fragrance, ingredients: list.map(titleCase), ingredientsSource: 'label' };
}
function firstClause(t) { return t.replace(/\.$/, '').split('. ')[0].replace(/^is /, 'is ').trim(); }

// What seems to work / not work, from ratings.
function learn(history) {
  const lovedCount = new Map(), reactedCount = new Map(), where = new Map();
  for (const h of history) for (const i of new Set(parseIngredients(h.ingredients))) {
    if (BASE.has(i)) continue;
    const m = h.rating === 'love' ? lovedCount : h.rating === 'no' ? reactedCount : null; if (!m) continue;
    m.set(i, (m.get(i) || 0) + 1);
    const w = where.get(i) || new Set(); w.add(h.category || 'face'); where.set(i, w);
  }
  const conf = (n) => n >= 3 ? 'high' : n === 2 ? 'medium' : 'low';
  const GENERIC = new Set(['Fragrance allergen', 'Paraben', 'Restricted paraben', 'Silicone', 'Cyclic silicone', 'Sulfate cleanser', 'Essential oil', 'Conditioning agent', 'Isothiazolinone preservative', 'Formaldehyde releaser']);
  const label = (i) => { const e = lookup(i); return e && e.role !== 'base' && !GENERIC.has(e.name) ? e.name : titleCase(i); };
  const place = (i) => [...(where.get(i) || [])].map(c => ({ face: 'Face', hair: 'Scalp', body: 'Body' }[c])).join(', ');
  // Prefer ingredients we know something about; unknown ones only once they repeat.
  const weight = (i, n) => { const e = lookup(i); return n * 2 + (e && e.role !== 'base' ? 3 : 0) + (e && e.tags && e.tags.length ? 2 : 0); };
  const pick = (m, other) => [...m.entries()].filter(([i]) => !other.has(i))
    .filter(([i, n]) => { const e = lookup(i); return e ? e.role !== 'base' : n >= 2; })
    .sort((a, b) => weight(b[0], b[1]) - weight(a[0], a[1])).slice(0, 6)
    .map(([i, n]) => ({ name: label(i), where: place(i), confidence: conf(n) }));
  const dedupe = (xs) => xs.filter((x, k) => xs.findIndex(y => y.name === x.name) === k);
  return { works: dedupe(pick(lovedCount, reactedCount)), not: dedupe(pick(reactedCount, lovedCount)) };
}

module.exports = { analyze, learn, parseIngredients };
