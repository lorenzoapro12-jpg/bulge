/* =========================================================
   LOGIQUE DE JEU : un îlot = une arène = un niveau
   Arrivée (choix d'un bonus) → 3 vagues → boss → îlot nettoyé → croissance → îlot suivant.
   Chaque îlot vit dans SON repère (gw.js) : la bulle y a toujours le rayon PRAD ; ce qui grandit,
   c'est l'écart avec les anciens ennemis, qui rapetissent d'îlot en îlot (mkEnemy).
   ========================================================= */
let G=null;
/* PRAD : rayon de la bulle ; SEG0 : segments de membrane au départ ; GROW : croissance par îlot ;
   PREYA : écart d'îlots à partir duquel un type devient proie ; GONEA : écart où il quitte le jeu */
const PRAD=18,SEG0=5,NWAVE=3,GROW=1.4,PREYA=2,GONEA=4,EBC='#ff5a2d';
/* vie des ennemis selon l'îlot (le joueur, lui, progresse par ses bonus) */
const HPM=()=>Math.pow(1.24,G.isl-1);
function decor0(){return{bite:[],car:[],fall:[],givre:[],glisseT:-1,sw:null,swO:{},vu:false,vuT:-1,relais:[]};}
function mkGame(seed){return{state:'play',t:0,time:0,seed,isl:1,ph:'arrive',phT:0,islT:0,wave:0,wq:null,
  p:null,en:[],eb:[],pb:[],pus:[],fx:[],tx:[],tele:[],marks:[],mines:[],trails:[],boss:null,
  score:0,kills:0,eats:0,hits:0,maxIsl:1,islHit:false,
  trauma:0,freeze:0,glitch:0,hurtT:0,flash:0,timeScale:1,cx:0,cy:0,zoom:1,pcx:null,pcy:null,pzoom:null,
  banner:null,toasts:[],choices:[],pickIsl:0,rerolls:1,picks:[],
  win:false,tgt:null,tgtT:0,dieT:0,manual:false,slowF:1,
  inX:0,inY:0,aimMan:false,aimA:0,tut:{},tutOn:false,biome:'plains',wbn:null,
  dec:decor0(),courant:null,tr:null};}
function mkPlayer(){return{x:0,y:0,vx:0,vy:0,r:PRAD,baseR:PRAD,ang:-Math.PI/2,col:COL.cy,
  seg:SEG0,segMax:SEG0,spd:3.3,fireI:13,dmg:1,bspd:9.5,blife:60,bsize:4.5,pierce:0,turrets:1,spreadW:.16,homing:0,rico:0,split:0,crit:.03,critM:2.5,
  aura:0,auraR:0,orbs:0,drones:0,dronesHome:false,missile:0,missileT:0,nova:0,novaT:0,mines:0,
  dashMax:84,dashT:0,dashing:0,dvx:0,dvy:0,dashDmg:0,dashHit:[],ghost:false,
  inv:0,fireT:0,flash:0,recoil:0,glow:0,shots:0,
  gauge:0,gon:0,gonMax:1,gGain:1,gDur:240,gScale:2,
  pu:{},puMax:{},puDur:1,luck:0,magnet:0,regen:0,regenT:0,digest:0,digN:0,
  mirror:0,chain:0,burst:0,riposte:0,second:0,secUsed:false,trophy:0,echo:0,glouton:0,appetit:0,overload:0,demol:0,
  vortex:false,titan:false,hole:false,noDash:false,noRegen:false,cards:{},dead:false};}

/* ---------- effets ---------- */
function shake(a){G.trauma=Math.min(1,G.trauma+a*(REDUCED?.3:1));}
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
  const k=G.isl,P=G.p;G.biome=ISL[k-1];setBiome(G.biome);
  G.ph='arrive';G.phT=0;G.islT=0;G.wave=0;G.wq=null;G.en=[];G.eb=[];G.pb=[];G.pus=[];G.tele=[];G.marks=[];G.mines=[];G.trails=[];G.boss=null;G.wbn=null;
  G.dec=decor0();G.courant=null;if(G.biome==='sea'){const d=siteDir(0,0x5EA);G.courant={x:d[0],y:d[1]};}
  P.x=P.y=0;P.vx=P.vy=0;P.secUsed=false;P.dashing=0;G.cx=G.cy=0;G.zoom=zoomTarget();G.pcx=G.pcy=G.pzoom=null;G.lvx=G.lvy=0;
  prewarm(0,0,WR+60);for(const c of WD.bakes)c.used=0;
  G.maxIsl=Math.max(G.maxIsl,k);G.islHit=false;
}
function arriveBanner(){const b=BIO[G.biome];banner(b.n,'Îlot '+G.isl+' sur '+NISL+' · '+b.sub,b.a,170);
  if(G.isl===1&&G.tutOn)toast(inp.touch?'Pouce gauche : bouger. Le tir est automatique.':'ZQSD ou flèches : bouger. Le tir est automatique.');}
/* déroulé d'un îlot (G.ph) : arrive → wave (×3, séparées par pause) → preboss → boss → clear */
function updIslet(){
  G.phT++;G.islT++;
  switch(G.ph){
    case 'arrive':if(G.phT===20&&G.pickIsl!==G.isl){openPick();if(G.state!=='play')return;}if(G.phT>=150)waveStart(1);break;
    case 'wave':waveTick();break;
    case 'pause':if(G.phT>=100)waveStart(G.wave+1);break;
    case 'preboss':if(G.phT>=100)spawnBoss();break;
    case 'clear':clearTick();break;
  }
  if(G.wbn&&++G.wbn.t>150)G.wbn=null;
}
function waveStart(w){
  const k=G.isl,n=3+2*w+k;G.wave=w;G.ph='wave';G.phT=0;
  G.wq={left:n,n,el:Math.ceil(n*.55),eld:false,prey:k>=PREYA+1?Math.round(n*.5):0,nextT:0};
  G.wbn={w,t:0};SFX.wave();
  if(w===2&&k===1&&G.tutOn)toast(inp.touch?'Bouton ⚡ : dash. Tu es invulnérable pendant.':'Espace ou Maj : dash. Tu es invulnérable pendant.');
}
function waveTick(){
  const Q=G.wq,k=G.isl;let alive=0;for(const e of G.en)if(!e.dead&&!e.prey)alive++;
  const cap=3+Math.ceil(k*.8);
  if((Q.left>0||Q.prey>0&&Q.left<Q.n)&&G.marks.length<2&&G.phT>=Q.nextT&&(alive<cap||G.phT>=Q.nextT+300)){spawnGroup();Q.nextT=G.phT+Math.round(rr(60,120));}
  if(Q.left<=0&&!G.marks.some(m=>!m.prey)&&alive===0){G.score+=100*k*G.wave;
    if(G.wave<NWAVE){G.ph='pause';G.phT=0;}else{G.ph='preboss';G.phT=0;G.marks=[];}}
}
/* un groupe annoncé : une marque au sol une demi-seconde, puis les ennemis sur le bord de l'îlot */
function spawnGroup(){
  const Q=G.wq,k=G.isl,P=G.p;let t,n,prey=false;
  const pt=[];for(let a=PREYA;a<GONEA;a++)if(k-a>=1)pt.push(ETL[k-a-1]);
  if(Q.prey>0&&pt.length&&(Q.left<=0||R()<.34)){t=pick(pt);prey=true;n=Math.min(Q.prey,t==='mite'?5:3);Q.prey-=n;}
  else{if(Q.left<=0)return;t=k>=2&&R()<.36?ETL[k-2]:ETL[k-1];const big=ET[t].r>=19;n=Math.min(Q.left,t==='mite'?4:big?1:2+(R()<.4?1:0));Q.left-=n;}
  let x=0,y=0,ok=false;
  for(let tr=0;tr<24&&!ok;tr++){const a=R()*TAU,r=tr<16?PR-110:PR-260;x=Math.cos(a)*r;y=Math.sin(a)*r;ok=dist2(x,y,P.x,P.y)>(tr<16?460:300)**2&&!wallNear(x,y,56)&&!pointHit(x,y,44);}
  let el=0;if(!prey&&!Q.eld&&Q.n-Q.left>=Q.el){Q.eld=true;el=1;}
  G.marks.push({x,y,t:0,max:prey?24:34,t2:t,n,prey,el,col:ET[t].col});
}
function updMarks(){
  for(let i=G.marks.length-1;i>=0;i--){const m=G.marks[i];if(++m.t<m.max)continue;G.marks.splice(i,1);
    for(let j=0;j<m.n;j++){const a=R()*TAU,d=j?rr(16,46):0;let x=m.x+Math.cos(a)*d,y=m.y+Math.sin(a)*d;if(pointHit(x,y,ET[m.t2].r)){x=m.x;y=m.y;}
      mkEnemy(m.t2,x,y,{elite:m.el&&j===0?1:0});}
    if(m.prey&&!G.tut.prey){G.tut.prey=1;toast('Plus petits que toi : des proies. Avale-les !');}}
}
/* îlot nettoyé : le boss est tombé */
function islClear(){
  G.ph='clear';G.phT=0;G.eb=[];G.tele=[];G.marks=[];G.wq=null;
  for(const e of G.en)if(!e.dead){e.dead=true;shards(e.x,e.y,e.col,5,3,e.r);G.score+=10;}G.en=[];
}
function clearTick(){
  const P=G.p;if(G.phT===50)G.timeScale=1;
  for(const q of G.pus)q.life=Math.min(q.life,90);
  if(G.phT===110){if(!P.noRegen&&P.seg<P.segMax){P.seg++;SFX.seg();ringFX(P.x,P.y,P.r,P.r*3,COL.cy,24,4);ftext(P.x,P.y-P.r-14,'+1 segment',COL.cy,16);}
    G.score+=500*G.isl;if(!G.islHit){G.score+=1000*G.isl;toast('Îlot sans une égratignure');}}
  if(G.phT>=180){if(G.isl>=NISL){G.win=true;endRun(true);}else transStart();}
}
/* ---------- croissance : la bulle gonfle, l'îlot rapetisse jusqu'à devenir la relique du suivant ----------
   0-60 : caméra au centre, recul jusqu'à voir l'îlot entier, la bulle gonfle (×GROW) ;
   60 : copie d'écran (g3.js trSnap), îlot suivant généré, la bulle reprend PRAD dans le nouveau repère ;
   60-150 : la copie rétrécit jusqu'au disque de la relique (g3.js drawTrSnap) ; 150-210 : la caméra revient. */
const TR_SNAP=60,TR_SHRINK=150,TR_END=210;
function transStart(){G.state='trans';G.tr={t:0,z0:G.zoom,cx0:G.cx,cy0:G.cy,x0:G.p.x,y0:G.p.y};G.pus=[];G.trauma=0;SFX.grow();}
function updTrans(){
  const T=G.tr,P=G.p;T.t++;P.vx=P.vy=0;P.dashing=0;G.trauma=0;
  if(T.t<=TR_SNAP){const f=T.t/TR_SNAP,e=f*f*(3-2*f);P.x=T.x0*(1-e);P.y=T.y0*(1-e);P.r=lerp(P.r,P.baseR*GROW,.08);P.ang+=.05;}
  if(T.t===TR_SNAP){if(typeof trSnap==='function')trSnap();genIslet(G.seed,G.isl+1);G.isl++;islStart();P.r=P.baseR*GROW;G.cx=G.cy=0;}
  if(T.t>TR_SNAP)P.r=lerp(P.r,P.baseR,.05);
  if(T.t>=TR_END){G.tr=null;G.state='play';G.ph='arrive';G.phT=0;P.r=P.baseR;}
}
/* zoom fixe pendant un îlot : le cache du sol (g3.js solDraw) sert à chaque image */
function zoomTarget(){return Math.min(W,H)/(W<H?560:720);}
function zoomFull(){return Math.min(W,H)/(2*(WR+40));}

/* ---------- ennemis ---------- */
/* age = îlots écoulés depuis l'arrivée du type : taille ÷1,4 par îlot ; à PREYA, proie */
function mkEnemy(t,x,y,o){const d=ET[t],age=o&&o.age!=null?o.age:G.isl-d.isl,prey=age>=PREYA;
  const e={t,d,age,prey,col:d.col,x,y,vx:0,vy:0,r:d.r*Math.pow(GROW,-age),hp:d.hp*HPM()*(prey?.6:1),mhp:0,spawn:24,cd:rr(60,130),st:0,st2:0,ca:0,ta:0,tele:0,flash:0,
    wob:R()*TAU,wa:R()*TAU,dead:false,kids:0,made:0,parent:null,elite:0,sl:0,sn:null,frostT:0,alarmT:0,ivT:0,orbCd:0,dir:0};
  if(o)Object.assign(e,o);
  if(e.elite){e.hp*=3.2;e.r*=1.3;}
  e.mhp=e.hp;G.en.push(e);return e;}
function confine(o,r){const dx=o.x,dy=o.y,d=Math.hypot(dx,dy),lim=PR-r;if(d>lim&&d>0){o.x=dx/d*lim;o.y=dy/d*lim;return[dx/d,dy/d];}return null;}
function ebul(x,y,a,s,r,col){s*=1+.025*(G.isl-1);const b={x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r,col:col||EBC,life:420,rot:0,gz:false};if(G.eb.length<600)G.eb.push(b);return b;}
function ebulE(e,a,s){return ebul(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8,a,s,Math.max(4.5,e.r*.32),EBC);}
function hurtEnemy(e,dmg,kx,ky,quiet){
  if(e.dead||e.spawn>0)return;if(relais(e)){dmg*=RELAY_M;e.relT=G.t;}
  if(R()<G.p.crit){dmg*=G.p.critM;e.crit=G.t;}
  e.hp-=dmg;e.flash=4;
  if(kx&&!(e.t==='spike'&&e.st===2)){const m=e.r>20?.35:1;e.vx+=kx*m;e.vy+=ky*m;}
  if(!quiet)SFX.hit();
  if(e.hp<=0)killEnemy(e);
}
function gain(v){const P=G.p;if(P.gon>0)return;const was=P.gauge<1;P.gauge=Math.min(1,P.gauge+v*P.gGain);
  if(was&&P.gauge>=1){SFX.evo();ringFX(P.x,P.y,P.r,P.r*2.4,COL.wh,18,3);if(!G.tut.gon){G.tut.gon=1;toast(inp.touch?'Jauge pleine : bouton ◉ pour gonfler !':'Jauge pleine : E ou clic droit pour gonfler !');}}}
function killEnemy(e){
  if(e.dead)return;e.dead=true;if(e.parent&&!e.parent.dead)e.parent.kids--;
  const P=G.p;G.kills++;G.score+=e.d.sc*(e.elite?4:1)*(e.prey?.5:1);gain(e.elite?.12:e.prey?.02:.035);
  if(e.elite){dropPU(e.x,e.y);if(P.luck&&R()<.3*P.luck)dropPU(e.x,e.y);if(P.trophy&&P.seg<P.segMax){P.seg++;SFX.seg();}}
  FX({ty:4,x:e.x,y:e.y,vx:0,vy:0,r:e.r*7,life:14,max:14,col:e.col});
  shards(e.x,e.y,e.col,6+Math.floor(e.r/3),3+e.r*.08,e.r);sparks(e.x,e.y,e.col,8,4);ringFX(e.x,e.y,e.r,e.r*2.4,e.col,18,3);
  const big=e.r>=20;SFX.pop(big);
  if(big){shake(.22);if(G.t-(G.lastFz||-99)>40){G.freeze=Math.max(G.freeze,2);G.lastFz=G.t;}}else shake(.05);
}
/* avaler : une proie (ou n'importe quel ennemi plus petit que toi quand tu es gonflé) */
function absorb(e){
  if(e.dead)return;e.dead=true;if(e.parent&&!e.parent.dead)e.parent.kids--;const P=G.p;
  G.eats++;G.score+=e.prey?25:e.d.sc;gain((e.prey?.075:.04)*(1+.4*P.glouton));
  if(P.digest&&++P.digN>=12){P.digN=0;if(P.seg<P.segMax){P.seg++;SFX.seg();ftext(P.x,P.y-P.r-14,'+1 segment',COL.cy,15);}}
  if(e.elite)dropPU(e.x,e.y);
  FX({ty:5,x:e.x,y:e.y,vx:(P.x-e.x)/12,vy:(P.y-e.y)/12,r:e.r,life:12,max:12,col:e.col});
  SFX.absorb();P.glow=Math.min(1,P.glow+.25);
}
/* proie : erre, puis fuit dès que tu approches (moins vite que toi) */
function preyMove(e,tf){
  const P=G.p,dx=e.x-P.x,dy=e.y-P.y,d=Math.hypot(dx,dy)||1;e.wob+=.05;let tx,ty,sp;
  if(d<360){tx=dx/d+Math.cos(e.wob)*.35;ty=dy/d+Math.sin(e.wob)*.35;sp=P.spd*.7;}
  else{e.wa+=rr(-.1,.1);tx=Math.cos(e.wa);ty=Math.sin(e.wa);sp=.8;}
  const tl=Math.hypot(tx,ty)||1;e.vx=lerp(e.vx,tx/tl*sp,.1);e.vy=lerp(e.vy,ty/tl*sp,.1);
  if(P.glouton&&d<P.r+e.r+90*P.glouton){e.vx-=dx/d*1.1;e.vy-=dy/d*1.1;}
  e.x+=e.vx*tf;e.y+=e.vy*tf;
  const oh=collideCircle(e,e.r);if(oh)e.wa=Math.atan2(oh[1],oh[0]);
  if(confine(e,e.r))e.wa+=Math.PI;
}
function updEnemy(e){
  if(e.spawn>0){e.spawn--;return;}
  if(e.flash>0)e.flash--;
  const tf=G.slowF*(e.frostT>G.t?.45:1);
  if(e.prey){preyMove(e,tf);return;}
  const P=G.p,d=e.d,dx=P.x-e.x,dy=P.y-e.y,dd=Math.hypot(dx,dy)||1,ax=dx/dd,ay=dy/dd,aP=Math.atan2(dy,dx);
  let tx=0,ty=0,sp=d.spd*(e.alarmT>G.t?SW_SP:1);
  e.wob+=.03*tf;
  const fire=()=>(e.cd-=tf)<=0;
  switch(e.t){
    case 'mite':tx=ax+Math.cos(e.wob*3)*.45;ty=ay+Math.sin(e.wob*3)*.45;break;
    case 'spread':{const s=dd>300?1:dd<220?-1:0;tx=ax*s-ay*.5;ty=ay*s+ax*.5;
      if(fire()){e.cd=rr(100,140);for(let k=-1;k<=1;k++)ebulE(e,aP+k*.22,3);SFX.eshot();}break;}
    case 'spike':
      if(e.st===0){tx=ax*.4+Math.cos(e.wob)*.3;ty=ay*.4+Math.sin(e.wob)*.3;if(fire()&&dd<460){e.st=1;e.st2=40;}}
      else if(e.st===1){sp=0;e.ca=aP;if((e.st2-=tf)<=0){e.st=2;e.st2=34;}}
      else{sp=6.2;tx=Math.cos(e.ca);ty=Math.sin(e.ca);if((e.st2-=tf)<=0){e.st=0;e.cd=rr(60,110);}}break;
    case 'orbit':{if(!e.dir)e.dir=R()<.5?1:-1;if((e.st2-=tf)<=0){e.st2=rr(90,170);e.dir*=-1;}const s=clamp((dd-210)/60,-1,1);tx=ax*s-ay*e.dir;ty=ay*s+ax*e.dir;if(e.st2<30)sp*=.25;
      if(fire()){e.cd=rr(70,95);ebulE(e,aP,3.2);SFX.eshot();}break;}
    case 'ring':tx=ax*.3+Math.cos(e.wob)*.5;ty=ay*.3+Math.sin(e.wob)*.5;
      if(fire()){e.cd=rr(130,160);const n=12,o=R()*TAU,g=R()*TAU;for(let k=0;k<n;k++){const a=o+k*TAU/n;if(Math.abs(angDiff(a,g))<.5)continue;ebulE(e,a,2.2);}SFX.bshot();}break;
    case 'sniper':{const s=dd>420?1:dd<300?-1:0;tx=ax*s+Math.cos(e.wob)*.3;ty=ay*s+Math.sin(e.wob)*.3;
      if(e.tele>0){sp*=.2;e.tele-=tf;e.ta+=angDiff(e.ta,aP)*.045;if(e.tele<=0){e.tele=0;ebulE(e,e.ta,9);SFX.snipe();}}
      else if(fire()){e.cd=rr(150,200);e.tele=60;e.ta=aP;SFX.tele();}break;}
    case 'gatling':tx=ax*.2;ty=ay*.2;
      if(e.st>0){const f=1-e.st/40;if(Math.round(e.st)%5===0)ebulE(e,e.ca-.5+f,3.6);if(Math.round(e.st)%15===0)SFX.eshot();e.st-=tf;if(e.st<=0)e.st=0;}
      else if(fire()){e.cd=rr(140,180);e.st=40;e.ca=aP;}break;
    case 'spawner':tx=Math.cos(e.wob*.7);ty=Math.sin(e.wob*.9);
      if(fire()){e.cd=rr(170,220);if(e.kids<5&&e.made<8&&G.en.length<40)for(let k=0;k<2;k++){e.made++;const a=R()*TAU;mkEnemy('mite',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,{age:0,spawn:10,parent:e});e.kids++;}}break;
  }
  if(e.sl>0&&e.sn){e.sl--;const n=e.sn,sg=(tx*-n[1]+ty*n[0])>=0?1:-1;tx+=-n[1]*sg*.9;ty+=n[0]*sg*.9;}
  const tl=Math.hypot(tx,ty)||1;
  if(e.t==='spike'&&e.st===2){e.vx=tx*sp;e.vy=ty*sp;if(G.t%2===0)FX({ty:3,x:e.x,y:e.y,vx:0,vy:0,r:e.r,life:12,max:12,col:e.col});}
  else{e.vx=lerp(e.vx,tx/tl*sp,.08);e.vy=lerp(e.vy,ty/tl*sp,.08);}
  e.x+=e.vx*tf;e.y+=e.vy*tf;
  const oh=collideCircle(e,e.r);
  if(oh&&skyFalls(e,sp,oh))return;
  if(oh){const vn=e.vx*oh[0]+e.vy*oh[1];if(vn<0){e.vx-=vn*oh[0];e.vy-=vn*oh[1];}e.sl=20;e.sn=oh;if(e.t==='spike'&&e.st===2){e.st=0;e.cd=60;}}
  if(confine(e,e.r)&&e.t==='spike'&&e.st===2){e.st=0;e.cd=60;}
}
function updEnemies(){
  const P=G.p,D=G.dec;
  for(let i=0;i<G.en.length;i++){const e=G.en[i];if(e.dead)continue;updEnemy(e);}
  const n=G.en.length;
  for(let i=0;i<n;i++){const a=G.en[i];if(a.dead)continue;for(let j=i+1;j<n;j++){const b=G.en[j];if(b.dead)continue;const dx=b.x-a.x,dy=b.y-a.y,rs=a.r+b.r,d2=dx*dx+dy*dy;
    if(d2<rs*rs&&d2>.01){const d=Math.sqrt(d2),o=(rs-d)*.5/d;a.x-=dx*o;a.y-=dy*o;b.x+=dx*o;b.y+=dy*o;}}}
  /* givre (Glacier) : la traînée du dash glissé ralentit les ennemis qui la traversent */
  if(D.givre.length)for(const e of G.en){if(e.dead||e.spawn>0)continue;for(const q of D.givre)if(dist2(e.x,e.y,q.x,q.y)<(q.r+e.r)**2){if(e.frostT<=G.t)sparks(e.x,e.y,'#b5f3ff',3,2,14);e.frostT=G.t+90;break;}}
  /* Trou noir : gonflé, tu aspires les ennemis proches */
  if(P.gon>0&&P.hole)for(const e of G.en){if(e.dead||e.spawn>0)continue;const dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1;if(d<340){e.vx+=dx/d*.7;e.vy+=dy/d*.7;e.x+=dx/d*1.6;e.y+=dy/d*1.6;}}
  if(G.state==='play'&&!P.dead)for(const e of G.en){if(e.dead||e.spawn>0||e.fall>0)continue;const d2=dist2(e.x,e.y,P.x,P.y);
    if(e.prey){if(d2<(P.r+e.r+6+30*P.glouton)**2)absorb(e);continue;}
    const rs=e.r+P.r*.85;if(d2>=rs*rs)continue;
    if(P.gon>0&&e.r<P.r){absorb(e);continue;}
    if(P.appetit&&e.hp<e.mhp*.3&&e.r<P.r*1.1){absorb(e);continue;}
    const dx=P.x-e.x,dy=P.y-e.y,d=Math.sqrt(d2)||1,o=rs-d;
    if(P.gon>0||P.pu.inv>0){if(e.ivT<=G.t){e.ivT=G.t+8;hurtEnemy(e,P.dmg*4,-dx/d*3,-dy/d*3,true);}e.x-=dx/d*o;e.y-=dy/d*o;continue;}
    if(P.dashing>0||P.inv>0){e.x-=dx/d*o*.5;e.y-=dy/d*o*.5;continue;}
    hurtPlayer(e.x,e.y);
    if(e.t==='mite')killEnemy(e);else{P.x+=dx/d*o*.5;P.y+=dy/d*o*.5;e.x-=dx/d*o*.5;e.y-=dy/d*o*.5;}}
  decorTick();
  G.en=G.en.filter(e=>!e.dead&&!(e.fall>0));
}

/* ---------- joueur ---------- */
function hurtPlayer(sx,sy){
  const P=G.p;if(G.state!=='play'||P.inv>0||P.dashing>0||P.dead||P.gon>0||P.pu.inv>0)return;
  if(P.pu.shield>0){delete P.pu.shield;P.inv=45;SFX.shield();ringFX(P.x,P.y,P.r*1.2,P.r*3.4,COL.wh,20,4);clearNear(120);return;}
  P.seg--;G.islHit=true;G.hits++;
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
  P.glisse=G.biome==='ice';P.dashing=P.glisse?ICE_DASH:12;if(P.glisse)G.dec.glisseT=G.t;P.dashT=P.dashMax;P.dvx=dx*P.spd*3.6;P.dvy=dy*P.spd*3.6;P.inv=Math.max(P.inv,P.dashing+4);P.dashHit=[];SFX.dash();
  ringFX(P.x,P.y,P.r,P.r*2.2,P.col,14,3);if(P.echo)clearNear(160);if(P.mines)layMine(P.x,P.y);
}
/* Gonfler : jauge pleine. La bulle double, devient invulnérable et avale ce qui est plus petit qu'elle ; à la fin, elle éclate. */
function tryGonfle(){
  if(!G||G.state!=='play')return;const P=G.p;if(P.gauge<1||P.gon>0||P.dead)return;
  P.gauge=0;P.gon=P.gonMax=P.gDur;SFX.gonfle();shake(.35);G.glitch=Math.max(G.glitch,10);
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
  }else{const m=porte()?CUR_K:1;P.vx=lerp(P.vx,G.inX*P.spd*m,.16);P.vy=lerp(P.vy,G.inY*P.spd*m,.16);}
  P.x+=P.vx;P.y+=P.vy;
  const oh=collideCircle(P,P.r*.92);if(oh){const vn=P.vx*oh[0]+P.vy*oh[1];if(vn<0){P.vx-=vn*oh[0];P.vy-=vn*oh[1];}}
  const cn=confine(P,P.r);if(cn){const vn=P.vx*cn[0]+P.vy*cn[1];if(vn>0){P.vx-=vn*cn[0]*1.6;P.vy-=vn*cn[1]*1.6;}}
  P.r=lerp(P.r,P.baseR*(P.gon>0?P.gScale:1)*(P.titan?1.12:1),P.gon>0?.12:.1);
  aimUpdate();playerFire();
}
function findTarget(x,y,range){
  let best=null,bd=range*range;
  for(const e of G.en){if(e.dead||e.spawn>0)continue;let d=dist2(x,y,e.x,e.y);if(e.prey)d*=9;if(d<bd){bd=d;best=e;}}
  for(const B of BIGS()){const d=Math.max(0,Math.hypot(x-B.x,y-B.y)-B.r*.6);if(d*d<bd){bd=d*d;best=B;}}
  return best;
}
function leadAng(sx,sy,tg,spd){let tx=tg.x,ty=tg.y;const vx=tg.vx||0,vy=tg.vy||0;for(let k=0;k<2;k++){const t=Math.min(60,Math.hypot(tx-sx,ty-sy)/spd);tx=tg.x+vx*t;ty=tg.y+vy*t;}return Math.atan2(ty-sy,tx-sx);}
function aimUpdate(){
  const P=G.p;
  if(--G.tgtT<=0){G.tgtT=6;G.tgt=findTarget(P.x,P.y,700);}
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
  P.fireT+=P.fireI/(P.pu.rapid>0?2:1);
  const n=P.turrets+(P.pu.triple>0?2:0),w=P.spreadW*(n>3?.85:1),thru=P.pu.pierce>0,dm=P.dmg*(P.overload&&puAny()?1.4:1);
  P.shots++;const big=P.burst>0&&P.shots%(6-P.burst)===0;
  for(let k=0;k<n;k++){const a=P.ang+(k-(n-1)/2)*w,ox=Math.cos(a)*P.r*1.1,oy=Math.sin(a)*P.r*1.1,bg=big&&k===(n>>1);
    pbul(P.x+ox,P.y+oy,a,{dmg:dm*(bg?4:1),r:P.bsize*(bg?2.2:1),pierce:thru||bg?99:P.pierce,thru:thru||bg});
    if(k===0||n<4)FX({ty:0,x:P.x+ox,y:P.y+oy,vx:Math.cos(a)*2+P.vx,vy:Math.sin(a)*2+P.vy,life:8,max:8,col:COL.wh,s:P.bsize*.9});}
  if(P.mirror){const a=P.ang+Math.PI;pbul(P.x+Math.cos(a)*P.r,P.y+Math.sin(a)*P.r,a,{dmg:dm*.8,thru});}
  P.recoil=4;SFX.shoot();
}
/* le boss est la seule « grande » cible ; ces trois noms servent aux armes de zone */
function BIGS(){const B=G.boss;return B&&bossHittable()?[B]:[];}
function bigHittable(o){return o===G.boss&&bossHittable();}
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
function hitObs(o,d){if(o.gone)return;o.hp-=d*(G.p.demol?3:1);o.flash=4;if(o.hp<=0)breakObs(o);else if(G.t-(o.ht||-9)>8){o.ht=G.t;sparks(o.cx,o.cy,'#ffffff',3,2,12);}}
function breakObs(o){
  dropObs(o);const i=OSPR.indexOf(o);if(i>=0)OSPR.splice(i,1);o.spr=null;
  const col=BIO[o.b]?BIO[o.b].a:'#ffffff';shards(o.cx,o.cy,col,10+(o.R/4|0),4,o.R*.5);ringFX(o.cx,o.cy,o.R*.6,o.R*1.6,col,18,3);SFX.brk();shake(.12);G.score+=20;
  const P=G.p;if(o.pu||P.luck&&R()<.1*P.luck)dropPU(o.cx,o.cy);
  if(P.demol)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,o.cx,o.cy)<(o.R+70+e.r)**2)hurtEnemy(e,P.dmg*4,0,0,true);
}
/* nœuds du Cœur : ils protègent les ennemis proches (relais) ; tes tirs les brisent */
function nodeHit(b){const c=getChunk(Math.floor(b.x/CH),Math.floor(b.y/CH));if(!c)return false;
  for(let i=0;i<c.live.length;i++){const it=c.live[i];if(it.t!=='node'||dist2(it.x,it.y,b.x,b.y)>=(16+b.r)**2)continue;
    if(it.hp==null)it.hp=it.mhp=Math.round(9*HPM());it.hp-=b.dmg;it.flash=4;
    if(it.hp<=0){c.live.splice(i,1);shards(it.x,it.y,'#ff3355',12,4,14);ringFX(it.x,it.y,10,90,'#ff3355',20,4);SFX.brk();G.score+=40;}
    return true;}
  return false;}

/* ---------- le décor mord : gueules (floral), circulation (urban), vide (sky) ----------
   Règles de TERRAIN de l'îlot (G.biome). Elles ne visent que G.en : le boss n'y est jamais, ni le joueur.
   Dégâts = fraction des PV max, appliqués hors hurtEnemy : ni critique ni bonus ne les dépassent. */
const BLOOM_T=240,BLOOM_O=60,BLOOM_R=72,BLOOM_D=.3,CAR_D=.4,CAR_K=8,SKY_KB=4.5,FALL_T=20;
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
   (ses déplacements seuls n'y parviennent jamais : la vitesse lissée ne dépasse pas sp). Élites exclues. */
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
function updBullets(){
  const P=G.p,bg=BIGS(),B=G.boss;
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
      if(!gone&&dist2(b.x,b.y,B.x,B.y)<(B.r+b.r)**2){if(bossHittable())hurtBoss(b.dmg);else sparks(b.x,b.y,COL.wh,3,2,10);gone=true;}}
    if(gone){if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,3,2.5,12);G.pb.splice(i,1);continue;}
    for(const e of G.en){if(e.dead||e.spawn>0)continue;const rs=e.r+b.r;if(dist2(b.x,b.y,e.x,e.y)>=rs*rs)continue;
      if(b.hit&&b.hit.includes(e))continue;
      if(b.kind===1){explode(b);gone=true;break;}
      const sp=Math.hypot(b.vx,b.vy)||1;hurtEnemy(e,b.dmg,b.vx/sp*1.2,b.vy/sp*1.2);
      sparks(b.x,b.y,b.col,4,2.8,14);
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
    if(b.rot){const c=Math.cos(b.rot*f),s=Math.sin(b.rot*f),vx=b.vx*c-b.vy*s;b.vy=b.vx*s+b.vy*c;b.vx=vx;}
    b.x+=b.vx*f;b.y+=b.vy*f;b.life-=f;
    if(b.life<=0||b.x*b.x+b.y*b.y>(WR+40)**2){G.eb.splice(i,1);continue;}
    if((G.t+i)%2===0&&pointHit(b.x,b.y,b.r*.6)){sparks(b.x,b.y,b.col,2,1.5,10);G.eb.splice(i,1);continue;}
    if(G.state!=='play'||P.dead)continue;
    const rs=P.r*(big?1:.72)+b.r,d2=dist2(b.x,b.y,P.x,P.y);
    if(d2<rs*rs){if(P.dashing>0)continue;if(big||P.pu.inv>0){sparks(b.x,b.y,COL.wh,3,2,10);G.eb.splice(i,1);continue;}
      sparks(b.x,b.y,b.col,8,3);G.eb.splice(i,1);hurtPlayer(b.x,b.y);continue;}
    if(!b.gz&&d2<(rs+16)**2){b.gz=true;G.score+=2;}
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
  if(win){G.winBonus=10000+Math.max(0,1500-Math.floor(G.time/60))*10;G.score+=G.winBonus;}
  G.score=Math.round(G.score);
  meta.kills+=G.kills;meta.eats=(meta.eats||0)+G.eats;meta.runs++;if(win)meta.wins++;
  meta.lb.push({s:G.score,i:G.isl,w:win?1:0,t:Date.now(),d:G.time});
  meta.lb.sort((a,b)=>b.s-a.s);meta.lb=meta.lb.slice(0,10);
  G.newBest=G.score>meta.best;if(G.newBest)meta.best=G.score;
  G.newIsl=G.isl>(meta.bestIsl||0)||win&&!(meta.wins>1);if(G.isl>(meta.bestIsl||0))meta.bestIsl=G.isl;
  saveMeta();setMusic(0);
  if(SIMF()){window.__SIM_END&&window.__SIM_END(win);return;}
  setTimeout(showEnd,600);
}

/* ---------- boucle de simulation ---------- */
function updFX(){
  G.trauma=Math.max(0,G.trauma-.025);if(G.glitch>0)G.glitch--;if(G.hurtT>0)G.hurtT--;if(G.flash>0)G.flash=Math.max(0,G.flash-.06);
  const P=G.p;if(P.recoil>0)P.recoil*=.7;if(P.glow>0)P.glow*=.96;
  {const F=G.fx;let w=0;for(let i=0;i<F.length;i++){const f=F[i];f.x+=f.vx;f.y+=f.vy;if(f.ty===0){f.vx*=.92;f.vy*=.92;}else if(f.ty===2){f.vx*=.95;f.vy*=.95;}if(--f.life>0)F[w++]=f;}F.length=w;}
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
  const B=G.boss;if(B){B.px=B.x;B.py=B.y;sv(B.nodes);}}
function step(){
  G.t++;savePrev();
  if(G.freeze>0){G.freeze--;G.trauma=Math.max(0,G.trauma-.01);return;}
  if(SIMF()){if(window.__SIM_INPUT)window.__SIM_INPUT();}else readInput();
  const s=G.state;
  if(s==='play'){updPlayer();updWeapons();updEnemies();updBoss();updTele();updBullets();updPUs();updMarks();updMines();updIslet();if(G.t%12===0)terrainTick();}
  else if(s==='dying'){updEnemies();updBullets();updDying();}
  else if(s==='trans')updTrans();
  updFX();updCam();
  if(G.timeScale<1&&G.state==='play')G.timeScale=Math.min(1,G.timeScale+.01);
}
