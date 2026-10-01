'use strict';
/* =========================================================
   Garde-fou du COÛT DE L'AMBIANCE (décor lointain, halos, météo, décor vivant) — fluidité complète, 01/10/2026.

   Le défaut : au canevas logiciel (Firefox du propriétaire, AzureCanvasBackend skia), un sprite étiré coûte ~8,8 ns par
   pixel d'écran, quelle que soit son opacité ; posé à l'échelle 1 au pixel entier, ~1,4 ns. Les couches d'ambiance
   étiraient jusqu'à 1,7 million de pixels par image (brume des Plaines presque invisible : ~12 ms ; nuages de l'Archipel :
   ~26 ms en Skia brut ; halo du joueur : ~6 ms partout). Mesure Chromium logiciel 1920x1080 : en coupant toute
   l'ambiance, chaque biome passe de 26-47 ips à 60.

   Ce que ce test défend, pour CHAQUE biome, qualité haute, 1920x1080, au cœur du biome :
     A1. la surface ÉTIRÉE (drawImage hors échelle 1) dessinée par l'ambiance reste sous AMB_ETIRE pixels par image ;
     A2. la surface totale posée par l'ambiance (étirée + à l'échelle 1) reste sous AMB_TOTAL pixels par image.
   Les fonctions comptées : drawFar, drawVista, drawWhale, drawWhaleShadow, drawLowGlows, drawWeather, drawLive, drawDeco,
   drawAmers, drawSeuils, drawMarks.

   node test/ambiance.js              arbre de travail
   node test/ambiance.js --ref=HEAD   code d'origine (doit ÉCHOUER : c'est le témoin)
   ========================================================= */
const VW = 1920, VH = 1080;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- horloge virtuelle ---------- */
let CLOCK = 0, TID = 0;
const TIMERS = [];
function advance(ms) {
  const end = CLOCK + ms;
  for (;;) {
    let k = -1;
    for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i;
    if (k < 0) break;
    const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn();
  }
  CLOCK = end;
}

/* ---------- stubs (identiques a test/headless.js, reduits au necessaire) ---------- */
function mkCtx() {
  const grad = { addColorStop() {} };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 }, T = [1, 1, 0, 0, 0], S = [];   /* échelle x, y, translation x, y, rotation */
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
    setTransform(a, b, c, d, e, f) { T[0] = Math.hypot(a, b); T[1] = Math.hypot(c, d); T[2] = e; T[3] = f; T[4] = b || c ? 1 : 0; OPS.n += this.__cv === OPS.main; },
    resetTransform() { T[0] = T[1] = 1; T[2] = T[3] = T[4] = 0; }, scale(x, y) { T[0] *= Math.abs(x); T[1] *= Math.abs(y); OPS.n += this.__cv === OPS.main; },
    translate(x, y) { T[2] += T[0] * x; T[3] += T[1] * y; OPS.n += this.__cv === OPS.main; }, rotate(r) { if (r) T[4] = 1; OPS.n += this.__cv === OPS.main; },
    save() { S.push(T.slice()); OPS.n += this.__cv === OPS.main; }, restore() { const t = S.pop(); if (t) for (let i = 0; i < 5; i++) T[i] = t[i]; OPS.n += this.__cv === OPS.main; },
  };
  base.drawImage = function (src, ...a) {
    if (this.__cv === OPS.main) OPS.n++;
    LOG.push({ dst: this.__cv, src, gco: st.globalCompositeOperation, ga: st.globalAlpha, a, sx: T[0], sy: T[1], tx: T[2], ty: T[3], rot: T[4] });
  };
  return new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : function () { if (this && this.__cv === OPS.main) OPS.n++; }), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
}
const OPS = { n: 0, main: null };
const LOG = [];
function mkStyle() { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: (k) => { const v = s[k]; delete s[k]; return v || ''; } }, getPropertyValue: { value: (k) => (s[k] || '') } }); return s; }
function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }; }
function mkListeners() { const L = {}; return { add: (t, fn) => (L[t] = L[t] || []).push(fn), fire: (t, e) => (L[t] || []).forEach(fn => fn(e)), has: (t) => !!(L[t] && L[t].length) }; }
const doc = { activeElement: null };
function mkEl(id, tag) {
  const L = mkListeners(), attrs = {};
  return {
    id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {},
    hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '', offsetWidth: 0, offsetHeight: 0, parentElement: null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: VW, bottom: VH, width: VW, height: VH, x: 0, y: 0 }),
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    closest: () => null, focus: () => {}, blur() {}, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, fn) => L.add(t, fn), removeEventListener() {}, _fire: L.fire, _has: L.has,
    after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {},
  };
}
function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; let c = null; el.getContext = () => { if (!c) { c = mkCtx(); c.__cv = el; } return c; }; return el; }
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
const ctx = vm.createContext(sandbox);
const call = (e) => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})()`);
vm.runInContext(code, ctx, { filename: 'game.js' });


/* au 01/10/2026 : étiré ≤ 0,15 Mpx, total ≤ 0,91 Mpx selon le biome ; avant : étiré 0,9 à 5,7 Mpx. Ne compte que les drawImage
   (pas les aplats ni les traits : rais de lumière, aurores, réseau). */
const AMB_ETIRE = 250e3, AMB_TOTAL = 1.2e6;
const FN = ['drawFar', 'drawVista', 'drawWhale', 'drawWhaleShadow', 'drawLowGlows', 'drawWeather', 'drawLive', 'drawDeco', 'drawAmers', 'drawSeuils', 'drawMarks'];
call(`(function(){globalThis.__AMB=0;for(const n of ${JSON.stringify(FN)}){if(typeof globalThis[n]!=='function')continue;const f=globalThis[n];globalThis[n]=function(){__AMB++;try{return f.apply(this,arguments);}finally{__AMB--;}};}})()`);
const realPush = LOG.push.bind(LOG);
LOG.push = e => realPush(Object.assign(e, { amb: call('__AMB') > 0 }));
OPS.main = call('MAINCTX').__cv;
call(`DPR=1;QL=3;RES=1;resize();applyRes();perf=function(){};newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.state='play';meta.fps=false;`);
/* surface d'écran réellement couverte (rectangle de destination coupé au canevas ; sans coupe sous rotation) */
const area = e => { const s = e.src || {}, a = e.a; let x, y, w, h;
  if (a.length === 2) { [x, y] = a; w = s.width; h = s.height; } else if (a.length === 4) { [x, y, w, h] = a; } else { x = a[4]; y = a[5]; w = a[6]; h = a[7]; }
  const nat = a.length === 2 && Math.abs(e.sx - 1) < 1e-6 && Math.abs(e.sy - 1) < 1e-6;
  if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
  let X0 = e.tx + x * e.sx, Y0 = e.ty + y * e.sy, X1 = X0 + w * e.sx, Y1 = Y0 + h * e.sy;
  if (!e.rot) { const cw = call('cv.width'), ch = call('cv.height'); X0 = Math.max(0, X0); Y0 = Math.max(0, Y0); X1 = Math.min(cw, X1); Y1 = Math.min(ch, Y1); }
  return { px: Math.max(0, X1 - X0) * Math.max(0, Y1 - Y0), nat }; };
const res = [];
for (const B of ['plains', 'floral', 'sea', 'sky', 'cyber', 'urban', 'ice', 'core']) {
  const pos = call(`(()=>{Math.__seed(77);const wb=(x,y)=>{let w=0;for(const m of biomeMix(x,y))if(m.b==='${B}')w=m.w;return w;};let best=null,bs=-1;
    for(let i=0;i<20000;i++){const a=Math.random()*6.283,r=Math.random()*WR*.85,x=Math.cos(a)*r,y=Math.sin(a)*r;if(wb(x,y)<.9)continue;let sc=1;for(let k=0;k<8;k++){sc=Math.min(sc,wb(x+Math.cos(k*.785)*750,y+Math.sin(k*.785)*750));if(sc<=bs)break;}
      if(sc>bs){bs=sc;best=[x,y];if(sc>.97)break;}}
    if(!best)return null;G.p.x=G.cx=best[0];G.p.y=G.cy=best[1];G.pcx=G.pcy=null;G.zoom=zoomTarget();G.pzoom=null;G.kick=0;G.trauma=0;G.biome='${B}';return best;})()`);
  if (!pos) { res.push({ B, err: 'aucun point au cœur du biome' }); continue; }
  for (let i = 0; i < 40; i++) { CLOCK += 16.7; call('render(0,16.7)'); }   /* cuisson sur place, sprites, décors */
  let et = 0, tot = 0; const N = 6;
  for (let i = 0; i < N; i++) { LOG.length = 0; CLOCK += 16.7; call('G.t+=1;render(0,16.7)');
    for (const e of LOG) if (e.amb && e.dst === OPS.main) { const r = area(e); tot += r.px; if (!r.nat) et += r.px; } }
  res.push({ B, et: et / N, tot: tot / N });
}
const fmt = v => (v / 1e6).toFixed(2) + ' Mpx';
const A1 = res.every(r => !r.err && r.et <= AMB_ETIRE), A2 = res.every(r => !r.err && r.tot <= AMB_TOTAL);
console.log(`test/ambiance.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const r of res) console.log('  ' + r.B.padEnd(7) + (r.err ? ' ' + r.err : ` étiré ${fmt(r.et)}, total ${fmt(r.tot)}`));
console.log((A1 ? '  OK   ' : '  ECHEC') + ' A1. surface étirée par l\'ambiance ≤ ' + fmt(AMB_ETIRE) + ' par image, dans chaque biome');
console.log((A2 ? '  OK   ' : '  ECHEC') + ' A2. surface totale posée par l\'ambiance ≤ ' + fmt(AMB_TOTAL) + ' par image, dans chaque biome');
console.log(A1 && A2 ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(A1 && A2 ? 0 : 1);
