// Optional AI. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Google) to turn it on.
// Without a key the app still works: scoring comes from the built-in engine, and
// products are found by barcode, name search or a photo of the ingredient list.

const provider = () => process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.GEMINI_API_KEY ? 'gemini' : null;

async function askJSON(prompt, image) {
  const p = provider(); if (!p) return null;
  let text = '';
  if (p === 'claude') {
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.data } });
    content.push({ type: 'text', text: prompt });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 2500, messages: [{ role: 'user', content }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d?.error?.message || 'AI request failed'), { status: r.status });
    text = (d.content || []).map(c => c.text || '').join('');
  } else {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.AI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
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

module.exports = { provider, askJSON, analyzePrompt };
