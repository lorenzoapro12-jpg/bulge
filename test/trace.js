'use strict';
/* =========================================================
   Trace de déterminisme + chronométrage de BULGE (headless) — refonte en îlots

   node test/trace.js                  deux parties à graine fixe (IA naturelle, IA en mode dieu) : empreinte d'état + temps par pas
   node test/trace.js --ref=HEAD       même chose sur les modules d'un commit git (sans rien écrire)
   node test/trace.js --render         appelle aussi render() à chaque pas (couverture du rendu sous canvas stubé :
                                       exceptions et coût JS, pas de pixels)
   node test/trace.js --calls          avec --render : appels canvas par image, par méthode
   node test/trace.js --steps=N        nombre de pas de la partie naturelle (défaut 20000 ; mode dieu : 3N)
   node test/trace.js --gen            génération des îlots : temps de genIslet(graine,k), k=1..8, et empreinte de ce
                                       qu'elle produit (falaises WD.wall, obstacles et décor vivant de TOUS les chunks,
                                       carte et miniature en pixels)
   node test/trace.js --vm             le jeu dans un contexte vm (comme test/lib.js) au lieu du contexte principal

   But : prouver qu'une optimisation ne change AUCUN comportement. Toutes les sources d'aléa sont à graine
   (Math.random du moteur + R() du jeu, choix des bonus tirés au sort mais à graine) : si l'ordre et le nombre des
   tirages, la physique et les décisions sont inchangés, les empreintes sont identiques octet pour octet entre
   --ref=HEAD et l'arbre de travail. Empreinte d'état (tous les 250 pas et à la fin) : îlot, phase, vague, score,
   éliminations, avalés, segments, bonus pris, PV du boss, plus positions et listes (joueur, ennemis, tirs, power-ups).
   L'IA de test est celle de test/lib.js (L.AI) ; l'ordre des modules et le début de partie viennent de build.sh et de
   L.startCode au commit visé. Un commit d'avant la refonte (genIslet absent) n'a pas la même API : « API différente ».
   Chronométrage : contexte principal de V8 par défaut (globales réelles) — sous vm, jusqu'à ~180× plus lent (CLAUDE.md).
   Retiré avec la refonte : profils (bal, tank, scout), défi du jour (--daily-days), prologue (--tuto), genWorld.
   ========================================================= */
const vm = require('vm'), crypto = require('crypto'), L = require('./lib');
const ARG = L.ARG, REF = ARG('ref'), RENDER = !!ARG('render'), NSTEPS = +(ARG('steps') || 20000), CALLS = !!ARG('calls'), VM = !!ARG('vm');
const ORDER = L.ordre(REF).order;

/* horloge virtuelle, stubs canvas/DOM : mêmes principes que test/lib.js */
let CLOCK = 0, TID = 0; const TIMERS = [];
function advance(ms) { const end = CLOCK + ms; for (;;) { let k = -1; for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i; if (k < 0) break; const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn(); } CLOCK = end; }
/* --calls : décompte par méthode des appels canvas (seul indicateur du coût du dessin disponible sans navigateur) */
let CTXCALLS = 0; const TALLY = new Map();
const tally = (k) => { if (CALLS) TALLY.set(k, (TALLY.get(k) || 0) + 1); };
function mkCtx() {
  const grad = { addColorStop() {} }, fns = new Map();
  const base = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), getImageData: (x, y, w, h) => { tally('getImageData'); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    createRadialGradient: () => { tally('createRadialGradient'); return grad; }, createLinearGradient: () => { tally('createLinearGradient'); return grad; }, createPattern: () => ({}), measureText: (s) => { tally('measureText'); return { width: (s || '').length * 7 }; } };
  return new Proxy(base, { get: (t, p) => { if (p in t) return t[p]; let f = fns.get(p); if (!f) fns.set(p, f = () => { CTXCALLS++; tally(p); }); return f; },
    set: (t, p, v) => { if (CALLS && (p === 'shadowBlur' ? v > 0 : p === 'filter' ? v !== 'none' : false)) tally('=' + p); t[p] = v; return true; } });
}
function mkStyle() { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: (k) => { delete s[k]; return ''; } }, getPropertyValue: { value: (k) => (s[k] || '') } }); return s; }
function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }; }
const doc = { activeElement: null };
function mkEl(id, tag) { const attrs = {}; const el = { id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {}, hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '', offsetWidth: 0, offsetHeight: 0, parentElement: null,
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }), setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
  closest: () => null, focus: () => { doc.activeElement = el; }, blur() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {} }; return el; }
function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; el.getContext = () => mkCtx(); return el; }
const stash = new Map();
Object.assign(doc, { hidden: false, getElementById(id) { if (!stash.has(id)) { const el = id === 'cv' ? mkCanvasEl(800, 600, id) : mkEl(id); if (id === 'cv') el.parentElement = mkEl('stage'); stash.set(id, el); } return stash.get(id); },
  createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)), querySelectorAll: () => [], querySelector: () => null, body: mkEl('body', 'body'), addEventListener() {} });
const win = { __SIM: true, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
  setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; }, clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
  setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;

const code = ORDER.map(f => L.readModule(f, REF)).join('\n');
/* Deux modes d'exécution, même sémantique (les empreintes doivent coïncider) :
   - par défaut : le jeu tourne dans le contexte principal de V8, globales réelles, comme dans un navigateur.
     Seul ce mode donne des temps représentatifs.
   - --vm : contexte vm isolé, comme test/lib.js. Chaque accès à une globale y passe par un intercepteur. */
let ctx = null, call;
if (VM) { ctx = vm.createContext(sandbox); call = (e) => vm.runInContext(e, ctx); }
else {
  for (const k of Object.keys(sandbox)) if (k !== 'globalThis') Object.defineProperty(globalThis, k, { value: sandbox[k], writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
  call = (e) => vm.runInThisContext(e);
}
const load = (src, filename) => VM ? vm.runInContext(src, ctx, { filename }) : vm.runInThisContext(src, { filename });
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
let loadErr = null; try { load(code, 'game.js'); } catch (e) { loadErr = e; }
if (call(`typeof genIslet`) !== 'function' || call(`typeof islStart`) !== 'function') {
  console.log(`# trace ${REF ? 'git ' + REF : 'arbre de travail'} : API différente — pas d'îlots (genIslet/islStart absents : code d'avant la refonte). Empreintes non comparables, rien n'est mesuré.` + (loadErr ? ' (chargement : ' + String(loadErr.message || loadErr).slice(0, 120) + ')' : ''));
  process.exit(1);
}
if (loadErr) throw loadErr;
load(L.AI, 'ai-test.js');
/* le rendu tire aussi Math.random (effets visuels) : en mode --render on lui donne sa propre source,
   pour que la simulation reste sur la même suite de tirages qu'en mode normal */
if (RENDER) call(`resize();applyQuality();(function(){const simR=Math.random;let q=7;const visR=function(){q=(q+0x6D2B79F5)>>>0;let t=q;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const r0=render;render=function(a,b){Math.random=visR;try{return r0(a,b);}finally{Math.random=simR;}};})()`);
const STEP = call('(function(){step();})'), RND = call('(function(a,b){render(a,b);})');
const snap = () => call(`JSON.stringify([G.t,G.state,G.isl,G.ph,G.wave,G.score,G.kills,G.eats,G.p.seg,G.p.segMax,G.picks.length,+G.p.x.toFixed(4),+G.p.y.toFixed(4),G.en.length,G.eb.length,G.pb.length,G.pus.length,G.fx.length,G.en.reduce((a,e)=>a+e.x*1.3+e.y*0.7+e.hp,0).toFixed(3),G.boss?[G.boss.phase,+G.boss.hp.toFixed(3)]:0])`);

function run(name, seed, n, god) {
  call(`Math.__seed(${seed})`);
  win.__SIM_PICK = (c) => c[Math.floor(call('Math.random()') * c.length)];
  let ended = null; win.__SIM_END = (w) => { ended = w; };
  call(L.startCode(REF)); call(`window.__SIM_GOD=${god ? 1 : 0};window.__SIM_BOOST=0;`);
  const h = crypto.createHash('sha256'); let t = 0n, tr = 0n, i = 0, err = null; CTXCALLS = 0; TALLY.clear();
  try {
    for (; i < n && ended === null; i++) {
      const a = process.hrtime.bigint(); STEP(); t += process.hrtime.bigint() - a;
      if (RENDER) { const b = process.hrtime.bigint(); RND(.5, 16.7); tr += process.hrtime.bigint() - b; }
      advance(1000 / 60); if (i % 250 === 0) h.update(snap());
    }
  } catch (e) { err = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  h.update(snap());
  const r = { run: name, graine: seed, steps: i, end: ended, digest: h.digest('hex').slice(0, 16), usPerStep: +(Number(t) / 1e3 / Math.max(1, i)).toFixed(1) };
  r.fin = JSON.parse(call(`JSON.stringify({isl:G.isl,ph:G.ph,vague:G.wave,score:Math.round(G.score),elim:G.kills,avales:G.eats,seg:G.p.seg+'/'+G.p.segMax,boss:G.boss?Math.round(G.boss.hp)+'/'+G.boss.mhp:null,bonus:G.picks.join(' ')})`));
  if (RENDER) { r.usPerRender = +(Number(tr) / 1e3 / Math.max(1, i)).toFixed(1); r.ctxCallsPerRender = Math.round(CTXCALLS / Math.max(1, i)); }
  if (err) r.error = err;
  if (CALLS) r.perFrame = Object.fromEntries([...TALLY].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => [k, +(v / Math.max(1, i)).toFixed(2)]));
  console.log(JSON.stringify(r));
  win.__SIM_END = null; call('window.__SIM_GOD=0');
  return r;
}
/* génération des îlots : temps de genIslet(graine,k) et empreinte de tout ce qu'elle produit, chunks compris */
if (ARG('gen')) {
  const seeds = [20260927, 7, 123456789, 424242, 99, 12345, 31337, 2718];
  /* capture des pixels : on intercepte putImageData sur les canvas créés par buildMaps (mkCanvas, gw2.js) */
  call(`var __PX=[];(function(){const ce=document.createElement.bind(document);document.createElement=function(t){const el=ce(t);if(t==='canvas'){const g0=el.getContext;el.getContext=function(){const g=g0.call(el);return new Proxy(g,{get:(o,p)=>p==='putImageData'?(img)=>{__PX.push(img.data);}:o[p]});};}return el;};})()`);
  const NISL = call('NISL'), h = crypto.createHash('sha256'); let tot = 0, nb = 0;
  for (const s of seeds) {
    const row = [];
    for (let k = 1; k <= NISL; k++) {
      call('__PX.length=0');
      const a = process.hrtime.bigint(); call(`genIslet(${s},${k})`); const ms = Number(process.hrtime.bigint() - a) / 1e6; tot += ms; nb++;
      /* chunks : tous ceux de la grille (getChunk les génère, hors du chronométrage de genIslet) */
      const d = call(`JSON.stringify({b:WD.sites[0].t,s:WD.seed,w:Array.from(WD.wall).join(''),c:(()=>{const o=[];for(let ix=0;ix<NC;ix++)for(let iy=0;iy<NC;iy++){const c=getChunk(ix-COFF,iy-COFF);if(!c)continue;
        o.push([c.cx,c.cy,c.obs.map(q=>[q.k,q.x,q.y,q.r,q.w,q.h,q.b,q.wall|0,q.brk|0,q.hp,q.pu?1:0,q.s]),c.live.map(q=>[q.t,q.x,q.y,q.s,q.ph,q.vert,q.spd])]);}return o;})()})`);
      const px = call('__PX.map(a=>Array.from(a).join(",")).join("|")');
      const dg = crypto.createHash('sha256').update(d).update(px).digest('hex').slice(0, 12); h.update(dg);
      row.push({ k, b: JSON.parse(d).b, ms: +ms.toFixed(1), digest: dg });
    }
    console.log(JSON.stringify({ seed: s, ilots: row }));
  }
  console.log('# genIslet ' + (REF ? 'git ' + REF : 'arbre de travail') + (VM ? ' (vm)' : '') + ' : ' + (tot / nb).toFixed(1) + ' ms en moyenne par îlot (' + nb + ' îlots) ; empreinte ' + h.digest('hex').slice(0, 16));
  process.exit(0);
}
console.log('# trace ' + (REF ? 'git ' + REF : 'arbre de travail') + (RENDER ? ' + rendu' : '') + (VM ? ' (vm)' : '') + ', ' + NSTEPS + ' pas max (mode dieu : ' + 3 * NSTEPS + ')');
const rs = [run('naturel', 12345, NSTEPS, false), run('dieu', 999, NSTEPS * 3, true)];
console.log('# empreinte globale ' + crypto.createHash('sha256').update(rs.map(r => r.digest).join()).digest('hex').slice(0, 16));
process.exit(rs.some(r => r.error) ? 1 : 0);
