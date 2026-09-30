'use strict';
/* =========================================================
   Test headless de BULGE — exécute la VRAIE logique de jeu
   Utilise le mode simulation intégré au jeu (window.__SIM).
   Aucune modification du code du jeu : on ne fait que
   l'instancier dans un DOM stubé et le faire tourner.

   node test/headless.js                  parties complètes + scénarios de régression
   node test/headless.js --scenarios      scénarios de régression seulement (rapide)
   node test/headless.js --ref=HEAD       charge les modules depuis git (ex. état d'origine),
                                          sans rien écrire sur le disque
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), ONLY_SCN = !!ARG('scenarios');
/* ordre figé, identique à build.sh */
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- horloge virtuelle : setTimeout avance avec les pas de simulation ---------- */
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
/* ---------- stub DOM : style (setProperty…), classList (contains…), dataset, écouteurs enregistrés ---------- */
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
    contains: (c) => set.has(c) };
}
function mkListeners() { const L = {}; return { add: (t, fn) => (L[t] = L[t] || []).push(fn), fire: (t, e) => (L[t] || []).forEach(fn => fn(e)), has: (t) => !!(L[t] && L[t].length) }; }
const doc = { activeElement: null };
function mkEl(id, tag) {
  const L = mkListeners(), attrs = {};
  const el = {
    id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {},
    hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '',
    offsetWidth: 0, offsetHeight: 0, parentElement: null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }),
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    closest: () => null, focus: () => { doc.activeElement = el; }, blur() {},
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, fn) => L.add(t, fn), removeEventListener() {}, _fire: L.fire, _has: L.has,
    after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {},
  };
  return el;
}
function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; el.getContext = () => mkCtx(); return el; }
const stash = new Map();
Object.assign(doc, {
  hidden: false,
  getElementById(id) {
    if (!stash.has(id)) {
      const el = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvasEl(800, 600, id) : mkEl(id);
      if (id === 'cv') el.parentElement = mkEl('stage');
      stash.set(id, el);
    }
    return stash.get(id);
  },
  createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)),
  querySelectorAll: () => [], querySelector: () => null,
  body: mkEl('body', 'body'),
});
const DOCL = mkListeners(); doc.addEventListener = DOCL.add;
const WINL = mkListeners();
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener: WINL.add, removeEventListener() {} };
const sandbox = {
  window: win, document: doc, console,
  matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {} },
  performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
  setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; },
  clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
  setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }),
  addEventListener: WINL.add, removeEventListener() {},
};
sandbox.globalThis = sandbox;

/* ---------- chargement (même ordre que le build) ---------- */
const code = ORDER.map(readModule).join('\n');
const ctx = vm.createContext(sandbox);
const call = (e) => vm.runInContext(e, ctx);
/* Math.random à graine (le jeu l'utilise pour la graine du monde et les effets) : parties reproductibles */
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInContext(code, ctx, { filename: 'game.js' });
console.log('[ok] jeu chargé : ' + ORDER.length + ' modules' + (REF ? ' (git ' + REF + ')' : '') + ', ' + code.length + ' octets de JS exécutés sans exception');
console.log('[ok] SIMF() = ' + call('SIMF()'));
const STEP = call('(function(){step();})');
function steps(n, stop) { for (let i = 0; i < n; i++) { STEP(); advance(1000 / 60); if (stop && stop()) return i + 1; } return n; }
/* même séquence que startGame (g4.js), sans shipOK/storyGate/show : voulu pour les tests */
function start(prof, daily) {
  call(`newRun(${JSON.stringify(prof)},${daily ? 'true' : 'false'});gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;`);
}
const noSim = (expr) => { win.__SIM = false; try { return call(expr); } finally { win.__SIM = true; } };
const key = (code, extra) => { let pd = 0; call('onKey')(Object.assign({ code, repeat: false, preventDefault() { pd++; } }, extra)); return pd; };

/* ---------- IA de test, écrite DANS le realm du jeu ---------- */
const AI = `
/* navigation : BFS sur la grille des falaises (cellules WC=64), cellules encombrées par un obstacle évitées ;
   chemin recalculé toutes les 30 images ; renvoie le point de passage à viser */
var __NAV = { t: -1e9, key: '', path: null, wd: null, obs: null };
function navBfs(si, sj, ti, tj, useObs) {
  const N = NG, prev = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N), s = sj * N + si, t = tj * N + ti;
  const C = __NAV.obs;
  const blocked = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N || wallAt(i, j)) return true;
    if (!useObs || (i === ti && j === tj)) return false;
    const k = j * N + i; if (!C[k]) C[k] = pointHit(G0 + (i + .5) * WC, G0 + (j + .5) * WC, 26) ? 2 : 1;
    return C[k] === 2;
  };
  let h = 0, e = 0; q[e++] = s; prev[s] = s;
  while (h < e) { const k = q[h++]; if (k === t) break; const i = k % N, j = (k / N) | 0;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni = i + di, nj = j + dj, nk = nj * N + ni; if (ni < 0 || nj < 0 || ni >= N || nj >= N || prev[nk] >= 0 || blocked(ni, nj)) continue; prev[nk] = k; q[e++] = nk; } }
  if (prev[t] < 0) return null;
  const path = []; for (let k = t; k !== s; k = prev[k]) path.push(k); path.push(s); return path.reverse();
}
function navTo(P, tx, ty) {
  const N = NG, ci = v => Math.floor((v - G0) / WC), si = ci(P.x), sj = ci(P.y), ti = ci(tx), tj = ci(ty);
  if (Math.hypot(tx - P.x, ty - P.y) < 260) return [tx, ty];
  if (__NAV.wd !== WD) { __NAV.wd = WD; __NAV.obs = new Uint8Array(N * N); __NAV.path = null; }
  const key = ti + ',' + tj;
  if (!__NAV.path || __NAV.key !== key || G.t - __NAV.t > 30) { __NAV.t = G.t; __NAV.key = key; __NAV.path = navBfs(si, sj, ti, tj, true) || navBfs(si, sj, ti, tj, false); }
  const p = __NAV.path; if (!p || p.length < 2) return [tx, ty];
  let b = 0, bd = 1e18; for (let k = 0; k < Math.min(p.length, 12); k++) { const x = G0 + (p[k] % N + .5) * WC, y = G0 + (((p[k] / N) | 0) + .5) * WC, d = (x - P.x) ** 2 + (y - P.y) ** 2; if (d < bd) { bd = d; b = k; } }
  const w = p[Math.min(p.length - 1, b + 2)]; return [G0 + (w % N + .5) * WC, G0 + (((w / N) | 0) + .5) * WC];
}
window.__SIM_BOOST = 0;
window.__SIM_TELEPORT = 0;
window.__SIM_INPUT = function(){
  const P = G.p; if (!P || P.dead) return;
  if (window.__SIM_BOOST && !P.__boosted) { P.__boosted = 1; P.dmg *= 6; P.fireI *= .5; P.armor *= .05; P.bub = 40; P.base = 40; }
  let vx = 0, vy = 0;
  // 1) fuite des projectiles ennemis (avec anticipation de leur trajectoire)
  const R = 260;
  for (const b of G.eb) {
    const px = b.x + (b.vx || 0) * 8, py = b.y + (b.vy || 0) * 8;
    const dx = P.x - px, dy = P.y - py, d2 = dx*dx + dy*dy;
    if (d2 > R*R) continue;
    const d = Math.sqrt(d2) || .01, w = (R - d) / R;
    vx += dx/d * w * 3.4; vy += dy/d * w * 3.4;
  }
  // 2) fuite des corps-à-corps (épines, mites)
  for (const e of G.en) {
    if (e.spawn > 0) continue;
    const dx = P.x - e.x, dy = P.y - e.y, d2 = dx*dx + dy*dy, r = e.r + P.r + 60;
    if (d2 > r*r) continue;
    const d = Math.sqrt(d2) || .01, w = (r - d) / r;
    vx += dx/d * w * 2.0; vy += dy/d * w * 2.0;
  }
  // 3) direction de l'objectif (cœur de zone / Hypernoyau) — seulement si assez costaud.
  //    Le monde a des falaises (WD.wall) et des obstacles : on suit un chemin BFS sur la grille des falaises
  //    au lieu d'une ligne droite (sinon l'IA reste plaquée contre une falaise, cf. passe de clôture).
  const o = objective();
  const ready = P.lvl >= 4 || P.bub > 1.6 * P.base;
  if (o && ready) { const q = navTo(P, o.x, o.y), dx = q[0] - P.x, dy = q[1] - P.y, d = Math.hypot(dx, dy) || 1, dO = Math.hypot(o.x - P.x, o.y - P.y); const w = dO > 300 ? 1 : .25; vx += dx/d*w; vy += dy/d*w; }
  // 3b) sinon : recul pour ne pas déclencher l'arène d'un cœur trop tôt
  else if (G.hearts) { for (const h of G.hearts) { if (h.state !== 'dormant') continue; const dx = P.x - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy) || 1; if (d < 700) { vx += dx/d*3; vy += dy/d*3; } } }
  // 4) collecte des bulles proches (les bulles = PV, ressource vitale)
  let bx = 0, by = 0;
  for (const k of G.pk) { const dx = k.x - P.x, dy = k.y - P.y, d2 = dx*dx + dy*dy; if (d2 < 760*760) { const d = Math.sqrt(d2) || 1; const w = 1.6 * (1 - d/760); bx += dx/d*w; by += dy/d*w; } }
  vx += bx; vy += by;
  // 5) mur extérieur
  const dc = Math.hypot(P.x, P.y) || 1;
  if (dc > WR - 320) { vx -= P.x/dc*2; vy -= P.y/dc*2; }
  const l = Math.hypot(vx, vy) || 1;
  G.inX = vx/l; G.inY = vy/l;
  // 6) dash réflexe si un tir est très proche
  if (P.dashT <= 0) { for (const b of G.eb) { if (dist2(b.x, b.y, P.x, P.y) < 95*95) { tryDash(); break; } } }
  // 6b) compétences et ultime dès qu'ils sont prêts, si un ennemi est à portée (comme un joueur ; fait aussi avancer le prologue)
  if (P.sk && G.en.some(e => !e.dead && e.spawn <= 0 && dist2(e.x, e.y, P.x, P.y) < 320*320)) { for (let i = 0; i < 2; i++) if (P.sk[i] && P.sk[i].cd <= 0) gcUse(i); if (P.ultC >= 100) gcUlt(); }
  // 7) téléportation de test vers le cœur (couverture du chemin boss)
  if (window.__SIM_TELEPORT && G.lair && G.lair.open && !G.boss && !G.arena) { P.x = WD.core.x; P.y = WD.core.y - 80; }
};`;
vm.runInContext(AI, ctx, { filename: 'ai-test.js' });
console.log('[ok] IA de test injectée dans le contexte du jeu');
/* boot() n'est pas appelé en mode simulation : on l'appelle pour enregistrer les vrais écouteurs (clavier, pointeur) */
call('boot()');
console.log('[ok] boot() exécuté : écouteurs enregistrés (pointercancel sur le canvas : ' + doc.getElementById('cv')._has('pointercancel') + ')');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail: detail || '' }); };

/* =========================================================
   PARTIES COMPLÈTES
   ========================================================= */
function playRun(name, prof, seed, maxSteps, opts = {}) {
  const res = { run: name, prof, ended: false, win: null, steps: 0, error: null };
  call(`Math.__seed(${seed})`);
  win.__SIM_PICK = (c) => c[Math.floor(call('Math.random()') * c.length)];
  win.__SIM_END = (w) => { res.ended = true; res.win = w; };
  win.__SIM_BOOST = opts.boost ? 1 : 0;
  win.__SIM_TELEPORT = opts.teleport ? 1 : 0;
  const t0 = Date.now();
  let n = 0;
  try { start(prof, opts.daily); for (; n < maxSteps && !res.ended; n++) { STEP(); advance(1000 / 60); } }
  catch (e) { res.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  const G = call('G');
  Object.assign(res, {
    steps: n, ms: Date.now() - t0, daily: G.daily,
    score: G.score, kills: G.kills, hearts: G.heartsDone, maxLvl: G.p.maxLvl,
    state: G.state, room: +G.room.toFixed(2), frames: G.time,
    evolutions: Object.values(G.p.evo).reduce((a, b) => a + b, 0), mutations: G.p.muts.length,
    bossPhase: G.boss ? G.boss.phase : null, bossDead: G.boss ? !!G.boss.dead : false, arenaKind: G.arena ? G.arena.kind : null,
    relicChoices: G.artChoices.length,
  });
  win.__SIM_END = null; win.__SIM_BOOST = 0; win.__SIM_TELEPORT = 0;
  console.log(JSON.stringify(res));
  return res;
}
if (!ONLY_SCN) {
  console.log('\n=== PARTIES COMPLÈTES ===');
  const r1 = playRun('run1-naturel', 'bal', 12345, 120000);
  const r2 = playRun('run2-assiste', 'bal', 999, 400000, { boost: true, teleport: true });
  const r3 = playRun('run3-defi-du-jour', 'bal', 424242, 60000, { daily: true });
  const r4 = playRun('run4-colosse', 'tank', 31337, 60000);
  const r5 = playRun('run5-eclaireur', 'scout', 2718, 60000);
  /* passe globale : la VICTOIRE en défi du jour n'était couverte nulle part (run3 : actif + kills>0 seulement).
     La graine du défi dépend de la date (g2.js newRun) : la date est FIGÉE au 27/09/2026 pour ce critère, sinon il
     dépendrait du jour d'exécution. Vérifié (test/trace.js --daily-days=10) : l'IA de test gagne 9 dates sur 10 ; au
     04/10/2026 elle reste coincée loin d'un cœur alors que le terrain est praticable (remplissage à 12 px avec pointHit,
     rayon 30 et 37 px : 3 cœurs et noyau atteignables). Ce n'est pas un défaut du jeu mais une limite de l'IA de test. */
  call('var __RealDate=Date;Date=class extends __RealDate{constructor(...a){if(a.length)super(...a);else super(2026,8,27,12);}static now(){return new __RealDate(2026,8,27,12).getTime();}}');
  let r6, m6, a6;
  try {
    m6 = JSON.parse(call('JSON.stringify({runs:meta.runs,wins:meta.wins,day:meta.daily[String(todayKey())]||0,lb:meta.lb.length})'));
    r6 = playRun('run6-defi-du-jour-victoire', 'bal', 777, 400000, { daily: true, boost: true, teleport: true });
    a6 = JSON.parse(call('JSON.stringify({runs:meta.runs,wins:meta.wins,day:meta.daily[String(G.dayKey)],ach:!!meta.ach.daily,xp:G.gi?G.gi.xp:null,lbd:meta.lb.some(e=>e.d===1&&e.w===1&&e.s===G.score),arts:ARTS_ON,dk:G.dayKey})'));
  } finally { call('Date=__RealDate'); }
  const rs = [r1, r2, r3, r4, r5, r6];
  check('parties : aucune exception', rs.every(r => !r.error), rs.filter(r => r.error).map(r => r.run + ': ' + r.error).join(' ; '));
  check('run1 : absorptions (kills>0)', r1.kills > 0, 'kills=' + r1.kills);
  check('run1 : progression de niveau (maxLvl>2)', r1.maxLvl > 2, 'maxLvl=' + r1.maxLvl);
  check('run1 : au moins 1 cœur de zone détruit', r1.hearts >= 1, 'coeurs=' + r1.hearts);
  check('run1 : évolutions accordées', r1.evolutions > 0, 'evolutions=' + r1.evolutions);
  check('run2 : arène de boss atteinte', r2.bossPhase !== null || r2.arenaKind === 'boss' || r2.bossDead);
  check('run2 : 3 cœurs détruits', r2.hearts >= 3, 'coeurs=' + r2.hearts);
  check('run2 : VICTOIRE sur l Hypernoyau (__SIM_END(true))', r2.ended && r2.win === true);
  check('run2 : reliques proposées en fin de partie', r2.relicChoices > 0, 'reliques=' + r2.relicChoices);
  check('run3 : défi du jour actif', r3.daily === true && r3.kills > 0, 'daily=' + r3.daily + ' kills=' + r3.kills);
  check('run4 : profil Colosse jouable', r4.kills > 0, 'kills=' + r4.kills);
  check('run5 : profil Éclaireur jouable', r5.kills > 0, 'kills=' + r5.kills);
  check('run6 : VICTOIRE en défi du jour (__SIM_END(true), 3 cœurs, reliques inactives)', r6.ended && r6.win === true && r6.daily === true && r6.hearts >= 3 && a6.arts === false,
    'jour=' + a6.dk + ' daily=' + r6.daily + ' fin=' + r6.ended + ' victoire=' + r6.win + ' coeurs=' + r6.hearts + ' pas=' + r6.steps + ' reliques actives=' + a6.arts);
  check('run6 : règles du défi à la victoire (aucune relique proposée, cycle et victoires non comptés, 0 XP, record du jour, succès Rituel, classement)',
    r6.relicChoices === 0 && a6.runs === m6.runs && a6.wins === m6.wins && a6.xp === 0 && a6.day === Math.max(m6.day, r6.score) && a6.ach && a6.lbd,
    'reliques=' + r6.relicChoices + ' cycles ' + m6.runs + '→' + a6.runs + ' victoires ' + m6.wins + '→' + a6.wins + ' xp=' + a6.xp + ' record du jour ' + m6.day + '→' + a6.day + ' (score ' + r6.score + ') Rituel=' + a6.ach + ' classement=' + a6.lbd);
}

/* =========================================================
   SCÉNARIOS DE RÉGRESSION : un par défaut de l'audit
   Chacun échoue sur le code d'origine (--ref=HEAD) et passe après correction.
   ========================================================= */
function scenario(name, fn) {
  let r;
  try { call('Math.__seed(4242)'); win.__SIM_PICK = (c) => c[0]; r = fn(); }
  catch (e) { r = { ok: false, detail: 'exception : ' + String(e && e.message || e) }; }
  finally { win.__SIM = true; }
  check(name, r.ok, r.detail);
}
console.log('\n=== SCÉNARIOS DE RÉGRESSION ===');

/* n°1 — gt.js:64 : pas d'assertion arrière (Safari < 16.4 rejette tout le script) ; découpe identique */
scenario('n°1 tip() : aucune assertion arrière, 1re phrase identique à la découpe d origine', () => {
  const bad = ORDER.filter(f => /\(\?<[=!]/.test(readModule(f)));
  start('bal', false);
  const ids = call('Object.keys(TIPS)'), diffs = [];
  for (const id of ids) {
    const want = call('TIPS')[id].split(/(?<=[.!])\s/)[0];   /* référence : l'expression d'origine, évaluée par V8 */
    call(`meta.tips={};G.gs.subs=[];tip(${JSON.stringify(id)})`);
    const got = call('G.gs.subs.length?G.gs.subs[G.gs.subs.length-1].s:null');
    if (got !== want) diffs.push(id);
  }
  return { ok: !bad.length && !diffs.length, detail: 'modules avec (?<= : [' + bad.join(',') + '] ; astuces divergentes : [' + diffs.join(',') + '] sur ' + ids.length };
});

/* n°2 — gx.js:179 : propriété du duel, touches 1 à 9, sans 2e compétence.
   (1) si l'énergie baisse, un effet observable doit avoir changé ; (2) une touche au-delà des boutons
   affichés ne change rien ; (3) l'énergie affichée suit l'énergie réelle. */
scenario('n°2 duel : touche qui débite ⇒ effet observable ; touche hors boutons ⇒ rien ; écran synchrone', () => {
  const obs = () => call('JSON.stringify({f:DU.foes.map(f=>[f.hp,f.sh,f.rev,f.frozen||0,f.grouped||0,JSON.stringify(f.st)]),me:[DU.me.hp,DU.me.sh,DU.me.crit,DU.me.bonus,DU.me.evade,DU.me.drones,DU.me.ult,DU.me.cd.join()],log:DU.log.join("|")})');
  const bad = [], seen = [];
  let nBtn = 0, effective = 0;
  for (let k = 1; k <= 9; k++) {
    start('bal', false);
    if (!call('WD.hunt.length')) return { ok: false, detail: 'aucun chasseur généré' };
    call('duelStart(0)');
    if (call('G.p.sk[1]') !== null) return { ok: false, detail: 'P.sk[1] non nul' };
    nBtn = (call("$('dvAct').innerHTML").match(/class="dact"/g) || []).length;
    const en0 = call('DU.me.en'), o0 = obs();
    key('Digit' + k);
    const en1 = call('DU.me.en'), o1 = obs(), pips = (call("$('dvMe').innerHTML").match(/class="on"/g) || []).length;
    call('duelFlee()');
    seen.push(k + ':' + en0 + '→' + en1 + (o1 !== o0 ? '+effet' : ''));
    if (en1 < en0 && o1 === o0) bad.push('touche ' + k + ' débite sans effet');
    if (en1 < en0 && o1 !== o0) effective++;
    if (k > nBtn && (en1 !== en0 || o1 !== o0)) bad.push('touche ' + k + ' agit au-delà des ' + nBtn + ' boutons');
    if (pips !== en1) bad.push('touche ' + k + ' : écran ' + pips + ' pastilles pour ' + en1 + ' d énergie');
  }
  if (!effective) bad.push('aucune touche n a eu d effet (test vide)');
  return { ok: !bad.length, detail: nBtn + ' boutons ; ' + seen.join(' ') + (bad.length ? ' ; ÉCHECS : ' + bad.join(', ') : '') };
});

/* n°3 — g4.js:53/104 : R ne relance pas les dons d'un autel (même avec G.evoMut périmé) ; relance normale intacte */
scenario('n°3 autel : R ne remplace pas les dons ni ne consomme de relance', () => {
  start('bal', false);
  call('G.p.rerolls=2;G.evoMut=true');             /* evoMut périmé : dernière évolution = mutation */
  noSim('openAltar(-1)');
  const before = call('G.choices.map(c=>c.u.id).join(",")');
  key('KeyR');
  const after = call('G.choices.map(c=>c.u.id).join(",")'), rr = call('G.p.rerolls'), st = call('G.state');
  call('pickEvo(0)');
  /* contrôle : la relance d'une évolution de niveau fonctionne toujours */
  call('G.pendingEvo=[2]'); noSim('openEvo()'); key('KeyR'); const rr2 = call('G.p.rerolls'); call('pickEvo(0)');
  return { ok: st === 'evo' && before === after && rr === 2 && rr2 === 1,
    detail: 'dons [' + before + '] → [' + after + '], relances 2→' + rr + ', état=' + st + ' ; relance de niveau 2→' + rr2 };
});

/* n°4 — gc.js:93 : une évolution prise pendant l'ultime survit à sa fin */
scenario('n°4 ultimes : évolutions prises pendant Hypervitesse / Faille temporelle conservées', () => {
  start('scout', false);
  call('G.p.inv=1e9');
  const f0 = call('G.p.fireI'), s0 = call('G.p.spd');
  call('G.p.ultC=100;gcUlt();applyChoice({mut:false,u:UPG.find(u=>u.id==="rapid")});applyChoice({mut:false,u:UPG.find(u=>u.id==="speed")});G.p.ultA.t=1');
  steps(1);
  const f1 = call('G.p.fireI'), s1 = call('G.p.spd'), endS = call('G.p.ultA===null');
  start('spectre', false);
  call('G.p.inv=1e9');
  const c0 = call('G.p.crit');
  call('G.p.ultC=100;gcUlt();applyChoice({mut:false,u:UPG.find(u=>u.id==="crit")});G.p.ultA.t=1');
  steps(1);
  const c1 = call('G.p.crit'), endC = call('G.p.ultA===null');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  return { ok: endS && endC && near(f1, f0 / 1.25) && near(s1, s0 * 1.12) && near(c1, c0 + .1),
    detail: 'éclaireur cadence ' + f0.toFixed(3) + '→' + f1.toFixed(3) + ' (attendu ' + (f0 / 1.25).toFixed(3) + '), vitesse ' + s0.toFixed(3) + '→' + s1.toFixed(3) + ' (attendu ' + (s0 * 1.12).toFixed(3) + ') ; spectre crit ' + c0.toFixed(3) + '→' + c1.toFixed(3) + ' (attendu ' + (c0 + .1).toFixed(3) + ')' };
});

/* n°5 — gc.js:146 : le don de faille n'est pas perdu si le jeu est en pause au moment prévu */
function riftSeal(pauseMs) {
  start('bal', false);
  if (!call('WD.rifts.length')) return null;
  call('{const f=WD.rifts[0],P=G.p;P.x=P.px=f.x;P.y=P.py=f.y;P.inv=1e9;G.gc.dorm=false;G.gc.rift={x:f.x,y:f.y,r:430,t:1199,dur:1200,i:0};}');
  steps(1);
  const sealed = call('!!G.gc.riftDone[0]');
  if (pauseMs) { call('togglePause()'); advance(pauseMs); call('togglePause()'); }
  steps(90);
  return { sealed, sk1: call('G.p.sk[1]&&G.p.sk[1].id') };
}
scenario('n°5 faille : don d autel reçu même après une pause juste après le scellement', () => {
  const a = riftSeal(0), b = riftSeal(2000);
  if (!a) return { ok: false, detail: 'aucune faille générée' };
  return { ok: a.sealed && b.sealed && !!a.sk1 && !!b.sk1,
    detail: 'sans pause : scellée=' + a.sealed + ' don=' + a.sk1 + ' ; pause 2 s : scellée=' + b.sealed + ' don=' + b.sk1 };
});

/* n°6 — g4.js:48/208 : Espace n'active pas le bouton focalisé de l'écran d'évolution (NON REPRODUIT EN HEADLESS :
   l'activation d'un bouton par Espace est un comportement du navigateur ; on vérifie que preventDefault est appelé) */
scenario('n°6 évolution : Espace neutralisé (keydown ET keyup) — assertion, clic navigateur non reproduit', () => {
  start('bal', false);
  call('G.pendingEvo=[2]'); noSim('openEvo()');
  const st = call('G.state'), pdDown = key('Space');
  let pdUp = 0; WINL.fire('keyup', { code: 'Space', preventDefault() { pdUp++; } });
  const still = call('G.state');
  call('pickEvo(0)');
  const pdPlay = key('Space');   /* contrôle : en jeu, Espace reste le dash (et reste bloqué pour le défilement) */
  return { ok: st === 'evo' && still === 'evo' && pdDown > 0 && pdUp > 0 && pdPlay > 0,
    detail: 'état=' + st + ', preventDefault keydown=' + pdDown + ' keyup=' + pdUp + ', en jeu=' + pdPlay };
});

/* n°7 — g4.js:53 : touche 3 choisit le 3e don d'autel */
scenario('n°7 autel : la touche 3 choisit le 3e don', () => {
  start('bal', false);
  noSim('openAltar(-1)');
  const n = call('G.choices.length'), third = call('G.choices[2]&&G.choices[2].u.id'), pgc = call('G.choices[3]&&G.choices[3].u.id'), l0 = call('G.p.sk[0].l');
  key('Digit3');
  const st = call('G.state'), l1 = call('G.p.sk[0].l');
  if (st !== 'play') call('pickEvo(0)');
  /* Depuis le 29/09/2026 l'autel affiche 4 cartes : les 3 CHOIX, plus la carte « Autres
     compétences » — les 6 a 8 competences nouvelles sont PAGINEES, sinon elles ne tiennent pas sur
     un ecran de 411 px (mesure : test/choix-ecran.js, chromium, 4 cartes = 700 px pour 700 px
     visibles). Ce que ce test defend n'a pas bouge : la touche 3 prend la 3e carte, et cette 3e
     carte est l'AMELIORATION de la competence du joueur (niveau 1 -> 2). Une regression qui
     remplacerait la 3e carte par une competence nouvelle echoue donc toujours ici. */
  return { ok: n === 4 && pgc === 'alt_page' && st === 'play' && third === 'sk_' + call('G.p.sk[0].id') && l1 === l0 + 1,
    detail: n + ' cartes dont la 4e=' + pgc + ', 3e=' + third + ', état après touche 3=' + st + ', niveau compétence ' + l0 + '→' + l1 };
});

/* n°8 — gx.js:157 : l'ultime Spectre (crit=1) ne rend pas tous les coups du duel critiques */
scenario('n°8 duel : Faille temporelle ne rend pas 100 % des coups critiques', () => {
  start('spectre', false);
  call('G.p.inv=1e9;G.p.ultC=100;gcUlt();duelStart(0);DU.foes[0].hp=DU.foes[0].mhp=1e12');
  const base = call('G.p.bCrit');
  let n = 0; const N = 400;
  for (let i = 0; i < N; i++) { call('DU.foes[0].fl=null;DU.me.crit=0;dHit(DU.foes[0],.001,true,true)'); if (call('DU.foes[0].fl') === 'Critique') n++; }
  call('duelFlee()');
  return { ok: n < N * .5, detail: n + '/' + N + ' coups critiques (chance hors ultime ' + base.toFixed(2) + ')' };
});

/* n°9 — gx.js:27-28 : placement des souvenirs/chasseurs indépendant de l'algorithme de tri du moteur */
scenario('n°9 défi du jour : souvenirs et chasseurs identiques avec un autre algorithme de tri', () => {
  const snap = () => call('JSON.stringify({scn:WD.scn.map(s=>[s.t,Math.round(s.x),Math.round(s.y)]),hunt:WD.hunt.map(h=>[h.n,h.a,Math.round(h.hx),Math.round(h.hy)])})');
  const ctl = () => call('JSON.stringify({h:WD.hearts,a:WD.alts,r:WD.rifts,l:WD.lms.length})');
  /* tri fusion stable : même résultat que V8 pour tout comparateur cohérent, autre séquence d'appels */
  call(`var __nativeSort=Array.prototype.sort,__mergeSort=function(cmp){cmp=cmp||((a,b)=>{a=String(a);b=String(b);return a<b?-1:a>b?1:0;});
    const ms=a=>{if(a.length<2)return a;const m=a.length>>1,l=ms(a.slice(0,m)),r=ms(a.slice(m)),o=[];let i=0,j=0;
      while(i<l.length&&j<r.length)o.push(cmp(r[j],l[i])<0?r[j++]:l[i++]);while(i<l.length)o.push(l[i++]);while(j<r.length)o.push(r[j++]);return o;};
    const s=ms(Array.from(this));for(let k=0;k<s.length;k++)this[k]=s[k];return this;};`);
  const diff = [], ctlDiff = [];
  for (const seed of [20260927, 7, 123456789, 424242, 99]) {
    call(`genWorld(${seed})`); const a = snap(), ca = ctl();
    call('Array.prototype.sort=__mergeSort'); try { call(`genWorld(${seed})`); } finally { call('Array.prototype.sort=__nativeSort'); }
    const b = snap(), cb = ctl();
    if (a !== b) diff.push(seed); if (ca !== cb) ctlDiff.push(seed);
  }
  call('WD.used=true');
  /* mêmes sites de la famille : missions du jour (gs.js:80) et dons d'autel (gc.js:154), même graine, deux tris */
  start('bal', false);
  const mis = () => call('meta.mis=null;misToday().list.map(m=>m.id+":"+m.n).join(",")');
  const alt = () => call('G.p.sk[1]=null;srand(77);openAltar(-1);G.choices.map(c=>c.u.id).join(",")');
  const m1 = mis(), a1 = alt();
  call('Array.prototype.sort=__mergeSort'); let m2, a2; try { m2 = mis(); a2 = alt(); } finally { call('Array.prototype.sort=__nativeSort'); }
  const other = (m1 !== m2 ? ['missions [' + m1 + '] vs [' + m2 + ']'] : []).concat(a1 !== a2 ? ['autel [' + a1 + '] vs [' + a2 + ']'] : []);
  return { ok: !diff.length && !ctlDiff.length && !other.length, detail: 'graines divergentes (souvenirs/chasseurs) : [' + diff.join(',') + '] ; témoin cœurs/autels/failles divergents : [' + ctlDiff.join(',') + '] ; missions/autel divergents : [' + other.join(' ; ') + ']' };
});

/* n°10 — gt.js:51 : le défi du jour a failles et chasseurs même pour un profil neuf */
scenario('n°10 défi du jour : failles et chasseurs actifs pour un profil neuf', () => {
  const runs = call('meta.runs');
  call('meta.runs=0'); start('bal', true);
  const dG = call('G.gc.dorm'), dX = call('G.gx.dorm');
  start('bal', false);
  const nG = call('G.gc.dorm'), nX = call('G.gx.dorm');
  call('meta.runs=' + runs);
  return { ok: dG === false && dX === false && nG === true && nX === true,
    detail: 'défi : dorm failles=' + dG + ' chasseurs=' + dX + ' ; 1er cycle normal (témoin) : ' + nG + '/' + nX };
});

/* n°11 — g4.js:205 : pointercancel sur le bouton d'ultime ne déclenche rien ; pointerup déclenche */
scenario('n°11 tactile : pointercancel ne lance pas l ultime, pointerup oui', () => {
  const cv = doc.getElementById('cv');
  const touch = (type, id) => { const S = call('(()=>{inp.touch=true;return gcSlots()[2];})()'); cv._fire(type, { type, pointerType: 'touch', pointerId: id, clientX: S.x, clientY: S.y, button: 0, preventDefault() {} }); };
  start('bal', false);
  call('G.p.ultC=100');
  touch('pointerdown', 7); const held = call('inp.B&&inp.B.b');
  touch('pointercancel', 7);
  const afterCancel = { ultC: call('G.p.ultC'), ultA: call('!!G.p.ultA'), B: call('inp.B') };
  touch('pointerdown', 8); touch('pointerup', 8);
  const afterUp = { ultC: call('G.p.ultC'), ultA: call('!!G.p.ultA') };
  call('inp.touch=false;inp.B=null');
  return { ok: held === 'ult' && afterCancel.ultC === 100 && !afterCancel.ultA && afterCancel.B === null && afterUp.ultA,
    detail: 'appui=' + held + ' ; après pointercancel ultC=' + afterCancel.ultC + ' ultime lancé=' + afterCancel.ultA + ' ; après pointerup ultime lancé=' + afterUp.ultA };
});

/* résiduel (famille « écran non rafraîchi ») — gi.js:273 : vider le nom du tank enregistre BULGE-01, le champ doit l'afficher */
scenario('résiduel hangar : nom vidé → le champ affiche le nom réellement enregistré', () => {
  const el = doc.getElementById('hgName'), old = call('meta.tank.name');
  el.value = ''; el.onchange({ target: el });
  const stored = call('meta.tank.name'), shown = el.value;
  call('meta.tank.name=' + JSON.stringify(old));
  return { ok: stored === shown, detail: 'enregistré=' + JSON.stringify(stored) + ' affiché=' + JSON.stringify(shown) };
});

/* résiduel (famille « débit sans effet ») — gx.js:171/265 : « Analyser » déjà sans effet (cible révélée ET critique armé)
   => bouton désactivé et aucun débit ; redevient disponible dès que le critique est consommé ou sur une cible non révélée */
scenario('résiduel duel : Analyser sans effet ⇒ bouton désactivé, aucun débit ; propriété débit ⇒ effet (hors journal)', () => {
  const st = () => call('JSON.stringify({f:DU.foes.map(f=>[f.hp,f.sh,f.rev,f.frozen||0,f.grouped||0,JSON.stringify(f.st)]),me:[DU.me.hp,DU.me.sh,DU.me.crit,DU.me.bonus,DU.me.evade,DU.me.drones,DU.me.ult,DU.me.cd.join()]})');
  const scanOff = () => /data-a="scan" disabled/.test(call("$('dvAct').innerHTML"));
  const bad = [], log = [];
  const act = (a, label) => { const e0 = call('DU.me.en'), s0 = st(); call('duelAct(' + JSON.stringify(a) + ')'); const e1 = call('DU.me.en'), s1 = st();
    log.push(label + ' ' + e0 + '→' + e1 + (s1 !== s0 ? '+effet' : ''));
    if (e1 < e0 && s1 === s0) bad.push(label + ' débite sans effet'); return { e0, e1, eff: s1 !== s0 }; };
  start('bal', false);
  call('duelStart(0);DU.sel=0;renderDuel()');
  if (scanOff()) bad.push('bouton désactivé alors que la cible n est pas révélée');
  const a1 = act('scan', 'analyse1');
  if (!(a1.e1 === a1.e0 - 1 && a1.eff)) bad.push('1re analyse : coût ou effet modifié');
  const off = scanOff(); log.push('bouton après analyse=' + (off ? 'désactivé' : 'actif'));
  if (!off) bad.push('bouton actif alors qu Analyser n a plus d effet');
  act('scan', 'analyse2');
  act('tir', 'tir(consomme le critique)');
  const on2 = !scanOff(); log.push('bouton après tir=' + (on2 ? 'actif' : 'désactivé'));
  if (!on2) bad.push('bouton non réactivé après consommation du critique');
  const a3 = act('scan', 'analyse3');
  if (!(a3.e1 === a3.e0 - 1 && a3.eff)) bad.push('analyse après tir : coût ou effet modifié');
  call('duelFlee()');
  return { ok: !bad.length, detail: log.join(' ; ') + (bad.length ? ' ; ÉCHECS : ' + bad.join(', ') : '') };
});

/* résiduel (famille « champ sans garde ») — gi.js:263/268, gx.js:136 : sauvegarde altérée avec it.bi hors bornes */
scenario('résiduel sauvegarde : équipement à bi hors bornes ⇒ ni exception ni affichage faux (hangar, duel)', () => {
  const save = call('JSON.stringify({eq:meta.eq,inv:meta.inv})'), bad = [], seen = [];
  const noJunk = (where, html) => { if (/undefined|NaN/.test(html)) bad.push(where + ' affiche undefined/NaN'); };
  try {
    call('{const c=giItem(meta.eq.canon);c.bi=99;meta.inv.push({id:99999,s:"noyau",r:0,lvl:1,up:0,bi:99,aff:[],u:null});meta.eq.noyau=99999;}');
    try { call('renderHangar()'); seen.push('hangar rendu'); } catch (e) { bad.push('hangar : ' + e.message); }
    for (const id of ['hgSlots', 'hgStats', 'hgIdx']) noJunk(id, doc.getElementById(id).innerHTML);
    seen.push('emplacements=' + (doc.getElementById('hgSlots').innerHTML.match(/class="sn">[^<]*/g) || []).map(s => s.slice(11)).join('|'));
    try { start('bal', false); call('duelStart(0)'); seen.push('duel canon=' + call('DK[DU.kind].n')); noJunk('duel', call("$('dvAct').innerHTML")); call('duelFlee()'); }
    catch (e) { bad.push('duel : ' + e.message); }
  } finally { call('{const s=' + save + ';meta.eq=s.eq;meta.inv=s.inv;}'); call('DU=null;if(G)G.state="play"'); }
  return { ok: !bad.length, detail: seen.join(' ; ') + (bad.length ? ' ; ÉCHECS : ' + bad.join(', ') : '') };
});

/* résiduel (famille « champ sans garde ») — gs.js:85/194 : sauvegarde altérée meta.mis avec une mission inconnue */
scenario('résiduel sauvegarde : mission inconnue dans meta.mis ⇒ ni exception ni affichage faux (menu, partie)', () => {
  const save = call('JSON.stringify(meta.mis)'), bad = [], seen = [];
  try {
    call('meta.mis={day:todayKey(),list:[{id:"ancienne_mission",n:5,r:30,p:0,done:0},{id:"kill",n:200,r:30,p:0,done:0}]}');
    try { call('renderMenu()'); } catch (e) { bad.push('menu : ' + e.message); }
    const html = call("$('mMis').innerHTML");
    if (/undefined|NaN/.test(html)) bad.push('menu affiche undefined/NaN');
    if (!/Absorbe 200 ennemis/.test(html)) bad.push('mission saine absente du menu');
    seen.push('menu : ' + (html.match(/<span>[^<]*<\/span>/g) || []).join(''));
    try { start('bal', false); steps(80); seen.push('80 pas de jeu, kills mission=' + call('meta.mis.list[1].p')); } catch (e) { bad.push('partie : ' + e.message); }
  } finally { call('meta.mis=' + save); }
  return { ok: !bad.length, detail: seen.join(' ; ') + (bad.length ? ' ; ÉCHECS : ' + bad.join(', ') : '') };
});

/* passe globale — gx.js renderDuel : les touches 1..n (et Entrée) existaient mais n'étaient affichées nulle part.
   Au clavier : chaque bouton d'action porte le chiffre qui le déclenche, dans l'ordre de DU.keys ; Entrée sur « Fin du tour ».
   Sur tactile : aucun libellé de touche (comme les touches A/E/R du HUD, gc.js). */
scenario('duel : chaque action affiche sa touche au clavier (1…n, Entrée), aucune sur tactile', () => {
  const read = () => { const html = call("$('dvAct').innerHTML"), btns = html.match(/<button class="dact"[\s\S]*?<\/button>/g) || [];
    return { html, keys: call('DU.keys.join(",")'), acts: btns.map(b => (/data-a="(\w+)"/.exec(b) || [])[1]).join(','),
      shown: btns.map(b => (/<kbd>([^<]*)<\/kbd>/.exec(b) || [])[1] || '-').join(','), end: /id="dvEnd"[^>]*>[^<]*<kbd>Entrée<\/kbd>/.test(html) }; };
  start('bal', false); call('inp.touch=false;duelStart(0)'); const k = read(); call('duelFlee()');
  start('bal', false); call('inp.touch=true;duelStart(0)'); const t = read(); call('duelFlee();inp.touch=false');
  const want = k.keys.split(',').map((_, i) => i + 1).join(',');
  return { ok: k.acts === k.keys && k.shown === want && k.end && !/<kbd>/.test(t.html),
    detail: 'clavier : boutons [' + k.acts + '] touches affichées [' + k.shown + '] (attendu [' + want + ']), Entrée affichée=' + k.end + ' ; tactile : libellés=' + /<kbd>/.test(t.html) };
});

/* passe globale — gt.js : une étape du prologue ne se validait QUE par son action. Un joueur qui ne dashe pas ou ne lance
   jamais sa compétence restait bloqué indéfiniment (d'une partie à l'autre : meta.tuto reprend à l'étape), sans voir
   la suite ni recevoir la récompense. Joueur passif (immobile, invulnérable, n'utilise rien) placé à l'étape « dash » :
   il doit arriver à l'étape « heart » (l'objectif de la partie). Témoin : lancer sa compétence valide l'étape tout de suite. */
scenario('prologue : un joueur qui ne dashe ni ne lance sa compétence n est pas bloqué ; l action valide toujours aussitôt', () => {
  const tuto = call('meta.tuto'), inputFn = win.__SIM_INPUT, idx = (id) => call('TUTO.findIndex(s=>s.id===' + JSON.stringify(id) + ')');
  const iDash = idx('dash'), iSkill = idx('skill'), iHeart = idx('heart'), seen = [];
  try {
    win.__SIM_INPUT = () => call('G.inX=G.inY=0;G.p.inv=1e9');
    call('meta.tuto=' + iDash); start('bal', false);
    let last = call('G.gt.step'); const n = steps(40000, () => { const s = call('G.gt.step'); if (s !== last) { seen.push(s + '@' + call('G.time')); last = s; } return s >= iHeart; });
    const reached = call('G.gt.step'), usedSkill = call('G.p.sk[0].cd>0'), dashed = call('G.p.dashT>0');
    /* témoin : l'action valide l'étape immédiatement */
    call('meta.tuto=' + iSkill); start('bal', false); steps(40); call('gcUse(0)');
    const n2 = steps(600, () => call('G.gt.step') !== iSkill), after = call('G.gt.step');
    return { ok: reached === iHeart && !usedSkill && !dashed && after === iSkill + 1 && n2 <= 2,
      detail: 'passif : étape ' + iDash + '→' + reached + ' en ' + n + ' pas (étapes franchies ' + seen.join(' ') + ', compétence utilisée=' + usedSkill + ') ; témoin : compétence lancée → étape ' + iSkill + '→' + after + ' en ' + n2 + ' pas' };
  } finally { win.__SIM_INPUT = inputFn; call(tuto === undefined ? 'delete meta.tuto' : 'meta.tuto=' + JSON.stringify(tuto)); }
});

/* chantier G — la vraie fin : aucun monument dans le biome core (gw.js), donc loreCount() plafonnait à 21/24 :
   chapitre V, épilogue et deux fins inatteignables. Les 3 échos du Cœur sont révélés par l'Hypernoyau, un par phase.
   Sauvegarde d'avant (lore sans clé core, 21 échos) -> vrai combat (updBoss, bossPhase, bossDie, endRun) -> 24, c5, S.ending.
   Puis un 2e combat : lore.core reste à 3 (jamais de doublon). */
scenario('chantier G : 21 échos + Hypernoyau vaincu ⇒ 24/24, chapitre V, S.ending ; échos du Cœur uniques, lore.core ≤ 3', () => {
  const keep = call('JSON.stringify({lore:meta.lore,chaps:meta.chaps,pend:meta.pend})');
  try {
    start('bal', false);
    const old = {}; for (const b of ['plains', 'floral', 'sea', 'sky', 'cyber', 'urban', 'ice']) old[b] = 3;
    call(`meta.lore=JSON.parse(${JSON.stringify(JSON.stringify(old))});delete meta.chaps.c5;meta.pend=meta.pend.filter(x=>x!=='c5');`);
    const lc0 = call('loreCount()'), nCore = call('(LORE.core||[]).length');
    call(`var __glN=0,__glMax=0;if(typeof gainLore==='function'){const __o=gainLore;gainLore=function(b,c){if(b==='core')__glN++;return __o(b,c);};}`);
    const fight = () => {
      let end = null; win.__SIM_END = w => { end = w; };
      call('startBossFight()');
      const subs = call('JSON.stringify(G.gs.subs.filter(q=>q.who.indexOf("Le Cœur")>=0).map(q=>q.calm))');
      for (let i = 0; i < 20000 && end === null; i++) {
        call(`{const P=G.p;P.inv=99;P.hp=P.mhp;const B=G.boss;if(B&&!B.dead&&G.state==='play'&&${i % 20 === 0})hurtBoss(B.mhp*.02,true);__glMax=Math.max(__glMax,meta.lore.core||0);}`);
        STEP(); advance(1000 / 60);
      }
      win.__SIM_END = null;
      return { end, subs, core: call('meta.lore.core||0'), lc: call('loreCount()'), ending: !!call('G.gs.ending'), phase: call('G.boss?G.boss.phase:0') };
    };
    const f1 = fight();
    const c5 = !!call(`!!meta.chaps.c5||meta.pend.includes('c5')`), n1 = call('__glN');
    start('bal', false);
    const f2 = fight(), n2 = call('__glN') - n1, mx = call('__glMax');
    const json = call('JSON.parse(JSON.stringify(meta)).lore.core');
    const ok = lc0 === 21 && nCore === 3 && f1.end === true && f1.phase === 3 && f1.lc === 24 && f1.core === 3 && c5 && f1.ending && n1 === 3
      && f2.end === true && f2.core === 3 && f2.lc === 24 && n2 === 3 && mx === 3 && json === 3;
    return { ok, detail: 'avant=' + lc0 + ' LORE.core=' + nCore + ' | combat 1 : fin=' + f1.end + ' phase=' + f1.phase + ' récit=' + f1.lc + ' core=' + f1.core + ' appels=' + n1 + ' c5=' + c5 + ' S.ending=' + f1.ending
      + ' | combat 2 : fin=' + f2.end + ' core=' + f2.core + ' récit=' + f2.lc + ' appels=' + n2 + ' | max lore.core observé=' + mx + ' sauvegardé=' + json };
  } finally { call(`{const k=JSON.parse(${JSON.stringify(keep)});meta.lore=k.lore;meta.chaps=k.chaps;meta.pend=k.pend;}`); }
});
scenario('chantier G : un écho de monument passe toujours par le même chemin (1 écho, sous-titre différé au calme) ; celui du Cœur s affiche en combat', () => {
  const keep = call('JSON.stringify(meta.lore)');
  try {
    start('bal', false);
    call(`meta.lore={};G.gs.subs=[];`);
    const L = call('JSON.stringify({t:WD.lms[0].t})'), t = JSON.parse(L).t;
    call('wakeEcho(WD.lms[0],0)');
    const m = JSON.parse(call(`JSON.stringify({n:meta.lore[${JSON.stringify(t)}]||0,e:G.gs.echo,calm:G.gs.subs.map(q=>q.calm)})`));
    call('G.gs.subs=[];startBossFight()');
    const b = JSON.parse(call(`JSON.stringify({n:meta.lore.core||0,e:G.gs.echo,subs:G.gs.subs.map(q=>[q.who,q.calm])})`));
    const bs = b.subs.find(x => x[0].indexOf('Le Cœur') >= 0);
    const ok = m.n === 1 && m.e === 1 && m.calm.length === 1 && m.calm[0] === true && b.n === 1 && b.e === 1 && !!bs && bs[1] === false;
    return { ok, detail: 'monument ' + t + ' : écho=' + m.n + ' S.echo=' + m.e + ' calm=' + m.calm + ' | Hypernoyau : core=' + b.n + ' S.echo=' + b.e + ' sous-titre=' + JSON.stringify(bs || null) };
  } finally { call(`meta.lore=JSON.parse(${JSON.stringify(keep)})`); }
});

/* chantier B — embranchements : le contenu annoncé existe ET se joue. Un trésor se ramasse en passant ; un nid se
   réveille à l'approche (garde avec 2 élites), ne paie rien tant qu'elle vit, et paie quand elle est détruite.
   Proximité seule, aucune interface : rien à brancher sur SIMF(). Le classement et la vérité des annonces sont
   vérifiés par test/embranchements.js (plus bas). */
{ start('bal');
  /* rendu réel d'une image au carrefour : panneaux/pastilles « icône Type · N m » effectivement écrits */
  let rD = '', rOK = false;
  try { rD = call(`(()=>{const b=WD.br[0],o=WD.sites[b.o],k=Math.min(1,(WR-240)/Math.hypot(o.x,o.y));for(const e of G.en)e.dead=true;G.p.x=G.p.px=o.x*k;G.p.y=G.p.py=o.y*k;
      CAM.x=G.p.x;CAM.y=G.p.y;const T=[],f0=ctx.fillText;ctx.fillText=function(t){T.push(String(t));};try{render(1,16);}finally{ctx.fillText=f0;}
      const want=WD.br.map((q,i)=>i).filter(i=>WD.br[i].o===b.o&&!gcBrDone(i)).map(i=>BRT[WD.br[i].t].n+' '),got=T.filter(t=>/ m$/.test(t)&&Object.values(BRT).some(v=>t.includes(v.n)));
      return JSON.stringify({ok:want.every(w=>got.some(t=>t.includes(w.trim()))),got:[...new Set(got)].slice(0,6),want});})()`);
    rOK = JSON.parse(rD).ok; } catch (e) { rD = 'exception : ' + e.message; }
  check('branches : au carrefour, une image rendue écrit l’annonce de chaque branche non épuisée (type + mètres)', rOK, rD);
  const r0 = JSON.parse(call(`(()=>{const ti=WD.br?WD.br.findIndex(b=>b.t==='tresor'):-1,ni=WD.br?WD.br.findIndex(b=>b.t==='nid'):-1;
    if(ti>=0){const b=WD.br[ti];G.p.x=G.p.px=b.x;G.p.y=G.p.py=b.y;}return JSON.stringify({ti,ni,sh:G.gs.shards});})()`));
  let tOK = false, tD = 'aucune branche trésor (WD.br absent ?)';
  if (r0.ti >= 0) { steps(25); const t = JSON.parse(call(`JSON.stringify({d:!!G.gc.brDone[${r0.ti}],sh:G.gs.shards})`)); tOK = t.d && t.sh > r0.sh; tD = 'ramassé=' + t.d + ' éclats ' + r0.sh + '→' + t.sh; }
  check('branches : un trésor annoncé se ramasse au bout de la branche (éclats en plus)', tOK, tD);
  let nOK = false, nD = 'aucune branche nid';
  if (r0.ni >= 0) {
    call(`(()=>{const b=WD.br[${r0.ni}];G.p.x=G.p.px=b.x;G.p.y=G.p.py=b.y+220;G.p.inv=9999;})()`); steps(25);
    const a = JSON.parse(call(`JSON.stringify({n:(G.gc.nest[${r0.ni}]||[]).length,el:(G.gc.nest[${r0.ni}]||[]).filter(e=>e.aff).length,d:!!G.gc.brDone[${r0.ni}],sh:G.gs.shards})`));
    call(`for(const e of G.gc.nest[${r0.ni}]||[])if(!e.dead)killEnemy(e);`); steps(25);
    const z = JSON.parse(call(`JSON.stringify({d:!!G.gc.brDone[${r0.ni}],sh:G.gs.shards})`));
    nOK = a.n >= 4 && a.el >= 1 && !a.d && z.d && z.sh > a.sh; nD = 'garde=' + a.n + ' dont élites=' + a.el + ', payé avant=' + a.d + ', payé après=' + z.d + ', éclats ' + a.sh + '→' + z.sh; }
  check('branches : un nid se réveille à l’approche, ne paie qu’une fois sa garde détruite', nOK, nD);
}

/* hooks du harnais : ne doivent pas avoir disparu */
check('hooks : SIMF / __SIM / __SIM_INPUT / __SIM_PICK / __SIM_END utilisés par le jeu',
  call('typeof SIMF') === 'function' && ['__SIM_END', '__SIM_PICK', '__SIM_INPUT'].every(h => code.includes('window.' + h)) && code.includes('window.__SIM'));

/* PERF-2 — garde-fous de la cuisson du monde : chacun tourne dans son propre processus (cuisson.js
   installe le jeu dans le contexte principal de V8, avec une horloge virtuelle) */
const sub = (f, args) => { const r = cp.spawnSync(process.execPath, [path.join(__dirname, f), ...args], { cwd: ROOT, encoding: 'utf8' }); const out = (r.stdout || '') + (r.stderr || ''); return { ok: r.status === 0, out }; };
{ const r = sub('cuisson.js', REF ? ['--ref=' + REF] : []);
  check('cuisson : aucun chunk entier hors budget, travail continu et unité indivisible plafonnés (test/cuisson.js)', r.ok, r.out.split('\n').filter(l => /^\s+(OK|ECHEC)\s/.test(l)).map(l => l.trim()).join(' | ') || r.out.slice(-300)); }
{ const r = sub('art.js', REF ? ['--cible=' + REF] : []);
  check('cuisson : séquence brute des opérations de chaque chunk identique à e3a2c93 (test/art.js)', r.ok, (r.out.match(/chunks identiques : .*/) || [r.out.slice(-300)])[0]); }
{ const r = sub('qualite.js', REF ? ['--ref=' + REF] : []);
  check('qualité : le contrôleur peut remonter, la référence est celle du jeu, applyRes suit chaque cran (test/qualite.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).map(s => s.trim()).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }
{ const r = sub('degradation.js', REF ? ['--ref=' + REF] : []);
  check('dégradation : les postes décoratifs cèdent sous budget, jamais le monde ni le joueur (test/degradation.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).map(s => s.trim()).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }
{ const r = sub('compteur.js', REF ? ['--ref=' + REF] : []);
  check('compteur : lisible sur téléphone et il dit qui cuit le monde, worker ou sur place (test/compteur.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).map(s => s.trim()).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }
{ const r = sub('competences.js', REF ? ['--ref=' + REF] : []);
  check('compétences : 6 à 8 proposées à l’autel, chacune s’active, recharge débitée, effet mesuré, sauvegarde d’avant jouable (test/competences.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).map(s => s.trim()).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }
{ const r = sub('colonne.js', REF ? ['--ref=' + REF] : []);
  check('colonne : chemin principal = plus court chemin 0 → Hypernoyau, 3 cœurs jalons dessus, 3 biomes distincts (test/colonne.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim()).join(' | ') || (r.out.match(/\d+ graines : [^\n]*/) || [''])[0]); }
{ const r = sub('annonces.js', REF ? ['--ref=' + REF] : []);
  check('annonces : Lentille ÷2 (partie = Hangar), puissance des classes, Intouchable, niveau des reliques (test/annonces.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim()).join(' | ') || (r.out.match(/TOUT PASSE[^\n]*/) || [''])[0]); }

{ const r = sub('embranchements.js', REF ? ['--ref=' + REF] : []);
  check('embranchements : chaque arête classée une fois, branches variées par carrefour, annonce lisible depuis le carrefour et vraie au mètre près, contenu présent (test/embranchements.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim()).join(' | ') || (r.out.match(/\d+ graines : [^\n]*/) || [''])[0]); }

{ const r = sub('frontiere-sonore.js', REF ? ['--ref=' + REF] : []);
  check('frontière sonore : le poids audio est celui de biomeMix, il monte avant la frontière sans repasser par 0 (test/frontiere-sonore.js)', r.ok,
    (r.out.match(/ÉCHEC [^\n]*/g) || []).slice(0, 2).map(s => s.trim()).join(' | ') || (r.out.match(/\d+ traversées[^\n]*/) || [''])[0]); }

{ const r = sub('decor.js', REF ? ['--ref=' + REF] : []);
  check('décor : la gueule mord l’ennemi, la voiture le percute, le gouffre l’avale ; jamais le joueur (test/decor.js)', r.ok,
    (r.out.match(/ECHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim().slice(0, 220)).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }

{ const r = sub('decor-vivant.js', REF ? ['--ref=' + REF] : []);
  check('décor vivant : la faune fuit le danger, la colonne n’apparaît que sur un biome non visité, le halo croît vers le Cœur, le pool de marques ne croît pas (test/decor-vivant.js)', r.ok,
    (r.out.match(/ÉCHEC [^\n]*/g) || []).slice(0, 2).map(s => s.trim().slice(0, 200)).join(' | ') || r.out.split('\n').filter(l => /^OK/.test(l)).length + ' critères OK'); }

{ const r = sub('ecrans.js', REF ? ['--ref=' + REF] : []);
  check('écrans : chaque mot d’une description de classe est rattaché à une règle mesurée (portée d’écho par dichotomie), et la pastille « N j série » du menu dit la vérité aujourd’hui (test/ecrans.js)', r.ok,
    (r.out.match(/[ÉE]CHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim().slice(0, 220)).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }

{ const r = sub('terrain.js', REF ? ['--ref=' + REF] : []);
  check('terrain : le courant porte, la glace prolonge le dash, le balayage alarme hors abri, le relais protège, le vent vise le prochain nœud (test/terrain.js)', r.ok,
    (r.out.match(/[ÉE]CHEC [^\n]*/g) || []).slice(0, 3).map(s => s.trim().slice(0, 220)).join(' | ') || r.out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK'); }

/* ---------- verdict ---------- */
console.log('\n---------------- VERDICT ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  KO  ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log('-----------------------------------------');
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
