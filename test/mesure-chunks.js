'use strict';
/* =========================================================
   COMBIEN DE CHUNKS UNE REGLE DE DECOR FAIT GENERER ?

   getChunk (gw.js:88) GENERE a la demande : WD.chunks[i]||(WD.chunks[i]=genChunk(cx,cy)).
   Une regle de decor qui interroge un voisinage de 25 chunks a chaque tick force donc la cuisson de
   chunks que le flux normal (streamWorld, budget en ms) n'aurait pas encore cuits. Mesure : le meme
   parcours, immobile, dans un biome FLORAL, sur le code d'avant (--ref=HEAD) et sur le code actuel.
   L'ecart = ce que la regle de decor ajoute a la facture de cuisson.

   node test/mesure-chunks.js [--ref=HEAD] [--ticks=120]
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), TICKS = +(ARG('ticks') || 120);
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
const mkEl = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
  querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
const stash = new Map();
const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
  createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} });
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
{ let s = 1; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
vm.runInThisContext(ORDER.map(read).join('\n'), { filename: 'game.js' });
const call = e => vm.runInThisContext(e);
const J = e => JSON.parse(call(`JSON.stringify(${e})`));

call(`
function __start(){newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.help=0;
  window.__SIM_INPUT=function(){G.inX=G.inY=0;G.spawnT=1e9;G.eb=[];G.pb=[];G.p.fireT=1e9;G.banner=null;if(G.gt)G.gt.on=false;};}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;for(const e of G.en)e.dead=true;G.en=[];G.arena=null;}
function __steps(n){for(let i=0;i<n;i++){step();if(G.state!=='play')return;}}
function __settle(b){for(let i=0;i<120&&G.biome!==b;i++)step();return G.biome===b;}
function __n(){return WD.chunks.filter(c=>c).length;}
`);

const out = [];
for (const b of ['floral', 'urban', 'plains']) {
  const r = J(`(()=>{__start();const s=WD.sites.find(q=>q.t==='${b}');if(!s)return{err:'aucun site'};
    __tp(s.x,s.y);const ok=__settle('${b}');const n0=__n();__steps(${TICKS});const n1=__n();
    return{biome:G.biome,attendu:ok,site:[Math.round(s.x),Math.round(s.y)],avant:n0,apres:n1,delta:n1-n0};})()`);
  out.push({ biome: b, ...r });
}
console.log(`code : ${REF ? 'commit ' + REF : 'arbre de travail'} · ${TICKS} ticks immobile`);
for (const r of out) console.log(`  ${r.biome.padEnd(8)} biome=${String(r.biome && r.biome).padEnd(0)} atteint=${r.attendu} chunks ${r.avant} -> ${r.apres} (delta ${r.delta >= 0 ? '+' : ''}${r.delta})`);
const tot = out.reduce((a, r) => a + (r.delta || 0), 0);
console.log(`  TOTAL genere pendant l immobilité : ${tot} chunks`);
