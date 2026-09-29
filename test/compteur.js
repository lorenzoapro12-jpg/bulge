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
    fillText: (s, x, y) => { const t = String(s); FILLS.push({ s: t, x, y, w: t.length * EM * pxOf(base.font) }); },
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
  const lines = FILLS.slice(before).filter(f => f.x === PAD && f.y > H * 0.5 && !/^Dash /.test(f.s));
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

/* ================= verdict ================= */
let all = true;
for (const c of checks) { if (!c.ok) all = false; console.log((c.ok ? '  OK  ' : ' ECHEC') + ' ' + c.name + (c.detail ? '  — ' + c.detail : '')); }
console.log(all ? '\nCOMPTEUR : TOUT PASSE' : '\nCOMPTEUR : ECHEC');
process.exit(all ? 0 : 1);
