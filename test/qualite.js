'use strict';
/* =========================================================
   Garde-fou du CONTROLEUR DE QUALITE (perf(), g4.js).

   Ce que ce test defend : la qualite adaptative doit pouvoir REMONTER, et elle ne doit
   jamais etre rabaissee pour une raison qui n'est pas une vraie perte de fluidite.
   Avant le 28/09/2026, `perf()` ne savait que descendre et `meta.qAuto` figeait le
   plancher a vie : sur un ecran 90/120 Hz, un jeu a 60 ips parfaitement fluide tombait
   au plancher en 8 s. Et `QL--` n'appelait pas `applyRes()`, donc l'ecran gardait les
   pixels de l'ancien cran.

   On execute la VRAIE `perf()` : les modules du jeu sont charges dans un DOM stubé, puis
   on lui donne des intervalles d'image synthetiques. Aucune copie du code du jeu.

   node test/qualite.js              arbre de travail
   node test/qualite.js --ref=HEAD   code d'origine (doit ECHOUER : c'est le temoin)
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

/* ---------- horloge virtuelle ---------- */
let CLOCK = 0, TID = 0;
const TIMERS = [];
function advance(ms) {
  const end = CLOCK + ms;
  for (;;) {
    let k = -1;
    for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i;
    if (k < 0) break;
    const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn();
  }
  CLOCK = end;
}

/* ---------- stubs (identiques a test/headless.js, reduits au necessaire) ---------- */
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
function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }; }
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

/* ---------- instruments ---------- */
const PERF = call('(function(dt){perf(dt);})');
const STATE = call('(function(){return JSON.stringify({QL:QL,RES:RES,ref:REFDT,refn:REFN,qa:meta.qAuto,w:cv.width,h:cv.height,ps:PS});})');
const st = () => JSON.parse(STATE());

/* DPR=2 : sans cela, PS vaut 1 a tous les crans et la coherence QL/RES <-> pixels est invisible.
   C'est le cas d'un telephone (DPR plafonne a 2 par g3.js:10). */
call('DPR=2');

function reset(qAuto) {
  call(`G.state='play';meta.q='auto';meta.qAuto=${qAuto ? JSON.stringify(qAuto) : 'null'};QL=3;RES=1;REFDT=0;REFN=0;slowT=0;upT=0;DTH.length=0;applyQuality();`);
}

/* joue n images a intervalle constant */
function play(n, dt) { for (let i = 0; i < n; i++) { CLOCK += dt; PERF(dt); } }
const secs = (s, dt) => play(Math.round(s * 1000 / dt), dt);

/* l'invariant : l'etat de qualite et la taille reelle du canevas doivent concorder */
function coherent(S) {
  const ps = Math.min(2, S.QL >= 3 ? 2 : S.QL === 2 ? 1.25 : 1) * S.RES;
  return Math.abs(S.w - Math.round(800 * ps)) <= 1 && Math.abs(S.ps - ps) < 1e-9;
}

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();`);

/* ================= S1 — ecran 120 Hz, jeu a 60 ips constants : rien ne doit bouger =================
   Le defaut d'origine : REFDT etait un MINIMUM historique, alimente meme hors du jeu. Un menu a
   8,3 ms (120 Hz) faisait de 16,7 ms la « lenteur » -> plancher atteint sans une seule image perdue. */
{
  reset(null);
  call(`G.state='menu';`);
  secs(6, 8.3);                    /* menu sur ecran 120 Hz : ne doit PAS devenir la reference */
  call(`G.state='play';`);
  secs(5, 16.7);                   /* etablissement de la reference (jeu reel) */
  const S0 = st();
  secs(60, 16.7);                  /* 60 s de jeu parfaitement fluide */
  const S = st();
  check('S1 ecran 120 Hz + jeu a 60 ips constants : la qualite ne baisse pas',
    S.QL === 3 && S.RES === 1,
    `reference=${S.ref.toFixed(1)} ms (apres 5 s de jeu) ; final QL/RES=${S.QL}/${S.RES} (attendu 3/1)`);
  check('S1 la reference est celle du JEU, pas celle du menu',
    S.ref > 15 && S.ref < 19, `reference=${S.ref.toFixed(1)} ms (attendu ~16,7 ; le menu a 8,3 ne doit pas la fixer)`);
  check('S1 etat de qualite coherent avec la taille du canevas', coherent(S),
    `QL/RES=${S.QL}/${S.RES} -> canvas ${S.w}x${S.h}, PS=${S.ps}`);
}

/* ================= S2 — lente puis rapide : la qualite doit REMONTER ================= */
{
  reset(null);
  secs(5, 16.7);                   /* reference */
  secs(20, 33.3);                  /* la machine rame : 30 ips */
  const SLOW = st();
  check('S2 pendant la phase lente, la qualite DESCEND bien',
    SLOW.QL < 3 || SLOW.RES < 1, `QL/RES=${SLOW.QL}/${SLOW.RES}`);
  secs(45, 16.7);                  /* la machine redevient fluide */
  const S = st();
  check('S2 apres 45 s fluides, la qualite est REMONTEE au maximum',
    S.QL === 3 && S.RES === 1,
    `apres la phase lente QL/RES=${SLOW.QL}/${SLOW.RES} ; final QL/RES=${S.QL}/${S.RES} (attendu 3/1) — un cliquet resterait bloque`);
  check('S2 plancher : la qualite persistee n\'est pas un etat definitif', coherent(S) && S.QL === 3,
    `qAuto=${S.qa} ; QL/RES=${S.QL}/${S.RES}`);
}

/* ================= S3 — hysteresis : une embellie courte ne doit pas faire remonter ================= */
{
  reset(null);
  secs(5, 16.7);
  secs(20, 33.3);
  const A = st();
  secs(2, 16.7);                   /* 2 s de mieux : trop court */
  const B = st();
  check('S3 une embellie de 2 s ne declenche PAS de remontee (pas d\'oscillation)',
    B.QL === A.QL && B.RES === A.RES,
    `avant ${A.QL}/${A.RES} -> apres 2 s fluides ${B.QL}/${B.RES} (doit etre identique)`);
}

/* ================= S4 — QL-- doit mettre a jour la taille du canevas =================
   Defaut mesuré en Chromium le 28/09/2026 : entre les deux premieres baisses, le jeu tournait
   avec QL=1 mais PS=1,5 — les effets etaient retires, les pixels non. Le defaut est TRANSITOIRE
   (la baisse suivante de RES, elle, appelait applyRes()) : il faut donc controler a chaque image,
   pas seulement a la fin. */
{
  reset(null);
  secs(5, 16.7);
  let bad = 0, badAt = '';
  for (let i = 0; i < 20 * 60; i++) {
    CLOCK += 33.3; PERF(33.3);
    if (i % 5 === 0) { const S = st(); if (!coherent(S) && !bad) { bad = 1; badAt = `QL/RES=${S.QL}/${S.RES} mais canvas ${S.w}x${S.h}, PS=${S.ps}`; } }
  }
  const S = st();
  check('S4 a chaque changement de cran, applyRes() suit (taille du canevas == cran courant)',
    !bad && coherent(S),
    bad ? `incoherence pendant la descente : ${badAt}` : `QL/RES=${S.QL}/${S.RES} -> canvas ${S.w}x${S.h}, PS=${S.ps}`);
}

/* ================= S5 — le mode manuel n'est jamais adapte ================= */
{
  reset(null);
  call(`G.state='play';meta.q='low';applyQuality();`);
  const B = st();
  secs(20, 33.3);
  const S = st();
  check('S5 mode manuel (Performance) : la qualite ne bouge pas toute seule',
    S.QL === B.QL && S.RES === B.RES, `avant ${B.QL}/${B.RES} -> apres ${S.QL}/${S.RES}`);
}

/* ================= S6 — qAuto persisté repart de la, mais peut remonter ================= */
{
  reset([1, .8]);                  /* ce que l'ancienne version laissait sur le disque */
  const B = st();
  secs(5, 16.7);
  secs(45, 16.7);
  const S = st();
  check('S6 une qualité apprise au plancher remonte si la machine le permet',
    B.QL === 1 && S.QL === 3 && S.RES === 1,
    `depart qAuto=${B.qa} -> QL/RES=${B.QL}/${B.RES} ; final ${S.QL}/${S.RES} (attendu 3/1)`);
}

/* ---------- verdict ---------- */
console.log(`test/qualite.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
