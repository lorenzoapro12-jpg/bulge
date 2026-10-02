'use strict';
/* =========================================================
   Garde-fou de la cuisson du monde (PERF-2) — BULGE headless

   node test/cuisson.js              arbre de travail
   node test/cuisson.js --ref=HEAD   modules d'un commit git (sans rien écrire) : doit ÉCHOUER
                                     sur le code d'avant PERF-2
   node test/cuisson.js --k=5        coût d'une opération canvas, en µs (défaut 5)
   node test/cuisson.js --frames=N   images max par partie (défaut 45000 ; 2400 sur l'ancien monde continu)

   Le chronomètre du jeu (performance.now) est une HORLOGE VIRTUELLE qui n'avance que par le
   travail : K µs par opération canvas (40 K pour un dégradé ou un motif, comme bulge-verif/frames.js)
   et STEPC ms par pas de simulation. Le résultat ne dépend donc ni de la machine ni de la lenteur de
   `vm` : c'est un modèle d'appareil, pas une mesure de téléphone. K=5 µs met un chunk moyen vers
   20 ms, soit ~11x le contexte principal de V8 sur ce serveur (1,8 ms, blocages.js) : dans la plage
   « 5 à 20x plus lent » d'un téléphone. Le jeu est conduit par la VRAIE boucle frame() (g4.js) :
   les horodatages rAF tombent sur la grille vsync de 60 Hz, une image trop longue en saute.

   Refonte en îlots (02/10/2026) : chaque îlot est mis en file d'un bloc à son arrivée (islStart -> prewarm,
   36 chunks) et cuit ensuite image par image ; un îlot neuf arrive à chaque passage (cinématique « trans »,
   genIslet DANS une image). Trois parties traversent les 8 îlots par le VRAI chemin de passage (clearTick ->
   transStart -> updTrans) : « IA » joue pour de vrai (vagues, boss ; dégâts ×3, ~30 000 images) — le
   streaming en combat ; les deux « course » (demi-tour au-delà de PR-200 ; WR-900 sur l'ancien monde continu)
   enchaînent les ARRIVÉES : le pilote de test (hors jeu) clôt l'îlot (islClear) une fois sa file vidée et
   ISLF images jouées. Joueur invulnérable : on couvre les îlots, on ne teste pas l'équilibrage.

   Critères (chacun doit échouer sur l'ancien code, --ref=93b8cfe) :
   (a) aucun chunk entier d'un bloc (premier et dernier bakeStep d'un même chunk dans le même
       appel) hors budget : jamais dans newRun, qui n'a pas de budget ; dans une image, seulement
       si le coût du chunk tient dans le budget de cette image (un chunk léger sur un appareil
       rapide, c'est précisément ce que le budget adaptatif doit permettre). Le budget d'un chunk
       VISIBLE est au moins BURG ms (gw2.js, streamWorld : plancher délibéré, présent depuis PERF-2) ;
       avant les îlots aucun chunk ne coûtait moins de BURG et la distinction ne se voyait pas —
       un chunk de Grille néon (~2,3 ms) achevé dans ce plancher, pendant le passage, n'est pas un débord ;
   (b) le plus long travail de cuisson continu dans un appel (temps passé dans bakeStep) reste
       sous PLAFOND ms : budget maximal (0,6 × 16,7 = 10 ms) + une unité ;
   (c) la plus grosse unité indivisible (un seul appel à bakeStep) reste sous UNITE ms : ce que
       le budget ne peut pas interrompre est ce qui déborde.
   (d) jamais plus de GENMAX genChunk par image (hors newRun, hors lancement d'îlot et hors pilote de
       test) : streamWorld générait d'un bloc toute une rangée de sa fenêtre, hors budget (J1a) —
       --ref=04635d4 échoue. Le lancement d'îlot est l'équivalent de newRun pour les îlots 2 à 8 :
       genIslet + islStart (prewarm génère les 36 chunks de l'îlot), puis le premier rendu du nouvel
       îlot, plein cadre (zoomFull), qui touche toute la grille. Ce rendu ne doit générer QUE des
       chunks VIDES (hors de l'îlot : genChunk rend aussitôt) : un chunk utile généré là, hors
       prewarm, fait échouer (d). Le reste du lancement est compté à part, rapporté sans seuil ;
   (e) genChunk indépendant de l'ordre d'appel : la condition pour que (d) ne change pas le monde,
       et pour que le worker de cuisson (gk.js, qui régénère l'îlot et ses chunks dans l'ordre de
       SES demandes) cuise le même sol que la page. Îlots 1 à 8 de deux graines, toute la grille.
       RETIRÉ avec la refonte : le chunk « home » des pièces de monument (WD.lms est vide, il n'y a
       plus de monuments) ; le champ cachePos (plus de cache de chunk).
   Mesures rapportées sans seuil : images où un chunk visible n'était pas prêt à l'entrée de
   streamWorld (cache vide), images où un chunk inachevé est À L'ÉCRAN, images manquées (vsync),
   coût du lancement d'îlot (genChunk, opérations canvas, temps réel du contexte principal), et le
   cache de cuisson par îlot : chunks cuits (dont VIDES, hors de l'îlot) et RECUISSONS (chunk évincé
   puis recuit). « Jamais plus de ~25 chunks cuits, quel que soit l'îlot » (gw.js) n'est PAS tenu au
   02/10/2026 : la grille entière (81 chunks, dont 49 vides) est cuite, au-delà du plafond
   d'evictBakes (max(60, n+8)) — d'où des recuissons. Signalé, pas encore un critère.
   ========================================================= */
const vm = require('vm');
/* LIB et non L : un nom de ce module qui serait aussi une globale du jeu la masquerait ici */
const LIB = require('./lib');
const ARG = LIB.ARG;
const REF = ARG('ref'), K = +(ARG('k') || 5) / 1000, STEPC = 1.5, VS = 1000 / 60;
const PLAFOND = 12, UNITE = 4, GENMAX = 2, ISLF = 240;
const ORDER = LIB.ordre(REF).order, ILOTS = !ORDER.includes('gs.js'), NFR = +(ARG('frames') || (ILOTS ? 45000 : 2400));
const readModule = f => LIB.readModule(f, REF);

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
/* (ne pas nommer une variable de ce module W, H, CH… : elle masquerait la globale du jeu)
   IA de test : celle de test/lib.js pour le jeu en îlots ; sur un ancien commit (--ref=), celle de SON
   test/headless.js (l'IA d'aujourd'hui lit des champs que l'ancien jeu n'a pas) */
const AI = ILOTS ? LIB.AI : /const AI = `([\s\S]*?)`;/.exec(readModule('test/headless.js'))[1];
vm.runInThisContext(AI, { filename: 'ai-test.js' });
call('boot()');

/* ---------- instrumentation : ne touche que des noms présents avant ET après PERF-2 ---------- */
let CALL = 0, M = null;
const START = new Map(), COST = new Map(), NBK = new Map();
const oStep = globalThis.bakeStep, oStream = globalThis.streamWorld;
globalThis.bakeStep = function (c) {
  const fresh = !c.bk && !c.bake, t0 = VCLK, o0 = OPS, s = c.bk ? c.bk.s : -1; if (fresh) { START.set(c, CALL); COST.set(c, 0); NBK.set(c, (NBK.get(c) || 0) + 1); }
  const r = oStep(c), dt = VCLK - t0; COST.set(c, (COST.get(c) || 0) + dt);
  if (M) { M.bake += dt; M.bakeOps += OPS - o0; if (NBK.get(c) > 1) M.recu += dt; if (dt > M.unit) { M.unit = dt; M.unitOps = OPS - o0; M.unitS = s; }
    if (r === true && START.get(c) === CALL) { M.whole++; M.wholeMs = Math.max(M.wholeMs || 0, COST.get(c));
      const vu = c.cx >= Math.floor(VL / CH) && c.cx <= Math.floor(VR / CH) && c.cy >= Math.floor(VT / CH) && c.cy <= Math.floor(VB / CH);
      if (M.budget == null || COST.get(c) > Math.max(M.budget, vu && typeof BURG === 'number' ? BURG : 0)) M.horsBudget++; else if (COST.get(c) > M.budget) M.burg++; } }
  return r;
};
/* (d) générations par image, et qui les a demandées : streamWorld, ou le reste (rendu, simulation).
   La sonde visChunks ne génère RIEN (elle lit WD.chunks ; un chunk absent compte comme « pas prêt ») :
   sinon elle générerait avant streamWorld ce que la garde doit lui voir faire.
   Le PILOTE de test (ai-test.js : navBfs sonde pointHit loin devant) génère aussi ; ce n'est pas le jeu,
   il est compté à part (genP) et exclu du critère. Le lancement d'îlot (genIslet + islStart, îlots en
   cours de partie, PUIS le reste de cette image : le premier rendu plein cadre) est compté à part (genI),
   comme newRun ; mais un chunk UTILE (non vide) généré après islStart dans cette image compte (genIN). */
let DANS = 0, PILOTE = 0, LANCE = 0, NEUF = false;
const oGen = globalThis.genChunk;
const vide = (cx, cy) => Math.hypot(cx * CH + CH / 2, cy * CH + CH / 2) > WR + CH;   /* même test que genChunk : rien à générer */
globalThis.genChunk = function (cx, cy) { if (M) { if (PILOTE) M.genP++; else if (LANCE || NEUF) { M.genI++; if (!LANCE && !vide(cx, cy)) M.genIN++; } else { M.gen++; if (DANS) M.genS++; } } return oGen(cx, cy); };
const pilote = () => { const f = win.__SIM_INPUT; if (f) win.__SIM_INPUT = function () { PILOTE++; try { return f.apply(this, arguments); } finally { PILOTE--; } }; };
/* lancement d'îlot : temps RÉEL du contexte principal (indicatif, pas un seuil) et opérations canvas */
if (ILOTS) for (const n of ['genIslet', 'islStart']) {
  const o = globalThis[n];
  globalThis[n] = function () { const top = !LANCE, h0 = process.hrtime.bigint(), o0 = OPS; LANCE++; NEUF = true;
    try { return o.apply(this, arguments); } finally { LANCE--; if (M) { M.lanOps += OPS - o0; if (top) M.lanMs += Number(process.hrtime.bigint() - h0) / 1e6; } } };
}
const visChunks = (x0, x1, y0, y1) => { const r = []; for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) { const ix = cx + COFF, iy = cy + COFF; if (ix < 0 || iy < 0 || ix >= NC || iy >= NC) continue; r.push(WD.chunks[ix * NC + iy] || {}); } return r; };
globalThis.streamWorld = function (b) {
  if (M) { M.miss += visChunks(VL, VR, VT, VB).filter(c => !c.bake).length ? 1 : 0; M.budget = b; }
  DANS++; let r; try { r = oStream(b); } finally { DANS--; }
  if (M) { const hw = W / 2 / RZ, hh = H / 2 / RZ, sc = visChunks(CAM.x - hw, CAM.x + hw, CAM.y - hh, CAM.y + hh); M.screen += sc.filter(c => !c.bake).length ? 1 : 0;
    M.etat = sc.map(c => c.bake ? 'P' : c.bk ? 'e' + c.bk.s : '-').join(' ') + ' / marge ' + visChunks(VL, VR, VT, VB).length; }
  return r;
};
const oS = globalThis.step; globalThis.step = function () { VCLK += STEPC; return oS(); };
const begin = () => { CALL++; NEUF = false; M = { bake: 0, bakeOps: 0, unit: 0, unitOps: 0, whole: 0, horsBudget: 0, burg: 0, recu: 0, miss: 0, screen: 0, budget: null, gen: 0, genS: 0, genP: 0, genI: 0, genIN: 0, lanOps: 0, lanMs: 0, isl: 0 }; return VCLK; };

/* entrée « course » : ligne droite, virage toutes les 4 s, dash dès que possible — la demande de
   chunks la plus forte qu'un joueur puisse créer ; demi-tour au bord de l'îlot (PR-200), ou à WR-900
   sur l'ancien monde continu. Membrane entretenue (comme __SIM_GOD) : la course ne se défend pas. */
const COURSE = `window.__SIM_INPUT=function(){const P=G.p;if(!P||P.dead)return;const il=typeof PR==='number';
  if(il){P.inv=Math.max(P.inv,3);if(P.seg<P.segMax)P.seg=P.segMax;}const a=Math.floor(G.t/240)*2.1;G.inX=Math.cos(a);G.inY=Math.sin(a);
  const d=Math.hypot(P.x,P.y);if(d>(il?PR-200:WR-900)){G.inX=-P.x/d;G.inY=-P.y/d;}if(P.dashT<=0)tryDash();};`;

function partie(nom, seed, entree) {
  call(`Math.__seed(${seed});meta.runs=5;${ILOTS ? '' : 'meta.tuto=999;'}`);
  vm.runInThisContext(AI, { filename: 'ai-test.js' }); if (entree === 'course') call(COURSE); else call('window.__SIM_GOD=1;window.__SIM_BOOST=3');
  pilote();
  win.__SIM_PICK = (c) => c[Math.floor(call('Math.random()') * c.length)];
  let fin = false; win.__SIM_END = () => { fin = true; };
  const t0 = begin();
  call(LIB.startCode(REF));
  const lanc = Object.assign({ ms: VCLK - t0 }, M);
  const im = [], vus = [], rebake = [];
  let ts = Math.ceil(VCLK / VS + 1) * VS, isl = 0, jeu = 0, wd = null;
  /* un îlot quitté (wd : SON monde, genIslet a déjà remplacé WD) : ses chunks cuits plus d'une fois (évincés puis recuits) */
  const bilan = () => { if (!ILOTS || !wd) return; let n = 0, nv = 0, x = 0, xu = 0;
    for (const c of wd.chunks) { const b = c && NBK.get(c); if (!b) continue; n++; if (vide(c.cx, c.cy)) nv++; else xu += b - 1; x += b - 1; }
    rebake.push([isl, n, nv, x, xu]); };
  for (let i = 0; i < NFR && !fin; i++) {
    if (ILOTS) {
      if (WD !== wd) { bilan(); wd = WD; isl = call('G.isl'); jeu = 0; vus.push(isl); }
      /* pilote (hors jeu, hors mesure) : l'îlot est cuit et joué depuis ISLF images -> on le clôt, le passage suit */
      if (entree === 'course' && call(`G.state==='play'`) && ++jeu >= ISLF && call(`(!WD.pq||!WD.pq.length)&&['wave','pause','preboss'].includes(G.ph)`)) { M = null; call('islClear()'); }
    }
    VCLK = ts; begin(); M.isl = isl; M.pas = call('G.state') === 'trans';
    call(`frame(${ts})`);
    im.push(Object.assign({ ms: VCLK - ts }, M));
    ts = Math.max(ts + VS, Math.ceil(VCLK / VS) * VS);
    if (['end', 'dying'].includes(call('G.state'))) break;
  }
  bilan();
  M = null;
  return { nom, lanc, im, vus, rebake, fin };
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const f1 = v => (v == null ? '-' : (+v).toFixed(1));
const res = [partie('IA', 12345, 'ia'), partie('course A', 2718, 'course'), partie('course B', 999, 'course')];
console.log(`# cuisson ${REF ? 'git ' + REF : 'arbre de travail'} — modèle : ${K * 1000} µs/op canvas, ${STEPC} ms/pas, vsync 60 Hz, ${NFR} images max par partie`);
let pire = { bake: 0 }, pireU = { unit: 0 }, whole = 0, burg = 0, pireG = { gen: 0, genS: 0 }, genIN = 0, genIND = '', nIsl = 0, rebake = 0, rebakeU = 0;
for (const r of res) {
  for (const m of r.im) if (m.gen > pireG.gen) pireG = Object.assign({ ou: r.nom }, m);
  const all = [r.lanc, ...r.im], im = r.im, n = im.length;
  whole += all.reduce((a, m) => a + m.horsBudget, 0); burg += all.reduce((a, m) => a + m.burg, 0);
  for (const m of all) if (m.genIN) { genIN += m.genIN; genIND = genIND || `${r.nom}, arrivée sur l'îlot ${m.isl + 1}`; }
  for (const m of all) { if (m.bake > pire.bake) pire = Object.assign({ ou: r.nom + (m === r.lanc ? ' / newRun' : ' / image' + (m.isl ? ', îlot ' + m.isl : '')) }, m); if (m.unit > pireU.unit) pireU = Object.assign({ ou: r.nom + (m.isl ? ', îlot ' + m.isl : '') }, m); }
  const bud = im.map(m => m.budget).filter(v => v != null);
  console.log(`\n== ${r.nom} : ${n} images${ILOTS ? ` ; îlots ${r.vus.join(',')}${r.fin ? ' (partie gagnée)' : ''}` : ''}`);
  console.log(`  newRun         : ${f1(r.lanc.ms)} ms d'un bloc, dont cuisson ${f1(r.lanc.bake)} ms (${r.lanc.bakeOps} op), chunks entiers ${r.lanc.whole}`);
  console.log(`  image          : médiane ${f1(q(im.map(m => m.ms), .5))} ms, p99 ${f1(q(im.map(m => m.ms), .99))} ms, pire ${f1(Math.max(...im.map(m => m.ms)))} ms ; images > 16,7 ms : ${im.filter(m => m.ms > VS).length}`);
  console.log(`  cuisson/image  : médiane ${f1(q(im.map(m => m.bake), .5))} ms, p99 ${f1(q(im.map(m => m.bake), .99))} ms, pire ${f1(Math.max(...im.map(m => m.bake)))} ms ; total ${f1(im.reduce((a, m) => a + m.bake, 0))} ms${ILOTS ? `, dont recuissons ${f1(im.reduce((a, m) => a + m.recu, 0))} ms` : ''}`);
  console.log(`  budget demandé : médiane ${f1(q(bud, .5))} ms, min ${f1(Math.min(...bud))}, max ${f1(Math.max(...bud))}`);
  console.log(`  chunks entiers dans une image : ${im.reduce((a, m) => a + m.whole, 0)}, dont ${im.reduce((a, m) => a + m.burg, 0)} visibles achevés dans le plancher BURG au-delà du budget (le plus cher : ${f1(Math.max(0, ...im.map(m => m.wholeMs || 0)))} ms, budget de l'image ${f1((im.find(m => m.whole) || {}).budget)} ms) ; plus grosse unité : ${f1(Math.max(...all.map(m => m.unit)))} ms`);
  const gm = im.reduce((a, m) => (m.gen > a.gen ? m : a), { gen: 0, genS: 0 });
  console.log(`  genChunk/image : pire ${gm.gen} (dont ${gm.genS} par streamWorld) ; total ${im.reduce((a, m) => a + m.gen, 0)} dans les images, ${r.lanc.gen + r.lanc.genI} dans newRun ; images à plus de ${GENMAX} : ${im.filter(m => m.gen > GENMAX).length} ; pilote de test (hors critère) : ${im.reduce((a, m) => a + m.genP, 0)}`);
  if (ILOTS) { const li = im.filter(m => m.genI || m.lanOps);
    console.log(`  lancement d'îlot (image du passage, hors critère d sauf chunk utile) : ${li.length} ; genChunk ${li.map(m => m.genI + (m.genIN ? '(' + m.genIN + ' utiles hors prewarm)' : '')).join(',')} ; op canvas ${li.map(m => m.lanOps).join(',')} ; image ${li.map(m => f1(m.ms)).join(',')} ms (virtuel) ; genIslet+islStart ${li.map(m => f1(m.lanMs)).join(',')} ms réels (contexte principal, indicatif)`);
    console.log(`  cache de cuisson [îlot:cuits/vides/recuissons/dont utiles] : ${r.rebake.map(a => a.join('/').replace('/', ':')).join(' ')}`);
    nIsl += r.rebake.length; for (const a of r.rebake) { rebake += a[3]; rebakeU += a[4]; } }
  if (ARG('detail')) for (let i = 0; i < +ARG('detail'); i++) console.log(`    image ${i} : ${f1(im[i].ms)} ms, budget ${f1(im[i].budget)}, cuisson ${f1(im[i].bake)} ms ; chunks à l'écran (P prêt, eN en cours à l'étape N) : ${im[i].etat}`);
  const fade = Math.ceil(900 / VS), mi = im.map((m, i) => m.miss ? i : -1).filter(i => i >= 0);
  console.log(`  cache vide (chunk visible pas prêt à l'entrée de streamWorld) : ${mi.length} images, dont ${mi.filter(i => i >= fade).length} après le fondu d'entrée (${fade} images)${mi.some(i => i >= fade) ? ' [images ' + mi.filter(i => i >= fade).slice(0, 12).join(',') + ']' : ''} ; chunk inachevé À L'ÉCRAN : ${im.filter(m => m.screen).length} images${ILOTS ? `, dont ${im.filter(m => m.screen && !m.pas).length} hors passage (cache vide hors passage après le fondu : ${mi.filter(i => i >= fade && !im[i].pas).length})` : ''}`);
}
/* (e) la PREUVE que borner la génération ne change pas le monde : pour une même graine (et, en îlots, un même
   îlot), tous les chunks de la grille générés dans trois ordres (lignes, inverse, mélangé) donnent le même
   contenu — obstacles (falaises comprises), vie ; sur l'ancien monde continu, aussi le cache et le chunk qui
   revendique chaque pièce de monument (p.home, seul état partagé écrit) */
const ORDRE = (() => {
  const cells = []; for (let ix = 0; ix < NC; ix++) for (let iy = 0; iy < NC; iy++) cells.push([ix - COFF, iy - COFF]);
  const sans = (k, v) => (k === 'home' || k === 'spr' || k === 'su' ? undefined : v);
  const empreinte = (gen, ordre) => { call(gen); for (const [cx, cy] of ordre) getChunk(cx, cy);
    const h = cells.map(([cx, cy]) => { const c = getChunk(cx, cy); return JSON.stringify([c.obs, c.live, c.cachePos], sans); });
    if (!ILOTS) for (const L of WD.lms) for (const p of L.parts) h.push(p.home ? p.home.cx + ',' + p.home.cy : '-');
    return require('crypto').createHash('sha256').update(h.join('\n')).digest('hex').slice(0, 12); };
  let s = 7; const mel = cells.slice(); for (let i = mel.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [mel[i], mel[j]] = [mel[j], mel[i]]; }
  const d = [], mondes = [];
  for (const seed of [12345, 2718]) if (ILOTS) for (let k = 1; k <= call('NISL'); k++) mondes.push([seed + '/' + k, `RELSNAP=null;genIslet(${seed},${k})`]); else mondes.push([seed, `genWorld(${seed})`]);
  for (const [nom, gen] of mondes) d.push(nom + ' : ' + [cells, cells.slice().reverse(), mel].map(o => empreinte(gen, o)).join(' '));
  return { n: cells.length, m: mondes.length, ok: d.every(l => new Set(l.split(' : ')[1].split(' ')).size === 1), d: d.join(' ; ') };
})();
const checks = [
  ['(a) aucun chunk entier d\'un bloc hors budget (newRun : aucun ; image : seulement s\'il tient dans son budget)', whole === 0, `${whole} chunk(s) entier(s) hors budget${burg ? ` (et ${burg} chunk(s) visible(s) achevé(s) dans le plancher BURG, au-delà du budget de l'image : permis)` : ''}`],
  [`(b) travail de cuisson continu par appel <= ${PLAFOND} ms`, pire.bake <= PLAFOND, `pire ${f1(pire.bake)} ms (${pire.bakeOps} op) — ${pire.ou}`],
  [`(c) plus grosse unité indivisible <= ${UNITE} ms`, pireU.unit <= UNITE, `pire ${f1(pireU.unit)} ms (${pireU.unitOps} op, étape ${pireU.unitS} ; -1 = création + relief) — ${pireU.ou}`],
  [`(d) jamais plus de ${GENMAX} genChunk par image (la génération est bornée comme la cuisson)${ILOTS ? ' ; au lancement d\'îlot, aucun chunk utile hors prewarm' : ''}`, pireG.gen <= GENMAX && genIN === 0,
    `pire ${pireG.gen} genChunk dans une image, dont ${pireG.genS} par streamWorld${pireG.genS > GENMAX ? ' (une rangée entière de la fenêtre de streaming générée d\'un bloc, hors budget)' : ''} — ${pireG.ou || '-'}`
    + (ILOTS ? ` ; lancement d'îlot : ${genIN ? genIN + ' chunk(s) UTILE(S) générés hors prewarm (' + genIND + ') : l\'îlot n\'était pas entier dans la file' : 'seuls des chunks vides hors prewarm'}` : '')],
  [`(e) genChunk indépendant de l'ordre d'appel (${ORDRE.n} chunks, 3 ordres, ${ORDRE.m} ${ILOTS ? 'îlots (graines 12345 et 2718, îlots 1 à 8)' : 'mondes (graines 12345 et 2718)'})`, ORDRE.ok, ORDRE.d],
];
console.log('');
for (const [n, ok, d] of checks) console.log(`  ${ok ? 'OK   ' : 'ECHEC'} ${n}  — ${d}`);
const ok = checks.every(c => c[1]);
console.log(`CUISSON : ${ok ? 'TOUT PASSE' : 'ECHEC'} — ${checks.filter(c => c[1]).length}/${checks.length} critères ; ${res.length} parties${ILOTS ? ', ' + nIsl + ' îlots' : ''} ; cuisson pire ${f1(pire.bake)} ms/appel, unité ${f1(pireU.unit)} ms, genChunk ${pireG.gen}/image${ILOTS ? ` ; recuissons ${rebake} (dont ${rebakeU} utiles)` : ''}`);
process.exit(ok ? 0 : 1);
