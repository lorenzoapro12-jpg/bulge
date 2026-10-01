'use strict';
/* =========================================================
   Garde-fou des ÉCRANS D'INTERFACE (menus, pause, évolution, fin) — fluidité complète, 01/10/2026.

   Le défaut : derrière chaque écran d'interface, la boucle redessinait le canevas (menu principal : le monde ENTIER une
   image sur deux, caméra en dérive ; pause : une recopie plein écran une image sur quatre ; évolution, duel, fin : le
   monde figé, redessiné quand même). Par-dessus, `.ov` floutait le fond (`backdrop-filter:blur(4px)`) : chaque retouche
   du canevas obligeait le navigateur à refaire le flou plein écran. Mesuré (Chromium, canevas et composition logiciels,
   1920x1080, comme le Firefox du propriétaire) : menu principal 15 à 18 ips, pause 28, évolution 16 ; sans flou ET
   fond figé : 60 partout.

   Ce que ce test défend :
     M1. menu principal : après une mise en place bornée, plus AUCUNE opération sur le canevas principal ni génération
         de chunk à chaque image (le fond est figé) ;
     M2. pause, évolution, fin, entrées depuis le jeu : aucune opération dès la première image (la dernière image reste) ;
     M3. un applyRes() (redimensionnement, qualité) vide le canevas : exactement UN rendu, puis plus rien ;
     M4. retour au jeu : le canevas est de nouveau dessiné à chaque image ;
     M5. après une mort, revenir au menu ne laisse pas le canevas assombri (classe `dying`) ;
     M6. CSS : aucun `backdrop-filter`, aucun `filter` dans une animation (@keyframes), `#cv.dying` sans `filter`.
     M7. redimensionnement sur le menu figé : le fond n'est refigé qu'une fois les chunks devenus visibles cuits ;
     M8. menu figé en ville : pas de façade de tour manquante sur l'image figée (textures absentes du fil principal
         quand le worker a cuit les chunks : drawTowers n'en prépare qu'une par image).

   node test/menus.js              arbre de travail
   node test/menus.js --ref=HEAD   code d'origine (doit ÉCHOUER : c'est le témoin)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
let VW = 1920, VH = 1080;
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
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 }, T = [1, 1], S = [];
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
    setTransform(a, b, c, d) { T[0] = Math.hypot(a, b); T[1] = Math.hypot(c, d); OPS.n += this.__cv === OPS.main; },
    resetTransform() { T[0] = T[1] = 1; }, scale(x, y) { T[0] *= Math.abs(x); T[1] *= Math.abs(y); OPS.n += this.__cv === OPS.main; },
    save() { S.push(T.slice()); OPS.n += this.__cv === OPS.main; }, restore() { const t = S.pop(); if (t) { T[0] = t[0]; T[1] = t[1]; } OPS.n += this.__cv === OPS.main; },
  };
  base.drawImage = function (src, ...a) {
    if (this.__cv === OPS.main) OPS.n++;
    LOG.push({ dst: this.__cv, src, gco: st.globalCompositeOperation, ga: st.globalAlpha, a, sx: T[0], sy: T[1] });
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

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
call('boot();');
OPS.main = call('MAINCTX').__cv;
call(`(function(){const g=genChunk;globalThis.__GEN=0;genChunk=function(){__GEN++;return g.apply(this,arguments);};})()`);
let TS = 1000;
/* une image de la vraie boucle : frame(ts), 16,7 ms plus tard ; renvoie le nombre d'opérations sur le canevas principal */
const img = () => { OPS.n = 0; call('__GEN=0'); TS += 16.7; CLOCK = TS; call(`frame(${TS})`); return { n: OPS.n, gen: call('__GEN') }; };
const imgs = k => { let n = 0, gen = 0; for (let i = 0; i < k; i++) { const r = img(); n += r.n; gen += r.gen; } return { n, gen }; };
call(`DPR=1;QL=3;RES=1;resize();applyRes();perf=function(){};`);

/* ---------- M1. menu principal ---------- */
{
  call(`G=null;show('ov-menu');`);
  const mise = imgs(400), apres = imgs(120);
  check('M1. menu principal : fond figé après une mise en place bornée (aucune opération, aucun chunk généré)', apres.n === 0 && apres.gen === 0,
    `mise en place (400 images) : ${mise.n} opérations ; ensuite (120 images) : ${apres.n} opérations, ${apres.gen} chunks générés`);
}
/* ---------- M2. écrans entrés depuis le jeu ---------- */
call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();show(null);G.state='play';`);
{
  const jeu = imgs(30);
  const res = [];
  for (const st of ['pause', 'evo', 'end', 'duel']) {
    call(`G.state='play';`); imgs(4);
    call(`G.state='${st}';`); const r = imgs(40); res.push(st + ' ' + r.n);
  }
  check('M2. pause, évolution, fin, duel : aucune opération sur le canevas dès la première image', res.every(s => / 0$/.test(s)) && jeu.n > 0,
    `en jeu (30 images) : ${jeu.n} opérations ; puis ${res.join(', ')}`);
  /* ---------- M3. applyRes en pause ---------- */
  call(`G.state='pause';`); imgs(8);
  call('applyRes();'); const r1 = imgs(4), r2 = imgs(40);
  check('M3. applyRes() en pause : le canevas vidé est redessiné une fois, puis plus rien', r1.n > 0 && r2.n === 0, `4 images après applyRes : ${r1.n} opérations ; 40 suivantes : ${r2.n}`);
  /* ---------- M4. retour au jeu ---------- */
  call(`G.state='play';`); let zero = 0; for (let i = 0; i < 20; i++) if (img().n === 0) zero++;
  check('M4. retour au jeu : le canevas est redessiné à chaque image', zero === 0, `${zero}/20 images sans opération`);
}
/* ---------- M5. mort puis menu ---------- */
{
  call(`die();`); const avant = call(`cv.classList.contains('dying')`);
  call(`G.state='end';document.getElementById('bMenu').onclick&&document.getElementById('bMenu').onclick();`);
  const reste = call(`cv.classList.contains('dying')`);
  check('M5. mort puis « Menu » : le canevas n\'est plus assombri', avant && !reste, `classe dying : à la mort ${avant}, au menu ${reste}`);
}
/* ---------- M6. CSS ---------- */
{
  const sh = readModule('shell_head.html'), bad = [];
  if (/backdrop-filter/.test(sh)) bad.push('backdrop-filter');
  for (const m of sh.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) if (/filter\s*:/.test(m[2])) bad.push('@keyframes ' + m[1] + ' anime filter');
  const dy = sh.match(/#cv\.dying\s*\{([^}]*)\}/); if (dy && /filter\s*:/.test(dy[1])) bad.push('#cv.dying : filter');
  check('M6. CSS : ni backdrop-filter, ni filter animé, ni filtre sur le canevas à la mort', bad.length === 0, bad.join(' ; ') || 'aucun');
}

/* ---------- M7. redimensionnement sur le menu figé ---------- */
/* `img()` puis `bgPret()` : l'état du monde que montre la dernière image dessinée. Une fenêtre plus basse dézoome le menu :
   des chunks neufs entrent à l'écran. Le fond ne doit pas se refiger sur la première image redessinée s'ils ne sont pas prêts. */
/* figé = 8 images de suite sans opération (le menu ne redessine qu'une image sur deux) ; k = images redessinées avant */
const figeA = () => { let pret = null, k = 0, z = 0; for (let i = 0; i < 400 && z < 8; i++) { if (img().n === 0) z++; else { z = 0; k++; pret = call('bgPret()'); } } return { pret, k }; };
{
  call(`G=null;show('ov-menu');`); imgs(400);
  VW = 1920; VH = 560; call('resize();');
  const r = figeA();
  check('M7. redimensionnement sur le menu figé : le fond n\'est refigé qu\'une fois le monde visible prêt', r.pret === true && r.k < 400,
    `${r.k} image(s) redessinée(s) avant de refiger ; monde prêt sur la dernière : ${r.pret}`);
  VW = 1920; VH = 1080; call('resize();'); imgs(400);
}
/* ---------- M8. façades de la ville sur le menu figé ---------- */
/* Avec le worker, les chunks de la ville sont cuits ailleurs : les textures de façade (FACS) n'existent pas encore sur le fil
   principal, et drawTowers en prépare une par image. Ici, monde cuit sur place puis FACS vidé = la situation du worker. */
{
  const rt = call(`(function(){for(let r=0;r<2e5;r+=25){const x=Math.cos(r*.0007)*WR*.42,y=Math.sin(r*.00091)*WR*.38;if(biomeAt(x,y)==='urban')return r;}return -1;})()`);
  call(`(function(){const d=drawTowers;globalThis.__TW=0;drawTowers=function(){__TW=Math.max(__TW,TWL.length);return d.apply(this,arguments);};})()`);
  call(`MRT=${rt};CVOK=false;BGK='';BGN=0;`); imgs(400);
  call(`FACS.length=0;CVOK=false;BGK='';BGN=0;`); const r = figeA();
  const tours = call('__TW'), n0 = call('FACS.filter(Boolean).length');
  for (let i = 0; i < 20; i++) { call('CVOK=false;'); img(); }
  const n1 = call('FACS.filter(Boolean).length');
  check('M8. menu figé sur la ville : aucune façade encore manquante sur l\'image figée', rt >= 0 && tours > 0 && n1 === n0,
    `caméra du menu en ville : ${rt >= 0} ; ${tours} tour(s) à l'écran ; figé après ${r.k} image(s) avec ${n0} façade(s) prête(s), 20 rendus forcés ensuite en préparent ${n1 - n0} de plus`);
}

console.log(`test/menus.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
