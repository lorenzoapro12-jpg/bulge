'use strict';
/* =========================================================
   CUISSON DELEGUEE PAR DEFAUT (chantier P1) — qui cuit le monde quand on ne demande rien ?

   node test/defaut.js                 tous les cas ; code de sortie 0 si tout passe, 1 sinon
   node test/defaut.js --ref=<commit>  memes cas sur les modules d'un commit de l'ere des ilots (TEMOIN : doit echouer
                                       en nommant la cause ; ex. 884ef80, dont le message {monde} ne portait pas la relique)
   BULGE_ROOT=<copie> node test/defaut.js   juge une copie du depot (test/lib.js), pour la prouver sensible

   Ce que ce test prouve : la DECISION et le REPLI (gw2.js : WKW, wkOn, wkFail, wkSync, relData, wkAsk, wkRecv, streamWorld),
   avec le vrai code du jeu (modules et ordre de build.sh : test/lib.js) et un Worker / OffscreenCanvas / ImageBitmap
   SIMULES — un cas par processus, parce que WKW se lit une seule fois, au chargement, sur location.search.
   Le monde : l'ilot K=2 de la partie 12345 (genIslet : relique au centre), camera fixe au centre.
     1. defaut            : aucun parametre d'URL => un Worker est cree, il recoit {monde : graine, ilot K, relique
                            absente} puis des {cuis} (au plus WKMAX en vol), tous les chunks arrivent en ImageBitmap,
                            bakeStep n'est JAMAIS appele ici. Une copie d'ecran d'une AUTRE partie (RELSNAP) traine : elle
                            ne doit pas partir au worker (relData).
     2. ?wk=0             : le temoin reste possible => aucun Worker cree, tout est cuit sur place.
     3. ?wk=1, ?a=1&wk=1  : l'ancienne URL marche toujours (worker).
     4. filet, worker indisponible : pas de Worker / pas d'OffscreenCanvas / pas de transferToImageBitmap / bloc
                            #wk-src absent / new Worker() qui leve => sur place, tout cuit, aucun chunk bloque.
     5. filet, worker en panne (force par WKW=true, pour que le temoin exerce le meme chemin) :
          erreur          : onerror avec des chunks en vol => terminate(), les chunks en vol sont cuits sur place.
          muet            : le worker ne repond jamais => repli apres WKMUET images, tout cuit sur place.
          lent            : le worker repond une image sur 200 => il n'est PAS abattu (le garde-fou du muet ne
                            doit pas tuer un worker sain mais lent).
     6. passage d'ilot (nouveau avec les ilots) : comme g2.js updTrans — copie d'ecran (RELSNAP de l'ilot K+1) puis
                            genIslet(K+1) — PENDANT que des chunks de l'ilot K sont en vol. Le worker recoit un second
                            {monde : ilot K+1, generation 2, rs = les pixels de la copie, 512x512} ; les reponses de
                            l'ilot quitte et ses ImageBitmap sont fermes, aucun n'est pose ; l'ilot K+1 arrive entier.
   Critere abandonne avec le monde continu : la camera « sur un site qui n'est pas les plaines » (WD.sites ne contient
   plus que le centre de l'ilot) ; remplace par l'ilot K=2, dont le centre porte la relique.
   Ce que ce test NE prouve PAS : qu'un vrai navigateur sait lancer le worker et que ses pixels sont les bons, relique
   comprise. C'est test/worker.js (vrai Chromium) ; les deux sont lances par test/navigateur.js.
   ========================================================= */
const vm = require('vm'), cp = require('child_process');
const L = require('./lib');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=').slice(1).join('=') || true) : null; };
const REF = ARG('ref'), CAS = ARG('cas');
const SEED = 12345, K = 2;

/* cas : search = location.search ; api = ce que le navigateur simule offre ; mode = comportement du worker simule ;
   force = WKW impose avant la premiere image ; n = images jouees au plus ; passage = image ou l'on change d'ilot */
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
  'passage':         { search: '', api: {}, mode: 'ok', n: 800, passage: 12 },
};

/* ---------- enfant : un cas, un processus ---------- */
if (CAS) {
  const C = TOUS[CAS], A = Object.assign({ worker: 1, offscreen: 1, transfer: 1, source: 1, leve: 0 }, C.api);
  /* getImageData compte : relData() ne doit lire la copie d'ecran qu'une fois par passage */
  const GI = { n: 0 };
  const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => { GI.n++; return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }; },
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
    { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
  const mkEl = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, after() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
  const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
  const stash = new Map();
  const doc = { getElementById: id => { if (id === 'wk-src' && !A.source) return null;
      if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); if (id === 'wk-src') e.textContent = '/* worker simule */'; stash.set(id, e); } return stash.get(id); },
    createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
  const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
  /* navigateur simule : le worker ne cuit rien, il note ce qu'on lui demande ; c'est le test qui repond a sa place.
     Chaque ImageBitmap rendu porte l'ilot que le worker croyait cuire (k du dernier {monde} recu). */
  const W = { crees: 0, last: null, bms: [] };
  class FauxWorker { constructor(url) { if (A.leve) throw new Error('SecurityError simulee'); W.crees++; W.last = this; this.url = url; this.msgs = []; this.att = []; this.g = 0; this.k = 0; this.mort = 0; }
    postMessage(m) { this.msgs.push(m); this.att.push(m); } terminate() { this.mort++; } }
  class FauxBitmap { constructor(k) { this.width = this.height = 512; this.k = k; W.bms.push(this); } close() { this.width = this.height = 0; } }
  class FauxOffscreen { constructor(w, h) { this.width = w; this.height = h; this.c = null; } getContext() { return this.c || (this.c = mkCtx()); } }
  if (A.transfer) FauxOffscreen.prototype.transferToImageBitmap = function () { return new FauxBitmap(0); };
  Object.assign(globalThis, { window: win, document: doc, location: { search: C.search, hash: '' }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {},
    ImageBitmap: FauxBitmap, __W: W, __GI: GI });
  if (A.worker) globalThis.Worker = FauxWorker;
  if (A.offscreen) globalThis.OffscreenCanvas = FauxOffscreen;
  try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
  { let s = 1; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  vm.runInThisContext(L.ordre(REF).order.map(f => L.readModule(f, REF)).join('\n'), { filename: 'game.js' });
  /* dans le realm du jeu : camera FIXE, streamWorld appele comme la boucle l'appelle (FRAME++ puis streamWorld),
     et entre deux images le worker simule rend (ou pas) ce qu'on lui a demande */
  const R = vm.runInThisContext(`(function(mode,nimg,force,seed,K,passage){
    const wkw0=WKW;if(force!==undefined)WKW=force;
    /* une copie d'ecran d'une AUTRE partie : elle ne doit ni servir de relique ni partir au worker */
    RELSNAP={run:seed+1,k:K,img:mkCanvas(512,512),data:null};
    genIslet(seed,K);const x=0,y=0;
    STRM.x=x;STRM.y=y;STRM.vx=STRM.vy=0;const bs0=bakeStep;let nbs=0;bakeStep=function(c){nbs++;return bs0(c);};
    let img=0,chute=-1,volMax=0,stable=0,last=-1,pris=false,recus=0,passe=-1,volPasse=0,gi0=0;
    for(;img<nimg;img++){CAM.x=x;CAM.y=y;RZ=1;VL=x-560;VR=x+560;VT=y-560;VB=y+560;FRAME++;streamWorld(6);
      const w=__W.last;if(WK){pris=true;volMax=Math.max(volMax,WK.enc.length);}
      /* passage d'ilot comme g2.js updTrans (trSnap puis genIslet), chunks de l'ilot K encore en vol */
      if(passage&&img===passage){volPasse=WK?WK.enc.length:0;RELSNAP={run:seed,k:K+1,img:mkCanvas(512,512),data:null};gi0=__GI.n;genIslet(seed,K+1);passe=img;}
      if(WK&&w){
        if(mode==='erreur'&&img===3)w.onerror({message:'panne simulee'});
        else if(mode==='ok'||mode==='erreur'||(mode==='lent'&&img%200===199)){const q=w.att.splice(0);
          for(const m of q){if(m.t==='monde'){w.g=m.g;w.k=m.k;w.onmessage({data:{t:'monde',seed:m.seed}});}
            else if(m.t==='cuis'){recus++;w.onmessage({data:{t:'cuis',cx:m.cx,cy:m.cy,g:w.g,bm:new ImageBitmap(w.k)}});}}}}
      if(pris&&!WK&&chute<0)chute=img;
      const n=WD.bakes.length,occ=WD.chunks.some(c=>c&&(c.bk||c.wk));
      if(n>0&&n===last&&!occ&&(!passage||passe>=0))stable++;else stable=0;last=n;if(stable>=3&&mode!=='lent')break;}
    const w=__W.last,bm=WD.bakes.filter(c=>isBm(c.bake)).length;
    const mondes=w?w.msgs.filter(m=>m.t==='monde').map(m=>({seed:m.seed,k:m.k,g:m.g,rs:m.rs?[m.rs.width,m.rs.height,m.rs.data?m.rs.data.length:-1]:m.rs===undefined?'absent':null})):[];
    const kq=passage?K:-1,vieux=__W.bms.filter(b=>b.k===kq),poses=WD.bakes.filter(c=>isBm(c.bake)&&c.bake.k!==WD.isl).length;
    return JSON.stringify({wkw0,wkw:WKW,crees:__W.crees,wk:WK===null?'null':WK?'worker':'sur place',img,chute,volMax,nbs,recus,
      cuits:WD.bakes.length,bm,place:WD.bakes.length-bm,enVol:WD.chunks.filter(c=>c&&c.wk).length,enCours:WD.chunks.filter(c=>c&&c.bk).length,
      msgs:w?w.msgs.slice(0,3).map(m=>m.t):[],mondes,nmsg:w?w.msgs.length:0,mort:w?w.mort:0,isl:WD.isl,
      passe,volPasse,vieux:vieux.length,vieuxOuverts:vieux.filter(b=>b.width>0).length,poses,lect:passage?__GI.n-gi0:__GI.n,relSnap:WD.relic===RELSNAP.img,
      wkmax:typeof WKMAX==='number'?WKMAX:null,muet:typeof WKMUET==='number'?WKMUET:null});})`)(C.mode, C.n, C.force, SEED, K, C.passage || 0);
  process.stdout.write('\n@@' + R + '\n');
  process.exit(0);
}

/* ---------- parent : lance chaque cas et juge ---------- */
const run = cas => { const r = cp.spawnSync(process.execPath, [__filename, '--cas=' + cas].concat(REF ? ['--ref=' + REF] : []), { cwd: L.ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  const m = /\n@@(.*)\n/.exec(r.stdout || ''); if (!m) return { err: ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-4).join(' / ') || 'aucune sortie (code ' + r.status + ')' }; return JSON.parse(m[1]); };
let ok = true;
const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '\n          ' + info : '')); };
const etat = r => r.err ? 'EXCEPTION ' + r.err : `WKW=${r.wkw0} · ${r.crees} Worker cree(s) · etat final « ${r.wk} » · ilot ${r.isl} : ${r.cuits} chunks cuits en ${r.img} images : ${r.bm} ImageBitmap + ${r.place} sur place · bakeStep x${r.nbs} · en vol ${r.enVol}, en cours ${r.enCours}`;
const mo = m => m ? `{monde graine ${m.seed}, ilot ${m.k}, generation ${m.g}, rs ${m.rs === 'absent' ? 'ABSENT du message' : m.rs ? m.rs[0] + 'x' + m.rs[1] + ' (' + m.rs[2] + ' octets)' : 'null'}}` : 'aucun {monde}';
/* le premier message : le monde de CETTE partie, ilot K, et pas de relique (la copie d'ecran qui traine est d'une autre partie) */
const monde0 = r => !!r.mondes && r.mondes.length >= 1 && r.mondes[0].seed === SEED && r.mondes[0].k === K && (r.mondes[0].rs === null || r.mondes[0].rs === 'absent') && r.msgs[0] === 'monde' && r.msgs[1] === 'cuis';
/* les verdicts ; `cause` nomme ce qui ne va pas quand le cas echoue */
const worker = r => !r.err && r.wk === 'worker' && r.crees === 1 && r.cuits > 0 && r.bm === r.cuits && r.nbs === 0 && r.enVol === 0 && r.volMax >= 1 && r.volMax <= r.wkmax && monde0(r) && !r.relSnap;
const place = r => !r.err && r.wk === 'sur place' && r.cuits > 0 && r.bm === 0 && r.nbs > 0 && r.enVol === 0 && r.enCours === 0;
const causeW = (r, url) => r.err ? r.err : r.crees === 0 && r.wkw0 === false ? `CAUSE : WKW=false avec location.search=« ${url} » — la cuisson deleguee est OPT-IN (gw2.js : WKW exige ?wk=1), wkOn() ne cree aucun Worker, les ${r.cuits} chunks sont cuits sur place (bakeStep x${r.nbs})`
  : r.nbs > 0 ? `CAUSE : bakeStep appele ${r.nbs} fois sur le fil principal alors que le worker est disponible` : r.volMax > r.wkmax ? `CAUSE : ${r.volMax} chunks en vol > WKMAX=${r.wkmax}`
  : r.relSnap ? 'CAUSE : la copie d\'ecran d\'une AUTRE partie sert de relique sur place (genIslet ne verifie pas RELSNAP.run/k)'
  : !monde0(r) ? `CAUSE : premier message ${mo(r.mondes && r.mondes[0])} puis « ${r.msgs[1]} » — attendu {monde graine ${SEED}, ilot ${K}, rs null ou absent} puis {cuis}` : 'CAUSE : ' + etat(r);

console.log('CUISSON DELEGUEE PAR DEFAUT — ' + (REF ? 'modules de ' + REF + ' (TEMOIN)' : 'modules du depot' + (process.env.BULGE_ROOT ? ' ' + L.ROOT : '')) + ', worker simule, partie ' + SEED + ' ilot ' + K + ', camera fixe au centre\n');
console.log('=== 1. defaut : aucun parametre d\'URL');
{ const r = run('defaut'); check('le worker est PRIS par defaut : tous les chunks en ImageBitmap, aucun bakeStep ici ; {monde} = graine + ilot, sans relique d\'une autre partie', worker(r), worker(r) ? etat(r) + ' · au plus ' + r.volMax + ' en vol (WKMAX=' + r.wkmax + ') · ' + mo(r.mondes[0]) + ', puis ' + r.msgs.slice(1).join(', ') + '…' : causeW(r, '')); }
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
console.log('\n=== 6. passage d\'ilot (copie d\'ecran puis genIslet, comme g2.js updTrans) avec des chunks de l\'ilot quitte en vol');
{ const r = run('passage'), m1 = r.mondes && r.mondes[1];
  const msg = !r.err && r.mondes.length === 2 && monde0(r) && m1.seed === SEED && m1.k === K + 1 && m1.g === r.mondes[0].g + 1 && Array.isArray(m1.rs) && m1.rs[0] === 512 && m1.rs[1] === 512 && m1.rs[2] === 512 * 512 * 4;
  check('le worker recoit le NOUVEL ilot : {monde graine, ilot K+1, generation suivante, rs = pixels de la copie d\'ecran 512x512}', msg,
    r.err ? r.err : r.mondes.map(mo).join(' puis ') + (msg ? '' : (m1 && m1.rs === 'absent' ? ' — CAUSE : le message ne porte pas la relique, le worker cuirait la miniature CALCULEE au lieu de l\'ile quittee REELLE (sur place : la copie d\'ecran) : centre du sol different selon qui cuit'
      : m1 && m1.rs === null ? ' — CAUSE : rs null alors que la copie d\'ecran de cet ilot existe (relData)' : !m1 ? ' — CAUSE : aucun second {monde} : le worker cuirait l\'ilot quitte' : '')));
  check('la copie d\'ecran est la relique de l\'ilot K+1 sur place, et n\'est lue qu\'une fois (relData)', !r.err && r.relSnap && r.lect === 1, r.err ? r.err : 'relique = copie : ' + r.relSnap + ', getImageData x' + r.lect + ' depuis le passage');
  const g = !r.err && r.volPasse >= 1 && r.vieux > 0 && r.vieuxOuverts === 0 && r.poses === 0 && r.isl === K + 1 && r.wk === 'worker' && r.cuits > 0 && r.bm === r.cuits && r.nbs === 0 && r.enVol === 0;
  check('ilot quitte : ses ImageBitmap (poses ou en vol) sont tous fermes, aucun n\'est pose sur l\'ilot K+1 ; l\'ilot K+1 arrive entier par le worker', g,
    r.err ? r.err : etat(r) + ' · passage a l\'image ' + r.passe + ' avec ' + r.volPasse + ' chunk(s) en vol · ' + r.vieux + ' ImageBitmap de l\'ilot ' + K + ', ' + r.vieuxOuverts + ' encore ouvert(s) · ' + r.poses + ' image(s) d\'un autre ilot posee(s)'); }

console.log('\nNON COUVERT ICI : le vrai Worker d\'un vrai navigateur et ses pixels, relique comprise (test/worker.js, lance par test/navigateur.js).');
console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
process.exit(ok ? 0 : 1);
