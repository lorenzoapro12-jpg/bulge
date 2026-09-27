/* =========================================================
   gc.js : COMBAT ET MONDE SEMI-OUVERT
   compétences (2 emplacements, 3 niveaux), ultime par vaisseau,
   ennemis élites à affixes, autels d'Iris, failles, panneaux de carrefour
   ========================================================= */
const KEYL=(typeof navigator!=='undefined'&&/^fr/i.test(navigator.language||''))?['A','E','R']:['Q','E','R'];
const SKL={
  shock:{n:'Onde de choc',ic:'◎',col:'#2de2ff',cd:[420,360,300],d:'Repousse et blesse tout autour de toi, efface les tirs ennemis. Niveau 3 : étourdit.'},
  lance:{n:'Lance',ic:'➶',col:'#ffc93c',cd:[330,280,230],d:'Rayon perçant dans la direction visée, traverse tout.'},
  trou:{n:'Singularité',ic:'◉',col:'#a45cff',cd:[660,560,460],d:'Lance un trou noir au viseur : il aspire et broie les ennemis.'},
  shield:{n:'Égide',ic:'⬡',col:'#7dff4a',cd:[660,560,460],d:'Bouclier qui absorbe tout et renvoie les tirs ennemis.'},
  salve:{n:'Salve',ic:'✶',col:'#ff8a2d',cd:[480,410,340],d:'Nuée de missiles à tête chercheuse.'},
  blink:{n:'Clignement',ic:'⟿',col:'#ff2d95',cd:[280,230,180],d:'Téléportation vers le viseur, explosion à l’arrivée.'}};
const SIG={bal:'shock',scout:'blink',tank:'shield',spectre:'lance',oracle:'salve',reine:'trou'};
const ULT={bal:{n:'Supernova',d:'Explosion géante qui ravage l’écran.'},scout:{n:'Hypervitesse',d:'Vitesse et cadence doublées, tu broies ce que tu touches.'},
  tank:{n:'Forteresse',d:'Invulnérable, aura de destruction, tirs renvoyés.'},spectre:{n:'Faille temporelle',d:'Le temps s’arrête. Tes coups sont tous critiques.'},
  oracle:{n:'Jugement',d:'La foudre frappe les ennemis les plus forts.'},reine:{n:'Nuée',d:'Six drones supplémentaires rejoignent l’essaim.'}};
const AFF={armor:{n:'Blindé',col:'#9fb4ff'},swift:{n:'Véloce',col:'#7dff4a'},split:{n:'Scindeur',col:'#ffc93c'},bomb:{n:'Instable',col:'#ff3355'},regen:{n:'Vivace',col:'#3dffa8'}};
const AFFK=Object.keys(AFF);
const ALT_Q=['« Un rêve n’a de valeur que si l’on peut en sortir. » Iris, notes du premier jour.','« J’ai donné une forme à chaque peur, pour qu’on puisse la combattre. »',
  '« Si tu lis ceci, c’est que tu doutes encore. Garde ce doute. »','« Les routes relient les souvenirs. Sans elles, chacun rêverait seul. »',
  '« Je voulais que personne ne se perde. J’ai fini par perdre tout le monde. »','« Le Noyau n’est pas cruel. Il a juste oublié comment s’arrêter. »',
  '« Chaque autel garde un peu de ma force. Prends-la. »','« Il faudra un jour que quelqu’un dise non. »'];

/* ---------- monde : panneaux, autels, failles (générés avec la carte) ---------- */
function gcWorld(rnd){
  const S=WD.sites,E=WD.edges,bySeg={};for(const s of WD.segs)(bySeg[s.e]=bySeg[s.e]||[]).push(s);
  WD.signs=[];WD.alts=[];WD.rifts=[];const deg={};E.forEach(([a,b])=>{deg[a]=(deg[a]||0)+1;deg[b]=(deg[b]||0)+1;});
  E.forEach(([a,b],ei)=>{const L=bySeg[ei];if(!L||L.length<8)return;const len=Math.hypot(S[a].x-S[b].x,S[a].y-S[b].y);
    for(const [from,to,k] of [[a,b,4],[b,a,L.length-5]]){const s=L[k];if(!s||deg[from]<3)continue;const fw=from===a,dx=fw?s.bx-s.ax:s.ax-s.bx,dy=fw?s.by-s.ay:s.ay-s.by;
      const px=fw?s.bx:s.ax,py=fw?s.by:s.ay,nl=Math.hypot(dx,dy)||1;
      WD.signs.push({x:px-dy/nl*54,y:py+dx/nl*54,a:Math.atan2(dy,dx),to:S[to].t,dist:Math.round(len*(1-4/L.length)/10)});}
    if(len>1500&&WD.alts.length<8){const s=L[Math.floor(L.length/2)];WD.alts.push({x:s.bx,y:s.by,q:WD.alts.length%ALT_Q.length});}});
  let g=0;while(WD.rifts.length<6&&g++<400){const s=WD.segs[Math.floor(rnd()*WD.segs.length)];if(s.k<3||s.k>s.n-3)continue;const x=s.bx,y=s.by;
    if(Math.hypot(x,y)<900||Math.hypot(x-WD.core.x,y-WD.core.y)<1400)continue;let ok=true;
    for(const A of WD.alts)if(dist2(A.x,A.y,x,y)<900*900)ok=false;for(const R of WD.rifts)if(dist2(R.x,R.y,x,y)<1800*1800)ok=false;for(const L of WD.lms)if(dist2(L.x,L.y,x,y)<700*700)ok=false;
    if(ok)WD.rifts.push({x,y});}
}

/* ---------- état de partie ---------- */
function gcRunStart(){
  const P=G.p,sig=SIG[G.prof]||'shock';
  P.sk=[{id:sig,l:1,cd:0},null];P.evo['sk_'+sig]=1;P.ultC=0;P.cdMul=1;P.ultA=null;P.shieldT=0;
  G.gc={beams:[],holes:[],bolts:[],bombs:[],strikes:[],altUsed:{},riftDone:{},altT:0,altI:-1,rift:null,ultFlash:0,firstRift:0};
  G.tstop=0;
}
function aimWorld(maxD){
  const P=G.p;let x,y;
  if(!inp.touch&&performance.now()-inp.mt<4000){x=CAM.x+(inp.mx-W/2)/RZ;y=CAM.y+(inp.my-H/2)/RZ;}
  else{x=P.x+Math.cos(P.ang)*maxD*.8;y=P.y+Math.sin(P.ang)*maxD*.8;}
  const dx=x-P.x,dy=y-P.y,d=Math.hypot(dx,dy);if(d>maxD){x=P.x+dx/d*maxD;y=P.y+dy/d*maxD;}
  return[x,y];
}
function dmgAll(x,y,R,dm,push,stun){
  for(const e of G.en){if(e.dead||e.spawn>0)continue;const dx=e.x-x,dy=e.y-y,d=Math.hypot(dx,dy);if(d>R+e.r)continue;
    hurtEnemy(e,dm,push?dx/(d||1)*push:0,push?dy/(d||1)*push:0,true);if(stun)e.stun=stun;}
  for(const B of BIGS())if(bigHittable(B)&&dist2(B.x,B.y,x,y)<(R+B.r)**2)hurtBig(B,dm,true);
}
function clearEB(x,y,R){for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,x,y)<R*R){sparks(b.x,b.y,b.col,2,2,12);G.eb.splice(i,1);}}}
function gcUse(i){
  if(!G||G.state!=='play'||!G.gc)return;const P=G.p;if(P.dead)return;const s=P.sk[i];if(!s||s.cd>0)return;
  const K=SKL[s.id],l=s.l,dm=P.dmg*lvlDmg()*(P.skM||1),col=K.col;s.cd=Math.round(K.cd[l-1]*P.cdMul);
  if(s.id==='shock'){const R=[190,240,300][l-1];dmgAll(P.x,P.y,R,dm*[6,9,13][l-1],14,l>=3?80:0);clearEB(P.x,P.y,R);
    ringFX(P.x,P.y,P.r,R,col,22,8);ringFX(P.x,P.y,P.r,R*.7,'#fff',16,3);FX({ty:4,x:P.x,y:P.y,vx:0,vy:0,r:R*1.3,life:18,max:18,col});shake(.35);SFX.phase();}
  else if(s.id==='lance'){const a=P.ang,Ln=950,w=[26,34,44][l-1],ca=Math.cos(a),sa=Math.sin(a),dd=dm*[8,12,17][l-1];
    for(const e of G.en){if(e.dead||e.spawn>0)continue;const rx=e.x-P.x,ry=e.y-P.y,t=rx*ca+ry*sa;if(t<0||t>Ln)continue;if(Math.abs(-rx*sa+ry*ca)<w+e.r)hurtEnemy(e,dd,ca*8,sa*8,true);}
    for(const B of BIGS()){if(!bigHittable(B))continue;const rx=B.x-P.x,ry=B.y-P.y,t=rx*ca+ry*sa;if(t>0&&t<Ln&&Math.abs(-rx*sa+ry*ca)<w+B.r)hurtBig(B,dd,true);}
    G.gc.beams.push({x:P.x,y:P.y,a,len:Ln,w,life:20,max:20,col});P.recoil=8;P.vx-=ca*3;P.vy-=sa*3;shake(.3);SFX.dash();sparks(P.x+ca*30,P.y+sa*30,col,14,6);}
  else if(s.id==='trou'){const [x,y]=aimWorld(520);G.gc.holes.push({x,y,r:[150,190,240][l-1],t:[180,210,250][l-1],max:[180,210,250][l-1],dm:dm*[.9,1.2,1.6][l-1]});SFX.phase();ringFX(x,y,10,120,col,20,4);}
  else if(s.id==='shield'){P.shieldT=[180,240,300][l-1];P.shieldL=l;ringFX(P.x,P.y,P.r,P.r+40,col,16,4);SFX.evo();}
  else if(s.id==='salve'){const n=[8,12,16][l-1];for(let k=0;k<n;k++){const a=P.ang+(k/(n-1)-.5)*2.4;pbul(P.x+Math.cos(a)*P.r,P.y+Math.sin(a)*P.r,a,{dmg:dm*[2.2,2.7,3.3][l-1],r:4.5,col:col,home:.16,pierce:0,split:0,rico:0,life:120});}SFX.dash();}
  else if(s.id==='blink'){let [x,y]=aimWorld([260,340,420][l-1]);const x0=P.x,y0=P.y;
    for(let k=0;k<12&&(pointHit(x,y,P.r)||Math.hypot(x,y)>WR-P.r-20);k++){x=lerp(x,x0,.2);y=lerp(y,y0,.2);}
    for(let k=0;k<6;k++)FX({ty:0,x:lerp(x0,x,k/6),y:lerp(y0,y,k/6),vx:0,vy:0,life:18,max:18,col,s:P.r*.8});
    P.x=x;P.y=y;P.px=x;P.py=y;P.inv=Math.max(P.inv,20);const R=[120,150,190][l-1];dmgAll(x,y,R,dm*[5,7,10][l-1],10,0);clearEB(x,y,R*.8);
    ringFX(x,y,P.r,R,col,18,6);FX({ty:4,x,y,vx:0,vy:0,r:R*1.4,life:16,max:16,col});shake(.3);SFX.dash();}
  if(G.gs)G.gs.skillUse=(G.gs.skillUse||0)+1;giEcho(i);
}
function gcUlt(){
  if(!G||G.state!=='play'||!G.gc)return;const P=G.p;if(P.dead||P.ultC<100||P.ultA)return;
  P.ultC=0;if(P.u&&P.u.pacte){P.bub=Math.max(1,P.bub-10);checkLevel();}const k=G.prof,dm=P.dmg*lvlDmg(),U=ULT[k]||ULT.bal;G.gc.ultFlash=40;
  SFX.bossIn();G.glitch=Math.max(G.glitch,16);
  if(k==='scout'){P.ultA={k,t:360};P.bSpd=P.spd;P.bFire=P.fireI;P.spd*=1.6;P.fireI=Math.max(2,P.fireI*.5);P.uSpd=P.spd;P.uFire=P.fireI;}
  else if(k==='tank')P.ultA={k,t:360};
  else if(k==='spectre'){P.ultA={k,t:300};G.tstop=300;P.bCrit=P.crit;P.crit=1;}
  else if(k==='oracle'){const T=G.en.filter(e=>!e.dead&&e.spawn<=0&&dist2(e.x,e.y,P.x,P.y)<950*950).sort((a,b)=>b.hp-a.hp).slice(0,10);G.gc.strikes=T.map((e,i)=>({e,t:i*7}));
    for(const B of BIGS())if(bigHittable(B)&&dist2(B.x,B.y,P.x,P.y)<1100*1100)G.gc.strikes.push({e:B,t:G.gc.strikes.length*7,big:1});P.ultA={k,t:90};}
  else if(k==='reine'){P.ultA={k,t:480};P.drones+=6;}
  else{const R=560;dmgAll(P.x,P.y,R,dm*28,20,0);for(const B of BIGS())if(bigHittable(B)&&dist2(B.x,B.y,P.x,P.y)<(R+B.r)**2)hurtBig(B,dm*14,true);clearEB(P.x,P.y,R);
    ringFX(P.x,P.y,20,R,'#ffffff',40,12);ringFX(P.x,P.y,20,R*.8,P.col,34,8);FX({ty:4,x:P.x,y:P.y,vx:0,vy:0,r:900,life:40,max:40,col:P.col});G.flash=.55;shake(1);G.freeze=Math.max(G.freeze,4);P.ultA={k,t:30};}
}
function gcEndUlt(){const P=G.p,A=P.ultA;if(!A)return;
  if(A.k==='scout'){P.spd=P.bSpd*P.spd/P.uSpd;P.fireI=P.bFire*P.fireI/P.uFire;}if(A.k==='spectre'){P.crit=P.bCrit+P.crit-1;G.tstop=0;}if(A.k==='reine')P.drones=Math.max(0,P.drones-6);P.ultA=null;}
/* bouclier et ultimes défensifs : appelé au début de hurtPlayer */
function gcShield(dmg,sx,sy){const P=G.p;
  if(P.shieldT>0||(P.ultA&&(P.ultA.k==='tank'||P.ultA.k==='scout'))){sparks(P.x,P.y,'#7dff4a',6,3);return true;}return false;}
function gcKill(e){const P=G.p;if(!P||P.ultA)return;
  P.ultC=Math.min(100,(P.ultC||0)+(e.aff?10:1.6)*(P.ultM||1));
  if(e.aff==='split')for(let k=0;k<3;k++){const a=k*TAU/3;const m=mkEnemy('mite',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,{aggro:true,noElite:true,spawn:6});m.vx=Math.cos(a)*4;m.vy=Math.sin(a)*4;}
  if(e.aff==='bomb')G.gc.bombs.push({x:e.x,y:e.y,t:45,max:45,r:140});
  if(e.aff){gsShard&&gsShard(2);ringFX(e.x,e.y,e.r,e.r*3,AFF[e.aff].col,16,3);}
}
function gcElite(e,opt){
  if(!G||!G.gc||(opt&&opt.noElite)||e.t==='mite'||e.t==='cache'||e.t==='life')return;
  const ch=G.gc.rift?.28:Math.min(.14,.03+.025*(G.room-1));if(R()>=ch)return;
  const k=AFFK[Math.floor(R()*AFFK.length)];e.aff=k;e.d=Object.assign({},e.d);e.hp*=2.2;e.mhp=e.hp;e.bubMul*=3;e.r*=1.12;
  if(k==='swift')e.d.spd*=1.45;
}

/* ---------- boucle ---------- */
function gcTick(){
  const C=G.gc;if(!C)return;const P=G.p,dm=P.dmg*lvlDmg();
  for(const s of P.sk)if(s&&s.cd>0)s.cd--;
  if(P.shieldT>0){P.shieldT--;const Rr=P.r+30;
    for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,P.x,P.y)<Rr*Rr){G.eb.splice(i,1);const a=Math.atan2(b.y-P.y,b.x-P.x);pbul(b.x,b.y,a,{dmg:dm*1.5,r:4,col:'#7dff4a',home:.08,pierce:0,split:0,rico:0});}}}
  const A=P.ultA;
  if(A){A.t--;
    if(A.k==='scout'||A.k==='tank'){P.inv=Math.max(P.inv,2);}
    if(A.k==='scout'&&G.t%5===0)for(const e of G.en)if(!e.dead&&e.spawn<=0&&dist2(e.x,e.y,P.x,P.y)<(P.r+e.r+10)**2)hurtEnemy(e,dm*2.5,(e.x-P.x)*.1,(e.y-P.y)*.1,true);
    if(A.k==='tank'){if(G.t%10===0){dmgAll(P.x,P.y,190,dm*2,3,0);ringFX(P.x,P.y,P.r,190,P.col,12,2);}
      for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,P.x,P.y)<(P.r+60)**2){G.eb.splice(i,1);pbul(b.x,b.y,Math.atan2(b.y-P.y,b.x-P.x),{dmg:dm*1.5,r:4,col:P.col,home:.08,pierce:0,split:0,rico:0});}}}
    if(A.t<=0)gcEndUlt();}
  if(G.tstop>0)G.tstop--;
  for(let i=C.strikes.length-1;i>=0;i--){const S=C.strikes[i];if(--S.t>0)continue;C.strikes.splice(i,1);const e=S.e;if(e.dead||(S.big&&!bigHittable(e)))continue;
    if(S.big)hurtBig(e,dm*10,true);else{hurtEnemy(e,dm*14,0,0,true);for(const o of G.en)if(o!==e&&!o.dead&&dist2(o.x,o.y,e.x,e.y)<170*170){hurtEnemy(o,dm*5,0,0,true);C.bolts.push({x0:e.x,y0:e.y,x1:o.x,y1:o.y,life:10,max:10,s:R()*99});}}
    C.bolts.push({x0:e.x+rr(-60,60),y0:e.y-700,x1:e.x,y1:e.y,life:14,max:14,s:R()*99});ringFX(e.x,e.y,5,70,'#b9f3ff',14,3);shake(.12);SFX.hit();}
  for(let i=C.holes.length-1;i>=0;i--){const h=C.holes[i];if(--h.t<=0){ringFX(h.x,h.y,h.r,10,'#a45cff',14,4);C.holes.splice(i,1);continue;}
    for(const e of G.en){if(e.dead||e.spawn>0)continue;const dx=h.x-e.x,dy=h.y-e.y,d=Math.hypot(dx,dy);if(d>h.r*1.7||d<1)continue;const f=(e.r>24?.25:.9)*(1-d/(h.r*1.7));e.vx+=dx/d*f;e.vy+=dy/d*f;e.x+=dx/d*f*2;e.y+=dy/d*f*2;}
    if(G.t%10===0)dmgAll(h.x,h.y,h.r*.55,h.dm,0,0);clearEB(h.x,h.y,h.r*.4);}
  for(let i=C.bombs.length-1;i>=0;i--){const b=C.bombs[i];if(--b.t>0)continue;C.bombs.splice(i,1);ringFX(b.x,b.y,10,b.r,COL.rd,18,6);FX({ty:4,x:b.x,y:b.y,vx:0,vy:0,r:b.r*1.6,life:16,max:16,col:COL.rd});shake(.3);SFX.pop(true);
    if(dist2(b.x,b.y,P.x,P.y)<(b.r+P.r)**2)hurtPlayer(9*dmgMul(),b.x,b.y);}
  for(const L of [C.beams,C.bolts])for(let i=L.length-1;i>=0;i--)if(--L[i].life<=0)L.splice(i,1);
  if(C.ultFlash>0)C.ultFlash--;if(C.gift>0&&G.state==='play'&&--C.gift===0)openAltar(-1);
  if(G.t%30===0)for(const e of G.en)if(e.aff==='regen'&&!e.dead)e.hp=Math.min(e.mhp,e.hp+e.mhp*.04);
  /* autels */
  let near=-1;for(let i=0;i<WD.alts.length;i++){if(C.altUsed[i])continue;const a=WD.alts[i];if(dist2(a.x,a.y,P.x,P.y)<95*95){near=i;break;}}
  if(near>=0&&near===C.altI){if(++C.altT>=45){C.altUsed[near]=1;C.altT=0;C.altI=-1;openAltar(near);}}else{C.altI=near;C.altT=0;}
  /* failles */
  const Rf=C.rift;
  if(Rf){Rf.t++;const d=Math.hypot(P.x-Rf.x,P.y-Rf.y);
    if(d>Rf.r+30){C.rift=null;banner('Faille refermée','Tu es sorti du cercle',COL.mg,110);G.glitch=18;SFX.hurt();}
    else{if(Rf.t%36===0){let n=0;for(const e of G.en)if(!e.dead&&e.rift)n++;if(n<16){const ks=['pop','spread','orbit','ring','mite','spike'],a=R()*TAU;
        const e=mkEnemy(ks[Math.floor(R()*ks.length)],Rf.x+Math.cos(a)*(Rf.r-30),Rf.y+Math.sin(a)*(Rf.r-30),{aggro:true,rift:1});e.spawn=24;}}
      if(Rf.t>=Rf.dur){C.rift=null;C.riftDone[Rf.i]=1;for(const e of G.en)if(e.rift&&!e.dead)killEnemy(e);
        P.ultC=100;gsShard&&gsShard(15);giDrop(Rf.x,Rf.y,'rift');dropBubbles(Rf.x,Rf.y,Math.round(30*P.greed),60,false);ringFX(Rf.x,Rf.y,20,Rf.r,COL.gd,30,8);G.flash=.4;
        banner('Faille scellée','Ultime chargé · don de l’autel',COL.gd,120);SFX.ach();C.gift=24;}}}
  else if(G.t%6===0&&!C.dorm)for(let i=0;i<WD.rifts.length;i++){if(C.riftDone[i])continue;const f=WD.rifts[i];if(dist2(f.x,f.y,P.x,P.y)<80*80&&!G.arena){
    C.rift={x:f.x,y:f.y,r:430,t:0,dur:1200,i};banner('Faille','Tiens 20 secondes dans le cercle',COL.mg,110);G.glitch=24;SFX.bossIn();
    if(!C.firstRift&&G.gs){C.firstRift=1;gsSay('Les failles sont des blessures du rêve. Scelle-la.','',COL.mg,1,1);}break;}}
}
function openAltar(i){
  const P=G.p,ch=[],have=P.sk.filter(Boolean).map(s=>s.id);
  if(i>=0&&G.gs)gsSay(ALT_Q[WD.alts[i].q],'Autel d’Iris',COL.gd,1,1);
  if(!P.sk[1]){const pool=shuffle(Object.keys(SKL).filter(k=>!have.includes(k))).slice(0,2);
    for(const k of pool)ch.push({u:{id:'nsk_'+k,n:SKL[k].n,ic:SKL[k].ic,c:'Nouvelle compétence · '+KEYL[1],d:SKL[k].d,f:P=>{P.sk[1]={id:k,l:1,cd:0};P.evo['sk_'+k]=1;}}});}
  for(let j=0;j<2&&ch.length<3;j++){const s=P.sk[j];if(!s||s.l>=3)continue;const K=SKL[s.id];
    ch.push({u:{id:'sk_'+s.id,n:K.n,ic:K.ic,c:'Amélioration · '+KEYL[j],d:'Niveau '+(s.l+1)+' : plus de dégâts, de portée, recharge plus courte.',f:P=>{s.l++;}}});}
  if(ch.length<3)ch.push({u:{id:'alt_cd',n:'Esprit vif',ic:'⧗',c:'Don',d:'Recharge des compétences -15 %.',f:P=>{P.cdMul*=.85;}}});
  if(ch.length<3)ch.push({u:{id:'alt_ult',n:'Braise d’ultime',ic:'✹',c:'Don',d:'+60 % de charge d’ultime immédiatement.',f:P=>{P.ultC=Math.min(100,P.ultC+60);}}});
  G.choices=ch.slice(0,3);G.evoAlt=i>=0?['Autel d’Iris','Choisis un don pour ce cycle']:['Faille scellée','L’autel intérieur t’offre un don'];
  if(SIMF()){applyChoice(G.choices[0]);return;}
  G.state='evo';renderEvo();show('ov-evo');SFX.evo();
}

/* ---------- rendu ---------- */
function gcDrawUnder(){
  const C=G.gc;if(!C)return;const c=ctx;
  for(const e of G.en){if(!e.aff||e.dead||!vis(e.x,e.y,e.r+30))continue;const A=AFF[e.aff],p=.5+.5*Math.sin(RT*.15+e.wob);
    c.globalAlpha=.55+.3*p;c.strokeStyle=A.col;c.lineWidth=3;c.beginPath();
    if(e.aff==='armor'){for(let k=0;k<6;k++){const a=k*TAU/6+RT*.01,x=e.x+Math.cos(a)*(e.r+11),y=e.y+Math.sin(a)*(e.r+11);k?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}
    else c.arc(e.x,e.y,e.r+9+p*3,0,TAU);
    c.stroke();c.globalAlpha=1;}
  for(const h of C.holes){if(!vis(h.x,h.y,h.r*1.7))continue;const k=Math.min(1,h.t/20,(h.max-h.t)/10+.2);
    c.globalAlpha=.85*k;c.fillStyle='#05020c';c.beginPath();c.arc(h.x,h.y,h.r*.45,0,TAU);c.fill();
    c.strokeStyle='#a45cff';c.lineWidth=4;for(let j=0;j<3;j++){c.beginPath();c.arc(h.x,h.y,h.r*(.55+j*.28),RT*.08*(j%2?-1:1)+j,RT*.08*(j%2?-1:1)+j+4.2);c.stroke();}c.globalAlpha=1;}
  for(const b of C.bombs){const k=1-b.t/b.max;c.globalAlpha=.25+.5*k;c.strokeStyle=COL.rd;c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.arc(b.x,b.y,b.r,0,TAU);c.stroke();c.setLineDash([]);
    c.fillStyle=COL.rd;c.globalAlpha=.12+.2*k;c.beginPath();c.arc(b.x,b.y,b.r*k,0,TAU);c.fill();c.globalAlpha=1;}
  const Rf=C.rift;if(Rf){const k=Rf.t/Rf.dur;c.strokeStyle=COL.mg;c.lineWidth=5;c.globalAlpha=.7;c.setLineDash([22,14]);c.lineDashOffset=-RT;c.beginPath();c.arc(Rf.x,Rf.y,Rf.r,0,TAU);c.stroke();c.setLineDash([]);
    c.strokeStyle=COL.gd;c.lineWidth=8;c.globalAlpha=.8;c.beginPath();c.arc(Rf.x,Rf.y,Rf.r+14,-Math.PI/2,-Math.PI/2+TAU*k);c.stroke();c.globalAlpha=1;}
}
function gcDrawOver(){
  const C=G.gc;if(!C)return;const c=ctx,P=G.p;
  for(const b of C.beams){const k=b.life/b.max;c.save();c.translate(b.x,b.y);c.rotate(b.a);c.globalCompositeOperation='lighter';
    c.fillStyle=b.col;c.globalAlpha=.35*k;c.fillRect(0,-b.w*1.4,b.len,b.w*2.8);c.globalAlpha=.9*k;c.fillRect(0,-b.w*.45,b.len,b.w*.9);c.fillStyle='#fff';c.fillRect(0,-b.w*.15,b.len,b.w*.3);c.restore();c.globalCompositeOperation='source-over';c.globalAlpha=1;}
  c.lineCap='round';
  for(const b of C.bolts){const k=b.life/b.max;c.globalCompositeOperation='lighter';c.strokeStyle='#b9f3ff';c.globalAlpha=k;c.lineWidth=5*k+1;c.beginPath();c.moveTo(b.x0,b.y0);
    for(let j=1;j<8;j++){const t=j/8;c.lineTo(lerp(b.x0,b.x1,t)+Math.sin(b.s+j*7.1)*28,lerp(b.y0,b.y1,t)+Math.cos(b.s+j*3.3)*12);}c.lineTo(b.x1,b.y1);c.stroke();c.globalCompositeOperation='source-over';c.globalAlpha=1;}
  if(P.shieldT>0||P.ultA&&P.ultA.k==='tank'){const k=P.shieldT>0?Math.min(1,P.shieldT/30):1;c.globalAlpha=.3*k+.1*Math.sin(RT*.3);c.fillStyle='#7dff4a';c.beginPath();c.arc(P.x,P.y,P.r+28,0,TAU);c.fill();
    c.globalAlpha=.9*k;c.strokeStyle='#caffb0';c.lineWidth=3;c.beginPath();for(let j=0;j<6;j++){const a=j*TAU/6+RT*.02;const x=P.x+Math.cos(a)*(P.r+30),y=P.y+Math.sin(a)*(P.r+30);j?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.stroke();c.globalAlpha=1;}
  if(P.ultA&&P.ultA.k==='scout'&&G.t%2===0)FX({ty:0,x:P.x,y:P.y,vx:0,vy:0,life:16,max:16,col:P.col,s:P.r});
}
function gcDrawWorld(){
  const c=ctx,C=G.gc;
  for(const s of WD.signs){if(!vis(s.x,s.y,160))continue;const sd=dist2(s.x,s.y,G.p.x,G.p.y);if(sd>600*600)continue;const B=BIO[s.to]||BIO.plains;c.globalAlpha=Math.min(1,(600*600-sd)/(250*250));
    c.fillStyle='rgba(8,4,18,.8)';c.fillRect(s.x-3,s.y-36,6,40);c.save();c.translate(s.x,s.y-44);
    const ca=Math.cos(s.a),left=ca<0,txt=s.txt||(s.txt=B.n+' · '+s.dist+' m');c.font='700 13px '+FD;const w=s.w||(s.w=c.measureText(txt).width+34);
    c.fillStyle='rgba(8,4,18,.86)';c.strokeStyle=B.a;c.lineWidth=2;c.beginPath();
    if(left){c.moveTo(-w/2,0);c.lineTo(-w/2+12,-13);c.lineTo(w/2,-13);c.lineTo(w/2,13);c.lineTo(-w/2+12,13);}else{c.moveTo(w/2,0);c.lineTo(w/2-12,-13);c.lineTo(-w/2,-13);c.lineTo(-w/2,13);c.lineTo(w/2-12,13);}
    c.closePath();c.fill();c.stroke();c.fillStyle=B.a;c.textAlign='center';c.textBaseline='middle';c.fillText(txt,left?6:-6,1);c.restore();c.globalAlpha=1;}
  for(let i=0;i<WD.alts.length;i++){const a=WD.alts[i];if(!vis(a.x,a.y,120))continue;const used=C&&C.altUsed[i],p=.5+.5*Math.sin(RT*.07+i);
    c.globalAlpha=used?.35:1;c.fillStyle='rgba(10,6,20,.9)';c.strokeStyle=COL.gd;c.lineWidth=2.5;c.beginPath();c.moveTo(a.x,a.y-64);c.lineTo(a.x+20,a.y-10);c.lineTo(a.x,a.y+6);c.lineTo(a.x-20,a.y-10);c.closePath();c.fill();c.stroke();
    if(!used){c.globalCompositeOperation='lighter';glow(a.x,a.y-30,46,COL.gd,.35+.25*p);c.globalCompositeOperation='source-over';
      c.save();c.translate(a.x,a.y-30);c.rotate(RT*.03);c.strokeStyle='#fff3c4';c.lineWidth=2;c.strokeRect(-7,-7,14,14);c.restore();
      c.strokeStyle=COL.gd;c.globalAlpha=.4+.3*p;c.lineWidth=2;c.setLineDash([8,8]);c.beginPath();c.arc(a.x,a.y,95,0,TAU);c.stroke();c.setLineDash([]);
      if(C&&C.altI===i&&C.altT>0){c.globalAlpha=1;c.lineWidth=6;c.beginPath();c.arc(a.x,a.y,95,-Math.PI/2,-Math.PI/2+TAU*C.altT/45);c.stroke();}
      if(dist2(a.x,a.y,G.p.x,G.p.y)<350*350){c.globalAlpha=.9;c.font='700 12px '+FD;c.fillStyle=COL.gd;c.textAlign='center';c.fillText('AUTEL',a.x,a.y-82);}}
    c.globalAlpha=1;}
  for(let i=0;i<WD.rifts.length;i++){const f=WD.rifts[i];if(!vis(f.x,f.y,120)||(C&&(C.riftDone[i]||C.dorm)))continue;const act=C&&C.rift&&C.rift.i===i;
    c.save();c.translate(f.x,f.y);c.globalCompositeOperation='lighter';
    for(let j=0;j<3;j++){c.rotate(RT*.02*(j+1));c.strokeStyle=j===1?COL.vi:COL.mg;c.globalAlpha=.7;c.lineWidth=4-j;c.beginPath();for(let k=0;k<=9;k++){const a=k/9*TAU,r=46+(k%2?14:-6)+j*10;k?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.stroke();}
    c.restore();c.globalCompositeOperation='source-over';c.globalAlpha=1;
    if(!act&&dist2(f.x,f.y,G.p.x,G.p.y)<400*400){c.font='700 12px '+FD;c.fillStyle=COL.mg;c.textAlign='center';c.fillText('FAILLE',f.x,f.y-80);}}
}
function gcSlots(){
  if(inp.touch)return[{x:W-148,y:H-58,r:27},{x:W-136,y:H-140,r:27},{x:W-56,y:H-176,r:31}];
  const cx=W/2,y=H-58;return[{x:cx-72,y,r:28},{x:cx,y,r:28},{x:cx+78,y,r:33}];
}
function gcHUD(){
  const P=G.p;if(!P.sk)return;const c=ctx,S=gcSlots();c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<3;i++){const s=S[i],isU=i===2,sk=isU?null:P.sk[i];
    const pressed=inp.B&&inp.B.b===(i===2?'ult':i);c.globalAlpha=.9;c.fillStyle=pressed?'rgba(45,226,255,.35)':'rgba(8,4,18,.82)';c.beginPath();c.arc(s.x,s.y,s.r*(pressed?1.1:1),0,TAU);c.fill();
    if(isU){const f=(P.ultC||0)/100,ready=f>=1&&!P.ultA;c.strokeStyle=ready?COL.gd:'rgba(255,201,60,.35)';c.lineWidth=5;c.beginPath();c.arc(s.x,s.y,s.r-2,-Math.PI/2,-Math.PI/2+TAU*f);c.stroke();
      if(ready){c.globalCompositeOperation='lighter';glow(s.x,s.y,s.r*1.8,COL.gd,.35+.2*Math.sin(RT*.2));c.globalCompositeOperation='source-over';}
      c.globalAlpha=1;c.font='700 20px '+FD;c.fillStyle=ready?'#fff':'#9d95c9';c.fillText('✹',s.x,s.y-2);c.font='700 10px '+FD;c.fillStyle=COL.gd;c.fillText(ready?'ULTIME':Math.floor(f*100)+' %',s.x,s.y+s.r+10);}
    else if(sk){const K=SKL[sk.id],cdm=Math.round(K.cd[sk.l-1]*P.cdMul),f=sk.cd/cdm;c.strokeStyle=K.col;c.lineWidth=2.5;c.beginPath();c.arc(s.x,s.y,s.r-1,0,TAU);c.stroke();
      c.globalAlpha=1;c.font='700 20px '+FD;c.fillStyle=f>0?'#6d6890':K.col;c.fillText(K.ic,s.x,s.y-1);
      if(f>0){c.fillStyle='rgba(8,4,18,.6)';c.beginPath();c.moveTo(s.x,s.y);c.arc(s.x,s.y,s.r-3,-Math.PI/2,-Math.PI/2+TAU*f);c.closePath();c.fill();c.fillStyle='#fff';c.font='700 13px '+FD;c.fillText(Math.ceil(sk.cd/60),s.x,s.y);}
      c.fillStyle=K.col;for(let j=0;j<3;j++){c.globalAlpha=j<sk.l?1:.25;c.beginPath();c.arc(s.x-8+j*8,s.y+s.r+8,2.6,0,TAU);c.fill();}}
    else{c.globalAlpha=.5;c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1.5;c.setLineDash([4,4]);c.beginPath();c.arc(s.x,s.y,s.r-1,0,TAU);c.stroke();c.setLineDash([]);c.font='700 9px '+FD;c.fillStyle='#9d95c9';c.fillText('AUTEL',s.x,s.y);}
    if(!inp.touch){c.globalAlpha=.9;c.font='700 11px '+FD;c.fillStyle='#fff';c.fillText(KEYL[i],s.x-s.r+2,s.y-s.r+2);}
    c.globalAlpha=1;}
  const Rf=G.gc.rift;if(Rf){fitFont(c,'Faille : 20 s · reste dans le cercle',W-30,16,'700');c.fillStyle=COL.mg;c.fillText('Faille : '+Math.ceil((Rf.dur-Rf.t)/60)+' s · reste dans le cercle',W/2,W<600?222:86);}
  cssOp('tfrz',G.tstop>0?.28:0);
  if(G.tstop>0){c.font='700 14px '+FD;c.fillStyle='#b9dcff';c.fillText('Temps figé : '+Math.ceil(G.tstop/60)+' s',W/2,W<600?222:108);}
}
function gcTouch(x,y){const S=gcSlots();for(let i=0;i<3;i++){const s=S[i];if(Math.hypot(x-s.x,y-s.y)<s.r+12){if(i===2)gcUlt();else gcUse(i);return true;}}return false;}
function gcMini(x,y,k){const c=ctx;
  c.fillStyle=COL.gd;for(let i=0;i<WD.alts.length;i++){if(G.gc&&G.gc.altUsed[i])continue;const a=WD.alts[i];c.fillRect(x+(a.x+WR)*k-1.5,y+(a.y+WR)*k-1.5,3,3);}
  c.fillStyle=COL.mg;for(let i=0;i<WD.rifts.length;i++){if(G.gc&&(G.gc.riftDone[i]||G.gc.dorm))continue;const f=WD.rifts[i];c.beginPath();c.arc(x+(f.x+WR)*k,y+(f.y+WR)*k,2.4,0,TAU);c.fill();}}

/* ---------- ambiance de biome : teinte continue + fondu à l'entrée ---------- */
function biomeWash(b){const B=BIO[b];if(!B)return;const t=$('vig'),w=$('wash');if(t)t.style.backgroundColor=rgba(B.a,.07);
  if(w&&!RM){w.style.setProperty('--c',B.a);w.classList.remove('go');void w.offsetWidth;w.classList.add('go');}}
