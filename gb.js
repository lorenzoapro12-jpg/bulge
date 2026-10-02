/* =========================================================
   BOSS : un par îlot. Le boss est l'ennemi de l'îlot, en géant (même forme, même couleur).
   Toute attaque est ANNONCÉE avant de frapper : trait de visée, bande de charge, anneau au sol
   (G.tele, dessinés par g3.js drawTele). Deux phases (trois pour l'Hypernoyau), à 50 % de vie.
   ========================================================= */
const BOSS=[
  {n:'Essaim-Mère',sub:'Elle charge en ligne droite : écarte-toi de la bande',t:'mite',r:52,hp:110},
  {n:'Grande Épine',sub:'Ses charges rebondissent sur le bord',t:'spike',r:56,hp:125},
  {n:'Batterie',sub:'Des éventails qui tournent : glisse entre les branches',t:'spread',r:58,hp:135},
  {n:'L’Œil',sub:'Un trait fin, puis le rayon : sors de la ligne',t:'sniper',r:54,hp:145},
  {n:'Satellite',sub:'Il tourne autour de l’arène',t:'orbit',r:50,hp:150},
  {n:'Mitrailleuse',sub:'Des rafales qui balaient : reste derrière elles',t:'gatling',r:62,hp:155},
  {n:'Pulsar Majeur',sub:'Chaque anneau a une brèche : trouve-la',t:'ring',r:64,hp:160},
  {n:'L’Hypernoyau',sub:'Brise ses nœuds : ils le protègent',t:'core',r:68,hp:180},
];
const BOSSCOL='#ff3355';
function bossCol(B){return B.k===8?BOSSCOL:ET[B.D.t].col;}
function spawnBoss(){
  const k=G.isl,D=BOSS[k-1],hp=Math.round(D.hp*Math.pow(GROWD,k-1)*(1+.1*(k-1)));
  const B={k,D,x:0,y:0,vx:0,vy:0,r:D.r,hp,mhp:hp,phase:1,t:0,st:0,st2:0,ca:0,cn:0,trans:0,spawn:110,flash:0,ang:0,dead:false,gone:false,dieT:0,nodes:[],dir:1,wob:0};
  if(k===8)for(let i=0;i<6;i++){const nh=Math.round(18*Math.pow(GROWD,k-1));B.nodes.push({x:0,y:0,r:15,hp:nh,mhp:nh,dead:false,cd:rr(60,160),flash:0});}
  G.boss=B;G.ph='boss';
  banner(D.n,D.sub,bossCol(B),170);setMusic(2);SFX.bossIn();shake(.5);G.glitch=25;
}
function bossHittable(){const B=G.boss;return !!B&&B.spawn<=0&&B.trans<=0&&!B.dead;}
function hurtBoss(d,quiet){const B=G.boss;if(!bossHittable())return;if(R()<G.p.crit)d*=G.p.critM;
  if(B.k===8&&B.nodes.some(n=>!n.dead))d*=.4;B.hp-=d;B.flash=3;if(!quiet)SFX.hit();if(B.hp<=0){B.hp=0;bossDie();}}
function hitNode(n,d){n.hp-=d;n.flash=4;SFX.hit();if(n.hp<=0&&!n.dead){n.dead=true;shards(n.x,n.y,COL.or,10,4,n.r);ringFX(n.x,n.y,n.r,n.r*3,COL.or,18,3);SFX.pop(true);G.score+=300;}}
/* télégraphes : 'path' (bande de charge), 'beam' (trait fin puis rayon), 'ring' (anneau au sol), 'arc' (secteur de rafale) */
function tele(o){o.t=0;G.tele.push(o);if(o.warn>=30)SFX.warn();return o;}
function updTele(){
  const P=G.p,B=G.boss;
  for(let i=G.tele.length-1;i>=0;i--){const q=G.tele[i];q.t++;
    if(q.fo&&B&&!B.dead){q.x=B.x;q.y=B.y;}
    if(q.warn>0){q.warn--;if(q.warn===0){if(q.ty==='beam')SFX.beam();if(q.then==='crown')crownAt(q.x,q.y,q.r);}continue;}
    if(q.ty==='beam'&&q.on>0){q.on--;if(q.rot)q.a+=q.rot*G.slowF;
      if(G.state==='play'&&!P.dead){const ux=Math.cos(q.a),uy=Math.sin(q.a),px=P.x-q.x,py=P.y-q.y,s=clamp(px*ux+py*uy,0,q.len),dx=px-ux*s,dy=py-uy*s;
        if(dx*dx+dy*dy<(q.w/2+P.r*.6)**2)hurtPlayer(q.x+ux*s,q.y+uy*s);}
      if(q.on>0)continue;}
    G.tele.splice(i,1);}
}
function bossShot(B,a,s,col,r){return ebul(B.x+Math.cos(a)*B.r*.8,B.y+Math.sin(a)*B.r*.8,a,s,r||7,col||bossCol(B));}
function bossRing(B,n,s,gap,off,rot){for(let k=0;k<n;k++){const a=(off||0)+k*TAU/n;if(gap!=null&&Math.abs(angDiff(a,gap))<.42)continue;const b=bossShot(B,a,s);if(rot)b.rot=rot;}SFX.bshot();}
/* charge annoncée : bande pendant `w` pas, puis course à vitesse `sp` ; bonds = rebonds sur le bord */
function chargeStart(B,w,bonds){B.st=1;B.st2=w;B.ca=Math.atan2(G.p.y-B.y,G.p.x-B.x);B.cn=bonds||0;tele({ty:'path',x:B.x,y:B.y,a:B.ca,len:900,w:B.r*2,warn:w,col:bossCol(B)});}
function chargeRun(B,sp,onBond){
  if(B.st===1){if(--B.st2<=0){B.st=2;B.st2=70;shake(.2);}return true;}
  if(B.st===2){B.vx=Math.cos(B.ca)*sp;B.vy=Math.sin(B.ca)*sp;B.x+=B.vx*G.slowF;B.y+=B.vy*G.slowF;if(G.t%2===0)FX({ty:3,x:B.x,y:B.y,vx:0,vy:0,r:B.r,life:12,max:12,col:bossCol(B)});
    const n=confine(B,B.r);
    if(n){if(B.cn>0){B.cn--;const vn=Math.cos(B.ca)*n[0]+Math.sin(B.ca)*n[1];let vx=Math.cos(B.ca)-2*vn*n[0],vy=Math.sin(B.ca)-2*vn*n[1];B.ca=Math.atan2(vy,vx);shake(.25);if(onBond)onBond();B.st2=70;
        tele({ty:'path',x:B.x,y:B.y,a:B.ca,len:900,w:B.r*2,warn:18,col:bossCol(B)});}
      else{B.st=0;B.vx=B.vy=0;shake(.3);if(onBond)onBond();return false;}}
    if(--B.st2<=0){B.st=0;B.vx*=.2;B.vy*=.2;return false;}return true;}
  return false;
}
function drift(B,tx,ty,sp){const dx=tx-B.x,dy=ty-B.y,d=Math.hypot(dx,dy)||1;B.vx=lerp(B.vx,dx/d*Math.min(sp,d*.05),.05);B.vy=lerp(B.vy,dy/d*Math.min(sp,d*.05),.05);B.x+=B.vx*G.slowF;B.y+=B.vy*G.slowF;confine(B,B.r+10);}
/* l'IA de chaque boss : appelée une fois par pas, B.t avance au rythme du ralenti */
const BOSSAI=[
  /* 1 Essaim-Mère : charges annoncées ; phase 2, nuées de Mites et anneau après chaque charge */
  (B,P,aP)=>{const p2=B.phase>1;
    if(B.st){if(!chargeRun(B,9.5,null)&&p2)bossRing(B,12,2.2,R()*TAU);return;}
    drift(B,P.x+Math.cos(B.t*.01)*240,P.y+Math.sin(B.t*.013)*240,1.3);
    if(B.t%(p2?120:160)===0)chargeStart(B,48);
    if(p2&&B.t%260===130){let n=0;for(const e of G.en)if(!e.dead&&e.t==='mite')n++;if(n<12)for(let k=0;k<5;k++){const a=k*TAU/5;mkEnemy('mite',B.x+Math.cos(a)*(B.r+16),B.y+Math.sin(a)*(B.r+16),{age:0,spawn:20,boss:1});}}
    if(B.t%90===45)for(let k=-1;k<=1;k++)bossShot(B,aP+k*.25,2.6);},
  /* 2 Grande Épine : charge qui rebondit sur le bord ; phase 2, chaque rebond projette une étoile d'épines */
  (B,P,aP)=>{const p2=B.phase>1;
    if(B.st){chargeRun(B,8.5,()=>{if(p2)bossRing(B,10,2.6,null,R()*TAU);});return;}
    drift(B,Math.cos(B.t*.008)*300,Math.sin(B.t*.011)*300,1);
    if(B.t%(p2?150:190)===0)chargeStart(B,52,p2?3:2);
    if(B.t%80===40){for(let k=-1;k<=1;k++)bossShot(B,aP+k*.2,3);SFX.bshot();}},
  /* 3 Batterie : éventails de 5 qui tournent ; phase 2, spirale à 4 canons */
  (B,P,aP)=>{const p2=B.phase>1;drift(B,Math.cos(B.t*.006)*200,Math.sin(B.t*.009)*160,.8);
    if(B.t%(p2?80:46)===0){B.ang+=.38;for(let k=-2;k<=2;k++)bossShot(B,B.ang+k*.24,2.5);SFX.bshot();}
    if(p2&&B.t%7===0)for(let k=0;k<4;k++)bossShot(B,B.t*.045+k*Math.PI/2,2.2,null,6);
    if(B.t%150===75){for(let k=-2;k<=2;k++)bossShot(B,aP+k*.14,3.2);}},
  /* 4 L'Œil : rayons annoncés par un trait fin ; phase 2, un rayon qui tourne */
  (B,P,aP)=>{const p2=B.phase>1;drift(B,P.x*.3+Math.cos(B.t*.007)*260,P.y*.3+Math.sin(B.t*.007)*260,1);
    if(B.t%(p2?170:120)===0)tele({ty:'beam',x:B.x,y:B.y,a:leadAng(B.x,B.y,P,14),len:2000,w:30,warn:60,on:26,col:bossCol(B),fo:1});
    if(p2&&B.t%420===60){const a=aP+Math.PI*(R()<.5?.5:-.5);tele({ty:'beam',x:B.x,y:B.y,a,len:2000,w:24,warn:70,on:300,rot:(R()<.5?1:-1)*.011,col:BOSSCOL,fo:1});}
    if(B.t%50===25)bossShot(B,aP,3.4,null,6);},
  /* 5 Satellite : fait le tour de l'arène ; phase 2, couronne de tirs qui se resserre sur toi */
  (B,P,aP)=>{const p2=B.phase>1;B.ang+=.0065*G.slowF*B.dir;if(B.t%600===0&&B.t)B.dir*=-1;const R0=PR-260;
    drift(B,Math.cos(B.ang)*R0,Math.sin(B.ang)*R0,3.2);
    if(B.t%(p2?60:70)===0){for(let k=0;k<3;k++){const b=bossShot(B,aP,3.2+k*.5,null,6);}SFX.bshot();}
    if(p2&&B.t%280===100){tele({ty:'ring',x:P.x,y:P.y,r:520,warn:45,col:bossCol(B),then:'crown'});}},
  /* 6 Mitrailleuse : rafales balayées annoncées par un secteur ; phase 2, deux rafales croisées */
  (B,P,aP)=>{const p2=B.phase>1;drift(B,P.x*.25,P.y*.25,.6);
    if(B.st===0&&B.t%(p2?150:130)===0){B.st=1;B.st2=40;B.ca=aP;tele({ty:'arc',x:B.x,y:B.y,a:aP,sp:.9,r:520,warn:40,col:bossCol(B),fo:1});}
    else if(B.st===1){if(--B.st2<=0){B.st=2;B.st2=72;}}
    else if(B.st===2){const f=1-B.st2/72;if(B.st2%3===0){bossShot(B,B.ca-.9+1.8*f,3.6,null,6);if(p2)bossShot(B,B.ca+.9-1.8*f,3.6,null,6);}if(B.st2%12===0)SFX.eshot();if(--B.st2<=0)B.st=0;}
    if(B.t%110===55)bossRing(B,10,2,null,R()*TAU);},
  /* 7 Pulsar Majeur : anneaux à brèche ; phase 2, anneaux tournants alternés */
  (B,P,aP)=>{const p2=B.phase>1;drift(B,Math.cos(B.t*.005)*150,Math.sin(B.t*.007)*150,.7);
    if(B.t%(p2?72:100)===0){B.dir*=-1;bossRing(B,34,2,aP+rr(-.6,.6),R()*TAU,p2?B.dir*.006:0);}},
  /* 8 L'Hypernoyau : 3 phases, nœuds orbitaux qui le protègent */
  (B,P,aP)=>{const f=B.hp/B.mhp;
    if(B.phase===1)drift(B,Math.cos(B.t*.009)*200,Math.sin(B.t*.013)*160,1);
    else if(B.phase===2){const dd=Math.hypot(P.x-B.x,P.y-B.y),s=dd>300?1:-1;drift(B,B.x+(P.x-B.x)*s-(P.y-B.y)*.6,B.y+(P.y-B.y)*s+(P.x-B.x)*.6,1.35);}
    else drift(B,P.x,P.y,1.5+.5*(1-f/.34));
    if(B.phase===1){if(B.t%8===0)for(let k=0;k<3;k++)bossShot(B,B.t*.045+k*TAU/3,2.2,COL.mg);if(B.t%150===75){for(let k=-2;k<=2;k++)bossShot(B,aP+k*.16,3.3,COL.gd);SFX.bshot();}}
    else if(B.phase===2){if(B.t%240===0)B.dir*=-1;if(B.t%8===0)for(let k=0;k<3;k++)bossShot(B,B.dir*B.t*.04+k*TAU/3,2.4,COL.mg);
      if(B.t%130===65){tele({ty:'beam',x:B.x,y:B.y,a:aP,len:2000,w:26,warn:55,on:22,col:BOSSCOL,fo:1});}
      if(B.t%330===160){let n=0;for(const e of G.en)if(!e.dead)n++;if(n<8)for(let k=0;k<3;k++){const a=R()*TAU;mkEnemy('mite',B.x+Math.cos(a)*(B.r+20),B.y+Math.sin(a)*(B.r+20),{age:0,spawn:15,boss:1});}}}
    else{if(B.t%70===0)bossRing(B,26,2.4,R()*TAU);if(B.t%16===0)bossShot(B,aP+rr(-.08,.08),3.6,COL.gd,5);}
    if(B.phase<3)for(const n of B.nodes){if(n.dead)continue;if((n.cd-=G.slowF)<=0){n.cd=rr(140,200);ebul(n.x,n.y,Math.atan2(P.y-n.y,P.x-n.x),2.8,5,COL.or);}}},
];
/* la couronne : un anneau de tirs autour de toi qui se resserre, avec une brèche */
function crownAt(x,y,r){const n=30,gap=R()*TAU;for(let k=0;k<n;k++){const a=k*TAU/n;if(Math.abs(angDiff(a,gap))<.36)continue;const b=ebul(x+Math.cos(a)*r,y+Math.sin(a)*r,a+Math.PI,1.7,6,G.boss?bossCol(G.boss):COL.mg);b.life=Math.round(r*1.6/1.7);}SFX.bshot();}
function bossPhase(n){
  const B=G.boss;B.phase=n;B.trans=80;B.st=0;B.vx=B.vy=0;
  for(const b of G.eb)sparks(b.x,b.y,b.col,1,1.5,12);G.eb=[];G.tele=[];
  G.glitch=40;shake(.8);G.freeze=6;SFX.phase();setMusic(3);
  banner('Phase '+n,n===3?'Il fonce sur toi':'Il change de rythme',bossCol(B),110);ringFX(B.x,B.y,B.r,B.r*6,bossCol(B),40,6);
  if(n===3)for(const nd of B.nodes)if(!nd.dead){nd.dead=true;shards(nd.x,nd.y,COL.or,8,4,nd.r);}
}
function updBoss(){
  const B=G.boss;if(!B)return;const P=G.p;
  if(B.dead){if(++B.dieT<90){if(B.dieT%6===0){const x=B.x+fr(-B.r,B.r),y=B.y+fr(-B.r,B.r);shards(x,y,bossCol(B),8,5,18);ringFX(x,y,8,70,COL.wh,18,3);SFX.pop(true);shake(.25);}}
    else if(!B.gone){B.gone=true;G.flash=.8;shake(.9);SFX.boom();ringFX(B.x,B.y,20,600,COL.wh,46,8);shards(B.x,B.y,bossCol(B),50,9,36);sparks(B.x,B.y,COL.gd,60,9);}return;}
  if(B.flash>0)B.flash--;B.wob+=.03;
  if(B.k===8){B.ang+=.01+.006*B.phase;const nr=B.r+36;B.nodes.forEach((n,k)=>{const a=B.ang+k*TAU/6;n.x=B.x+Math.cos(a)*nr;n.y=B.y+Math.sin(a)*nr;if(n.flash>0)n.flash--;});}
  if(B.spawn>0){B.spawn--;return;}
  if(B.trans>0){B.trans--;if(B.trans%6===0)sparks(B.x+fr(-B.r,B.r),B.y+fr(-B.r,B.r),bossCol(B),6,4);return;}
  if(G.slowF<1&&G.t%2)return;
  B.t++;const f=B.hp/B.mhp;
  if(B.k===8){if(B.phase===1&&f<.67){bossPhase(2);return;}if(B.phase===2&&f<.34){bossPhase(3);return;}}
  else if(B.phase===1&&f<.5){bossPhase(2);return;}
  const aP=Math.atan2(P.y-B.y,P.x-B.x);
  BOSSAI[B.k-1](B,P,aP);
  if(!P.dead&&dist2(B.x,B.y,P.x,P.y)<(B.r+P.r*.8)**2){hurtPlayer(B.x,B.y);const d=Math.hypot(P.x-B.x,P.y-B.y)||1;P.vx+=(P.x-B.x)/d*7;P.vy+=(P.y-B.y)/d*7;}
}
function bossDie(){
  const B=G.boss;B.dead=true;B.dieT=0;B.vx=B.vy=0;G.tele=[];
  for(const b of G.eb)sparks(b.x,b.y,b.col,1,1.5,12);G.eb=[];
  SFX.phase();shake(1);G.glitch=30;G.timeScale=.45;G.score+=1000*B.k;
  islClear();
}
