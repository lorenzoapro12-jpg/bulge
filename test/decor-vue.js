'use strict';
/* =========================================================
   LE DÉCOR MORD — CE QUI SE VOIT (g3.js). Les règles (g2.js, test/decor.js) sont posées par le VRAI îlot
   (genIslet(G.seed,k) + islStart : G.biome = ISL[k-1]) ; ici on appelle le VRAI render() et on lit les opérations
   canvas émises (contexte enregistreur : [méthode, arguments, globalAlpha]).

   node test/decor-vue.js              code de sortie 0 si tout passe, 1 sinon
   node test/decor-vue.js --ref=HEAD   mêmes tests sur un commit (avant la refonte : « API différente »)

   1. Gueule ouverte (îlot 2, floral) : la zone de morsure (arc de rayon BLOOM_R centré sur la gueule) est dessinée, et
      son remplissage vaut BLOOM_R*bloomOpen(it,RT) — la même expression que la règle.
   2. Gueule au repos : rien.
   3. Morsure : au tick où G.dec.bite reçoit l'événement, un anneau est dessiné sur la zone.
   4. Choc de voiture (îlot 6, urban) : sillage du point d'impact (G.dec.car) jusqu'à l'ennemi projeté (position
      interpolée, ±15 px) ; la carrosserie est à carAt(it,RT).
   5. Chute (îlot 4, sky) : l'ennemi de G.dec.fall (retiré de G.en) est encore dessiné, réduit (scale<1) et déplacé.
   6. Îlots sans gueule, voiture ni vide (plains, core) : render() ne lit ni G.dec.bite, ni G.dec.car, ni G.dec.fall.
   7. Plafond : 60 morsures simultanées n'ajoutent pas plus de DEC_N traces.
   Repris de test/decor-vivant.js (supprimé : monuments et frontières n'existent plus) :
   8. Gradient : le halo d'une veine (drawLive node) croît à l'approche de WD.core (monotone, ≥ 1,5× entre 7000 px et
      le Cœur) ; coreK (braises) strictement décroissant. Fonction de la distance : évaluée au-delà du rayon de l'îlot.
   9. N3 : le pool de marques du joueur (MK, markStep) ne croît pas sur 2000 pas, et des marques sont posées.
   Retiré avec la refonte : l'hystérésis de G.biome (un biome par îlot) ; l'Onde de choc de compétence (gcUse) —
   la chute est déclenchée par le power-up Onde (takePU wave), géométrie de test/decor.js.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
let REC = false, LOG = [];
const mkCtx = () => { const g = { addColorStop() {} };
  const base = { globalAlpha: 1, createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createRadialGradient: () => g, createLinearGradient: () => g, createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) };
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : (...a) => { if (REC) LOG.push([p, a, t.globalAlpha]); }), set: (t, p, v) => { t[p] = v; return true; } }); };
const H = L.mkGame({ ref: REF, seed: 3, mkCtx, w: 390, h: 780 }), call = H.call;
if (call(`typeof genIslet`) !== 'function') { console.log(`API différente : ${REF || 'l’arbre'} n’a pas d’îlots (genIslet absent) — rien à comparer`); console.log('ECHEC'); process.exit(1); }
H.start(); call(`resize()`);

/* outils de scène, dans le realm du jeu (mêmes que test/decor.js) */
call(`
var __T={pin:null};
window.__SIM_INPUT=function(){G.inX=G.inY=0;G.ph='arrive';G.phT=0;G.pickIsl=G.isl;G.eb=[];G.marks=[];G.tele=[];G.pb=[];G.p.fireT=1e9;G.banner=null;if(__T.pin)__T.pin();};
function __isl(k,j){if(G.state!=='play'){G.state='play';G.p.dead=false;G.p.seg=G.p.segMax;G.timeScale=1;}if(j)G.seed=(G.seed+j)>>>0;genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();return G.biome;}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;P.dashing=0;G.freeze=0;G.cx=G.pcx=x;G.cy=G.pcy=y;for(const e of G.en)e.dead=true;G.en=[];G.dec.fall=[];}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
function __foe(t,x,y){const e=mkEnemy(t,x,y,{spawn:0,age:0});e.cd=1e9;e.hp=e.mhp=100;return e;}
function __calm(x,y){const r=Math.hypot(x,y);return r>RELR+60&&r<PR-80;}
function __live(t){const L=[];for(let cx=-COFF;cx<COFF;cx++)for(let cy=-COFF;cy<COFF;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.live)if(q.t===t)L.push(q);}return L;}
function __edge(){for(let j=2;j<NG-2;j++)for(let i=2;i<NG-2;i++){if(!wallAt(i,j))continue;const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=wallAt(i-dy,j+dx)&&wallAt(i+dy,j-dx);for(let k=1;k<=6&&ok;k++)for(let s=-1;s<=1;s++)if(wallAt(i-dx*k+s*dy,j-dy*k+s*dx))ok=false;
    if(!ok)continue;const ex=x-dx*WC*1.5,ey=y-dy*WC*1.5;
    if(!__calm(ex,ey)||!__calm(x-dx*WC*5,y-dy*WC*5)||pointHit(ex,ey,40)||pointHit(x-dx*WC*4,y-dy*WC*4,30))continue;return {x:ex,y:ey,dx,dy,wx:x-dx*WC*.5,wy:y-dy*WC*.5};}}return null;}
`);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));
/* rend UNE image (vrai render, A=0) et renvoie les opérations canvas émises */
const frame = () => { LOG = []; REC = true; try { call(`render(0,16.7)`); } finally { REC = false; } return LOG; };
const near = (a, b, e) => Math.abs(a - b) < (e || .01);

/* ---------- 1-3. gueule ---------- */
{ let D, ok1 = false, ok2 = false, ok3 = false, d1 = '', d2 = '', d3 = '';
  try { D = J(`(()=>{let it=null,bi='';for(let j=0;j<6&&!it;j++){bi=__isl(2,j);for(const q of __live('bloom'))if(__calm(q.x,q.y)&&!wallNear(q.x,q.y,120)&&!pointHit(q.x+120,q.y,30)){it=q;break;}}
    if(!it)return {err:'aucune bloom dégagée sur l’îlot floral'};__T.it=it;
    __tp(it.x+120,it.y);__T.pin=()=>{const P=G.p;P.x=P.px=it.x+120;P.y=P.py=it.y;P.vx=P.vy=0;};return {bi,x:it.x,y:it.y};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || D.bi !== 'floral') { d1 = d2 = d3 = D.err || 'l’îlot 2 n’est pas floral (' + D.bi + ')'; }
  else {
    frame();
    const R = J(`BLOOM_R`), at = (Lg, r) => Lg.filter(o => o[0] === 'arc' && near(o[1][0], D.x) && near(o[1][1], D.y) && (r == null || near(o[1][2], r, .5)));
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
  try { D = J(`(()=>{let it=null,bi='';const lane=q=>{for(let f=0;f<=1;f+=.125){const x=q.vert?q.x:q.x+f*CH,y=q.vert?q.y+f*CH:q.y;if(!__calm(x,y)||pointHit(x,y,30)||wallNear(x,y,30))return false;}return true;};
    for(let j=0;j<6&&!it;j++){bi=__isl(6,j);for(const q of __live('car'))if(lane(q)){it=q;break;}}
    if(!it)return {err:'aucune voiture sur une chaussée dégagée de la Mégapole'};
    const P=G.p,ox=it.vert?140:0,oy=it.vert?0:140;let c0=carAt(it,G.t);__tp(c0[0]+ox,c0[1]+oy);
    __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;P.inv=1e9;};
    let c=carAt(it,G.t+1);const e=__foe(ETL[5],c[0],c[1]),h0=e.hp;let hit=false;
    __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;P.inv=1e9;if(!hit&&!e.dead){if(e.hp<h0)hit=true;else{e.x=c[0];e.y=c[1];e.vx=e.vy=0;}}};
    const n=__steps(60,()=>hit);__steps(4);__T.pin=null;__T.e=e;__T.it=it;
    const q=G.dec.car.find(q=>q.e===e);return {bi,n,q:q?{x:q.x,y:q.y,t:q.t}:null,ex:e.x,ey:e.y,epx:e.px,epy:e.py,car:carAt(it,G.t),vert:it.vert};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || D.bi !== 'urban' || !D.q) d = D.err || (D.bi !== 'urban' ? 'l’îlot 6 n’est pas urban (' + D.bi + ')' : 'aucun choc enregistré dans G.dec.car');
  else { const Lg = frame();
    let trail = 0; for (let i = 0; i + 1 < Lg.length; i++) if (Lg[i][0] === 'moveTo' && near(Lg[i][1][0], D.q.x) && near(Lg[i][1][1], D.q.y) && Lg[i + 1][0] === 'lineTo' && near(Lg[i + 1][1][0], D.ex, 15) && near(Lg[i + 1][1][1], D.ey, 15)) trail++;
    const w = D.vert ? 10 : 20, h = D.vert ? 20 : 10, body = Lg.filter(o => o[0] === 'fillRect' && near(o[1][0], D.car[0] - w / 2) && near(o[1][1], D.car[1] - h / 2) && o[1][2] === w && o[1][3] === h).length;
    ok = trail > 0 && body > 0; d = 'choc au tick ' + D.q.t + ' en (' + D.q.x.toFixed(0) + ',' + D.q.y.toFixed(0) + '), sillage impact→ennemi : ' + trail + ', carrosserie à carAt(it,RT) : ' + body; }
  check('4. choc de voiture : sillage de G.dec.car jusqu’à l’ennemi projeté, carrosserie à carAt(it,RT)', ok, d);
}

/* ---------- 5. chute ---------- */
{ let D, ok = false, d = '';
  try { D = J(`(()=>{let E=null,bi='';for(let j=0;j<6&&!E;j++){bi=__isl(4,j);E=__edge();}if(!E)return {err:'aucun bord de gouffre dégagé'};
    const d=-40,pd=40,P=G.p;__tp(E.x-E.dx*(d+pd),E.y-E.dy*(d+pd));
    const e=__foe(ETL[3],E.x-E.dx*d,E.y-E.dy*d);
    __T.pin=()=>{P.x=P.px=E.x-E.dx*(d+pd);P.y=P.py=E.y-E.dy*(d+pd);P.vx=P.vy=0;};takePU({k:'wave'});
    const n=__steps(60,()=>e.fall>0&&e.fall<=FALL_T-8);
    return {bi,n,fall:e.fall||0,inEn:G.en.includes(e),inF:G.dec.fall.includes(e),x:e.x,y:e.y};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  if (D.err || D.bi !== 'sky' || !D.inF) d = D.err || (D.bi !== 'sky' ? 'l’îlot 4 n’est pas sky (' + D.bi + ')' : 'aucune chute');
  else { const Lg = frame(); let sc = null;
    for (let i = 0; i + 1 < Lg.length; i++) if (Lg[i][0] === 'scale' && Lg[i][1][0] < 1 && Lg.slice(i, i + 3).some(o => o[0] === 'translate' && near(o[1][0], -D.x) && near(o[1][1], -D.y))) { sc = Lg[i][1][0]; break; }
    ok = sc !== null; d = 'ennemi en chute (e.fall=' + D.fall + ', dans G.en : ' + D.inEn + ') ; ' + (sc === null ? 'NON dessiné' : 'dessiné à l’échelle ' + sc.toFixed(2)); }
  call(`__T.pin=null`);
  check('5. chute : l’ennemi qui tombe reste visible, rétréci, pendant ses FALL_T ticks', ok, d);
}

/* ---------- 6. hors floral/urban/sky : rien n'est parcouru ---------- */
for (const k of [1, 8]) { let d, ok = false;
  try { const r = J(`(()=>{const bi=__isl(${k});__tp(RELR+120,0);__T.pin=()=>{G.p.x=G.p.px=RELR+120;G.p.y=G.p.py=0;};__steps(30);
      const D=G.dec,cnt={n:0,k:{}};G.dec=new Proxy(D,{get:(t,p)=>{if(p==='bite'||p==='car'||p==='fall'){cnt.n++;cnt.k[p]=1;}return t[p];}});__T.cnt=cnt;__T.D=D;return {bi};})()`);
    frame(); const n = J(`__T.cnt.n`), ks = J(`Object.keys(__T.cnt.k)`); call(`G.dec=__T.D;__T.pin=null`);
    ok = (r.bi === 'plains' || r.bi === 'core') && n === 0; d = 'îlot ' + k + ' (' + r.bi + ') : lectures de G.dec.bite/car/fall pendant render() : ' + n + (ks.length ? ' (' + ks.join(', ') + ')' : ''); }
  catch (e) { d = 'exception ' + e.message; call(`if(__T.D)G.dec=__T.D`); }
  check('6. hors floral/urban/sky : render() ne parcourt aucun événement du décor', ok, d);
}

/* ---------- 7. plafond ---------- */
{ let d, ok = false;
  try { const r = J(`(()=>{let q=null,bi='';for(let j=0;j<6&&!q;j++){bi=__isl(2,j);for(const o of __live('bloom'))if(__calm(o.x,o.y)&&!pointHit(o.x+200,o.y,30)){q=o;break;}}
      __tp(q.x+200,q.y);__T.pin=()=>{const P=G.p;P.x=P.px=q.x+200;P.y=P.py=q.y;};__steps(2);
      G.dec.bite=[];for(let k=0;k<60;k++)G.dec.bite.push({it:{},x:q.x+1+(k%10)*3,y:q.y+1+(k/10|0)*3,r:BLOOM_R,t:G.t});return {bi,x:q.x,y:q.y,N:typeof DEC_N==='number'?DEC_N:0};})()`);
    const Lg = frame(); call(`__T.pin=null;G.dec.bite=[]`);
    const n = Lg.filter(o => o[0] === 'arc' && o[1][0] >= r.x + .5 && o[1][0] <= r.x + 28.5 && o[1][1] >= r.y + .5 && o[1][1] <= r.y + 16.5 && near(o[1][2], J(`BLOOM_R`), .5)).length;
    ok = r.bi === 'floral' && r.N > 0 && n > 0 && n <= r.N; d = '60 morsures simultanées → ' + n + ' anneaux dessinés (plafond DEC_N=' + r.N + ')'; }
  catch (e) { d = 'exception ' + e.message; }
  check('7. plafond : une meute qui se fait mordre d’un coup ne multiplie pas le dessin', ok, d);
}

/* ---------- 8. gradient d'approche du Cœur (repris de test/decor-vivant.js) ---------- */
{ let d = null;
  try {
    call(`__isl(8);VL=-1e6;VR=1e6;VT=-1e6;VB=1e6;`);
    const C = J(`WD.core`), Ds = [0, 150, 400, 800, 1200, 1800, 2600, 3600, 5000, 7000], A = [];
    for (const x of Ds) { LOG = []; REC = true; try { call(`ctx=MAINCTX;drawLive({t:'node',x:${C.x + x},y:${C.y},s:1,ph:.7})`); } finally { REC = false; } A.push(LOG.filter(o => o[0] === 'drawImage').reduce((s, o) => s + o[2], 0)); }
    for (let i = 1; i < A.length && !d; i++) if (A[i] > A[i - 1] + 1e-9) d = `halo plus fort à ${Ds[i]} px qu'à ${Ds[i - 1]} px (${A[i].toFixed(3)} > ${A[i - 1].toFixed(3)})`;
    if (!d && !(A[0] > 1.5 * A[A.length - 1])) d = `intensité ${A[0] === A[A.length - 1] ? 'CONSTANTE' : 'presque constante'} : ne dépend pas de la distance au Cœur (${A[0].toFixed(3)} sur le Cœur, ${A[A.length - 1].toFixed(3)} à 7000 px)`;
    if (!d) { let prev = Infinity; for (let x = 0; x <= 14000 && !d; x += 25) { const k = call(`coreK(WD.core.x+${x * .6},WD.core.y-${x * .8})`); if (!(k < prev)) d = `coreK non strictement décroissant à ${x} px`; prev = k; } }
    check('8. gradient : le halo des veines croît à l’approche de WD.core (monotone), coreK strictement décroissant', !d, d || 'halo (somme des alpha des drawImage) : ' + A.map((a, i) => Ds[i] + ' px ' + a.toFixed(3)).join(', '));
  } catch (e) { check('8. gradient : le halo des veines croît à l’approche de WD.core (monotone), coreK strictement décroissant', false, 'exception ' + e.message); }
}

/* ---------- 9. pool de la trace (repris de test/decor-vivant.js) ---------- */
{ let d = null, n0 = 0, n1 = 0, used = 0;
  try {
    if (!call(`typeof MK!=='undefined'&&typeof markStep==='function'`)) d = 'MK / markStep absents : pas de trace du joueur';
    else { n0 = call('MK.length'); call(`__tp(0,0);G.p.x=-400;G.p.y=0;MKX=null;`);
      for (let i = 0; i < 2000; i++) call(`G.p.x+=9;G.p.y+=Math.sin(${i}*.1)*4;if(G.p.x>400)G.p.x=-400,MKX=null;G.biome=${JSON.stringify(['plains', 'sea', 'ice', 'cyber', 'core', 'sky'][i % 6])};RT++;markStep()`);
      n1 = call('MK.length'); used = call('MK.filter(m=>m.b).length');
      if (n1 !== n0) d = `pool passé de ${n0} à ${n1}`; else if (!used) d = 'aucune marque posée'; }
    call(`G.biome=ISL[G.isl-1]`);
  } catch (e) { d = 'exception ' + e.message; }
  check('9. N3 : le pool de marques du joueur ne croît pas (2000 pas de marche)', !d, d || 'pool ' + n0 + ' → ' + n1 + ', ' + used + ' marques posées');
}

console.log('\n---------------- DÉCOR : CE QUI SE VOIT ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
