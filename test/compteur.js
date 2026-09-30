'use strict';
/* =========================================================
   Garde-fou du COMPTEUR DE DIAGNOSTIC (le bloc du bas, quand `meta.fps` est vrai).

   Ce que ce test defend, dans cet ordre :
     1. **Le compteur tient dans l'ecran.** Constat du 29/09/2026 sur Galaxy S22 : canvas de
        617 px de large pour 411 px de largeur de DESSIN (PS 1.50) — les lignes « PS … marge
        audio » et « ou : … » debordaient des DEUX cotes et etaient illisibles. Le compteur est
        l'instrument avec lequel le joueur mesure : s'il est coupe, il ne sert a rien.
     2. **L'etat de la cuisson est affiche.** Sans worker, le jeu retombe SILENCIEUSEMENT sur la
        cuisson sur place ; sans ce mot a l'ecran, une comparaison « avec / sans ?wk=1 » peut
        comparer deux fois le meme chemin sans que personne ne s'en apercoive.
     4. **Le compteur ne chevauche AUCUN bouton** (S7). Constat du 30/09/2026 sur capture : avec 5
        lignes, « worker 558 », « marge audio » et « soft » passaient PAR-DESSUS le bouton AUTEL.
        L'ancre d'avant (H-132) ne connaissait que le bouton de dash ; les emplacements de
        competence de gcSlots() (gc.js) montent jusqu'a H-207. Le critere est geometrique et
        independant du code teste : rectangle de chaque ligne (et du bandeau) contre le DISQUE de
        toucher de chaque bouton (rayon + 10, touchBtnAt de g4.js), positions lues dans les VRAIES
        dashBtn() et gcSlots(). Et rien ne doit avoir disparu pour y arriver.
     5. **L'etat de la regulation est affiche** (S8) : « régul auto » ou « régul plafond <reglage> »,
        avec QL et RES reels, et « ↓ » quand la qualite est descendue SOUS son plafond. Un reglage qui
        n'adapte plus doit se LIRE — c'est le defaut que ce mot corrige (voir la note du S8).
     3. **La lisibilite ne coute pas la mesure** : la ligne « ou : » garde TOUJOURS ses postes
        les plus couteux (le tri est decroissant, on retire par la fin).

   On execute la VRAIE `drawHUD()` : modules charges dans un DOM stube, on appelle drawHUD(),
   et on controle ce qui a REELLEMENT ete ecrit. Aucune copie du code du jeu.

   Le stub de canvas mesure le texte proportionnellement a la taille de police (le stub des
   autres tests ignore la police, ce qui rendrait ce garde-fou aveugle) et on fait tourner
   chaque situation avec une police etroite (0,50 em par caractere) ET large (0,68 em), pour
   que l'invariant ne depende pas des metriques de la police.

   node test/compteur.js              arbre de travail
   node test/compteur.js --ref=HEAD   code d'origine (doit ECHOUER : temoin)
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
/* avance moyenne d'un caractere, en em. 0,50 : police etroite ; 0,68 : police large. */
let EM = 0.50;
const FILLS = [];
const RECTS = [];

const pxOf = f => { const m = /(\d+(?:\.\d+)?)px/.exec(String(f || '')); return m ? parseFloat(m[1]) : 12; };
function mkCtx() {
  const grad = { addColorStop() {} };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => ({}),
    font: '12px x', textAlign: 'left', textBaseline: 'top', globalAlpha: 1, fillStyle: '#000',
    measureText: s => ({ width: String(s || '').length * EM * pxOf(base.font) }),
    fillText: (s, x, y) => { const t = String(s); FILLS.push({ s: t, x, y, w: t.length * EM * pxOf(base.font), px: pxOf(base.font), bl: base.textBaseline }); },
    strokeText: (s, x, y) => { const t = String(s); FILLS.push({ s: t, x, y, w: t.length * EM * pxOf(base.font) }); },
    fillRect: (x, y, w, h) => { RECTS.push({ x, y, w, h, fill: String(base.fillStyle) }); },
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
const vctx = vm.createContext(sandbox);
const call = e => vm.runInContext(e, vctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})()`);
vm.runInContext(code, vctx, { filename: 'game.js' });

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); };
const PAD = 14;   /* `pad` de drawHUD, g3.js */

call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.state='play';meta.fps=true;inp.touch=true;`);

/* Joue le compteur dans une situation donnee et rend TOUTES les lignes ecrites par le bloc.
   Le bloc dessine a x=pad, sous la moitie de l'ecran (le texte du dash, lui, n'existe pas en
   mode tactile). Les autres textes en x=pad sont ailleurs (Niv. en haut). */
function drawBlock(o) {
  /* W/H sont les unites de DESSIN de l'interface (screenTf, g3.js:49 : setTransform(PS,0,0,PS,0,0)) ;
     cv.width/height sont la surface reelle, PS fois plus grande. On reproduit exactement le S22 :
     617x1351 de surface pour 411x900 de dessin, donc PS 1.50. */
  call(`W=${o.W};H=${o.H};PS=${o.PS == null ? 1 : o.PS};cv.width=${o.cw || o.W};cv.height=${o.ch || o.H};`);
  call(`JSPROFTOP=${JSON.stringify(o.top || [])};FPSV=${o.ips == null ? 53 : o.ips};DIAG_DT=${o.dt == null ? 18.6 : o.dt};DIAG_JS=${o.js == null ? 6.6 : o.js};DIAG_PEAK=${o.peak == null ? 34 : o.peak};DIAG_MARGIN=${o.margin == null ? 0.89 : o.margin};`);
  call(`inp.touch=${o.deskt ? 'false' : 'true'};`);
  call(o.wk ? `WK={w:1};WKN=${o.wkn == null ? 37 : o.wkn};` : `WK=false;WKN=0;`);
  if (o.noWk) call(`WK=null;WKN=0;`);
  const before = FILLS.length;
  const rbefore = RECTS.length;
  call('drawHUD()');
  const H = o.H;
  /* sur poste fixe le texte « Dash pret (Espace) » est lui aussi pose a x = pad, tout en bas :
     ce n'est pas une ligne du bloc de diagnostic, on l'ecarte par son prefixe. */
  const lines = FILLS.slice(before).filter(f => f.x === PAD && f.bl === 'bottom' && !/^Dash /.test(f.s));
  lines.rects = RECTS.slice(rbefore);
  return lines;
}
const fits = (l, o) => l.x + l.w <= o.W - PAD + 0.5;
const WKSTATE = 'worker 37';
/* Zone interdite du bouton de dash (g3.js:434) : centre (W-62, H-92), rayon 34. */
const dansDash = (l, o) => (l.x + l.w > o.W - 96) && (l.y > o.H - 126);
const fond = (L, o) => L.rects.find(r => /rgba\(8,5,18/.test(r.fill) && r.w >= Math.max(...L.map(l => l.w)) - 1 && r.y < Math.min(...L.map(l => l.y)));

/* La ligne « ou : » du joueur : 6 postes, celui du haut est le plus couteux. */
const TOP = [['render', 6.06, 12], ['glow', 1.28, 4], ['drawHUD', 1.09, 5], ['drawWeather', 1.04, 8], ['drawDistant', 0.92, 3], ['drawLabels', 0.71, 2]];

/* ================= S1 — le telephone du joueur (Galaxy S22) ================= */
{
  call(`WK={w:1};WKN=37;`);
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  EM = 0.50;
  const L = drawBlock(o);
  check('S22 : le bloc de diagnostic est ecrit', L.length >= 2, L.length + ' ligne(s) : ' + JSON.stringify(L.map(f => f.s.slice(0, 40))));
  check('S22 : AUCUNE ligne ne depasse la largeur de dessin', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('S22 : le compteur affiche la surface REELLE (617×1351 pour 411×900 de dessin)',
    L.some(f => f.s.indexOf('canvas 617×1351') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  check('S22 : la ligne des ips, de l\'image et du pire est presente', L.some(f => /ips · image .* · pire .* ms/.test(f.s)), L.map(f => f.s).find(s => s.indexOf('pire') > 0) || 'absente');
  check('S22 : la ligne JS / hors-JS est presente', L.some(f => f.s.indexOf('hors-JS') > 0), L.map(f => f.s).find(s => s.indexOf('hors-JS') > 0) || 'absente');
  check('S22 : l\'etat de la cuisson est affiche et nomme le worker', L.some(f => f.s.indexOf('cuisson ' + WKSTATE) >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  const ou = L.find(f => f.s.startsWith('où : '));
  check('S22 : la ligne « où » garde le poste le plus couteux', !!ou && ou.s.indexOf('render 6.06/12') >= 0, ou ? ou.s : 'absente');
  check('S22 : aucune ligne ne passe SOUS le bouton de dash (centre W-62, H-92, rayon 34)',
    L.every(l => !dansDash(l, o)), 'y max ' + Math.max(...L.map(l => l.y)) + ' / limite ' + (o.H - 132) + ' · droite max ' + Math.max(...L.map(l => l.x + l.w)) + ' / limite ' + (o.W - 96));
  check('S22 : le bloc a un fond sombre (lisible sur un terrain clair)', !!fond(L, o),
    L.rects.filter(r => /rgba\(8,5,18/.test(r.fill)).map(r => `${Math.round(r.w)}×${Math.round(r.h)} en ${Math.round(r.x)},${Math.round(r.y)}`).join(' ') || 'aucun');
}

/* ================= S2 — meme telephone, police LARGE (0,68 em) ================= */
{
  EM = 0.68;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  const L = drawBlock(o);
  check('S22, police large : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('S22, police large : la mesure reste complete (ips + hors-JS + cuisson)',
    L.some(f => f.s.indexOf('pire') > 0) && L.some(f => f.s.indexOf('hors-JS') > 0) && L.some(f => f.s.indexOf('cuisson ') >= 0),
    L.map(f => f.s).join(' | ').slice(0, 90));
}

/* ================= S3 — telephone etroit (320 px) ================= */
{
  EM = 0.50;
  const o = { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true };
  const L = drawBlock(o);
  check('320 px : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('320 px : l\'etat de la cuisson est toujours lisible', L.some(f => f.s.indexOf('cuisson ') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
}

/* ================= S4 — PC large : rien ne doit avoir ete casse ================= */
{
  const o = { W: 1536, H: 864, DPR: 1, COARSE: false, top: TOP, wk: true };
  o.deskt = true;
  const L = drawBlock(o);
  check('PC 1536 px : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('PC 1536 px : le bloc reste compact (au plus 4 lignes)', L.length <= 4, L.length + ' lignes');
  check('PC 1536 px : la ligne « où » garde ses 6 postes', L.some(f => f.s.indexOf('drawLabels 0.71/2') > 0), L.map(f => f.s).find(s => s.startsWith('où : ')) || 'absente');
  check('PC 1536 px : le bloc ne se superpose pas à « Dash prêt (Espace) » (y = H-pad)',
    L.every(l => l.y <= o.H - PAD - 19.5), 'y max ' + Math.max(...L.map(l => l.y)) + ' / limite ' + (o.H - PAD - 20));
}

/* ================= S5 — la cuisson sur place est dite, et non pas supposee ================= */
{
  EM = 0.50;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: false };
  const L = drawBlock(o);
  check('repli : le compteur dit « cuisson sur place »', L.some(f => f.s.indexOf('cuisson sur place') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  const o2 = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, noWk: true };
  const L2 = drawBlock(o2);
  check('avant la premiere image : le compteur ne ment pas (cuisson ?)', L2.some(f => f.s.indexOf('cuisson ?') >= 0), L2.map(f => f.s).join(' | ').slice(0, 90));
}

/* ============ S6 — les nombres du compteur decrivent le JEU, et se correspondent ============
   Deux defauts corriges le 29/09/2026, gardes ici pour qu'ils ne reviennent pas :
   - les ips venaient d'un compteur de 500 ms qui avancait sur TOUTES les images ; les images de
     menu, de pause et d'ecran de fin (bien moins cheres) entraient donc dans la fenetre. Mesure sur
     l'appareil : 84 ips affiches pour un jeu qui en tenait 34 ;
   - « image : N ms » et « N ips » venaient de deux cumuls DIFFERENTS : les deux nombres de la meme
     ligne pouvaient ne pas se correspondre, et rien ne le disait.
   On appelle ici de VRAIES images (frame(ts)) avec une horloge controlee. */
{
  EM = 0.50;
  /* UNE seule horloge continue : frame() plafonne a 100 ms tout saut d'horloge, donc deux blocs
     separes avec des temps eloignes injecteraient une image a 100 ms dans la moyenne et fausseraient
     la mesure — c'est ce qui a fait echouer la premiere version de ce test, a juste titre. */
  const r = JSON.parse(call(`(()=>{const o={};
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;FPSV=0;DIAG_DT=0;
    last=0;let t=1e6;G.state='pause';frame(t);          /* cette image saute de 1e6 ms : plafonnee a 100, et NON cumulee */
    for(let i=0;i<40;i++){t+=2;frame(t);}                /* 40 images de menu a 2 ms */
    o.pause={n:DIAG_N,ips:FPSV,dt:DIAG_DT};
    G.state='play';for(let i=0;i<60;i++){t+=29;frame(t);}   /* 60 images de jeu a 29 ms */
    o.mix={ips:FPSV,dt:+DIAG_DT.toFixed(2)};
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;FPSV=0;DIAG_DT=0;
    for(let i=0;i<70;i++){t+=16.7;frame(t);}             /* 70 images de jeu a 16,7 ms */
    o.reg={ips:FPSV,dt:+DIAG_DT.toFixed(2)};
    return JSON.stringify(o);})()`));
  check('80 images de menu seules : rien n\'est mesure (ni ips, ni temps par image)',
    r.pause.n === 0 && r.pause.ips === 0 && r.pause.dt === 0,
    'images cumulees=' + r.pause.n + ' · ips=' + r.pause.ips + ' · image=' + r.pause.dt + ' ms');
  check('apres 40 images de menu, 60 images de jeu a 29 ms : les ips sont ceux du JEU, et 1000/ips = ms',
    r.mix.ips >= 33 && r.mix.ips <= 35 && Math.abs(1000 / r.mix.ips - r.mix.dt) <= 1,
    'ips=' + r.mix.ips + ' (attendu ~34) · image=' + r.mix.dt + ' ms · 1000/ips=' + (1000 / r.mix.ips).toFixed(2) + ' ms');
  check('la mesure reste juste : 70 images a 16,7 ms donnent ~60 ips et 1000/ips = ms',
    r.reg.ips >= 58 && r.reg.ips <= 62 && Math.abs(1000 / r.reg.ips - r.reg.dt) <= 1,
    'ips=' + r.reg.ips + ' (attendu ~60) · image=' + r.reg.dt + ' ms · 1000/ips=' + (1000 / r.reg.ips).toFixed(2) + ' ms');
}

/* ================= S7 — le bloc ne chevauche AUCUN bouton =================
   Boutons : dash (tactile seulement) et les trois emplacements de competence — lus dans le jeu.
   Une ligne occupe [x, x+w] × [y-px, y] (ligne de base « bottom ») ; le bandeau est son rectangle. */
{
  const boutons = o => { call(`W=${o.W};H=${o.H};inp.touch=${o.deskt ? 'false' : 'true'};`);
    const S = JSON.parse(call('JSON.stringify({d:dashBtn(),s:gcSlots()})'));
    const nom = (b, n) => n + ' (W-' + Math.round(o.W - b.x) + ',H-' + Math.round(o.H - b.y) + ' r' + b.r + ')';
    const B = S.s.map((b, i) => ({ x: b.x, y: b.y, r: b.r + 10, n: nom(b, i === 2 ? 'ULTIME' : 'AUTEL/competence ' + (i + 1)) }));
    if (!o.deskt) B.push({ x: S.d.x, y: S.d.y, r: S.d.r + 10, n: nom(S.d, 'dash') });
    return B; };
  const coupe = (r, b) => { const dx = Math.max(r.x0 - b.x, 0, b.x - r.x1), dy = Math.max(r.y0 - b.y, 0, b.y - r.y1); return dx * dx + dy * dy < b.r * b.r; };
  const SIT = [
    ['S22 tactile 411×900', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true, wkn: 558 }],
    ['S22 tactile, sans ligne « où » ni marge audio', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: [], wk: true, margin: -1 }],
    ['tactile 320×640', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }],
    ['tactile couche 780×360', { W: 780, H: 360, PS: 1.5, cw: 1170, ch: 540, top: TOP, wk: true }],
    ['tactile couche 568×320', { W: 568, H: 320, PS: 1.5, cw: 852, ch: 480, top: TOP, wk: true }],
    ['poste fixe 1536×864', { W: 1536, H: 864, top: TOP, wk: true, deskt: true }],
    ['poste fixe 800×600', { W: 800, H: 600, top: TOP, wk: true, deskt: true }],
  ];
  const MORC = ['ips', 'image ', 'pire ', 'JS ', 'hors-JS ', 'effets ', 'resol ', 'PS ', 'canvas ', 'DPR ', 'ref ', 'cuisson '];
  for (const [nom, o] of SIT) for (const em of [0.50, 0.68]) {
    EM = em;
    const L = drawBlock(o), B = boutons(o), pb = [];
    for (const l of L) for (const b of B) if (coupe({ x0: l.x, x1: l.x + l.w, y0: l.y - l.px, y1: l.y }, b)) pb.push('« ' + l.s.slice(-22) + ' » (y=H-' + Math.round(o.H - l.y) + ') sur ' + b.n);
    const bd = L.rects.filter(r => /rgba\(8,5,18/.test(r.fill));
    for (const r of bd) for (const b of B) if (coupe({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }, b)) pb.push('bandeau sur ' + b.n);
    const tag = nom + ', police ' + em.toFixed(2) + ' em, ' + L.length + ' lignes';
    check(tag + ' : le bloc ne chevauche AUCUN bouton', L.length >= 3 && pb.length === 0,
      pb.length ? pb.length + ' chevauchement(s) — cause : ancre fixe sous le haut des boutons — ' + pb.slice(0, 3).join(' ; ') : 'bloc de y=H-' + Math.round(o.H - Math.min(...L.map(l => l.y - l.px))) + ' a H-' + Math.round(o.H - Math.max(...L.map(l => l.y))) + ', bouton le plus haut H-' + Math.round(o.H - Math.min(...B.map(b => b.y - b.r))));
    const tout = L.map(l => l.s).join(' | '), manq = MORC.concat(o.margin === -1 ? [] : ['marge audio ']).filter(m => tout.indexOf(m) < 0);
    check(tag + ' : rien n\'a disparu, tout tient dans la largeur et dans l\'ecran',
      manq.length === 0 && L.every(l => fits(l, o) && l.y - l.px >= 0 && l.y <= o.H), manq.length ? 'manque : ' + manq.join(', ') : L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  }
}

/* ================= S8 — l'etat REEL de la regulation est affiche (ligne 3) ================= */
{
  EM = 0.68;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  const l3 = L => (L[2] ? L[2].s : 'absente');
  call(`meta.q='auto';QL=3;RES=1;`);
  let L = drawBlock(o);
  check('regulation : « auto » est dit, avec QL et RES reels, en tete de la ligne 3', /^régul auto 3\/3 ×1\.00/.test(l3(L)) && L.every(l => fits(l, o)), l3(L));
  call(`meta.q='auto';QL=1;RES=.8;`);
  L = drawBlock(o);
  check('regulation : apres une baisse automatique, la ligne 3 suit QL et RES', /^régul auto 1\/3 ×0\.80/.test(l3(L)), l3(L));
  /* ⚠️ Ce critere disait « régul FIGÉE high » et invoquait « perf() n'adapte plus ». C'etait vrai le
     30/09/2026 au matin (g4.js sortait de perf() des que meta.q n'etait pas 'auto'), et c'est devenu
     FAUX le meme jour : le chantier P2 a fait d'un mode manuel un PLAFOND — la descente reste possible,
     la remontee s'arrete au cran choisi. Garder « FIGÉE » aurait fait du compteur un menteur, soit
     exactement le defaut que ce bloc existe pour empecher. Ce qui n'a PAS bouge : un reglage manuel
     doit se lire, et la ligne doit suivre les QL/RES reels. On le verifie donc en deux temps, et plus
     precisement qu'avant : au cran plein, puis DESCENDUE sous son plafond (le marqueur « ↓ »). */
  call(`meta.q='high';applyQuality();`);
  L = drawBlock(o);
  check('regulation : un prereglage manuel se LIT, au cran plein — « plafond high », sans marqueur', /^régul plafond high 3\/3 ×1\.00/.test(l3(L)) && L.every(l => fits(l, o)), l3(L));
  call(`meta.q='high';QL=1;RES=.8;`);
  L = drawBlock(o);
  check('regulation : descendue SOUS son plafond, la ligne le dit — « plafond high ↓ »', /^régul plafond high ↓ 1\/3 ×0\.80/.test(l3(L)), l3(L));
  call(`meta.q='auto';QL=3;RES=1;`);
}

/* ================= verdict ================= */
let all = true;
for (const c of checks) { if (!c.ok) all = false; console.log((c.ok ? '  OK  ' : ' ECHEC') + ' ' + c.name + (c.detail ? '  — ' + c.detail : '')); }
console.log(all ? '\nCOMPTEUR : TOUT PASSE' : '\nCOMPTEUR : ECHEC');
process.exit(all ? 0 : 1);
