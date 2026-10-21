/* Fine Print: front end. One page, hash routes, talks to the server's /api. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 86400000, RATE_AFTER = 21 * DAY;

const S = { config: {}, user: null, profile: null, shelf: [], tab: 'face', authMode: null, setup: null, q: '', results: [], searching: false,
  current: null, snapMode: 'front', snapFor: null, reading: null, editing: null, showList: false, learned: null, deleteArmed: false };

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong.'), { status: r.status });
  return d;
}
function toast(msg, ms = 3200) {
  $('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; app.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const go = (hash, replace) => { if (replace) location.replace(hash); else location.hash = hash; };

/* ---------- icons ---------- */
const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  camera: (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  shelf: (on) => on ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 2.5h4v3h-4z"/><path d="M9 5.5h6l1 2.5v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V8z"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5h4v3h-4z"/><path d="M9 5.5h6l1 2.5v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V8z"/></svg>',
  profile: (on) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5"/></svg>`,
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D46" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>',
  dash: (red) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${red ? '#D2232A' : '#6B6A66'}" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>`,
  google: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1C3.3 21.4 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.6h-4C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.6l4 3.1c1-2.8 3.6-4.9 6.7-4.9z"/></svg>',
  apple: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#141414" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>',
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
};
const WM = '<span class="wordmark">fine print<sup>*</sup></span>';
// Line drawings used when a product has no photo yet.
const DRAW = {
  bottle: '<svg width="44%" viewBox="0 0 44 96" aria-hidden="true"><rect x="14" y="2" width="16" height="12" rx="3" fill="none" stroke="#C9C8C3" stroke-width="2"/><rect x="4" y="14" width="36" height="80" rx="12" fill="#F7F7F5" stroke="#C9C8C3" stroke-width="2"/><rect x="11" y="40" width="22" height="20" rx="4" fill="#fff" stroke="#C9C8C3" stroke-width="1.6"/></svg>',
  jar: '<svg width="56%" viewBox="0 0 58 50" aria-hidden="true"><rect x="6" y="2" width="46" height="13" rx="4" fill="none" stroke="#C9C8C3" stroke-width="2"/><rect x="3" y="15" width="52" height="33" rx="10" fill="#F7F7F5" stroke="#C9C8C3" stroke-width="2"/></svg>',
  tube: '<svg width="34%" viewBox="0 0 34 90" aria-hidden="true"><rect x="9" y="76" width="16" height="12" rx="3" fill="none" stroke="#C9C8C3" stroke-width="2"/><path d="M3 4h28l-4 72H7z" fill="#F7F7F5" stroke="#C9C8C3" stroke-width="2" stroke-linejoin="round"/></svg>',
};
DRAW.pump = DRAW.bottle; DRAW.dropper = DRAW.bottle;

function nav(active) {
  return `<nav class="nav" aria-label="Main">
    <a href="#shelf" class="${active === 'shelf' ? 'on' : ''}">${ICON.shelf(active === 'shelf')}My shelf</a>
    <a href="#snap" class="snap" aria-label="Snap a product" data-snap>${ICON.camera(28)}</a>
    <a href="#profile" class="${active === 'profile' ? 'on' : ''}">${ICON.profile(active === 'profile')}Profile</a>
  </nav>`;
}

/* ---------- options ---------- */
const OPTS = {
  skin: ['Oily', 'Dry', 'Combination', 'Normal', 'Not sure'],
  hair: ['Straight', 'Wavy', 'Curly', 'Coily', 'Not sure'],
  concerns: ['Acne', 'Redness', 'Dryness', 'Dark spots', 'Fine lines', 'Sensitivity', 'Dullness', 'Texture', 'Frizz', 'Dandruff', 'Hair fall', 'Body dryness'],
  avoid: ['Fragrance', 'Essential oils', 'Alcohol denat.', 'Sulfates', 'Silicones', 'Parabens', 'Coconut oil', 'Retinoids'],
};
const STEPS = [
  { key: 'skin', q: "What's your skin like?", hint: '', multi: false },
  { key: 'hair', q: 'And your hair?', hint: '', multi: false },
  { key: 'concerns', q: 'What do you want to fix?', hint: 'Pick up to 3.', multi: true, max: 3 },
  { key: 'avoid', q: 'Anything your skin hates?', hint: "I'll flag these in every product.", multi: true },
];
function toggleIn(list, o, multi, max) {
  if (!multi) return [o];
  if (list.includes(o)) return list.filter((x) => x !== o);
  if (max && list.length >= max) return list;
  return list.concat([o]);
}
const chipsHTML = (opts, sel, attr) => opts.map((o) => `<button class="chip" type="button" ${attr}="${esc(o)}" aria-pressed="${sel.includes(o)}">${esc(o)}</button>`).join('');

/* ---------- router ---------- */
const PUBLIC_ROUTES = ['welcome', 'signup', 'login'];
let lastRoute = '';
function route() { return (location.hash.replace(/^#/, '') || (S.user ? 'shelf' : 'welcome')); }
function render() {
  let r = route();
  if (r === 'google-off') { toast("Google sign-in isn't switched on for this site yet. Use email or phone for now."); return go('#signup', true); }
  const [name, arg] = r.split('/');
  if (!S.user && !PUBLIC_ROUTES.includes(name)) return go('#welcome', true);
  if (S.user && PUBLIC_ROUTES.includes(name)) return go('#shelf', true);
  if (name !== 'snap') stopCamera();
  const sameRoute = r === lastRoute; const prevScroll = sameRoute ? $('.view')?.scrollTop : 0;
  lastRoute = r;
  const views = { welcome, signup, login, setup, shelf, search, snap, reading, result, item, profile };
  (views[name] || shelf)(arg);
  if (sameRoute && prevScroll) { const v = $('.view'); if (v) v.scrollTop = prevScroll; }
}
window.addEventListener('hashchange', () => { S.deleteArmed = false; render(); });

/* ---------- welcome + auth ---------- */
function welcome() {
  app.innerHTML = `<main class="view pad24">
    <span class="logo" style="margin-top:min(200px,22vh)">fine<br>print<sup>*</sup></span>
    <p style="margin:22px 0 0;font-size:22px;font-weight:700;letter-spacing:-.015em;line-height:1.3">Your skin's most honest friend.</p>
    <div style="margin-top:auto;margin-bottom:40px;display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:40px">
      <a href="#signup" class="btn red">Set me up</a>
      <span style="font-size:15px;color:var(--mute);min-height:44px;display:flex;align-items:center;gap:6px">Already have an account? <a href="#login" style="font-weight:600;text-underline-offset:3px">Log in</a></span>
    </div></main>`;
}
function authView(kind) {
  const m = S.authMode, isUp = kind === 'signup';
  const nameField = isUp ? `<div class="field"><label for="f-name">Your name</label><input class="input" id="f-name" autocomplete="given-name" placeholder="Your first name" required></div>` : '';
  const form = !m ? '' : `<form id="authform" style="margin-top:22px;display:flex;flex-direction:column;gap:12px" novalidate>
      ${nameField}
      ${m === 'email'
        ? `<div class="field"><label for="f-email">Email</label><input class="input" id="f-email" type="email" autocomplete="email" placeholder="you@example.com" required></div>`
        : `<div class="field"><label for="f-phone">Phone number</label><input class="input" id="f-phone" type="tel" autocomplete="tel" placeholder="(510) 555-0123" required></div>`}
      <div class="field"><label for="f-pass">Password</label><input class="input" id="f-pass" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}" placeholder="${isUp ? 'At least 8 characters' : ''}" required></div>
      <p class="error" id="f-err"></p>
      <button class="btn red" type="submit" style="margin-top:6px">${isUp ? 'Create account' : 'Log in'}</button>
    </form>`;
  app.innerHTML = `<main class="view pad24">
    <div class="bar"><a href="#welcome" class="circle" aria-label="Back">${ICON.back}</a>${WM}</div>
    <h1 class="h-xl" style="margin-top:34px">${isUp ? 'Create your account' : 'Welcome back'}</h1>
    <p class="sub">${isUp ? 'So your shelf and ratings are saved wherever you sign in.' : 'Log in to pick up your shelf where you left it.'}</p>
    <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
      <button class="btn line" type="button" data-google>${ICON.google}Continue with Google</button>
      <button class="btn line" type="button" data-apple>${ICON.apple}Continue with Apple</button>
      <button class="btn line ${m === 'email' ? 'on' : ''}" type="button" data-mode="email">${ICON.mail}Continue with email</button>
      <button class="btn line ${m === 'phone' ? 'on' : ''}" type="button" data-mode="phone">${ICON.phone}Continue with phone number</button>
    </div>
    ${form}
    <span style="margin:auto 0 28px;padding-top:24px;align-self:center;font-size:15px;color:var(--mute);min-height:44px;display:flex;align-items:center;gap:6px">
      ${isUp ? 'Have an account? <a href="#login" style="font-weight:600">Log in</a>' : 'New here? <a href="#signup" style="font-weight:600">Set me up</a>'}</span>
  </main>`;
  $$('[data-mode]').forEach((b) => b.onclick = () => { S.authMode = b.dataset.mode; authView(kind); $('#authform input')?.focus(); });
  $('[data-google]').onclick = () => { if (S.config.google) location.href = '/api/auth/google?mode=' + kind; else toast("Google sign-in isn't switched on for this site yet. Use email or phone for now."); };
  $('[data-apple]').onclick = () => toast("Apple sign-in is coming soon. Use email or phone for now.");
  const f = $('#authform');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; $('#f-err').textContent = '';
    try {
      const body = { method: m, name: $('#f-name')?.value, email: $('#f-email')?.value, phone: $('#f-phone')?.value, password: $('#f-pass').value };
      const d = await api(isUp ? '/api/auth/signup' : '/api/auth/login', { method: 'POST', body });
      S.user = d.user; S.profile = d.profile; S.authMode = null;
      if (isUp || !d.profile) { S.setup = null; go('#setup'); } else { await loadShelf(); go('#shelf'); }
    } catch (err) { $('#f-err').textContent = err.message; btn.disabled = false; }
  };
}
const signup = () => authView('signup');
const login = () => authView('login');

/* ---------- profile setup ---------- */
function setup() {
  if (!S.setup) {
    const p = S.profile || {};
    S.setup = { step: 0, sel: { skin: p.skin || [], hair: p.hair || [], concerns: p.concerns || [], avoid: p.avoid || [] }, frag: p.fragrance === 'ok' ? 'ok' : 'avoid' };
  }
  const st = S.setup, s = STEPS[st.step], sel = st.sel[s.key], last = st.step === STEPS.length - 1;
  app.innerHTML = `<main class="view">
    <div class="bar">${st.step ? `<button class="circle" aria-label="Back" data-back>${ICON.back}</button>` : '<span></span>'}
      <button class="link" data-skip>Skip</button></div>
    <div style="margin-top:18px;height:4px;border-radius:4px;background:var(--ring);overflow:hidden;flex-shrink:0"><div style="height:100%;background:var(--ink);width:${(st.step + 1) * 25}%;transition:width .25s"></div></div>
    <h1 class="h-xl" style="margin-top:34px">${esc(s.q)}</h1>
    <p class="sub" style="margin-top:8px;min-height:20px">${esc(s.hint)}</p>
    <div class="chips" style="margin-top:22px">${chipsHTML(OPTS[s.key], sel, 'data-o')}</div>
    ${last ? `<span class="label" style="margin-top:24px">Fragrance</span>
      <div class="chips" style="margin-top:12px">
        <button class="chip" data-f="ok" aria-pressed="${st.frag === 'ok'}">Fine with it</button>
        <button class="chip" data-f="avoid" aria-pressed="${st.frag === 'avoid'}">Flag fragranced products</button></div>` : ''}
    <div style="margin-top:auto;padding-top:28px;padding-bottom:20px"><button class="btn black" data-next>${last ? 'Done' : 'Next'}</button></div>
  </main>`;
  $$('[data-o]').forEach((b) => b.onclick = () => { st.sel[s.key] = toggleIn(sel, b.dataset.o, s.multi, s.max); setup(); });
  $$('[data-f]').forEach((b) => b.onclick = () => { st.frag = b.dataset.f; setup(); });
  $('[data-back]')?.addEventListener('click', () => { st.step--; setup(); });
  const finish = async () => {
    const profile = { ...st.sel, fragrance: st.frag };
    try { const d = await api('/api/profile', { method: 'PUT', body: { profile } }); S.profile = d.profile; } catch (e) { return toast(e.message); }
    S.setup = null; await loadShelf(); go('#shelf');
  };
  $('[data-next]').onclick = () => { if (last) finish(); else { st.step++; setup(); } };
  $('[data-skip]').onclick = finish;
}

/* ---------- shelf ---------- */
async function loadShelf() { try { S.shelf = (await api('/api/shelf')).products; } catch { S.shelf = []; } }
const due = (p) => !p.rating && Date.now() - p.addedAt >= RATE_AFTER;
const proxied = (u) => '/api/img?url=' + encodeURIComponent(u);
const small = (u) => u.replace(/\.full\.jpg$/, '.400.jpg');
function picture(p, cls = '') {
  if (p.image) return `<img src="${esc(p.image)}" alt="" class="${p.imageMode === 'photo' ? 'photo' : p.imageMode === 'blend' ? 'blend' : ''} ${cls}">`;
  if (p.images?.length) return `<img src="${esc(proxied(small(p.images[0])))}" alt="" class="blend ${cls}">`;
  return DRAW[p.form] || DRAW.bottle;
}
const fullName = (p) => [p.brand, p.name].filter(Boolean).join(' ');
function shelf() {
  const list = S.shelf, count = (k) => list.filter((p) => p.category === k).length, anyDue = (k) => list.some((p) => p.category === k && due(p));
  const items = list.filter((p) => p.category === S.tab).sort((a, b) => due(b) - due(a) || b.addedAt - a.addedAt);
  const L = { face: 'Face', hair: 'Hair', body: 'Body' };
  app.innerHTML = `<main class="view with-nav">
    <div class="head"><h1 class="h-xl">My shelf</h1>${WM}</div>
    <button class="searchpill" data-search>${ICON.search}Search a product by name</button>
    <div class="tabs" role="tablist" aria-label="Category">
      ${['face', 'hair', 'body'].map((k) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${L[k]} ${count(k) ? `<span class="n">${count(k)}</span>` : ''}${anyDue(k) ? '<span class="dot" aria-label="ready to rate"></span>' : ''}</button>`).join('')}
    </div>
    ${items.length ? `<div class="grid">${items.map((p) => {
      const a = p.analysis || {}, isDue = due(p);
      const score = a.score == null ? '' : a.verdict === 'no' ? `<span class="no">${a.score} · Skip</span>` : `<span>${a.score}</span>`;
      const rated = p.rating ? `<span>${{ love: 'Obsessed', fine: "It's fine", no: 'Said no' }[p.rating.value]}</span>` : '';
      return `<button class="card" data-open="${p.id}">
        <div class="tile">${picture(p)}${isDue ? '<span class="due" aria-label="Ready to rate"></span>' : ''}</div>
        <span class="name">${esc(fullName(p))}</span>
        <span class="meta">${score}${isDue ? `<span class="ask">How's it going?</span>` : rated}</span></button>`;
    }).join('')}</div>`
    : `<p class="empty">${list.length ? `No ${L[S.tab].toLowerCase()} products yet.` : 'Your shelf is empty.'}<br>Tap the red button to snap one,<br>or search by name.</p>`}
  </main>${nav('shelf')}`;
  $('[data-search]').onclick = () => { S.q = ''; S.results = []; go('#search'); };
  $$('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; shelf(); });
  $$('[data-open]').forEach((b) => b.onclick = () => { const p = S.shelf.find((x) => x.id === b.dataset.open); if (due(p)) openRating(p); else go('#item/' + p.id); });
  wireNav();
  queueShelfImages();
}
function wireNav() { $$('[data-snap]').forEach((a) => a.onclick = (e) => { e.preventDefault(); S.snapMode = 'front'; S.snapFor = null; go('#snap'); }); }

/* ---------- search ---------- */
let searchTimer, searchSeq = 0;
function search() {
  app.innerHTML = `<main class="view with-nav">
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
      <a href="#shelf" class="circle" aria-label="Back">${ICON.back}</a>
      <label class="searchbox">${ICON.search}<input id="q" aria-label="Product name" placeholder="Brand and product name" autocomplete="off" enterkeyhint="search" value="${esc(S.q)}"></label>
    </div>
    <div id="results" style="margin-top:8px;display:flex;flex-direction:column"></div>
    <div style="margin-top:12px;display:flex;flex-direction:column;align-items:flex-start;flex-shrink:0">
      <button class="link" data-label style="font-size:14px">Snap the ingredient list instead</button>
    </div>
  </main>${nav('')}`;
  const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
  q.oninput = () => { S.q = q.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 300); };
  q.onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(searchTimer); runSearch(); } };
  $('[data-label]').onclick = () => { S.snapMode = 'label'; S.snapFor = null; go('#snap'); };
  wireNav(); drawResults();
}
async function runSearch() {
  const q = S.q.trim(), seq = ++searchSeq;
  if (q.length < 2) { S.results = []; return drawResults(); }
  S.searching = true; drawResults();
  try { const d = await api('/api/search?q=' + encodeURIComponent(q)); if (seq !== searchSeq) return; S.results = d.results; }
  catch (e) { if (seq === searchSeq) { S.results = []; toast(e.message); } }
  S.searching = false; if (seq === searchSeq) drawResults();
}
function drawResults() {
  const box = $('#results'); if (!box) return;
  if (S.searching && !S.results.length) { box.innerHTML = '<div class="spinner" role="status" aria-label="Searching"></div>'; return; }
  const words = S.q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const hl = (t) => esc(t).replace(new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), (m) => `<mark>${m}</mark>`);
  const L = { face: 'Face', hair: 'Hair', body: 'Body' };
  box.innerHTML = S.results.length ? S.results.map((r, i) => `<button class="result" data-i="${i}">
      <span class="th">${r.thumb ? `<img src="${esc(proxied(r.thumb))}" alt="" loading="lazy">` : DRAW.bottle}</span>
      <span class="t"><b>${words.length ? hl(r.name) : esc(r.name)}</b><span>${esc([r.brand, L[r.category], r.size].filter(Boolean).join(' · '))}</span></span></button>`).join('')
    : (S.q.trim().length >= 2 && !S.searching ? `<p class="empty" style="text-align:left;margin-top:16px;padding:0">I couldn't find that one. Try the brand and the product name, or snap the ingredient list.</p>` : '');
  $$('[data-i]', box).forEach((b) => b.onclick = () => choose(S.results[+b.dataset.i]));
}
function fromHit(h) { return { name: h.name, brand: h.brand, size: h.size, category: h.category, code: h.code, form: 'bottle', images: [h.full, ...(h.alts || [])].filter(Boolean), ingredients: h.ingredients || '' }; }
function choose(hit) {
  const product = fromHit(hit);
  if (product.ingredients) return startReading(() => api('/api/analyze', { method: 'POST', body: { source: 'database', product } }));
  if (S.config.ai) return startReading(() => api('/api/analyze', { method: 'POST', body: { source: 'name', query: fullName(product), product } }));
  S.snapMode = 'label'; S.snapFor = product; go('#snap');
  toast("I found it, but not its ingredients. Snap the list on the back and I'll score it.", 4200);
}

/* ---------- snap ---------- */
let stream = null, scanTimer = null;
function stopCamera() { clearInterval(scanTimer); scanTimer = null; if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
function snap() {
  const label = S.snapMode === 'label';
  app.innerHTML = `<main class="view">
    <div class="bar"><a href="#shelf" class="circle" aria-label="Close">${ICON.close}</a>${WM}</div>
    <h1 class="h-l" style="margin-top:18px">${label ? 'Snap the<br>ingredient list.' : 'Point at the front<br>of any product.'}</h1>
    ${label && S.snapFor ? `<p class="sub" style="margin-top:8px">${esc(fullName(S.snapFor))}</p>` : ''}
    <div class="viewfinder" id="vf"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
    <div class="snapfoot">
      <button class="shutter" aria-label="Take photo" data-shutter>${ICON.camera(32)}</button>
      ${label ? '' : '<a href="#search" class="link">Can\'t snap it? Type the name</a>'}
      <input type="file" accept="image/*" capture="environment" id="file" class="sr" tabindex="-1" aria-hidden="true">
    </div>
  </main>`;
  const file = $('#file');
  file.onchange = () => { const f = file.files?.[0]; if (f) handlePhoto(f); };
  $('[data-shutter]').onclick = async () => {
    const v = $('#vf video');
    if (v && v.videoWidth) { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); c.toBlob((b) => b && handlePhoto(b), 'image/jpeg', 0.92); }
    else file.click();
  };
  startCamera(label);
}
async function startCamera(label) {
  if (!navigator.mediaDevices?.getUserMedia || stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (route() !== 'snap') return stopCamera();
    const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.autoplay = true; v.srcObject = stream;
    $('#vf').prepend(v); $('#vf').classList.add('live'); await v.play().catch(() => {});
    if (!label && 'BarcodeDetector' in window) { // live barcode: the fastest, most exact way to find the product
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      scanTimer = setInterval(async () => {
        if (!v.videoWidth) return;
        const codes = await det.detect(v).catch(() => []);
        if (codes[0]?.rawValue) { const code = codes[0].rawValue; stopCamera(); startReading(() => analyzeBarcode(code)); }
      }, 700);
    }
  } catch { stream = null; /* no camera or permission: the button opens the photo picker */ }
}
function loadImage(src) { return new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
async function prepImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url), k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const sq = document.createElement('canvas'), m = Math.min(img.width, img.height); sq.width = sq.height = 480;
    sq.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 480, 480);
    return { base64: c.toDataURL('image/jpeg', 0.85).split(',')[1], thumb: sq.toDataURL('image/jpeg', 0.8), canvas: c, blob };
  } finally { URL.revokeObjectURL(url); }
}
async function analyzeBarcode(code) {
  const d = await api('/api/product?code=' + encodeURIComponent(code));
  if (!d.product) return { needs: 'not-found' };
  const product = fromHit(d.product);
  if (product.ingredients) return api('/api/analyze', { method: 'POST', body: { source: 'database', product } });
  if (S.config.ai) return api('/api/analyze', { method: 'POST', body: { source: 'name', query: fullName(product), product } });
  return { needs: 'label', product };
}
async function findBarcode(canvas) {
  if (!('BarcodeDetector' in window)) return null;
  try { const c = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(canvas); return c[0]?.rawValue || null; } catch { return null; }
}
let tesseractLoad;
async function readText(canvas) {
  if (!window.Tesseract) tesseractLoad ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  await tesseractLoad;
  const { data } = await window.Tesseract.recognize(canvas, 'eng');
  return data.text || '';
}
function ingredientsFrom(text) {
  const t = text.replace(/\r/g, '').replace(/-\n/g, '').replace(/\s*\n\s*/g, ' ');
  const m = t.match(/(?:ingredients|ingr[ée]dients|inci|composition)\s*[:：.;]?\s*(.+)/i);
  let body = (m ? m[1] : t).split(/\b(?:warnings?|caution|directions|how to use|made in|distributed by|manufactured|for external use|keep out of)\b/i)[0];
  const parts = body.split(/[,;]/).map((x) => x.replace(/[^A-Za-z0-9 ()\-/.%]/g, '').trim()).filter((x) => x.length > 1 && x.length < 60);
  return parts.length >= 5 ? parts.join(', ') : null;
}
function handlePhoto(blob) {
  const mode = S.snapMode, forProduct = S.snapFor;
  stopCamera();
  startReading(async () => {
    const img = await prepImage(blob);
    const extra = mode === 'front' ? { photoBlob: blob, photoThumb: img.thumb } : {};
    if (mode === 'front') {
      const code = await findBarcode(img.canvas);
      if (code) { const r = await analyzeBarcode(code); if (r.analysis) return { ...r, ...extra }; if (r.needs === 'label') return { ...r, ...extra }; }
      if (S.config.ai) { const r = await api('/api/analyze', { method: 'POST', body: { source: 'photo', image: { mimeType: 'image/jpeg', data: img.base64 } } }); return { ...r, ...extra }; }
    } else if (S.config.ai) {
      return api('/api/analyze', { method: 'POST', body: { source: 'label', product: forProduct || {}, image: { mimeType: 'image/jpeg', data: img.base64 } } });
    }
    // no AI: read the label in the browser
    const text = ingredientsFrom(await readText(img.canvas).catch(() => ''));
    if (!text) return { needs: mode === 'front' ? 'front-unread' : 'label-unread', product: forProduct };
    const r = await api('/api/analyze', { method: 'POST', body: { source: 'label', ocrText: text, product: forProduct || { name: '', category: 'face' } } });
    return { ...r, ...extra };
  });
}

/* ---------- reading ---------- */
const READ_STEPS = ['Finding the product', 'Reading the ingredients', 'Checking them against you', 'Looking up the rules elsewhere', 'Fact-checking the claims'];
function startReading(job) {
  const run = { i: 0, cancelled: false };
  S.reading = run; go('#reading');
  const minTime = new Promise((r) => setTimeout(r, 2800));
  run.timer = setInterval(() => { run.i = Math.min(READ_STEPS.length - 1, run.i + 1); const el = $('#step'); if (el) el.textContent = READ_STEPS[run.i]; }, 850);
  Promise.all([job(), minTime]).then(([d]) => {
    clearInterval(run.timer); if (run.cancelled) return;
    if (d.analysis) { S.current = { ...d.product, analysis: d.analysis, photoBlob: d.photoBlob, photoThumb: d.photoThumb }; S.showList = false; go('#result', true); startImage(S.current); return; }
    if (d.needs === 'label' || d.needs === 'ingredients') { S.snapMode = 'label'; S.snapFor = d.product || null; go('#snap', true); return toast("I found it, but not its ingredients. Snap the list on the back and I'll score it.", 4200); }
    if (d.needs === 'label-unread') { S.snapMode = 'label'; S.snapFor = d.product || null; go('#snap', true); return toast("I couldn't read that. Get closer to the ingredient list, in good light.", 4200); }
    go('#search', true); toast(d.needs === 'front-unread' || d.needs === 'barcode-or-name' ? "I couldn't tell what that is. Type the name, or snap the barcode or the ingredient list." : "I couldn't find that one. Try typing the name.", 4800);
  }).catch((e) => { clearInterval(run.timer); if (run.cancelled) return; history.back(); toast(e.message || 'Something went wrong. Try again.'); });
}
function reading() {
  if (!S.reading) return go('#shelf', true);
  app.innerHTML = `<main class="view" style="align-items:center">
    <span style="align-self:flex-end;line-height:44px">${WM}</span>
    <div class="ringwrap">
      <svg class="r" width="240" height="240" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" fill="none" stroke="#EFEEEA" stroke-width="8"/></svg>
      <svg class="r spin" width="240" height="240" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" fill="none" stroke="#D2232A" stroke-width="8" stroke-linecap="round" stroke-dasharray="125 700" transform="rotate(-90 120 120)"/></svg>
      <div class="bottles">
        <svg width="44" height="96" viewBox="0 0 44 96" aria-hidden="true"><rect x="14" y="2" width="16" height="12" rx="3" fill="#D2232A"/><rect x="4" y="14" width="36" height="80" rx="12" fill="#FBE9EA" stroke="#D2232A" stroke-width="2.5"/><rect x="11" y="40" width="22" height="20" rx="4" fill="#FFFFFF" stroke="#D2232A" stroke-width="2"/><circle cx="16" cy="70" r="1.6" fill="#D2232A"/><circle cx="28" cy="78" r="1.6" fill="#D2232A"/></svg>
        <svg width="34" height="74" viewBox="0 0 34 74" aria-hidden="true"><rect x="11" y="2" width="12" height="14" rx="6" fill="#D2232A"/><rect x="8" y="16" width="18" height="7" rx="2" fill="#D2232A"/><rect x="3" y="23" width="28" height="49" rx="8" fill="#FFFFFF" stroke="#D2232A" stroke-width="2.5"/><path d="M10 46h14" stroke="#D2232A" stroke-width="2" stroke-linecap="round"/></svg>
        <svg width="58" height="50" viewBox="0 0 58 50" aria-hidden="true"><rect x="6" y="2" width="46" height="13" rx="4" fill="#D2232A"/><rect x="3" y="15" width="52" height="33" rx="10" fill="#FBE9EA" stroke="#D2232A" stroke-width="2.5"/><path d="M17 31c3 3 7 3 10 0M31 31c3 3 7 3 10 0" stroke="#D2232A" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
      </div>
    </div>
    <h1 class="h-l" style="margin-top:30px;font-size:30px;letter-spacing:-.035em;line-height:1">Reading the fine print…</h1>
    <p id="step" class="sub" aria-live="polite" style="min-height:22px">${READ_STEPS[S.reading.i]}</p>
    <button class="btn line auto" style="margin-top:34px" data-stop>Stop</button>
  </main>`;
  $('[data-stop]').onclick = () => { S.reading.cancelled = true; clearInterval(S.reading.timer); go('#shelf', true); };
}

/* ---------- score screen ---------- */
const ratingsCount = () => S.shelf.filter((p) => p.rating).length;
function joinPt(pt) { return `<b>${esc(pt.name)}</b>${/^[,.;:]/.test(pt.text) ? '' : ' '}${esc(pt.text)}`; }
function scoreScreen(p, saved) {
  const a = p.analysis || {}, no = a.verdict === 'no', unsure = a.score == null;
  const C = 289.03, dash = unsure ? 0 : Math.round((a.score / 100) * C);
  const n = ratingsCount();
  const basis = a.ingredientsSource === 'known' ? 'Based on the known formula. Snap the label to be sure.'
    : `Based on your profile${n ? ` + ${n} rating${n > 1 ? 's' : ''}` : ''}`;
  const credit = p.imageCredit || (!p.image && p.images?.length ? 'Open Beauty Facts' : '');
  const hero = p.image || p.images?.length
    ? picture(p, p.imageMode === 'photo' ? '' : '') : `<div style="width:42%;display:flex;justify-content:center">${DRAW[p.form] || DRAW.bottle}</div>`;
  const nm = [fullName(p) || 'Your product', p.size].filter(Boolean).join(' · ');
  const addArea = saved
    ? (p.rating ? `<div class="notebox"><span>You said: <b>${{ love: 'Obsessed', fine: "It's fine", no: 'My skin said no' }[p.rating.value]}</b>${p.rating.reactions?.length ? ' (' + esc(p.rating.reactions.join(', ').toLowerCase()) + ')' : ''}</span><button class="link red" data-rate style="font-size:14px">Change</button></div>`
      : due(p) ? `<button class="btn red" style="margin-top:20px" data-rate>How's it going?</button>`
      : `<div class="notebox"><span>On your shelf. I'll check in ${daysLeft(p)}.</span><button class="link red" data-rate style="font-size:14px;white-space:nowrap">Rate now</button></div>`)
    : p.savedId ? `<div class="notebox"><span>Added. I'll check in after 3 weeks.</span><a href="#shelf" class="link red" style="font-size:14px;white-space:nowrap">See my shelf</a></div>`
    : `${!p.name ? `<div class="field" style="margin-top:20px"><label for="pn">What's it called?</label><input class="input" id="pn" placeholder="Brand and product name"></div>` : ''}
       <button class="btn black" style="margin-top:${p.name ? 20 : 10}px" data-add>Bought it? Add to my shelf</button>`;
  app.innerHTML = `<main class="view with-nav" style="padding:16px 16px 28px">
    <div class="hero">${hero}
      <button class="circle" aria-label="Back" data-back>${ICON.back}</button>
      ${p.cutting ? '<span class="credit">Cleaning up the photo…</span>' : credit ? `<span class="credit">Photo: ${esc(credit)}</span>` : ''}
    </div>
    <div class="score ${no ? 'no' : ''}">
      <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="${unsure ? 'No score yet' : `Score ${a.score} out of 100`}"><circle cx="56" cy="56" r="46" fill="none" stroke="#EFEEEA" stroke-width="6"/>
        ${unsure ? '' : `<circle cx="56" cy="56" r="46" fill="none" stroke="${no ? '#D2232A' : '#8C8B86'}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${C - dash + 1}" transform="rotate(-90 56 56)"/>`}</svg>
      <div class="num"><b>${unsure ? '?' : a.score}</b><span>${unsure ? 'not sure' : '/100'}</span></div>
    </div>
    <span class="pname">${esc(nm)}</span>
    <h1 class="verdict ${no ? 'no' : ''}">${esc(a.headline || '')}</h1>
    <p class="reason">${esc(a.reason || '')}</p>
    ${unsure ? `<button class="btn red" style="margin-top:20px" data-label>Snap the ingredient list</button>` : `<span class="basis">${esc(basis)}</span>`}
    ${unsure ? '' : addArea}
    ${a.good?.length ? `<section class="box good"><span class="label">The good</span>${a.good.map((g) => `<div class="pt">${ICON.check}<span>${joinPt(g)}</span></div>`).join('')}</section>` : ''}
    ${a.catch?.length ? `<section class="box catch" style="${a.good?.length ? '' : 'margin-top:22px'}"><span class="label">The catch</span>${a.catch.map((c) => `<div class="pt ${c.personal ? 'personal' : ''}">${ICON.dash(c.personal)}<span>${joinPt(c)}</span></div>`).join('')}</section>` : ''}
    ${a.actives?.length ? `<span class="label" style="margin-top:30px;padding-bottom:6px">All the actives</span><div class="rows">${a.actives.map((x) => `<div class="row"><div class="a">${esc(x.name)}</div><div class="b">${esc(x.what)}</div></div>`).join('')}</div>` : ''}
    ${a.claim ? `<div class="claimbox"><span class="label">The label says</span><span>“${esc(a.claim.text)}.” ${esc(a.claim.check)}</span></div>` : ''}
    ${a.ingredients?.length ? `<button class="toggle" data-list aria-expanded="${S.showList}"><span>Full ingredient list (${a.ingredients.length})</span><span>${S.showList ? '−' : '+'}</span></button>
      ${S.showList ? `<p class="inglist">${esc(a.ingredients.join(', '))}</p>` : ''}` : ''}
    ${saved ? `<button class="link quiet" style="margin-top:18px;align-self:flex-start" data-remove>Remove from my shelf</button>` : ''}
    <p class="small" style="margin-top:22px">Fine Print reads public research, regulations and your own ratings. It is not medical advice.${a.ingredientsSource === 'database' ? ' Ingredients from Open Beauty Facts (ODbL).' : ''}</p>
  </main>${nav(saved ? 'shelf' : '')}`;
  $('[data-back]').onclick = () => { if (history.length > 1) history.back(); else go('#shelf'); };
  $('[data-list]')?.addEventListener('click', () => { S.showList = !S.showList; render(); });
  $('[data-label]')?.addEventListener('click', () => { S.snapMode = 'label'; S.snapFor = { name: p.name, brand: p.brand, size: p.size, category: p.category, code: p.code, images: p.images || [] }; go('#snap'); });
  $('[data-add]')?.addEventListener('click', () => addToShelf(p));
  $('[data-rate]')?.addEventListener('click', () => openRating(p));
  const rm = $('[data-remove]');
  if (rm) rm.onclick = async () => {
    if (!S.deleteArmed) { S.deleteArmed = true; rm.textContent = 'Tap again to remove'; return; }
    await api('/api/shelf/' + p.id, { method: 'DELETE' }); S.shelf = S.shelf.filter((x) => x.id !== p.id); S.deleteArmed = false; go('#shelf', true);
  };
  wireNav();
}
function daysLeft(p) { const d = Math.ceil((p.addedAt + RATE_AFTER - Date.now()) / DAY); return d <= 1 ? 'tomorrow' : `in ${d} days`; }
function result() { if (!S.current) return go('#shelf', true); scoreScreen(S.current, false); }
function item(id) { const p = S.shelf.find((x) => x.id === id); if (!p) return go('#shelf', true); scoreScreen(p, true); }
async function addToShelf(p) {
  const nameInput = $('#pn');
  if (nameInput) { const v = nameInput.value.trim(); if (!v) { nameInput.focus(); return toast('Give it a name first.'); } p.name = v; }
  try {
    const body = { product: { name: p.name, brand: p.brand, size: p.size, category: p.category, form: p.form, code: p.code, images: p.images || [],
      image: p.imageMode === 'cut' || p.imageMode === 'photo' ? p.image : '', imageMode: p.imageMode === 'cut' || p.imageMode === 'photo' ? p.imageMode : '', imageCredit: p.imageCredit || '', analysis: p.analysis } };
    const d = await api('/api/shelf', { method: 'POST', body });
    p.savedId = d.product.id; S.shelf.unshift(d.product); S.tab = d.product.category;
    render();
  } catch (e) { toast(e.message); }
}

/* ---------- rating ---------- */
function openRating(p) {
  const st = { val: p.rating?.value || null, picked: new Set(p.rating?.reactions || []) };
  const weeks = Math.max(1, Math.round((Date.now() - p.addedAt) / (7 * DAY)));
  const draw = () => {
    $('.scrim')?.remove();
    const el = document.createElement('div'); el.className = 'scrim';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Rate ${esc(fullName(p))}">
      <div class="grab"></div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:56px;height:56px;border-radius:14px;border:1px solid var(--line);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">${picture(p)}</div>
        <div style="display:flex;flex-direction:column;min-width:0"><span style="font-size:13px;color:var(--mute)">${weeks} week${weeks > 1 ? 's' : ''} with ${esc(fullName(p))}</span>
        <span style="font-size:26px;font-weight:700;letter-spacing:-.025em;line-height:1.08">So… how's it going?</span></div>
      </div>
      <button class="opt" data-v="love" aria-pressed="${st.val === 'love'}">Obsessed <span>would rebuy</span></button>
      <button class="opt" data-v="fine" aria-pressed="${st.val === 'fine'}">It's fine <span>nothing special</span></button>
      <button class="opt no" data-v="no" aria-pressed="${st.val === 'no'}">My skin said no <span>reacted</span></button>
      ${st.val === 'no' ? `<span style="font-size:15px;font-weight:600">Ugh, sorry. What happened?</span>
        <div class="chips">${['Breakouts', 'Itchy', 'Red', 'Dry', 'Greasy', 'Stinging'].map((r) => `<button class="chip" data-r="${r}" aria-pressed="${st.picked.has(r)}">${r}</button>`).join('')}</div>` : ''}
      <span style="font-size:13px;color:var(--mute)">I'll use this to rescore everything with the same ingredients.</span>
      <div style="display:flex;gap:10px"><button class="btn line" data-cancel style="flex:1">Not now</button><button class="btn red" data-save style="flex:1" ${st.val ? '' : 'disabled'}>Save</button></div>
    </div>`;
    app.appendChild(el);
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    $$('[data-v]', el).forEach((b) => b.onclick = () => { st.val = b.dataset.v; draw(); });
    $$('[data-r]', el).forEach((b) => b.onclick = () => { st.picked.has(b.dataset.r) ? st.picked.delete(b.dataset.r) : st.picked.add(b.dataset.r); draw(); });
    $('[data-cancel]', el).onclick = () => el.remove();
    $('[data-save]', el).onclick = async () => {
      $('[data-save]', el).disabled = true;
      try {
        await api('/api/shelf/' + p.id, { method: 'PATCH', body: { rating: { value: st.val, reactions: st.val === 'no' ? [...st.picked] : [] } } });
        await loadShelf(); S.learned = null; el.remove(); render(); toast('Thanks. I rescored your shelf with that.');
      } catch (e) { toast(e.message); $('[data-save]', el).disabled = false; }
    };
    $('.opt', el)?.focus();
  };
  draw();
  const onKey = (e) => { if (e.key === 'Escape') { $('.scrim')?.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

/* ---------- profile ---------- */
const PROWS = [
  { key: 'skin', label: 'Skin type', multi: false }, { key: 'hair', label: 'Hair type', multi: false },
  { key: 'concerns', label: 'Fixing', multi: true, max: 3 }, { key: 'avoid', label: 'Avoiding', multi: true }, { key: 'fragrance', label: 'Fragrance', multi: false },
];
async function profile() {
  const pr = S.profile || {};
  const val = (k) => k === 'fragrance' ? [pr.fragrance === 'ok' ? 'Fine with it' : 'Flag it'] : (pr[k] || []);
  const opts = (k) => k === 'fragrance' ? ['Fine with it', 'Flag it'] : OPTS[k];
  const L = S.learned;
  const learnRows = (xs, not) => xs.map((x, i) => `<div class="row" ${i ? '' : 'style="border-top:1px solid var(--line)"'}><div class="a ${not ? 'not' : ''}">${esc(x.name)}</div><div class="b m">${esc([x.where, x.confidence + ' confidence'].filter(Boolean).join(' · '))}</div></div>`).join('');
  app.innerHTML = `<main class="view with-nav">
    <div class="head"><h1 class="h-xl">Profile</h1>${WM}</div>
    <span class="label" style="margin-top:26px;padding-bottom:6px">About you</span>
    <div style="display:flex;flex-direction:column;border-top:1px solid var(--line)">
      ${PROWS.map((d) => { const sel = val(d.key), ed = S.editing === d.key; return `<div class="prow">
        <div class="top"><span class="k">${d.label}</span><span class="v">${sel.length ? esc(sel.join(', ')) : 'Not set'}</span><button class="e" data-edit="${d.key}" aria-expanded="${ed}">${ed ? 'Done' : 'Edit'}</button></div>
        ${ed ? `<div class="chips">${chipsHTML(opts(d.key), sel, 'data-c')}</div>` : ''}</div>`; }).join('')}
    </div>
    <span class="label learn" style="margin-top:30px">What I've learned about you</span>
    <div class="learn">${!L ? '<div class="spinner" aria-label="Loading"></div>'
      : !L.works.length && !L.not.length ? `<p class="sub" style="margin-top:8px">Rate a few products and I'll start spotting which ingredients work for you.</p>`
      : `${L.works.length ? `<p style="margin:12px 0 6px;font-size:15px;font-weight:600">Works for you</p>${learnRows(L.works)}` : ''}
         ${L.not.length ? `<p style="margin:16px 0 6px;font-size:15px;font-weight:600">Not for you</p>${learnRows(L.not, true)}` : ''}`}</div>
    <span class="label" style="margin-top:30px;padding-bottom:6px">Account</span>
    <div class="rows"><div class="row"><div class="a">${esc(S.user.name || 'You')}</div><div class="b m">${esc(S.user.email || S.user.phone || (S.user.google ? 'Google account' : ''))}</div></div></div>
    <div style="display:flex;gap:18px;flex-wrap:wrap"><button class="link" data-logout>Log out</button><button class="link quiet" data-delete>Delete my account</button></div>
    <p class="small" style="margin-top:20px">Changes apply to every product on your shelf. Product data and photos from Open Beauty Facts.</p>
  </main>${nav('profile')}`;
  $$('[data-edit]').forEach((b) => b.onclick = async () => {
    const k = b.dataset.edit;
    if (S.editing === k) { S.editing = null; await saveProfile(); } else { S.editing = k; }
    profile();
  });
  $$('[data-c]').forEach((b) => b.onclick = () => {
    const k = S.editing, d = PROWS.find((x) => x.key === k), o = b.dataset.c;
    const next = { ...(S.profile || {}) };
    if (k === 'fragrance') next.fragrance = o === 'Fine with it' ? 'ok' : 'avoid'; else next[k] = toggleIn(next[k] || [], o, d.multi, d.max);
    S.profile = next; profile();
  });
  $('[data-logout]').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); Object.assign(S, { user: null, profile: null, shelf: [], current: null, learned: null }); go('#welcome'); };
  const del = $('[data-delete]');
  del.onclick = async () => {
    if (!S.deleteArmed) { S.deleteArmed = true; del.textContent = 'Tap again to delete everything'; del.style.color = 'var(--red)'; return; }
    await api('/api/account', { method: 'DELETE' }).catch(() => {}); Object.assign(S, { user: null, profile: null, shelf: [], current: null, learned: null, deleteArmed: false }); go('#welcome');
  };
  wireNav();
  if (!L) { try { S.learned = await api('/api/learned'); } catch { S.learned = { works: [], not: [] }; } if (route() === 'profile') profile(); }
}
async function saveProfile() {
  try { const d = await api('/api/profile', { method: 'PUT', body: { profile: S.profile || {} } }); S.profile = d.profile; setTimeout(loadShelf, 300); toast('Saved. Your shelf is rescored.'); }
  catch (e) { toast(e.message); }
}

/* ---------- clean product photos ---------- */
// The background is removed in the browser (free, no account). Everything inside the product's
// outline is kept fully opaque, and the photo is framed the same way every time.
let bgRemover;
async function getRemover() {
  if (bgRemover !== undefined) return bgRemover;
  for (const src of ['https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.8/+esm', 'https://esm.sh/@imgly/background-removal@1.5.8']) {
    try { const m = await import(src); bgRemover = m.removeBackground || m.default || null; if (bgRemover) return bgRemover; } catch {}
  }
  bgRemover = null; return null;
}
const WORK = 1024;
function dilateErode(mask, w, h, r, dilate) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h), v = dilate ? 1 : 0;
  for (let y = 0; y < h; y++) { let run = -1e9; for (let x = 0; x < w; x++) { if (mask[y * w + x] === v) run = x; tmp[y * w + x] = x - run <= r ? v : 1 - v; } run = 1e9; for (let x = w - 1; x >= 0; x--) { if (mask[y * w + x] === v) run = x; if (run - x <= r) tmp[y * w + x] = v; } }
  for (let x = 0; x < w; x++) { let run = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + x] === v) run = y; out[y * w + x] = y - run <= r ? v : 1 - v; } run = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x] === v) run = y; if (run - y <= r) out[y * w + x] = v; } }
  return out;
}
function solidMask(fg, w, h) {
  const r = Math.max(2, Math.round(Math.min(w, h) * 0.006));
  const m = dilateErode(dilateErode(fg, w, h, r, true), w, h, r, false);
  const lab = new Int32Array(w * h), q = new Int32Array(w * h); let best = 0, bestN = 0, id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i]) continue; id++; let n = 0, qs = 0, qe = 0; q[qe++] = i; lab[i] = id;
    while (qs < qe) { const j = q[qs++]; n++; const x = j % w, y = (j / w) | 0;
      if (x > 0 && m[j - 1] && !lab[j - 1]) { lab[j - 1] = id; q[qe++] = j - 1; } if (x < w - 1 && m[j + 1] && !lab[j + 1]) { lab[j + 1] = id; q[qe++] = j + 1; }
      if (y > 0 && m[j - w] && !lab[j - w]) { lab[j - w] = id; q[qe++] = j - w; } if (y < h - 1 && m[j + w] && !lab[j + w]) { lab[j + w] = id; q[qe++] = j + w; } }
    if (n > bestN) { bestN = n; best = id; }
  }
  const keep = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) keep[i] = lab[i] === best ? 1 : 0;
  const outside = new Uint8Array(w * h); let qs = 0, qe = 0;
  const push = (j) => { if (!keep[j] && !outside[j]) { outside[j] = 1; q[qe++] = j; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qs < qe) { const j = q[qs++]; const x = j % w, y = (j / w) | 0; if (x > 0) push(j - 1); if (x < w - 1) push(j + 1); if (y > 0) push(j - w); if (y < h - 1) push(j + w); }
  for (let i = 0; i < w * h; i++) keep[i] = outside[i] ? 0 : 1;
  return keep;
}
async function cutout(input) {
  try {
    const remove = await getRemover(); if (!remove) return null;
    if (typeof input === 'string') { const r = await fetch(new URL(input, location.href).href); if (!r.ok) return null; input = await r.blob(); }
    const png = await Promise.race([remove(input, { model: 'isnet_fp16', output: { format: 'image/png' } }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 120000))]);
    const [orig, cut] = await Promise.all([input, png].map(async (b) => { const u = URL.createObjectURL(b); try { return await loadImage(u); } finally { URL.revokeObjectURL(u); } }));
    const k = Math.min(1, WORK / Math.max(orig.width, orig.height)), w = Math.round(orig.width * k), h = Math.round(orig.height * k);
    const co = document.createElement('canvas'); co.width = w; co.height = h; const go2 = co.getContext('2d'); go2.drawImage(orig, 0, 0, w, h);
    const cm = document.createElement('canvas'); cm.width = w; cm.height = h; const gm = cm.getContext('2d'); gm.drawImage(cut, 0, 0, w, h);
    const a = gm.getImageData(0, 0, w, h).data, fg = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) fg[i] = a[i * 4 + 3] > 100 ? 1 : 0;
    const solid = solidMask(fg, w, h);
    let area = 0, filled = 0, touch = 0, edgeN = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!solid[i]) continue; area++; if (!fg[i]) filled++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let x = 0; x < w; x++) { edgeN += 2; touch += solid[x] + solid[(h - 1) * w + x]; } for (let y = 0; y < h; y++) { edgeN += 2; touch += solid[y * w] + solid[y * w + w - 1]; }
    const share = area / (w * h); if (share < 0.02) return null;
    const score = Math.round(100 * (0.45 * (1 - Math.min(1, (touch / edgeN) * 6)) + 0.35 * (1 - Math.min(1, (filled / area) * 2.5)) + 0.2 * (1 - Math.min(1, Math.abs(share - 0.35) / 0.35))));
    const mk = document.createElement('canvas'); mk.width = w; mk.height = h; const gk = mk.getContext('2d'); const md = gk.createImageData(w, h);
    for (let i = 0; i < w * h; i++) md.data[i * 4 + 3] = solid[i] ? 255 : 0;
    gk.putImageData(md, 0, 0);
    go2.globalCompositeOperation = 'destination-in'; go2.filter = 'blur(0.7px)'; go2.drawImage(mk, 0, 0); go2.filter = 'none'; go2.globalCompositeOperation = 'source-over';
    const S2 = 720, pw = x1 - x0 + 1, ph = y1 - y0 + 1, s = Math.min(S2 * 0.8 / ph, S2 * 0.74 / pw);
    const out = document.createElement('canvas'); out.width = out.height = S2; const g = out.getContext('2d');
    const dw = pw * s, dh = ph * s, base = S2 * 0.93;
    g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(20,20,20,.16)'; g.beginPath(); g.ellipse(S2 / 2, base - 4, dw * 0.42, S2 * 0.022, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.drawImage(co, x0, y0, pw, ph, (S2 - dw) / 2, base - dh, dw, dh);
    return { data: out.toDataURL('image/webp', 0.88), score };
  } catch { return null; }
}
// One clean-up at a time (the model is heavy).
let imgChain = Promise.resolve();
const triedImage = new Set();
function startImage(p) {
  if (!p.images?.length && p.photoThumb && !p.image) { p.image = p.photoThumb; p.imageMode = 'photo'; }
  if (!p.images?.length && !p.photoBlob) return;
  p.cutting = true;
  imgChain = imgChain.then(() => upgradeImage(p)).catch(() => {}).finally(() => { p.cutting = false; refreshIfShowing(p); });
}
async function upgradeImage(p) {
  let best = null;
  for (const u of (p.images || []).slice(0, 3)) {
    const c = await cutout(proxied(u));
    if (c && (!best || c.score > best.score)) best = { ...c, credit: 'Open Beauty Facts' };
    if (best && best.score >= 85) break;
  }
  if ((!best || best.score < 55) && p.photoBlob) { const c = await cutout(p.photoBlob); if (c && (!best || c.score > best.score)) best = { ...c, credit: '' }; }
  if (!best || best.score < 45) return;
  p.image = best.data; p.imageMode = 'cut'; p.imageCredit = best.credit;
  const id = p.id || p.savedId;
  if (id) {
    const body = { image: p.image, imageMode: 'cut', imageCredit: p.imageCredit };
    await api('/api/shelf/' + id, { method: 'PATCH', body }).catch(() => {});
    const s = S.shelf.find((x) => x.id === id); if (s) Object.assign(s, body);
  }
}
function refreshIfShowing(p) {
  const r = route();
  if ((r === 'result' && S.current === p) || r === 'item/' + (p.id || p.savedId) || r === 'shelf') render();
}
function queueShelfImages() {
  for (const p of S.shelf) if (p.imageMode !== 'cut' && p.images?.length && !triedImage.has(p.id)) { triedImage.add(p.id); startImage(p); }
}

/* ---------- boot ---------- */
(async function boot() {
  app.innerHTML = '<div class="spinner" style="margin-top:40vh" aria-label="Loading"></div>';
  try { const [c, me] = await Promise.all([api('/api/config'), api('/api/me')]); S.config = c; S.user = me.user; S.profile = me.profile; } catch {}
  if (S.user) await loadShelf();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
