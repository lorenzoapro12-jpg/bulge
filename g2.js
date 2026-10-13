/* =========================================================
   LOGIQUE DE JEU : un îlot = une arène = un niveau
   Arrivée (choix d'un bonus) → 3 vagues → boss → îlot nettoyé → croissance → îlot suivant.
   Chaque îlot vit dans SON repère (gw.js) : la bulle y a toujours le rayon PRAD ; ce qui grandit,
   c'est l'écart avec les anciens ennemis, qui rapetissent d'îlot en îlot (mkEnemy).
   ========================================================= */
let G=null;
/* PRAD : rayon de la bulle ; SEG0 : segments de membrane au départ ; GROW : croissance par îlot (taille), GROWD (puissance :
   les dégâts de la bulle suivent la vie des ennemis, HPM, pour que les bonus restent un vrai gain) ;
   PREYA : écart d'îlots à partir duquel un type devient proie ; GONEA : écart où il quitte le jeu ;
   SPN : pas d'éclosion d'un ennemi, une fois sa marque au sol passée (24 avant le 08/10/2026) ;
   FODA : vie du type de l'îlot d'avant (âge 1, encore hostile) : tu l'as dépassé, il devient de la chair à canon (COURBE, 08/10/2026 :
   avant, il demandait ~10 % de tirs EN PLUS qu'à ses débuts) */
/* DIFFICULTÉ, réglée par la passe d'équilibrage de COURBE puis par sa revue du 13/10/2026 (test/vivacite.js --long : pilote naturel,
   deux jeux de 48 graines, ≤ 50 % de victoires sur CHACUN) : EBK vitesse des tirs ennemis (1,15 → 1,3 → 1,45 → 1,55), ECD cadence
   des tireurs (leur recharge fond ×1,33), à partir de l'îlot 3 des vagues ×1,3 (WV3) et un plafond de vivants +3, encore ×1,2 à
   l'îlot 6 et ×1,4 aux îlots 7-8 (waveStart) ; les tirs ennemis prennent +8 % par îlot (ebul ; +2,5 % avant) et la vie des boss
   +18 % (gb.js, +14 % avant). Après COURBE seule, le pilote gagnait 11 parties sur 12 (1 sur 12 sur 379e0fb). Le premier réglage
   (EBK 1,45, sans le renfort des îlots 6-8) faisait 4 sur 12 sur les graines qui avaient servi à le régler, mais ~55 % ailleurs, et
   l'îlot 7 était devenu le plus facile du jeu ; avec ceux-ci : 41 victoires sur 96 (graines 1-48 : 21, 49-96 : 20) et 44 sur 96 sur
   des graines jamais utilisées (97 à 192), soit ~44 % ; morts par îlot atteint 0, 0, 7, 18, 14, 16, 12, 9 % ; 2,9 touches par
   minute de vague aux îlots 3-4. Le pilote est un mauvais stratège mais esquive au pas près : un joueur humain les sentira plus que lui. */
const PRAD=18,SEG0=5,NWAVE=3,GROW=1.4,GROWD=1.2,PREYA=2,GONEA=4,EBC='#ff5a2d',EBK=1.55,ECD=1.33,WV3=1.3,SPK_AIM=30,SNP_AIM=45,SPN=14,FODA=.6;
/* vie des ennemis selon l'îlot : au pas des dégâts de la bulle (GROWD), +12 % par îlot (deux bonus par îlot depuis le 02/10/2026 :
   la construction grandit deux fois plus vite), et ×1,2 contre la cadence de tir plus rapide. COURBE (08/10/2026) l'avait ramené à
   +8 % ; la passe d'équilibrage l'a rendu (deuxième barreau de son échelle) : FODA et les lourds allégés suffisent à l'allure, et à
   +8 %, même avec les autres réglages de difficulté, le pilote naturel gagnait 20 parties sur 24 (15 à +12 %, avant les derniers). */
const HPM=()=>1.2*Math.pow(GROWD,G.isl-1)*(1+.12*(G.isl-1));
function decor0(){return{bite:[],car:[],fall:[],givre:[],glisseT:-1,sw:null,swO:{},vu:false,vuT:-1,relais:[]};}
function mkGame(seed){return{state:'play',t:0,time:0,seed,isl:1,ph:'arrive',phT:0,islT:0,wave:0,wq:null,
  p:null,en:[],eb:[],pb:[],pus:[],fx:[],tx:[],tele:[],marks:[],mines:[],trails:[],vol:[],boss:null,
  score:0,kills:0,eats:0,hits:0,maxIsl:1,islHit:false,
  trauma:0,freeze:0,glitch:0,kx:0,ky:0,lastFz:-99,l4:-99,hurtT:0,flash:0,timeScale:1,cx:0,cy:0,zoom:1,pcx:null,pcy:null,pzoom:null,
  banner:null,toasts:[],choices:[],pickIsl:0,pickMid:0,pkMid:false,rerolls:1,picks:[],combo:0,comboT:-999,comboMx:0,heart:null,
  win:false,tgt:null,tgtT:0,dieT:0,manual:false,slowF:1,
  inX:0,inY:0,aimMan:false,aimA:0,tut:{},tutOn:false,biome:'plains',wbn:null,
  dec:decor0(),courant:null,tr:null};}
function mkPlayer(){return{x:0,y:0,vx:0,vy:0,r:PRAD,baseR:PRAD,ang:-Math.PI/2,col:COL.cy,
  seg:SEG0,segMax:SEG0,spd:4.9,fireI:9,dmg:1,bspd:12.5,blife:58,bsize:4.5,pierce:0,turrets:1,spreadW:.16,homing:0,rico:0,split:0,crit:.06,critM:2.5,ctr:0,
  aura:0,auraR:0,orbs:0,drones:0,dronesHome:false,missile:0,missileT:0,nova:0,novaT:0,mines:0,
  dashMax:45,dashT:0,dashing:0,dvx:0,dvy:0,dashDmg:0,dashHit:[],ghost:false,
  inv:0,fireT:0,flash:0,recoil:0,glow:0,shots:0,
  gauge:0,gon:0,gonMax:1,gGain:1,gDur:240,gScale:2,
  pu:{},puMax:{},puDur:1,luck:0,magnet:0,regen:0,regenT:0,digest:0,digN:0,
  mirror:0,chain:0,burst:0,riposte:0,second:0,secUsed:false,trophy:0,echo:0,glouton:0,appetit:0,overload:0,demol:0,
  vortex:false,titan:false,hole:false,noDash:false,noRegen:false,cards:{},dead:false};}

/* ---------- effets ---------- */
function shake(a){G.trauma=Math.min(1,G.trauma+a*(REDUCED?.3:1));}
/* coup de caméra : l'image est poussée d'un cran vers ce qu'on vient d'abattre (G.kx/G.ky, amorti dans updFX, ajouté au
   décalage de tremblement dans render) ; étincelles en trait : un impact de tir projette 3 éclats vers le tireur (FX ty 7,
   un seul stroke par couleur dans drawFX). Math.random (fr) : visuel seul, la suite de R() n'est pas touchée. */
function kick(x,y,a){const P=G.p,dx=x-P.x,dy=y-P.y,d=Math.hypot(dx,dy)||1;a*=REDUCED?.3:1;G.kx=clamp(G.kx+dx/d*a,-10,10);G.ky=clamp(G.ky+dy/d*a,-10,10);}
function lineSparks(x,y,a,n,col){for(let i=0;i<n;i++){const b=a+fr(-.6,.6),s=fr(3,6.5);FX({ty:7,x,y,vx:Math.cos(b)*s,vy:Math.sin(b)*s,life:8,max:8,col});}}
function FX(o){const cap=QL>=3?520:QL===2?340:200;if(G.fx.length<cap)G.fx.push(o);}
function sparks(x,y,col,n,sp,life){if(G.fx.length>180)n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=Math.random()*TAU,s=Math.random()*sp;FX({ty:0,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life||fr(18,34),max:life||34,col,s:fr(1.5,3.5)});}}
function ringFX(x,y,r0,r1,col,life,w){FX({ty:1,x,y,vx:0,vy:0,r:r0,r1,life,max:life,col,w:w||3});}
function shards(x,y,col,n,sp,r){if(G.fx.length>180)n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=Math.random()*TAU,s=fr(sp*.3,sp);FX({ty:2,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:fr(25,45),max:45,col,s:fr(r*.12,r*.32)});}}
function ftext(x,y,s,col,size){if(G.tx.length<20)G.tx.push({x,y,s,col,size:size||14,life:55,max:55,vy:-.9});}
function banner(s,sub,col,dur){G.banner={s,sub:sub||'',col:col||COL.cy,t:0,max:dur||110};}
function toast(s){if(G.toasts.length<3)G.toasts.push({s,t:0});}

/* ---------- partie et îlots ---------- */
function newRun(){
  auInit();
  let seed;if(WD&&!WD.used&&WD.isl===1)seed=WD.run;else{seed=(Math.random()*4294967295)>>>0;genIslet(seed,1);}
  WD.used=true;
  G=mkGame(seed);srand(Math.imul(seed,7919)+13);G.p=mkPlayer();G.tutOn=meta.runs<3;
  setMusic(1);islStart();G.p.inv=60;
}
/* WD vient d'être généré pour l'îlot G.isl : on vide l'arène et on y pose la bulle, au centre (sur la relique) */
function islStart(){
  const k=G.isl,P=G.p;G.biome=ISL[k-1];setBiome(G.biome);if(typeof drawWeather==='function'){WEA.length=0;WCX=null;}
  G.ph='arrive';G.phT=0;G.islT=0;G.wave=0;G.wq=null;G.en=[];G.eb=[];G.pb=[];G.pus=[];G.tele=[];G.marks=[];G.mines=[];G.trails=[];G.vol=[];G.boss=null;G.wbn=null;G.heart=null;
  G.dec=decor0();G.courant=null;if(G.biome==='sea'){const d=siteDir(0,0x5EA);G.courant={x:d[0],y:d[1]};}
  P.x=P.y=0;P.vx=P.vy=0;P.secUsed=false;P.dashing=0;G.cx=G.cy=0;G.zoom=zoomTarget();G.pcx=G.pcy=G.pzoom=null;G.lvx=G.lvy=0;
  prewarm(0,0,WR+60);for(const c of WD.bakes)c.used=0;
  G.maxIsl=Math.max(G.maxIsl,k);G.islHit=false;
}
function arriveBanner(){const b=BIO[G.biome];banner(b.n,'Îlot '+G.isl+' sur '+NISL+' · '+b.sub,b.a,170);
  if(G.isl===1&&G.tutOn)toast(inp.touch?'Pouce gauche : bouger. Le tir est automatique.':'ZQSD ou flèches : bouger. Le tir est automatique.');}
/* déroulé d'un îlot (G.ph) : arrive → wave (×3, séparées par pause) → preboss → boss → clear.
   Rythme (02/10/2026, « trop lent, peu dynamique ») : arrivée 2,5 s → 1,25 s, pauses 1,7 s → 0,75 s, avant le boss
   1,7 s → 0,9 s, îlot nettoyé 3 s → 1,7 s ; puis (08/10/2026, « c'est lent ») arrivée 0,83 s, pauses 0,5 s, avant le boss
   0,6 s, segment rendu à 0,67 s de l'îlot nettoyé (qui dure 1,7 s : l'explosion du boss s'y joue). Un DEUXIÈME bonus se
   choisit après la vague 2 (avant la dernière) : seize choix par partie au lieu de huit, la bulle change de forme deux fois par îlot. */
function updIslet(){
  G.phT++;G.islT++;
  switch(G.ph){
    case 'arrive':if(G.phT===12&&G.pickIsl!==G.isl){openPick();if(G.state!=='play')return;}if(G.phT>=50)waveStart(1);break;
    case 'wave':waveTick();break;
    case 'pause':if(G.phT===8&&G.wave===NWAVE-1&&G.pickMid!==G.isl){openPick(true);if(G.state!=='play')return;}if(G.phT>=30)waveStart(G.wave+1);break;
    case 'preboss':if(G.phT>=35)spawnBoss();break;
    case 'clear':clearTick();break;
  }
  if(G.wbn&&++G.wbn.t>150)G.wbn=null;
}
/* FLUX (08/10/2026, « c'est lent », l'arène vide 20 à 34 % du temps de vague) : la vague s'ouvre sur DEUX groupes en tenaille
   (de part et d'autre de la bulle) ; le suivant vient tous les 30-55 pas, ou 12 pas après le précédent dès qu'il reste ≤ 3 ennemis
   (vivants + annoncés) ; 4 marques au sol au plus ; plafond de vivants 6+⌈1,6k⌉ (8 à l'îlot 1, 19 au 8 ; avant 7 à 17).
   À partir de l'îlot 3, vagues ×WV3, plafond +3, et le groupe suivant vient dès qu'il en reste ≤ 5 : les ennemis tombent plus vite
   (COURBE), il en vient plus (sans quoi l'îlot 3 retombait sous 4 ennemis à l'écran, V7). Encore ×1,2 à l'îlot 6, ×1,4 aux îlots 7-8
   (revue du 13/10/2026 : la fin de la courbe était un tour d'honneur, 45 des 46 parties qui atteignaient l'îlot 7 gagnaient). */
function waveStart(w){
  const k=G.isl,n=Math.round((4+4*w+k)*(k>=3?WV3:1)*(k>=7?1.4:k>=6?1.2:1));G.wave=w;G.ph='wave';G.phT=0;
  G.wq={left:n,n,el:Math.ceil(n*.55),eld:false,prey:k>=PREYA+1?Math.round(n*.35):0,nextT:Math.round(rr(30,55)),th:R()*TAU,gi:0,lastS:0,hit:0};
  G.wbn={w,t:0};SFX.wave();spawnGroup();spawnGroup();
  if(w===2&&k===1&&G.tutOn)toast(inp.touch?'Bouton ⚡ : dash, invulnérable. Frôle un tir en dash : esquive parfaite.':'Espace ou Maj : dash, invulnérable. Frôle un tir en dash : esquive parfaite.');
}
function waveTick(){
  const Q=G.wq,k=G.isl;let alive=0;for(const e of G.en)if(!e.dead&&!e.prey)alive++;
  const cap=6+Math.ceil(k*1.6)+(k>=3?3:0),pend=G.marks.reduce((s,m)=>s+(m.prey?0:m.n),0);
  if((Q.left>0||Q.prey>0&&Q.left<Q.n)&&G.marks.length<4&&(G.phT>=Q.nextT||alive+pend<=(k>=3?5:3)&&G.phT>=Q.lastS+12)&&(alive<cap||G.phT>=Q.nextT+200)){spawnGroup();Q.nextT=G.phT+Math.round(rr(30,55));}
  if(Q.left<=0&&!G.marks.some(m=>!m.prey)&&alive===0){G.score+=100*k*G.wave;
    if(!Q.hit)gainTx(.15,'Vague sans une égratignure',15);
    if(G.wave<NWAVE){G.ph='pause';G.phT=0;}else{G.ph='preboss';G.phT=0;G.marks=[];}}
}
/* où paraître : À L'ÉCRAN (la vue rétrécie de 40), ni collé à la bulle (≥ 300) ni au bout de l'îlot, sur un sol libre.
   a0 (tenaille, spawnGroup) : d'abord dans cette direction, à 300-400 de la bulle ; puis n'importe où dans la vue ; puis
   l'ancien anneau (330-540) ; sinon, le bord. Avant (08/10/2026) l'anneau seul : plus d'un groupe sur deux naissait hors de l'écran. */
function spawnSpot(a0){const P=G.p,hw=W/2/G.zoom-40,hh=H/2/G.zoom-40;let x=0,y=0;
  for(let tr=0;tr<40;tr++){
    if(tr<10&&a0!=null){const a=a0+rr(-.45,.45),r=rr(300,400);x=P.x+Math.cos(a)*r;y=P.y+Math.sin(a)*r;if(Math.hypot(x,y)>PR-90||Math.abs(x-G.cx)>hw||Math.abs(y-G.cy)>hh)continue;}
    else if(tr<22){x=G.cx+rr(-hw,hw);y=G.cy+rr(-hh,hh);if(dist2(x,y,P.x,P.y)<300*300||Math.hypot(x,y)>PR-90)continue;}
    else if(tr<28){const a=R()*TAU,r=rr(330,540);x=P.x+Math.cos(a)*r;y=P.y+Math.sin(a)*r;if(Math.hypot(x,y)>PR-90)continue;}
    else{const a=R()*TAU,r=tr<34?PR-110:PR-260;x=Math.cos(a)*r;y=Math.sin(a)*r;if(dist2(x,y,P.x,P.y)<(tr<34?460:300)**2)continue;}
    if(!wallNear(x,y,56)&&!pointHit(x,y,44))break;}
  return[x,y];}
/* un groupe annoncé : une marque au sol (près d'une seconde), puis les ennemis */
function spawnGroup(){
  const Q=G.wq,k=G.isl,P=G.p;let t,n,prey=false;
  const pt=[];for(let a=PREYA;a<GONEA;a++)if(k-a>=1)pt.push(ETL[k-a-1]);
  if(Q.prey>0&&pt.length&&(Q.left<=0||R()<.34)){t=pick(pt);prey=true;n=Math.min(Q.prey,t==='mite'?5:3);Q.prey-=n;}
  else{if(Q.left<=0)return;t=k>=2&&R()<.36?ETL[k-2]:ETL[k-1];const big=ET[t].r>=19;n=Math.min(Q.left,t==='mite'?6+(R()<.5?1:0):big?1+(R()<.35?1:0):3+(R()<.3?1:0));Q.left-=n;}
  /* tenaille : les groupes 0 et 1 de part et d'autre de la bulle, puis chaque paire tourne de 1,1 rad */
  const a0=Q.th==null?null:Q.th+(Q.gi&1?Math.PI:0)+(Q.gi>>1)*1.1;Q.gi=(Q.gi|0)+1;Q.lastS=G.phT;
  const [x,y]=spawnSpot(a0);
  let el=0;if(!prey&&!Q.eld&&Q.n-Q.left>=Q.el){Q.eld=true;el=1;}
  G.marks.push({x,y,t:0,max:prey?24:30,t2:t,n,prey,el,col:ET[t].col});
}
function updMarks(){
  for(let i=G.marks.length-1;i>=0;i--){const m=G.marks[i];if(++m.t<m.max)continue;G.marks.splice(i,1);
    for(let j=0;j<m.n;j++){const a=R()*TAU,d=j?rr(16,46):0;let x=m.x+Math.cos(a)*d,y=m.y+Math.sin(a)*d;if(pointHit(x,y,ET[m.t2].r)){x=m.x;y=m.y;}
      const e=mkEnemy(m.t2,x,y,{elite:m.el&&j===0?1:0,fo:m.t2==='mite'&&m.n>1?(j/(m.n-1)-.5)*2:0});if(e.elite)eliteIn(e);}
    if(m.prey&&!G.tut.prey){G.tut.prey=1;toast('Plus petits que toi : des proies. Avale-les !');}}
}
/* îlot nettoyé : le boss est tombé */
function islClear(){
  G.ph='clear';G.phT=0;G.eb=[];G.tele=[];G.marks=[];G.vol=[];G.wq=null;SFX.lvl();
  for(const e of G.en)if(!e.dead){e.dead=true;shards(e.x,e.y,e.col,5,3,e.r);G.score+=10;}G.en=[];
}
function clearTick(){
  const P=G.p;if(G.phT===35)G.timeScale=1;
  for(const q of G.pus)q.life=Math.min(q.life,90);
  /* le cœur du gardien vole vers la bulle à partir du 20ᵉ pas ; avalé au contact, ou de force au 70ᵉ (le pilote et __SIM ne bloquent jamais) */
  const h=G.heart;if(h){if(G.phT>=20){const dx=P.x-h.x,dy=P.y-h.y,d=Math.hypot(dx,dy)||1,s=Math.min(d,Math.min(10,(G.phT-20)*.4));h.x+=dx/d*s;h.y+=dy/d*s;}
    if(dist2(h.x,h.y,P.x,P.y)<(P.r+10)**2||G.phT>=70)absorbHeart();}
  if(G.phT===40){if(!P.noRegen&&P.seg<P.segMax){P.seg++;SFX.seg();ringFX(P.x,P.y,P.r,P.r*3,COL.cy,24,4);ftext(P.x,P.y-P.r-14,'+1 segment',COL.cy,16);}
    const bonus=500*G.isl+(G.islHit?0:1000*G.isl);G.score+=bonus;if(!G.islHit)toast('Îlot sans une égratignure');ftext(P.x,P.y-P.r-30,'+'+fmt(bonus),COL.gd,18);}
  if(G.phT>=100){if(G.isl>=NISL){G.win=true;endRun(true);}else transStart();}
}
/* CŒUR (08/10/2026, « on ne se sent pas récompensé ») : le gardien abattu (îlots 1 à 7, gb.js bossDie) laisse son cœur. L'avaler
   fait monter d'un niveau ta DERNIÈRE carte bonus qui n'est pas au maximum (sans tirage : G.picks reste à 16 par partie, la barre
   de construction suit P.cards) ; si toutes le sont, la jauge se remplit. */
function absorbHeart(){const P=G.p;let id=null;for(let i=G.picks.length-1;i>=0;i--){const C=CARDS[G.picks[i]];if(C&&C.k==='b'&&(P.cards[C.u.id]||0)<C.u.max){id=C.u.id;break;}}
  if(id){const u=CARDS[id].u;u.f(P);P.cards[id]++;ftext(P.x,P.y-P.r-24,'Cœur du gardien : '+u.n+' '+ROMAN[P.cards[id]],COL.gd,17);}
  else{P.gauge=1;ftext(P.x,P.y-P.r-24,'Cœur du gardien : jauge pleine',COL.gd,17);}
  ringFX(P.x,P.y,P.r,P.r*4,COL.gd,26,5);sparks(P.x,P.y,COL.gd,20,5);P.r=P.baseR*1.5;SFX.power();G.heart=null;}
/* ---------- croissance : la bulle gonfle, l'îlot rapetisse jusqu'à devenir la relique du suivant ----------
   0-45 : caméra au centre, recul jusqu'à voir l'îlot entier, la bulle gonfle (×GROW) ;
   45 : copie d'écran (g3.js trSnap), îlot suivant généré, la bulle reprend PRAD dans le nouveau repère ;
   45-110 : la copie rétrécit jusqu'au disque de la relique (g3.js drawTrSnap) ; 110-150 : la caméra revient (2,5 s en tout, 3,5 avant). */
const TR_SNAP=45,TR_SHRINK=110,TR_END=150;
/* messages et bandeau s'effacent avant la copie de l'écran (trSnap) : la relique n'en garde pas la trace */
function transStart(){G.state='trans';G.tr={t:0,z0:G.zoom,cx0:G.cx,cy0:G.cy,x0:G.p.x,y0:G.p.y};G.pus=[];G.trauma=0;SFX.grow();
  for(const t of G.toasts)t.t=Math.max(t.t,180);if(G.banner)G.banner.t=Math.max(G.banner.t,G.banner.max-20);}
function updTrans(){
  const T=G.tr,P=G.p;T.t++;P.vx=P.vy=0;P.dashing=0;G.trauma=0;
  if(T.t<=TR_SNAP){const f=T.t/TR_SNAP,e=f*f*(3-2*f);P.x=T.x0*(1-e);P.y=T.y0*(1-e);P.r=lerp(P.r,P.baseR*GROW,.08);P.ang+=.05;}
  if(T.t===TR_SNAP){if(typeof trSnap==='function')trSnap();genIslet(G.seed,G.isl+1);G.isl++;islStart();P.r=P.baseR*GROW;P.dmg*=GROWD;G.cx=G.cy=0;}
  if(T.t>TR_SNAP)P.r=lerp(P.r,P.baseR,.05);
  if(T.t>=TR_END){G.tr=null;G.state='play';G.ph='arrive';G.phT=0;P.r=P.baseR;}
}
/* zoom fixe pendant un îlot : le cache du sol (g3.js solDraw) sert à chaque image */
/* viewR : demi-côté court de la vue, en unités du monde (280 en portrait, 360 en paysage) ; les tireurs s'y tiennent */
function viewR(){return W<H?280:360;}
function zoomTarget(){return Math.min(W,H)/(2*viewR());}
function zoomFull(){return Math.min(W,H)/(2*(WR+40));}

/* ---------- ennemis ---------- */
/* age = îlots écoulés depuis l'arrivée du type : taille ÷1,4 par îlot ; à PREYA, proie. Première recharge : 30-80 pas, 20-50 pour la
   Mite ; Gatling et Pulsar 5-20, Tireur d'élite 10-30 (revue du 13/10/2026 : abattus en ~2 s, 47 à 67 % mouraient sans avoir tiré,
   leur attaque ne se voyait pas). Un seul tirage R() dans tous les cas : la suite aléatoire ne bouge pas */
function mkEnemy(t,x,y,o){const d=ET[t],age=o&&o.age!=null?o.age:G.isl-d.isl,prey=age>=PREYA;
  const e={t,d,age,prey,col:d.col,x,y,vx:0,vy:0,r:d.r*Math.pow(GROW,-age),hp:d.hp*HPM()*(prey?.6:age>=1?FODA:1),mhp:0,spawn:SPN,cd:t==='mite'?rr(20,50):t==='ring'||t==='gatling'?rr(5,20):t==='sniper'?rr(10,30):rr(30,80),st:0,st2:0,ca:0,ta:0,tele:0,flash:0,
    wob:R()*TAU,wa:R()*TAU,nk:(R()*15)|0,nav:null,offT:0,hitT:G.t,dead:false,kids:0,made:0,parent:null,elite:0,sl:0,sn:null,frostT:0,alarmT:0,ivT:0,orbCd:0,dir:R()<.5?1:-1,q2:0,hop:0,blk:false,mod:null,sa:0};
  if(o)Object.assign(e,o);
  if(e.elite){e.mod=pick(['vif','blinde','volatil']);e.hp*=e.mod==='vif'?2:2.4;e.r*=1.3;e.sa=Math.atan2(G.p.y-y,G.p.x-x);}
  e.mhp=e.hp;G.en.push(e);return e;}
/* ÉLITES (08/10/2026, « les ennemis ne sont pas intéressants ») : plus une éponge (×3,2 PV, même comportement), un modificateur
   annoncé à l'éclosion (updMarks). VIVE (×2 PV) : ×1,5 plus rapide, recharge ×1,6, une traînée ; BLINDÉE (×2,4) : un bouclier
   (e.sa, ±1,05 rad) qui se tourne lentement vers toi (,025 par pas : on le contourne de près), ,2 × un tir de face, 1,5 × de dos
   (updBullets ; explosions, aura, satellites, dash et éclats passent) ; VOLATILE (×2,4) : sa mort arme une explosion de 110 u,
   36 pas plus tard (updVol : elle blesse aussi les ennemis, ,6 × leur vie, et peut en armer une autre). Abattue : jauge + ,12 et un
   power-up, comme avant. */
const ELN={vif:'Élite vive',blinde:'Élite blindée',volatil:'Élite volatile'},ELT={vif:'Élite vive : elle court et attaque plus vite.',blinde:'Élite blindée : son bouclier encaisse de face. Prends-la de dos !',volatil:'Élite volatile : elle explose après sa mort. Écarte-toi !'};
function eliteIn(e){ftext(e.x,e.y-e.r-18,ELN[e.mod],COL.gd,14);if(!G.tut['el'+e.mod]){G.tut['el'+e.mod]=1;toast(ELT[e.mod]);}}
function confine(o,r){const dx=o.x,dy=o.y,d=Math.hypot(dx,dy),lim=PR-r;if(d>lim&&d>0){o.x=dx/d*lim;o.y=dy/d*lim;return[dx/d,dy/d];}return null;}
function ebul(x,y,a,s,r,col){s*=1+.08*(G.isl-1);const b={x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r,col:col||EBC,life:420,rot:0,gz:false};if(G.eb.length<600)G.eb.push(b);return b;}
/* tir d'un ennemi : la couleur de son type (on sait qui tire ; un sprite ebSpr par couleur, 8 au plus), ×EBK (le réglage de
   difficulté des tirs ennemis ; l'aiguille du Tireur d'élite a sa vitesse propre). 1,15 → 1,3 avec la
   série et le cœur du gardien : sans aide, le pilote de test gagnait 22 parties sur 26 (16 avant eux) ; à 1,3, 20 sur 26, et la
   partie « naturelle 12345 » de headless.js redevient une défaite ; 1,45, puis 1,55 avec la passe d'équilibrage de COURBE (voir PRAD). Les
   boss appellent ebul directement (EBC). o : champs en plus */
function ebulE(e,a,s,o){const b=ebul(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8,a,s*(e.t==='sniper'?1:EBK),Math.max(4.5,e.r*.32),e.col);if(o)Object.assign(b,o);return b;}
/* les tireurs (ligne de tir requise, updEnemy) ; une annonce en cours (windup) : un critique ou un gros coup l'interrompt (hurtEnemy) */
const SHOOT={spread:1,sniper:1,orbit:1,gatling:1};
function windup(e){return e.t==='mite'&&e.st===3||e.t==='spike'&&e.st===1||e.t==='spread'&&e.st>0||e.t==='sniper'&&e.tele>12||e.t==='gatling'&&e.st<0||e.t==='ring'&&e.st>0;}
/* une proie ne se blesse pas : elle s'avale (les tirs la traversent, le tir automatique l'ignore).
   cr : le critique décidé au TIR (tir doré, playerFire) ; sans lui (aura, satellites, traînée, contact, ondes, explosions, arc,
   débris, drones, missiles, éclats), il se tire à l'impact. Un critique se voit : anneau et éclats dorés, flash doré, coup de caméra. */
function hurtEnemy(e,dmg,kx,ky,quiet,cr){
  if(e.dead||e.spawn>0||e.prey)return;if(relais(e)){dmg*=RELAY_M;e.relT=G.t;}e.hitT=G.t;
  const c=cr===undefined?R()<G.p.crit:cr;if(c){dmg*=G.p.critM;e.crit=G.t;ringFX(e.x,e.y,e.r*.6,e.r*2,COL.gd,10,2);lineSparks(e.x,e.y,Math.atan2(e.y-G.p.y,e.x-G.p.x),4,COL.gd);kick(e.x,e.y,1.5);SFX.crit();}
  /* coup qui interrompt : un critique (ou un coup d'au moins ¼ de sa vie) pendant une annonce l'annule (anneau blanc). Un lourd
     (Gatling, Pulsar) ne cède qu'au gros coup (revue du 13/10/2026 : abattus en ~2 s, leur attaque ne se voyait presque plus) */
  if((c&&e.t!=='gatling'&&e.t!=='ring'||dmg>=.25*e.mhp)&&windup(e)){e.st=0;e.tele=0;e.cd=Math.max(e.cd,30);ringFX(e.x,e.y,e.r,e.r*1.8,'#ffffff',10,2);}
  if(e.stun>0)dmg*=2;
  e.hp-=dmg;e.flash=c?6:4;
  if(e.hp>0&&!G.tut.ripe&&ripe(e)){G.tut.ripe=1;toast('Un ennemi à bout clignote : fonce dessus pour l’avaler !');}
  if(kx&&!(e.t==='spike'&&e.st===2)){const m=e.r>20?.35:1;e.vx+=kx*m;e.vy+=ky*m;}
  if(!quiet)SFX.hit(Math.max(0,e.hp/e.mhp));
  if(e.hp<=0)killEnemy(e);
}
/* gainTx : un gain de jauge annoncé (« … : jauge +21 % ») ; le texte dit le vrai gain (×gGain, plafond), et rien quand la jauge ne
   bouge pas (gonflée, ou déjà pleine) */
function gainTx(v,s,z){const P=G.p,g0=P.gauge;gain(v);if(P.gauge>g0)ftext(P.x,P.y-P.r-26,s+' : jauge +'+Math.round((P.gauge-g0)*100)+' %',COL.gd,z);}
function gain(v){const P=G.p;if(P.gon>0)return;const was=P.gauge<1;P.gauge=Math.min(1,P.gauge+v*P.gGain);
  if(was&&P.gauge>=1){SFX.evo();ringFX(P.x,P.y,P.r,P.r*2.4,COL.wh,18,3);if(!G.tut.gon){G.tut.gon=1;toast(inp.touch?'Jauge pleine : bouton ◉ pour gonfler !':'Jauge pleine : E ou clic droit pour gonfler !');}}}
function killEnemy(e){
  if(e.dead)return;e.dead=true;if(e.parent&&!e.parent.dead)e.parent.kids--;
  const P=G.p;G.kills++;G.score+=Math.round(e.d.sc*(e.elite?4:1)*(e.prey?.5:1)*comboUp(e));gain(e.elite?.12:e.prey?.02:.05);
  if(e.elite){dropPU(e.x,e.y);if(P.luck&&R()<.3*P.luck)dropPU(e.x,e.y);if(P.trophy&&P.seg<P.segMax){P.seg++;SFX.seg();}}
  if(!e.prey&&!(e.egg>0))deathFx(e);
  /* halo de mort : plus petit (×3,2, ×4,5 pour un gros ou une élite ; avant ×7) et un au plus toutes les 4 images */
  if(G.t-G.l4>=4){G.l4=G.t;FX({ty:4,x:e.x,y:e.y,vx:0,vy:0,r:e.r*(e.elite||e.r>=20?4.5:3.2),life:14,max:14,col:e.col});}
  shards(e.x,e.y,e.col,6+Math.floor(e.r/3),3+e.r*.08,e.r);sparks(e.x,e.y,e.col,8,4);ringFX(e.x,e.y,e.r,e.r*2.4,e.col,18,3);
  if(e.crit===G.t)ftext(e.x,e.y-e.r-8,'×'+String(G.p.critM).replace('.',','),COL.gd,14);
  /* l'impact pèse : coup de caméra selon la taille, arrêt sur image (1 pas, 2 gros, 3 élite) pour tout ce qui n'est pas une Mite, 8 pas d'écart au moins */
  const big=e.r>=20,mid=e.d.hp>=4||e.elite;SFX.pop(big,G.combo);kick(e.x,e.y,e.elite?7:big?5:mid?3:1.5);if(big||e.elite)shake(.25);
  if(mid&&!e.prey&&G.t-G.lastFz>8){G.freeze=Math.max(G.freeze,e.elite?3:big?2:1);G.lastFz=G.t;}
}
/* MORTS (08/10/2026, « les ennemis ne sont pas intéressants ») : une mort qui compte. L'Épine abattue projette 4 piquants (dans
   l'axe où elle est dessinée, comme eAng), la Gatling 6 éclats : des tirs de la BULLE (sans col : cyan, ils se lisent comme les
   tiens, pas comme un tir ennemi) ; le Pulsar meurt dans une onde (120 u : pousse, blesse, efface les tirs ennemis) ; le Porteur se
   fend en 3 Mites (parent posé : elles ont l'âge de leur parent, l'observateur de headless.js les reconnaît). Mite, Tireur, Tireur
   d'élite, Orbiteur : rien, de la chair à canon. Chaînes bornées : l'onde saute ce qui éclot (spawn > 0, les Mites naissent à 10) ;
   les éclats poussés pendant la boucle à rebours d'updBullets tombent après i et n'y sont pas vus ce pas-ci. */
function deathFx(e){const P=G.p;if(e.mod==='volatil')G.vol.push({x:e.x,y:e.y,t:36,r:110});
  switch(e.t){
    case 'spike':{const a0=e.st===2?e.ca:e.wob*2;for(let k=0;k<4;k++)pbul(e.x,e.y,a0+k*Math.PI/2,{dmg:P.dmg*2,r:4,life:16,shard:true,pierce:1,split:0,rico:0,home:0,hit:[e]});
      if(!G.tut.spk){G.tut.spk=1;toast('Une Épine abattue projette ses piquants : abats-la au milieu des autres.');}break;}
    case 'gatling':for(let k=0;k<6;k++)pbul(e.x,e.y,k*TAU/6+e.wob,{dmg:P.dmg*1.5,r:4,life:20,shard:true,pierce:1,split:0,rico:0,home:0,hit:[e]});break;
    case 'ring':shockwave(e.x,e.y,120,P.dmg*3,true);break;
    case 'spawner':if(G.en.length<40)for(let k=0;k<3;k++){const a=k*TAU/3+e.wob;mkEnemy('mite',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,{age:0,spawn:10,parent:e,cd:rr(30,50)});}break;
  }}
/* COMBO : chaque ennemi abattu ou avalé moins de 2,5 s (SERW ; 1,5 s avant le 08/10/2026 : plus court que le temps d'abattre un
   ennemi) après le précédent fait monter la série ; une esquive parfaite ou un obstacle cassé la prolongent sans compter (serKeep).
   Le score est multiplié (×1 puis +0,5 toutes les 5, jusqu'à ×3). Affichée sous la bulle (g3.js drawTexts), annoncée à 10, 25,
   50, 100 ; en vague (pas en combat de boss), un cadeau à 15 (power-up d'arme ou onde : 70 u devant la bulle, sinon le premier
   cap libre autour d'elle, sinon sur elle ; au plafond de 8 power-ups, le plus ancien s'efface) et la jauge +20 % à 40.
   EMBALLEMENT (emb) : le tir accélère avec la série, +2 % par kill jusqu'à +25 % (playerFire), traînées plus longues, canons blancs. */
const SERW=150;
function emb(){return G.t-G.comboT<=SERW?Math.min(.25,.02*G.combo):0;}
function serKeep(){if(G.t-G.comboT<=SERW)G.comboT=G.t;}
function comboUp(e){const P=G.p;G.combo=G.t-G.comboT<=SERW?G.combo+1:1;G.comboT=G.t;if(G.combo>G.comboMx)G.comboMx=G.combo;
  if(G.combo===10||G.combo===25||G.combo===50||G.combo===100){ftext(P.x,P.y-P.r-26,'Série ×'+G.combo+' !',COL.gd,18);SFX.evo();}
  if(G.ph==='wave'&&G.combo===15){let x=P.x,y=P.y;for(let k=0;k<8;k++){const a=P.ang+k*TAU/8,X=P.x+Math.cos(a)*70,Y=P.y+Math.sin(a)*70;if(!pointHit(X,Y,14)){x=X;y=Y;break;}}
    if(G.pus.length>=8)G.pus.shift();dropPU(x,y,pick(['rapid','triple','pierce','wave']));ftext(P.x,P.y-P.r-26,'Série ×15 : cadeau !',COL.gd,18);SFX.evo();}
  if(G.ph==='wave'&&G.combo===40){gainTx(.2,'Série ×40',18);SFX.evo();}
  return 1+Math.min(4,Math.floor(G.combo/5))*.5;}
/* ABSORB (08/10/2026, « on ne se sent pas récompensé ») : avaler en plein combat. À bout (moins de 20 % de vie, 40 % avec Appétit)
   et plus petit que toi (×1,1), un ennemi s'avale au contact au lieu de te blesser ; il clignote (g3.js drawEnemy). À son îlot :
   Épine, Tireur, Tireur d'élite, Orbiteur, Gatling ; le Pulsar et le Porteur, seulement quand tu es gonflé. */
function ripe(e){const P=G.p;return !e.prey&&!(e.egg>0)&&e.hp<e.mhp*(P.appetit?.4:.2)&&e.r<P.r*1.1;}
/* avaler : une proie, un ennemi à bout (ripe), ou n'importe quel ennemi plus petit que toi quand tu es gonflé.
   Digestion : un segment toutes les 20 absorptions (12 avant : on avale bien plus souvent) */
function absorb(e){
  if(e.dead)return;e.dead=true;if(e.parent&&!e.parent.dead)e.parent.kids--;const P=G.p;
  G.eats++;G.score+=Math.round((e.prey?25:e.d.sc)*comboUp(e));gain((e.prey?.075:.04)*(1+.4*P.glouton));
  if(P.digest&&++P.digN>=20){P.digN=0;if(P.seg<P.segMax){P.seg++;SFX.seg();ftext(P.x,P.y-P.r-14,'+1 segment',COL.cy,15);}}
  if(e.elite)dropPU(e.x,e.y);
  FX({ty:5,x:e.x,y:e.y,vx:(P.x-e.x)/12,vy:(P.y-e.y)/12,r:e.r,life:12,max:12,col:e.col});
  SFX.absorb();P.glow=Math.min(1,P.glow+.25);
}
/* proie : erre, puis fuit quand tu approches (moins vite que toi). À 220 u et ,55 × ta vitesse (360 et ,7 avant : on la
   poursuivait à travers l'îlot) ; elle s'avale à +10 de ton bord (+6) */
function preyMove(e,tf){
  const P=G.p,dx=e.x-P.x,dy=e.y-P.y,d=Math.hypot(dx,dy)||1;e.wob+=.05;let tx,ty,sp;
  if(d<220){tx=dx/d+Math.cos(e.wob)*.35;ty=dy/d+Math.sin(e.wob)*.35;sp=P.spd*.55;}
  else{e.wa+=rr(-.1,.1);tx=Math.cos(e.wa);ty=Math.sin(e.wa);sp=.8;}
  const tl=Math.hypot(tx,ty)||1;e.vx=lerp(e.vx,tx/tl*sp,.1);e.vy=lerp(e.vy,ty/tl*sp,.1);
  if(P.glouton&&d<P.r+e.r+90*P.glouton){e.vx-=dx/d*1.1;e.vy-=dy/d*1.1;}
  e.x+=e.vx*tf;e.y+=e.vy*tf;
  const oh=collideCircle(e,e.r);if(oh)e.wa=Math.atan2(oh[1],oh[0]);
  if(confine(e,e.r))e.wa+=Math.PI;
}
/* une Épine qui charge dans un rocher (ou le bord) : sonnée 1 s, dégâts ×2 (hurtEnemy), sans danger au contact (updEnemies) */
function spikeStun(e){e.st=0;e.cd=60;e.stun=60;sparks(e.x,e.y,COL.gd,6,3);shake(.06);SFX.brk();ftext(e.x,e.y-e.r-14,'Sonnée !',COL.gd,13);
  if(!G.tut.estun){G.tut.estun=1;toast('Une Épine qui charge dans un rocher reste sonnée : dégâts ×2.');}}
function updEnemy(e){
  if(e.spawn>0){e.spawn--;return;}
  if(e.flash>0)e.flash--;
  const tf=G.slowF*(e.frostT>G.t?.45:1);
  if(e.prey){preyMove(e,tf);return;}
  /* œuf de l'Essaim-Mère (gb.js ponte) : il vole jusqu'à sa place, couve, puis éclot en Mite qui bondit presque aussitôt */
  if(e.egg>0){e.x=lerp(e.x,e.ex,.1);e.y=lerp(e.y,e.ey,.1);e.wob+=.05;if((e.egg-=tf)<=0){e.egg=0;e.r=e.d.r;e.cd=rr(25,45);sparks(e.x,e.y,e.col,8,3);ringFX(e.x,e.y,e.r,e.r*2.5,e.col,14,2);SFX.pop(false);}return;}
  /* sonnée (une Épine dont la charge a fini dans un obstacle, spikeStun) : elle glisse sur son élan, ne fait rien, prend ×2 ;
     rochers et bord la retiennent (sans eux, une charge finie dans le bord la laissait ~48 u hors de l'îlot pendant 1 s) */
  if(e.stun>0){e.stun-=tf;e.vx*=.85;e.vy*=.85;e.x+=e.vx*tf;e.y+=e.vy*tf;collideCircle(e,e.r);confine(e,e.r);return;}
  const P=G.p,d=e.d,dx=P.x-e.x,dy=P.y-e.y,dd=Math.hypot(dx,dy)||1,aP=Math.atan2(dy,dx);let ax=dx/dd,ay=dy/dd;
  if(e.mod==='blinde')e.sa+=angDiff(e.sa,aP)*.025*tf;
  /* un massif entre lui et toi : il suit la carte des distances (flowDir) au lieu de foncer dans la falaise */
  /* un tireur (SHOOT) dont la ligne vers toi est coupée (massif, rocher solide) ne tire pas (e.blk) : il se décale (après le switch) */
  if(G.t%15===e.nk){e.nav=losWall(e.x,e.y,P.x,P.y)?flowDir(e.x,e.y):null;e.blk=!!SHOOT[e.t]&&(!!e.nav||!lineClear(e.x,e.y,P.x,P.y,P.r));}if(e.nav){ax=e.nav[0];ay=e.nav[1];}
  /* plus vifs d'îlot en îlot (+4 % par îlot) : la bulle grandit, eux aussi */
  let tx=0,ty=0,sp=d.spd*(e.alarmT>G.t?SW_SP:1)*(1+.04*(G.isl-1));const vr=viewR();
  if(e.mod==='vif'){sp*=1.5;if(G.t%3===0)FX({ty:3,x:e.x,y:e.y,vx:0,vy:0,r:e.r,life:9,max:9,col:e.col});}
  e.wob+=.03*tf;
  /* un tireur hors de l'écran ne tire pas (son cd est gelé) et revient vite (×2,2) : on ne prend plus de tirs d'un ennemi
     qu'on ne voit pas. La Mite et l'Épine (corps à corps) gardent leur allure. Ligne coupée : pas de tir non plus, mais son cd
     court (il tire dès qu'il sort de derrière le rocher, après son annonce) ; e.blk date d'au plus 15 pas, la ligne est donc revue
     au moment de tirer (un lineClear par tir). */
  const os=e.t!=='mite'&&e.t!=='spike'&&(Math.abs(e.x-G.cx)>W/2/G.zoom-e.r||Math.abs(e.y-G.cy)>H/2/G.zoom-e.r);if(os)sp*=2.2;
  const fire=()=>!os&&(e.cd-=tf*(e.mod==='vif'?1.6:1)*(SHOOT[e.t]||e.t==='ring'?ECD:1))<=0&&!e.blk&&(!SHOOT[e.t]||lineClear(e.x,e.y,P.x,P.y,P.r)||(e.blk=true,false));
  switch(e.t){
    /* Mite (08/10/2026, « les ennemis ne sont pas intéressants ») : l'essaim arrive en éventail (e.fo, updMarks), tourne autour de
       toi tant qu'il n'est pas prêt ; à portée (220), elle S'ARRÊTE et s'annonce (st 3, 14 pas : gonflée, cernée de blanc, trait
       de visée) en visant là où tu SERAS (point de rencontre exact, ≤ 30 pas), puis BONDIT (×4 pendant 30 pas, 300 u : elle
       arrive, même sur une bulle qui file à angle droit). Avant : 90 u, elle finissait à 124 u de toi. On l'esquive en changeant
       de cap pendant le bond, en s'éloignant, ou au dash. */
    case 'mite':if(e.st===1){sp*=4;tx=Math.cos(e.ca);ty=Math.sin(e.ca);if(G.t%3===0)FX({ty:3,x:e.x,y:e.y,vx:0,vy:0,r:e.r,life:9,max:9,col:e.col});if((e.st2-=tf)<=0){e.st=0;e.cd=rr(60,100);}}
      else if(e.st===3){sp=0;e.vx*=.7;e.vy*=.7;const lv=d.spd*(1+.04*(G.isl-1))*4,qa=P.vx*P.vx+P.vy*P.vy-lv*lv,qb=dx*P.vx+dy*P.vy,l=qa<0?Math.min(30,(-qb-Math.sqrt(qb*qb-qa*dd*dd))/qa):30;e.ca=Math.atan2(P.y+P.vy*l-e.y,P.x+P.vx*l-e.x);if((e.st2-=tf)<=0){e.st=1;e.st2=30;}}
      else{const f=clamp((dd-110)/200,0,1),o=(e.fo||0)*f,c=Math.cos(o),s=Math.sin(o),bx=ax+Math.cos(e.wob*3)*.45,by=ay+Math.sin(e.wob*3)*.45;tx=bx*c-by*s;ty=bx*s+by*c;sp*=1.15;
        if(dd<150&&e.cd>0){const dr=e.nk&1?1:-1;tx=-ay*dr+ax*.2;ty=ax*dr+ay*.2;}
        if(fire()&&dd<220){e.st=3;e.st2=14;}}break;
    /* Tireur (08/10/2026, « les tirs sont ennuyeux ») : il te tourne autour (sens e.dir, inversé toutes les 2 à 3 s : plus de file
       indienne), SE PLANTE et s'annonce 22 pas (bouches blanches, visée figée les 6 derniers), puis tire un éventail de 5 (7 en élite)
       PLUS VITE que la bulle (6 u/pas à l'îlot 3, contre 4,9) : 47 u entre deux tirs à 250 u, la bulle (36 u) passe entre. */
    case 'spread':{if((e.st2-=tf)<=0){e.st2=rr(120,200);e.dir*=-1;}const s=dd>Math.min(280,vr-60)?1:dd<150?-.5:0;tx=ax*s-ay*.5*e.dir;ty=ay*s+ax*.5*e.dir;
      if(e.st>0){sp=0;if(e.st>6)e.ca=aP;if((e.st-=tf)<=0){e.st=0;const m=e.elite?3:2;for(let k=-m;k<=m;k++)ebulE(e,e.ca+k*.19,5);SFX.eshot();}}
      else if(fire()){e.cd=rr(85,105);e.st=22;e.ca=aP;}break;}
    case 'spike':
      /* Épine : vise ½ s (trait pointillé) en ANTICIPANT (là où tu seras dans 14 pas), VERROUILLÉE les 10 derniers pas (trait
         blanc plein), puis charge 340 u (40 pas à 8,5). Une charge qui finit dans un obstacle ou le bord la laisse sonnée (spikeStun). */
      if(e.st===0){tx=ax*.6+Math.cos(e.wob)*.3;ty=ay*.6+Math.sin(e.wob)*.3;if(fire()&&dd<380){e.st=1;e.st2=SPK_AIM;e.ca=aP;}}
      else if(e.st===1){sp=0;if(e.st2>10)e.ca=Math.atan2(P.y+P.vy*14-e.y,P.x+P.vx*14-e.x);if((e.st2-=tf)<=0){e.st=2;e.st2=40;}}
      else{sp=8.5;tx=Math.cos(e.ca);ty=Math.sin(e.ca);if((e.st2-=tf)<=0){e.st=0;e.cd=rr(40,75);}}break;
    /* Orbiteur : deux coups qui COURBENT (rot, dans son sens de rotation), à 8 pas d'écart */
    case 'orbit':{if((e.st2-=tf)<=0){e.st2=rr(90,170);e.dir*=-1;}const s=clamp((dd-Math.min(210,vr-70))/60,-1,1);tx=ax*s-ay*e.dir;ty=ay*s+ax*e.dir;if(e.st2<30)sp*=.25;
      if(e.q2>0&&(e.q2-=tf)<=0&&!os)ebulE(e,aP,4.8,{rot:e.dir*.009});
      if(fire()){e.cd=rr(60,80);e.q2=8;ebulE(e,aP,4.8,{rot:e.dir*.009});SFX.eshot();}break;}
    /* Pulsar : il vient à toi ; à moins de 380 u (et à l'écran), il INSPIRE 20 pas (il rétrécit, g3.js), puis souffle 10 orbes moins
       une brèche, TOURNÉS VERS TOI (la brèche derrière lui) : les quatre de devant se referment en pince sur le point où tu seras
       (l'anticipation du bond de la Mite, ≤ 40 pas ; arc de cercle exact, rot), puis filent droit (b.rt). Un tir de la bulle crève
       un orbe (sh, updBullets). Avant : 12 tirs partout, jusqu'à 86 en vol ; puis (08/10/2026) un anneau lent tiré au hasard, dont
       l'orbe qui venait vers toi descendait ta ligne de tir et crevait : aucun n'approchait (revue du 13/10/2026). Orbes à 5 (×EBK),
       toutes les 70 à 90 pas (100-125). On l'esquive en changeant de cap, ou en crevant la pince. */
    case 'ring':tx=ax*.8+Math.cos(e.wob)*.5;ty=ay*.8+Math.sin(e.wob)*.5;
      if(e.st>0){sp*=.3;if((e.st-=tf)<=0){e.st=0;const v0=5*EBK*(1+.08*(G.isl-1)),qa=P.vx*P.vx+P.vy*P.vy-v0*v0,qb=dx*P.vx+dy*P.vy,l=qa<0?Math.min(40,(-qb-Math.sqrt(qb*qb-qa*dd*dd))/qa):0,X=dx+P.vx*l,Y=dy+P.vy*l,aI=Math.atan2(Y,X),dI=Math.hypot(X,Y)||1;
          const n=10,o=aI+Math.PI/n,g=aI+Math.PI;for(let k=0;k<n;k++){const a=o+k*TAU/n,da=angDiff(a,aI);if(Math.abs(angDiff(a,g))<.5)continue;const b=ebulE(e,a,5,{r:8,sh:1});if(Math.abs(da)<1){const v=Math.hypot(b.vx,b.vy);b.rot=2*Math.sin(da)*v/dI;b.rt=dI*da/Math.sin(da)/v;}}SFX.bshot();}}
      else if(fire()&&dd<380){e.cd=rr(70,90);e.st=20;}break;
    /* Tireur d'élite : il se tient à vr-130..vr-60 (à l'écran, même en portrait), vise 45 pas en ANTICIPANT (là où tu seras dans
       8 pas), VERROUILLÉ les 12 derniers (trait blanc), tire une aiguille (13 u/pas, ndl), puis file de côté 30 pas (e.hop) */
    case 'sniper':{const s=dd>vr-60?1:dd<vr-130?-1:0;tx=ax*s+Math.cos(e.wob)*.3;ty=ay*s+Math.sin(e.wob)*.3;
      if(e.hop>0){e.hop-=tf;tx=-ay*e.dir;ty=ax*e.dir;sp*=2.5;}
      if(e.tele>0){sp*=.2;e.tele-=tf;if(e.tele>12)e.ta+=angDiff(e.ta,Math.atan2(P.y+P.vy*8-e.y,P.x+P.vx*8-e.x))*.09;if(e.tele<=0){e.tele=0;ebulE(e,e.ta,13,{ndl:1});SFX.snipe();e.hop=30;}}
      else if(fire()){e.cd=rr(85,115);e.tele=SNP_AIM;e.ta=aP;SFX.tele();}break;}
    /* Gatling : 30 pas de montée en régime, plantée, MUETTE, visée qui te suit (canons blancs qui tournent, g3.js), puis une rafale
       de 40 pas en balayage (10 balles à 5) */
    case 'gatling':tx=ax*.2;ty=ay*.2;
      if(e.st<0){sp=0;e.ca=aP;if((e.st+=tf)>=0)e.st=40;}
      else if(e.st>0){const f=1-e.st/40;if(Math.round(e.st)%4===0)ebulE(e,e.ca-.5+f,5);if(Math.round(e.st)%15===0)SFX.eshot();e.st-=tf;if(e.st<=0)e.st=0;}
      else if(fire()){e.cd=rr(110,140);e.st=-30;}break;
    /* Porteur : il vient à toi en louvoyant ; 4 Mites en tout */
    case 'spawner':tx=ax*.6+Math.cos(e.wob*.7);ty=ay*.6+Math.sin(e.wob*.9);
      if(fire()){e.cd=rr(130,170);if(e.kids<4&&e.made<4&&G.en.length<40)for(let k=0;k<2;k++){e.made++;const a=R()*TAU;mkEnemy('mite',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,{age:0,spawn:10,parent:e});e.kids++;}}break;
  }
  if(e.blk&&!e.nav){tx=-ay*e.dir+ax*.6;ty=ax*e.dir+ay*.6;sp*=1.6;}
  if(e.sl>0&&e.sn){e.sl--;const n=e.sn,sg=(tx*-n[1]+ty*n[0])>=0?1:-1;tx+=-n[1]*sg*.9;ty+=n[0]*sg*.9;}
  const tl=Math.hypot(tx,ty)||1;
  if(e.t==='spike'&&e.st===2||e.t==='mite'&&e.st===1){e.vx=tx*sp;e.vy=ty*sp;if(e.t==='spike'&&G.t%2===0)FX({ty:3,x:e.x,y:e.y,vx:0,vy:0,r:e.r,life:12,max:12,col:e.col});}
  else{e.vx=lerp(e.vx,tx/tl*sp,.08);e.vy=lerp(e.vy,ty/tl*sp,.08);}
  e.x+=e.vx*tf;e.y+=e.vy*tf;
  const oh=collideCircle(e,e.r);
  if(oh&&skyFalls(e,sp,oh))return;
  if(oh){const vn=e.vx*oh[0]+e.vy*oh[1];if(vn<0){e.vx-=vn*oh[0];e.vy-=vn*oh[1];}e.sl=20;e.sn=oh;if(e.t==='spike'&&e.st===2)spikeStun(e);}
  if(confine(e,e.r)&&e.t==='spike'&&e.st===2)spikeStun(e);
  /* hors de vue 5 s, ou intouché 15 s (coincé derrière un rocher, ou trop prudent) : il reparaît à vue — une vague finit toujours */
  const off=Math.abs(e.x-G.cx)>W/2/G.zoom+40||Math.abs(e.y-G.cy)>H/2/G.zoom+40;e.offT=off?e.offT+1:0;
  if(e.offT>300||G.t-e.hitT>900){const s=spawnSpot();e.x=s[0];e.y=s[1];e.vx=e.vy=0;e.spawn=SPN;e.offT=0;e.hitT=G.t;e.nav=null;}
}
/* ---------- navigation : carte des distances au joueur sur la grille des falaises (WC), refaite toutes les 20 images.
   Les massifs intérieurs de l'îlot sont des couverts ; sans elle, un ennemi né derrière l'un d'eux y restait collé. ---------- */
let FLOW=null,FLOQ=null;const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function flowUpd(){const N=NG,P=G.p;if(!FLOW||FLOW.length!==N*N){FLOW=new Int16Array(N*N);FLOQ=new Int32Array(N*N);}FLOW.fill(-1);
  const i0=Math.floor((P.x-G0)/WC),j0=Math.floor((P.y-G0)/WC);if(i0<0||j0<0||i0>=N||j0>=N)return;
  let h=0,n=0;const s=j0*N+i0;FLOW[s]=0;FLOQ[n++]=s;
  while(h<n){const k=FLOQ[h++],i=k%N,j=(k/N)|0,d=FLOW[k]+1;
    for(let q=0;q<4;q++){const a=i+D8[q][0],b=j+D8[q][1];if(a<0||b<0||a>=N||b>=N)continue;const m=b*N+a;if(FLOW[m]>=0||WD.wall[m])continue;FLOW[m]=d;FLOQ[n++]=m;}}}
function flowDir(x,y){if(!FLOW)return null;const N=NG,i=Math.floor((x-G0)/WC),j=Math.floor((y-G0)/WC);if(i<0||j<0||i>=N||j>=N)return null;
  let bd=FLOW[j*N+i],best=null;if(bd<0)bd=1e4;
  for(const [di,dj] of D8){const a=i+di,b=j+dj;if(a<0||b<0||a>=N||b>=N)continue;const v=FLOW[b*N+a];if(v<0||v>=bd)continue;
    if(di&&dj&&(WD.wall[j*N+a]||WD.wall[b*N+i]))continue;bd=v;best=[di,dj];}
  if(!best)return null;const l=Math.hypot(best[0],best[1]);return[best[0]/l,best[1]/l];}
function losWall(x0,y0,x1,y1){const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/40);for(let k=1;k<n;k++){const t=k/n;if(wallAt(Math.floor((x0+(x1-x0)*t-G0)/WC),Math.floor((y0+(y1-y0)*t-G0)/WC)))return true;}return false;}
function updEnemies(){
  const P=G.p,D=G.dec;
  if(G.t%20===0||!FLOW)flowUpd();
  for(let i=0;i<G.en.length;i++){const e=G.en[i];if(e.dead)continue;updEnemy(e);}
  const n=G.en.length;
  for(let i=0;i<n;i++){const a=G.en[i];if(a.dead)continue;for(let j=i+1;j<n;j++){const b=G.en[j];if(b.dead)continue;const dx=b.x-a.x,dy=b.y-a.y,rs=a.r+b.r,d2=dx*dx+dy*dy;
    if(d2<rs*rs&&d2>.01){const d=Math.sqrt(d2),o=(rs-d)*.5/d;a.x-=dx*o;a.y-=dy*o;b.x+=dx*o;b.y+=dy*o;}}}
  /* givre (Glacier) : la traînée du dash glissé ralentit les ennemis qui la traversent */
  if(D.givre.length)for(const e of G.en){if(e.dead||e.spawn>0)continue;for(const q of D.givre)if(dist2(e.x,e.y,q.x,q.y)<(q.r+e.r)**2){if(e.frostT<=G.t)sparks(e.x,e.y,'#b5f3ff',3,2,14);e.frostT=G.t+90;break;}}
  /* gonflée, la bulle aspire ce qui est plus petit qu'elle à moins de 240 u (×,64) : l'avaler devient le but du gonflement
     (2,7 ennemis par gonflement à l'îlot 3 avant). Trou noir : tout, plus gros compris, à 340 u et à pleine force */
  if(P.gon>0)for(const e of G.en){if(e.dead||e.spawn>0||!P.hole&&e.r>=P.r)continue;const dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1,R0=P.hole?340:240,k=P.hole?1:.64;if(d<R0){e.vx+=dx/d*.7*k;e.vy+=dy/d*.7*k;e.x+=dx/d*1.6*k;e.y+=dy/d*1.6*k;}}
  if(G.state==='play'&&!P.dead)for(const e of G.en){if(e.dead||e.spawn>0||e.fall>0)continue;const d2=dist2(e.x,e.y,P.x,P.y);
    if(e.prey||e.egg>0){if(d2<(P.r+e.r+10+30*P.glouton)**2)absorb(e);continue;}
    const rs=e.r+P.r*.85;if(d2>=rs*rs)continue;
    if(P.gon>0&&e.r<P.r){absorb(e);continue;}
    if(ripe(e)){absorb(e);continue;}
    const dx=P.x-e.x,dy=P.y-e.y,d=Math.sqrt(d2)||1,o=rs-d;
    if(e.stun>0){e.x-=dx/d*o;e.y-=dy/d*o;continue;}
    if(P.gon>0||P.pu.inv>0){if(e.ivT<=G.t){e.ivT=G.t+8;hurtEnemy(e,P.dmg*4,-dx/d*3,-dy/d*3,true);}e.x-=dx/d*o;e.y-=dy/d*o;continue;}
    if(P.dashing>0||P.inv>0){if(P.dashing>0)perfect(e.x,e.y);e.x-=dx/d*o*.5;e.y-=dy/d*o*.5;continue;}
    hurtPlayer(e.x,e.y);
    if(e.t==='mite')killEnemy(e);else{P.x+=dx/d*o*.5;P.y+=dy/d*o*.5;e.x-=dx/d*o*.5;e.y-=dy/d*o*.5;}}
  decorTick();
  G.en=G.en.filter(e=>!e.dead&&!(e.fall>0));
}

/* ---------- joueur ---------- */
function hurtPlayer(sx,sy){
  const P=G.p;if(P.dashing>0&&G.state==='play'&&!P.dead)perfect(sx,sy);if(G.state!=='play'||P.inv>0||P.dashing>0||P.dead||P.gon>0||P.pu.inv>0)return;
  if(P.pu.shield>0){delete P.pu.shield;P.inv=45;SFX.shield();ringFX(P.x,P.y,P.r*1.2,P.r*3.4,COL.wh,20,4);clearNear(120);return;}
  if(G.wq)G.wq.hit=1;P.seg--;G.islHit=true;G.hits++;
  P.inv=60;P.flash=10;shake(.5);G.freeze=Math.max(G.freeze,3);G.glitch=Math.max(G.glitch,8);G.hurtT=22;SFX.hurt();
  const d=Math.hypot(P.x-sx,P.y-sy)||1;P.vx+=(P.x-sx)/d*4;P.vy+=(P.y-sy)/d*4;
  clearNear(90);
  if(P.riposte)shockwave(P.x,P.y,230,P.dmg*6,true);
  if(P.seg<=0){if(P.second&&!P.secUsed){P.secUsed=true;P.seg=1;P.inv=120;shockwave(P.x,P.y,320,P.dmg*5,true);toast('Second souffle !');return;}die();}
}
function clearNear(rad){const P=G.p;for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,P.x,P.y)<rad*rad){sparks(b.x,b.y,b.col,2,2,12);G.eb.splice(i,1);}}}
function tryDash(){
  if(!G||G.state!=='play')return;const P=G.p;if(P.dashT>0||P.dead||P.noDash||P.dashing>0)return;
  let dx=G.inX,dy=G.inY;if(!dx&&!dy){dx=Math.cos(P.ang);dy=Math.sin(P.ang);}const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  P.perf=0;P.glisse=G.biome==='ice';P.dashing=P.glisse?ICE_DASH:12;if(P.glisse)G.dec.glisseT=G.t;P.dashT=P.dashMax;P.dvx=dx*P.spd*3.2;P.dvy=dy*P.spd*3.2;P.inv=Math.max(P.inv,18);P.dashHit=[];SFX.dash();
  ringFX(P.x,P.y,P.r,P.r*2.2,P.col,14,3);if(P.echo)clearNear(160);if(P.mines)layMine(P.x,P.y);
}
/* ESQUIVE PARFAITE (08/10/2026) : un coup (tir, contact, charge, rayon) qui t'aurait touché PENDANT le dash. Une fois par
   dash : le dash se recharge aussitôt, la jauge prend PERF_G, la série tient (serKeep), le temps ralentit un instant. Le dash devient une arme.
   CONTRE-ATTAQUE : pendant CTR pas (1,25 s), tous les tirs sont critiques, percent un ennemi de plus, cadence ×1/0,7 ; canons dorés. */
const PERF_G=.14,CTR=75;
function perfect(x,y){const P=G.p;if(P.perf)return;P.perf=1;P.dashT=0;P.ctr=CTR;gain(PERF_G);serKeep();G.perfs=(G.perfs||0)+1;G.score+=50*G.isl;
  G.timeScale=Math.min(G.timeScale,.55);ringFX(P.x,P.y,P.r,P.r*3.2,COL.gd,20,4);sparks(x,y,COL.gd,10,4);ftext(P.x,P.y-P.r-18,'Parfait !',COL.gd,17);SFX.evo();
  if(!G.tut.perf){G.tut.perf=1;toast('Esquive parfaite : ton dash se recharge aussitôt.');}
  if(!G.tut.ctr){G.tut.ctr=1;toast('Contre-attaque : une esquive parfaite rend tous tes tirs critiques un instant.');}}
/* Gonfler : jauge pleine. La bulle double, devient invulnérable et avale ce qui est plus petit qu'elle ; à la fin, elle éclate. */
function tryGonfle(){
  if(!G||G.state!=='play')return;const P=G.p;if(P.gauge<1||P.gon>0||P.dead)return;
  P.gauge=0;G.gonN=(G.gonN||0)+1;P.gon=P.gonMax=P.gDur;SFX.gonfle();shake(.35);G.glitch=Math.max(G.glitch,10);
  ringFX(P.x,P.y,P.r,P.r*P.gScale*1.6,COL.wh,24,5);clearNear(P.r*P.gScale+20);
}
function gonBurst(){const P=G.p;shockwave(P.x,P.y,300+60*(P.gScale-2),P.dmg*14,true);ringFX(P.x,P.y,P.r,P.r*6,COL.cy,30,7);SFX.burst();shake(.6);G.flash=Math.max(G.flash,.35);}
function updPlayer(){
  const P=G.p;G.time++;
  if(P.inv>0)P.inv--;if(P.flash>0)P.flash--;if(P.dashT>0)P.dashT--;
  if(P.regen>0&&P.seg<P.segMax){if(++P.regenT>=(P.regen>1?1500:2400)){P.regenT=0;P.seg++;SFX.seg();ringFX(P.x,P.y,P.r,P.r*2.5,COL.cy,20,3);}}else P.regenT=0;
  if(P.gon>0){P.gon--;if(P.gon===0)gonBurst();}
  if(P.dashing>0){
    P.dashing--;P.vx=P.dvx;P.vy=P.dvy;
    if(G.t%2===0)FX({ty:3,x:P.x,y:P.y,vx:0,vy:0,r:P.r,life:16,max:16,col:P.col});
    if(P.glisse&&G.t%2===0)G.dec.givre.push({x:P.x,y:P.y,r:P.r*1.3,t:G.t});
    if(P.ghost&&G.t%3===0)G.trails.push({x:P.x,y:P.y,r:P.r*1.15,life:70});
    if(P.dashDmg>0)for(const e of G.en){if(e.dead||e.spawn>0||P.dashHit.includes(e))continue;if(dist2(e.x,e.y,P.x,P.y)<(e.r+P.r+6)**2){P.dashHit.push(e);hurtEnemy(e,P.dashDmg*P.dmg,P.dvx*.5,P.dvy*.5);}}
    if(P.dashing===0){P.vx*=.35;P.vy*=.35;if(P.mines)layMine(P.x,P.y);}
  }else{const m=(porte()?CUR_K:1)*(P.gon>0?1.15:1);P.vx=lerp(P.vx,G.inX*P.spd*m,.24);P.vy=lerp(P.vy,G.inY*P.spd*m,.24);}
  P.x+=P.vx;P.y+=P.vy;
  const oh=collideCircle(P,P.r*.92);if(oh){const vn=P.vx*oh[0]+P.vy*oh[1];if(vn<0){P.vx-=vn*oh[0];P.vy-=vn*oh[1];}}
  const cn=confine(P,P.r);if(cn){const vn=P.vx*cn[0]+P.vy*cn[1];if(vn>0){P.vx-=vn*cn[0]*1.6;P.vy-=vn*cn[1]*1.6;}}
  P.r=lerp(P.r,P.baseR*(P.gon>0?P.gScale:1)*(P.titan?1.12:1),P.gon>0?.12:.1);
  aimUpdate();playerFire();if(P.ctr>0)P.ctr--;
}
/* ligne de tir : un point tous les 20 u jusqu'au bord de la cible ; un obstacle solide (rocher massif, falaise) la coupe,
   un cassable non (le tirer paie) */
function lineClear(x0,y0,x1,y1,stop){const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy)||1,n=Math.floor((d-stop)/20);for(let k=1;k<n;k++){const t=k*20/d,o=pointHit(x0+dx*t,y0+dy*t,2);if(o&&!o.brk)return false;}return true;}
/* seulement ce qui est à l'écran : on ne tire jamais sur un ennemi qu'on ne voit pas. los (la visée de la bulle seule) :
   le plus proche qu'on peut TOUCHER (bc), sinon le plus proche ; la ligne n'est testée que pour un candidat plus proche
   que le meilleur à découvert. Une Blindée dont le bouclier fait face au tireur n'est pas « à découvert » (repli seulement) */
function findTarget(x,y,range,los){
  let best=null,bd=range*range,bc=null,bcd=bd;const hw=W/2/G.zoom,hh=H/2/G.zoom,off=(o,r)=>Math.abs(o.x-G.cx)>hw+r||Math.abs(o.y-G.cy)>hh+r;
  for(const e of G.en){if(e.dead||e.spawn>0||e.prey||off(e,-e.r))continue;const d=dist2(x,y,e.x,e.y);if(d<bd){bd=d;best=e;}if(los&&d<bcd&&!(e.mod==='blinde'&&Math.abs(angDiff(e.sa,Math.atan2(y-e.y,x-e.x)))<1.05)&&lineClear(x,y,e.x,e.y,e.r)){bcd=d;bc=e;}}
  for(const B of BIGS()){if(off(B,B.r*.5))continue;const d=Math.max(0,Math.hypot(x-B.x,y-B.y)-B.r*.6);if(d*d<bd){bd=d*d;best=B;}if(los&&d*d<bcd){bcd=d*d;bc=B;}}
  return los?(bc||best):best;
}
function leadAng(sx,sy,tg,spd){let tx=tg.x,ty=tg.y;const vx=tg.vx||0,vy=tg.vy||0;for(let k=0;k<2;k++){const t=Math.min(60,Math.hypot(tx-sx,ty-sy)/spd);tx=tg.x+vx*t;ty=tg.y+vy*t;}return Math.atan2(ty-sy,tx-sx);}
function aimUpdate(){
  const P=G.p;
  /* toutes les 6 images, et AUSSITÔT quand la cible meurt (avant : jusqu'à 6 images sans viser) */
  if(--G.tgtT<=0||G.tgt&&(G.tgt.dead||G.tgt.prey)){G.tgtT=6;G.tgt=findTarget(P.x,P.y,700,true);}
  if(G.tgt&&G.tgt.dead)G.tgt=null;
  let want=null;G.manual=false;
  if(G.aimMan){want=G.aimA;G.manual=true;}
  else if(G.tgt)want=leadAng(P.x,P.y,G.tgt,P.bspd);
  else if(G.inX||G.inY)want=Math.atan2(G.inY,G.inX);
  if(want!==null)P.ang+=angDiff(P.ang,want)*(G.manual?.7:.3);
}
function pbul(x,y,a,o){const P=G.p;const b={x,y,vx:Math.cos(a)*P.bspd,vy:Math.sin(a)*P.bspd,r:P.bsize,dmg:P.dmg,life:P.blife,pierce:P.pierce,rico:P.rico,split:P.split,home:P.homing,hit:null,col:COL.cy,kind:0,shard:false,tg:null,sp:0,boom:0,thru:false};
  if(o)Object.assign(b,o);if(G.pb.length<420)G.pb.push(b);return b;}
function playerFire(){
  const P=G.p;if(P.fireT>0){P.fireT--;return;}
  if(!G.manual&&!G.tgt)return;
  const ct=P.ctr>0,em=emb(),tl=2.2*(1+2*em);P.fireT+=P.fireI/(P.pu.rapid>0?2:1)/(1+em)*(ct?.7:1);
  if(em>=.15&&!G.tut.emb){G.tut.emb=1;toast('Emballement : enchaîne les éliminations, ton tir accélère.');}
  const n=P.turrets+(P.pu.triple>0?2:0),w=P.spreadW*(n>3?.85:1),thru=P.pu.pierce>0,dm=P.dmg*(P.overload&&puAny()?1.4:1);
  P.shots++;const big=P.burst>0&&P.shots%(6-P.burst)===0;
  /* critique tiré au départ (doré, ×1,3) : l'impact le reprend tel quel (updBullets → hurtEnemy/hurtBoss) */
  for(let k=0;k<n;k++){const a=P.ang+(k-(n-1)/2)*w,ox=Math.cos(a)*P.r*1.1,oy=Math.sin(a)*P.r*1.1,bg=big&&k===(n>>1),cr=ct||R()<P.crit;
    pbul(P.x+ox,P.y+oy,a,{dmg:dm*(bg?4:1),r:P.bsize*(bg?2.2:1)*(cr?1.3:1),pierce:thru||bg?99:P.pierce+(ct?1:0),thru:thru||bg,crit:cr,col:cr?COL.gd:COL.cy,tl});
    if(k===0||n<4)FX({ty:0,x:P.x+ox,y:P.y+oy,vx:Math.cos(a)*2+P.vx,vy:Math.sin(a)*2+P.vy,life:8,max:8,col:COL.wh,s:P.bsize*.9});}
  if(P.mirror){const a=P.ang+Math.PI,cr=ct||R()<P.crit;pbul(P.x+Math.cos(a)*P.r,P.y+Math.sin(a)*P.r,a,{dmg:dm*.8,thru,r:P.bsize*(cr?1.3:1),pierce:P.pierce+(ct?1:0),crit:cr,col:cr?COL.gd:COL.cy,tl});}
  P.recoil=4;SFX.shoot(P.bsize,em);
}
/* le boss est la seule « grande » cible ; ces trois noms servent aux armes de zone */
function BIGS(){const B=G.boss;return B&&bossHittable()?[B]:[];}
function hurtBig(o,d,q){if(o===G.boss)hurtBoss(d,q);}
function updWeapons(){
  const P=G.p,dm=P.dmg*(P.overload&&puAny()?1.4:1);
  if(P.aura>0){P.auraR=P.r+34+P.aura*20;if(G.t%10===0){const r2=P.auraR;for(const e of G.en){if(e.dead||e.spawn>0)continue;if(dist2(e.x,e.y,P.x,P.y)<(r2+e.r)**2)hurtEnemy(e,dm*(.35+.3*P.aura),0,0,true);}
    for(const B2 of BIGS())if(dist2(B2.x,B2.y,P.x,P.y)<(r2+B2.r)**2)hurtBig(B2,dm*(.35+.3*P.aura),true);}}
  if(P.orbs>0){const n=P.orbs,R0=P.r+30;for(let k=0;k<n;k++){const a=G.t*.07+k*TAU/n,ox=P.x+Math.cos(a)*R0,oy=P.y+Math.sin(a)*R0;
    for(const e of G.en){if(e.dead||e.spawn>0)continue;if(e.orbCd<=G.t&&dist2(ox,oy,e.x,e.y)<(e.r+8)**2){e.orbCd=G.t+10;hurtEnemy(e,dm*.9,Math.cos(a)*1.5,Math.sin(a)*1.5,true);}}
    if(G.t%10===k%10)for(const B2 of BIGS())if(dist2(ox,oy,B2.x,B2.y)<(B2.r+8)**2)hurtBig(B2,dm*.9,true);
    for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(ox,oy,b.x,b.y)<(b.r+8)**2){sparks(b.x,b.y,COL.cy,3,2,12);G.eb.splice(i,1);}}}}
  if(P.drones>0){const n=P.drones;for(let k=0;k<n;k++){if((G.t+k*9)%34!==0)continue;const a=-G.t*.025+k*TAU/n,R1=P.r+62,dx=P.x+Math.cos(a)*R1,dy=P.y+Math.sin(a)*R1;
    const tg=findTarget(dx,dy,520);if(tg){const aa=leadAng(dx,dy,tg,P.bspd);pbul(dx,dy,aa,{dmg:dm*.55,r:3.5,col:COL.pk,home:P.dronesHome?.1:0,pierce:0,split:0,rico:0});}}}
  if(P.missile>0&&++P.missileT>=Math.max(45,120-14*P.missile)){P.missileT=0;const n=1+Math.floor(P.missile/2);
    for(let k=0;k<n;k++){const a=P.ang+Math.PI+rr(-.9,.9);pbul(P.x,P.y,a,{kind:1,dmg:dm*2.2,r:5,col:COL.wh,home:.12,life:130,pierce:0,split:0,rico:0,sp:6,vx:Math.cos(a)*3,vy:Math.sin(a)*3,boom:55+8*P.missile});}
    SFX.missile();}
  if(P.nova>0&&++P.novaT>=Math.max(120,180/P.nova)){P.novaT=0;shockwave(P.x,P.y,230,dm*3,true);SFX.nova();}
  for(let i=G.trails.length-1;i>=0;i--){const tr=G.trails[i];if(--tr.life<=0){G.trails.splice(i,1);continue;}
    if(G.t%8===0)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,tr.x,tr.y)<(e.r+tr.r)**2)hurtEnemy(e,dm*.6,0,0,true);}
}
function layMine(x,y){if(G.mines.length<10)G.mines.push({x,y,t:0});}
function updMines(){const P=G.p;for(let i=G.mines.length-1;i>=0;i--){const m=G.mines[i];m.t++;let go=m.t>900;
  if(!go&&m.t>30)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,m.x,m.y)<(e.r+36)**2){go=true;break;}
  if(!go&&m.t>30){const B=G.boss;if(B&&bossHittable()&&dist2(B.x,B.y,m.x,m.y)<(B.r+36)**2)go=true;}
  if(go){explode({x:m.x,y:m.y,dmg:P.dmg*(3+2*P.mines),boom:70});G.mines.splice(i,1);}}}
/* explosions armées par une élite VOLATILE (deathFx) : 36 pas d'annonce (g3.js drawVol), puis 110 u qui blessent la bulle (un dash
   au travers : esquive parfaite, par hurtPlayer) et les ennemis (,6 × leur vie : une Volatile voisine en arme une autre) */
function updVol(){const P=G.p;for(let i=G.vol.length-1;i>=0;i--){const v=G.vol[i];if(--v.t>0)continue;G.vol.splice(i,1);
  ringFX(v.x,v.y,10,v.r,COL.rd,18,5);SFX.boom();shake(.2);
  for(const f of G.en)if(!f.dead&&f.spawn<=0&&dist2(f.x,f.y,v.x,v.y)<(v.r+f.r)**2)decorHurt(f,.6);
  if(dist2(P.x,P.y,v.x,v.y)<(v.r+P.r*.72)**2)hurtPlayer(v.x,v.y);}}
function shockwave(x,y,rad,dmg,clear){
  ringFX(x,y,10,rad,COL.wh,26,4);ringFX(x,y,10,rad*.8,COL.cy,20,8);
  for(const e of G.en){if(e.dead||e.spawn>0)continue;const d=Math.hypot(e.x-x,e.y-y)||1;if(d<rad+e.r){const f=(1-d/(rad+e.r))*8;e.vx+=(e.x-x)/d*f;e.vy+=(e.y-y)/d*f;if(dmg>0)hurtEnemy(e,dmg,0,0,true);}}
  if(clear)for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,x,y)<rad*rad){sparks(b.x,b.y,b.col,2,2,14);G.eb.splice(i,1);}}
  if(dmg>0)for(const B of BIGS())if(Math.hypot(B.x-x,B.y-y)<rad+B.r)hurtBig(B,dmg,true);
  shake(.15);
}
function explode(b){
  const rad=b.boom||60;ringFX(b.x,b.y,6,rad,COL.wh,18,4);sparks(b.x,b.y,COL.cy,14,5);SFX.boom();shake(.08);
  for(const e of G.en){if(e.dead||e.spawn>0)continue;if(dist2(e.x,e.y,b.x,b.y)<(rad+e.r)**2){const d=Math.hypot(e.x-b.x,e.y-b.y)||1;hurtEnemy(e,b.dmg,(e.x-b.x)/d*3,(e.y-b.y)/d*3,true);}}
  FX({ty:4,x:b.x,y:b.y,vx:0,vy:0,r:rad*2.2,life:14,max:14,col:COL.cy});
  for(const B of BIGS())if(dist2(B.x,B.y,b.x,b.y)<(rad+B.r)**2)hurtBig(B,b.dmg,true);
}

/* ---------- décor cassable : les obstacles moyens (o.brk, gw.js) cèdent sous tes tirs ---------- */
function hitObs(o,d){if(o.gone)return;o.hp-=d*(G.p.demol?3:1);o.hf=G.t;if(o.hp<=0)breakObs(o);else if(G.t-(o.ht||-9)>8){o.ht=G.t;sparks(o.cx,o.cy,'#ffffff',3,2,12);}}
function breakObs(o){
  dropObs(o);const i=OSPR.indexOf(o);if(i>=0)OSPR.splice(i,1);o.spr=o.s1=null;
  const col=BIO[o.b]?BIO[o.b].a:'#ffffff';shards(o.cx,o.cy,col,10+(o.R/4|0),4,o.R*.5);ringFX(o.cx,o.cy,o.R*.6,o.R*1.6,col,18,3);SFX.brk();shake(.12);G.score+=20;serKeep();
  const P=G.p;if(o.pu||P.luck&&R()<.1*P.luck)dropPU(o.cx,o.cy);
  if(P.demol)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,o.cx,o.cy)<(o.R+70+e.r)**2)hurtEnemy(e,P.dmg*4,0,0,true);
}
/* nœuds du Cœur : ils protègent les ennemis proches (relais) ; tes tirs les brisent */
function nodeHit(b){const c=getChunk(Math.floor(b.x/CH),Math.floor(b.y/CH));if(!c)return false;
  for(let i=0;i<c.live.length;i++){const it=c.live[i];if(it.t!=='node'||dist2(it.x,it.y,b.x,b.y)>=(16+b.r)**2)continue;
    if(it.hp==null)it.hp=it.mhp=Math.round(9*HPM());it.hp-=b.dmg;it.hf=G.t;
    if(it.hp<=0){c.live.splice(i,1);shards(it.x,it.y,'#ff3355',12,4,14);ringFX(it.x,it.y,10,90,'#ff3355',20,4);SFX.brk();G.score+=40;}
    return true;}
  return false;}

/* ---------- le décor mord : gueules (floral), circulation (urban), vide (sky) ----------
   Règles de TERRAIN de l'îlot (G.biome). Elles ne visent que G.en : le boss n'y est jamais, ni le joueur.
   Dégâts = fraction des PV max, appliqués hors hurtEnemy : ni critique ni bonus ne les dépassent. */
const BLOOM_T=240,BLOOM_O=60,BLOOM_R=72,BLOOM_D=.3,CAR_D=.4,CAR_K=8,SKY_KB=3.5,FALL_T=20;
/* gueule : 0 au repos, monte de 0 à 1 pendant l'ouverture (1 s) ; la morsure a lieu au tick où elle retombe à 0 */
function bloomOpen(it,t){const k=(t+Math.floor(it.ph/TAU*BLOOM_T))%BLOOM_T;return k<BLOOM_O?k/BLOOM_O:0;}
function bloomBites(it,t){return (t+Math.floor(it.ph/TAU*BLOOM_T))%BLOOM_T===BLOOM_O;}
function inBite(it,x,y,r){return dist2(it.x,it.y,x,y)<(BLOOM_R+r)**2;}
/* voiture : position au tick t (même formule que le dessin), et contact avec un cercle */
function carAt(it,t){const p=((it.ph+t*it.spd)%CH+CH)%CH;return it.vert?[it.x,it.y+p]:[it.x+p,it.y];}
function carHits(it,t,x,y,r){const q=carAt(it,t);return Math.abs(x-q[0])<(it.vert?5:10)+r&&Math.abs(y-q[1])<(it.vert?10:5)+r;}
function decorHurt(e,f){e.hp-=e.mhp*f;e.flash=4;if(e.hp<=0)killEnemy(e);}
function decorTick(){
  const D=G.dec,t=G.t,P=G.p,b=G.biome;
  D.bite=D.bite.filter(q=>t-q.t<30);D.car=D.car.filter(q=>t-q.t<30);D.givre=D.givre.filter(q=>t-q.t<GIVRE_T);
  const v=vu(P);if(v){if(!D.vu)D.vuT=t;for(const e of G.en)if(!e.dead&&!e.prey&&dist2(e.x,e.y,P.x,P.y)<SW_R*SW_R)e.alarmT=t+SW_T;}D.vu=v;
  D.relais=[];if(b==='core')for(const e of G.en){if(e.dead)continue;const n=relais(e);if(!n)continue;let q=D.relais.find(r=>r.it===n);if(!q)D.relais.push(q={it:n,pro:[]});q.pro.push(e);}
  for(let i=D.fall.length-1;i>=0;i--){const e=D.fall[i];if(--e.fall<=0){D.fall.splice(i,1);killEnemy(e);}}
  if(b!=='floral'&&b!=='urban')return;
  const cx=Math.floor(P.x/CH),cy=Math.floor(P.y/CH);
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const c=getChunk(cx+dx,cy+dy);if(!c)continue;
    for(const it of c.live){
      if(b==='floral'&&it.t==='bloom'&&bloomBites(it,t)){D.bite.push({it,x:it.x,y:it.y,r:BLOOM_R,t});
        for(const e of G.en)if(!e.dead&&!(e.spawn>0)&&!(e.fall>0)&&inBite(it,e.x,e.y,e.r))decorHurt(e,BLOOM_D);}
      else if(b==='urban'&&it.t==='car')for(const e of G.en){if(e.dead||e.spawn>0||e.fall>0||(e.carT||0)>t||!carHits(it,t,e.x,e.y,e.r))continue;
        const q=carAt(it,t),dx=it.vert?0:Math.sign(it.spd),dy=it.vert?Math.sign(it.spd):0,s=(it.vert?e.x-q[0]:e.y-q[1])>=0?1:-1,m=e.r>20?.5:1;
        e.carT=t+40;e.vx+=(dx*CAR_K+(it.vert?s*CAR_K*.5:0))*m;e.vy+=(dy*CAR_K+(it.vert?0:s*CAR_K*.5))*m;
        D.car.push({it,x:q[0],y:q[1],e,t});decorHurt(e,CAR_D);}}}
}
/* vide : un ennemi PROJETÉ contre un gouffre tombe. Recul = vitesse au-delà de sa propre allure `sp`
   (ses déplacements seuls n'y parviennent jamais : la vitesse lissée ne dépasse pas sp). Élites exclues. SKY_KB 3,5 : le dash et
   l'éclat du gonflement (4,4), l'Onde (4,9) y suffisent, le tir de base (1,3) non (test/decor.js --mesure, 02/10/2026). */
function skyFalls(e,sp,oh){
  if(G.biome!=='sky'||e.elite||Math.hypot(e.vx,e.vy)-sp<=SKY_KB||!wallNear(e.x,e.y,e.r+2))return false;
  e.fall=FALL_T;e.fdx=-oh[0];e.fdy=-oh[1];e.vx=e.vy=0;G.dec.fall.push(e);return true;
}
/* ---------- le terrain agit : courant (sea), glissade (ice), balayage (cyber), relais (core) ----------
   Le joueur n'est jamais ralenti ni blessé par le décor. Directions = hash2 de la graine de l'îlot. */
const CUR_K=1.25,ICE_DASH=16,GIVRE_T=240,SW_W=90,SW_V=1.2,SW_L=2000,SW_ABRI=60,SW_R=900,SW_T=480,SW_SP=1.3,RELAY_R=110,RELAY_M=.45;
function siteDir(i,k){const a=hash2(i,0,WD.seed^k)/4294967296*TAU;return [Math.cos(a),Math.sin(a)];}
/* tous les 12 ticks : la balise du balayage (la plus proche du centre parmi celles autour du joueur) */
function terrainTick(){
  const P=G.p,D=G.dec;
  if(G.biome!=='cyber'){D.sw=null;return;}
  let o=D.swO[0];
  if(!o){const cx=Math.floor(P.x/CH),cy=Math.floor(P.y/CH);let bd=1e18;
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const c=getChunk(cx+dx,cy+dy);if(!c)continue;
      for(const it of c.live)if(it.t==='beacon'){const d=it.x*it.x+it.y*it.y;if(d<bd){bd=d;o=it;}}}
    if(o)D.swO[0]=o;}
  if(o){const d=siteDir(0,0xC7B);D.sw={i:0,x:o.x,y:o.y,dx:d[0],dy:d[1],it:o};}else D.sw=null;
}
/* courant : l'intention du joueur est-elle portée ? (jamais de frein à contre-courant) */
function porte(){const C=G.courant;return G.biome==='sea'&&!!C&&G.inX*C.x+G.inY*C.y>0;}
/* balayage : position du milieu de la bande sur l'axe (origine = balise), au tick t ; `vu` = la règle ET le dessin */
function swS(t){return (t*SW_V)%SW_L-SW_L/2;}
function swIn(x,y){const W=G.dec.sw;return !!W&&Math.abs((x-W.x)*W.dx+(y-W.y)*W.dy-swS(G.t))<=SW_W/2;}
function vu(o){return G.biome==='cyber'&&swIn(o.x,o.y)&&!wallNear(o.x,o.y,SW_ABRI);}
/* relais : le nœud qui protège l'ennemi (centre à moins de RELAY_R), ou null */
function relais(e){if(G.biome!=='core')return null;const cx=Math.floor(e.x/CH),cy=Math.floor(e.y/CH);let best=null,bd=RELAY_R*RELAY_R;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const c=getChunk(cx+dx,cy+dy);if(!c)continue;for(const it of c.live)if(it.t==='node'){const d=dist2(it.x,it.y,e.x,e.y);if(d<bd){bd=d;best=it;}}}
  return best;}

/* ---------- projectiles ---------- */
/* frôler un tir ennemi (à moins de 16 u de la zone de touche, une fois par tir) : score, jauge (GRZ_G × gGain), deux traits blancs, un son.
   Payé quand le tir S'ÉLOIGNE de la bulle (vitesse relative), donc après son point le plus proche : un tir qui touche n'y arrive
   jamais (revue du 13/10/2026 : il traversait l'anneau un pas avant de toucher, chaque touche jouait le frôlement) */
const GRZ_G=.006;
function updBullets(){
  const P=G.p,bg=BIGS(),B=G.boss;let nsh=0;for(const q of G.eb)if(q.sh)nsh++;
  for(let i=G.pb.length-1;i>=0;i--){const b=G.pb[i];if(!b)continue;
    if(b.home>0){if(!b.tg||b.tg.dead||G.t%10===0)b.tg=findTarget(b.x,b.y,b.kind===1?600:320);
      if(b.tg){const a=Math.atan2(b.vy,b.vx),ta=Math.atan2(b.tg.y-b.y,b.tg.x-b.x),na=a+clamp(angDiff(a,ta),-b.home,b.home);let sp=Math.hypot(b.vx,b.vy);if(b.kind===1)sp=Math.min(b.sp,sp+.25);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;}}
    else if(b.kind===1&&Math.hypot(b.vx,b.vy)<b.sp){b.vx*=1.05;b.vy*=1.05;}
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.kind===1&&G.t%2===0)FX({ty:0,x:b.x,y:b.y,vx:0,vy:0,life:14,max:14,col:COL.pk,s:2.5});
    const rd=Math.hypot(b.x,b.y);
    if(rd>PR+40-b.r){
      if(b.rico>0){const nx=b.x/rd,ny=b.y/rd,vn=b.vx*nx+b.vy*ny;b.vx-=2*vn*nx;b.vy-=2*vn*ny;b.x=nx*(PR+38-b.r);b.y=ny*(PR+38-b.r);b.rico--;b.life=Math.max(b.life,24);b.hit=null;sparks(b.x,b.y,b.col,3,2,12);}
      else{if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,2,1.5,10);G.pb.splice(i,1);continue;}}
    const o=pointHit(b.x,b.y,b.r);
    if(o){
      if(b.thru){if(o.brk&&!(b.ho&&b.ho.includes(o))){(b.ho||(b.ho=[])).push(o);hitObs(o,b.dmg);}}
      else{if(o.brk)hitObs(o,b.dmg);
        if(b.rico>0){const q={x:b.x,y:b.y},n=collideCircle(q,b.r+1);if(n){const vn=b.vx*n[0]+b.vy*n[1];b.vx-=2*vn*n[0];b.vy-=2*vn*n[1];b.x=q.x;b.y=q.y;}b.rico--;b.hit=null;sparks(b.x,b.y,b.col,3,2,12);}
        else{if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,3,2,10);G.pb.splice(i,1);continue;}}}
    if(G.biome==='core'&&!b.shard&&nodeHit(b)){if(b.kind===1)explode(b);G.pb.splice(i,1);continue;}
    if(b.life<=0){if(b.kind===1)explode(b);G.pb.splice(i,1);continue;}
    let gone=false;
    if(B&&!B.dead&&B.spawn<=0){
      for(const nd of B.nodes){if(nd.dead)continue;if(dist2(b.x,b.y,nd.x,nd.y)<(nd.r+b.r)**2){hitNode(nd,b.dmg);gone=true;break;}}
      if(!gone&&dist2(b.x,b.y,B.x,B.y)<(B.r+b.r)**2){if(bossHittable())hurtBoss(b.dmg,false,b.crit);else sparks(b.x,b.y,COL.wh,3,2,10);gone=true;}}
    if(gone){if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,3,2.5,12);G.pb.splice(i,1);continue;}
    /* orbe de Pulsar (sh) : un tir le crève (et s'arrête, sauf perforation) */
    if(nsh>0)for(let j=G.eb.length-1;j>=0;j--){const q=G.eb[j];if(!q.sh||dist2(b.x,b.y,q.x,q.y)>=(q.r+b.r)**2)continue;G.eb.splice(j,1);nsh--;sparks(q.x,q.y,q.col,3,2,12);gain(.004);G.score+=3*G.isl;if(b.pierce>0)b.pierce--;else gone=true;break;}
    if(gone){if(b.kind===1)explode(b);G.pb.splice(i,1);continue;}
    for(const e of G.en){if(e.dead||e.spawn>0||e.prey)continue;const rs=e.r+b.r;if(dist2(b.x,b.y,e.x,e.y)>=rs*rs)continue;
      if(b.hit&&b.hit.includes(e))continue;
      if(b.kind===1){explode(b);gone=true;break;}
      /* recul léger (0,4 pour un tir de base, jusqu'à ×2,2 pour un gros tir ; 1,2 avant : sous le feu, l'ennemi reculait plus vite
         qu'il n'avance) : le tir tue au lieu de pousser. Dash, explosions, Onde et gonflement gardent leur poussée (SKY_KB) */
      /* Blindée : un tir de face (le point d'impact à moins de 1,05 rad de son bouclier) ×,2 et des étincelles blanches ; de dos ×1,5 */
      let dm=b.dmg;if(e.mod==='blinde'&&!b.shard){const f=Math.abs(angDiff(e.sa,Math.atan2(b.y-e.y,b.x-e.x)))<1.05;dm*=f?.2:1.5;if(f){lineSparks(b.x,b.y,Math.atan2(-b.vy,-b.vx),3,'#ffffff');SFX.shield();}}
      const sp=Math.hypot(b.vx,b.vy)||1,kb=.4*clamp(b.r/4.5,1,2.2);hurtEnemy(e,dm,b.vx/sp*kb,b.vy/sp*kb,false,b.crit);
      lineSparks(b.x,b.y,Math.atan2(-b.vy,-b.vx),3,e.col);
      if(P.chain>0&&!b.shard&&R()<P.chain){let n2=null,bd=170*170;for(const f of G.en){if(f===e||f.dead||f.spawn>0)continue;const d=dist2(f.x,f.y,e.x,e.y);if(d<bd){bd=d;n2=f;}}
        if(n2){FX({ty:6,x:e.x,y:e.y,x2:n2.x,y2:n2.y,vx:0,vy:0,life:9,max:9,col:COL.wh});hurtEnemy(n2,b.dmg*.7,0,0,true);}}
      if(b.split>0&&!b.shard)for(let k=0;k<b.split*2+1;k++)pbul(b.x,b.y,R()*TAU,{dmg:b.dmg*.4,r:Math.max(2.5,b.r*.6),life:20,shard:true,split:0,pierce:0,rico:0,home:0,hit:[e]});
      if(b.pierce>0){b.pierce--;(b.hit||(b.hit=[])).push(e);}else gone=true;
      break;}
    if(gone)G.pb.splice(i,1);
  }
  const big=P.gon>0;
  for(let i=G.eb.length-1;i>=0;i--){if(i>=G.eb.length)continue;const b=G.eb[i];
    let f=G.slowF;if(P.vortex&&dist2(b.x,b.y,P.x,P.y)<170*170)f*=.45;
    /* rot : un tir qui courbe (Orbiteur ; pince du Pulsar, jusqu'au bout de son arc, b.rt pas) */
    if(b.rot){const c=Math.cos(b.rot*f),s=Math.sin(b.rot*f),vx=b.vx*c-b.vy*s;b.vy=b.vx*s+b.vy*c;b.vx=vx;if(b.rt&&(b.rt-=f)<=0)b.rot=0;}
    b.x+=b.vx*f;b.y+=b.vy*f;b.life-=f;
    if(b.life<=0||b.x*b.x+b.y*b.y>(WR+40)**2){G.eb.splice(i,1);continue;}
    if((G.t+i)%2===0&&pointHit(b.x,b.y,b.r*.6)){sparks(b.x,b.y,b.col,2,1.5,10);G.eb.splice(i,1);continue;}
    if(G.state!=='play'||P.dead)continue;
    const rs=P.r*(big?1:.72)+b.r,d2=dist2(b.x,b.y,P.x,P.y);
    if(d2<rs*rs){if(P.dashing>0){perfect(b.x,b.y);continue;}if(big||P.pu.inv>0){sparks(b.x,b.y,COL.wh,3,2,10);G.eb.splice(i,1);continue;}
      sparks(b.x,b.y,b.col,8,3);G.eb.splice(i,1);hurtPlayer(b.x,b.y);continue;}
    if(!b.gz&&d2<(rs+16)**2&&(b.x-P.x)*(b.vx-P.vx)+(b.y-P.y)*(b.vy-P.vy)>0){b.gz=true;G.score+=5*G.isl;gain(GRZ_G);lineSparks(b.x,b.y,Math.atan2(b.y-P.y,b.x-P.x),2,'#ffffff');SFX.graze();if(!G.tut.gz){G.tut.gz=1;toast('Frôler un tir remplit la jauge.');}}
  }
}

/* ---------- fin de partie ---------- */
function die(){
  const P=G.p;G.state='dying';G.dieT=0;cv.classList.add('dying');G.timeScale=.35;P.dead=true;SFX.death();shake(1);G.glitch=40;
  shards(P.x,P.y,P.col,30,6,P.r);sparks(P.x,P.y,P.col,40,7);ringFX(P.x,P.y,P.r,P.r*8,P.col,50,5);
}
function updDying(){
  G.dieT++;const P=G.p;
  if(G.dieT<60&&G.dieT%10===0){shards(P.x+fr(-20,20),P.y+fr(-20,20),P.col,12,5,P.r);SFX.pop(true);}
  if(G.dieT===95){G.timeScale=1;endRun(false);}
}
function endRun(win){
  if(G.state==='end')return;
  G.state='end';G.win=win;
  if(win){SFX.ach();G.winBonus=10000+Math.max(0,1500-Math.floor(G.time/60))*10;G.score+=G.winBonus;}
  G.score=Math.round(G.score);
  meta.kills+=G.kills;meta.eats=(meta.eats||0)+G.eats;meta.runs++;if(win)meta.wins++;
  meta.lb.push({s:G.score,i:G.isl,w:win?1:0,t:Date.now(),d:G.time});
  meta.lb.sort((a,b)=>b.s-a.s);meta.lb=meta.lb.slice(0,10);
  G.newBest=G.score>meta.best;if(G.newBest)meta.best=G.score;
  G.newIsl=G.isl>(meta.bestIsl||0)||win&&!(meta.wins>1);if(G.isl>(meta.bestIsl||0))meta.bestIsl=G.isl;
  G.newCombo=G.comboMx>=10&&G.comboMx>(meta.bestCombo||0);meta.bestCombo=Math.max(meta.bestCombo||0,G.comboMx);
  saveMeta();setMusic(0);
  if(SIMF()){window.__SIM_END&&window.__SIM_END(win);return;}
  setTimeout(showEnd,600);
}

/* ---------- boucle de simulation ---------- */
function updFX(){
  G.trauma=Math.max(0,G.trauma-.025);if(G.glitch>0)G.glitch--;if(G.hurtT>0)G.hurtT--;if(G.flash>0)G.flash=Math.max(0,G.flash-.06);
  const P=G.p;if(P.recoil>0)P.recoil*=.7;if(P.glow>0)P.glow*=.96;G.kx*=.6;G.ky*=.6;
  {const F=G.fx;let w=0;for(let i=0;i<F.length;i++){const f=F[i];f.x+=f.vx;f.y+=f.vy;if(f.ty===0){f.vx*=.92;f.vy*=.92;}else if(f.ty===2){f.vx*=.95;f.vy*=.95;}else if(f.ty===7){f.vx*=.85;f.vy*=.85;}if(--f.life>0)F[w++]=f;}F.length=w;}
  for(let i=G.tx.length-1;i>=0;i--){const t=G.tx[i];t.y+=t.vy;t.vy*=.96;if(--t.life<=0)G.tx.splice(i,1);}
  if(G.banner&&++G.banner.t>=G.banner.max)G.banner=null;
  for(let i=G.toasts.length-1;i>=0;i--)if(++G.toasts[i].t>200)G.toasts.splice(i,1);
}
function updCam(){
  const P=G.p,T=G.tr;
  if(T){const e=x=>x*x*(3-2*x),zf=zoomFull();
    if(T.t<=TR_SNAP){const f=e(T.t/TR_SNAP);G.cx=T.cx0*(1-f);G.cy=T.cy0*(1-f);G.zoom=T.z0+(zf-T.z0)*f;}
    else if(T.t<=TR_SHRINK){G.cx=G.cy=0;G.zoom=zf;}
    else{G.cx=G.cy=0;G.zoom=zf+(zoomTarget()-zf)*e(Math.min(1,(T.t-TR_SHRINK)/(TR_END-TR_SHRINK)));}
    return;}
  /* avance de caméra : dans le sens du déplacement, lissée ; pendant le boss, elle s'écarte un peu vers lui */
  G.lvx=lerp(G.lvx||0,P.dead?0:clamp(P.vx*14,-70,70),.05);G.lvy=lerp(G.lvy||0,P.dead?0:clamp(P.vy*14,-70,70),.05);
  let tx=P.x+G.lvx,ty=P.y+G.lvy;const B=G.boss;
  if(B&&!B.gone&&!P.dead){tx=lerp(tx,B.x,.22);ty=lerp(ty,B.y,.22);}
  G.cx=lerp(G.cx,tx,.1);G.cy=lerp(G.cy,ty,.1);G.zoom=zoomTarget();
}
function savePrev(){const P=G.p;P.px=P.x;P.py=P.y;P.pang=P.ang;G.pcx=G.cx;G.pcy=G.cy;G.pzoom=G.zoom;
  const sv=a=>{for(let i=0;i<a.length;i++){const o=a[i];o.px=o.x;o.py=o.y;}};sv(G.en);sv(G.pb);sv(G.eb);sv(G.pus);sv(G.fx);
  const B=G.boss;if(B){B.px=B.x;B.py=B.y;sv(B.nodes);}if(G.heart){G.heart.px=G.heart.x;G.heart.py=G.heart.y;}}
function step(){
  G.t++;savePrev();
  if(G.freeze>0){G.freeze--;G.trauma=Math.max(0,G.trauma-.01);return;}
  if(SIMF()){if(window.__SIM_INPUT)window.__SIM_INPUT();}else readInput();
  const s=G.state;
  if(s==='play'){updPlayer();updWeapons();updEnemies();updBoss();updTele();updBullets();updPUs();updMarks();updMines();updVol();updIslet();if(G.t%12===0)terrainTick();}
  else if(s==='dying'){updEnemies();updBullets();updDying();}
  else if(s==='trans')updTrans();
  updFX();updCam();
  if(G.timeScale<1&&G.state==='play')G.timeScale=Math.min(1,G.timeScale+.01);
}
