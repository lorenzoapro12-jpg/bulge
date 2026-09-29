'use strict';
/* =========================================================
   DÉCOR VIVANT (chantier E2) : les trois lectures du monde qui ont un ÉTAT VÉRIFIABLE.

   node test/decor-vivant.js             vérifie le code courant, puis lance le TÉMOIN (--ref=fafe111, le commit d'avant le chantier)
   node test/decor-vivant.js --ref=REF   vérifie le code d'un commit (sans témoin)
   node test/decor-vivant.js --sans-temoin

   On n'interroge pas des variables internes : on DESSINE (drawLive, drawAmers) dans un contexte
   canvas enregistreur et on lit ce qui a été émis. Le même test tourne donc sur l'ancien code,
   et le témoin doit y échouer en nommant la cause.
     N2        une phalène, un oiseau, une méduse s'écartent d'un ennemi en aggro situé HORS DU CHAMP ;
               un ennemi calme (aggro:false) ne les dérange pas.
     N4        pour chaque monument de 3 mondes : la colonne de lumière est dessinée SI ET SEULEMENT SI
               son biome est absent de G.visited.
     gradient  le halo d'une veine (node) croît quand on s'approche de WD.core : monotone en fonction de
               la distance, et nettement plus fort sur le Cœur qu'au loin ; coreK (braises) monotone.
     pool N3   la trace du joueur : le pool de marques ne croît pas (2000 pas de marche).
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
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

/* contexte enregistreur : chaque point émis (drawImage = centre de l'image, avec son alpha) */
const LOG = [];
const PT = { arc: 1, ellipse: 1, moveTo: 1, lineTo: 1, fillRect: 1, quadraticCurveTo: 2 };
const REC = new Proxy({ globalAlpha: 1 }, {
  get: (t, p) => {
    if (p in t) return t[p];
    if (p === 'drawImage') return (im, ...a) => { const q = a.length >= 8 ? a.slice(4) : a; LOG.push({ k: 'img', x: q[0] + (q[2] || 0) / 2, y: q[1] + (q[3] || 0) / 2, w: q[2] || 0, h: q[3] || 0, a: t.globalAlpha }); };
    if (PT[p]) return (...a) => { const o = PT[p] === 2 ? 2 : 0; LOG.push({ k: p, x: a[o], y: a[o + 1], a: t.globalAlpha }); };
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set: (t, p, v) => { t[p] = v; return true; }
});
globalThis.__REC = REC;
const has = n => call(`typeof ${n}==='function'`);
const view = (l, r, t, b) => call(`VL=${l};VR=${r};VT=${t};VB=${b};`);
const draw = src => { LOG.length = 0; call(`ctx=__REC;${has('fleeBuild') ? 'fleeBuild();' : ''}${src}`); return LOG.slice(); };
const centroid = L => { if (!L.length) return null; let x = 0, y = 0; for (const p of L) { x += p.x; y += p.y; } return { x: x / L.length, y: y / L.length }; };

const res = [];
const check = (nom, fn) => { let err; try { err = fn(); } catch (e) { err = 'exception : ' + e.message; } res.push({ nom, err }); console.log((err ? 'ECHEC ' : 'OK    ') + nom + (err ? ' — ' + err : '')); };

call(`genWorld(1);G={p:{x:-99999,y:-99999,r:10,dead:false,col:'#ffffff',vx:0,vy:0},en:[],visited:{plains:1},state:'play',t:0,biome:'plains'};RT=500;RZ=1;`);

/* ---------- N2 ---------- */
check('N2 : la faune (phalène, oiseau, méduse) fuit un ennemi en aggro hors du champ', () => {
  const errs = [];
  for (const t of ['moth', 'bird', 'jelly']) {
    const it = `{t:'${t}',x:2000,y:2000,s:1,ph:1.3}`;
    call('G.en=[]'); view(-1e6, 1e6, -1e6, 1e6);
    const c0 = centroid(draw(`drawLive(${it})`));
    if (!c0) { errs.push(`${t} : rien n'est dessiné (type absent de drawLive)`); continue; }
    const ex = c0.x + 150, ey = c0.y;
    view(c0.x - 260, c0.x + 110, c0.y - 200, c0.y + 200);   /* l'ennemi (x+150) est HORS du champ */
    call(`G.en=[{x:${ex},y:${ey},aggro:false,dead:false,spawn:0,r:12}]`);
    const cc = centroid(draw(`drawLive(${it})`));
    if (!cc || Math.hypot(cc.x - c0.x, cc.y - c0.y) > .5) errs.push(`${t} : dérangé par un ennemi CALME (aggro:false)`);
    call(`G.en[0].aggro=true`);
    const c1 = centroid(draw(`drawLive(${it})`));
    if (!c1) { errs.push(`${t} : disparaît du champ devant la menace`); continue; }
    const dx = c1.x - c0.x;
    if (dx > -15) errs.push(`${t} : ne s'écarte pas de l'ennemi en aggro (déplacement ${dx.toFixed(1)} px vers lui, attendu < -15)`);
  }
  call('G.en=[]');
  return errs.join(' ; ') || null;
});

/* ---------- N4 ---------- */
check('N4 : colonne de lumière sur un monument SI ET SEULEMENT SI son biome n\'est pas visité', () => {
  if (!has('drawAmers')) return 'drawAmers absent : aucun monument ne projette de colonne, visité ou non';
  const errs = []; let n = 0, types = new Set();
  for (const seed of [1, 7, 12345]) {
    call(`genWorld(${seed})`);
    const lms = JSON.parse(call('JSON.stringify(WD.lms.map(L=>({x:L.x,y:L.y,t:L.t})))'));
    for (let i = 0; i < lms.length; i++) {
      const L = lms[i]; types.add(L.t);
      for (const vu of [false, true]) {
        call(`G.visited=${vu ? `{plains:1,[${JSON.stringify(L.t)}]:1}` : `{plains:1}`}`);
        view(L.x - 60, L.x + 60, L.y - 900, L.y + 60);
        const log = draw(`__OUT=drawAmers()`), lit = call(`__OUT.includes(WD.lms[${i}])`);
        const beam = log.some(p => p.k === 'img' && Math.abs(p.x - L.x) < 5 && p.h > 800);
        const want = !vu && L.t !== 'plains';
        if (lit !== want || beam !== want) errs.push(`graine ${seed} monument ${i} (${L.t}, ${vu ? 'visité' : 'non visité'}) : colonne ${beam ? 'dessinée' : 'absente'}`);
        n++;
      }
    }
  }
  call('genWorld(1)');
  if (!n) return 'aucun monument dans les mondes testés';
  if (types.size < 4) return 'trop peu de biomes couverts : ' + [...types];
  return errs.slice(0, 5).join(' ; ') || null;
});

/* ---------- gradient d'approche ---------- */
check('gradient : le halo des veines croît à l\'approche de WD.core (monotone)', () => {
  const C = JSON.parse(call('JSON.stringify(WD.core)')), D = [0, 150, 400, 800, 1200, 1800, 2600, 3600, 5000, 7000], A = [];
  view(-1e6, 1e6, -1e6, 1e6);
  for (const d of D) { const L = draw(`drawLive({t:'node',x:${C.x + d},y:${C.y},s:1,ph:.7})`); A.push(L.filter(p => p.k === 'img').reduce((s, p) => s + p.a, 0)); }
  for (let i = 1; i < A.length; i++) if (A[i] > A[i - 1] + 1e-9) return `halo plus fort à ${D[i]} px qu'à ${D[i - 1]} px (${A[i].toFixed(3)} > ${A[i - 1].toFixed(3)})`;
  if (!(A[0] > 1.5 * A[A.length - 1])) return `intensité ${A[0] === A[A.length - 1] ? 'CONSTANTE' : 'presque constante'} : ne dépend pas de la distance au Cœur (${A[0].toFixed(3)} sur le Cœur, ${A[A.length - 1].toFixed(3)} à 7000 px)`;
  if (!has('coreK')) return 'coreK absent : les braises ne suivent pas le gradient';
  let prev = Infinity;
  for (let d = 0; d <= 14000; d += 25) { const k = call(`coreK(WD.core.x+${d * .6},WD.core.y-${d * .8})`); if (!(k < prev)) return `coreK non strictement décroissant à ${d} px`; prev = k; }
  return null;
});

/* ---------- pool de la trace ---------- */
check('N3 : le pool de marques du joueur ne croît pas', () => {
  if (!call(`typeof MK!=='undefined'&&typeof markStep==='function'`)) return 'MK / markStep absents : pas de trace de biome';
  const n0 = call('MK.length');
  call(`G.p.x=0;G.p.y=0;MKX=null;`);
  for (let i = 0; i < 2000; i++) call(`G.p.x+=9;G.p.y+=Math.sin(${i}*.1)*4;G.biome=${JSON.stringify(['plains', 'sea', 'ice', 'cyber', 'core', 'sky'][i % 6])};RT++;markStep()`);
  const n1 = call('MK.length'), used = call('MK.filter(m=>m.b).length');
  if (n1 !== n0) return `pool passé de ${n0} à ${n1}`;
  if (!used) return 'aucune marque posée';
  return null;
});

const bad = res.filter(r => r.err);
/* Le temoin vise le commit D AVANT le chantier, jamais « HEAD ». Dans le worktree de l auteur, HEAD
   etait encore l ancien code, donc le temoin avait un sens ; APRES LA FUSION, HEAD devient le code
   neuf, le temoin passe — et le test se declarait invalide en sortant en echec alors que tout allait
   bien. Constaté le 29/09/2026 sur l arbre fusionne : « ECHEC PARTIEL — 4 critères OK ». */
const BASE = 'fafe111';
let temoin = true;
if (!REF && !ARG('sans-temoin')) {
  console.log('--- TÉMOIN : le même test sur ' + BASE + ' (avant le chantier) doit échouer ---');
  const r = cp.spawnSync(process.execPath, [__filename, '--ref=' + BASE], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').map(l => l && '   | ' + l).join('\n') + '\n');
  const need = ['N2', 'N4', 'gradient'];
  for (const k of need) if (!new RegExp('^ECHEC ' + k, 'm').test(r.stdout)) { temoin = false; console.log(`TÉMOIN INVALIDE : « ${k} » passe déjà sur ${BASE}`); }
  if (r.status !== 1) { temoin = false; console.log('TÉMOIN INVALIDE : code de sortie ' + r.status + ' sur ' + BASE); }
  if (temoin) console.log('témoin : ' + BASE + ' échoue sur N2, N4 et le gradient, avec leur cause');
}
console.log('-----------------------------------------');
console.log(bad.length || !temoin ? 'ECHEC' : 'TOUT PASSE');
process.exit(bad.length || !temoin ? 1 : 0);
