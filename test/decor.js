'use strict';
/* =========================================================
   LE DÉCOR MORD : les objets du monde agissent sur les ennemis, jamais sur le joueur. Refonte en îlots : un biome
   par îlot (ISL), la scène est posée par le VRAI îlot (genIslet(G.seed,k) + islStart : G.biome = ISL[k-1]).

   node test/decor.js              les trois règles ; code de sortie 0 si tout passe, 1 sinon
   node test/decor.js --ref=HEAD   mêmes tests sur les modules d'un commit (avant la refonte : « API différente »)
   node test/decor.js --mesure     recul observé contre un gouffre, par source réelle (justifie SKY_KB, g2.js)

   1. Gueules (floral, îlot 2)     : un ennemi dans le rayon d'une `bloom` à la morsure perd des PV (≤ BLOOM_D = 30 %
                                     des PV max) ; le joueur, dans le rayon lui aussi (inBite), ne perd aucun segment.
   2. Circulation (urban, îlot 6)  : le joueur SUR la voiture 90 ticks ne perd rien et n'est pas déplacé ; un ennemi sur
                                     la trajectoire perd des PV (≤ CAR_D = 40 %) et est projeté (vitesse > 3).
   3. Vide (sky, îlot 4)           : un ennemi projeté par l'Onde (power-up `wave` ramassé, takePU : shockwave 340) contre
                                     un gouffre tombe et meurt ; le MÊME ennemi, même geste, même géométrie, sur l'îlot
                                     des plaines (îlot 1), survit. Le joueur ne perd rien.
   Retiré avec la refonte : l'hystérésis de G.biome (un seul biome par îlot, plus de frontière à franchir) ; l'Onde de
   choc de compétence (gcUse, gc.js supprimé) — remplacée par le power-up Onde, le seul geste réel qui pousse assez
   (--mesure). Le joueur n'a plus de bulles (P.bub) mais des segments de membrane (P.seg).
   Pendant une scène : ni vague ni choix de bonus (G.ph='arrive' maintenu, G.pickIsl=G.isl), aucun tir ; caméra posée
   sur le joueur et scènes courtes (< 600 ticks : pas de réapparition à vue, e.offT/e.hitT). Ennemis non-proies ({age:0}).
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref'), MESURE = !!L.ARG('mesure');
const H = L.mkGame({ ref: REF, seed: 3 }), call = H.call;
if (call(`typeof genIslet`) !== 'function') { console.log(`API différente : ${REF || 'l’arbre'} n’a pas d’îlots (genIslet absent) — rien à comparer`); console.log('ECHEC'); process.exit(1); }
H.start();

/* outils de scène, dans le realm du jeu */
call(`
var __T={pin:null,fire:false};
window.__SIM_INPUT=function(){G.inX=G.inY=0;G.ph='arrive';G.phT=0;G.pickIsl=G.isl;G.eb=[];G.marks=[];G.tele=[];if(!__T.fire){G.pb=[];G.p.fireT=1e9;}G.banner=null;if(__T.pin)__T.pin();};
/* l'îlot k de la partie (graine G.seed+j si la scène manque sur la première) ; une scène ratée (joueur mort) ne contamine pas la suivante */
function __isl(k,j){if(G.state!=='play'){G.state='play';G.p.dead=false;G.p.seg=G.p.segMax;G.timeScale=1;}if(j)G.seed=(G.seed+j)>>>0;genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();return G.biome;}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;P.dashing=0;G.freeze=0;G.cx=G.pcx=x;G.cy=G.pcy=y;for(const e of G.en)e.dead=true;G.en=[];G.dec.fall=[];}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
function __foe(t,x,y){const e=mkEnemy(t,x,y,{spawn:0,age:0});e.cd=1e9;e.hp=e.mhp=100;return e;}
/* hors de la relique (centre) et de la membrane (bord) */
function __calm(x,y){const r=Math.hypot(x,y);return r>RELR+60&&r<PR-80;}
function __live(t){const L=[];for(let cx=-COFF;cx<COFF;cx++)for(let cy=-COFF;cy<COFF;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.live)if(q.t===t)L.push(q);}return L;}
/* le long d'une ligne de cellules : falaise (et ses deux voisines), puis 6 cellules libres ; (dx,dy) = vers le gouffre */
function __edge(){for(let j=2;j<NG-2;j++)for(let i=2;i<NG-2;i++){if(!wallAt(i,j))continue;const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=wallAt(i-dy,j+dx)&&wallAt(i+dy,j-dx);for(let k=1;k<=6&&ok;k++)for(let s=-1;s<=1;s++)if(wallAt(i-dx*k+s*dy,j-dy*k+s*dx))ok=false;
    if(!ok)continue;const ex=x-dx*WC*1.5,ey=y-dy*WC*1.5;
    if(!__calm(ex,ey)||!__calm(x-dx*WC*5,y-dy*WC*5)||pointHit(ex,ey,40)||pointHit(x-dx*WC*4,y-dy*WC*4,30))continue;return {x:ex,y:ey,dx,dy,wx:x-dx*WC*.5,wy:y-dy*WC*.5};}}return null;}
`);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));

if (MESURE) {
  /* SEUIL DU VIDE — recul observé = |v| - sp (vitesse au-delà de l'allure propre) au moment où l'ennemi touche un
     gouffre, règle neutralisée (skyFalls journalise et renvoie false). Géométrie : ennemi à 1,5 case du bord (64 px du gouffre). */
  call(`__isl(4);var __L=[];skyFalls=function(e,sp,oh){if(wallNear(e.x,e.y,e.r+2))__L.push(Math.hypot(e.vx,e.vy)-sp);return false;};`);
  const E = J(`__edge()`); if (!E) { console.log('aucun bord de gouffre trouvé'); process.exit(1); }
  const T = J(`ETL[G.isl-1]`);
  const src = {
    'marche seule (poursuite, 900 ticks, 4 types)': `for(const t of ['mite','spike','sniper','orbit']){__tp(E.x-E.dx*300,E.y-E.dy*300);
        const e=__foe(t,E.x,E.y);__T.pin=()=>{G.p.x=G.p.px=E.wx+E.dx*40;G.p.y=G.p.py=E.wy+E.dy*40;G.p.inv=1e9;e.cd=1e9;};__steps(900);__T.pin=null;}`,
    'tir de base (auto-tir réel, 300 ticks)': `for(const d of [60,120,200]){__tp(E.x-E.dx*d-E.dy*7,E.y-E.dy*d+E.dx*7);const e=__foe(T,E.x,E.y);e.hp=e.mhp=1e9;
        __T.fire=true;G.p.fireT=0;__T.pin=()=>{G.p.x=G.p.px=E.x-E.dx*d-E.dy*7;G.p.y=G.p.py=E.y-E.dy*d+E.dx*7;G.p.inv=1e9;};__steps(300);__T.fire=false;__T.pin=null;}`,
    'explosion de missile (explode, recul 3)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*300,E.y-E.dy*300);const e=__foe(T,E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;explode({x:e.x-E.dx*20-E.dy*3,y:e.y-E.dy*20+E.dx*3,dmg:0,boom:60});__steps(60);}`,
    'ruée (dash réel, Éperon dashDmg=4)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);const e=__foe(T,E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;G.p.dashDmg=4;G.p.dashT=0;
        const f=window.__SIM_INPUT;window.__SIM_INPUT=function(){f();G.inX=E.dx-E.dy*.05;G.inY=E.dy+E.dx*.05;};G.inX=E.dx-E.dy*.05;G.inY=E.dy+E.dx*.05;tryDash();__steps(60);window.__SIM_INPUT=f;G.p.dashDmg=0;}`,
    'Onde (power-up wave, takePU, joueur à 40 px)': `for(const d of [-40,-20,0,40,90]){__tp(E.x-E.dx*(d+40)-E.dy*7,E.y-E.dy*(d+40)+E.dx*7);const e=__foe(T,E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;takePU({k:'wave'});__steps(60);}`,
    'éclatement du gonflement (gonBurst)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+60)-E.dy*7,E.y-E.dy*(d+60)+E.dx*7);const e=__foe(T,E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;gonBurst();__steps(60);}`,
    'Riposte (shockwave 230, coup reçu)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+40)-E.dy*7,E.y-E.dy*(d+40)+E.dx*7);const e=__foe(T,E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;shockwave(G.p.x,G.p.y,230,G.p.dmg*6,true);__steps(60);}`,
  };
  console.log('îlot ' + J('G.isl') + ' (' + J('G.biome') + '), type ' + T + ', bord de gouffre : ' + JSON.stringify(E) + ' ; SKY_KB=' + J('SKY_KB'));
  for (const k in src) { call(`__L=[];(function(){const E=${JSON.stringify(E)},T=${JSON.stringify(T)};${src[k]}})()`); const Lg = J('__L');
    console.log('  ' + k.padEnd(48) + ' contacts=' + String(Lg.length).padStart(4) + '  recul max=' + (Lg.length ? Math.max(...Lg).toFixed(2) : '—')); }
  process.exit(0);
}

/* ---------- 1. gueules du Jardin carnivore (îlot 2) ---------- */
{ let D;
  try { D = J(`(()=>{let it=null,bi='';for(let j=0;j<6&&!it;j++){bi=__isl(2,j);
      for(const q of __live('bloom'))if(__calm(q.x,q.y)&&!wallNear(q.x,q.y,120)&&!pointHit(q.x+30,q.y,G.p.r+2)&&!pointHit(q.x-20,q.y,20)){it=q;break;}}
    if(!it)return {err:'aucune bloom dégagée sur l’îlot floral'};
    __tp(it.x+30,it.y);
    const e=__foe(ETL[1],it.x-20,it.y),P=G.p,s0=P.seg,h0=e.hp;let inB=0,n0=0;
    __T.pin=()=>{e.x=it.x-20;e.y=it.y;e.vx=e.vy=0;e.cd=1e9;P.x=P.px=it.x+30;P.y=P.py=it.y;P.vx=P.vy=0;P.inv=0;n0++;if(inBite(it,P.x,P.y,P.r))inB++;};
    let n=__steps(250,()=>e.dead||e.hp<h0);__T.pin=null;
    return {bi,n,hp0:h0,hp:+e.hp.toFixed(2),mhp:e.mhp,s0,s:P.seg,inB,n0,dist:Math.round(Math.hypot(P.x-it.x,P.y-it.y))};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  const ok = !D.err && D.bi === 'floral' && D.inB === D.n0 && D.hp < D.hp0 && D.hp0 - D.hp <= .3 * D.mhp + 1e-9 && D.s === D.s0;
  const why = D.err ? D.err : D.bi !== 'floral' ? 'l’îlot 2 n’est pas floral (' + D.bi + ')' : D.inB !== D.n0 ? 'mesure invalide : le joueur n’est pas resté dans le rayon de la gueule'
    : D.hp >= D.hp0 ? 'aucune morsure : l’ennemi dans le rayon n’a perdu aucun PV en ' + D.n + ' ticks (≥ un cycle de 4 s)'
    : D.hp0 - D.hp > .3 * D.mhp ? 'dégâts au-delà de 30 % des PV max' : D.s !== D.s0 ? 'le joueur a perdu des segments (' + D.s0 + '→' + D.s + ')' : 'ok';
  check('gueules : un ennemi dans le rayon à la morsure perd des PV (≤ 30 % PV max), le joueur dans le rayon ne perd rien', ok,
    why + (D.err ? '' : ' — PV ' + D.hp0 + '→' + D.hp + ' en ' + D.n + ' ticks, segments joueur ' + D.s0 + '→' + D.s + ', joueur à ' + D.dist + ' px de la gueule (dans le rayon ' + D.inB + '/' + D.n0 + ' ticks)'));
}

/* ---------- 2. circulation de la Mégapole (îlot 6) ---------- */
{ let D;
  try { D = J(`(()=>{let it=null,bi='';const lane=q=>{for(let f=0;f<=1;f+=.125){const x=q.vert?q.x:q.x+f*CH,y=q.vert?q.y+f*CH:q.y;if(!__calm(x,y)||pointHit(x,y,30)||wallNear(x,y,30))return false;}return true;};
    for(let j=0;j<6&&!it;j++){bi=__isl(6,j);for(const q of __live('car'))if(lane(q)){it=q;break;}}
    if(!it)return {err:'aucune voiture sur une chaussée dégagée de la Mégapole'};
    const P=G.p;let c0=carAt(it,G.t);__tp(c0[0],c0[1]);
    /* A. le joueur sur la voiture 90 ticks, seul : aucune perte, aucun déplacement imposé (épinglé à la voiture => écart 0) */
    const s0=P.seg;let pd=0,lx=null,ly=null,on=0;__T.pin=()=>{if(lx!==null)pd=Math.max(pd,Math.round(Math.hypot(P.x-lx,P.y-ly)));const c=carAt(it,G.t);P.x=P.px=lx=c[0];P.y=P.py=ly=c[1];P.vx=P.vy=0;P.inv=0;if(carHits(it,G.t,P.x,P.y,P.r))on++;};
    __steps(90);const sA=P.seg;
    /* B. le joueur à l'écart de la chaussée (140 px), l'ennemi posé sur la voiture jusqu'au choc, puis laissé libre */
    const ox=it.vert?140:0,oy=it.vert?0:140;let c=carAt(it,G.t+1);const e=__foe(ETL[5],c[0],c[1]),h0=e.hp;let hit=false;
    __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;P.inv=1e9;if(!hit&&!e.dead){if(e.hp<h0){hit=true;}else{e.x=c[0];e.y=c[1];e.vx=e.vy=0;}}};
    let n=__steps(60,()=>hit);const sp=Math.hypot(e.vx,e.vy);
    __steps(30);__T.pin=null;
    return {bi,n,hp0:h0,hp:+e.hp.toFixed(2),mhp:e.mhp,dead:e.dead,sp:+sp.toFixed(2),s0,sA,s:P.seg,pd,on};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  const ok = !D.err && D.bi === 'urban' && D.on === 90 && D.hp < D.hp0 && D.hp0 - D.hp <= .4 * D.mhp + 1e-9 && D.sp > 3 && D.sA === D.s0 && D.s === D.s0 && D.pd === 0;
  const why = D.err ? D.err : D.bi !== 'urban' ? 'l’îlot 6 n’est pas urban (' + D.bi + ')' : D.sA !== D.s0 ? 'le joueur sur la voiture a perdu des segments (' + D.s0 + '→' + D.sA + ')'
    : D.pd ? 'le joueur a été déplacé par la voiture (' + D.pd + ' px)' : D.on !== 90 ? 'mesure invalide : le joueur n’est resté sur la voiture que ' + D.on + '/90 ticks'
    : D.hp >= D.hp0 ? 'aucun choc : l’ennemi sur la trajectoire n’a perdu aucun PV en 60 ticks sous la voiture'
    : D.hp0 - D.hp > .4 * D.mhp ? 'dégâts au-delà de 40 % des PV max' : D.sp <= 3 ? 'ennemi non projeté (vitesse ' + D.sp + ')' : D.s !== D.s0 ? 'le joueur a perdu des segments' : 'ok';
  check('circulation : un ennemi sur la trajectoire d’une voiture perd des PV (≤ 40 %) et est projeté, le joueur sur la même trajectoire ne perd rien et n’est pas déplacé', ok,
    why + (D.err ? '' : ' — joueur sur la voiture ' + D.on + '/90 ticks, segments ' + D.s0 + '→' + D.sA + ', écart imposé ' + D.pd + ' px ; ennemi : PV ' + D.hp0 + '→' + D.hp + ' au tick ' + D.n + ', vitesse après choc ' + D.sp));
}

/* ---------- 3. vide de l'Archipel céleste (îlot 4) ; témoin : l'îlot des plaines (îlot 1) ----------
   Géométrie : l'ennemi (type de l'îlot 4, ETL[3]) à 8 px du gouffre, le joueur 40 px derrière lui ; geste : l'Onde (takePU wave).
   C'est le seul geste réel assez fort (--mesure) : il ne fait tomber qu'un ennemi déjà au ras du vide. */
const fall = k => { try { return J(`(()=>{let E=null,bi='';for(let j=0;j<6&&!E;j++){bi=__isl(${k},j);E=__edge();}if(!E)return {err:'aucun bord de falaise dégagé sur l’îlot ${k}'};
    const d=-40,pd=40,P=G.p;__tp(E.x-E.dx*(d+pd),E.y-E.dy*(d+pd));
    const e=__foe(ETL[3],E.x-E.dx*d,E.y-E.dy*d),s0=P.seg;
    __T.pin=()=>{P.x=P.px=E.x-E.dx*(d+pd);P.y=P.py=E.y-E.dy*(d+pd);P.vx=P.vy=0;P.inv=0;};takePU({k:'wave'});
    const n=__steps(90,()=>e.dead);__T.pin=null;
    return {bi,dead:e.dead,fell:G.dec.fall.includes(e)||e.fall!==undefined,hp:+e.hp.toFixed(2),hp0:e.mhp,n,s0,s:P.seg,dmg:+(e.mhp-e.hp).toFixed(2)};})()`); } catch (e) { return { err: 'exception ' + e.message }; } };
{ const S = fall(4), Pl = fall(1);
  const ok = !S.err && !Pl.err && S.bi === 'sky' && Pl.bi === 'plains' && S.dead && S.fell && !Pl.dead && S.s === S.s0 && Pl.s === Pl.s0;
  const why = S.err || Pl.err || (S.bi !== 'sky' ? 'l’îlot 4 n’est pas sky (' + S.bi + ')' : Pl.bi !== 'plains' ? 'l’îlot 1 n’est pas plains (' + Pl.bi + ')'
    : !S.dead || !S.fell ? 'l’ennemi projeté contre le gouffre n’est pas tombé (vivant=' + !S.dead + ', chute=' + S.fell + ', ' + S.hp + '/' + S.hp0 + ' PV, 90 ticks)'
    : Pl.dead ? 'le même ennemi en plaines est mort : la règle ne dépend pas de l’îlot' : S.s !== S.s0 || Pl.s !== Pl.s0 ? 'le joueur a perdu des segments' : 'ok');
  check('vide : un ennemi projeté (Onde) contre un gouffre tombe et meurt ; le même, même geste, en plaines, survit', ok,
    why + (S.err || Pl.err ? '' : ' — sky : mort=' + S.dead + ' au tick ' + S.n + ' (dégâts de l’onde ' + S.dmg + '/' + S.hp0 + ') ; plaines : mort=' + Pl.dead + ', ' + Pl.hp + '/' + Pl.hp0 + ' PV'));
}

console.log('\n---------------- DÉCOR ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
