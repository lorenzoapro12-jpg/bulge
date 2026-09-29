'use strict';
/* =========================================================
   EMBRANCHEMENTS (chantier B) : à un carrefour, peut-on décider OÙ aller sans y aller d'abord ?

   node test/embranchements.js                 graines 1..200 + graines des tests ; résumé
   node test/embranchements.js --graine=12345  détail d'une graine : carrefours, branches, annonces
   node test/embranchements.js --tirage=3      + 3 branches tirées au hasard : distance annoncée / réelle

   Vérifications, par graine, recalculées ICI à partir de WD.edges / WD.segs / WD.mainPath :
     1. chaque arête de WD.edges est classée EXACTEMENT une fois (main | branche | suite), aucune branche en double ;
        les arêtes « main » sont exactement WD.mainE ;
     2. une branche part d'un carrefour (degré >= 3) ; son origine est l'extrémité la plus proche du chemin principal ;
     3. aucun carrefour à 2 branches ou plus dont toutes les branches ont le même type ;
     4. chaque branche a un panneau (WD.signs, s.br) à <= 500 px du carrefour, lisible à 900 px : on le lit
        DEPUIS le carrefour, avant de s'engager (hors champ sur téléphone : pastille au bord de l'écran, gcHUD) ;
     5. la distance annoncée = longueur réelle du sentier entre le panneau et le bout de la branche, mesurée ici en
        projetant le panneau et le contenu sur la polyligne de l'arête (écart toléré : 1 m d'arrondi + 6 m de
        projection du panneau, posé à 54 px du sentier) ;
     6. le contenu existe : trésor/nid sur le sentier hors obstacle ; sanctuaire = un autel de WD.alts à cet endroit ;
        évènement = un souvenir de WD.scn à cet endroit avec un parcours jouable ; raccourci = rejoint le chemin
        principal plus loin et le gain annoncé = longueur du chemin principal évitée - longueur de la branche.
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), ONE = ARG('graine');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
const mkEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
  querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
const stash = new Map();
const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
  createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} });
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
vm.runInThisContext(ORDER.map(read).join('\n'), { filename: 'game.js' });
const call = e => vm.runInThisContext(e);
const ARG2 = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const TIR = +(ARG2('tirage') || 0);
const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function examine(seed) {
  call(`genWorld(${seed})`);
  const W = JSON.parse(call(`JSON.stringify({S:WD.sites.map(s=>({x:s.x,y:s.y,t:s.t})),E:WD.edges,M:WD.mainPath,ME:[...WD.mainE],segs:WD.segs.map(s=>[s.e,s.k,s.ax,s.ay,s.bx,s.by]),brE:WD.brE,br:WD.br,signs:WD.signs,alts:WD.alts,scn:WD.scn})`));
  const { S, E, M, br, brE } = W, n = S.length, err = [], ME = new Set(W.ME);
  const deg = new Array(n).fill(0); E.forEach(([a, b]) => { deg[a]++; deg[b]++; });
  /* polyligne de chaque arête, dans l'ordre a -> b */
  const poly = E.map(() => []); for (const s of W.segs) poly[s[0]].push(s); poly.forEach(L => L.sort((p, q) => p[1] - q[1]));
  const P = poly.map(L => L.length ? [[L[0][2], L[0][3]], ...L.map(s => [s[4], s[5]])] : []);
  const len = p => { let d = 0; for (let i = 1; i < p.length; i++) d += hyp(p[i - 1], p[i]); return d; };
  const near = (p, x, y) => { let b = 0, bd = 1e18; p.forEach((v, i) => { const d = hyp(v, [x, y]); if (d < bd) { bd = d; b = i; } }); return [b, bd]; };
  /* 1. classement unique */
  if (!brE || brE.length !== E.length || !Array.isArray(br)) {
    /* TEMOIN : sur le code d'AVANT le chantier B, WD.brE n'existe pas. On sort ici avec une erreur
       NOMMEE au lieu de planter plus bas (brE[i] sur undefined) : un plantage serait indistinguable
       d'un test casse, et l'ecart entre l'annonce et la realite ne pourrait pas se lire. */
    err.push('WD.brE / WD.br absent : ce monde ne classe pas ses aretes (code d’avant le chantier B)');
    return { seed, err, rows: [], carref: S.map((_, i) => i).filter(i => deg[i] >= 3), cross: {}, br: [], types: [], suite: 0, main: 0, E: E.length, nx: 0, M, deg };
  }
  const seenBr = new Map();
  E.forEach((e, i) => { const c = brE[i]; if (!c) { err.push('arête ' + i + ' non classée'); return; }
    if ((c.c === 'main') !== ME.has(i)) err.push('arête ' + i + ' : main ≠ WD.mainE');
    if (c.c === 'br') { if (seenBr.has(c.i)) err.push('branche ' + c.i + ' classée deux fois'); seenBr.set(c.i, i); if (!br[c.i] || br[c.i].e !== i) err.push('branche ' + c.i + ' ne pointe pas sur l’arête ' + i); } });
  br.forEach((b, i) => { if (seenBr.get(i) !== b.e) err.push('branche ' + i + ' orpheline'); });
  const eset = new Set(br.map(b => b.e)); if (eset.size !== br.length) err.push('deux branches sur la même arête');
  /* 2. origines : distance au chemin principal (Bellman-Ford, indépendant) */
  const onM = new Set(M), dm = new Array(n).fill(Infinity); for (const i of M) dm[i] = 0;
  for (let it = 0; it < n; it++) E.forEach(([a, b], i) => { const w = len(P[i]); if (dm[a] + w < dm[b]) dm[b] = dm[a] + w; if (dm[b] + w < dm[a]) dm[a] = dm[b] + w; });
  const cross = {};
  for (const b of br) { const [a, z] = E[b.e]; if (deg[b.o] < 3) err.push('branche ' + b.e + ' : origine ' + b.o + ' de degré ' + deg[b.o]);
    if (!(dm[b.o] <= dm[b.f] + 1e-6)) err.push('branche ' + b.e + ' : origine plus loin du chemin principal que l’autre bout');
    (cross[b.o] = cross[b.o] || []).push(b); }
  /* 3. variété */
  for (const o in cross) { const L = cross[o]; if (L.length >= 2 && new Set(L.map(b => b.t)).size === 1) err.push('carrefour ' + o + ' : ' + L.length + ' branches toutes « ' + L[0].t + ' »'); }
  /* 4-6. annonce et contenu */
  const cum = [0]; for (let k = 1; k < M.length; k++) { const i = E.findIndex(([a, b]) => (a === M[k - 1] && b === M[k]) || (b === M[k - 1] && a === M[k])); cum.push(cum[k - 1] + len(P[i])); }
  const rows = [];
  br.forEach((b, i) => {
    const s = W.signs.find(z => z.br === i), p = E[b.e][0] === b.o ? P[b.e] : [...P[b.e]].reverse();
    if (!s) { err.push('branche ' + i + ' sans panneau'); return; }
    const O = S[b.o], oc = Math.min(1, (7000 - 240) / Math.hypot(O.x, O.y)), so = hyp([s.x, s.y], [O.x * oc, O.y * oc]); /* site hors du disque : le carrefour jouable est où les sentiers sont ramenés (WR-240) */ if (so > 500) err.push('branche ' + i + ' : panneau à ' + Math.round(so) + ' px du carrefour');
    const [ks, ds] = near(p, s.x, s.y), [kc, dc] = near(p, b.x, b.y);
    if (dc > 1e-6) err.push('branche ' + i + ' : contenu hors du sentier (' + dc.toFixed(1) + ' px)');
    if (kc <= ks) err.push('branche ' + i + ' : contenu avant le panneau');
    const real = len(p.slice(ks, kc + 1)) / 10; rows.push({ i, t: b.t, o: b.o, e: b.e, annonce: b.d, reel: +real.toFixed(1), ecart: +(b.d - real).toFixed(1), panneau_carrefour_px: Math.round(so) });
    if (Math.abs(b.d - real) > 7) err.push('branche ' + i + ' : annonce ' + b.d + ' m, réel ' + real.toFixed(1) + ' m');
    if (b.t === 'sanctuaire') { const A = W.alts[b.ref]; if (!A || A.x !== b.x || A.y !== b.y) err.push('branche ' + i + ' : sanctuaire sans autel'); }
    else if (b.t === 'evenement') { const Q = W.scn[b.ref]; if (!Q || Q.x !== b.x || Q.y !== b.y || Q.path.length < 9) err.push('branche ' + i + ' : évènement sans souvenir jouable'); }
    else if (b.t === 'raccourci') { if (!onM.has(b.f) || !onM.has(b.o)) err.push('branche ' + i + ' : raccourci hors chemin principal');
      else { const g = (cum[M.lastIndexOf(b.f)] - cum[M.indexOf(b.o)] - len(p)) / 10; if (g <= 0 || Math.abs(g - b.g) > 1) err.push('branche ' + i + ' : gain annoncé ' + b.g + ' m, réel ' + g.toFixed(1)); } }
    else if (b.t === 'tresor' || b.t === 'nid') { if (call(`!!pointHit(${b.x},${b.y},20)`)) err.push('branche ' + i + ' : ' + b.t + ' dans un obstacle'); }
    else err.push('branche ' + i + ' : type inconnu ' + b.t);
  });
  const nx = Object.keys(cross).length, carref = S.map((_, i) => i).filter(i => deg[i] >= 3);
  return { seed, err, rows, carref, cross, br, types: br.map(b => b.t), suite: brE.filter(c => c && c.c === 'suite').length, main: brE.filter(c => c && c.c === 'main').length, E: E.length, nx, M, deg };
}
const SEEDS = ONE ? [+ONE] : [...Array(200).keys()].map(i => i + 1).concat([12345, 777, 4242]);
let bad = 0; const tally = {}; let nbr = 0, nx = 0, maxEc = 0;
for (const sd of SEEDS) { const r = examine(sd); for (const t of r.types) tally[t] = (tally[t] || 0) + 1; nbr += r.br.length; nx += r.carref.length; for (const q of r.rows) maxEc = Math.max(maxEc, Math.abs(q.ecart));
  if (r.err.length) { bad++; console.log('  ECHEC graine ' + sd + ' : ' + r.err.slice(0, 4).join(' ; ')); }
  if (ONE) {
    console.log('graine ' + sd + ' : ' + r.E + ' arêtes = ' + r.main + ' main + ' + r.br.length + ' branches + ' + r.suite + ' suites (' + (r.main + r.br.length + r.suite) + ')');
    console.log('carrefours (degré >= 3) : ' + r.carref.length + ' → ' + r.carref.map(i => i + (r.M.includes(i) ? '*' : '') + '(d' + r.deg[i] + ')').join(' ') + '   (* = sur le chemin principal)');
    for (const o of r.carref) console.log('  carrefour ' + o + ' : ' + ((r.cross[o] || []).map(b => b.t + (b.t === 'raccourci' ? ' (−' + b.g + ' m)' : '') + ' @' + b.d + ' m').join(', ') || '(aucune branche : arêtes principales / retour)'));
    console.log('types : ' + r.types.join(', '));
    if (TIR) { let s = sd * 9301 + 49297; const pick = []; const R = r.rows.slice(); while (pick.length < Math.min(TIR, R.length)) { s = (s * 9301 + 49297) % 233280; pick.push(R.splice(Math.floor(s / 233280 * R.length), 1)[0]); }
      console.log('tirage de ' + pick.length + ' branches : annonce vs longueur réelle du sentier (panneau → bout)'); for (const q of pick) console.log('  ' + JSON.stringify(q)); }
  }
}
console.log('\n' + SEEDS.length + ' graines : ' + nx + ' carrefours, ' + nbr + ' branches ; types ' + JSON.stringify(tally) + ' ; écart max annonce/réel ' + maxEc.toFixed(1) + ' m ; ' + (bad ? bad + ' graine(s) en échec' : 'aucun échec'));
process.exit(bad ? 1 : 0);
