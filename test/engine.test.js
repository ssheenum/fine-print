const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../server/engine');
const brain = require('../public/shared/brain.js');

test('parses a label into INCI names', () => {
  const list = engine.parseIngredients('Ingredients: Aqua/Water, Glycerin, Niacinamide (Vitamin B3), Parfum [Fragrance], Ceramide NP.');
  assert.deepEqual(list, ['aqua', 'glycerin', 'niacinamide', 'parfum', 'ceramide np']);
});

test('needs at least three ingredients to score', () => {
  const r = engine.analyze({ ingredients: 'Aqua, Glycerin' });
  assert.equal(r.score, null);
  assert.equal(r.verdict, 'unsure');
});

test('flags avoid-list ingredients as personal and lowers the score', () => {
  const text = 'Aqua, Glycerin, Niacinamide, Ceramide NP, Parfum, Linalool';
  const plain = engine.analyze({ ingredients: text, profile: { concerns: ['Redness'] } });
  const avoid = engine.analyze({ ingredients: text, profile: { concerns: ['Redness'], avoid: ['Fragrance'] } });
  assert.ok(avoid.score < plain.score);
  assert.ok(avoid.catch.some(c => c.personal && c.name === 'Fragrance'));
  assert.ok(avoid.good.some(g => g.name === 'Niacinamide'));
});

test('ingredients shared with a product that caused a reaction count against', () => {
  const history = [{ name: 'Old Toner', rating: 'no', reactions: ['Red'], ingredients: ['Aqua', 'Glycerin', 'Witch Hazel', 'Menthol'] }];
  const text = 'Aqua, Glycerin, Witch Hazel, Panthenol, Allantoin';
  const fresh = engine.analyze({ ingredients: text });
  const burned = engine.analyze({ ingredients: text, history });
  assert.ok(burned.score < fresh.score);
  assert.ok(burned.catch.some(c => c.from === 'Old Toner'));
});

test('flags EU restrictions', () => {
  const r = engine.analyze({ ingredients: 'Aqua, Sodium Laureth Sulfate, Zinc Pyrithione, Glycerin' });
  assert.ok(r.catch.some(c => /Banned in EU/.test(c.text)));
});

test('learn() separates what works from what does not', () => {
  const l = engine.learn([
    { rating: 'love', ingredients: ['Aqua', 'Niacinamide', 'Squalane'], category: 'face' },
    { rating: 'no', ingredients: ['Aqua', 'Parfum', 'Alcohol Denat.'], category: 'face' },
  ]);
  assert.ok(l.works.some(x => x.name === 'Niacinamide'));
  assert.ok(l.not.some(x => x.name === 'Fragrance'));
});

test('cleanAI clamps scores and fills the verdict', () => {
  const c = brain.cleanAI({ score: 140, ingredients: ['Aqua', 'Glycerin', 'Niacinamide'], good: [{ name: 'Niacinamide', text: 'helps.' }] });
  assert.equal(c.score, 100);
  assert.equal(c.verdict, 'yes');
  assert.equal(brain.cleanAI({ score: 50, ingredients: [] }).score, null);
});

test('pickProduct only keeps Open Beauty Facts image URLs and small data images', () => {
  const p = brain.pickProduct({ name: 'X', images: ['https://images.openbeautyfacts.org/a.jpg', 'https://evil.example/a.jpg'], image: 'javascript:alert(1)' });
  assert.deepEqual(p.images, ['https://images.openbeautyfacts.org/a.jpg']);
  assert.equal(p.image, '');
});
