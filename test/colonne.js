'use strict';
/* =========================================================
   COLONNE VERTÉBRALE (chantier A) : le chemin principal va-t-il du site 0 à l'Hypernoyau PAR LES
   SENTIERS, et les trois cœurs sont-ils des jalons posés dessus, dans trois biomes distincts ?

   node test/colonne.js                    graines 1..300 + graines des tests ; résumé
   node test/colonne.js --graine=12345     détail d'une graine (indices, longueurs, biomes)
   node test/colonne.js --ref=<commit>     mêmes mesures sur un commit (pour l'AVANT)

   Vérifications, par graine, recalculées ICI indépendamment de gw.js (Bellman-Ford, pas Dijkstra) :
     1. WD.mainPath commence au site 0 et finit au site 'core' (celui de WD.core) ;
     2. chaque paire consécutive est une arête de WD.edges, et WD.mainE = exactement ces arêtes ;
     3. sans son éventuel détour, sa longueur est la plus courte distance 0 -> core dans le graphe ;
     4. tout site hors du plus court chemin est à <= 2 arêtes de lui et mène à un cœur (détour justifié) ;
     5. WD.hearts : 3 sites du chemin, dans l'ordre du trajet, trois biomes DISTINCTS, ni plaines ni core ;
     6. le détour n'est pris que s'il n'existe AUCUN triplet valide sur le plus court chemin seul.
   Exécuté dans le contexte principal (genWorld ~50 ms ; sous vm ~2 s — cf. CLAUDE.md).
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

function examine(seed) {
  call(`genWorld(${seed})`);
  const W = JSON.parse(call(`JSON.stringify({S:WD.sites.map(s=>({x:s.x,y:s.y,t:s.t})),E:WD.edges,M:WD.mainPath||null,ME:WD.mainE?[...WD.mainE]:null,H:WD.hearts,C:WD.core,ok:WD.mainOk})`));
  const { S, E, M, H } = W, n = S.length, d = (a, b) => Math.hypot(S[a].x - S[b].x, S[a].y - S[b].y), err = [];
  const ek = (a, b) => Math.min(a, b) + ',' + Math.max(a, b), EK = new Map(E.map(([a, b], i) => [ek(a, b), i]));
  const ci = S.findIndex(s => s.t === 'core');
  /* plus court chemin indépendant : Bellman-Ford */
  const D = new Array(n).fill(Infinity), pv = new Array(n).fill(-1); D[0] = 0;
  for (let it = 0; it < n; it++) for (const [a, b] of E) { const w = d(a, b); if (D[a] + w < D[b]) { D[b] = D[a] + w; pv[b] = a; } if (D[b] + w < D[a]) { D[a] = D[b] + w; pv[a] = b; } }
  const SP = []; for (let i = ci; i >= 0; i = pv[i]) SP.push(i); SP.reverse();
  const r = { seed, ci, M, SP, lenSP: D[ci], H, ok: W.ok, detour: null, biomes: [], edgesOK: true, err };
  if (!M) { err.push('WD.mainPath absent'); return r; }
  if (M[0] !== 0) err.push('ne commence pas au site 0 : ' + M[0]);
  if (M[M.length - 1] !== ci || S[ci].x !== W.C.x || S[ci].y !== W.C.y) err.push('ne finit pas au core (' + ci + ') : ' + M[M.length - 1]);
  let len = 0; const me = new Set();
  for (let k = 1; k < M.length; k++) { const i = EK.get(ek(M[k - 1], M[k])); if (i === undefined) { r.edgesOK = false; err.push('arête absente ' + M[k - 1] + '-' + M[k]); } else me.add(i); len += d(M[k - 1], M[k]); }
  r.len = len;
  if (!W.ME || W.ME.length !== me.size || W.ME.some(i => !me.has(i))) err.push('WD.mainE ≠ arêtes du chemin');
  const off = [...new Set(M.filter(i => !SP.includes(i)))], dep = new Array(n).fill(9); SP.forEach(i => dep[i] = 0);
  for (let k = 0; k < 2; k++) for (const [a, b] of E) { dep[b] = Math.min(dep[b], dep[a] + 1); dep[a] = Math.min(dep[a], dep[b] + 1); }
  if (off.some(i => dep[i] > 2)) err.push('site du chemin à plus de 2 arêtes du plus court chemin : ' + off);
  const spOf = M.filter(i => SP.includes(i)).filter((v, k, a) => a.indexOf(v) === k);
  if (spOf.join() !== SP.join()) err.push('chemin sans détour ≠ plus court chemin ' + SP.join('-'));
  r.detour = off.length ? off : null;
  /* cœurs */
  if (H.length !== 3) err.push(H.length + ' cœurs');
  const hi = H.map(h => S.findIndex(s => s.x === h.x && s.y === h.y));
  r.hi = hi; r.biomes = hi.map(i => i >= 0 ? S[i].t : '?');
  if (hi.some(i => i < 0 || !M.includes(i))) err.push('cœur hors du chemin principal : ' + hi);
  r.prof = Math.max(0, ...hi.map(i => i < 0 ? 9 : dep[i]));
  /* un site de détour qui n'est ni un cœur ni sur le trajet d'un cœur n'a rien à faire là : chaque éperon finit sur un cœur */
  for (const i of off) if (!hi.includes(i) && !E.some(([a, b]) => (a === i && hi.includes(b) && dep[b] === 2) || (b === i && hi.includes(a) && dep[a] === 2))) err.push('détour sans cœur : site ' + i);
  if (new Set(r.biomes).size !== 3) err.push('biomes non distincts : ' + r.biomes);
  if (r.biomes.some(b => b === 'plains' || b === 'core')) err.push('cœur en plaines ou au core : ' + r.biomes);
  /* position d'un cœur de détour : celle du site du plus court chemin d'où part son éperon */
  const pos = hi.map(i => { let k = M.indexOf(i); while (k > 0 && !SP.includes(M[k])) k--; return D[M[k]]; });
  if (!(pos[0] <= pos[1] && pos[1] <= pos[2])) err.push('cœurs hors de l ordre du trajet');
  r.frac = pos.map(p => +(p / D[ci]).toFixed(2));
  if (r.detour !== null) { const I = SP.slice(1, -1).filter(i => S[i].t !== 'plains' && S[i].t !== 'core');
    if (new Set(I.map(i => S[i].t)).size >= 3) err.push('détour pris alors que le plus court chemin offrait 3 biomes'); }
  return r;
}

if (ONE) {
  const r = examine(+ONE);
  console.log('graine ' + r.seed + ' — site core = ' + r.ci);
  console.log('  WD.mainPath          : ' + r.M.join(' → '));
  console.log('  plus court (Bellman) : ' + r.SP.join(' → ') + '   longueur ' + Math.round(r.lenSP) + ' px');
  console.log('  longueur du chemin   : ' + Math.round(r.len) + ' px   détour : ' + (r.detour === null ? 'aucun' : 'sites ' + r.detour.join(', ') + ' (cœur le plus loin : ' + r.prof + ' arête(s) du plus court chemin)'));
  console.log('  arêtes consécutives dans WD.edges : ' + (r.edgesOK ? 'toutes' : 'NON'));
  console.log('  cœurs : sites ' + r.hi.join(', ') + '  biomes ' + r.biomes.join(', ') + '  à ' + r.frac.join(' / ') + ' du trajet');
  console.log(r.err.length ? '  ECHEC ' + r.err.join(' | ') : '  OK');
  process.exit(r.err.length ? 1 : 0);
}
const seeds = [20260927, 7, 123456789, 424242, 99, 12345, 777]; for (let s = 1; s <= 300; s++) seeds.push(s);
let bad = 0, det = 0, nok = 0, hops = [], lens = [], prof = [0, 0, 0], apres = 0;
for (const s of seeds) { const r = examine(s); if (r.err.length) { bad++; if (bad <= 10) console.log('  ECHEC graine ' + s + ' : ' + r.err.join(' | ')); }
  if (r.detour !== null) det++; if (r.prof <= 2) prof[r.prof]++; if (r.frac && r.frac[2] >= 1) apres++; if (r.ok === false) nok++; if (r.M) { hops.push(r.M.length - 1); lens.push(r.len); } }
const avg = a => (a.reduce((x, y) => x + y, 0) / (a.length || 1));
console.log('  ' + seeds.length + ' graines : ' + (seeds.length - bad) + ' conformes, détour pris ' + det + ' fois, sans triplet valide ' + nok + ' fois');
console.log('  cœur le plus éloigné du plus court chemin : 0 arête ' + prof[0] + ', 1 arête ' + prof[1] + ', 2 arêtes ' + prof[2] + ' ; 3e cœur sur un éperon PARTANT de l Hypernoyau : ' + apres);
console.log('  chemin principal : ' + avg(hops).toFixed(1) + ' arêtes en moyenne (min ' + Math.min(...hops) + ', max ' + Math.max(...hops) + '), ' + Math.round(avg(lens)) + ' px en moyenne');
console.log(bad ? 'ECHEC' : 'OK colonne');
process.exit(bad ? 1 : 0);
