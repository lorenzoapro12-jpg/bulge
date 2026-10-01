'use strict';
/* =========================================================
   Garde-fou de la COUCHE DES HALOS (lowBegin/lowEnd, g3.js) — saccades sur ordinateur, 01/10/2026.

   Le defaut : la couche basse resolution (decor lointain + grands halos) etait un <canvas id="low"> du DOM,
   plein ecran, en `mix-blend-mode:screen`. Le navigateur devait alors MELANGER deux calques plein ecran a
   chaque image, hors de notre JS. Mesure chez le proprietaire (PC AMD, Firefox, 1680x1050, compteur
   embarque) : « hors-JS » 12,0 ms par image avec ce melange, 2,9 ms sans (meme partie, qualite basse) ; en
   auto 50 ips, pire image 50 ms, JS 5 ms et hors-JS 15 ms. Ici (Chromium sans GPU, 1920x1080) : 35 -> 59 ips.

   Ce que ce test defend :
     1. STATIQUE : shell_head.html n'a plus de canvas #low, et aucun `mix-blend-mode` hors du logo du menu
        (un melange CSS sur un calque plein ecran de jeu, c'est exactement le cout qu'on retire) ;
     2. EXECUTION (vrais modules, DOM stube) : plus AUCUN calque intermediaire compose en plein ecran (voir
        l'en-tete de la section 2 : la composition 'screen' dans le canevas a coute 9,38 ms par image chez le
        proprietaire) ; halos et decor lointain sont dessines directement en 'lighter', y compris en qualite
        basse ; attenues a 0,4 a la mort, comme le faisait `#cv.dying+#low{opacity:.4}`.

   node test/halos.js              arbre de travail
   node test/halos.js --ref=HEAD   code d'origine (doit ECHOUER : c'est le temoin)
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
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
  };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
  base.drawImage = function (src, ...a) { LOG.push({ dst: this.__cv, src, gco: st.globalCompositeOperation, ga: st.globalAlpha, a }); };
  return new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : () => {}), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
}
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
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }),
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

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

/* ================= 1. statique ================= */
{
  const sh = readModule('shell_head.html');
  check('1a. shell_head.html : plus de <canvas id="low">', !/id="low"/.test(sh), /id="low"/.test(sh) ? 'present : le navigateur compose encore un second calque plein ecran' : 'absent');
  /* chaque mix-blend-mode doit appartenir a une regle du logo (.logo::before/::after, menu seulement) */
  const bad = [];
  for (const m of sh.matchAll(/([^{}]*)\{[^{}]*mix-blend-mode[^{}]*\}/g)) if (!/^\s*\.logo/.test(m[1].trim().split('\n').pop())) bad.push(m[1].trim().split('\n').pop().slice(-60));
  check('1b. aucun mix-blend-mode hors du logo du menu', bad.length === 0, bad.length ? 'regles : ' + bad.join(' | ') : 'seul .logo en utilise');
}

/* ================= 2. execution ================= */
/* Deuxieme temps (meme jour) : etiree DANS le canevas principal en 'screen', la couche a coute 9,38 ms (lowEnd, un seul
   drawImage plein ecran) sur le meme PC, auto 3/3, JS 23 ms. Ce qui est defendu desormais :
     2a. aucun canevas intermediaire n'est compose en plein ecran : pas de drawImage d'une source de la taille de
         l'ecran (ou de son quart) dans le canevas principal pendant la passe basse, et aucun 'screen' ;
     2b. les halos arrivent pourtant a l'ecran, directement dans le canevas principal, en 'lighter' ;
     2c. en qualite basse aussi (seuls les halos sont dessines) ;
     2d. a la mort, ils sont attenues a 0,4 (comme #cv.dying+#low), et l'attenuation ne fuit pas hors de la passe. */
call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.state='play';meta.q='auto';QL=3;RES=1;DPR=1;applyRes();`);
/* les appels de la passe basse : entre lowBegin et lowEnd (enveloppes posees ici, sans toucher au code) */
call(`(function(){const b=lowBegin,e=lowEnd;globalThis.__INLOW=false;lowBegin=function(){b();__INLOW=true;};lowEnd=function(){__INLOW=false;e();};})()`);
const realDraw = LOG.push.bind(LOG);
LOG.push = (e) => realDraw(Object.assign(e, { low: call('__INLOW') }));
const frame = () => {
  LOG.length = 0; call('render(0,16.7)');
  const main = call('MAINCTX').__cv, cw = call('cv.width'), ch = call('cv.height');
  const low = LOG.filter(e => e.low), toMain = low.filter(e => e.dst === main);
  /* les grands halos posés à l'échelle 1 (natSpr, g3.js, 01/10/2026) ont un sprite de leur taille d'écran : ce n'est pas un
     calque intermédiaire (rien d'autre n'y est dessiné), mais il doit être posé au pixel entier, sans étirement (2e) */
  const nat = new Set(call("typeof NAT!=='undefined'?[...NAT.values()]:[]")), natD = toMain.filter(e => nat.has(e.src));
  const big = toMain.filter(e => e.src && e.src.width >= cw / 4 - 1 && e.src.height >= ch / 4 - 1 && e.src !== main && !nat.has(e.src));
  return { low, toMain, big, natD, screen: LOG.filter(e => e.gco === 'screen'), other: low.filter(e => e.dst !== main), n: call('LOWN'), lowa: call("typeof LOWA!=='undefined'?LOWA:1"), cw, ch };
};
const desc = r => `${r.toMain.length} drawImage dans le canevas principal pendant la passe (ops : ${[...new Set(r.toMain.map(e => e.gco))].join(',') || '-'}) ; ${r.other.length} ailleurs ; ${r.big.length} source(s) plein ecran ; ${r.screen.length} 'screen' ; LOWN=${r.n}`;
for (let i = 0; i < 3; i++) frame();
{
  const r = frame();
  check('2a. qualite haute : aucun calque intermediaire compose en plein ecran, aucun screen', r.big.length === 0 && r.screen.length === 0 && r.other.length === 0, desc(r));
  check('2b. les halos sont dessines directement dans le canevas principal, en lighter', r.n > 0 && r.toMain.length > 0 && r.toMain.some(e => e.gco === 'lighter'), desc(r));
  check('2e. les grands halos (natSpr) sont poses a l\'echelle 1, au pixel entier', r.natD.length > 0 && r.natD.every(e => e.a.length === 2 && e.a.every(Number.isInteger)), `${r.natD.length} pose(s) : ${r.natD.map(e => e.a.join(',')).join(' | ')}`);
}
{
  call('QL=1;applyRes();'); frame();
  const r = frame();
  check('2c. qualite basse : les halos (seuls dessines) arrivent encore a l\'ecran', r.n > 0 && r.toMain.some(e => e.gco === 'lighter') && r.big.length === 0, desc(r));
}
{
  /* un coeur dans le champ : son halo est present vivant ET mort (celui du joueur ne l'est plus a sa mort, et le decor
     lointain, qui fournissait les paires avant le 01/10/2026, n'a plus de halo dans ce biome) */
  call('QL=3;applyRes();const h=G.hearts.find(h=>h.state!=="dead");h.x=G.p.x+140;h.y=G.p.y+20;'); const vivant = frame();
  call('G.p.dead=true;'); frame();
  const r = frame();
  /* meme halo d'un coeur (meme source, meme rectangle) : son alpha mort / vivant doit valoir 0,4 */
  const key = e => e.src && e.src.width + ':' + e.a.map(v => Math.round(v)).join(',');
  const vk = new Map(vivant.toMain.filter(e => e.gco === 'lighter').map(e => [key(e), e.ga]));
  const paires = r.toMain.filter(e => e.gco === 'lighter' && vk.has(key(e)) && vk.get(key(e)) > 0).map(e => e.ga / vk.get(key(e)));
  const ok = paires.length > 0 && paires.every(x => Math.abs(x - .4) < 1e-9) && r.lowa === 1;
  check('2d. a la mort : halos attenues a 0,4 (comme #cv.dying+#low), sans fuite apres la passe', ok, `${paires.length} halo(s) apparies, rapports ${[...new Set(paires.map(x => x.toFixed(3)))].join(',') || '-'} ; LOWA apres la passe = ${r.lowa}`);
  call('G.p.dead=false;');
}

/* ---------- verdict ---------- */
console.log(`test/halos.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
