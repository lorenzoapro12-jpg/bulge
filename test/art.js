'use strict';
/* =========================================================
   Art du monde : la cuisson d'un chunk produit-elle EXACTEMENT la même séquence d'opérations
   canvas qu'à la référence ? (PERF-2 : les murs et les pièces de décor sont devenus des
   générateurs ; seuls des points de pause ont été ajoutés.)

   node test/art.js                  arbre de travail contre la référence 93b8cfe (avant PERF-2)
   node test/art.js --ref=<commit>   autre référence
   node test/art.js --cible=<commit> compare ce commit au lieu de l'arbre de travail

   Séquence BRUTE, sans normalisation : chaque appel (méthode + arguments en pleine précision),
   chaque affectation de style, save/restore/clip compris. Deux versions chargées côte à côte dans
   deux contextes vm ; chaque chunk cuit un bakeStep à la fois, dans le même ordre des deux côtés.
   Couverture : 3 mondes × (7×7 chunks du centre + une grille d'un chunk sur 3 sur tout le monde).
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref') || '93b8cfe';
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];

function build(read) {
  let LOG = null, GID = 0;
  const ser = v => { const t = typeof v; if (t === 'number' || t === 'boolean' || v == null) return String(v); if (t === 'string') return JSON.stringify(v); if (v && v.__g) return v.__g; return 'OBJ'; };
  const rec = (n, a) => { if (LOG) LOG.push(n + '(' + a.map(ser).join(',') + ')'); };
  const mkGrad = () => ({ __g: 'g' + (++GID), addColorStop(...a) { rec(this.__g + '.addColorStop', a); } });
  function mkCtx() {
    const base = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
      createRadialGradient: (...a) => { rec('createRadialGradient', a); return mkGrad(); }, createLinearGradient: (...a) => { rec('createLinearGradient', a); return mkGrad(); },
      createPattern: () => { rec('createPattern', []); return { __g: 'p' + (++GID) }; }, measureText: s => ({ width: (s || '').length * 7 }) };
    return new Proxy(base, { get: (t, p) => (p in t ? t[p] : (...a) => rec(String(p), a)), set: (t, p, v) => { if (LOG) LOG.push(String(p) + '=' + ser(v)); t[p] = v; return true; } });
  }
  const mkEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild(c) { return c; }, after() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
  const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
  const stash = new Map();
  const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
    createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
  const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
  const sb = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(ORDER.map(read).join('\n'), ctx, { filename: 'game.js' });
  const call = e => vm.runInContext(e, ctx);
  return {
    world: seed => call(`genWorld(${seed})`),
    chunk(cx, cy) {
      if (!call(`(function(){var c=getChunk(${cx},${cy});return !!(c&&!c.bake&&!c.bk);})()`)) return null;
      const log = []; GID = 0; let n = 0;
      for (;;) { LOG = log; const fini = call(`bakeStep(getChunk(${cx},${cy}))`); LOG = null; n++; if (fini) break; if (n > 20000) throw new Error('cuisson sans fin ' + cx + ',' + cy); }
      const info = call(`(function(){var c=getChunk(${cx},${cy}),w={},i0=Math.round((c.x0-G0)/WC)-1,j0=Math.round((c.y0-G0)/WC)-1;for(var j=j0;j<j0+10;j++)for(var i=i0;i<i0+10;i++)if(wallAt(i,j))w[biomeAt(G0+(i+.5)*WC,G0+(j+.5)*WC)]=1;return JSON.stringify({w:Object.keys(w),sp:c.sp?biomeAt(c.sp.x,c.sp.y):null});})()`);
      return { log, n, info: JSON.parse(info) };
    },
  };
}
const A = build(f => cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }));
const CIBLE = ARG('cible');  /* --cible=<commit> : compare ce commit plutôt que l'arbre de travail (headless.js --ref) */
const B = build(f => CIBLE ? cp.execFileSync('git', ['show', CIBLE + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8'));
const liste = [];
for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) liste.push([cx, cy]);
for (let cx = -13; cx <= 13; cx += 3) for (let cy = -13; cy <= 13; cy += 3) if (Math.abs(cx) > 3 || Math.abs(cy) > 3) liste.push([cx, cy]);
let n = 0, ko = 0, ops = 0, appA = 0, appB = 0; const murs = {}, pieces = {};
for (const seed of [20260927, 7, 424242]) {
  A.world(seed); B.world(seed);
  for (const [cx, cy] of liste) {
    const a = A.chunk(cx, cy), b = B.chunk(cx, cy);
    if (!a && !b) continue;
    n++;
    const ha = a && crypto.createHash('sha256').update(a.log.join('\n')).digest('hex'), hb = b && crypto.createHash('sha256').update(b.log.join('\n')).digest('hex');
    if (!a || !b || ha !== hb) {
      ko++;
      if (ko <= 3) {
        let i = 0; const la = a ? a.log : [], lb = b ? b.log : []; while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
        console.log(`  DIFFÉRENT monde ${seed} chunk ${cx},${cy} : opération n°${i} sur ${la.length}/${lb.length}\n     réf.  ${String(la[i]).slice(0, 110)}\n     arbre ${String(lb[i]).slice(0, 110)}`);
      }
      continue;
    }
    ops += b.log.length; appA += a.n; appB += b.n;
    for (const w of b.info.w) murs[w] = (murs[w] || 0) + 1;
    if (b.info.sp) pieces[b.info.sp] = (pieces[b.info.sp] || 0) + 1;
  }
}
console.log(`# art : ${CIBLE ? 'git ' + CIBLE : 'arbre de travail'} contre ${REF} — ${n} chunks, 3 mondes, séquence brute`);
console.log(`  chunks identiques : ${n - ko}/${n} (${ops} opérations comparées) ; appels à bakeStep : réf. ${appA} -> arbre ${appB}`);
console.log(`  couverture — groupes de murs par biome : ${JSON.stringify(murs)} ; pièces de décor : ${JSON.stringify(pieces)}`);
const ok = ko === 0 && n > 0;
console.log(ok ? 'ART : IDENTIQUE' : 'ART : DIFFÉRENT');
process.exit(ok ? 0 : 1);
