'use strict';
/* =========================================================
   Garde-fou de la DEGRADATION PAR BUDGET (SKIPD : decide par la boucle, lu par le rendu).

   Ce que ce test defend, dans cet ordre d'importance :
     1. **Machine saine = aucun changement.** Un mecanisme de degradation qui se declenche a
        tort est une regression, pas une protection : sans charge, SKIPD doit rester a 0.
     2. Quand une image ne tient pas son budget, ce sont les postes dont l'absence ne se voit
        pas qui cedent — meteo, indicateurs, etiquettes, halos, mini-carte.
     3. **Jamais le monde ni le joueur**, a aucun niveau.

   On execute la VRAIE `render()` : modules charges dans un DOM stube, on pose SKIPD, on appelle
   render(), et on compte les appels aux fonctions concernees PAR LEUR NOM. Aucune copie du code.

   node test/degradation.js              arbre de travail
   node test/degradation.js --ref=HEAD   code d'origine, sans SKIPD (doit ECHOUER : temoin)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

let CLOCK = 0, TID = 0;
const TIMERS = [];

function mkCtx() {
  const grad = { addColorStop() {} };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
  };
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => (t[p] = v, true) });
}
function mkStyle() { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: (k) => { const v = s[k]; delete s[k]; return v || ''; } }, getPropertyValue: { value: (k) => (s[k] || '') } }); return s; }
function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: () => false, contains: (c) => set.has(c) }; }
function mkListeners() { const L = {}; return { add: (t, fn) => (L[t] = L[t] || []).push(fn), fire: (t, e) => (L[t] || []).forEach(fn => fn(e)), has: (t) => !!(L[t] && L[t].length) }; }
const doc = { activeElement: null };
function mkEl(id, tag) {
  const L = mkListeners(), attrs = {};
  return {
    id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {},
    hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '', offsetWidth: 0, offsetHeight: 0, parentElement: null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }),
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    closest: () => null, focus: () => {}, blur() {}, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, fn) => L.add(t, fn), removeEventListener() {}, _fire: L.fire, _has: L.has,
    after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {},
  };
}
function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; el.getContext = () => mkCtx(); return el; }
const stash = new Map();
Object.assign(doc, {
  hidden: false,
  getElementById(id) { if (!stash.has(id)) { const el = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvasEl(800, 600, id) : mkEl(id); if (id === 'cv') el.parentElement = mkEl('stage'); stash.set(id, el); } return stash.get(id); },
  createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)),
  querySelectorAll: () => [], querySelector: () => null, body: mkEl('body', 'body'),
});
const DOCL = mkListeners(); doc.addEventListener = DOCL.add;
const WINL = mkListeners();
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener: WINL.add, removeEventListener() {} };
const sandbox = {
  window: win, document: doc, console, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {} },
  performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
  setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; },
  clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
  setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }),
  addEventListener: WINL.add, removeEventListener() {},
};
sandbox.globalThis = sandbox;

const code = ORDER.map(readModule).join('\n');
const ctx = vm.createContext(sandbox);
const call = (e) => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})()`);
vm.runInContext(code, ctx, { filename: 'game.js' });

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

const DECO = ['drawWeather', 'drawIndicators', 'drawLabels', 'drawLowGlows', 'drawMinimap'];
const CORE = ['drawChunks', 'drawPlayer', 'drawEnemies'];

/* ---------- instrumentation par nom : on compte, on ne copie rien ---------- */
call(`
__CNT={};__MISS=[];
__ALL=${JSON.stringify([].concat(DECO, CORE))};
for(var i=0;i<__ALL.length;i++){(function(n){
  var f=globalThis[n];
  if(typeof f!=='function'){__MISS.push(n);return;}
  globalThis[n]=function(){ __CNT[n]=(__CNT[n]||0)+1; return f.apply(this,arguments); };
})(__ALL[i]);}
`);
const MISS = JSON.parse(call(`JSON.stringify(__MISS)`));

const hasSkipd = call(`typeof SKIPD==='number'`);
check('la boucle expose un niveau de dégradation numérique (SKIPD)', hasSkipd,
  hasSkipd ? 'SKIPD=' + call('SKIPD') : 'absent : le rendu ne peut rien céder');
check('instrumentation : les fonctions surveillées existent', MISS.length === 0,
  MISS.length ? 'introuvables : ' + MISS.join(', ') : DECO.length + ' décoratives + ' + CORE.length + ' essentielles');

/* ---------- une partie en cours, pour que render() ait de quoi dessiner ---------- */
call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.state='play';`);

/* dessine n images au niveau demande, puis rend le compte d'appels de la derniere */
function drawAt(level, n) {
  call(`__CNT={};`);
  for (let i = 0; i < n; i++) { CLOCK += 16.7; call(`SKIPD=${level};render(1,16.7);`); }
  return JSON.parse(call(`JSON.stringify(__CNT)`));
}
const drawn = (c, n) => (c[n] || 0) > 0 || MISS.includes(n);
const undrawn = (c, n) => (c[n] || 0) === 0 || MISS.includes(n);

/* ================= S1 — machine saine : rien ne doit ceder ================= */
{
  const c = drawAt(0, 3);
  check('niveau 0 : tous les postes décoratifs sont dessinés',
    DECO.slice(0, 4).every(n => drawn(c, n)), 'appels/3 images : ' + JSON.stringify(c));
}

/* ================= S2 — niveau 1 : la meteo et les indicateurs cedent ================= */
{
  const c = drawAt(1, 3);
  check('niveau 1 : météo et indicateurs ne sont plus dessinés',
    ['drawWeather', 'drawIndicators'].every(n => undrawn(c, n)), 'appels/3 images : ' + JSON.stringify(c));
  check('niveau 1 : le monde et le joueur sont TOUJOURS dessinés',
    ['drawChunks', 'drawPlayer'].every(n => drawn(c, n)), 'drawChunks=' + (c.drawChunks || 0) + ' drawPlayer=' + (c.drawPlayer || 0));
  check('niveau 1 : étiquettes et halos restent (cran suivant seulement)',
    ['drawLabels', 'drawLowGlows'].every(n => drawn(c, n)), 'drawLabels=' + (c.drawLabels || 0) + ' drawLowGlows=' + (c.drawLowGlows || 0));
}

/* ================= S3 — niveau 2 : halos et mini-carte cedent aussi ================= */
{
  const c = drawAt(2, 3);
  check('niveau 2 : tous les postes décoratifs ont cédé',
    DECO.every(n => undrawn(c, n)), 'appels/3 images : ' + JSON.stringify(c));
  check('niveau 2 : le monde, le joueur et les ennemis sont TOUJOURS dessinés',
    CORE.every(n => drawn(c, n)), 'drawChunks=' + (c.drawChunks || 0) + ' drawPlayer=' + (c.drawPlayer || 0) + ' drawEnemies=' + (c.drawEnemies || 0));
}

/* ================= S4 — machine saine, la boucle ne doit pas dégrader =================
   Le critere le plus important : un mecanisme de degradation qui se declenche sans raison est
   une regression. On fait tourner la VRAIE boucle a intervalle normal et SKIPD doit rester 0. */
{
  let err = '';
  try {
    call(`SKIPD=0;last=0;`);
    for (let i = 0; i < 240; i++) { CLOCK += 16.7; call(`frame(${CLOCK})`); }
  } catch (e) { err = String(e && e.message || e); }
  const v = err ? -1 : call('SKIPD');
  check('machine saine : 240 images à 16,7 ms sans charge → SKIPD reste 0',
    !err && v === 0, err ? 'exception : ' + err : 'SKIPD=' + v);
}

/* ================= verdict ================= */
let all = true;
for (const c of checks) { if (!c.ok) all = false; console.log((c.ok ? '  OK  ' : ' ECHEC') + ' ' + c.name + (c.detail ? '  — ' + c.detail : '')); }
console.log(all ? '\nDEGRADATION : TOUT PASSE' : '\nDEGRADATION : ECHEC');
process.exit(all ? 0 : 1);
