'use strict';
/* =========================================================
   MESURE : combien d'opérations canvas par IMAGE ? — BULGE headless

   node test/ops-image.js               les deux qualités × (immobile, en déplacement)
   node test/ops-image.js --images=N    images mesurées par scénario (défaut 300)
   node test/ops-image.js --chauffe=N   images de chauffe MINIMALES, joueur immobile, non comptées (défaut 180) ; la chauffe
                                        dure jusqu'à 60 images de suite sans cuisson
   node test/ops-image.js --resume      seulement le tableau résumé et l'empreinte
   node test/ops-image.js --k=5         coût d'une opération, en µs, pour l'HORLOGE VIRTUELLE (défaut 5)
   node test/ops-image.js --ref=HEAD    modules d'un commit git (sans rien écrire)

   C'est un INSTRUMENT, pas une garde : aucun seuil, code de sortie 0 sauf si la mesure elle-même est
   invalide (partie sortie de « play », qualité qui a bougé, joueur qui n'a pas avancé). Des COMPTES, pas
   des durées : sous `vm` un compte est exact, un temps ne l'est pas — ne rien conclure sur le temps.

   Une image = un appel à la VRAIE boucle frame(ts) (g4.js), ts sur la grille 1000/60. Chaque appel de
   méthode d'un contexte 2D est compté (stub compteur repris de test/art.js, sans le journal), et rangé
   dans UNE catégorie :
     écran    : émis sur MAINCTX (le canvas affiché), hors cuisson — c'est le RENDU proprement dit ;
     cuisson  : émis pendant bakeStep (gw2.js), quel que soit le contexte ;
     autre    : émis sur un canvas hors écran, hors cuisson (sprites d'obstacles, caches).
   « dans render() » = tout ce qui est émis entre l'entrée et la sortie de render() — streamWorld, donc la
   cuisson sur place, est appelé DEPUIS render (g3.js:99). Les AFFECTATIONS d'état (fillStyle=, globalAlpha=…)
   sont comptées à part : ce ne sont pas des appels. (test/art.js, lui, additionne appels et affectations.)

   Ce qui est FIGÉ pour que le compte soit celui de la qualité annoncée, et pas celui d'une régulation :
     - meta.q = 'high' | 'mid' (QL/RES vérifiés à chaque image : la mesure échoue s'ils bougent) ;
     - SKIPD = 0 avant chaque image (tout est dessiné) ; SKIPD 1 et 2 sont donnés à part, sur render(1,16).
   Écran : 411×757 px CSS, pointeur tactile, devicePixelRatio 3 -> canvas 514×946 en QL=2 (PS 1,25),
   617×1136 en QL=3 (PS 1,50).

   HORLOGE VIRTUELLE (comme test/cuisson.js) : performance.now n'avance que par le travail, K µs par appel
   (40 K pour un dégradé ou un motif), 1,5 ms par pas de simulation. Elle ne sert qu'à une chose : le budget
   de cuisson par image (bakeBudget) en dépend, donc la RÉPARTITION de la cuisson entre les images aussi.
   Le compte « écran » n'en dépend pas ; le compte « cuisson par image » est celui de ce modèle (--k=).
   Pas de Worker sous `vm` : la cuisson se fait SUR PLACE (le repli), alors que le défaut du jeu en
   navigateur est le worker — voir « non mesuré » en fin de sortie.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), NIM = +(ARG('images') || 300), NCH = +(ARG('chauffe') || 180), K = +(ARG('k') || 5) / 1000, STEPC = 1.5, VS = 1000 / 60;
const LW = 411, LH = 757, RESUME = !!ARG('resume'), CHMAX = 1500;
const L = require('./lib'), ORDER = L.ordre(REF).order, readModule = f => L.readModule(f, REF), DEBUT = L.startCode(REF);
const CODE = ORDER.map(readModule).join('\n');
const CAT = ['ecran', 'cuisson', 'autre'];

function build() {
  /* ---------- compteur ---------- */
  let VCLK = 0, inBake = 0, inRender = 0, ON = false, I = null;
  const M = { ecran: new Map(), cuisson: new Map(), autre: new Map(), set: new Map(), toile: new Map() };
  const neuf = () => ({ ecran: 0, cuisson: 0, autre: 0, rendu: 0, renduEcran: 0, set: 0, setEcran: 0, pas: 0, fin: 0, bk: 0 });
  I = neuf();
  /* main : l'élément canvas visé (son drapeau __main dit si c'est l'écran) */
  const rec = (main, n, w) => {
    VCLK += K * (w || 1); if (!ON) return;
    const c = inBake ? 'cuisson' : main.__main ? 'ecran' : 'autre';
    if (c === 'autre') { const t = main.width + '×' + main.height; M.toile.set(t, (M.toile.get(t) || 0) + 1); }
    I[c]++; if (inRender) { I.rendu++; if (c === 'ecran') I.renduEcran++; }
    M[c].set(n, (M[c].get(n) || 0) + 1);
  };
  const recSet = (main, p) => { if (!ON) return; I.set++; if (main.__main && !inBake) I.setEcran++; M.set.set(p, (M.set.get(p) || 0) + 1); };
  function mkCtx(main) {
    const mkGrad = () => ({ addColorStop() { rec(main, 'addColorStop'); } }), fns = new Map();
    const base = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
      createRadialGradient: () => { rec(main, 'createRadialGradient', 40); return mkGrad(); }, createLinearGradient: () => { rec(main, 'createLinearGradient', 40); return mkGrad(); },
      createPattern: () => { rec(main, 'createPattern', 40); return {}; }, measureText: s => { rec(main, 'measureText'); return { width: (s || '').length * 7 }; } };
    return new Proxy(base, { get: (t, p) => { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; let f = fns.get(p); if (!f) fns.set(p, f = () => { rec(main, p); }); return f; },
      set: (t, p, v) => { recSet(main, String(p)); t[p] = v; return true; } });
  }
  /* ---------- stub DOM (test/art.js), écran 411×757 tactile ---------- */
  const mkStyle = () => { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: k => { delete s[k]; return ''; } }, getPropertyValue: { value: k => (s[k] || '') } }); return s; };
  const mkEl = () => ({ style: mkStyle(), classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild(c) { return c; }, after() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: LW, bottom: LH, width: LW, height: LH, x: 0, y: 0 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
  const mkCanvas = (w, h, main) => { let c = null; const el = Object.assign(mkEl(), { width: w || 300, height: h || 150, __main: !!main, getContext: () => c || (c = mkCtx(el)) }); return el; };
  const stash = new Map();
  const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(LW, LH, id === 'cv') : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
    createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false, activeElement: null };
  /* minuteries virtuelles (test/headless.js) : avancent d'une période par image */
  let CLOCK = 0, TID = 0; const TIMERS = [];
  const advance = ms => { const end = CLOCK + ms; for (;;) { let k = -1; for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i; if (k < 0) break; const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn(); } CLOCK = end; };
  const H = { b(d) { inBake += d; if (d > 0 && ON) I.bk++; }, fin() { if (ON) I.fin++; }, r(d) { inRender += d; }, s() { VCLK += STEPC; if (ON) I.pas++; } };
  const win = { __SIM: true, devicePixelRatio: 3, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
  const sb = { window: win, document: doc, console, __H: H, matchMedia: q => ({ matches: /pointer:\s*coarse/.test(q) }), localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => VCLK }, requestAnimationFrame: () => 0,
    setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; }, clearTimeout: id => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); }, setInterval: () => 0, clearInterval() {},
    getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
  sb.globalThis = sb;
  const ctx = vm.createContext(sb), call = e => vm.runInContext(e, ctx);
  /* Math.random à graine, comme test/headless.js : même monde, même partie à chaque lancement */
  call(`(function(){let s=1;Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
  vm.runInContext(CODE, ctx, { filename: 'game.js' });
  /* sondes : aucune modification du jeu, les trois fonctions globales sont enveloppées depuis le test */
  call(`(function(){const b=bakeStep,r=render,s=step;
    bakeStep=function(c){__H.b(1);try{const f=b(c);if(f)__H.fin();return f;}finally{__H.b(-1);}};
    render=function(A,dt){__H.r(1);try{return r(A,dt);}finally{__H.r(-1);}};
    step=function(){__H.s();return s();};})();
    var PIL={x:0,y:0};window.__SIM_INPUT=function(){G.inX=PIL.x;G.inY=PIL.y;G.aimMan=false;};`);
  let ts = 0;
  return {
    call, M,
    compte(on) { ON = on; },
    /* une image : la vraie frame(ts). Rend le compte de l'image. */
    image() { I = neuf(); ts += VS; call('SKIPD=0;SKS=0;SKBAD=false;'); call('frame')(ts); advance(VS); const r = I; I = neuf(); return r; },
    /* un bloc de code quelconque, compté comme une « image » */
    bloc(e) { I = neuf(); const was = ON; ON = true; call(e); ON = was; const r = I; I = neuf(); return r; },
    raz() { for (const k in M) M[k].clear(); },
  };
}

/* ---------- un scénario : qualité × (immobile | déplacement) ---------- */
function mesure(q, bouge) {
  const B = build(), call = B.call, err = [];
  call(`meta.q=${JSON.stringify(q)};resize();applyQuality();refReset();`);
  const dem = B.bloc(DEBUT);
  const etat = () => JSON.parse(call(`JSON.stringify({QL,RES,PS,cw:cv.width,ch:cv.height,W,H,st:G.state,x:G.p.x,y:G.p.y,en:G.en.length,pb:G.pb.length,eb:G.eb.length,pus:G.pus.length,fx:G.fx.length,isl:G.isl,ph:G.ph,touch:inp.touch,wk:!!WK})`));
  const e0 = etat(), QL0 = e0.QL, RES0 = e0.RES;
  /* chauffe, joueur immobile : le monde du départ finit de cuire, les sprites se construisent */
  const ch = neufSomme();
  /* … jusqu'à 60 images de suite sans un seul bakeStep (au moins NCH images, au plus CHMAX) : l'axe « immobile » part d'un monde cuit */
  let nch = 0, calme = 0; B.compte(true);
  while (nch < CHMAX && (nch < NCH || calme < 60)) { const r = B.image(); ajoute(ch, r); nch++; calme = r.bk ? 0 : calme + 1; }
  if (calme < 60) err.push('chauffe : la cuisson du départ n’est pas finie après ' + nch + ' images');
  B.raz();
  const e1 = etat();
  /* pilote : cap fixe ; s'il bute (moins de 30 px en 30 images), il tourne d'un quart de tour */
  const caps = [[1, 0], [0, 1], [-1, 0], [0, -1]]; let cap = 0, px = e1.x, py = e1.y, dist = 0, virages = 0, lx = e1.x, ly = e1.y;
  if (bouge) call(`PIL.x=1;PIL.y=0;`);
  const ims = [], etats = {};
  for (let i = 0; i < NIM; i++) {
    const r = B.image(), e = etat(); ims.push(r);
    etats[e.st] = (etats[e.st] || 0) + 1;
    if (e.QL !== QL0 || e.RES !== RES0) err.push(`image ${i} : qualité passée à QL=${e.QL} RES=${e.RES}`);
    dist += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y;
    if (bouge && i % 30 === 29) { if (Math.hypot(e.x - lx, e.y - ly) < 30) { cap = (cap + 1) % 4; virages++; call(`PIL.x=${caps[cap][0]};PIL.y=${caps[cap][1]};`); } lx = e.x; ly = e.y; }
  }
  const e2 = etat(), Mw = {}; for (const k in B.M) Mw[k] = new Map(B.M[k]);
  B.compte(false);
  /* l'appel LITTÉRAL render(1,16) sur l'état final, puis les crans du filet SKIPD (1 : sans décoratif, 2 : sans halos) */
  const lit = [0, 1, 2].map(s => B.bloc(`SKIPD=${s};render(1,16);SKIPD=0;`));
  if (Object.keys(etats).some(s => s !== 'play')) err.push('partie sortie de « play » : ' + JSON.stringify(etats));
  if (bouge && dist < 200) err.push('le joueur n’a pas avancé (' + dist.toFixed(0) + ' px) : axe 4 non mesuré');
  if (!bouge && dist > 1) err.push('le joueur immobile a bougé de ' + dist.toFixed(1) + ' px');
  return { q, bouge, e0, e1, e2, dem, ch, nch, ims, M: Mw, lit, dist, virages, err };
}
function neufSomme() { return { ecran: 0, cuisson: 0, autre: 0, rendu: 0, renduEcran: 0, set: 0, setEcran: 0, pas: 0, fin: 0, bk: 0 }; }
function ajoute(s, r) { for (const k in s) s[k] += r[k]; return s; }

/* ---------- sortie ---------- */
const tot = r => r.ecran + r.cuisson + r.autre;
const st = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length, sum = s.reduce((x, y) => x + y, 0); return { sum, moy: sum / n, min: s[0], med: s[n >> 1], max: s[n - 1] }; };
const f1 = v => v.toFixed(1), pad = (s, n) => String(s).padStart(n), padE = (s, n) => String(s).padEnd(n);
const ligne = (nom, a) => { if (RESUME) return; const s = st(a); console.log('  ' + padE(nom, 44) + pad(f1(s.moy), 10) + pad(s.min, 9) + pad(s.med, 9) + pad(s.max, 9) + pad(s.sum, 11)); };
const SORTIE = [];
function rapport(R) {
  const n = R.ims.length, e = R.e2, console = RESUME ? { log() {} } : global.console;
  console.log(`\n================ QL=${e.QL} / RES=${e.RES} (meta.q=${R.q}) · PS=${e.PS.toFixed(2)} · canvas ${e.cw}×${e.ch} · dessin ${e.W}×${e.H} · tactile=${e.touch} · ${R.bouge ? 'EN DÉPLACEMENT' : 'IMMOBILE'} ================`);
  console.log(`  ${n} images mesurées après ${R.nch} de chauffe · état « ${e.st} » · worker=${e.wk} (cuisson sur place) · déplacement ${R.dist.toFixed(0)} px${R.bouge ? ' (' + R.virages + ' virage(s) du pilote)' : ''}`);
  console.log(`  scène en fin de mesure : ${e.en} ennemis, ${e.pb} tirs joueur, ${e.eb} tirs ennemis, ${e.pus} power-ups, ${e.fx} effets, îlot ${e.isl} phase « ${e.ph} »   (début : ${R.e1.en} ennemis, ${R.e1.fx} effets)`);
  console.log(`  avant la mesure (non compté dans les tableaux) : démarrage (newRun) ${tot(R.dem)} appels dont cuisson ${R.dem.cuisson} ; chauffe ${tot(R.ch)} appels dont cuisson ${R.ch.cuisson}, ${R.ch.fin} chunks finis`);
  console.log('  ' + padE('APPELS canvas PAR IMAGE', 44) + pad('moyenne', 10) + pad('min', 9) + pad('médiane', 9) + pad('max', 9) + pad('somme', 11));
  ligne('1. image complète frame() — tous contextes', R.ims.map(tot));
  ligne('2. dans render() — tous contextes', R.ims.map(r => r.rendu));
  ligne('   dont ÉCRAN (MAINCTX, hors cuisson)', R.ims.map(r => r.renduEcran));
  ligne('   ÉCRAN, toute l’image', R.ims.map(r => r.ecran));
  ligne('   CUISSON (dans bakeStep)', R.ims.map(r => r.cuisson));
  ligne('   AUTRE hors écran (sprites, caches)', R.ims.map(r => r.autre));
  ligne('   hors render() (frame − render)', R.ims.map(r => tot(r) - r.rendu));
  ligne('   affectations d’état (à part), toutes', R.ims.map(r => r.set));
  ligne('   affectations d’état sur l’ÉCRAN', R.ims.map(r => r.setEcran));
  ligne('   pas de simulation step()', R.ims.map(r => r.pas));
  ligne('   appels à bakeStep', R.ims.map(r => r.bk));
  ligne('   chunks FINIS de cuire', R.ims.map(r => r.fin));
  const S = ajoute(neufSomme(), { ecran: 0, cuisson: 0, autre: 0, rendu: 0, renduEcran: 0, set: 0, setEcran: 0, pas: 0, fin: 0, bk: 0 }); for (const r of R.ims) ajoute(S, r);
  const T = tot(S);
  console.log(`  part du total sur ${n} images : écran ${S.ecran} (${(100 * S.ecran / T).toFixed(1)} %) · cuisson ${S.cuisson} (${(100 * S.cuisson / T).toFixed(1)} %) · autre hors écran ${S.autre} (${(100 * S.autre / T).toFixed(1)} %) · total ${T}`);
  /* images rangées par nombre de chunks finis dans l'image, et par présence de cuisson */
  const gr = (nom, f) => { const a = R.ims.filter(f); if (!a.length) { console.log(`  ${padE(nom, 34)} 0 image`); return; }
    console.log(`  ${padE(nom, 34)} ${pad(a.length, 4)} images · total/image moy ${f1(st(a.map(tot)).moy)} (min ${st(a.map(tot)).min}, max ${st(a.map(tot)).max}) · écran ${f1(st(a.map(r => r.ecran)).moy)} · cuisson ${f1(st(a.map(r => r.cuisson)).moy)} (max ${st(a.map(r => r.cuisson)).max}) · autre ${f1(st(a.map(r => r.autre)).moy)}`); };
  console.log('  par type d’image :');
  gr('sans aucune cuisson', r => r.cuisson === 0); gr('avec cuisson, 0 chunk fini', r => r.cuisson > 0 && r.fin === 0); gr('1 chunk fini dans l’image', r => r.fin === 1); gr('2 chunks finis ou plus', r => r.fin >= 2);
  /* méthodes */
  const noms = new Set(); for (const c of CAT) for (const k of R.M[c].keys()) noms.add(k);
  const rows = [...noms].map(k => ({ k, e: R.M.ecran.get(k) || 0, c: R.M.cuisson.get(k) || 0, a: R.M.autre.get(k) || 0 })); for (const r of rows) r.t = r.e + r.c + r.a;
  const table = (titre, cle, tt) => { console.log(`  ${titre}`); console.log('    ' + padE('méthode', 24) + pad('par image', 11) + pad('somme', 10) + pad('part', 8) + '   (par image : écran / cuisson / autre)');
    const s = rows.filter(r => r[cle] > 0).sort((x, y) => y[cle] - x[cle] || (x.k < y.k ? -1 : 1)); let cum = 0;
    s.slice(0, 10).forEach(r => { cum += r[cle]; console.log('    ' + padE(r.k, 24) + pad((r[cle] / n).toFixed(2), 11) + pad(r[cle], 10) + pad((100 * r[cle] / tt).toFixed(1) + ' %', 8) + `   ${(r.e / n).toFixed(2)} / ${(r.c / n).toFixed(2)} / ${(r.a / n).toFixed(2)}`); });
    console.log(`    les 10 premières = ${(100 * cum / tt).toFixed(1)} % ; ${Math.max(0, s.length - 10)} autres méthodes = ${tt - cum} appels (${((tt - cum) / n).toFixed(2)} par image)`); };
  table('3a. les 10 méthodes dominantes sur l’ÉCRAN (le rendu, hors cuisson) :', 'e', S.ecran);
  if (S.cuisson + S.autre > 0) table('3b. les 10 méthodes dominantes de l’IMAGE COMPLÈTE (écran + cuisson + autre) :', 't', T);
  else console.log('  3b. image complète = écran : aucune cuisson ni autre appel hors écran dans ces images, même classement que 3a.');
  const sets = [...R.M.set.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  console.log('  affectations d’état, par image : ' + sets.slice(0, 8).map(([k, v]) => `${k}= ${(v / n).toFixed(2)}`).join(' · '));
  console.log('  appels « autre », par image, selon la taille du canvas visé : ' + ([...R.M.toile.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 6).map(([k, v]) => `${k} : ${(v / n).toFixed(2)}`).join(' · ') || 'aucun'));
  console.log('  appel LITTÉRAL render(1,16) sur l’état final (1 appel chacun) :');
  R.lit.forEach((r, s) => console.log(`    SKIPD=${s} : ${tot(r)} appels — écran ${r.ecran}, cuisson ${r.cuisson}, autre ${r.autre} ; affectations ${r.set}`));
  for (const m of R.err) global.console.log('  MESURE INVALIDE : ' + m);
  SORTIE.push(JSON.stringify({ q: R.q, b: R.bouge, ims: R.ims, lit: R.lit, M: CAT.concat('set', 'toile').map(c => [...R.M[c].entries()].sort()) }));
}

console.log(`# ops-image : ${REF ? 'git ' + REF : 'arbre de travail'} — partie normale (îlot 1, IA immobile ou pilote), ${NIM} images par scénario, chauffe ≥ ${NCH}, horloge virtuelle K=${K * 1000} µs/appel`);
let bad = 0; const RES = [];
for (const q of ['high', 'mid']) for (const bouge of [false, true]) { const R = mesure(q, bouge); rapport(R); RES.push(R); bad += R.err.length; }

console.log('\n================ RÉSUMÉ — appels canvas par image (moyenne [min–max]) ================');
console.log('  ' + padE('scénario', 40) + pad('image complète', 24) + pad('dans render()', 24) + pad('ÉCRAN seul', 22) + pad('cuisson', 22) + pad('autre', 16));
for (const R of RES) { const c = a => { const s = st(a); return `${f1(s.moy)} [${s.min}–${s.max}]`; };
  console.log('  ' + padE(`QL=${R.e2.QL} PS=${R.e2.PS.toFixed(2)} ${R.bouge ? 'déplacement' : 'immobile'} (${R.e1.en}→${R.e2.en} enn.)`, 40) + pad(c(R.ims.map(tot)), 24) + pad(c(R.ims.map(r => r.rendu)), 24) + pad(c(R.ims.map(r => r.ecran)), 22) + pad(c(R.ims.map(r => r.cuisson)), 22) + pad(c(R.ims.map(r => r.autre)), 16)); }
console.log('\nNON MESURÉ ICI :');
console.log('  - le chemin PAR DÉFAUT en navigateur (cuisson dans un worker) : pas de Worker sous vm, la cuisson comptée ici est celle du repli sur place ;');
console.log('  - la répartition de la cuisson entre les images sur un vrai appareil : elle suit bakeBudget, donc l’horloge (ici un modèle, --k=) ;');
console.log('  - le coût d’un appel (pixels touchés, rasterisation, composition) : un compte ne dit pas combien chaque appel coûte ;');
console.log('  - les autres états (boss, passage d’îlot, choix de bonus, fin de partie, menus) et les autres îlots : une seule partie, îlot 1, graine fixe.');
console.log('\nempreinte des comptes (doit être identique d’un lancement à l’autre) : ' + crypto.createHash('sha256').update(SORTIE.join('\n')).digest('hex').slice(0, 16));
console.log(bad ? 'OPS-IMAGE : MESURE INVALIDE (' + bad + ')' : 'OPS-IMAGE : MESURÉ');
process.exit(bad ? 1 : 0);
