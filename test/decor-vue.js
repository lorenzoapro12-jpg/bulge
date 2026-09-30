'use strict';
/* =========================================================
   LE DÉCOR MORD — CE QUI SE VOIT (chantier V2, g3.js). Les règles (g2.js, test/decor.js) sont posées par le vrai
   biome ; ici on appelle le VRAI render() et on lit les opérations canvas émises.

   node test/decor-vue.js              code de sortie 0 si tout passe, 1 sinon
   node test/decor-vue.js --ref=HEAD   mêmes tests sur un commit (TÉMOIN : 1, 3, 4, 5 doivent échouer, sans planter)

   1. Gueule ouverte : la zone de morsure (arc de rayon BLOOM_R centré sur la gueule) est dessinée, et son
      remplissage vaut BLOOM_R*bloomOpen(it,RT) — la même expression que la règle.  Au repos : rien.
   3. Morsure : au tick où G.dec.bite reçoit l'événement, un anneau est dessiné sur la zone.
   4. Choc de voiture : sillage du point d'impact (G.dec.car) jusqu'à l'ennemi projeté (position interpolée, ±15 px) ; la carrosserie est à carAt(it,RT).
   5. Chute : l'ennemi de G.dec.fall (retiré de G.en) est encore dessiné, réduit (scale<1) et déplacé vers le vide.
   6. Hors floral/urban/sky : render() ne lit ni G.dec.bite, ni G.dec.car, ni G.dec.fall.
   7. Plafond : 60 morsures simultanées n'ajoutent pas plus de DEC_N traces.

   (en-tête repris de test/decor.js)  les trois règles ; code de sortie 0 si tout passe, 1 sinon
   node test/decor.js --ref=HEAD   mêmes tests sur les modules d'un commit (TÉMOIN : doit échouer en nommant la cause)
   node test/decor.js --mesure     recul observé contre un gouffre, par source (justifie SKY_KB, g2.js)

   1. Gueules (floral)  : un ennemi dans le rayon d'une `bloom` à la morsure perd des PV ; le joueur, dans le rayon lui
                          aussi, ne perd rien.
   2. Circulation (urban) : un ennemi sur la trajectoire d'une `car` perd des PV et est projeté ; le joueur sur la même
                          trajectoire ne perd rien et n'est pas déplacé.
   3. Vide (sky)        : un ennemi projeté (Onde de choc, la compétence réelle, gcUse) contre un gouffre tombe et meurt ;
                          le MÊME ennemi, même geste, même géométrie, en plaines, survit.
   Chaque scène est posée par le vrai biome (G.biome par hystérésis : on attend qu'il bascule), jamais forcée.
   Aucune fonction nouvelle du jeu n'est appelée par les tests : sur l'ancien code, ils échouent sans planter.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), MESURE = !!ARG('mesure');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
  { get: (t, p) => (p in t ? t[p] : (...a) => { if (REC) LOG.push([p, a]); }), set: (t, p, v) => { t[p] = v; return true; } });
let REC = false, LOG = [];
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

/* outils de scène, dans le realm du jeu (uniquement des fonctions qui existaient AVANT le chantier) */
call(`
var __T={pin:null};
function __start(){newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.help=0;
  window.__SIM_INPUT=function(){G.inX=G.inY=0;G.spawnT=1e9;G.eb=[];if(!__T.fire){G.pb=[];G.p.fireT=1e9;}G.banner=null;if(G.gt)G.gt.on=false;if(__T.pin)__T.pin();};}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;for(const e of G.en)e.dead=true;G.en=[];G.arena=null;}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
/* attend que G.biome bascule (3 relevés espacés de 12 ticks) : jamais forcé */
function __settle(b){for(let i=0;i<80&&G.biome!==b;i++)step();return G.biome===b;}
function __calm(x,y){return x*x+y*y<(WR-900)**2&&G.hearts.every(h=>dist2(h.x,h.y,x,y)>1100*1100)&&dist2(WD.core.x,WD.core.y,x,y)>1300*1300;}
function __foe(t,x,y){const e=mkEnemy(t,x,y,{noElite:true,spawn:0,aggro:true});e.cd=1e9;e.hp=e.mhp=100;return e;}
/* le long d'une ligne de cellules : case libre, libre, gouffre (dx,dy = direction vers le gouffre), loin des obstacles */
function __edge(b){const want=b;for(let j=4;j<NG-4;j++)for(let i=4;i<NG-4;i++){if(!wallAt(i,j))continue;const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;if(x*x+y*y>(WR-400)**2)continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=wallAt(i,j)&&wallAt(i-dy,j+dx)&&wallAt(i+dy,j-dx);for(let k=1;k<=6&&ok;k++)for(let s=-1;s<=1;s++)if(wallAt(i-dx*k+s*dy,j-dy*k+s*dx))ok=false;
    if(!ok)continue;const ex=x-dx*WC*1.5,ey=y-dy*WC*1.5;if(biomeAt(ex,ey)!==want||biomeAt(x,y)!==want||biomeAt(x-dx*WC*5,y-dy*WC*5)!==want)continue;
    if(!__calm(ex,ey)||pointHit(ex,ey,40)||pointHit(x-dx*WC*4,y-dy*WC*4,30))continue;return {x:ex,y:ey,dx,dy,wx:x-dx*WC*.5,wy:y-dy*WC*.5};}}return null;}
`);


const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));
/* rend UNE image (vrai render, A=0) et renvoie les opérations canvas émises */
const frame = () => { LOG = []; REC = true; try { call(`render(0,16.7)`); } finally { REC = false; } return LOG; };
const near = (a, b, e) => Math.abs(a - b) < (e || .01);
call(`__start()`);
try { call(`resize&&resize()`); } catch (e) {}

/* ---------- 1-3. gueule ---------- */
{ let D, ok1 = false, ok2 = false, ok3 = false, d1 = '', d2 = '', d3 = '';
  try { D = J(`(()=>{let it=null;for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
      for(const q of c.live)if(q.t==='bloom'&&__calm(q.x,q.y)&&biomeAt(q.x,q.y)==='floral'&&biomeAt(q.x+200,q.y)==='floral'&&!wallNear(q.x,q.y,120)){it=q;break;}}
    if(!it)return {err:'aucune bloom en plein Jardin'};__T.it=it;
    __tp(it.x+200,it.y);const bi=__settle('floral');__T.pin=()=>{const P=G.p;P.x=P.px=it.x+120;P.y=P.py=it.y;P.vx=P.vy=0;};return {bset:bi,x:it.x,y:it.y};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || !D.bset) { d1 = d2 = d3 = D.err || 'G.biome n’a pas basculé en floral'; }
  else {
    const R = J(`BLOOM_R`), at = (L, r) => L.filter(o => o[0] === 'arc' && near(o[1][0], D.x) && near(o[1][1], D.y) && (r == null || near(o[1][2], r, .5)));
    /* repos : pas d'ouverture, pas de morsure récente */
    J(`__steps(250,()=>bloomOpen(__T.it,G.t)===0&&G.dec.bite.every(q=>G.t-q.t>=30))`);
    const L0 = frame(), o0 = J(`bloomOpen(__T.it,G.t)`);
    ok2 = o0 === 0 && at(L0, R).length === 0; d2 = 'ouverture ' + o0 + ', arcs de rayon BLOOM_R dessinés : ' + at(L0, R).length;
    /* ouverte, juste avant la morsure (≥ 0,85) */
    J(`__steps(250,()=>bloomOpen(__T.it,G.t)>=.85)`);
    const L1 = frame(), o1 = J(`bloomOpen(__T.it,G.t)`), ring = at(L1, R), fill = at(L1, R * o1);
    ok1 = o1 >= .85 && ring.length > 0 && fill.length > 0;
    d1 = 'ouverture ' + o1.toFixed(3) + ' ; contour BLOOM_R=' + R + ' : ' + ring.length + ', remplissage BLOOM_R·bloomOpen=' + (R * o1).toFixed(1) + ' : ' + fill.length;
    /* tick de la morsure */
    const n = J(`__steps(80,()=>G.dec.bite.some(q=>q.it===__T.it&&q.t===G.t))`), L2 = frame(), q = J(`(()=>{const q=G.dec.bite.find(q=>q.it===__T.it);return q?{t:q.t,gt:G.t,r:q.r}:null;})()`);
    const snap = q ? at(L2).filter(o => o[1][2] > R * .5 && o[1][2] <= R + .5) : [];
    ok3 = !!q && q.t === q.gt && snap.length > 0; d3 = q ? 'morsure au tick ' + q.t + ' (G.t=' + q.gt + '), anneaux sur la zone : ' + snap.length : 'aucune morsure en ' + n + ' ticks';
    call(`__T.pin=null`);
  }
  check('1. gueule ouverte juste avant la morsure : zone BLOOM_R dessinée, remplie à BLOOM_R·bloomOpen (même expression que la règle)', ok1, d1);
  check('2. gueule au repos : aucune zone de morsure dessinée', ok2, d2);
  check('3. morsure : au tick de G.dec.bite, un anneau claque sur la zone', ok3, d3);
}

/* ---------- 4. voiture ---------- */
{ let D, ok = false, d = '';
  try { D = J(`(()=>{let it=null;
    for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
      for(const q of c.live)if(q.t==='car'&&__calm(q.x+(q.vert?0:CH/2),q.y+(q.vert?CH/2:0))&&[0,.25,.5,.75,1].every(f=>{const x=q.vert?q.x:q.x+f*CH,y=q.vert?q.y+f*CH:q.y;return biomeAt(x,y)==='urban';})){it=q;break;}}
    if(!it)return {err:'aucune voiture en pleine Mégapole'};
    const P=G.p,ox=it.vert?140:0,oy=it.vert?0:140;let c0=carAt(it,G.t);__tp(c0[0]+ox,c0[1]+oy);
    __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;};const bi=__settle('urban');
    let c=carAt(it,G.t+1);const e=__foe('pop',c[0],c[1]),h0=e.hp;let hit=false;
    __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;if(!hit&&!e.dead){if(e.hp<h0)hit=true;else{e.x=c[0];e.y=c[1];e.vx=e.vy=0;}}};
    const n=__steps(60,()=>hit);__steps(4);__T.pin=null;__T.e=e;__T.it=it;
    const q=G.dec.car.find(q=>q.e===e);return {bset:bi,n,q:q?{x:q.x,y:q.y,t:q.t}:null,ex:e.x,ey:e.y,car:carAt(it,G.t),vert:it.vert};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || !D.bset || !D.q) d = D.err || (!D.bset ? 'G.biome n’a pas basculé en urban' : 'aucun choc enregistré dans G.dec.car');
  else { const L = frame();
    let trail = 0; for (let i = 0; i + 1 < L.length; i++) if (L[i][0] === 'moveTo' && near(L[i][1][0], D.q.x) && near(L[i][1][1], D.q.y) && L[i + 1][0] === 'lineTo' && near(L[i + 1][1][0], D.ex, 15) && near(L[i + 1][1][1], D.ey, 15)) trail++;
    const w = D.vert ? 10 : 20, h = D.vert ? 20 : 10, body = L.filter(o => o[0] === 'fillRect' && near(o[1][0], D.car[0] - w / 2) && near(o[1][1], D.car[1] - h / 2) && o[1][2] === w && o[1][3] === h).length;
    ok = trail > 0 && body > 0; d = 'choc au tick ' + D.q.t + ' en (' + D.q.x.toFixed(0) + ',' + D.q.y.toFixed(0) + '), sillage impact→ennemi : ' + trail + ', carrosserie à carAt(it,RT) : ' + body; }
  check('4. choc de voiture : sillage de G.dec.car jusqu’à l’ennemi projeté, carrosserie à carAt(it,RT)', ok, d);
}

/* ---------- 5. chute ---------- */
{ let D, ok = false, d = '';
  try { D = J(`(()=>{const E=__edge('sky');if(!E)return {err:'aucun bord de gouffre'};
    __tp(E.x-E.dx*200,E.y-E.dy*200);const bi=__settle('sky');const P=G.p;__tp(E.x-E.dx*120-E.dy*7,E.y-E.dy*120+E.dx*7);
    const e=__foe('pop',E.x,E.y);G.p.sk[0]={id:'shock',l:1,cd:0};
    __T.pin=()=>{P.x=P.px=E.x-E.dx*120-E.dy*7;P.y=P.py=E.y-E.dy*120+E.dx*7;P.vx=P.vy=0;};gcUse(0);
    const n=__steps(60,()=>e.fall>0&&e.fall<=FALL_T-8);__T.pin=null;
    return {bset:bi,n,fall:e.fall||0,inEn:G.en.includes(e),inF:G.dec.fall.includes(e),x:e.x,y:e.y};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || !D.bset || !D.inF) d = D.err || (!D.bset ? 'G.biome n’a pas basculé en sky' : 'aucune chute');
  else { const L = frame(); let sc = null;
    for (let i = 0; i + 1 < L.length; i++) if (L[i][0] === 'scale' && L[i][1][0] < 1 && L.slice(i, i + 3).some(o => o[0] === 'translate' && near(o[1][0], -D.x) && near(o[1][1], -D.y))) { sc = L[i][1][0]; break; }
    ok = sc !== null; d = 'ennemi en chute (e.fall=' + D.fall + ', dans G.en : ' + D.inEn + ') ; ' + (sc === null ? 'NON dessiné' : 'dessiné à l’échelle ' + sc.toFixed(2)); }
  check('5. chute : l’ennemi qui tombe reste visible, rétréci, pendant ses FALL_T ticks', ok, d);
}

/* ---------- 6. hors biome : rien n'est parcouru ---------- */
{ let d, ok = false;
  try { const r = J(`(()=>{const b=G.biome;let x=0,y=0;for(let i=0;i<60&&biomeAt(x,y)!=='plains';i++){x=Math.cos(i)*i*80;y=Math.sin(i*1.3)*i*80;}
      __tp(x,y);const bi=__settle('plains');const D=G.dec,cnt={n:0};G.dec={get bite(){cnt.n++;return D.bite;},get car(){cnt.n++;return D.car;},get fall(){cnt.n++;return D.fall;}};__T.cnt=cnt;__T.D=D;return {bset:bi};})()`);
    frame(); const n = J(`__T.cnt.n`); call(`G.dec=__T.D`);
    ok = r.bset && n === 0; d = r.bset ? 'lectures de G.dec pendant render() en plaines : ' + n : 'G.biome n’a pas basculé en plains'; }
  catch (e) { d = 'exception ' + e.message; }
  check('6. hors floral/urban/sky : render() ne parcourt aucun événement du décor', ok, d);
}

/* ---------- 7. plafond ---------- */
{ let d, ok = false;
  try { const r = J(`(()=>{const it=__T.it0||null;let q=null;for(let cx=-14;cx<=14&&!q;cx++)for(let cy=-14;cy<=14&&!q;cy++){const c=getChunk(cx,cy);if(!c)continue;
      for(const o of c.live)if(o.t==='bloom'&&__calm(o.x,o.y)&&biomeAt(o.x,o.y)==='floral'&&biomeAt(o.x+200,o.y)==='floral'){q=o;break;}}
      __tp(q.x+200,q.y);const bi=__settle('floral');__T.pin=()=>{const P=G.p;P.x=P.px=q.x+200;P.y=P.py=q.y;};
      G.dec.bite=[];for(let k=0;k<60;k++)G.dec.bite.push({it:{},x:q.x+1+(k%10)*3,y:q.y+1+(k/10|0)*3,r:BLOOM_R,t:G.t});return {bset:bi,x:q.x,y:q.y,N:typeof DEC_N==='number'?DEC_N:0};})()`);
    const L = frame(); call(`__T.pin=null;G.dec.bite=[]`);
    const n = L.filter(o => o[0] === 'arc' && o[1][0] >= r.x + .5 && o[1][0] <= r.x + 28.5 && o[1][1] >= r.y + .5 && o[1][1] <= r.y + 16.5 && near(o[1][2], J(`BLOOM_R`), .5)).length;
    ok = r.bset && r.N > 0 && n <= r.N; d = '60 morsures simultanées → ' + n + ' anneaux dessinés (plafond DEC_N=' + r.N + ')'; }
  catch (e) { d = 'exception ' + e.message; }
  check('7. plafond : une meute qui se fait mordre d’un coup ne multiplie pas le dessin', ok, d);
}

console.log('\n---------------- DÉCOR : CE QUI SE VOIT ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
