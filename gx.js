/* =========================================================
   gx.js : TROIS REGISTRES DE JEU
   1) monde ouvert (g2/gc)  2) Souvenirs d'Iris : scènes à objectif
   3) Chasseurs : duels tactiques au tour par tour, instanciés
   Entrée uniforme : on s'approche, une invitation s'affiche, on choisit.
   ========================================================= */
const SCN={
  convoi:{n:'Le Convoi',ic:'✦',d:'Escorte la lueur jusqu’au phare. Elle n’avance que si tu restes près d’elle, et les ombres la visent.',
    a:'Le dernier Rêveur à s’endormir portait une lueur. Iris lui avait promis de la garder allumée.',z:'La lueur a atteint le phare. Quelque part, un Rêveur sourit dans son sommeil.'},
  balises:{n:'Les Balises',ic:'✦',d:'Rallume les trois balises en restant dans leur cercle. Tu as 90 secondes.',
    a:'Iris avait posé trois balises pour que personne ne se perde. Le Noyau les a éteintes une à une.',z:'Les trois balises brillent. Les routes du rêve se souviennent de leur chemin.'},
  course:{n:'La Course des lucioles',ic:'✦',d:'Traverse chaque arche avant la fin du temps. Chaque arche franchie rajoute du temps.',
    a:'Enfant, Iris courait après les lucioles. Elle disait qu’elles allaient plus vite que la peur.',z:'La dernière luciole se pose sur toi. Tu as couru plus vite que la peur.'}};
const HUNT_N=['Vesk le Cendré','Mira-7','Le Tisserand','Oroboros','Sœur Kalla','Grenat','L’Archiviste','Nox'];
const ARCH={
  brute:{n:'Brute',p:[['atk',12],['charge',0],['big',30],['shield',14]]},
  tact:{n:'Tacticien',p:[['atk',9],['mark',0],['atk',9],['heal',15]]},
  sape:{n:'Sapeur',p:[['burn',8],['atk',8],['charge',0],['big',26]]}};
const ESC={drone:{n:'Drone',hp:30,p:[['atk',5],['atk',5],['heal',8]]},egide:{n:'Égide',hp:38,p:[['shield',12],['atk',6]]}};
const INT={atk:{ic:'⚔',t:v=>'Attaque '+v},big:{ic:'💥',t:v=>'Frappe lourde '+v},charge:{ic:'⏳',t:()=>'Se charge (frappe lourde au tour suivant)'},
  shield:{ic:'⬡',t:v=>'Bouclier +'+v},heal:{ic:'✚',t:v=>'Répare un allié +'+v},mark:{ic:'◎',t:()=>'Te marque : prochaine attaque ×2'},burn:{ic:'🔥',t:v=>'Attaque incendiaire '+v}};

/* ---------- génération : portails de souvenir et chasseurs ---------- */
function gxWorld(rnd){
  const S=WD.sites,bySeg={};for(const s of WD.segs)(bySeg[s.e]=bySeg[s.e]||[]).push(s);
  const far=(x,y,d)=>{for(const L of [...WD.alts,...WD.rifts,...WD.lms,...WD.hearts])if(dist2(L.x,L.y,x,y)<d*d)return false;return dist2(x,y,WD.core.x,WD.core.y)>1500*1500;};
  WD.scn=[];WD.hunt=[];const types=shuffle(['convoi','balises','course'],rnd);
  const edges=shuffle(WD.edges.map((e,i)=>i),rnd),used=new Set();
  for(const dmin of [650,420,250])for(const ei of edges){if(WD.scn.length>=3)break;if(used.has(ei))continue;const L=bySeg[ei];if(!L||L.length<18)continue;
    const s=L[4];if(Math.hypot(s.bx,s.by)<800||!far(s.bx,s.by,dmin))continue;let ok=true;for(const q of WD.scn)if(dist2(q.x,q.y,s.bx,s.by)<1600*1600)ok=false;if(!ok)continue;
    const path=[];for(let k=4;k<Math.min(L.length-1,4+20);k++)path.push([L[k].bx,L[k].by]);used.add(ei);WD.scn.push({x:s.bx,y:s.by,t:types[WD.scn.length],path});}
  for(const dmin of [700,450,250])for(const ei of edges){if(WD.hunt.length>=4)break;if(used.has(ei))continue;const L=bySeg[ei];if(!L||L.length<10)continue;
    const s=L[Math.floor(L.length/2)];if(Math.hypot(s.bx,s.by)<1500||!far(s.bx,s.by,dmin))continue;let ok=true;for(const h of [...WD.hunt,...WD.scn])if(dist2(h.x,h.y,s.bx,s.by)<1400*1400)ok=false;if(!ok)continue;
    used.add(ei);const ak=Object.keys(ARCH)[WD.hunt.length%3];WD.hunt.push({x:s.bx,y:s.by,hx:s.bx,hy:s.by,n:HUNT_N[(WD.seed+WD.hunt.length*3)%HUNT_N.length],a:ak,b:biomeAt(s.bx,s.by)});}
}

/* ---------- état de partie ---------- */
function gxRunStart(){G.gx={scene:null,done:{},beat:{},prompt:null,pk:''};$('prompt').hidden=true;}
function gxNear(){
  const P=G.p,X=G.gx;let best=null,bd=1e18;
  for(let i=0;i<WD.scn.length;i++){if(X.done[i]||X.scene)continue;const s=WD.scn[i],d=dist2(s.x,s.y,P.x,P.y);if(d<140*140&&d<bd){bd=d;best={k:'scn',i};}}
  for(let i=0;i<WD.hunt.length;i++){if(X.beat[i]||X.dorm)continue;const h=WD.hunt[i],d=dist2(h.x,h.y,P.x,P.y);if(d<170*170&&d<bd){bd=d;best={k:'hunt',i};}}
  return best;
}
function gxPrompt(p){
  const X=G.gx,key=p?p.k+p.i:'';if(key===X.pk)return;X.pk=key;X.prompt=p;const el=$('prompt');
  if(!p){el.hidden=true;return;}
  if(p.k==='scn'){const s=WD.scn[p.i],T=SCN[s.t];el.innerHTML='<b class="pc">Souvenir d’Iris · '+T.n+'</b><span>'+T.d+'</span><span class="pr">Récompense : objet rare ou mieux, éclats</span><button class="btn pri" id="pGo">Entrer'+(inp.touch?'':' (F)')+'</button>';}
  else{const h=WD.hunt[p.i];el.innerHTML='<b class="ph">Chasseur · '+h.n+'</b><span>'+ARCH[h.a].n+' de l’Hypernoyau, escorté. Duel tactique au tour par tour : ton build compte.</span><span class="pr">Récompense : objet rare ou mieux · défaite : tu perds 40 % de tes bulles</span><button class="btn pri" id="pGo">Défier'+(inp.touch?'':' (F)')+'</button>';}
  el.hidden=false;$('pGo').onclick=gxInteract;
}
function gxInteract(){const X=G&&G.gx;if(!X||G.state!=='play'||!X.prompt)return;const p=X.prompt;gxPrompt(null);
  if(p.k==='scn')sceneStart(p.i);else duelStart(p.i);}

/* ---------- scènes ---------- */
function sceneStart(i){
  const s=WD.scn[i],X=G.gx,T=SCN[s.t],P=G.p;
  const sc={i,t:s.t,time:0};
  if(s.t==='convoi'){sc.orb={x:s.x,y:s.y,k:0,hp:100,r:20};sc.lim=0;}
  if(s.t==='balises'){const n=s.path.length;sc.b=[Math.floor(n*.3),Math.floor(n*.6),n-1].map(k=>({x:s.path[k][0],y:s.path[k][1],p:0}));sc.lim=5400;}
  if(s.t==='course'){sc.g=s.path.filter((_,k)=>k%3===2).slice(0,7).map(q=>({x:q[0],y:q[1]}));sc.gi=0;sc.lim=660;sc.calm=1;for(const e of G.en)if(!e.dead&&dist2(e.x,e.y,P.x,P.y)<1400*1400){e.dead=true;sparks(e.x,e.y,e.d.col,6,3);}}
  X.scene=sc;banner(T.n,'',COL.cy,90);gsSay(T.a,'Souvenir d’Iris',COL.cy,1,1);SFX.bossIn();biomeWash&&biomeWash(G.biome);
}
function sceneEnd(ok){
  const X=G.gx,sc=X.scene;if(!sc)return;const s=WD.scn[sc.i],T=SCN[s.t],P=G.p;X.scene=null;
  for(const e of G.en)if(e.tg)e.tg=null;
  if(ok){X.done[sc.i]=1;banner('Souvenir retrouvé',T.n,COL.gd,130);gsSay(T.z,'Souvenir d’Iris',COL.gd,1,1);giDrop(P.x,P.y,'rift',1);gsShard(20);G.score+=2000;SFX.ach();ringFX(P.x,P.y,P.r,P.r*6,COL.gd,30,6);}
  else{banner('Souvenir perdu','Il reviendra au prochain passage',COL.mg,120);G.glitch=18;SFX.hurt();}
}
function sceneTick(){
  const X=G.gx,sc=X.scene;if(!sc)return;const P=G.p;sc.time++;
  if(sc.t==='convoi'){const o=sc.orb,path=WD.scn[sc.i].path,tgt=path[Math.min(o.k,path.length-1)],d=Math.hypot(P.x-o.x,P.y-o.y);
    if(d<300){const dx=tgt[0]-o.x,dy=tgt[1]-o.y,l=Math.hypot(dx,dy);if(l<6){o.k++;if(o.k>=path.length){sceneEnd(true);return;}}else{o.x+=dx/l*1.25;o.y+=dy/l*1.25;}}
    if(d>1500){sceneEnd(false);return;}
    if(sc.time%140===0){const a=R()*TAU;for(let k=0;k<3;k++){const e=mkEnemy('mite',o.x+Math.cos(a+k*.3)*560,o.y+Math.sin(a+k*.3)*560,{aggro:true,noElite:true});e.tg=o;}
      if(sc.time%420===0)mkEnemy(['pop','spread'][Math.floor(R()*2)],o.x+Math.cos(a+Math.PI)*600,o.y+Math.sin(a+Math.PI)*600,{aggro:true}).tg=o;}
    for(const e of G.en){if(e.dead||e.tg!==o)continue;if(dist2(e.x,e.y,o.x,o.y)<(e.r+o.r)**2){o.hp-=e.t==='mite'?10:4;e.dead=true;ringFX(e.x,e.y,e.r,e.r*3,COL.rd,12,3);shake(.12);}}
    for(let i=G.eb.length-1;i>=0;i--){const b=G.eb[i];if(dist2(b.x,b.y,o.x,o.y)<(b.r+o.r)**2){o.hp-=3;G.eb.splice(i,1);}}
    if(o.hp<=0)sceneEnd(false);}
  else if(sc.t==='balises'){let all=true;for(const b of sc.b){if(b.p<1){all=false;if(dist2(b.x,b.y,P.x,P.y)<90*90){b.p=Math.min(1,b.p+1/240);if(b.p>=1){ringFX(b.x,b.y,20,200,COL.gd,24,5);SFX.evo();}}}}
    if(all){sceneEnd(true);return;}
    if(sc.time%210===0){const a=R()*TAU;for(let k=0;k<2;k++)mkEnemy(['pop','orbit','spike'][Math.floor(R()*3)],P.x+Math.cos(a+k)*520,P.y+Math.sin(a+k)*520,{aggro:true});}
    if(sc.time>=sc.lim)sceneEnd(false);}
  else if(sc.t==='course'){const g=sc.g[sc.gi];if(dist2(g.x,g.y,P.x,P.y)<80*80){sc.gi++;sc.lim+=300;ringFX(g.x,g.y,20,110,COL.cy,18,4);SFX.pick(sc.gi*2);if(sc.gi>=sc.g.length){sceneEnd(true);return;}}
    if(sc.time>=sc.lim)sceneEnd(false);}
}
function sceneLeft(){const sc=G.gx&&G.gx.scene;return sc&&sc.lim?Math.max(0,Math.ceil((sc.lim-sc.time)/60)):0;}

/* ---------- boucle ---------- */
function gxTick(){
  const X=G.gx;if(!X)return;
  sceneTick();
  for(let i=0;i<WD.hunt.length;i++){if(X.beat[i]||X.dorm)continue;const h=WD.hunt[i],a=G.t*.004+i*2;h.x=h.hx+Math.cos(a)*160;h.y=h.hy+Math.sin(a*1.3)*110;}
  if(G.t%6===0)gxPrompt(G.state==='play'&&!document.querySelector('.ov.on')?gxNear():null);
}

/* ---------- rendu ---------- */
function gxDrawWorld(){
  const c=ctx,X=G.gx;if(!X)return;
  for(let i=0;i<WD.scn.length;i++){const s=WD.scn[i];if(X.done[i]||!vis(s.x,s.y,140))continue;const p=.5+.5*Math.sin(RT*.08+i);
    c.globalCompositeOperation='lighter';glow(s.x,s.y,70,COL.cy,.35+.25*p);c.globalCompositeOperation='source-over';
    c.save();c.translate(s.x,s.y);c.rotate(RT*.01);c.strokeStyle=COL.cy;c.lineWidth=3;c.beginPath();for(let k=0;k<10;k++){const r=k%2?16:40,a=k*TAU/10;k?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.stroke();c.restore();
    if((!X.scene||X.scene.i!==i)&&dist2(s.x,s.y,G.p.x,G.p.y)<400*400){c.font='700 12px '+FD;c.textAlign='center';c.fillStyle=COL.cy;c.fillText('SOUVENIR',s.x,s.y-58);}}
  const sc=X.scene;
  if(sc&&sc.t==='convoi'){const o=sc.orb,path=WD.scn[sc.i].path,end=path[path.length-1];
    c.strokeStyle='rgba(45,226,255,.35)';c.lineWidth=4;c.setLineDash([10,14]);c.beginPath();c.moveTo(o.x,o.y);for(let k=o.k;k<path.length;k++)c.lineTo(path[k][0],path[k][1]);c.stroke();c.setLineDash([]);
    c.fillStyle=COL.gd;c.fillRect(end[0]-4,end[1]-60,8,60);c.globalCompositeOperation='lighter';glow(end[0],end[1]-60,50,COL.gd,.6);glow(o.x,o.y,60,'#fff3c4',.7);c.globalCompositeOperation='source-over';
    c.fillStyle='#fffbe6';c.beginPath();c.arc(o.x,o.y,o.r,0,TAU);c.fill();c.strokeStyle=o.hp>40?COL.lm:COL.rd;c.lineWidth=4;c.beginPath();c.arc(o.x,o.y,o.r+8,-Math.PI/2,-Math.PI/2+TAU*o.hp/100);c.stroke();}
  if(sc&&sc.t==='balises')for(const b of sc.b){c.strokeStyle=b.p>=1?COL.gd:COL.cy;c.lineWidth=3;c.globalAlpha=.8;c.beginPath();c.arc(b.x,b.y,90,0,TAU);c.stroke();
    c.lineWidth=8;c.beginPath();c.arc(b.x,b.y,90,-Math.PI/2,-Math.PI/2+TAU*b.p);c.stroke();c.globalAlpha=1;c.fillStyle=b.p>=1?COL.gd:'#1a1030';c.fillRect(b.x-6,b.y-50,12,50);
    if(b.p>=1){c.globalCompositeOperation='lighter';c.globalAlpha=.35;c.fillStyle=COL.gd;c.fillRect(b.x-4,b.y-400,8,350);c.globalAlpha=1;c.globalCompositeOperation='source-over';}}
  if(sc&&sc.t==='course')sc.g.forEach((g,k)=>{if(k<sc.gi)return;const nx=k===sc.gi;c.globalAlpha=nx?1:.35;c.strokeStyle=nx?COL.cy:'#7a74a6';c.lineWidth=nx?6:3;c.beginPath();c.arc(g.x,g.y,70,0,TAU);c.stroke();
    if(nx){c.globalCompositeOperation='lighter';glow(g.x,g.y,90,COL.cy,.3);c.globalCompositeOperation='source-over';}c.globalAlpha=1;});
  for(let i=0;i<WD.hunt.length;i++){const h=WD.hunt[i];if(X.beat[i]||!vis(h.x,h.y,120))continue;
    c.save();c.translate(h.x,h.y);c.rotate(G.t*.004*1.3+i);c.fillStyle='#1a0a12';c.strokeStyle=COL.rd;c.lineWidth=3;c.beginPath();c.moveTo(34,0);c.lineTo(-22,-24);c.lineTo(-12,0);c.lineTo(-22,24);c.closePath();c.fill();c.stroke();c.restore();
    c.globalCompositeOperation='lighter';glow(h.x,h.y,60,COL.rd,.3+.15*Math.sin(RT*.1));c.globalCompositeOperation='source-over';
    if(dist2(h.x,h.y,G.p.x,G.p.y)<450*450){c.font='700 12px '+FD;c.textAlign='center';c.fillStyle=COL.rd;c.fillText(h.n.toUpperCase(),h.x,h.y-50);}}
}
function gxHUD(){const sc=G.gx&&G.gx.scene;if(!sc)return;const c=ctx,T=SCN[sc.t];c.textAlign='center';c.textBaseline='middle';let s='';
  if(sc.t==='convoi')s='Convoi · lueur '+Math.max(0,Math.round(sc.orb.hp))+' % · reste près d’elle';
  if(sc.t==='balises')s='Balises '+sc.b.filter(b=>b.p>=1).length+'/3 · '+sceneLeft()+' s';
  if(sc.t==='course')s='Arche '+(sc.gi+1)+'/'+sc.g.length+' · '+sceneLeft()+' s';
  fitFont(c,s,W-30,16,'700');c.fillStyle=COL.cy;c.fillText(s,W/2,W<600?222:86);}
function gxMini(x,y,k){const c=ctx,X=G.gx;if(!X)return;
  c.fillStyle=COL.cy;for(let i=0;i<WD.scn.length;i++){if(X.done[i])continue;const s=WD.scn[i];const px=x+(s.x+WR)*k,py=y+(s.y+WR)*k;c.beginPath();c.moveTo(px,py-4);c.lineTo(px+3,py);c.lineTo(px,py+4);c.lineTo(px-3,py);c.closePath();c.fill();}
  c.fillStyle=COL.rd;for(let i=0;i<WD.hunt.length;i++){if(X.beat[i]||X.dorm)continue;const h=WD.hunt[i],px=x+(h.x+WR)*k,py=y+(h.y+WR)*k;c.beginPath();c.moveTo(px,py-4);c.lineTo(px+4,py+3);c.lineTo(px-4,py+3);c.closePath();c.fill();}}
function gxJournal(){const X=G.gx,C=G.gc;if(!X)return '';const n=o=>Object.keys(o||{}).length;
  const row=(ic,col,t,a,b)=>'<div class="jr"><span style="color:'+col+'">'+ic+'</span><span>'+t+'</span><b>'+a+' / '+b+'</b></div>';
  return '<div class="mt">Journal du cycle</div>'+row('✦',COL.cy,'Souvenirs d’Iris',n(X.done),WD.scn.length)+row('▲',COL.rd,'Chasseurs vaincus',n(X.beat),WD.hunt.length)+
    row('●',COL.mg,'Failles scellées',n(C&&C.riftDone),WD.rifts.length)+row('■',COL.gd,'Autels utilisés',n(C&&C.altUsed),WD.alts.length)+row('◆',COL.gd,'Échos réveillés',G.gs?G.gs.echo:0,WD.lms.length);}

/* =========================================================
   DUEL TACTIQUE
   ========================================================= */
let DU=null;
function canonKind(){if(G.daily)return 0;const it=giEquipped().canon;return it?it.bi:0;}
function duelStart(i){
  const h=WD.hunt[i],P=G.p,sc=1+.35*(G.room-1),A=ARCH[h.a];
  const rnd=mkRng(WD.seed+i*97),els=Object.keys(EL),weak=els[Math.floor(rnd()*4)],res=els.filter(e=>e!==weak)[Math.floor(rnd()*3)];
  const foes=[{n:h.n,sub:A.n,hp:Math.round(80*sc),sh:0,p:A.p,pi:0,st:{},cmd:1,weak,res,rev:0}];
  const ek=['drone','egide'];for(let k=0;k<(G.room>1.6?2:1);k++){const E=ESC[ek[(i+k)%2]];foes.push({n:E.n,sub:'Escorte',hp:Math.round(E.hp*sc),sh:0,p:E.p,pi:k,st:{},weak:null,res:null,rev:1});}
  for(const f of foes)f.mhp=f.hp;
  const mhp=Math.round(60+P.bub*1.6);
  DU={i,h,foes,sel:0,turn:1,busy:0,log:[],me:{hp:mhp,mhp,sh:0,en:3,bonus:0,ult:Math.min(100,P.ultC||0),cd:[0,0],evade:0,mark:0,burn:0,crit:0,drones:0,refl:0},kind:canonKind()};
  G.state='duel';gxPrompt(null);SFX.bossIn();flashFade('#ffffff',380);$('topbtns').style.visibility='hidden';
  duelLog('Le chasseur '+h.n+' t’attend. Chaque ennemi annonce son prochain coup : lis-le, et agis en conséquence.');
  renderDuel();show('ov-duel');
}
function duelLog(s){DU.log.unshift(s);DU.log.length=Math.min(DU.log.length,4);}
const DK=[{n:'Canon standard',a:'Tir',d:'100 % sur la cible',c:1},{n:'Dispersion',a:'Salve dispersée',d:'60 % sur tous les ennemis',c:1},{n:'Obusier',a:'Obus',d:'170 %, ignore le bouclier',c:2},{n:'Mitrailleur',a:'Rafale',d:'3 × 40 % (3 chances d’altération)',c:1},{n:'Canon-rail',a:'Tir perçant',d:'110 % sur la cible, 80 % sur la suivante',c:1}];
const DSK={shock:{d:'70 % sur tous, annule les charges',c:2},lance:{d:'260 % sur la cible, ignore le bouclier',c:2},trou:{d:'50 % sur tous, les ennemis sont groupés (+50 % au prochain coup de zone)',c:2},
  shield:{d:'Bouclier = 45 % de ta coque',c:2},salve:{d:'5 × 45 % sur des cibles au hasard',c:2},blink:{d:'Esquive la prochaine attaque et riposte à 100 %',c:2}};
function dBase(){const P=G.p;return 16*P.dmg*lvlDmg();}
function alive(){return DU.foes.filter(f=>f.hp>0);}
function dHit(f,mult,ignoreSh,noSt){
  if(!f||f.hp<=0)return 0;const P=G.p;let d=dBase()*mult;
  if(DU.me.crit||R()<(P.ultA&&P.ultA.k==='spectre'?P.bCrit+P.crit-1:P.crit)){d*=P.critM||2.5;DU.me.crit=0;duelFloat(f,'Critique');}
  if(f.st.acid)d*=1+.08*f.st.acid;if(f.grouped&&mult<1)d*=1.5;
  d=Math.round(d);if(!ignoreSh&&f.sh>0){const a=Math.min(f.sh,d);f.sh-=a;d-=a;}
  f.hp=Math.max(0,f.hp-d);DU.me.ult=Math.min(100,DU.me.ult+8);f.flash=1;
  if(!noSt&&f.hp>0)for(const e in EL){let ch=(P.st&&P.st[e]||0)*1.6;if(f.weak===e)ch*=2;if(f.res===e)ch*=.3;if(R()<ch){f.st[e]=Math.min(e==='acid'?5:e==='burn'?5:3,(f.st[e]||0)+1);
    if(e==='frost'&&f.st.frost>=3){f.st.frost=0;f.frozen=1;duelLog(f.n+' est gelé : il perd son prochain tour.');}
    if(e==='shock'){const o=alive().find(x=>x!==f);if(o){const s=Math.round(d*.45);o.hp=Math.max(0,o.hp-s);duelLog('Le choc rebondit sur '+o.n+' ('+s+').');if(f.st.burn){o.st.burn=Math.min(5,(o.st.burn||0)+1);}}}}}
  if(f.hp<=0){duelLog(f.n+' est détruit.');}
  return d;
}
function duelFloat(f,s){f.fl=s;}
function duelAct(a){
  if(!DU||DU.busy)return;const me=DU.me,P=G.p;let tgt=alive()[0];const sel=DU.foes[DU.sel];if(sel&&sel.hp>0)tgt=sel;
  const cost=a==='tir'?DK[DU.kind].c:a==='sk0'||a==='sk1'?2:a==='ult'?0:1;if(me.en<cost)return;
  if(a==='ult'&&me.ult<100)return;if((a==='sk0'||a==='sk1')&&(!P.sk[a==='sk0'?0:1]||me.cd[a==='sk0'?0:1]>0))return;
  me.en-=cost;SFX.hit();
  if(a==='tir'){const k=DU.kind;
    if(k===1){for(const f of alive())dHit(f,.6);duelLog('Salve dispersée sur toute l’escouade.');}
    else if(k===2){const d=dHit(tgt,1.7,true);duelLog('Obus sur '+tgt.n+' : '+d+'.');}
    else if(k===3){let s=0;for(let j=0;j<3;j++)s+=dHit(tgt.hp>0?tgt:alive()[0],.4);duelLog('Rafale : '+s+' au total.');}
    else if(k===4){const d=dHit(tgt,1.1);const nx=alive().find(f=>f!==tgt);if(nx)dHit(nx,.8);duelLog('Tir perçant : '+d+(nx?' puis '+nx.n:'')+'.');}
    else{const d=dHit(tgt,1);duelLog('Tir sur '+tgt.n+' : '+d+'.');}}
  else if(a==='sk0'||a==='sk1'){const j=a==='sk0'?0:1,s=P.sk[j];if(!s)return;const m=(P.skM||1)*(1+.25*(s.l-1));me.cd[j]=2;
    if(s.id==='shock'){for(const f of alive()){dHit(f,.7*m);if(f.p[f.pi%f.p.length][0]==='big'||f.p[f.pi%f.p.length][0]==='charge'){f.pi=0;duelLog(f.n+' est interrompu.');}}}
    else if(s.id==='lance'){const d=dHit(tgt,2.6*m,true);duelLog('Lance : '+d+'.');}
    else if(s.id==='trou'){for(const f of alive()){dHit(f,.5*m);f.grouped=1;}duelLog('Singularité : l’escouade est groupée.');}
    else if(s.id==='shield'){me.sh+=Math.round(me.mhp*.45*m);duelLog('Égide : bouclier '+me.sh+'.');}
    else if(s.id==='salve'){for(let q=0;q<5;q++){const L=alive();if(!L.length)break;dHit(L[Math.floor(R()*L.length)],.45*m);}duelLog('Salve de missiles.');}
    else if(s.id==='blink'){me.evade=1;me.riposte=m;duelLog('Clignement : tu esquiveras la prochaine attaque.');}}
  else if(a==='garde'){me.sh+=Math.round(me.mhp*.2);me.bonus=1;duelLog('Tu te retranches : bouclier '+me.sh+', +1 énergie au prochain tour.');}
  else if(a==='scan'){tgt.rev=1;me.crit=1;duelLog('Analyse de '+tgt.n+' : '+(tgt.weak&&EL[tgt.weak]?'faiblesse '+EL[tgt.weak].n+', résistance '+(EL[tgt.res]?EL[tgt.res].n:'aucune'):'aucune faiblesse élémentaire')+'. Prochain coup critique.');}
  else if(a==='ult'){me.ult=0;const k=G.prof;
    if(k==='scout'){me.en+=3;duelLog('Hypervitesse : +3 énergie.');}
    else if(k==='tank'){me.sh+=Math.round(me.mhp*.8);me.refl=1;duelLog('Forteresse : bouclier massif, les coups sont renvoyés ce tour.');}
    else if(k==='spectre'){for(const f of alive())f.frozen=1;me.crit=1;duelLog('Faille temporelle : tout l’ennemi perd son tour.');}
    else if(k==='oracle'){for(let q=0;q<4;q++){const L=alive().sort((a,b)=>b.hp-a.hp);if(L[0])dHit(L[0],1.2);}duelLog('Jugement : quatre éclairs.');}
    else if(k==='reine'){me.drones=3;duelLog('Nuée : deux drones te rejoignent pour 3 tours.');}
    else{for(const f of alive())dHit(f,3);duelLog('Supernova.');}}
  for(const f of DU.foes)if(f.hp<=0)f.grouped=0;
  if(!alive().length){duelWin();return;}
  if(DU.foes[DU.sel].hp<=0)DU.sel=DU.foes.findIndex(f=>f.hp>0);
  renderDuel();
}
function duelEndTurn(){
  if(!DU||DU.busy)return;DU.busy=1;const me=DU.me;renderDuel();
  if(me.drones>0){me.drones--;for(let q=0;q<2;q++){const L=alive();if(L.length)dHit(L[Math.floor(R()*L.length)],.4,false,true);}duelLog('Tes drones tirent.');}
  const L=alive();let k=0;
  const step=()=>{if(!DU)return;if(k>=L.length){duelNewTurn();return;}const f=L[k++];if(f.hp<=0){step();return;}foeAct(f);renderDuel();
    if(me.hp<=0){setTimeout(duelLose,500);return;}setTimeout(step,480);};
  setTimeout(step,300);
}
function foeAct(f){
  const me=DU.me,P=G.p,sc=1+.3*(G.room-1);
  if(f.frozen){f.frozen=0;duelLog(f.n+' est gelé et ne fait rien.');return;}
  const [t,v]=f.p[f.pi%f.p.length];f.pi++;
  const hitMe=(dm)=>{let d=Math.round(dm*.8*sc*(P.armor||1)*(me.mark?2:1));me.mark=0;
    if(me.evade){me.evade=0;duelLog('Tu esquives '+f.n+' et ripostes.');dHit(f,me.riposte||1);return;}
    if(R()<(P.dodge||0)){duelLog('Esquive !');return;}
    if(me.refl){dHit(f,d/dBase(),true,true);}
    const a=Math.min(me.sh,d);me.sh-=a;d-=a;me.hp=Math.max(0,me.hp-d);me.ult=Math.min(100,me.ult+12);duelLog(f.n+' : '+(t==='big'?'frappe lourde':'attaque')+' '+(d+a)+(a?' (bouclier '+a+')':'')+'.');SFX.hurt();};
  if(t==='atk'||t==='big')hitMe(v);
  else if(t==='burn'){hitMe(v);me.burn=Math.min(3,me.burn+1);}
  else if(t==='charge')duelLog(f.n+' se charge. Frappe lourde au prochain tour !');
  else if(t==='shield'){const o=alive().sort((a,b)=>a.hp/a.mhp-b.hp/b.mhp)[0];o.sh+=Math.round(v*sc);duelLog(f.n+' protège '+o.n+' (+'+Math.round(v*sc)+').');}
  else if(t==='heal'){const o=alive().sort((a,b)=>a.hp/a.mhp-b.hp/b.mhp)[0];o.hp=Math.min(o.mhp,o.hp+Math.round(v*sc));duelLog(f.n+' répare '+o.n+'.');}
  else if(t==='mark'){me.mark=1;duelLog(f.n+' te marque : sa prochaine attaque fera double dégâts.');}
}
function duelNewTurn(){
  const me=DU.me,P=G.p;
  for(const f of alive()){if(f.st.burn){const d=Math.round(3*f.st.burn*(P.stp||1)*(f.weak==='burn'?1.5:1));f.hp=Math.max(0,f.hp-d);}}
  if(me.burn){me.hp=Math.max(1,me.hp-2*me.burn);me.burn--;}
  if(!alive().length){DU.busy=0;duelWin();return;}
  DU.turn++;me.en=3+me.bonus;me.bonus=0;me.sh=Math.round(me.sh*.5);me.refl=0;me.cd=me.cd.map(c=>Math.max(0,c-1));
  if(DU.foes[DU.sel].hp<=0)DU.sel=DU.foes.findIndex(f=>f.hp>0);
  DU.busy=0;renderDuel();
}
function duelWin(){
  flashFade('#05030c',600);
  $('topbtns').style.visibility='';
  const X=G.gx,h=DU.h,P=G.p;X.beat[DU.i]=1;show(null);G.state='play';
  giDrop(P.x,P.y,'rift',1);if(R()<.35)giDrop(P.x,P.y,'heart',1);gsShard(25);G.score+=2500;P.ultC=Math.min(100,DU.me.ult);
  banner('Chasseur vaincu',h.n,COL.gd,120);gsSay('« Tu te bats comme elle… comme Iris. »','Chasseur · '+h.n,COL.rd,1,1);SFX.ach();
  ringFX(P.x,P.y,P.r,P.r*6,COL.gd,30,6);DU=null;
}
function duelLose(){
  flashFade('#05030c',600);
  $('topbtns').style.visibility='';
  const P=G.p,h=DU.h;show(null);G.state='play';P.bub=Math.max(1,Math.floor(P.bub*.6));checkLevel();
  const d=Math.hypot(P.x-h.x,P.y-h.y)||1;P.x+=(P.x-h.x)/d*260;P.y+=(P.y-h.y)/d*260;P.inv=120;
  banner('Défaite','Le chasseur se retire. Reviens plus fort.',COL.rd,130);SFX.hurt();DU=null;
}
function duelFlee(){if(!DU||DU.busy)return;$('topbtns').style.visibility='';const P=G.p;P.bub=Math.max(1,Math.floor(P.bub*.8));checkLevel();show(null);G.state='play';P.inv=90;
  const h=DU.h,d=Math.hypot(P.x-h.x,P.y-h.y)||1;P.x+=(P.x-h.x)/d*260;P.y+=(P.y-h.y)/d*260;banner('Retraite','-20 % de bulles',COL.mg,90);DU=null;}
function renderDuel(){
  if(!DU)return;const me=DU.me,P=G.p;
  $('dvT').textContent='Duel · '+DU.h.n;$('dvTurn').textContent='Tour '+DU.turn;
  $('dvFoes').innerHTML=DU.foes.map((f,i)=>{const it=f.p[f.pi%f.p.length],I=INT[it[0]],sc=1+.3*(G.room-1),v=Math.round(it[1]*sc*(it[0]==='atk'||it[0]==='big'||it[0]==='burn'?.8*(P.armor||1)*(me.mark?2:1):1));
    const sts=Object.keys(f.st).filter(e=>f.st[e]).map(e=>'<i style="color:'+EL[e].col+'">'+EL[e].n+' '+f.st[e]+'</i>').join('')+(f.frozen?'<i style="color:#cfefff">Gelé</i>':'')+(f.grouped?'<i>Groupé</i>':'');
    return '<button class="foe'+(f.hp<=0?' dead':'')+(DU.sel===i?' sel':'')+(f.cmd?' cmd':'')+'" data-f="'+i+'"><div class="fn">'+f.n+' <small>'+f.sub+'</small></div>'+
      '<div class="bar"><i style="width:'+(f.hp/f.mhp*100)+'%"></i></div><div class="fh">'+f.hp+' / '+f.mhp+(f.sh?' · ⬡ '+f.sh:'')+'</div>'+
      (f.hp>0?'<div class="fi">'+(f.frozen?'❄ Gelé : passe son tour':I.ic+' '+I.t(v))+'</div>':'')+
      (f.cmd?'<div class="fw">'+(f.rev?'Faible : <b style="color:'+EL[f.weak].col+'">'+EL[f.weak].n+'</b> · résiste : '+EL[f.res].n:'Faiblesse inconnue (Analyser)')+'</div>':'')+'<div class="fs">'+sts+'</div></button>';}).join('');
  $('dvLog').innerHTML=DU.log.map((l,i)=>'<p style="opacity:'+(1-i*.22)+'">'+l+'</p>').join('');
  $('dvMe').innerHTML='<div class="fn">'+meta.tank.name.replace(/</g,'')+' <small>'+PROF[G.prof].n+'</small></div><div class="bar me"><i style="width:'+(me.hp/me.mhp*100)+'%"></i></div>'+
    '<div class="fh">Coque '+me.hp+' / '+me.mhp+(me.sh?' · ⬡ '+me.sh:'')+(me.mark?' · <b style="color:#ff5570">marqué</b>':'')+(me.burn?' · en feu':'')+(me.evade?' · esquive prête':'')+'</div>'+
    '<div class="en">'+'<i class="on"></i>'.repeat(me.en)+'<i></i>'.repeat(Math.max(0,3-me.en))+'<span>énergie</span><span class="ul">Ultime '+Math.floor(me.ult)+' %</span></div>';
  const K=DK[DU.kind],acts=[['tir',K.a,K.d,K.c,1]];
  P.sk.forEach((s,j)=>{if(s)acts.push(['sk'+j,SKL[s.id].n+' '+ROMAN[s.l],DSK[s.id].d+(me.cd[j]?' · recharge '+me.cd[j]:''),2,!me.cd[j]]);});
  acts.push(['garde','Se retrancher','Bouclier 20 % et +1 énergie au prochain tour',1,1],['scan','Analyser','Révèle la faiblesse, prochain coup critique',1,1],['ult',(ULT[G.prof]||ULT.bal).n,'Ultime',0,me.ult>=100]);
  DU.keys=acts.map(x=>x[0]);$('dvAct').innerHTML=acts.map(([a,n,d,c,ok])=>'<button class="dact" data-a="'+a+'" '+(DU.busy||!ok||me.en<c?'disabled':'')+'><b>'+n+'</b><span>'+d+'</span><em>'+'⚡'.repeat(c)+'</em></button>').join('')+
    '<button class="btn pri" id="dvEnd" '+(DU.busy?'disabled':'')+'>Fin du tour</button><button class="btn ghost" id="dvFlee" '+(DU.busy?'disabled':'')+'>Fuir (-20 % bulles)</button>';
}
function gxBindUI(){
  $('dvFoes').onclick=e=>{const b=e.target.closest('[data-f]');if(b&&DU&&DU.foes[+b.dataset.f].hp>0){DU.sel=+b.dataset.f;renderDuel();}};
  $('dvAct').onclick=e=>{const b=e.target.closest('button');if(!b||!DU)return;if(b.id==='dvEnd')duelEndTurn();else if(b.id==='dvFlee')duelFlee();else if(b.dataset.a)duelAct(b.dataset.a);};
}
