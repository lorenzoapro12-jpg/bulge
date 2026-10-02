'use strict';
/* =========================================================
   LE TERRAIN AGIT : courant (sea), glissade (ice), balayage (cyber), relais (core). Refonte en îlots : un biome par
   îlot, la scène est posée par le VRAI îlot (genIslet(G.seed,k) + islStart : G.biome = ISL[k-1]), jamais forcée.

   node test/terrain.js              les quatre règles ; code de sortie 0 si tout passe, 1 sinon
   node test/terrain.js --ref=HEAD   mêmes tests sur les modules d'un commit (avant la refonte : « API différente »)

   1. Courant  (îlot 3) : 120 ticks d'intention dans le sens de G.courant => distance ≥ 1,2× le témoin (îlot 1, plaines) ;
                          à contre-courant => EXACTEMENT le témoin (le courant porte, il ne freine jamais).
   2. Glissade (îlot 7) : dash sur la glace ≥ 1,3× le dash en plaines ; déplacement normal identique ; aucune immunité
                          en plus (ticks où P.inv>0 ou P.dashing>0, c.-à-d. où hurtPlayer est sans effet) ; sillage de
                          givre (G.dec.givre) sur la glace seulement.
   3. Balayage (îlot 5) : joueur dans la bande, loin d'une falaise => alarme (G.dec.vuT, ennemi à 800 px : alarmT, et
                          vitesse ×SW_SP face à un témoin hors de SW_R) ; collé à une falaise (< 40 px, sous SW_ABRI) => rien.
   4. Relais   (îlot 8) : dégâts ×0,45 dans le rayon d'un nœud (60 et 100 px), ×1 hors du rayon (120 et 400 px) ;
                          la liste exposée G.dec.relais nomme les protégés, et eux seuls.
   Retiré avec la refonte : le vent-boussole des plaines (G.vent vers le prochain nœud de WD.mainPath) — plus de
   chemin ni d'objectif à rejoindre dans un îlot, G.vent n'existe plus ; l'hystérésis de G.biome (un biome par îlot) ;
   l'« aggro » des ennemis (ils chassent tous) : l'alarme se lit sur alarmT et la vitesse.
   Pendant une scène : ni vague ni choix de bonus (G.ph='arrive' maintenu, G.pickIsl=G.isl), aucun tir ; caméra posée
   sur le joueur et scènes de moins de 600 ticks après la pose d'un ennemi (pas de réapparition à vue, e.offT/e.hitT).
   02/10/2026 : la glissade ÉCHOUE sur l'immunité — régression du JEU, pas du test. Depuis 496448f, tryDash (g2.js) fait
   P.inv=Math.max(P.inv,P.dashing+4) : 20 ticks d'immunité sur la glace (dash de ICE_DASH=16) contre 16 en plaines.
   Avant : P.inv=Math.max(P.inv,18) pour tous (18/18). Une immunité constante (ex. 16) rend les 4 règles vertes.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
const H = L.mkGame({ ref: REF, seed: 3 }), call = H.call;
if (call(`typeof genIslet`) !== 'function') { console.log(`API différente : ${REF || 'l’arbre'} n’a pas d’îlots (genIslet absent) — rien à comparer`); console.log('ECHEC'); process.exit(1); }
H.start();

/* outils de scène, dans le realm du jeu */
call(`
var __T={pin:null};
window.__SIM_INPUT=function(){G.inX=G.inY=0;G.ph='arrive';G.phT=0;G.pickIsl=G.isl;G.eb=[];G.marks=[];G.tele=[];G.pb=[];G.p.fireT=1e9;G.banner=null;if(__T.pin)__T.pin();};
function __isl(k,j){if(G.state!=='play'){G.state='play';G.p.dead=false;G.p.seg=G.p.segMax;G.timeScale=1;}if(j)G.seed=(G.seed+j)>>>0;genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();return G.biome;}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;P.dashing=0;G.freeze=0;G.cx=G.pcx=x;G.cy=G.pcy=y;for(const e of G.en)e.dead=true;G.en=[];G.dec.fall=[];}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
function __foe(t,x,y){const e=mkEnemy(t,x,y,{spawn:0,age:0});e.cd=1e9;e.hp=e.mhp=100;return e;}
function __in(x,y,m){return Math.hypot(x,y)<PR-(m||60);}
function __open(x,y,r){return __in(x,y)&&!pointHit(x,y,r)&&!wallNear(x,y,r);}
/* segment libre de (x,y) sur L px dans le sens u */
function __free(x,y,ux,uy,L){for(let d=0;d<=L;d+=8)if(!__open(x+ux*d,y+uy*d,30))return false;return true;}
function __find(ux,uy,L){for(let r=0;r<=PR;r+=40)for(let a=0;a<TAU;a+=.25){const x=Math.cos(a)*r,y=Math.sin(a)*r;if(__free(x,y,ux,uy,L))return {x,y};}return null;}
/* n ticks d'intention u depuis (x,y) : somme des vitesses projetées sur u, et déplacement réel projeté */
function __walk(x,y,ux,uy,n){__tp(x,y);const P=G.p;let vs=0;__T.pin=()=>{G.inX=ux;G.inY=uy;};
  for(let i=0;i<n;i++){step();vs+=P.vx*ux+P.vy*uy;}__T.pin=null;return {vs,dp:(P.x-x)*ux+(P.y-y)*uy};}
`);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));
const run = src => { try { return J(`(()=>{${src}})()`); } catch (e) { return { err: 'exception ' + e.message }; } };
const f = (x, n = 2) => (typeof x === 'number' ? x.toFixed(n) : String(x));

/* ---------- 1. courant porteur du Récif (îlot 3) ---------- */
{ const D = run(`const L=Math.ceil(G.p.spd*1.3*120)+40;let a=null,b=null,bi='',C=null;
    for(let j=0;j<6&&!(a&&b);j++){bi=__isl(3,j);C=G.courant;if(!C)break;a=__find(C.x,C.y,L);b=__find(-C.x,-C.y,L);}
    if(!C)return {err:'aucun courant exposé sur l’îlot du Récif (G.courant absent)',bi};if(!a||!b)return {err:'aucun segment libre de '+L+' px dans l’axe du courant'};
    const u=[C.x,C.y],A=__walk(a.x,a.y,u[0],u[1],120),B=__walk(b.x,b.y,-u[0],-u[1],120);
    let w=null,v=null,b1='';for(let j=0;j<6&&!(w&&v);j++){b1=__isl(1,j);w=__find(u[0],u[1],L);v=__find(-u[0],-u[1],L);}
    if(!w||!v)return {err:'aucun segment libre en plaines'};
    const T=__walk(w.x,w.y,u[0],u[1],120),T2=__walk(v.x,v.y,-u[0],-u[1],120);
    return {bi,b1,u,A,B,T,T2,spd:G.p.spd};`);
  const ok = !D.err && D.bi === 'sea' && D.b1 === 'plains' && D.A.vs >= 1.2 * D.T.vs && D.B.vs === D.T2.vs && Math.abs(D.A.dp - D.A.vs) < 1e-6 && Math.abs(D.B.dp - D.B.vs) < 1e-6;
  const why = D.err ? D.err : D.bi !== 'sea' ? 'l’îlot 3 n’est pas sea (' + D.bi + ')' : D.b1 !== 'plains' ? 'l’îlot 1 n’est pas plains (' + D.b1 + ')'
    : Math.abs(D.A.dp - D.A.vs) > 1e-6 || Math.abs(D.B.dp - D.B.vs) > 1e-6 ? 'collision sur le trajet : mesure invalide'
    : D.A.vs < 1.2 * D.T.vs ? 'aucun courant porteur : dans le sens du courant ' + f(D.A.vs / D.T.vs, 3) + '× le témoin (attendu ≥ 1,2)'
    : D.B.vs !== D.T2.vs ? 'le courant freine : à contre-courant ' + D.B.vs + ' px contre ' + D.T2.vs + ' en plaines' : 'ok';
  check('courant : 120 ticks dans le sens du courant ≥ 1,2× le témoin en plaines ; à contre-courant, exactement le témoin', ok,
    why + (D.err ? '' : ' — G.courant=(' + f(D.u[0], 3) + ',' + f(D.u[1], 3) + ') ; sens : ' + f(D.A.vs, 3) + ' px contre ' + f(D.T.vs, 3) + ' (×' + f(D.A.vs / D.T.vs, 4) + ') ; contre : ' + f(D.B.vs, 6) + ' contre ' + f(D.T2.vs, 6) + (D.B.vs === D.T2.vs ? ' (===)' : ' (≠)')));
}

/* ---------- 2. glissade du Glacier (îlot 7) ---------- */
{ const D = run(`const L=Math.max(Math.ceil(G.p.spd*3.6*17),Math.ceil(G.p.spd*120))+40;
    const dash=(x,y)=>{__tp(x,y);const P=G.p;P.dashT=0;P.inv=0;__T.pin=()=>{G.inX=0;G.inY=0;};G.inX=G.inY=0;P.ang=0;
      const g0=G.dec.givre.length,t0=G.t;tryDash();const dur=P.dashing;let n=0,imm=0;
      while(P.dashing>0&&n<40){if(P.inv>0||P.dashing>0)imm++;step();n++;}const d=P.x-x;
      for(let i=0;i<40;i++){if(P.inv>0||P.dashing>0)imm++;step();}
      const tail=P.x-x;__T.pin=null;
      return {dur,n,d,tail,imm,givre:G.dec.givre.filter(g=>g.t>t0).length,glisseT:G.dec.glisseT,t0};};
    let q=null,bi='';for(let j=0;j<6&&!q;j++){bi=__isl(7,j);q=__find(1,0,L);}if(!q)return {err:'aucun segment libre sur la glace'};
    const I=dash(q.x,q.y),Iw=__walk(q.x,q.y,1,0,120);
    let w=null,b1='';for(let j=0;j<6&&!w;j++){b1=__isl(1,j);w=__find(1,0,L);}if(!w)return {err:'aucun segment libre en plaines'};
    const Pl=dash(w.x,w.y),Pw=__walk(w.x,w.y,1,0,120);
    return {bi,b1,I,Pl,Iw,Pw};`);
  const ok = !D.err && D.bi === 'ice' && D.b1 === 'plains' && D.I.d >= 1.3 * D.Pl.d && D.Iw.vs === D.Pw.vs && D.I.imm === D.Pl.imm && D.I.givre > 0 && D.Pl.givre === 0;
  const why = D.err ? D.err : D.bi !== 'ice' ? 'l’îlot 7 n’est pas ice (' + D.bi + ')' : D.b1 !== 'plains' ? 'l’îlot 1 n’est pas plains (' + D.b1 + ')'
    : D.I.d < 1.3 * D.Pl.d ? 'pas de glissade : dash sur la glace ' + f(D.I.d / D.Pl.d, 3) + '× le dash en plaines (' + D.I.dur + ' ticks contre ' + D.Pl.dur + ', attendu ≥ 1,3×)'
    : D.Iw.vs !== D.Pw.vs ? 'le déplacement normal change sur la glace (' + D.Iw.vs + ' contre ' + D.Pw.vs + ')'
    : D.I.imm !== D.Pl.imm ? 'immunité allongée : ' + D.I.imm + ' ticks sur la glace contre ' + D.Pl.imm + ' en plaines (tryDash, g2.js : P.inv=Math.max(P.inv,P.dashing+4) suit la durée du dash glissé)'
    : !(D.I.givre > 0) ? 'aucun sillage de givre exposé (G.dec.givre)' : D.Pl.givre ? 'du givre en plaines' : 'ok';
  check('glissade : dash sur la glace ≥ 1,3× celui des plaines, déplacement normal identique, pas d’immunité en plus, sillage de givre', ok,
    why + (D.err ? '' : ' — dash glace ' + D.I.dur + ' ticks / ' + f(D.I.d) + ' px (avec l’erre : ' + f(D.I.tail) + '), plaines ' + D.Pl.dur + ' ticks / ' + f(D.Pl.d) + ' px (' + f(D.Pl.tail) + ') => ×' + f(D.I.d / D.Pl.d, 3)
      + ' (erre comprise ×' + f(D.I.tail / D.Pl.tail, 3) + ') ; marche 120 ticks ' + f(D.Iw.vs, 6) + ' contre ' + f(D.Pw.vs, 6) + ' ; immunité ' + D.I.imm + ' contre ' + D.Pl.imm + ' ticks ; givre ' + D.I.givre + ' points'));
}

/* ---------- 3. balayage de la Grille néon (îlot 5) ---------- */
{ const D = run(`const P=G.p;let bi='';
    for(let j=0;j<6;j++){bi=__isl(5,j);__tp(0,0);__steps(13);
      const W=G.dec.sw;if(!W)return {err:'aucun balayage exposé en Grille néon (G.dec.sw absent) : la bande n’existe pas',bi};
      const reach=(x,y)=>Math.abs((x-W.x)*W.dx+(y-W.y)*W.dy)<900;
      let A=null,B=null;
      for(let r=0;r<=PR&&!(A&&B);r+=40)for(let a=0;a<TAU&&!(A&&B);a+=.2){const x=Math.cos(a)*r,y=Math.sin(a)*r;if(!__in(x,y,100)||!reach(x,y))continue;
        if(!A&&__open(x,y,160)){let ex=null,cx=null;for(let b=0;b<TAU&&!ex;b+=.2){const qx=x+Math.cos(b)*800,qy=y+Math.sin(b)*800;if(__open(qx,qy,30))ex=[qx,qy];}
          for(let b=0;b<TAU&&!cx;b+=.1)for(const R of [1100,1250,1400]){const qx=x+Math.cos(b)*R,qy=y+Math.sin(b)*R;if(__open(qx,qy,30)){cx=[qx,qy];break;}}
          if(ex&&cx)A={x,y,ex:ex[0],ey:ex[1],cx:cx[0],cy:cx[1]};}
        if(!B&&wallNear(x,y,40)&&!wallNear(x,y,24)&&!pointHit(x,y,24)){for(let b=0;b<TAU;b+=.2){const qx=x+Math.cos(b)*800,qy=y+Math.sin(b)*800;if(__open(qx,qy,30)){B={x,y,ex:qx,ey:qy};break;}}}}
      if(!A||!B)continue;
      const scene=(Q,ctrl)=>{__tp(Q.x,Q.y);__steps(13);
        __T.pin=()=>{P.x=P.px=Q.x;P.y=P.py=Q.y;P.vx=P.vy=0;P.inv=1e9;};const v0=G.dec.vuT,T=Math.ceil(SW_L/SW_V)+20;
        /* on attend la bande (au plus une période), PUIS on pose l'ennemi à 800 px et un témoin au-delà de SW_R */
        let n=__steps(T,()=>swIn(Q.x,Q.y)),inBand=swIn(Q.x,Q.y),seen=false,alarm=false;const e=__foe('mite',Q.ex,Q.ey),c=ctrl?__foe('mite',Q.cx,Q.cy):null;
        let k2=0;for(;k2<12&&swIn(Q.x,Q.y);k2++){step();if(vu(P))seen=true;if(G.dec.vuT!==v0)alarm=true;}
        const at=e.alarmT>G.t,cat=c?c.alarmT>G.t:null,d0=Math.round(Math.hypot(e.x-Q.x,e.y-Q.y)),dc=c?Math.round(Math.hypot(c.x-Q.x,c.y-Q.y)):null;let ratio=null;
        if(c){const R=[];for(let i=0;i<90;i++){step();if(i>=30)R.push(Math.hypot(e.vx,e.vy)/Math.hypot(c.vx,c.vy));}R.sort((a,b)=>a-b);ratio=R[R.length>>1];/* médiane : un obstacle croisé fausse un relevé isolé */}__T.pin=null;
        return {n,inBand,seen,alarm,at,cat,d0,dc,ratio,wall:wallNear(Q.x,Q.y,40)};};
      return {bi,W:[W.x,W.y,W.dx,W.dy],A:scene(A,true),B:scene(B,false),Ap:[A.x,A.y],Bp:[B.x,B.y]};}
    return {err:'aucun îlot cyber avec un point dégagé ET un point collé à une falaise, tous deux à portée de la bande',bi};`);
  const ok = !D.err && D.bi === 'cyber' && D.A.inBand && D.A.seen && D.A.alarm && D.A.at && D.A.cat === false && D.A.ratio > 1.2 && D.B.inBand && D.B.wall && !D.B.seen && !D.B.alarm && !D.B.at;
  const why = D.err ? D.err : D.bi !== 'cyber' ? 'l’îlot 5 n’est pas cyber (' + D.bi + ')' : !D.A.inBand ? 'la bande n’a jamais atteint le point dégagé' : !D.A.seen || !D.A.alarm ? 'joueur dans la bande, loin d’une falaise : pas d’alarme'
    : !D.A.at ? 'l’ennemi à ' + D.A.d0 + ' px n’est pas alarmé' : D.A.cat !== false ? 'mesure invalide : le témoin à ' + D.A.dc + ' px (hors SW_R) est alarmé' : !(D.A.ratio > 1.2) ? 'l’ennemi alarmé n’accélère pas (×' + f(D.A.ratio, 3) + ')'
    : !D.B.inBand ? 'la bande n’a jamais atteint le point abrité' : !D.B.wall ? 'mesure invalide : le point abrité n’est pas à moins de 40 px d’une falaise'
    : D.B.seen || D.B.alarm ? 'collé à une falaise, le joueur est quand même vu' : D.B.at ? 'l’ennemi s’est alarmé alors que le joueur était abrité' : 'ok';
  check('balayage : dans la bande et loin d’une falaise => alarme (ennemi à ~800 px alarmé, accéléré) ; collé à une falaise => rien', ok,
    why + (D.err ? '' : ' — dégagé : bande au tick ' + D.A.n + ', vu=' + D.A.seen + ', ennemi à ' + D.A.d0 + ' px alarmé=' + D.A.at + ', vitesse ×' + f(D.A.ratio, 3) + ' vs témoin à ' + D.A.dc + ' px non alarmé'
      + ' ; abrité (falaise à < 40 px : ' + D.B.wall + ') : bande au tick ' + D.B.n + ', dans la bande=' + D.B.inBand + ', vu=' + D.B.seen + ', ennemi alarmé=' + D.B.at));
}

/* ---------- 4. relais du Cœur (îlot 8) ---------- */
{ const D = run(`let it=null,bi='';
    for(let j=0;j<6&&!it;j++){bi=__isl(8,j);const nodes=[];for(let cx=-COFF;cx<COFF;cx++)for(let cy=-COFF;cy<COFF;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.live)if(q.t==='node')nodes.push(q);}
      const far=(x,y,q)=>nodes.every(n=>n===q||Math.hypot(n.x-x,n.y-y)>160);
      for(const q of nodes)if([60,100,120,250,400].every(dx=>__in(q.x+dx,q.y)&&!pointHit(q.x+dx,q.y,24))&&far(q.x+120,q.y,q)&&far(q.x+400,q.y,q)&&far(q.x+60,q.y,q)){it=q;break;}}
    if(!it)return {err:'aucun nœud dégagé sur l’îlot du Cœur',bi};
    __tp(it.x+250,it.y);G.p.crit=0;
    const hit=(dx)=>{const e=__foe('mite',it.x+dx,it.y);e.hp=e.mhp=1000;const h=e.hp;hurtEnemy(e,10,0,0,true);return {e,d:h-e.hp};};
    const a=hit(100),b=hit(120),c=hit(400),z=hit(60);
    for(const q of [a,b,c,z])q.e.hp=q.e.mhp=1e6;
    __T.pin=()=>{for(const q of [a,b,c,z]){q.e.x=it.x+(q===a?100:q===b?120:q===c?400:60);q.e.y=it.y;q.e.vx=q.e.vy=0;}G.p.inv=1e9;};__steps(1);__T.pin=null;
    const Lr=G.dec.relais,E=Array.isArray(Lr)?Lr.find(r=>r.it===it):null;
    return {bi,m100:a.d/c.d,m120:b.d/c.d,m60:z.d/c.d,d400:c.d,list:!!Lr,listed:E?[E.pro.includes(a.e),E.pro.includes(z.e),E.pro.includes(b.e),E.pro.includes(c.e)]:null,
      other:Array.isArray(Lr)&&Lr.some(r=>r.pro.includes(c.e)||r.pro.includes(b.e))};`);
  const near = x => Math.abs(x - .45) < 1e-9, one = x => Math.abs(x - 1) < 1e-9;
  const ok = !D.err && D.bi === 'core' && near(D.m100) && near(D.m60) && one(D.m120) && D.listed && D.listed[0] && D.listed[1] && !D.listed[2] && !D.listed[3] && !D.other;
  const why = D.err ? D.err : D.bi !== 'core' ? 'l’îlot 8 n’est pas core (' + D.bi + ')' : !near(D.m100) || !near(D.m60) ? 'aucune protection : dans le rayon le multiplicateur vaut ' + f(D.m60, 3) + ' (60 px) / ' + f(D.m100, 3) + ' (100 px), attendu 0,45'
    : !one(D.m120) ? 'hors du rayon (120 px) le multiplicateur vaut ' + f(D.m120, 3) : !D.list ? 'aucune liste de protégés exposée (G.dec.relais)'
    : !D.listed || !D.listed[0] || !D.listed[1] ? 'le protégé manque dans G.dec.relais' : D.listed[2] || D.listed[3] || D.other ? 'un ennemi hors du rayon est listé' : 'ok';
  check('relais : dégâts ×0,45 à 60 et 100 px d’un nœud, ×1 à 120 et 400 px ; la liste exposée nomme les protégés', ok,
    why + (D.err ? '' : ' — multiplicateur mesuré (dégâts / dégâts à 400 px) : 60 px ×' + f(D.m60, 4) + ', 100 px ×' + f(D.m100, 4) + ', 120 px ×' + f(D.m120, 4) + ' ; liste ' + JSON.stringify(D.listed)));
}

console.log('\n---------------- TERRAIN ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
