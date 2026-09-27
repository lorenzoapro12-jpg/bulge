'use strict';
/* =========================================================
   Garde-fou de la cuisson du monde (PERF-2) — BULGE headless

   node test/cuisson.js              arbre de travail
   node test/cuisson.js --ref=HEAD   modules d'un commit git (sans rien écrire) : doit ÉCHOUER
                                     sur le code d'avant PERF-2
   node test/cuisson.js --k=5        coût d'une opération canvas, en µs (défaut 5)
   node test/cuisson.js --frames=N   images par partie (défaut 2400)

   Le chronomètre du jeu (performance.now) est une HORLOGE VIRTUELLE qui n'avance que par le
   travail : K µs par opération canvas (40 K pour un dégradé ou un motif, comme bulge-verif/frames.js)
   et STEPC ms par pas de simulation. Le résultat ne dépend donc ni de la machine ni de la lenteur de
   `vm` : c'est un modèle d'appareil, pas une mesure de téléphone. K=5 µs met un chunk moyen vers
   20 ms, soit ~11x le contexte principal de V8 sur ce serveur (1,8 ms, blocages.js) : dans la plage
   « 5 à 20x plus lent » d'un téléphone. Le jeu est conduit par la VRAIE boucle frame() (g4.js) :
   les horodatages rAF tombent sur la grille vsync de 60 Hz, une image trop longue en saute.

   Critères (chacun doit échouer sur l'ancien code, --ref=93b8cfe) :
   (a) aucun chunk entier d'un bloc (premier et dernier bakeStep d'un même chunk dans le même
       appel) hors budget : jamais dans newRun, qui n'a pas de budget ; dans une image, seulement
       si le coût du chunk tient dans le budget de cette image (un chunk léger sur un appareil
       rapide, c'est précisément ce que le budget adaptatif doit permettre) ;
   (b) le plus long travail de cuisson continu dans un appel (temps passé dans bakeStep) reste
       sous PLAFOND ms : budget maximal (0,6 × 16,7 = 10 ms) + une unité ;
   (c) la plus grosse unité indivisible (un seul appel à bakeStep) reste sous UNITE ms : ce que
       le budget ne peut pas interrompre est ce qui déborde.
   Mesures rapportées sans seuil : images où un chunk visible n'était pas prêt à l'entrée de
   streamWorld (cache vide), images où un chunk inachevé est À L'ÉCRAN, images manquées (vsync).
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), K = +(ARG('k') || 5) / 1000, NFR = +(ARG('frames') || 2400), STEPC = 1.5, VS = 1000 / 60;
const PLAFOND = 12, UNITE = 4;
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- horloge virtuelle : n'avance que par le travail ---------- */
let VCLK = 0, OPS = 0;
const tick = n => { OPS += n; VCLK += n * K; };
function mkCtx() {
  const grad = { addColorStop() {} }, fns = new Map();
  const base = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createRadialGradient: () => { tick(40); return grad; }, createLinearGradient: () => { tick(40); return grad; },
    createPattern: () => { tick(40); return {}; }, measureText: (s) => ({ width: (s || '').length * 7 }) };
  return new Proxy(base, { get: (t, p) => { if (p in t) return t[p]; let f = fns.get(p); if (!f) fns.set(p, f = () => { tick(1); }); return f; }, set: (t, p, v) => { t[p] = v; return true; } });
}
function mkStyle() { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: (k) => { delete s[k]; return ''; } }, getPropertyValue: { value: (k) => (s[k] || '') } }); return s; }
function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }; }
const doc = { activeElement: null };
function mkEl(id, tag) { const attrs = {}; const el = { id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {}, hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '', offsetWidth: 0, offsetHeight: 0, parentElement: null,
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 390, bottom: 780, width: 390, height: 780, x: 0, y: 0 }), setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
  closest: () => null, focus: () => { doc.activeElement = el; }, blur() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {} }; return el; }
function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; let c = null; el.getContext = () => c || (c = mkCtx()); return el; }
const stash = new Map();
Object.assign(doc, { hidden: false, getElementById(id) { if (!stash.has(id)) { const el = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvasEl(390, 780, id) : mkEl(id); if (id === 'cv') el.parentElement = mkEl('stage'); stash.set(id, el); } return stash.get(id); },
  createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)), querySelectorAll: () => [], querySelector: () => null, body: mkEl('body', 'body'), addEventListener() {} });
const win = { __SIM: true, devicePixelRatio: 3, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => VCLK }, requestAnimationFrame: win.requestAnimationFrame,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
/* contexte principal de V8 (comme test/trace.js) : l'horloge est virtuelle, mais autant ne pas payer
   la lenteur de vm pour des milliers d'images */
for (const k of Object.keys(sandbox)) Object.defineProperty(globalThis, k, { value: sandbox[k], writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
const call = (e) => vm.runInThisContext(e);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInThisContext(ORDER.map(readModule).join('\n'), { filename: 'game.js' });
/* (ne pas nommer une variable de ce module W, H, CH… : elle masquerait la globale du jeu) */
const AI = /const AI = `([\s\S]*?)`;/.exec(fs.readFileSync(path.join(__dirname, 'headless.js'), 'utf8'))[1];
vm.runInThisContext(AI, { filename: 'ai-test.js' });
call('boot()');

/* ---------- instrumentation : ne touche que des noms présents avant ET après PERF-2 ---------- */
let CALL = 0, M = null;
const START = new Map(), COST = new Map();
const oStep = globalThis.bakeStep, oStream = globalThis.streamWorld;
globalThis.bakeStep = function (c) {
  const fresh = !c.bk && !c.bake, t0 = VCLK, o0 = OPS, s = c.bk ? c.bk.s : -1; if (fresh) { START.set(c, CALL); COST.set(c, 0); }
  const r = oStep(c), dt = VCLK - t0; COST.set(c, (COST.get(c) || 0) + dt);
  if (M) { M.bake += dt; M.bakeOps += OPS - o0; if (dt > M.unit) { M.unit = dt; M.unitOps = OPS - o0; M.unitS = s; }
    if (r === true && START.get(c) === CALL) { M.whole++; M.wholeMs = Math.max(M.wholeMs || 0, COST.get(c)); if (M.budget == null || COST.get(c) > M.budget) M.horsBudget++; } }
  return r;
};
const visChunks = (x0, x1, y0, y1) => { const r = []; for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) { const c = getChunk(cx, cy); if (c) r.push(c); } return r; };
globalThis.streamWorld = function (b) {
  if (M) { M.miss += visChunks(VL, VR, VT, VB).filter(c => !c.bake).length ? 1 : 0; M.budget = b; }
  const r = oStream(b);
  if (M) { const hw = W / 2 / RZ, hh = H / 2 / RZ, sc = visChunks(CAM.x - hw, CAM.x + hw, CAM.y - hh, CAM.y + hh); M.screen += sc.filter(c => !c.bake).length ? 1 : 0;
    M.etat = sc.map(c => c.bake ? 'P' : c.bk ? 'e' + c.bk.s : '-').join(' ') + ' / marge ' + visChunks(VL, VR, VT, VB).length; }
  return r;
};
const oS = globalThis.step; globalThis.step = function () { VCLK += STEPC; return oS(); };
const begin = () => { CALL++; M = { bake: 0, bakeOps: 0, unit: 0, unitOps: 0, whole: 0, horsBudget: 0, miss: 0, screen: 0, budget: null }; return VCLK; };

/* entrée « course » : ligne droite, virage toutes les 4 s, dash dès que possible — la demande de
   chunks la plus forte qu'un joueur puisse créer */
const COURSE = `window.__SIM_INPUT=function(){const P=G.p;if(!P||P.dead)return;const a=Math.floor(G.t/240)*2.1;G.inX=Math.cos(a);G.inY=Math.sin(a);
  const d=Math.hypot(P.x,P.y);if(d>WR-900){G.inX=-P.x/d;G.inY=-P.y/d;}if(P.dashT<=0)tryDash();};`;

function partie(nom, prof, seed, entree) {
  call(`Math.__seed(${seed});meta.runs=5;meta.tuto=999;`);
  if (entree === 'course') { vm.runInThisContext(AI, { filename: 'ai-test.js' }); call(COURSE); } else vm.runInThisContext(AI, { filename: 'ai-test.js' });
  win.__SIM_PICK = (c) => c[Math.floor(call('Math.random()') * c.length)];
  let fin = false; win.__SIM_END = () => { fin = true; };
  const t0 = begin();
  call(`newRun(${JSON.stringify(prof)},false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;`);
  const lanc = Object.assign({ ms: VCLK - t0 }, M);
  const im = [];
  let ts = Math.ceil(VCLK / VS + 1) * VS;
  for (let i = 0; i < NFR && !fin; i++) {
    VCLK = ts; begin();
    call(`frame(${ts})`);
    im.push(Object.assign({ ms: VCLK - ts }, M));
    ts = Math.max(ts + VS, Math.ceil(VCLK / VS) * VS);
    if (['end', 'dying'].includes(call('G.state'))) break;
  }
  M = null;
  return { nom, lanc, im };
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const f1 = v => (v == null ? '-' : (+v).toFixed(1));
const res = [partie('IA bal', 'bal', 12345, 'ia'), partie('course scout', 'scout', 2718, 'course'), partie('course bal', 'bal', 999, 'course')];
console.log(`# cuisson ${REF ? 'git ' + REF : 'arbre de travail'} — modèle : ${K * 1000} µs/op canvas, ${STEPC} ms/pas, vsync 60 Hz, ${NFR} images max par partie`);
let pire = { bake: 0 }, pireU = { unit: 0 }, whole = 0;
for (const r of res) {
  const all = [r.lanc, ...r.im], im = r.im, n = im.length;
  whole += all.reduce((a, m) => a + m.horsBudget, 0);
  for (const m of all) { if (m.bake > pire.bake) pire = Object.assign({ ou: r.nom + (m === r.lanc ? ' / newRun' : ' / image') }, m); if (m.unit > pireU.unit) pireU = Object.assign({ ou: r.nom }, m); }
  const bud = im.map(m => m.budget).filter(v => v != null);
  console.log(`\n== ${r.nom} : ${n} images`);
  console.log(`  newRun         : ${f1(r.lanc.ms)} ms d'un bloc, dont cuisson ${f1(r.lanc.bake)} ms (${r.lanc.bakeOps} op), chunks entiers ${r.lanc.whole}`);
  console.log(`  image          : médiane ${f1(q(im.map(m => m.ms), .5))} ms, p99 ${f1(q(im.map(m => m.ms), .99))} ms, pire ${f1(Math.max(...im.map(m => m.ms)))} ms ; images > 16,7 ms : ${im.filter(m => m.ms > VS).length}`);
  console.log(`  cuisson/image  : médiane ${f1(q(im.map(m => m.bake), .5))} ms, p99 ${f1(q(im.map(m => m.bake), .99))} ms, pire ${f1(Math.max(...im.map(m => m.bake)))} ms ; total ${f1(im.reduce((a, m) => a + m.bake, 0))} ms`);
  console.log(`  budget demandé : médiane ${f1(q(bud, .5))} ms, min ${f1(Math.min(...bud))}, max ${f1(Math.max(...bud))}`);
  console.log(`  chunks entiers dans une image : ${im.reduce((a, m) => a + m.whole, 0)} (le plus cher : ${f1(Math.max(0, ...im.map(m => m.wholeMs || 0)))} ms, budget de l'image ${f1((im.find(m => m.whole) || {}).budget)} ms) ; plus grosse unité : ${f1(Math.max(...all.map(m => m.unit)))} ms`);
  if (ARG('detail')) for (let i = 0; i < +ARG('detail'); i++) console.log(`    image ${i} : ${f1(im[i].ms)} ms, budget ${f1(im[i].budget)}, cuisson ${f1(im[i].bake)} ms ; chunks à l'écran (P prêt, eN en cours à l'étape N) : ${im[i].etat}`);
  const fade = Math.ceil(900 / VS), mi = im.map((m, i) => m.miss ? i : -1).filter(i => i >= 0);
  console.log(`  cache vide (chunk visible pas prêt à l'entrée de streamWorld) : ${mi.length} images, dont ${mi.filter(i => i >= fade).length} après le fondu d'entrée (${fade} images)${mi.some(i => i >= fade) ? ' [images ' + mi.filter(i => i >= fade).slice(0, 12).join(',') + ']' : ''} ; chunk inachevé À L'ÉCRAN : ${im.filter(m => m.screen).length} images`);
}
const checks = [
  ['(a) aucun chunk entier d\'un bloc hors budget (newRun : aucun ; image : seulement s\'il tient dans son budget)', whole === 0, `${whole} chunk(s) entier(s) hors budget`],
  [`(b) travail de cuisson continu par appel <= ${PLAFOND} ms`, pire.bake <= PLAFOND, `pire ${f1(pire.bake)} ms (${pire.bakeOps} op) — ${pire.ou}`],
  [`(c) plus grosse unité indivisible <= ${UNITE} ms`, pireU.unit <= UNITE, `pire ${f1(pireU.unit)} ms (${pireU.unitOps} op, étape ${pireU.unitS} ; -1 = création + relief) — ${pireU.ou}`],
];
console.log('');
for (const [n, ok, d] of checks) console.log(`  ${ok ? 'OK   ' : 'ECHEC'} ${n}  — ${d}`);
const ok = checks.every(c => c[1]);
console.log(ok ? 'CUISSON : TOUT PASSE' : 'CUISSON : ECHEC');
process.exit(ok ? 0 : 1);
