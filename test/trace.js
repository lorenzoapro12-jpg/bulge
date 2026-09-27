'use strict';
/* =========================================================
   Trace de déterminisme + chronométrage de BULGE (headless)

   node test/trace.js                  parties à graine fixe : empreinte d'état + temps par pas
   node test/trace.js --ref=HEAD       même chose sur les modules d'un commit git (sans rien écrire)
   node test/trace.js --render         appelle aussi render() à chaque pas (couverture du rendu
                                       sous canvas stubé : exceptions et coût JS, pas de pixels)
   node test/trace.js --steps=N        nombre de pas par partie (défaut 20000)

   But : prouver qu'une optimisation ne change AUCUN comportement. Toutes les
   sources d'aléa sont à graine (Math.random du moteur + R() du jeu) : si l'ordre
   et le nombre des tirages, la physique et les décisions sont inchangés, les
   empreintes sont identiques octet pour octet entre --ref=HEAD et l'arbre de travail.
   L'IA de test est reprise telle quelle de test/headless.js (même comportement).
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), RENDER = !!ARG('render'), NSTEPS = +(ARG('steps') || 20000);
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* horloge virtuelle, stubs canvas/DOM : mêmes principes que test/headless.js */
let CLOCK = 0, TID = 0; const TIMERS = [];
function advance(ms) { const end = CLOCK + ms; for (;;) { let k = -1; for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i; if (k < 0) break; const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn(); } CLOCK = end; }
/* --calls : décompte par méthode/propriété des appels canvas (seul indicateur du coût GPU/CPU du
   dessin disponible sans navigateur ; les opérations coûteuses connues sont shadowBlur, filter,
   createRadialGradient/LinearGradient, getImageData, drawImage de grands canvas) */
let CTXCALLS = 0; const TALLY = new Map(), CALLS = !!ARG('calls'), TUTO_LOG = !!ARG('tuto');  /* --tuto : étapes du prologue (étape@G.time, -1 = terminé/inactif) */
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
Object.assign(doc, { hidden: false, getElementById(id) { if (!stash.has(id)) { const el = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvasEl(800, 600, id) : mkEl(id); if (id === 'cv') el.parentElement = mkEl('stage'); stash.set(id, el); } return stash.get(id); },
  createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)), querySelectorAll: () => [], querySelector: () => null, body: mkEl('body', 'body'), addEventListener() {} });
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
  setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; }, clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
  setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;

const code = ORDER.map(readModule).join('\n');
/* Deux modes d'exécution, même sémantique (les empreintes doivent coïncider) :
   - par défaut : le jeu tourne dans le contexte principal de V8, globales réelles, comme dans un navigateur.
     Seul ce mode donne des temps représentatifs.
   - --vm : contexte vm isolé, comme test/headless.js. Chaque accès à une globale y passe par un
     intercepteur : le code y est jusqu'à ~180× plus lent, et les profils y sont faussés. */
const VM = !!ARG('vm');
let ctx = null, call;
if (VM) { ctx = vm.createContext(sandbox); call = (e) => vm.runInContext(e, ctx); }
else {
  for (const k of Object.keys(sandbox)) if (k !== 'globalThis') Object.defineProperty(globalThis, k, { value: sandbox[k], writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
  call = (e) => vm.runInThisContext(e);
}
const load = (src, filename) => VM ? vm.runInContext(src, ctx, { filename }) : vm.runInThisContext(src, { filename });
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
load(code, 'game.js');
/* IA de test : reprise textuellement de headless.js pour conduire exactement les mêmes parties */
const H = fs.readFileSync(path.join(__dirname, 'headless.js'), 'utf8'), AI = /const AI = `([\s\S]*?)`;/.exec(H)[1];
load(AI, 'ai-test.js');
call('boot()');
/* le rendu tire aussi Math.random (effets visuels) : en mode --render on lui donne sa propre source,
   pour que la simulation reste sur la même suite de tirages qu'en mode normal */
if (RENDER) call(`(function(){const simR=Math.random;let q=7;const visR=function(){q=(q+0x6D2B79F5)>>>0;let t=q;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const r0=render;render=function(a,b){Math.random=visR;try{return r0(a,b);}finally{Math.random=simR;}};})()`);
const STEP = call('(function(){step();})'), RND = call('(function(a,b){render(a,b);})');
const snap = () => call(`JSON.stringify([G.t,G.state,G.score,G.kills,G.heartsDone,G.p.lvl,+G.p.bub.toFixed(6),+G.p.x.toFixed(4),+G.p.y.toFixed(4),G.en.length,G.eb.length,G.pb.length,G.pk.length,G.fx.length,G.en.reduce((a,e)=>a+e.x*1.3+e.y*0.7+e.hp,0).toFixed(3),G.boss?[G.boss.phase,+G.boss.hp.toFixed(3)]:0])`);

function run(name, prof, seed, n, opts) {
  call(`Math.__seed(${seed})`);
  win.__SIM_PICK = (c) => c[Math.floor(call('Math.random()') * c.length)];
  let ended = null; win.__SIM_END = (w) => { ended = w; };
  win.__SIM_BOOST = opts.boost ? 1 : 0; win.__SIM_TELEPORT = opts.teleport ? 1 : 0;
  call(`newRun(${JSON.stringify(prof)},${opts.daily ? 'true' : 'false'});gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;`);
  const h = crypto.createHash('sha256'); let t = 0n, tr = 0n, i = 0, err = null; CTXCALLS = 0; TALLY.clear();
  const tutoLog = []; let lastTuto = call('G.gt&&G.gt.on?G.gt.step:-1'); tutoLog.push(lastTuto + '@0');
  try {
    for (; i < n && ended === null; i++) {
      const a = process.hrtime.bigint(); STEP(); t += process.hrtime.bigint() - a;
      if (RENDER) { const b = process.hrtime.bigint(); RND(.5, 16.7); tr += process.hrtime.bigint() - b; }
      advance(1000 / 60); if (i % 250 === 0) h.update(snap());
      if (TUTO_LOG) { const s = call('G.gt&&G.gt.on?G.gt.step:-1'); if (s !== lastTuto) { tutoLog.push(s + '@' + call('G.time')); lastTuto = s; } }
    }
  } catch (e) { err = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  h.update(snap());
  const r = { run: name, steps: i, end: ended, digest: h.digest('hex').slice(0, 16), usPerStep: +(Number(t) / 1e3 / i).toFixed(1) };
  if (RENDER) { r.usPerRender = +(Number(tr) / 1e3 / i).toFixed(1); r.ctxCallsPerRender = Math.round(CTXCALLS / i); }
  if (err) r.error = err;
  if (ended === null && ARG('daily-days')) r.final = JSON.parse(call(`JSON.stringify({state:G.state,hearts:G.heartsDone,heartSt:G.hearts.map(h=>h.state),lair:G.lair.open,arena:G.arena&&G.arena.kind,boss:G.boss&&{ph:G.boss.phase,hp:Math.round(G.boss.hp),sp:G.boss.spawn,tr:G.boss.trans},p:[Math.round(G.p.x),Math.round(G.p.y)],core:[Math.round(WD.core.x),Math.round(WD.core.y)],bub:G.p.bub,dead:G.p.dead,wr:WR})`));
  if (TUTO_LOG) r.prologue = tutoLog.join(' ');
  if (CALLS) r.perFrame = Object.fromEntries([...TALLY].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => [k, +(v / i).toFixed(2)]));
  console.log(JSON.stringify(r));
  win.__SIM_END = null; win.__SIM_BOOST = 0; win.__SIM_TELEPORT = 0;
  return r;
}
/* génération du monde : temps de genWorld() et empreinte de tout ce qu'elle produit (falaises, sentiers,
   monuments, failles, souvenirs, chasseurs, carte et mini-carte en pixels) */
if (ARG('gen')) {
  const seeds = [20260927, 7, 123456789, 424242, 99, 12345, 31337, 2718];
  /* capture des pixels : on intercepte putImageData sur les canvas créés par buildMaps */
  call(`var __PX=[];(function(){const ce=document.createElement.bind(document);document.createElement=function(t){const el=ce(t);if(t==='canvas'){const g0=el.getContext;el.getContext=function(){const g=g0.call(el);return new Proxy(g,{get:(o,p)=>p==='putImageData'?(img)=>{__PX.push(img.data);}:o[p]});};}return el;};})()`);
  const h = crypto.createHash('sha256'); let tot = 0;
  for (const s of seeds) {
    call('__PX.length=0');
    const a = process.hrtime.bigint(); call(`genWorld(${s})`); const ms = Number(process.hrtime.bigint() - a) / 1e6; tot += ms;
    const d = call(`JSON.stringify({w:Array.from(WD.wall).join(''),s:WD.segs.length,l:WD.lms.map(L=>[L.x,L.y,L.parts.length]),h:WD.hearts,c:WD.core,r:WD.rifts,a:WD.alts,scn:WD.scn.map(q=>[q.t,q.x,q.y]),hu:WD.hunt.map(q=>[q.n,q.hx,q.hy]),v:WD.views})`);
    const px = call('__PX.map(a=>Array.from(a).join(",")).join("|")');
    const dg = crypto.createHash('sha256').update(d).update(px).digest('hex').slice(0, 16); h.update(dg);
    console.log(JSON.stringify({ seed: s, ms: +ms.toFixed(1), digest: dg }));
  }
  console.log('# genWorld ' + (REF ? 'git ' + REF : 'arbre de travail') + ' : ' + (tot / seeds.length).toFixed(1) + ' ms en moyenne ; empreinte ' + h.digest('hex').slice(0, 16));
  process.exit(0);
}
/* --daily-days=N : victoire assistée en défi du jour sur N dates successives à partir d'aujourd'hui
   (la graine du défi dépend de la date : robustesse du critère run6 de headless.js d'un jour à l'autre) */
if (ARG('daily-days')) {
  const RealDate = Date, n = +ARG('daily-days'); let fails = 0;
  for (let d = 0; d < n; d++) {
    const off = d * 864e5; globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } };
    const r = run('jour+' + d, 'bal', 777, 400000, { daily: true, boost: true, teleport: true });
    if (r.end !== true) fails++;
  }
  globalThis.Date = RealDate; console.log('# défi du jour assisté : ' + (n - fails) + '/' + n + ' victoires'); process.exit(fails ? 1 : 0);
}
console.log('# trace ' + (REF ? 'git ' + REF : 'arbre de travail') + (RENDER ? ' + rendu' : '') + ', ' + NSTEPS + ' pas max par partie');
const rs = [run('naturel', 'bal', 12345, NSTEPS, {}), run('assiste', 'bal', 999, NSTEPS * 3, { boost: true, teleport: true }), run('jour', 'bal', 424242, NSTEPS, { daily: true }), run('colosse', 'tank', 31337, NSTEPS, {}), run('eclaireur', 'scout', 2718, NSTEPS, {})];
console.log('# empreinte globale ' + crypto.createHash('sha256').update(rs.map(r => r.digest).join()).digest('hex').slice(0, 16));
process.exit(rs.some(r => r.error) ? 1 : 0);
