// Product analysis shared by the server and the browser-only (GitHub Pages) version:
// the AI prompt, the AI call itself, cleaning up its reply, and the profile/history text it reads.
// Shared by the server (require) and the browser (window.FP_BRAIN).
(function (root, make) { if (typeof module === 'object' && module.exports) module.exports = make(); else root.FP_BRAIN = make(); })(typeof self !== 'undefined' ? self : this, function () {

const DEFAULT_MODEL = { claude: 'claude-sonnet-5-5', gemini: 'gemini-2.5-flash' };

// ai: { provider: 'claude' | 'gemini', key, model?, browser? }. browser: true when called straight from a web page.
async function askJSON(ai, prompt, image) {
  if (!ai || !ai.provider || !ai.key) return null;
  const model = ai.model || DEFAULT_MODEL[ai.provider];
  let text = '';
  if (ai.provider === 'claude') {
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.data } });
    content.push({ type: 'text', text: prompt });
    const headers = { 'content-type': 'application/json', 'x-api-key': ai.key, 'anthropic-version': '2023-06-01' };
    if (ai.browser) headers['anthropic-dangerous-direct-browser-access'] = 'true';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: 'user', content }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d?.error?.message || 'AI request failed'), { status: r.status });
    text = (d.content || []).map(c => c.text || '').join('');
  } else {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d?.error?.message || 'AI request failed'), { status: r.status });
    text = (d?.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  }
  try { return JSON.parse(text); } catch {}
  const m = text.match(/[\[{][\s\S]*[\]}]/); if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('AI reply was not JSON');
}

const REF = `Restrictions you may cite, only when that ingredient is actually in the product:
- Cyclopentasiloxane (D5), cyclotetrasiloxane (D4), cyclohexasiloxane (D6): EU limits each to 0.1% in rinse-off products since 2020 and in leave-on products from June 2027, for environmental reasons, not skin safety.
- Methylisothiazolinone: banned by the EU in leave-on products; the MCI/MI mix only in rinse-off products at very low levels.
- Butylphenyl methylpropional (Lilial): banned in EU cosmetics since March 2022.
- Zinc pyrithione: banned in EU cosmetics since March 2022.
- Hydroquinone: banned in EU cosmetics; prescription-only in the US since 2020.
- Retinol: EU limits to 0.3% retinol equivalent in face products and 0.05% in body lotions, phased in from 2025.
- Kojic acid: EU limit 1% in face and hand products. Alpha-arbutin: EU limit 2% in face creams, 0.5% in body lotions.
- Oxybenzone: EU limits 6% face, 2.2% body; Hawaii bans sunscreens with it. Homosalate: EU limit 7.34%, face products only.
- Phenoxyethanol: EU and Japan allow up to 1%. Methylparaben: EU up to 0.4%.
Never invent a restriction or a study.`;

function analyzePrompt({ what, profileText, historyText }) {
  return `You are the ingredient analyst inside Fine Print, an app shoppers use to decide if a skin, hair or body product suits THEM. Speak like a warm, knowledgeable friend: short, plain words.

${what}

The shopper's profile:
${profileText}

What they thought of products they used:
${historyText}

Rules:
- score: how likely this product suits this person, 0-100, from the ingredients against their profile and history. Ingredients from loved products count in favour; ingredients shared with products they reacted to count against (ignore water, glycerin and similar base ingredients). Only score when you have the ingredient list; otherwise score null and verdict "unsure".
- verdict: "yes" 70+, "maybe" 45-69, "no" below 45, "unsure" with no score.
- headline: 2 to 5 words, e.g. "It's a yes.", "Maybe, with a catch.", "I'd skip this one.", "Not sure yet.".
- reason: one sentence under 22 words about this person.
- good: up to 3. name = the ingredient; text completes a full sentence after the name. Under 25 words.
- catch: things to watch, same style. personal true for their avoid list or ingredients shared with products they reacted to (name that product). Include restrictions in other regions (where, what, and whether it's about skin safety). Under 35 words each.
- actives: main working ingredients (max 6) with a plain "what" under 14 words.
- claim: the main marketing claim on the pack, with a one-sentence evidence check, or null.
- category: "face" | "hair" | "body". form: "jar" | "bottle" | "pump" | "tube" | "dropper".
${REF}

Reply with only JSON:
{"found":true,"brand":"","name":"","size":"","category":"face","form":"bottle","ingredientsSource":"label"|"database"|"known"|"unknown","ingredients":[""],"fragrance":true|false|null,"score":0,"verdict":"","headline":"","reason":"","good":[{"name":"","text":""}],"catch":[{"name":"","text":"","personal":false}],"actives":[{"name":"","what":""}],"claim":{"text":"","check":""} or null}`;
}

// What to ask the AI for each way of finding a product.
function whatFor(source, product, query) {
  const nm = [product.brand, product.name].filter(Boolean).join(' ');
  if (source === 'label') return `The photo shows the ingredient list of "${nm || 'a product'}". Read it exactly, in order (ingredientsSource "label").`;
  if (source === 'photo') return 'The photo shows a skin, hair or body care product, usually the front. Identify the brand and exact product. If the ingredient list is visible, read it ("label"). Otherwise give it only if you know this exact formula with confidence ("known"), else leave it empty ("unknown"). If it is not a personal care product, set found to false.';
  return `The shopper typed: "${String(query || '').slice(0, 80)}". Identify the product. Give its ingredient list only if you know the exact formula with confidence ("known"), else empty ("unknown"). If you can't tell which product it is, set found to false.`;
}

const profileText = (pr = {}) => [`Skin type: ${(pr.skin || []).join(', ') || 'not given'}`, `Hair type: ${(pr.hair || []).join(', ') || 'not given'}`,
  `Concerns: ${(pr.concerns || []).join(', ') || 'none'}`, `Wants to avoid: ${(pr.avoid || []).join(', ') || 'nothing listed'}`,
  `Fragrance: ${pr.fragrance === 'avoid' ? 'wants fragranced products flagged' : 'fine with fragrance'}`].join('\n');
const historyText = (h) => h.length ? h.slice(-12).map(x => `- ${x.name}: ${x.rating === 'love' ? 'LOVED' : x.rating === 'no' ? 'REACTED (' + x.reactions.join(', ') + ')' : 'fine'}. Ingredients: ${x.ingredients.slice(0, 35).join(', ')}`).join('\n') : 'No ratings yet.';
const engineProfile = (pr = {}) => ({ skin: (pr.skin || [])[0], concerns: pr.concerns || [], avoid: pr.avoid || [], fragrance: pr.fragrance });

// The rated products on a shelf, in the shape the engine and the AI read.
function historyFrom(products, exceptId) {
  return products.filter(p => p.rating && p.id !== exceptId && p.analysis?.ingredients?.length)
    .map(p => ({ name: [p.brand, p.name].filter(Boolean).join(' '), rating: p.rating.value, reactions: p.rating.reactions || [], ingredients: p.analysis.ingredients, category: p.category }));
}

function cleanAI(a) {
  const pts = (xs, n) => Array.isArray(xs) ? xs.filter(x => x && x.name).slice(0, n).map(x => ({ name: String(x.name), text: String(x.text || ''), personal: !!x.personal, serious: true })) : [];
  const ingredients = Array.isArray(a.ingredients) ? a.ingredients.map(String).filter(Boolean).slice(0, 90) : [];
  let score = typeof a.score === 'number' && ingredients.length ? Math.max(0, Math.min(100, Math.round(a.score))) : null;
  const verdict = score === null ? 'unsure' : ['yes', 'maybe', 'no'].includes(a.verdict) ? a.verdict : score >= 70 ? 'yes' : score >= 45 ? 'maybe' : 'no';
  return {
    score, verdict, headline: String(a.headline || (score === null ? 'Not sure yet.' : '')), reason: String(a.reason || ''),
    good: pts(a.good, 3), catch: pts(a.catch, 5),
    actives: Array.isArray(a.actives) ? a.actives.filter(x => x && x.name).slice(0, 6).map(x => ({ name: String(x.name), what: String(x.what || '') })) : [],
    claim: a.claim && a.claim.text ? { text: String(a.claim.text).replace(/[.]+$/, ''), check: String(a.claim.check || '') } : null,
    fragrance: typeof a.fragrance === 'boolean' ? a.fragrance : null, ingredients, ingredientsSource: a.ingredientsSource || (ingredients.length ? 'label' : 'unknown'), by: 'ai',
  };
}

// Rescore one shelf product with the engine after a rating or profile change.
// Products the AI scored keep the AI's wording; only the number and verdict move. Returns null when nothing changes.
function rescored(engine, p, profile, history) {
  if (!p.analysis?.ingredients?.length) return null;
  const r = engine.analyze({ ingredients: p.analysis.ingredients, profile, history, category: p.category });
  if (r.score === null) return null;
  const a = p.analysis.by === 'ai'
    ? { ...p.analysis, score: Math.round((p.analysis.score + r.score) / 2), catch: [...r.catch.filter(c => c.personal), ...p.analysis.catch.filter(c => !c.personal)].slice(0, 5) }
    : { ...p.analysis, ...r, by: 'engine' };
  if (a.by === 'ai') a.verdict = a.score >= 70 ? 'yes' : a.score >= 45 ? 'maybe' : 'no';
  return a;
}

// Only small data-URL images (the cleaned-up photo); anything else is dropped rather than cut short.
const okImage = (u) => typeof u === 'string' && /^data:image\/(webp|png|jpeg);base64,/.test(u) && u.length <= 1500000 ? u : '';
function pickProduct(p) {
  return {
    name: String(p.name || 'Product').slice(0, 120), brand: String(p.brand || '').slice(0, 80), size: String(p.size || '').slice(0, 40),
    category: ['face', 'hair', 'body'].includes(p.category) ? p.category : 'face', form: String(p.form || 'bottle').slice(0, 12), code: String(p.code || '').slice(0, 20),
    images: Array.isArray(p.images) ? p.images.filter(u => typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)*openbeautyfacts\.org\//.test(u)).slice(0, 4) : [],
    image: okImage(p.image), imageMode: p.imageMode || '', imageCredit: p.imageCredit || '',
    analysis: p.analysis || null, rating: null,
  };
}
function cleanProfile(p = {}) {
  const arr = (x, n = 12) => Array.isArray(x) ? x.map(v => String(v).slice(0, 40)).slice(0, n) : [];
  return { skin: arr(p.skin, 1), hair: arr(p.hair, 1), concerns: arr(p.concerns, 3), avoid: arr(p.avoid, 20), fragrance: p.fragrance === 'avoid' ? 'avoid' : 'ok' };
}
const cleanRating = (r) => ({ value: ['love', 'fine', 'no'].includes(r.value) ? r.value : 'fine', reactions: Array.isArray(r.reactions) ? r.reactions.slice(0, 10).map(String) : [], at: Date.now() });

return { askJSON, analyzePrompt, whatFor, profileText, historyText, engineProfile, historyFrom, cleanAI, rescored, okImage, pickProduct, cleanProfile, cleanRating };
});
