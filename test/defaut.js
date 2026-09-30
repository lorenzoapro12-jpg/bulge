'use strict';
/* =========================================================
   CUISSON DELEGUEE PAR DEFAUT (chantier P1) — qui cuit le monde quand on ne demande rien ?

   node test/defaut.js              tous les cas ; code de sortie 0 si tout passe, 1 sinon
   node test/defaut.js --ref=HEAD   memes cas sur les modules d'un commit (TEMOIN : doit echouer en nommant la cause)

   Ce que ce test prouve : la DECISION et le REPLI (gw2.js : WKW, wkOn, wkFail, wkSync, wkAsk, wkRecv, streamWorld),
   avec le vrai code du jeu et un Worker / OffscreenCanvas / ImageBitmap SIMULES — un cas par processus, parce que
   WKW se lit une seule fois, au chargement, sur location.search.
     1. defaut            : aucun parametre d'URL => un Worker est cree, il recoit {monde} puis des {cuis} (au plus
                            WKMAX en vol), tous les chunks arrivent en ImageBitmap, bakeStep n'est JAMAIS appele ici.
     2. ?wk=0             : le temoin reste possible => aucun Worker cree, tout est cuit sur place.
     3. ?wk=1, ?a=1&wk=1  : l'ancienne URL marche toujours (worker).
     4. filet, worker indisponible : pas de Worker / pas d'OffscreenCanvas / pas de transferToImageBitmap / bloc
                            #wk-src absent / new Worker() qui leve => sur place, tout cuit, aucun chunk bloque.
     5. filet, worker en panne (force par WKW=true, pour que le temoin exerce le meme chemin) :
          erreur          : onerror avec des chunks en vol => terminate(), les chunks en vol sont cuits sur place.
          muet            : le worker ne repond jamais => repli apres WKMUET images, tout cuit sur place.
          lent            : le worker repond une image sur 200 => il n'est PAS abattu (le garde-fou du muet ne
                            doit pas tuer un worker sain mais lent).
   Ce que ce test NE prouve PAS : qu'un vrai navigateur sait lancer le worker et que ses pixels sont les bons.
   C'est test/worker.js (vrai Chromium) ; les deux sont lances par test/navigateur.js.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=').slice(1).join('=') || true) : null; };
const REF = ARG('ref'), CAS = ARG('cas');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* cas : search = location.search ; api = ce que le navigateur simule offre ; mode = comportement du worker simule ;
   force = WKW impose avant la premiere image ; n = images jouees au plus */
const TOUS = {
  'defaut':          { search: '', api: {}, mode: 'ok', n: 400 },
  'wk0':             { search: '?wk=0', api: {}, mode: 'ok', n: 1500 },
  'wk1':             { search: '?wk=1', api: {}, mode: 'ok', n: 400 },
  'wk1-second':      { search: '?a=1&wk=1', api: {}, mode: 'ok', n: 400 },
  'sans-Worker':     { search: '', api: { worker: 0 }, mode: 'ok', n: 1500 },
  'sans-Offscreen':  { search: '', api: { offscreen: 0 }, mode: 'ok', n: 1500 },
  'sans-transfer':   { search: '', api: { transfer: 0 }, mode: 'ok', n: 1500 },
  'sans-source':     { search: '', api: { source: 0 }, mode: 'ok', n: 1500 },
  'Worker-leve':     { search: '', api: { leve: 1 }, mode: 'ok', n: 1500 },
  'erreur':          { search: '', api: {}, mode: 'erreur', force: true, n: 1500 },
  'muet':            { search: '', api: {}, mode: 'muet', force: true, n: 2400 },
  'lent':            { search: '', api: {}, mode: 'lent', force: true, n: 1500 },
};

/* ---------- enfant : un cas, un processus ---------- */
if (CAS) {
  const C = TOUS[CAS], A = Object.assign({ worker: 1, offscreen: 1, transfer: 1, source: 1, leve: 0 }, C.api);
  const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
  const mkEl = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
  const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
  const stash = new Map();
  const doc = { getElementById: id => { if (id === 'wk-src' && !A.source) return null;
      if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); if (id === 'wk-src') e.textContent = '/* worker simule */'; stash.set(id, e); } return stash.get(id); },
    createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
  const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
  /* navigateur simule : le worker ne cuit rien, il note ce qu'on lui demande ; c'est le test qui repond a sa place */
  const W = { crees: 0, last: null };
  class FauxWorker { constructor(url) { if (A.leve) throw new Error('SecurityError simulee'); W.crees++; W.last = this; this.url = url; this.msgs = []; this.att = []; this.g = 0; this.mort = 0; }
    postMessage(m) { this.msgs.push(m); this.att.push(m); } terminate() { this.mort++; } }
  class FauxBitmap { constructor() { this.width = this.height = 512; } close() { this.width = this.height = 0; } }
  class FauxOffscreen { constructor(w, h) { this.width = w; this.height = h; this.c = null; } getContext() { return this.c || (this.c = mkCtx()); } }
  if (A.transfer) FauxOffscreen.prototype.transferToImageBitmap = function () { return new FauxBitmap(); };
  Object.assign(globalThis, { window: win, document: doc, location: { search: C.search, hash: '' }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {},
    ImageBitmap: FauxBitmap, __W: W });
  if (A.worker) globalThis.Worker = FauxWorker;
  if (A.offscreen) globalThis.OffscreenCanvas = FauxOffscreen;
  try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
  { let s = 1; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  vm.runInThisContext(ORDER.map(read).join('\n'), { filename: 'game.js' });
  /* dans le realm du jeu : camera FIXE, streamWorld appele comme la boucle l'appelle (FRAME++ puis streamWorld),
     et entre deux images le worker simule rend (ou pas) ce qu'on lui a demande */
  const R = vm.runInThisContext(`(function(mode,nimg,force){
    const wkw0=WKW;if(force!==undefined)WKW=force;
    genWorld(12345);const s=WD.sites.find(q=>q.t!=='plains')||WD.sites[0],x=Math.round(s.x),y=Math.round(s.y);
    STRM.x=x;STRM.y=y;STRM.vx=STRM.vy=0;const bs0=bakeStep;let nbs=0;bakeStep=function(c){nbs++;return bs0(c);};
    let img=0,chute=-1,volMax=0,stable=0,last=-1,pris=false,recus=0;
    for(;img<nimg;img++){CAM.x=x;CAM.y=y;RZ=1;VL=x-560;VR=x+560;VT=y-560;VB=y+560;FRAME++;streamWorld(6);
      const w=__W.last;if(WK){pris=true;volMax=Math.max(volMax,WK.enc.length);}
      if(WK&&w){
        if(mode==='erreur'&&img===3)w.onerror({message:'panne simulee'});
        else if(mode==='ok'||mode==='erreur'||(mode==='lent'&&img%200===199)){const q=w.att.splice(0);
          for(const m of q){if(m.t==='monde'){w.g=m.g;w.onmessage({data:{t:'monde',seed:m.seed}});}
            else if(m.t==='cuis'){recus++;w.onmessage({data:{t:'cuis',cx:m.cx,cy:m.cy,g:w.g,bm:new ImageBitmap()}});}}}}
      if(pris&&!WK&&chute<0)chute=img;
      const n=WD.bakes.length,occ=WD.chunks.some(c=>c&&(c.bk||c.wk));
      if(n>0&&n===last&&!occ)stable++;else stable=0;last=n;if(stable>=3&&mode!=='lent')break;}
    const w=__W.last,bm=WD.bakes.filter(c=>isBm(c.bake)).length;
    return JSON.stringify({wkw0,wkw:WKW,crees:__W.crees,wk:WK===null?'null':WK?'worker':'sur place',img,chute,volMax,nbs,recus,
      cuits:WD.bakes.length,bm,place:WD.bakes.length-bm,enVol:WD.chunks.filter(c=>c&&c.wk).length,enCours:WD.chunks.filter(c=>c&&c.bk).length,
      msgs:w?w.msgs.slice(0,3).map(m=>m.t+(m.t==='monde'?':'+m.seed:'')):[],nmsg:w?w.msgs.length:0,mort:w?w.mort:0,
      wkmax:typeof WKMAX==='number'?WKMAX:null,muet:typeof WKMUET==='number'?WKMUET:null});})`)(C.mode, C.n, C.force);
  process.stdout.write('\n@@' + R + '\n');
  process.exit(0);
}

/* ---------- parent : lance chaque cas et juge ---------- */
const run = cas => { const r = cp.spawnSync(process.execPath, [__filename, '--cas=' + cas].concat(REF ? ['--ref=' + REF] : []), { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  const m = /\n@@(.*)\n/.exec(r.stdout || ''); if (!m) return { err: ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-4).join(' / ') || 'aucune sortie (code ' + r.status + ')' }; return JSON.parse(m[1]); };
let ok = true;
const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '\n          ' + info : '')); };
const etat = r => r.err ? 'EXCEPTION ' + r.err : `WKW=${r.wkw0} · ${r.crees} Worker cree(s) · etat final « ${r.wk} » · ${r.cuits} chunks cuits en ${r.img} images : ${r.bm} ImageBitmap + ${r.place} sur place · bakeStep x${r.nbs} · en vol ${r.enVol}, en cours ${r.enCours}`;
/* les verdicts ; `cause` nomme ce qui ne va pas quand le cas echoue */
const worker = r => !r.err && r.wk === 'worker' && r.crees === 1 && r.cuits > 0 && r.bm === r.cuits && r.nbs === 0 && r.enVol === 0 && r.volMax >= 1 && r.volMax <= r.wkmax && r.msgs[0] === 'monde:12345' && r.msgs[1] === 'cuis';
const place = r => !r.err && r.wk === 'sur place' && r.cuits > 0 && r.bm === 0 && r.nbs > 0 && r.enVol === 0 && r.enCours === 0;
const causeW = (r, url) => r.err ? r.err : r.crees === 0 && r.wkw0 === false ? `CAUSE : WKW=false avec location.search=« ${url} » — la cuisson deleguee est OPT-IN (gw2.js : WKW exige ?wk=1), wkOn() ne cree aucun Worker, les ${r.cuits} chunks sont cuits sur place (bakeStep x${r.nbs})`
  : r.nbs > 0 ? `CAUSE : bakeStep appele ${r.nbs} fois sur le fil principal alors que le worker est disponible` : r.volMax > r.wkmax ? `CAUSE : ${r.volMax} chunks en vol > WKMAX=${r.wkmax}` : 'CAUSE : ' + etat(r);

console.log('CUISSON DELEGUEE PAR DEFAUT — ' + (REF ? 'modules de ' + REF + ' (TEMOIN)' : 'modules du depot') + ', worker simule, graine 12345, camera fixe\n');
console.log('=== 1. defaut : aucun parametre d\'URL');
{ const r = run('defaut'); check('le worker est PRIS par defaut : tous les chunks en ImageBitmap, aucun bakeStep ici', worker(r), worker(r) ? etat(r) + ' · au plus ' + r.volMax + ' en vol (WKMAX=' + r.wkmax + ') · messages ' + r.msgs.join(', ') + '…' : causeW(r, '')); }
console.log('\n=== 2. ?wk=0 : le temoin sur place reste possible');
{ const r = run('wk0'); check('?wk=0 => aucun Worker cree, tout est cuit sur place', place(r) && r.crees === 0 && r.wkw0 === false, (place(r) && r.crees === 0 ? '' : 'CAUSE : ?wk=0 n\'est pas honore — ') + etat(r)); }
console.log('\n=== 3. ?wk=1 : l\'ancienne URL marche toujours');
for (const [c, u] of [['wk1', '?wk=1'], ['wk1-second', '?a=1&wk=1']]) { const r = run(c); check(u + ' => worker', worker(r), worker(r) ? etat(r) : causeW(r, u)); }
console.log('\n=== 4. filet : worker INDISPONIBLE => sur place, tout cuit, rien de bloque');
for (const [c, l] of [['sans-Worker', 'pas de Worker'], ['sans-Offscreen', 'pas d\'OffscreenCanvas'], ['sans-transfer', 'OffscreenCanvas sans transferToImageBitmap'], ['sans-source', 'bloc #wk-src absent'], ['Worker-leve', 'new Worker() leve']]) {
  const r = run(c); check(l, place(r) && r.wkw0 === true && (c !== 'Worker-leve' ? r.crees === 0 : true), (place(r) ? '' : 'CAUSE : pas de repli propre — ') + etat(r)); }
console.log('\n=== 5. filet : worker EN PANNE (WKW force a true : le temoin exerce le meme chemin)');
{ const r = run('erreur'); const g = !r.err && r.wk === 'sur place' && r.mort === 1 && r.chute === 3 && r.cuits > 0 && r.bm > 0 && r.place > 0 && r.enVol === 0 && r.enCours === 0;
  check('onerror avec des chunks en vol => terminate(), repli, les chunks en vol sont cuits sur place', g, (g ? '' : 'CAUSE : panne mal rattrapee — ') + etat(r) + (r.err ? '' : ' · repli a l\'image ' + r.chute + ', terminate x' + r.mort)); }
{ const r = run('muet'); const g = !r.err && r.wk === 'sur place' && r.mort === 1 && r.cuits > 0 && r.bm === 0 && r.enVol === 0 && r.enCours === 0 && r.chute > 0;
  check('worker MUET (ne repond jamais) => repli apres WKMUET images, tout cuit sur place', g,
    g ? etat(r) + ' · repli a l\'image ' + r.chute + ' (WKMUET=' + r.muet + ')' : r.err ? r.err : r.wk === 'worker' && r.cuits === 0 ? `CAUSE : worker muet jamais abandonne — ${r.enVol} chunks demandes et jamais rendus, 0 chunk cuit en ${r.img} images, etat « ${r.wk} » : le sol de secours reste a l'ecran pour toujours (aucun garde-fou dans streamWorld, WKMUET=${r.muet})` : 'CAUSE : ' + etat(r)); }
{ const r = run('lent'); const g = !r.err && r.wk === 'worker' && r.mort === 0 && r.nbs === 0 && r.bm === r.cuits && r.cuits >= 8;
  check('worker LENT (repond une image sur 200) => PAS abattu, toujours worker', g, (g ? '' : 'CAUSE : un worker lent mais sain est abattu ou contourne — ') + etat(r) + (r.err ? '' : ' · ' + r.recus + ' chunks rendus')); }

console.log('\nNON COUVERT ICI : le vrai Worker d\'un vrai navigateur et ses pixels (test/worker.js, lance par test/navigateur.js).');
console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
process.exit(ok ? 0 : 1);
