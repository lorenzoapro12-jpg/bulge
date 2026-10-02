'use strict';
/* =========================================================
   Socle commun des tests headless de BULGE : charge les VRAIS modules du jeu dans un DOM stubé
   (vm.createContext), avec une horloge virtuelle et un Math.random à graine. Aucune copie du code du jeu.

   const L = require('./lib');
   const H = L.mkGame({ ref });     // ref : commit git (facultatif) ; sinon l'arbre de travail
   H.start();                       // une partie neuve (même séquence que startGame, sans applyQuality/show)
   H.steps(600);                    // 600 pas de simulation, l'horloge avance de 1000/60 ms par pas
   H.call('G.isl')                  // évalue une expression DANS le realm du jeu

   L.ordre(ref) lit l'ordre des modules dans build.sh (de l'arbre ou du commit) : un test peut charger un
   ancien commit (--ref=) sans connaître sa liste de modules. L.startCode(ref) donne la séquence de début de
   partie propre à ce commit (avant la refonte en îlots, newRun prenait un profil et sept modules avaient leur
   RunStart).
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = process.env.BULGE_ROOT || path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const gitShow = (ref, f) => cp.execFileSync('git', ['show', ref + ':' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const readModule = (f, ref) => ref ? gitShow(ref, f) : fs.readFileSync(path.join(ROOT, f), 'utf8');
/* ordre figé des modules, lu dans build.sh (ORDER=(...) et WORKER=(...)) */
function ordre(ref) {
  const b = readModule('build.sh', ref), m = b.match(/^ORDER=\(([^)]*)\)/m), w = b.match(/^WORKER=\(([^)]*)\)/m);
  if (!m) throw new Error('build.sh' + (ref ? ' (' + ref + ')' : '') + ' : ORDER introuvable');
  return { order: m[1].trim().split(/\s+/), worker: w ? w[1].trim().split(/\s+/) : [] };
}
function startCode(ref) {
  return ordre(ref).order.includes('gs.js')
    ? 'newRun("bal",false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;'
    : 'newRun();inp.L=inp.R=null;';
}

/* ---------- stub canvas 2D : accepte tous les appels, renvoie des objets factices ---------- */
function mkCtx() {
  const grad = { addColorStop() {} };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => ({}),
    measureText: (s) => ({ width: (s || '').length * 7 }),
  };
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => (t[p] = v, true) });
}
function mkStyle() {
  const s = {};
  Object.defineProperties(s, {
    setProperty: { value: (k, v) => { s[k] = String(v); } },
    removeProperty: { value: (k) => { const v = s[k]; delete s[k]; return v || ''; } },
    getPropertyValue: { value: (k) => (s[k] || '') },
  });
  return s;
}
function mkClassList() {
  const set = new Set();
  return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; },
    contains: (c) => set.has(c), toString: () => [...set].join(' ') };
}
function mkListeners() { const L = {}; return { add: (t, fn) => (L[t] = L[t] || []).push(fn), fire: (t, e) => (L[t] || []).forEach(fn => fn(e)), has: (t) => !!(L[t] && L[t].length) }; }

/* ---------- une instance du jeu ----------
   opts : ref (commit), w/h (taille du canvas principal, 800×600 par défaut), dpr, storage (objet clé → texte du
   localStorage, pour simuler une vieille sauvegarde), mkCtx (contexte 2D de remplacement), sandbox (globales en plus) */
function mkGame(opts = {}) {
  const REF = opts.ref || null, W0 = opts.w || 800, H0 = opts.h || 600;
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
  const ctxF = opts.mkCtx || mkCtx;
  const doc = { activeElement: null };
  function mkEl(id, tag) {
    const L = mkListeners(), attrs = {};
    const el = {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {},
      hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '',
      offsetWidth: 0, offsetHeight: 0, parentElement: null,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: W0, bottom: H0, width: W0, height: H0, x: 0, y: 0 }),
      setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
      closest: () => null, focus: () => { doc.activeElement = el; }, blur() {},
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener: (t, fn) => L.add(t, fn), removeEventListener() {}, _fire: L.fire, _has: L.has,
      after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {},
    };
    return el;
  }
  function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; el.getContext = () => ctxF(el); return el; }
  const stash = new Map();
  Object.assign(doc, {
    hidden: false,
    getElementById(id) {
      if (!stash.has(id)) {
        const el = id === 'cv' ? mkCanvasEl(W0, H0, id) : mkEl(id);
        if (id === 'cv') el.parentElement = mkEl('stage');
        stash.set(id, el);
      }
      return stash.get(id);
    },
    createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)),
    querySelectorAll: () => [], querySelector: () => null,
    body: mkEl('body', 'body'),
  });
  const DOCL = mkListeners(); doc.addEventListener = DOCL.add; doc._fire = DOCL.fire;
  const WINL = mkListeners();
  const store = Object.assign({}, opts.storage || {});
  const win = { __SIM: true, devicePixelRatio: opts.dpr || 1, innerWidth: W0, innerHeight: H0, requestAnimationFrame: () => 0, addEventListener: WINL.add, removeEventListener() {}, _fire: WINL.fire };
  const sandbox = Object.assign({
    window: win, document: doc, console,
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
    setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; },
    clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
    setInterval: () => 0, clearInterval() {},
    getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }),
    addEventListener: WINL.add, removeEventListener() {},
  }, opts.sandbox || {});
  sandbox.globalThis = sandbox;
  const order = ordre(REF).order;
  const code = order.map(f => readModule(f, REF)).join('\n');
  const ctx = vm.createContext(sandbox);
  const call = (e) => vm.runInContext(e, ctx);
  /* Math.random à graine (le jeu l'utilise pour la graine des îlots et les effets) : parties reproductibles */
  call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
  if (opts.seed != null) call('Math.__seed(' + (opts.seed >>> 0) + ')');
  vm.runInContext(code, ctx, { filename: 'game.js' });
  const STEP = call('(function(){step();})');
  const H = {
    ref: REF, order, code, ctx, call, win, doc, stash, store, timers: TIMERS, advance,
    clock: () => CLOCK,
    STEP,
    /* n pas ; stop() vrai arrête plus tôt (renvoie le nombre de pas faits) */
    steps(n, stop) { for (let i = 0; i < n; i++) { STEP(); advance(1000 / 60); if (stop && stop()) return i + 1; } return n; },
    start() { call(startCode(REF)); },
    /* boot() n'est pas appelé en mode simulation (g4.js) : l'appeler enregistre les vrais écouteurs */
    boot() { call('boot()'); },
    /* évalue hors mode simulation (vrais écrans : renderPick, showEnd…) */
    noSim(expr) { win.__SIM = false; try { return call(expr); } finally { win.__SIM = true; } },
    /* une touche au clavier par le vrai onKey ; renvoie le nombre de preventDefault */
    key(code, extra) { let pd = 0; call('onKey')(Object.assign({ code, repeat: false, preventDefault() { pd++; } }, extra)); return pd; },
    ai(god) { call(AI); call('window.__SIM_GOD=' + (god ? 1 : 0)); },
  };
  return H;
}

/* ---------- IA de test, écrite DANS le realm du jeu ----------
   Un joueur prudent : esquive les tirs (en anticipant leur trajectoire) et les zones annoncées (traits, bandes,
   arcs), garde ses distances avec ce qui n'est pas une proie, avale les proies, ramasse les power-ups, va
   chercher ce qu'il ne voit pas (le tir automatique ne vise que l'écran), dash quand deux tirs le serrent,
   gonfle quand la jauge est pleine et la foule dense. __SIM_GOD : membrane et invulnérabilité entretenues
   (couverture du déroulé complet, pas de l'équilibrage). __SIM_BOOST : dégâts ×n. */
const AI = `
window.__SIM_GOD = 0; window.__SIM_BOOST = 0;
window.__SIM_INPUT = function(){
  const P = G.p; if (!P || P.dead) return;
  if (window.__SIM_GOD) { P.inv = Math.max(P.inv, 3); if (P.seg < P.segMax) P.seg = P.segMax; }
  if (window.__SIM_BOOST && P.__bst !== G.isl) { P.__bst = G.isl; P.dmg *= window.__SIM_BOOST; }
  let vx = 0, vy = 0;
  for (const b of G.eb) { const px = b.x + b.vx * 10, py = b.y + b.vy * 10, dx = P.x - px, dy = P.y - py, d = Math.hypot(dx, dy) || 1; if (d < 170) { const w = (170 - d) / 170; vx += dx / d * w * 3; vy += dy / d * w * 3; } }
  for (const q of G.tele) { if (q.ty === 'beam' || q.ty === 'path') { const ux = Math.cos(q.a), uy = Math.sin(q.a), px = P.x - q.x, py = P.y - q.y, s = px * ux + py * uy; if (s < -40) continue; const n = -px * uy + py * ux, w = (q.w || 30) / 2 + P.r + 50; if (Math.abs(n) < w) { const sg = n >= 0 ? 1 : -1; vx += -uy * sg * 4; vy += ux * sg * 4; } }
    else if (q.ty === 'arc') { const dx = P.x - q.x, dy = P.y - q.y, d = Math.hypot(dx, dy) || 1; if (d < q.r) { vx -= dy / d * 2; vy += dx / d * 2; } } }
  let tgt = null, td = 1e18;
  for (const e of G.en) { if (e.dead || e.spawn > 0) continue; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.prey || (P.gon > 0 && e.r < P.r)) { if (d < td) { td = d; tgt = e; } continue; }
    const R = e.r + P.r + 150; if (d < R) { vx += dx / d * (R - d) / R * 2.5; vy += dy / d * (R - d) / R * 2.5; } }
  const B = G.boss; if (B && !B.dead && B.spawn <= 0) { const dx = P.x - B.x, dy = P.y - B.y, d = Math.hypot(dx, dy) || 1, R = B.r + 220; if (d < R) { vx += dx / d * (R - d) / R * 3; vy += dy / d * (R - d) / R * 3; } else if (d > viewR() + B.r * .4 - 30) { vx -= dx / d * .9; vy -= dy / d * .9; } }
  else { let ne = null, nd = 1e18; for (const e of G.en) { if (e.dead || e.prey || e.spawn > 0) continue; const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; if (d < nd) { nd = d; ne = e; } } if (ne && nd > (viewR() - 40) ** 2) { const d = Math.sqrt(nd); vx += (ne.x - P.x) / d * .7; vy += (ne.y - P.y) / d * .7; } }
  for (const q of G.pus) { const d = Math.hypot(q.x - P.x, q.y - P.y) * .6; if (d < td) { td = d; tgt = q; } }
  if (tgt) { const dx = tgt.x - P.x, dy = tgt.y - P.y, d = Math.hypot(dx, dy) || 1; vx += dx / d * .9; vy += dy / d * .9; }
  const r = Math.hypot(P.x, P.y) || 1; if (r > PR - 260) { vx -= P.x / r * (r - PR + 260) / 90; vy -= P.y / r * (r - PR + 260) / 90; }
  vx += -P.y / r * .25; vy += P.x / r * .25;
  const l = Math.hypot(vx, vy); G.inX = l > .05 ? vx / l : 0; G.inY = l > .05 ? vy / l : 0; G.aimMan = false;
  let near = 0; for (const b of G.eb) if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < 60 * 60) near++;
  if (near >= 2 && P.dashT <= 0) tryDash();
  if (P.gauge >= 1 && (G.en.filter(e => !e.dead && !e.prey).length >= 4 || G.boss && !G.boss.dead)) tryGonfle();
};`;

module.exports = { ROOT, ARG, readModule, ordre, startCode, mkGame, mkCtx, AI };
