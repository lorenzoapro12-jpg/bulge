/* =========================================================
   LOGIQUE DE JEU
   ========================================================= */
let G=null;
const MAXLVL=14,MUT_LV=[4,8,12];
function T(l){return l<=1?0:Math.round(9*Math.pow(l-1,1.5));}
/* facteur « début de partie » : 1 au départ, 0 dès que la menace dépasse 2,5 */
const EARLY=()=>G?clamp(1-(G.room-1)/1.5,0,1):0;
function TL(l){return l<=1?0:T(l)+(G&&G.p?G.p.base:0);}
function mkGame(){return{state:'play',t:0,time:0,room:1,p:null,en:[],eb:[],pb:[],pk:[],fx:[],tx:[],boss:null,
  roomDmg:0,roomHit:false,roomBub:1,roomScore:1,
  score:0,kills:0,combo:0,comboT:0,maxCombo:0,pickI:0,pickT:0,grazes:0,
  trauma:0,freeze:0,glitch:0,hurtT:0,kick:0,flash:0,timeScale:1,cx:0,cy:0,zoom:1,pcx:null,pcy:null,pzoom:null,
  banner:null,toasts:[],pendingEvo:[],evoDelay:14,heat:0,daily:false,dayKey:0,newAch:[],vacuum:false,vacuumT:0,
  win:false,trails:[],tgt:null,tgtT:0,dieT:0,vicT:0,prof:'bal',manual:false,
  hearts:[],heartsDone:0,lair:{open:false},arena:null,arenaOpen:null,biome:'plains',biomeCand:null,biomeN:0,visited:{},zoneT:null,spawnT:40,fightHit:false,
  inX:0,inY:0,aimMan:false,aimA:0,choices:[],artChoices:[],freeArts:[],help:0};}

function mkPlayer(prof){
  const pr=PROF[prof];
  return{x:0,y:0,vx:0,vy:0,r:14*pr.size,baseR:14*pr.size,ang:-Math.PI/2,col:pr.col,prof,
    bub:pr.bub+art('hp')*6,lvl:1,maxLvl:1,
    spd:pr.spd*.88*(1+.06*art('spd')),fireI:14/pr.rate/(1+.08*art('rate')),dmg:pr.dmg*(1+.12*art('dmg')),
    bspd:9,blife:62,bsize:4.5,pierce:0,turrets:1,spreadW:.16,homing:0,rico:0,split:0,
    aura:0,auraR:0,orbs:0,drones:0,dronesHome:false,missile:0,missileT:0,nova:0,novaT:0,
    magnet:140*(1+.25*art('magnet')),armor:pr.armor*Math.pow(.93,art('armor')),regen:0,regenT:0,crit:.03+.06*art('crit'),
    dashMax:150*pr.dash*Math.pow(.88,art('dash')),dashT:0,dashing:0,dvx:0,dvy:0,dashDmg:0,dashHit:[],ghost:false,
    inv:0,fireT:0,flash:0,recoil:0,glow:0,greed:1+.12*art('greed'),evo:{},muts:[],rerolls:art('reroll'),echo:art('echo'),
    vortex:false,titan:false,jitter:false,fury:false,dead:false};
}
const lvlDmg=()=>1+.08*(G.p.lvl-1);
const hpMul=()=>(1+.22*(G.room-1))*(1+.07*G.heat);
const dmgMul=()=>(1.15+.62*(G.room-1))*(1+.07*G.heat)*(1-.4*EARLY());
const fireMul=()=>Math.max(.4,.78-.055*(G.room-1))/(1+.02*G.heat);
const comboMul=()=>1+Math.min(3,G.combo*.08);

/* ---------- effets ---------- */
function shake(a){G.trauma=Math.min(1,G.trauma+a*(REDUCED?.3:1));}
function FX(o){const cap=QL>=3?520:QL===2?340:200;if(G.fx.length<cap)G.fx.push(o);}
function sparks(x,y,col,n,sp,life){if(G.fx.length>180)n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=Math.random()*TAU,s=Math.random()*sp;FX({ty:0,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life||fr(18,34),max:life||34,col,s:fr(1.5,3.5)});}}
function ringFX(x,y,r0,r1,col,life,w){FX({ty:1,x,y,vx:0,vy:0,r:r0,r1,life,max:life,col,w:w||3});}
function shards(x,y,col,n,sp,r){if(G.fx.length>180)n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=Math.random()*TAU,s=fr(sp*.3,sp);FX({ty:2,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:fr(25,45),max:45,col,s:fr(r*.12,r*.32)});}}
function ftext(x,y,s,col,size){if(G.tx.length<40)G.tx.push({x,y,s,col,size:size||14,life:55,max:55,vy:-.9});}
function banner(s,sub,col,dur){G.banner={s,sub:sub||'',col:col||COL.cy,t:0,max:dur||110};}
function toast(s){G.toasts.push({s,t:0});}
function unlock(id){if(meta.ach[id])return;meta.ach[id]=Date.now();saveMeta();if(G){G.newAch.push(id);const a=ACH.find(x=>x.id===id);toast('Succès débloqué : '+a.n);SFX.ach();}}

/* ---------- démarrage ---------- */
function newRun(prof,daily){
  auInit();
  const d=new Date(),dk=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  ARTS_ON=!daily;
  G=mkGame();G.daily=!!daily;G.dayKey=dk;G.prof=daily?'bal':prof;
  srand(daily?dk*7919+13:(Math.random()*4294967295)>>>0);
  if(daily||!WD||WD.used)genWorld(daily?dk*31+7:(Math.random()*4294967295)>>>0);
  WD.used=true;
  G.hearts=WD.hearts.map((h,i)=>({x:h.x,y:h.y,t:h.t,i,state:'dormant',r:54,hp:1,mhp:1,flash:0,nodes:[],ang:0,t2:0,spawned:0}));
  for(const h of G.hearts)heartNodes(h);
  G.heat=daily?8:5+Math.min(40,meta.runs*.4);
  G.p=mkPlayer(G.prof);G.p.base=G.p.bub;G.p.inv=90;
  G.zoom=zoomTarget();
  G.state='play';G.help=meta.seenHelp?0:420;meta.seenHelp=true;saveMeta();
  G.visited={plains:1};G.zoneT={b:'plains',t:0};setBiome('plains');setMusic(1);
  revealFog(0,0,900);prewarm(0,0,1100);for(const c of WD.bakes)c.used=0;
  banner('Détruis les 3 cœurs de zone','Suis la flèche : la mini-carte montre leur position',COL.cy,170);
}
function focusBig(){const B=G.boss;if(B&&!B.gone)return B;const A=G.arena;if(A&&A.kind==='heart'&&A.ref.state==='active')return A.ref;return null;}
function zoomTarget(){const P=G.p,F=focusBig();let view=(W<H?480:600)+(P.lvl-1)*20;if(F){view+=80;view=Math.max(view,Math.min(1250,2*(.62*Math.hypot(F.x-P.x,F.y-P.y)+F.r+70)));}return Math.min(W,H)/view;}

/* ---------- salles ---------- */
function mkEnemy(t,x,y,opt){const d=ET[t];const e={aggro:true,wa:R()*TAU,sl:0,sn:null,keep:false,chunk:null,t,d,x,y,vx:0,vy:0,r:d.r,hp:d.hp*hpMul(),mhp:0,spawn:42,cd:rr(50,130),st:0,st2:0,ca:0,ta:0,flash:0,wob:R()*TAU,dead:false,kids:0,parent:null,tele:0,bubMul:1,orbCd:0};
  e.mhp=e.hp;if(opt)Object.assign(e,opt);gcElite(e,opt);G.en.push(e);return e;}
function confine(o,r){const A=G.arena;let cx=0,cy=0,R0=WR;if(A){cx=A.x;cy=A.y;R0=A.r;}const dx=o.x-cx,dy=o.y-cy,d=Math.hypot(dx,dy),lim=R0-r;if(d>lim&&d>0){o.x=cx+dx/d*lim;o.y=cy+dy/d*lim;return[dx/d,dy/d];}return null;}
function wpick(w){let tot=0;for(const k in w)if(ET[k].min<=G.room+1)tot+=w[k];let r=R()*tot;for(const k in w){if(ET[k].min>G.room+1)continue;r-=w[k];if(r<=0)return k;}return 'pop';}
function updSpawns(){
  const P=G.p;
  for(const e of G.en){if(e.dead||e.keep)continue;if(dist2(e.x,e.y,P.x,P.y)>1700*1700){e.dead=true;e.gone=true;if(e.chunk)e.chunk.cacheDone=false;}}
  if(G.t%20===0){const cx=Math.floor(P.x/CH),cy=Math.floor(P.y/CH);
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const c=getChunk(cx+dx,cy+dy);if(!c||!c.cachePos||c.cacheDone)continue;const q=c.cachePos,d2=dist2(q.x,q.y,P.x,P.y);
      if(d2<1100*1100&&d2>480*480){c.cacheDone=true;mkEnemy('cache',q.x,q.y,{chunk:c,spawn:1});}}}
  if(G.arena||(G.gx&&G.gx.scene&&G.gx.scene.calm)||(G.gt&&G.gt.on&&G.gt.step<3)||gvCalm()||--G.spawnT>0)return;
  G.spawnT=36+Math.round(24*EARLY());
  let n=0;for(const e of G.en)if(!e.dead&&e.t!=='cache'&&e.t!=='life')n++;
  if(n>=Math.min(24,5+Math.floor(G.room*1.7)-Math.round(2*EARLY())))return;
  const sp=Math.hypot(P.vx,P.vy),a=sp>.6&&R()<.65?Math.atan2(P.vy,P.vx)+rr(-.9,.9):R()*TAU,d=rr(700,920);
  const x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
  if(x*x+y*y>(WR-120)**2)return;
  for(const h of G.hearts)if(h.state!=='dead'&&dist2(x,y,h.x,h.y)<700*700)return;
  const w=BIO[biomeAt(x,y)].en,k=1+Math.floor(R()*Math.min(4,1+G.room/3));
  for(let i=0;i<k;i++){const t=wpick(w),ex=x+rr(-70,70),ey=y+rr(-70,70);if(pointHit(ex,ey,ET[t].r+6))continue;mkEnemy(t,ex,ey,{aggro:false});}
  if(R()<.05)mkEnemy('life',x,y);
}
function updWorld(){
  const P=G.p;
  G.room=clamp(1+2.4*Math.min(1,Math.hypot(P.x,P.y)/WR)+G.time/7200+G.heartsDone*1.2,1,10);
  const A=G.arena;if(A&&A.r>A.rt)A.r=Math.max(A.rt,A.r-(A.r-A.rt>200?6:1.2));
  if(G.arenaOpen&&++G.arenaOpen.t>40)G.arenaOpen=null;
  if(G.vacuumT>0){G.vacuumT--;G.vacuum=G.vacuumT>0;}
  if(G.t%12===0){revealFog(P.x,P.y,760);const b=biomeAt(P.x,P.y);
    if(b!==G.biome){if(G.biomeCand===b){if(++G.biomeN>=3){G.biome=b;if(!G.visited[b])G.zoneT={b,t:0};setBiome(b);biomeWash(b);G.visited[b]=1;if(Object.keys(G.visited).length>=8)unlock('explorer');}}else{G.biomeCand=b;G.biomeN=0;}}else G.biomeCand=null;}
  if(G.zoneT)G.zoneT.t++;
  if(G.lair.open&&!G.arena&&!G.boss&&dist2(P.x,P.y,WD.core.x,WD.core.y)<640*640)startBossFight();
  updSpawns();
}
/* ---------- cœurs de zone ---------- */
function heartNodes(h){h.nodes=[];for(let k=0;k<4;k++){const nh=16*hpMul();h.nodes.push({x:h.x,y:h.y,r:13,hp:nh,mhp:nh,dead:false,cd:rr(80,160),flash:0});}}
function BIGS(){const a=[],B=G.boss;if(B&&!B.dead&&B.spawn<=0)a.push(B);const A=G.arena;if(A&&A.kind==='heart'&&A.ref.state==='active')a.push(A.ref);return a;}
function bigHittable(o){return o===G.boss?bossHittable():o.state==='active';}
function hurtBig(o,d,q){if(o===G.boss)hurtBoss(d,q);else hurtHeart(o,d,q);}
function updHearts(){
  const P=G.p;
  for(const h of G.hearts){if(h.state==='dead')continue;
    h.ang+=.012;if(h.flash>0)h.flash--;
    h.nodes.forEach((n,k)=>{const a=h.ang+k*TAU/4;n.x=h.x+Math.cos(a)*(h.r+30);n.y=h.y+Math.sin(a)*(h.r+30);if(n.flash>0)n.flash--;});
    if(h.state==='dormant'){if(!G.arena&&dist2(P.x,P.y,h.x,h.y)<520*520)activateHeart(h);continue;}
    heartFight(h);}
}
function purgeOutside(){const A=G.arena;for(const e of G.en)if(!e.dead&&Math.hypot(e.x-A.x,e.y-A.y)>A.rt-30){e.dead=true;e.gone=true;sparks(e.x,e.y,e.d.col,6,3);}G.eb=G.eb.filter(b=>Math.hypot(b.x-A.x,b.y-A.y)<A.rt);}
function activateHeart(h){
  h.state='active';h.t2=0;h.hp=h.mhp=190*hpMul();heartNodes(h);h.spawned=0;
  G.arena={x:h.x,y:h.y,r:900,rt:560,kind:'heart',ref:h};G.fightHit=false;purgeOutside();
  banner('Cœur de zone',BIO[h.t].n+' : la membrane se referme',HCOL[h.i],120);setMusic(2);SFX.bossIn();shake(.4);G.glitch=20;
}
function heartFight(h){
  const P=G.p;h.t2++;const aP=Math.atan2(P.y-h.y,P.x-h.x),f=h.hp/h.mhp,col=HCOL[h.i],dm=3.2;
  if(h.t2%100===0){const n=9+Math.floor(G.room*.6),o=R()*TAU;for(let k=0;k<n;k++)ebul(h.x,h.y,o+k*TAU/n,2.2,6,dm,col);SFX.bshot();}
  if(h.t2%150===75)for(let k=-1;k<=1;k++)ebul(h.x,h.y,aP+k*.2,3.3,6,dm,col);
  if(f<.5&&h.t2%13===0)for(let k=0;k<2;k++)ebul(h.x,h.y,h.t2*.05+k*Math.PI,2.4,6,dm*.8,col);
  for(const n of h.nodes){if(n.dead)continue;if(--n.cd<=0){n.cd=rr(140,200);ebul(n.x,n.y,Math.atan2(P.y-n.y,P.x-n.x),3,5,dm*.8,COL.or);}}
  const want=f<.35?2:f<.7?1:0;
  if(h.spawned<want){h.spawned++;const w=BIO[h.t].en,k=1+Math.floor(G.room/4);for(let i=0;i<k;i++){const a=R()*TAU;mkEnemy(wpick(w),h.x+Math.cos(a)*380,h.y+Math.sin(a)*380);}}
  if(dist2(h.x,h.y,P.x,P.y)<(h.r+P.r*.8)**2){hurtPlayer(dm*1.5*dmgMul(),h.x,h.y);const d=Math.hypot(P.x-h.x,P.y-h.y)||1;P.vx+=(P.x-h.x)/d*7;P.vy+=(P.y-h.y)/d*7;}
}
function hurtHeart(h,d,quiet){if(h.state!=='active')return;if(R()<G.p.crit)d*=G.p.critM||2.5;h.hp-=d;h.flash=3;if(!quiet)SFX.hit();if(h.hp<=0)heartDie(h);}
function heartDie(h){
  h.state='dead';h.hp=0;G.heartsDone++;const col=HCOL[h.i];for(const n of h.nodes)n.dead=true;
  shards(h.x,h.y,col,40,8,30);sparks(h.x,h.y,COL.gd,50,8);ringFX(h.x,h.y,20,500,COL.wh,40,6);FX({ty:4,x:h.x,y:h.y,vx:0,vy:0,r:500,life:30,max:30,col});
  SFX.phase();shake(.8);G.freeze=8;G.flash=.6;G.glitch=25;
  dropBubbles(h.x,h.y,Math.round((30+12*G.heartsDone)*G.p.greed),h.r,false);gsHeart(h);giDrop(h.x,h.y,'heart');
  G.score+=Math.round(1500*G.heartsDone*(1+.1*G.heat));
  for(const b of G.eb)sparks(b.x,b.y,b.col,1,1.5,12);G.eb=[];
  if(!G.fightHit)unlock('nohit');
  G.arenaOpen={x:G.arena.x,y:G.arena.y,r:G.arena.r,t:0,col};G.arena=null;G.vacuumT=120;
  G.pendingEvo.push(0);G.evoDelay=40;
  if(G.heartsDone>=3){G.lair.open=true;banner('Le Cœur s’éveille','Suis la flèche rouge jusqu’à l’Hypernoyau',COL.rd,170);setMusic(2);}
  else{banner('Cœur détruit',G.heartsDone+' sur 3 : évolution bonus',col,130);setMusic(1);}
}
function startBossFight(){const L=WD.core;G.arena={x:L.x,y:L.y,r:1000,rt:760,kind:'boss'};G.fightHit=false;purgeOutside();spawnBoss();}
/* ---------- joueur ---------- */
function checkLevel(){
  const P=G.p;
  while(P.lvl<MAXLVL&&P.bub>=TL(P.lvl+1)){P.lvl++;onLevelUp();}
  while(P.lvl>1&&P.bub<TL(P.lvl)){P.lvl--;onLevelDown();}
}
function onLevelUp(){
  const P=G.p;
  if(P.lvl>P.maxLvl){P.maxLvl=P.lvl;G.pendingEvo.push(P.lvl);G.evoDelay=14;}
  if(P.lvl>=10)unlock('lvl10');
  shockwave(P.x,P.y,170*(1+.4*P.echo),P.echo?P.dmg*4*P.echo:0,true);
  G.glitch=Math.max(G.glitch,18);SFX.lvl();ftext(P.x,P.y-P.r-14,'Niveau '+P.lvl,COL.cy,20);
  ringFX(P.x,P.y,P.r,P.r*5,COL.cy,30,5);sparks(P.x,P.y,COL.cy,24,6);
  P.inv=Math.max(P.inv,40);G.kick=.12;
}
function onLevelDown(){const P=G.p;SFX.delvl();ftext(P.x,P.y-P.r-14,'Rétrécissement',COL.rd,17);G.glitch=Math.max(G.glitch,10);}
function hurtPlayer(dmg,sx,sy){
  const P=G.p;if(G.state!=='play'||P.inv>0||P.dashing>0||P.dead)return;
  if(gcShield(dmg,sx,sy))return;if(giDodge())return;
  dmg=Math.max(1,Math.round((dmg+P.bub*.045*(1-.5*EARLY()))*P.armor));
  const lost=Math.min(P.bub,dmg);P.bub-=lost;giHurt(lost);G.hitsTaken=(G.hitsTaken||0)+1;
  G.roomDmg+=lost;G.roomHit=true;G.fightHit=true;G.combo=0;G.comboT=0;
  const spill=Math.floor(lost*.4);if(spill>0)dropBubbles(P.x,P.y,spill,P.r,true);
  P.inv=Math.round(50+40*EARLY());P.flash=10;shake(.45);G.freeze=Math.max(G.freeze,2);G.glitch=Math.max(G.glitch,8);G.hurtT=22;SFX.hurt();
  const d=Math.hypot(P.x-sx,P.y-sy)||1;P.vx+=(P.x-sx)/d*4;P.vy+=(P.y-sy)/d*4;
  for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,P.x,P.y)<80*80)G.eb.splice(i,1);}
  ftext(P.x,P.y-P.r-10,'-'+lost,COL.rd,18);
  if(P.bub<=0){die();return;}
  checkLevel();
}
function tryDash(){
  if(!G||G.state!=='play')return;const P=G.p;if(P.dashT>0||P.dead)return;
  let dx=G.inX,dy=G.inY;if(!dx&&!dy){dx=Math.cos(P.ang);dy=Math.sin(P.ang);}const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  P.dashing=12;P.dashT=P.dashMax;P.dvx=dx*P.spd*3.6;P.dvy=dy*P.spd*3.6;P.inv=Math.max(P.inv,18);P.dashHit=[];SFX.dash();
  ringFX(P.x,P.y,P.r,P.r*2.2,P.col,14,3);
}
function updPlayer(){
  const P=G.p;G.time++;
  if(P.inv>0)P.inv--;if(P.flash>0)P.flash--;if(P.dashT>0)P.dashT--;
  if(P.regen>0&&++P.regenT>=Math.round(90/P.regen)){P.regenT=0;P.bub+=1;checkLevel();}
  if(P.dashing>0){
    P.dashing--;P.vx=P.dvx;P.vy=P.dvy;
    if(G.t%2===0)FX({ty:3,x:P.x,y:P.y,vx:0,vy:0,r:P.r,life:16,max:16,col:P.col});
    if(P.ghost&&G.t%3===0)G.trails.push({x:P.x,y:P.y,r:P.r*1.15,life:70});
    if(P.dashDmg>0)for(const e of G.en){if(e.dead||e.spawn>0||P.dashHit.includes(e))continue;if(dist2(e.x,e.y,P.x,P.y)<(e.r+P.r+6)**2){P.dashHit.push(e);hurtEnemy(e,P.dashDmg*P.dmg*lvlDmg(),P.dvx*.5,P.dvy*.5);}}
    if(P.dashing===0){P.vx*=.35;P.vy*=.35;}
  }else{P.vx=lerp(P.vx,G.inX*P.spd,.16);P.vy=lerp(P.vy,G.inY*P.spd,.16);}
  P.x+=P.vx;P.y+=P.vy;
  const oh=collideCircle(P,P.r*.92);if(oh){const vn=P.vx*oh[0]+P.vy*oh[1];if(vn<0){P.vx-=vn*oh[0];P.vy-=vn*oh[1];}}
  const cn=confine(P,P.r);if(cn){const vn=P.vx*cn[0]+P.vy*cn[1];if(vn>0){P.vx-=vn*cn[0]*1.6;P.vy-=vn*cn[1]*1.6;}}
  P.r=lerp(P.r,P.baseR*(1+(P.lvl-1)*.085)*(P.titan?1.25:1),.1);
  aimUpdate();playerFire();
}
function findTarget(x,y,range){
  let best=null,bd=range*range;
  for(const e of G.en){if(e.dead||e.spawn>0)continue;let d=dist2(x,y,e.x,e.y);if(e.t==='life')d*=1.6;if(d<bd){bd=d;best=e;}}
  for(const B of BIGS()){const d=Math.max(0,Math.hypot(x-B.x,y-B.y)-B.r*.6);if(d*d<bd){bd=d*d;best=B;}}
  return best;
}
function leadAng(sx,sy,tg,spd){let tx=tg.x,ty=tg.y;const vx=tg.vx||0,vy=tg.vy||0;for(let k=0;k<2;k++){const t=Math.min(60,Math.hypot(tx-sx,ty-sy)/spd);tx=tg.x+vx*t;ty=tg.y+vy*t;}return Math.atan2(ty-sy,tx-sx);}
function aimUpdate(){
  const P=G.p;
  if(--G.tgtT<=0){G.tgtT=6;G.tgt=findTarget(P.x,P.y,760);}
  if(G.tgt&&G.tgt.dead)G.tgt=null;
  let want=null;G.manual=false;
  if(G.aimMan){want=G.aimA;G.manual=true;}
  else if(G.tgt)want=leadAng(P.x,P.y,G.tgt,P.bspd);
  else if(G.inX||G.inY)want=Math.atan2(G.inY,G.inX);
  if(want!==null)P.ang+=angDiff(P.ang,want)*(G.manual?.7:.3);
}
function pbul(x,y,a,o){const P=G.p;const b={x,y,vx:Math.cos(a)*P.bspd,vy:Math.sin(a)*P.bspd,r:P.bsize,dmg:P.dmg*lvlDmg(),life:P.blife,pierce:P.pierce,rico:P.rico,split:P.split,home:P.homing,hit:null,col:COL.cy,kind:0,shard:false,tg:null,sp:0,boom:0};
  if(o)Object.assign(b,o);if(G.pb.length<420)G.pb.push(b);return b;}
function playerFire(){
  const P=G.p;if(P.fireT>0){P.fireT--;return;}
  if(!G.manual&&!G.tgt)return;
  P.fireT+=P.fireI;
  const n=P.turrets,w=P.spreadW*(n>3?.85:1);
  for(let k=0;k<n;k++){let a=P.ang+(k-(n-1)/2)*w;if(P.jitter)a+=rr(-.14,.14);
    const ox=Math.cos(a)*P.r*1.1,oy=Math.sin(a)*P.r*1.1;pbul(P.x+ox,P.y+oy,a);
    if(k===0||n<4)FX({ty:0,x:P.x+ox,y:P.y+oy,vx:Math.cos(a)*2+P.vx,vy:Math.sin(a)*2+P.vy,life:8,max:8,col:COL.wh,s:P.bsize*.9});}
  P.recoil=4;SFX.shoot();
}
function updWeapons(){
  const P=G.p,dm=P.dmg*lvlDmg(),B=G.boss;
  if(P.aura>0){P.auraR=P.r+34+P.aura*20;if(G.t%10===0){const r2=P.auraR;for(const e of G.en){if(e.dead||e.spawn>0)continue;if(dist2(e.x,e.y,P.x,P.y)<(r2+e.r)**2)hurtEnemy(e,dm*(.35+.3*P.aura),0,0,true);}
    for(const B2 of BIGS())if(bigHittable(B2)&&dist2(B2.x,B2.y,P.x,P.y)<(r2+B2.r)**2)hurtBig(B2,dm*(.35+.3*P.aura),true);}}
  if(P.orbs>0){const n=P.orbs,R0=P.r+30;for(let k=0;k<n;k++){const a=G.t*.07+k*TAU/n,ox=P.x+Math.cos(a)*R0,oy=P.y+Math.sin(a)*R0;
    for(const e of G.en){if(e.dead||e.spawn>0)continue;if(e.orbCd<=G.t&&dist2(ox,oy,e.x,e.y)<(e.r+8)**2){e.orbCd=G.t+10;hurtEnemy(e,dm*.9,Math.cos(a)*1.5,Math.sin(a)*1.5,true);}}
    if(G.t%10===k%10)for(const B2 of BIGS())if(bigHittable(B2)&&dist2(ox,oy,B2.x,B2.y)<(B2.r+8)**2)hurtBig(B2,dm*.9,true);
    for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(ox,oy,b.x,b.y)<(b.r+8)**2){sparks(b.x,b.y,COL.cy,3,2,12);G.eb.splice(i,1);}}}}
  if(P.drones>0){const n=P.drones;for(let k=0;k<n;k++){if((G.t+k*9)%34!==0)continue;const a=-G.t*.025+k*TAU/n,R1=P.r+62,dx=P.x+Math.cos(a)*R1,dy=P.y+Math.sin(a)*R1;
    const tg=findTarget(dx,dy,520);if(tg){const aa=leadAng(dx,dy,tg,P.bspd);pbul(dx,dy,aa,{dmg:dm*.55,r:3.5,col:COL.lm,home:P.dronesHome?.1:0,pierce:0,split:0,rico:0});}}}
  if(P.missile>0&&++P.missileT>=Math.max(45,120-14*P.missile)){P.missileT=0;const n=1+Math.floor(P.missile/2);
    for(let k=0;k<n;k++){const a=P.ang+Math.PI+rr(-.9,.9);pbul(P.x,P.y,a,{kind:1,dmg:dm*2.2,r:5,col:COL.gd,home:.12,life:130,pierce:0,split:0,rico:0,sp:6,vx:Math.cos(a)*3,vy:Math.sin(a)*3,boom:55+8*P.missile});}
    SFX.missile();}
  if(P.nova>0&&++P.novaT>=Math.max(120,180/P.nova)){P.novaT=0;shockwave(P.x,P.y,230,dm*3,true);SFX.nova();}
  for(let i=G.trails.length-1;i>=0;i--){const tr=G.trails[i];if(--tr.life<=0){G.trails.splice(i,1);continue;}
    if(G.t%8===0)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,tr.x,tr.y)<(e.r+tr.r)**2)hurtEnemy(e,dm*.6,0,0,true);}
}
function shockwave(x,y,rad,dmg,clear){
  ringFX(x,y,10,rad,COL.wh,26,4);ringFX(x,y,10,rad*.8,COL.cy,20,8);
  for(const e of G.en){if(e.dead||e.spawn>0)continue;const d=Math.hypot(e.x-x,e.y-y)||1;if(d<rad+e.r){const f=(1-d/(rad+e.r))*8;e.vx+=(e.x-x)/d*f;e.vy+=(e.y-y)/d*f;if(dmg>0)hurtEnemy(e,dmg,0,0,true);}}
  if(clear)for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,x,y)<rad*rad){sparks(b.x,b.y,b.col,2,2,14);G.eb.splice(i,1);}}
  if(dmg>0)for(const B of BIGS())if(bigHittable(B)&&Math.hypot(B.x-x,B.y-y)<rad+B.r)hurtBig(B,dmg,true);
  shake(.15);
}
function explode(b){
  const rad=b.boom||60;ringFX(b.x,b.y,6,rad,COL.gd,18,4);sparks(b.x,b.y,COL.or,14,5);SFX.boom();shake(.08);
  for(const e of G.en){if(e.dead||e.spawn>0)continue;if(dist2(e.x,e.y,b.x,b.y)<(rad+e.r)**2){const d=Math.hypot(e.x-b.x,e.y-b.y)||1;hurtEnemy(e,b.dmg,(e.x-b.x)/d*3,(e.y-b.y)/d*3,true);}}
  FX({ty:4,x:b.x,y:b.y,vx:0,vy:0,r:rad*2.2,life:14,max:14,col:COL.or});
  for(const B of BIGS())if(bigHittable(B)&&dist2(B.x,B.y,b.x,b.y)<(rad+B.r)**2)hurtBig(B,b.dmg,true);
}

/* ---------- ennemis ---------- */
function ebul(x,y,a,s,r,dmg,col){s*=1+.035*(G.room-1)+.01*G.heat;const b={x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r,dmg:dmg*dmgMul(),col,life:420,home:0,gz:false};if(G.eb.length<600)G.eb.push(b);return b;}
function hurtEnemy(e,dmg,kx,ky,quiet){
  if(e.dead||e.spawn>0)return;if(e.aff==='armor')dmg*=.45;
  e.aggro=true;
  const crit=R()<G.p.crit;if(crit)dmg*=G.p.critM||2.5;
  dmg=giHit(e,dmg,crit);e.hp-=dmg;e.flash=4;giAfter(e,dmg,crit);
  if(kx&&!(e.t==='spike'&&e.st===2)){const m=e.r>20?.35:1;e.vx+=kx*m;e.vy+=ky*m;}
  if(!quiet)SFX.hit();
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;e.dead=true;if(e.parent&&!e.parent.dead)e.parent.kids--;
  const P=G.p;
  const n=Math.max(1,Math.round(e.d.bub*e.bubMul*P.greed*(1+.04*(G.room-1))*G.roomBub*(1+.3*EARLY())));
  dropBubbles(e.x,e.y,n,e.r,false);
  G.kills++;G.combo++;G.comboT=150;if(G.combo>G.maxCombo)G.maxCombo=G.combo;
  if(G.combo===25)unlock('combo25');
  G.score+=Math.round(e.d.bub*10*(1+.15*(G.room-1))*comboMul()*G.roomScore);
  if(G.combo>=10&&G.combo%10===0)ftext(e.x,e.y-e.r-8,'Combo ×'+G.combo,COL.gd,16);
  if(e.chunk)e.chunk.cachePos=null;
  FX({ty:4,x:e.x,y:e.y,vx:0,vy:0,r:e.r*7,life:14,max:14,col:e.d.col});
  shards(e.x,e.y,e.d.col,6+Math.floor(e.r/3),3+e.r*.08,e.r);sparks(e.x,e.y,e.d.col,8,4);ringFX(e.x,e.y,e.r,e.r*2.4,e.d.col,18,3);
  const big=e.r>=20;SFX.pop(big);
  if(big){shake(.22);if(G.t-(G.lastFz||-99)>40){G.freeze=Math.max(G.freeze,2);G.lastFz=G.t;}}else shake(.05);
  if(e.t==='life')ftext(e.x,e.y,'Jackpot',COL.lm,20);
  gcKill(e);giKill(e);
}
function dropBubbles(x,y,n,spread,spill){
  if(!spill&&G.pk.length>260){G.p.bub+=n;checkLevel();return;}
  let left=n;const cnt=Math.min(n,spill?10:14);
  for(let i=0;i<cnt;i++){const v=Math.round(left/(cnt-i));left-=v;if(v<=0)continue;const a=Math.random()*TAU,s=spill?fr(4,8):fr(1,3.2);
    G.pk.push({x:x+Math.cos(a)*spread*.4,y:y+Math.sin(a)*spread*.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s,v,r:Math.min(9,2.8+Math.sqrt(v)*1.5),life:spill?520:1100,delay:spill?24:14,spill,pull:0,ph:Math.random()*TAU});}
}
function updEnemy(e){
  if(e.spawn>0){e.spawn--;return;}
  if(e.flash>0)e.flash--;
  if(!e.aggro){const P0=G.p;if(dist2(e.x,e.y,P0.x,P0.y)<620*620)e.aggro=true;else{e.wob+=.02;e.wa+=rr(-.06,.06);e.vx=lerp(e.vx,Math.cos(e.wa)*.5,.05);e.vy=lerp(e.vy,Math.sin(e.wa)*.5,.05);e.x+=e.vx;e.y+=e.vy;if(collideCircle(e,e.r))e.wa+=Math.PI*.5;if(confine(e,e.r))e.wa+=Math.PI;return;}}
  const P=(e.tg&&!e.tg.dead)?e.tg:G.p,d=e.d,dx=P.x-e.x,dy=P.y-e.y,dd=Math.hypot(dx,dy)||1,ax=dx/dd,ay=dy/dd,aP=Math.atan2(dy,dx);
  let tx=0,ty=0,sp=d.spd*(1+.03*(G.room-1));
  e.wob+=.03;
  switch(e.t){
    case 'mite':tx=ax+Math.cos(e.wob*3)*.45;ty=ay+Math.sin(e.wob*3)*.45;break;
    case 'pop':tx=ax*.5+Math.cos(e.wob)*.7;ty=ay*.5+Math.sin(e.wob*1.3)*.7;
      if(--e.cd<=0){e.cd=rr(90,140)*fireMul();ebul(e.x,e.y,aP,2.6,5,d.dmg,d.col);SFX.eshot();}break;
    case 'spread':{const s=dd>300?1:dd<220?-1:0;tx=ax*s-ay*.5;ty=ay*s+ax*.5;
      if(--e.cd<=0){e.cd=rr(100,140)*fireMul();for(let k=-1;k<=1;k++)ebul(e.x,e.y,aP+k*.22,3,5,d.dmg,d.col);SFX.eshot();}break;}
    case 'spike':
      if(e.st===0){tx=ax*.4+Math.cos(e.wob)*.3;ty=ay*.4+Math.sin(e.wob)*.3;if(--e.cd<=0&&dd<440){e.st=1;e.st2=40;}}
      else if(e.st===1){sp=0;e.ca=aP;if(--e.st2<=0){e.st=2;e.st2=34;}}
      else{sp=6.2;tx=Math.cos(e.ca);ty=Math.sin(e.ca);if(--e.st2<=0){e.st=0;e.cd=rr(60,110);}}break;
    case 'orbit':{if(!e.dir)e.dir=R()<.5?1:-1;if(--e.st2<=0){e.st2=rr(90,170);e.dir*=-1;}const s=clamp((dd-210)/60,-1,1);tx=ax*s-ay*e.dir;ty=ay*s+ax*e.dir;if(e.st2<30)sp*=.25;
      if(--e.cd<=0){e.cd=rr(70,95)*fireMul();ebul(e.x,e.y,aP,3.2,5,d.dmg,d.col);SFX.eshot();}break;}
    case 'ring':tx=ax*.3+Math.cos(e.wob)*.5;ty=ay*.3+Math.sin(e.wob)*.5;
      if(--e.cd<=0){e.cd=rr(120,150)*fireMul();const n=8+Math.min(6,Math.floor(G.room/2)),o=R()*TAU;for(let k=0;k<n;k++)ebul(e.x,e.y,o+k*TAU/n,2.2,6,d.dmg,d.col);SFX.bshot();}break;
    case 'sniper':{const s=dd>420?1:dd<300?-1:0;tx=ax*s+Math.cos(e.wob)*.3;ty=ay*s+Math.sin(e.wob)*.3;
      if(e.tele>0){sp*=.2;e.tele--;e.ta+=angDiff(e.ta,aP)*.045;if(e.tele===0){ebul(e.x,e.y,e.ta,9,5,d.dmg,d.col);SFX.snipe();}}
      else if(--e.cd<=0){e.cd=rr(150,200)*fireMul();e.tele=55;e.ta=aP;SFX.tele();}break;}
    case 'gatling':tx=ax*.2;ty=ay*.2;
      if(e.st>0){if(e.st%6===0)ebul(e.x,e.y,aP+rr(-.12,.12),3.6,4,d.dmg,d.col);if(e.st%12===0)SFX.eshot();e.st--;}
      else if(--e.cd<=0){e.cd=rr(140,180)*fireMul();e.st=36;}break;
    case 'spawner':tx=Math.cos(e.wob*.7);ty=Math.sin(e.wob*.9);
      if(--e.cd<=0){e.cd=rr(170,220);if(e.kids<5&&(e.made||0)<8&&G.en.length<40)for(let k=0;k<2;k++){e.made=(e.made||0)+1;const a=R()*TAU;mkEnemy('mite',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,{spawn:10,parent:e,bubMul:.5});e.kids++;}}break;
    case 'cache':sp=0;break;
    case 'life':tx=-ax+Math.cos(e.wob*2)*.6;ty=-ay+Math.sin(e.wob*2)*.6;break;
  }
  if(G.hunt&&e.t!=='life'&&!(e.t==='spike'&&e.st>0)&&dd>230){tx=ax;ty=ay;sp=Math.max(sp,1.7);}
  if(e.sl>0&&e.sn){e.sl--;const n=e.sn,sg=(tx*-n[1]+ty*n[0])>=0?1:-1;tx+=-n[1]*sg*.9;ty+=n[0]*sg*.9;}
  const tl=Math.hypot(tx,ty)||1;
  if(e.t==='spike'&&e.st===2){e.vx=tx*sp;e.vy=ty*sp;if(G.t%2===0)FX({ty:3,x:e.x,y:e.y,vx:0,vy:0,r:e.r,life:12,max:12,col:d.col});}
  else{e.vx=lerp(e.vx,tx/tl*sp,.08);e.vy=lerp(e.vy,ty/tl*sp,.08);}
  e.x+=e.vx;e.y+=e.vy;
  const oh=collideCircle(e,e.r);
  if(oh){const vn=e.vx*oh[0]+e.vy*oh[1];if(vn<0){e.vx-=vn*oh[0];e.vy-=vn*oh[1];}e.sl=20;e.sn=oh;if(e.t==='spike'&&e.st===2){e.st=0;e.cd=60;}}
  if(confine(e,e.r)&&e.t==='spike'&&e.st===2){e.st=0;e.cd=60;}
}
function updEnemies(){
  for(let i=0;i<G.en.length;i++){const e=G.en[i];if(e.dead)continue;if(e.stun>0){e.stun--;e.x+=e.vx*.3;e.y+=e.vy*.3;e.vx*=.9;e.vy*=.9;continue;}const ox=e.x,oy=e.y;updEnemy(e);if(e.frost>0){const k=Math.min(.6,.12*e.frost);e.x-=(e.x-ox)*k;e.y-=(e.y-oy)*k;}}
  const n=G.en.length;
  for(let i=0;i<n;i++){const a=G.en[i];if(a.dead)continue;for(let j=i+1;j<n;j++){const b=G.en[j];if(b.dead)continue;const dx=b.x-a.x,dy=b.y-a.y,rs=a.r+b.r,d2=dx*dx+dy*dy;
    if(d2<rs*rs&&d2>.01){const d=Math.sqrt(d2),o=(rs-d)*.5/d;a.x-=dx*o;a.y-=dy*o;b.x+=dx*o;b.y+=dy*o;}}}
  const P=G.p;
  if(G.state==='play'&&!P.dead)for(const e of G.en){if(e.dead||e.spawn>0)continue;const rs=e.r+P.r*.85;if(dist2(e.x,e.y,P.x,P.y)>=rs*rs)continue;
    if(e.t==='mite'){hurtPlayer(e.d.dmg*dmgMul(),e.x,e.y);killEnemy(e);}
    else if(e.t==='spike')hurtPlayer(e.d.dmg*dmgMul()*(e.st===2?1:.5),e.x,e.y);
    else{const dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1,o=rs-d;P.x+=dx/d*o*.5;P.y+=dy/d*o*.5;e.x-=dx/d*o*.5;e.y-=dy/d*o*.5;}}
  G.en=G.en.filter(e=>!e.dead);
}

/* ---------- projectiles ---------- */

function updBullets(){
  const P=G.p,bg=BIGS();
  for(let i=G.pb.length-1;i>=0;i--){const b=G.pb[i];if(!b)continue;
    if(b.home>0){if(!b.tg||b.tg.dead||G.t%10===0)b.tg=findTarget(b.x,b.y,b.kind===1?600:320);
      if(b.tg){const a=Math.atan2(b.vy,b.vx),ta=Math.atan2(b.tg.y-b.y,b.tg.x-b.x),na=a+clamp(angDiff(a,ta),-b.home,b.home);let sp=Math.hypot(b.vx,b.vy);if(b.kind===1)sp=Math.min(b.sp,sp+.25);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;}}
    else if(b.kind===1&&Math.hypot(b.vx,b.vy)<b.sp){b.vx*=1.05;b.vy*=1.05;}
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.kind===1&&G.t%2===0)FX({ty:0,x:b.x,y:b.y,vx:0,vy:0,life:14,max:14,col:COL.or,s:2.5});
    const Ar=G.arena,acx=Ar?Ar.x:0,acy=Ar?Ar.y:0,RRa=Ar?Ar.r:WR,bdx=b.x-acx,bdy=b.y-acy,rd=Math.hypot(bdx,bdy);
    if(rd>RRa-b.r){
      if(b.rico>0){const nx=bdx/rd,ny=bdy/rd,vn=b.vx*nx+b.vy*ny;b.vx-=2*vn*nx;b.vy-=2*vn*ny;b.x=acx+nx*(RRa-b.r-1);b.y=acy+ny*(RRa-b.r-1);b.rico--;b.life=Math.max(b.life,24);b.hit=null;sparks(b.x,b.y,b.col,3,2,12);}
      else{if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,2,1.5,10);G.pb.splice(i,1);continue;}}
    if(pointHit(b.x,b.y,b.r)){
      if(b.rico>0){const o={x:b.x,y:b.y},n=collideCircle(o,b.r+1);if(n){const vn=b.vx*n[0]+b.vy*n[1];b.vx-=2*vn*n[0];b.vy-=2*vn*n[1];b.x=o.x;b.y=o.y;}b.rico--;b.hit=null;sparks(b.x,b.y,b.col,3,2,12);}
      else{if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,3,2,10);G.pb.splice(i,1);continue;}}
    if(b.life<=0){if(b.kind===1)explode(b);G.pb.splice(i,1);continue;}
    let gone=false;
    for(const Bg of bg){
      for(const nd of Bg.nodes){if(nd.dead)continue;if(dist2(b.x,b.y,nd.x,nd.y)<(nd.r+b.r)**2){hitNode(nd,b.dmg);gone=true;break;}}
      if(!gone&&dist2(b.x,b.y,Bg.x,Bg.y)<(Bg.r+b.r)**2){if(bigHittable(Bg))hurtBig(Bg,b.dmg);else sparks(b.x,b.y,COL.wh,3,2,10);gone=true;}
      if(gone)break;}
    if(gone){if(b.kind===1)explode(b);else sparks(b.x,b.y,b.col,3,2.5,12);G.pb.splice(i,1);continue;}
    for(const e of G.en){if(e.dead||e.spawn>0)continue;const rs=e.r+b.r;if(dist2(b.x,b.y,e.x,e.y)>=rs*rs)continue;
      if(b.hit&&b.hit.includes(e))continue;
      if(b.kind===1){explode(b);gone=true;break;}
      const sp=Math.hypot(b.vx,b.vy)||1;hurtEnemy(e,b.dmg,b.vx/sp*1.2,b.vy/sp*1.2);
      sparks(b.x,b.y,b.col,4,2.8,14);
      if(b.split>0&&!b.shard)for(let k=0;k<b.split*2+1;k++)pbul(b.x,b.y,R()*TAU,{dmg:b.dmg*.4,r:Math.max(2.5,b.r*.6),life:20,shard:true,split:0,pierce:0,rico:0,home:0,hit:[e]});
      if(b.pierce>0){b.pierce--;(b.hit||(b.hit=[])).push(e);}else gone=true;
      break;}
    if(gone)G.pb.splice(i,1);
  }
  for(let i=G.eb.length-1;i>=0;i--){if(i>=G.eb.length)continue;const b=G.eb[i];
    if(b.home>0){b.home--;const a=Math.atan2(b.vy,b.vx),ta=Math.atan2(P.y-b.y,P.x-b.x),sp=Math.hypot(b.vx,b.vy),na=a+clamp(angDiff(a,ta),-.035,.035);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;}
    let f=1;if(P.vortex&&dist2(b.x,b.y,P.x,P.y)<170*170)f=.45;
    b.x+=b.vx*f;b.y+=b.vy*f;b.life--;
    const Ae=G.arena;if(b.life<=0||(Ae?dist2(b.x,b.y,Ae.x,Ae.y)>(Ae.r+20)**2:dist2(b.x,b.y,P.x,P.y)>1500*1500)){G.eb.splice(i,1);continue;}
    if((G.t+i)%2===0&&pointHit(b.x,b.y,b.r*.6)){sparks(b.x,b.y,b.col,2,1.5,10);G.eb.splice(i,1);continue;}
    if(G.state!=='play'||P.dead)continue;
    const rs=P.r*.78+b.r,d2=dist2(b.x,b.y,P.x,P.y);
    if(d2<rs*rs){if(P.inv>0||P.dashing>0)continue;sparks(b.x,b.y,b.col,8,3);G.eb.splice(i,1);hurtPlayer(b.dmg,b.x,b.y);continue;}
    if(!b.gz&&d2<(rs+16)**2){b.gz=true;G.score+=5;G.grazes++;FX({ty:0,x:b.x,y:b.y,vx:0,vy:0,life:10,max:10,col:COL.wh,s:2});}
  }
}
function updPickups(){
  const P=G.p,mr=P.magnet+P.r;
  for(let i=G.pk.length-1;i>=0;i--){const k=G.pk[i];k.life--;
    if(k.delay>0){k.delay--;k.x+=k.vx;k.y+=k.vy;k.vx*=.9;k.vy*=.9;}
    else{const dx=P.x-k.x,dy=P.y-k.y,d=Math.hypot(dx,dy)||1;
      const pull=G.vacuum||(k.spill?d<P.r+mr*.6:d<mr);
      if(pull){k.pull+=.4;const s=G.vacuum?Math.max(9,16):Math.min(14,2+(mr-d)*.08+k.pull);k.vx=lerp(k.vx,dx/d*s,.25);k.vy=lerp(k.vy,dy/d*s,.25);}
      else{k.vx*=.94;k.vy*=.94;}
      k.x+=k.vx;k.y+=k.vy;
      if(d<P.r+k.r+2&&!P.dead){collect(k);G.pk.splice(i,1);continue;}}
    if(G.arena)confine(k,6);
    if(k.life<=0)G.pk.splice(i,1);
  }
}
function collect(k){const P=G.p;P.bub+=k.v;G.bubGot=(G.bubGot||0)+k.v;G.pickI++;G.pickT=40;SFX.pick(G.pickI);FX({ty:1,x:P.x,y:P.y,vx:0,vy:0,r:P.r,r1:P.r+6+k.v,life:10,max:10,col:COL.pk,w:2});G.score+=k.v;P.glow=Math.min(1,P.glow+.15);checkLevel();}

/* ---------- boss : l'Hypernoyau ---------- */
function spawnBoss(){
  const hp=800*(1+.08*G.heat);
  const A=G.arena,B={x:A.x,y:A.y-60,vx:0,vy:0,r:66,hp,mhp:hp,phase:1,t:0,trans:0,spawn:110,flash:0,ang:0,dead:false,gone:false,nodes:[],dir:1};
  for(let k=0;k<6;k++){const nh=14*hpMul();B.nodes.push({x:0,y:0,r:15,hp:nh,mhp:nh,dead:false,cd:rr(60,160),flash:0});}
  G.boss=B;
  banner("L'Hypernoyau",'Le cœur de la colonie se réveille',COL.rd,150);setMusic(2);SFX.bossIn();shake(.5);G.glitch=30;gsBoss(0);
}
function bossHittable(){const B=G.boss;return !!B&&B.spawn<=0&&B.trans<=0&&!B.dead;}
function hurtBoss(d,quiet){const B=G.boss;if(!bossHittable())return;if(R()<G.p.crit)d*=G.p.critM||2.5;B.hp-=d;B.flash=3;if(!quiet)SFX.hit();if(B.hp<=0){B.hp=0;bossDie();}}
function hitNode(n,d){n.hp-=d;n.flash=4;SFX.hit();if(n.hp<=0&&!n.dead){n.dead=true;shards(n.x,n.y,COL.or,10,4,n.r);ringFX(n.x,n.y,n.r,n.r*3,COL.or,18,3);dropBubbles(n.x,n.y,Math.round(5*G.p.greed),n.r,false);SFX.pop(true);G.score+=300;}}
function bossPhase(n){
  const B=G.boss;B.phase=n;B.trans=90;B.t=0;
  for(const b of G.eb)sparks(b.x,b.y,b.col,1,1.5,12);G.eb=[];
  G.glitch=45;shake(.9);G.freeze=8;SFX.phase();setMusic(n===2?3:4);gsBoss(n-1);
  banner('Phase '+n,n===2?'Fureur : ses bulles te traquent':'Confinement : la membrane se referme',n===2?COL.mg:COL.rd,130);
  ringFX(B.x,B.y,B.r,B.r*6,COL.rd,40,6);
  if(n===3){G.arena.rt=440;for(const nd of B.nodes)if(!nd.dead){nd.dead=true;shards(nd.x,nd.y,COL.or,8,4,nd.r);}}
  dropBubbles(B.x,B.y,Math.round(20*G.p.greed),B.r,false);
}
function updBoss(){
  const B=G.boss;if(!B||B.dead)return;const P=G.p;
  if(B.flash>0)B.flash--;
  B.ang+=.01+.006*B.phase;
  const nr=B.r+34;B.nodes.forEach((n,k)=>{const a=B.ang+k*TAU/6;n.x=B.x+Math.cos(a)*nr;n.y=B.y+Math.sin(a)*nr;if(n.flash>0)n.flash--;});
  if(B.spawn>0){B.spawn--;return;}
  if(B.trans>0){B.trans--;if(B.trans%6===0)sparks(B.x+fr(-B.r,B.r),B.y+fr(-B.r,B.r),COL.rd,6,4);return;}
  B.t++;
  const f=B.hp/B.mhp;
  if(B.phase===1&&f<.67){bossPhase(2);return;}
  if(B.phase===2&&f<.34){bossPhase(3);return;}
  const dx=P.x-B.x,dy=P.y-B.y,dd=Math.hypot(dx,dy)||1,aP=Math.atan2(dy,dx);
  let tx,ty,sp;
  const Aa=G.arena;if(B.phase===1){tx=Aa.x+Math.cos(B.t*.009)*200-B.x;ty=Aa.y+Math.sin(B.t*.013)*160-B.y;sp=1;}
  else if(B.phase===2){const s=dd>300?1:-1;tx=dx*s-dy*.6;ty=dy*s+dx*.6;sp=1.35;}
  else{tx=dx;ty=dy;sp=1.5+.5*(1-f/.34);}
  const tl=Math.hypot(tx,ty)||1;B.vx=lerp(B.vx,tx/tl*sp,.04);B.vy=lerp(B.vy,ty/tl*sp,.04);
  B.x+=B.vx;B.y+=B.vy;
  confine(B,B.r+10);
  const dm=3.8;
  if(B.phase===1){
    if(B.t%7===0)for(let k=0;k<3;k++)ebul(B.x,B.y,B.t*.045+k*TAU/3,2.3,7,dm,COL.mg);
    if(B.t%150===75){for(let k=-2;k<=2;k++)ebul(B.x,B.y,aP+k*.16,3.4,6,dm,COL.gd);SFX.bshot();}
  }else if(B.phase===2){
    if(B.t%240===0)B.dir*=-1;
    if(B.t%7===0)for(let k=0;k<3;k++)ebul(B.x,B.y,B.dir*B.t*.04+k*TAU/3,2.6,6,dm,COL.mg);
    if(B.t%120===60){for(let k=0;k<4;k++){const b=ebul(B.x,B.y,aP+(k-1.5)*.5,2.1,8,dm*1.2,COL.vi);b.home=110;}SFX.bshot();}
    if(B.t%320===160&&G.en.length<8)for(let k=0;k<3;k++){const a=R()*TAU;mkEnemy('mite',B.x+Math.cos(a)*(B.r+20),B.y+Math.sin(a)*(B.r+20),{spawn:15,bubMul:.6});}
  }else{
    if(B.t%64===0){const n=26,gap=R()*TAU;for(let k=0;k<n;k++){const a=k*TAU/n;if(Math.abs(angDiff(a,gap))<.45)continue;ebul(B.x,B.y,a,2.5,7,dm,COL.rd);}SFX.bshot();}
    if(B.t%14===0)ebul(B.x,B.y,aP+rr(-.08,.08),3.8,5,dm*.8,COL.gd);
  }
  if(B.phase<3)for(const n of B.nodes){if(n.dead)continue;if(--n.cd<=0){n.cd=rr(130,190);ebul(n.x,n.y,Math.atan2(P.y-n.y,P.x-n.x),3,5,dm*.8,COL.or);}}
  if(dist2(B.x,B.y,P.x,P.y)<(B.r+P.r*.8)**2){hurtPlayer(dm*1.8*dmgMul(),B.x,B.y);const d=Math.hypot(P.x-B.x,P.y-B.y)||1;P.vx+=(P.x-B.x)/d*7;P.vy+=(P.y-B.y)/d*7;}
}
function bossDie(){
  const B=G.boss;B.dead=true;G.state='victory';G.vicT=0;G.timeScale=.4;
  for(const b of G.eb)sparks(b.x,b.y,b.col,1,1.5,12);G.eb=[];
  for(const e of G.en)if(!e.dead){e.dead=true;shards(e.x,e.y,e.d.col,6,3,e.r);}G.en=[];
  SFX.phase();shake(1);G.glitch=30;banner('Noyau brisé','',COL.gd,160);gsBoss(3);giDrop(0,0,'boss',1);giDrop(0,0,'rift',1);
}
function updVictory(){
  G.vicT++;const B=G.boss;
  if(G.vicT<100&&G.vicT%5===0){const x=B.x+fr(-B.r,B.r),y=B.y+fr(-B.r,B.r);shards(x,y,[COL.rd,COL.mg,COL.gd][G.vicT%3],10,5,20);ringFX(x,y,10,80,COL.wh,20,3);SFX.pop(true);shake(.3);}
  if(G.vicT===100){B.gone=true;G.flash=1;shake(1);SFX.boom();ringFX(B.x,B.y,20,600,COL.wh,50,8);shards(B.x,B.y,COL.rd,60,9,40);sparks(B.x,B.y,COL.gd,80,10);G.timeScale=1;}
  if(G.vicT>100){G.vacuum=true;updPickups();}
  if(G.vicT===190)endRun(true);
}
function die(){
  const P=G.p;G.state='dying';G.dieT=0;cv.classList.add('dying');G.timeScale=.35;P.dead=true;SFX.death();shake(1);G.glitch=40;
  shards(P.x,P.y,P.col,30,6,P.r);sparks(P.x,P.y,P.col,40,7);ringFX(P.x,P.y,P.r,P.r*8,P.col,50,5);
}
function updDying(){
  G.dieT++;const P=G.p;
  if(G.dieT<60&&G.dieT%10===0){shards(P.x+fr(-20,20),P.y+fr(-20,20),P.col,12,5,P.r);SFX.pop(true);}
  if(G.dieT===95){G.timeScale=1;endRun(false);}
}

/* ---------- choix d'évolution ---------- */
function rollChoices(isMut){
  const P=G.p;
  if(isMut){const pool=shuffle(MUT.filter(m=>!P.muts.includes(m.id)));return pool.slice(0,2).map(u=>({mut:true,u}));}
  const pool=shuffle(UPG.filter(u=>(P.evo[u.id]||0)<u.max));
  const a=pool[0],b=pool.find(u=>u!==a&&u.c!==a.c)||pool[1];
  return [a,b].filter(Boolean).map(u=>({mut:false,u}));
}
function applyChoice(ch){const P=G.p;ch.u.f(P);if(ch.mut)P.muts.push(ch.u.id);else P.evo[ch.u.id]=(P.evo[ch.u.id]||0)+1;}

/* ---------- fin de partie ---------- */
function rollArts(n){const pool=Object.keys(ARTS).filter(k=>(meta.arts[k]||0)<ARTS[k].max),r=[];while(r.length<n&&pool.length)r.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);return r;}
function endRun(win){
  if(G.state==='end')return;
  G.state='end';G.win=win;
  const secs=Math.floor(G.time/60);
  if(win){G.winBonus=5000+Math.max(0,300-secs)*30;G.score+=G.winBonus;}
  G.score=Math.round(G.score);gsEnd(win);giEnd(win);
  meta.kills+=G.kills;
  if(!G.daily&&(G.time>3600||win||G.heartsDone>0)){meta.runs++;if(win)meta.wins++;}
  if(win){unlock('boss');if(G.prof==='scout')unlock('scout');if(G.prof==='tank')unlock('tank');if(secs<300)unlock('fast');}
  if(meta.kills>=1000)unlock('kills');if(G.daily)unlock('daily');
  meta.lb.push({s:G.score,l:G.p.maxLvl,r:G.heartsDone,p:G.prof,w:win?1:0,d:G.daily?1:0,t:Date.now()});
  meta.lb.sort((a,b)=>b.s-a.s);meta.lb=meta.lb.slice(0,10);
  G.newBest=G.score>meta.best;if(G.newBest)meta.best=G.score;
  if(G.daily){const k=String(G.dayKey);if(!meta.daily[k]||G.score>meta.daily[k])meta.daily[k]=G.score;}
  G.artChoices=(!G.daily&&(win||G.heartsDone>=1||G.time>7200))?rollArts(3):[];
  G.freeArts=[];for(let i=0;i<G.newAch.length;i++){const c=rollArts(1)[0];if(c){meta.arts[c]=(meta.arts[c]||0)+1;G.freeArts.push(c);}}
  saveMeta();setMusic(0);
  if(SIMF()){window.__SIM_END&&window.__SIM_END(win);return;}
  setTimeout(showEnd,500);
}

/* ---------- boucle de simulation ---------- */
function openEvo(){G.evoAlt=null;
  const lv=G.pendingEvo.shift(),isMut=MUT_LV.includes(lv);
  G.choices=rollChoices(isMut);G.evoLv=lv;G.evoMut=isMut;
  if(!G.choices.length)return;
  if(SIMF()){applyChoice(window.__SIM_PICK?window.__SIM_PICK(G.choices):G.choices[0]);return;}
  G.state='evo';renderEvo();show('ov-evo');
}
function updFX(){
  G.trauma=Math.max(0,G.trauma-.025);if(G.glitch>0)G.glitch--;if(G.hurtT>0)G.hurtT--;if(G.flash>0)G.flash=Math.max(0,G.flash-.06);if(G.help>0)G.help--;
  if(G.comboT>0&&--G.comboT===0)G.combo=0;
  if(G.pickT>0&&--G.pickT===0)G.pickI=0;
  const P=G.p;if(P.recoil>0)P.recoil*=.7;if(P.glow>0)P.glow*=.96;
  {const F=G.fx;let w=0;for(let i=0;i<F.length;i++){const f=F[i];f.x+=f.vx;f.y+=f.vy;if(f.ty===0){f.vx*=.92;f.vy*=.92;}else if(f.ty===2){f.vx*=.95;f.vy*=.95;}if(--f.life>0)F[w++]=f;}F.length=w;}
  for(let i=G.tx.length-1;i>=0;i--){const t=G.tx[i];t.y+=t.vy;t.vy*=.96;if(--t.life<=0)G.tx.splice(i,1);}
  if(G.banner&&++G.banner.t>=G.banner.max)G.banner=null;
  for(let i=G.toasts.length-1;i>=0;i--)if(++G.toasts[i].t>170)G.toasts.splice(i,1);
}
function updCam(){
  const P=G.p,F=focusBig();
  /* avance de caméra : dans le sens du déplacement, lissée ; la visée n'influe plus (balayer la souris ne fait plus glisser l'écran) */
  G.lvx=lerp(G.lvx||0,P.dead?0:clamp(P.vx*14,-70,70),.05);G.lvy=lerp(G.lvy||0,P.dead?0:clamp(P.vy*14,-70,70),.05);
  let tx=P.x+G.lvx,ty=P.y+G.lvy;
  if(F&&!P.dead){tx=lerp(tx,F.x,.38);ty=lerp(ty,F.y,.38);}
  G.cx=lerp(G.cx,tx,.1);G.cy=lerp(G.cy,ty,.1);G.zoom=lerp(G.zoom,zoomTarget()*gvZoom(),.03);
}
function savePrev(){const P=G.p;P.px=P.x;P.py=P.y;P.pang=P.ang;G.pcx=G.cx;G.pcy=G.cy;G.pzoom=G.zoom;
  const sv=a=>{for(let i=0;i<a.length;i++){const o=a[i];o.px=o.x;o.py=o.y;}};sv(G.en);sv(G.pb);sv(G.eb);sv(G.pk);sv(G.fx);
  const B=G.boss;if(B){B.px=B.x;B.py=B.y;sv(B.nodes);}for(const h of G.hearts)sv(h.nodes);}
function step(){
  G.t++;savePrev();
  if(G.freeze>0){G.freeze--;G.trauma=Math.max(0,G.trauma-.01);return;}
  if(SIMF()){if(window.__SIM_INPUT)window.__SIM_INPUT();}else readInput();
  const s=G.state;
  if(s==='play'){updPlayer();updWeapons();if(!(G.tstop>0))updEnemies();updHearts();updBoss();
    if(G.tstop>0){const eb=G.eb;G.eb=[];updBullets();G.eb=eb;}else updBullets();
    updPickups();updWorld();gsTick();gcTick();giTick();gxTick();gtTick();gvTick();}
  else if(s==='dying'){updEnemies();updBullets();updDying();}
  else if(s==='victory'){updBullets();updVictory();}
  updFX();updCam();
  if(G.timeScale<1&&G.state==='play')G.timeScale=Math.min(1,G.timeScale+.02);
  if(G.state==='play'&&G.pendingEvo.length){if(--G.evoDelay<=0){G.evoDelay=10;openEvo();}}
}
