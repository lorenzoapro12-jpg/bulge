'use strict';
/* =========================================================
   Art du monde : GARDE DE PÉRIMÈTRE. La cuisson d'un chunk et le sprite d'un obstacle
   produisent-ils EXACTEMENT la même séquence d'opérations canvas qu'à la référence — hors des
   biomes qu'on a explicitement le droit de retoucher ?

   node test/art.js                  arbre de travail contre la référence e3a2c93 (chemin principal)
   node test/art.js --ref=<commit>   autre référence
   node test/art.js --cible=<commit> compare ce commit au lieu de l'arbre de travail
   node test/art.js --perim=a,b      autre périmètre ; --perim= (vide) : tout doit être identique

   PÉRIMÈTRE (GRAPHISMES.md) : les biomes dont l'art a été VOULU différent de la référence. Un chunk
   est « dans le périmètre » s'il touche l'un d'eux, marge comprise (le décor d'un biome déborde
   jusqu'à 120 px chez ses voisins : DECO est tiré à ±120 px, les lisières à ±80 px) ; un obstacle
   l'est si son biome (ou celui de son monument) en fait partie. TOUT LE RESTE doit être identique
   octet pour octet : un changement qui déborde sur un autre biome est un défaut, pas une surprise.
   Quand le travail est commité, avancer --ref sur ce commit et vider le périmètre : tout redevient
   figé.

   Séquence BRUTE, sans normalisation : chaque appel (méthode + arguments en pleine précision),
   chaque affectation de style, save/restore/clip compris. Deux versions chargées côte à côte dans
   deux contextes vm ; chaque chunk cuit un bakeStep à la fois, dans le même ordre des deux côtés.
   Couverture : 3 mondes × (7×7 chunks du centre + une grille d'un chunk sur 3 sur tout le monde),
   et le sprite de chaque obstacle (hors falaises) de ces chunks.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
/* Référence avancée le 29/09/2026 de 93b8cfe (avant PERF-2) à e3a2c93 (chantier A, colonne vertébrale) :
   ce commit change VOLONTAIREMENT l'art de 66 chunks sur 378 contre 0837805 (30 par les cœurs ancrés sur le
   chemin principal, qui déplacent obstacles et monuments ; 36 par le fil de braise de drawPaths). 0837805
   passait contre 93b8cfe hors urban+sky ; e3a2c93 est désormais l'état figé, périmètre vide. */
const REF = ARG('ref') || 'e3a2c93';
/* Biomes dont l'art a été VOULU différent de la référence dans cette passe (GRAPHISMES.md).
   Doit lister EXACTEMENT ce qui a été retouché : trop large, la garde ne protège plus rien ;
   trop étroit, elle signale un faux débordement (c'est arrivé : le ciel avait été retouché
   alors que la liste ne contenait que la ville). Vérifié le 27/09/2026 : hors urban+sky,
   263/263 chunks hors périmètre identiques octet pour octet. Vide depuis e3a2c93 : tout est figé. */
const PERIM_DEF = [];
const PERIM = ARG('perim') === null ? PERIM_DEF : (ARG('perim') === true ? [] : String(ARG('perim')).split(',').filter(Boolean));
const MARGE = 160;
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
    /* biomes que le chunk touche, marge comprise (échantillons tous les 32 px) */
    touche: (cx, cy) => JSON.parse(call(`(function(){var o={},x0=${cx}*CH-${MARGE},y0=${cy}*CH-${MARGE};for(var y=y0;y<=y0+CH+2*${MARGE};y+=32)for(var x=x0;x<=x0+CH+2*${MARGE};x+=32)o[biomeAt(x,y)]=1;return JSON.stringify(Object.keys(o));})()`)),
    /* sprite de chaque obstacle propre au chunk (falaises exclues : elles sont dans la cuisson) */
    sprites(cx, cy) {
      const nb = call(`(function(){var c=getChunk(${cx},${cy});return c?c.obs.length:0;})()`), out = [];
      for (let i = 0; i < nb; i++) {
        const b = call(`(function(){var o=getChunk(${cx},${cy}).obs[${i}];return o.wall||o.home!==getChunk(${cx},${cy})?'':(o.b==='lm'?o.lt:o.b);})()`);
        if (!b) continue;
        const log = []; GID = 0; LOG = log; call(`obsSprite(getChunk(${cx},${cy}).obs[${i}])`); LOG = null;
        out.push({ b, log });
      }
      return out;
    },
  };
}
const H = l => crypto.createHash('sha256').update(l.join('\n')).digest('hex');
const A = build(f => cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }));
const CIBLE = ARG('cible');  /* --cible=<commit> : compare ce commit plutôt que l'arbre de travail (headless.js --ref) */
const B = build(f => CIBLE ? cp.execFileSync('git', ['show', CIBLE + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8'));
const liste = [];
for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) liste.push([cx, cy]);
for (let cx = -13; cx <= 13; cx += 3) for (let cy = -13; cy <= 13; cy += 3) if (Math.abs(cx) > 3 || Math.abs(cy) > 3) liste.push([cx, cy]);
let n = 0, ko = 0, ops = 0, appA = 0, appB = 0, montres = 0; const murs = {}, pieces = {};
const hors = { n: 0, ko: 0 }, dans = { n: 0, diff: 0 }, parB = {}, sHors = { n: 0, ko: 0 }, sDans = { n: 0, diff: 0 }, sParB = {};
const note = (T, b, diff) => { const o = T[b] || (T[b] = { n: 0, diff: 0 }); o.n++; if (diff) o.diff++; };
const montre = (quoi, la, lb) => { if (montres++ >= 4) return; let i = 0; while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
  console.log(`  HORS PÉRIMÈTRE, DIFFÉRENT : ${quoi} : opération n°${i} sur ${la.length}/${lb.length}\n     réf.  ${String(la[i]).slice(0, 110)}\n     arbre ${String(lb[i]).slice(0, 110)}`); };
for (const seed of [20260927, 7, 424242]) {
  A.world(seed); B.world(seed);
  for (const [cx, cy] of liste) {
    const a = A.chunk(cx, cy), b = B.chunk(cx, cy);
    if (!a && !b) continue;
    n++;
    const same = !!(a && b && H(a.log) === H(b.log)), inP = B.touche(cx, cy).filter(x => PERIM.includes(x));
    if (!same) ko++;
    if (inP.length) { dans.n++; if (!same) dans.diff++; for (const x of inP) note(parB, x, !same); }
    else { hors.n++; if (!same) { hors.ko++; montre(`monde ${seed} chunk ${cx},${cy}`, a ? a.log : [], b ? b.log : []); } }
    if (!a || !b) continue;
    ops += b.log.length; appA += a.n; appB += b.n;
    for (const w of b.info.w) murs[w] = (murs[w] || 0) + 1;
    if (b.info.sp) pieces[b.info.sp] = (pieces[b.info.sp] || 0) + 1;
    /* sprites d'obstacles : la génération des obstacles n'a pas le droit de changer (même liste) */
    const sa = A.sprites(cx, cy), sb = B.sprites(cx, cy);
    if (sa.length !== sb.length || sa.some((s, i) => s.b !== sb[i].b)) { sHors.n++; sHors.ko++; montre(`monde ${seed} chunk ${cx},${cy} : liste d'obstacles changée (${sa.length} -> ${sb.length})`, [], []); continue; }
    for (let i = 0; i < sb.length; i++) {
      const d = H(sa[i].log) !== H(sb[i].log);
      if (PERIM.includes(sb[i].b)) { sDans.n++; if (d) sDans.diff++; note(sParB, sb[i].b, d); }
      else { sHors.n++; if (d) { sHors.ko++; montre(`monde ${seed} chunk ${cx},${cy} sprite n°${i} (${sb[i].b})`, sa[i].log, sb[i].log); } }
    }
  }
}
const fmt = T => Object.keys(T).sort().map(b => `${b} ${T[b].diff}/${T[b].n}`).join(', ') || '—';
console.log(`# art : ${CIBLE ? 'git ' + CIBLE : 'arbre de travail'} contre ${REF} — ${n} chunks, 3 mondes, séquence brute`);
console.log(`  périmètre autorisé à changer : ${PERIM.length ? PERIM.join(', ') : 'aucun'} (marge ${MARGE} px)`);
console.log(`  chunks HORS périmètre identiques : ${hors.n - hors.ko}/${hors.n} ; sprites d'obstacles HORS périmètre identiques : ${sHors.n - sHors.ko}/${sHors.n}`);
console.log(`  dans le périmètre, changés (voulu) : chunks ${dans.diff}/${dans.n} [${fmt(parB)}] ; sprites ${sDans.diff}/${sDans.n} [${fmt(sParB)}]`);
for (const b of PERIM) if (!(parB[b] && parB[b].diff) && !(sParB[b] && sParB[b].diff)) console.log(`  note : « ${b} » est dans le périmètre mais rien n'y a changé — périmètre plus large que nécessaire ?`);
console.log(`  toutes catégories : chunks identiques ${n - ko}/${n} (${ops} opérations) ; appels à bakeStep : réf. ${appA} -> arbre ${appB}`);
console.log(`  couverture — groupes de murs par biome : ${JSON.stringify(murs)} ; pièces de décor : ${JSON.stringify(pieces)}`);
const ok = n > 0 && hors.ko === 0 && sHors.ko === 0;
console.log(ok ? (ko || sDans.diff ? 'ART : HORS PÉRIMÈTRE IDENTIQUE' : 'ART : IDENTIQUE') : 'ART : DÉBORDEMENT HORS PÉRIMÈTRE');
process.exit(ok ? 0 : 1);
