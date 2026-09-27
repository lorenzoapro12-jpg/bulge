/* =========================================================
   gi.js : LE TANK, SON PILOTE, SON ÉQUIPEMENT
   attributs à effets multiples, altérations et synergies, butin, hangar
   ========================================================= */
const ATTR={
  mas:{n:'Masse',col:'#ffc93c',fx:['+1,2 % taille','-1 % dégâts subis','+3 % dégâts de contact','+0,25 bulle de départ','-0,4 % vitesse']},
  flx:{n:'Flux',col:'#2de2ff',fx:['+1,2 % cadence','+1 % vitesse des projectiles','-0,8 % recharge des compétences','+1,5 % charge d’ultime']},
  pre:{n:'Précision',col:'#ff2d95',fx:['+chance critique (rendement décroissant)','+2,5 % dégâts critiques','+1 % portée']},
  rsn:{n:'Résonance',col:'#a45cff',fx:['+1 % de chance pour chaque altération que tu possèdes déjà','+3 % puissance des altérations','+2 % dégâts des compétences']},
  ins:{n:'Instinct',col:'#7dff4a',fx:['+0,8 % vitesse','-1,2 % recharge du dash','+2 % rayon de collecte','+esquive (rendement décroissant)']},
  vit:{n:'Vitalité',col:'#ff8a2d',fx:['+0,5 bulle de départ','+0,3 bulle régénérée toutes les 10 s','+1,5 % bulles lâchées']}};
const ATK=Object.keys(ATTR);
const RAR=[{n:'Commun',col:'#cfd3e6',na:1},{n:'Rare',col:'#4d9dff',na:2},{n:'Épique',col:'#b86bff',na:3},{n:'Légendaire',col:'#ffb13c',na:3}];
const SLOTS={canon:'Canon',blind:'Blindage',moteur:'Moteur',noyau:'Noyau',mod1:'Module',mod2:'Module'};
const STYPE=k=>k==='mod1'||k==='mod2'?'mod':k;
const EL={burn:{n:'Brûlure',col:'#ff8a2d'},frost:{n:'Givre',col:'#8fd8ff'},shock:{n:'Choc',col:'#fff27a'},acid:{n:'Corrosion',col:'#7dff4a'}};
const AFX={
  mas:{t:v=>'+'+v+' Masse',r:[2,5],i:1},flx:{t:v=>'+'+v+' Flux',r:[2,5],i:1},pre:{t:v=>'+'+v+' Précision',r:[2,5],i:1},
  rsn:{t:v=>'+'+v+' Résonance',r:[2,5],i:1},ins:{t:v=>'+'+v+' Instinct',r:[2,5],i:1},vit:{t:v=>'+'+v+' Vitalité',r:[2,5],i:1},
  dmg:{t:v=>'+'+v+' % dégâts',r:[4,9]},rate:{t:v=>'+'+v+' % cadence',r:[4,9]},crit:{t:v=>'+'+v+' % chance critique',r:[2,4]},
  critd:{t:v=>'+'+v+' % dégâts critiques',r:[12,25]},range:{t:v=>'+'+v+' % portée',r:[6,14]},armor:{t:v=>'-'+v+' % dégâts subis',r:[3,6]},
  spd:{t:v=>'+'+v+' % vitesse',r:[3,6]},cdr:{t:v=>'-'+v+' % recharge des compétences',r:[3,6]},ult:{t:v=>'+'+v+' % charge d’ultime',r:[6,14]},
  skd:{t:v=>'+'+v+' % dégâts des compétences',r:[6,14]},mag:{t:v=>'+'+v+' % rayon de collecte',r:[10,25]},bub:{t:v=>'+'+v+' bulles de départ',r:[2,5],i:1},
  rgn:{t:v=>'+'+v+' bulle / 10 s',r:[.5,1.2]},burn:{t:v=>'+'+v+' % chance de Brûlure',r:[3,7]},frost:{t:v=>'+'+v+' % chance de Givre',r:[4,8]},
  shock:{t:v=>'+'+v+' % chance de Choc',r:[3,7]},acid:{t:v=>'+'+v+' % chance de Corrosion',r:[4,8]},stp:{t:v=>'+'+v+' % puissance des altérations',r:[10,22]},
  dodge:{t:v=>'+'+v+' % esquive',r:[1.5,3]},exec:{t:v=>'Exécute sous '+v+' % de vie',r:[2,4]},contact:{t:v=>'+'+v+' % dégâts de contact',r:[15,35]},
  dashcd:{t:v=>'-'+v+' % recharge du dash',r:[4,8]}};
const SAFX={canon:['dmg','rate','crit','critd','range','pre','flx','burn','frost','shock','acid'],blind:['armor','bub','rgn','contact','mas','vit','dodge'],
  moteur:['spd','dashcd','dodge','ins','flx','mag','cdr'],noyau:['burn','frost','shock','acid','stp','rsn','skd','ult','cdr','exec'],
  mod:['mas','flx','pre','rsn','ins','vit','dmg','rate','crit','critd','armor','spd','cdr','ult','skd','mag','bub','rgn','burn','frost','shock','acid','stp','dodge']};
const BASES={
  canon:[{n:'Canon standard',b:{}},{n:'Canon à dispersion',b:{turrets:2,dmgM:-.3,rangeM:-.25},d:'+2 canons, -30 % dégâts, -25 % portée'},
    {n:'Obusier',b:{dmgM:.6,rateM:-.35,bsizeM:.6,pierce:1},d:'+60 % dégâts, -35 % cadence, obus perforants'},
    {n:'Mitrailleur',b:{rateM:.7,dmgM:-.35},d:'+70 % cadence, -35 % dégâts'},{n:'Canon-rail',b:{bspdM:.8,pierce:2,rateM:-.2},d:'Projectiles très rapides, perforent 2 fois, -20 % cadence'}],
  blind:[{n:'Plaques',b:{armor:6}},{n:'Carapace',b:{armor:4,bub:4}},{n:'Membrane',b:{rgn:.8,armor:2}}],
  moteur:[{n:'Propulseur',b:{spd:6}},{n:'Réacteur à phase',b:{dashcd:10,spd:2}},{n:'Gyroscope',b:{dodge:3}}],
  noyau:[{n:'Noyau ardent',b:{burn:6}},{n:'Noyau cryo',b:{frost:8}},{n:'Noyau tesla',b:{shock:6}},{n:'Noyau acide',b:{acid:8}},{n:'Noyau d’écho',b:{skd:10,cdr:4}}],
  mod:[{n:'Module',b:{}}]};
const UNIQ={
  geant:{n:'Cœur de Géant',s:'blind',d:'Taille +35 %, +10 bulles de départ, +40 % dégâts de contact. Vitesse -12 %.'},
  verre:{n:'Lentille de verre',s:'canon',d:'Dégâts critiques +250 %, mais chance critique divisée par deux.'},
  brasier:{n:'Brasier éternel',s:'noyau',d:'Un ennemi qui meurt en brûlant enflamme tous ceux qui l’entourent.'},
  zero:{n:'Zéro absolu',s:'noyau',d:'Le gel survient à 3 cumuls au lieu de 5. Les ennemis gelés subissent le double de dégâts.'},
  tesla:{n:'Bobine Tesla',s:'noyau',d:'Le Choc rebondit sur 2 ennemis de plus et applique la Corrosion.'},
  sangfroid:{n:'Sang-froid',s:'mod',d:'+1 % de dégâts par bulle qui te manque pour le niveau suivant (max +60 %).'},
  pacte:{n:'Pacte du Noyau',s:'mod',d:'Charge d’ultime doublée. Déclencher l’ultime coûte 10 bulles.'},
  echo:{n:'Écho d’Iris',s:'mod',d:'Chaque compétence se relance une seconde fois, à 50 % de puissance.'},
  miroir:{n:'Carapace miroir',s:'blind',d:'Chaque coup reçu déclenche une onde de foudre proportionnelle aux bulles perdues.'},
  vorace:{n:'Gueule vorace',s:'moteur',d:'Chaque ennemi absorbé rend 1 bulle, mais ton aimant perd 80 % de portée.'},
  surtension:{n:'Surtension',s:'canon',d:'Les dégâts en trop d’un coup mortel sautent sur l’ennemi le plus proche.'},
  catalyse:{n:'Catalyseur',s:'noyau',d:'Chaque cumul de Corrosion augmente les dégâts de Brûlure de 15 %.'}};

/* ---------- méta ---------- */
function giMetaInit(){
  if(!meta.inv)meta.inv=[];if(!meta.eq)meta.eq={};if(!meta.pilot)meta.pilot={lvl:1,xp:0,pts:0,a:{}};if(!meta.tank)meta.tank={name:'BULGE-01'};if(!meta.iseq)meta.iseq=1;
  if(!meta.inv.length&&!Object.keys(meta.eq).length){for(const s of ['canon','blind','moteur']){const it=giRoll(1,0,s,0);meta.inv.push(it);meta.eq[s]=it.id;}saveMeta();}
}
function xpFor(l){return 180+l*110;}
function giItem(id){return meta.inv.find(i=>i.id===id);}
function giEquipped(){const o={};for(const s in SLOTS){const it=meta.eq[s]&&giItem(meta.eq[s]);if(it)o[s]=it;}return o;}

/* ---------- génération d'objets ---------- */
function rv(k,roll,ilvl){const A=AFX[k],v=(A.r[0]+(A.r[1]-A.r[0])*roll)*(1+.06*(ilvl-1));return A.i?Math.max(1,Math.round(v)):Math.round(v*10)/10;}
function giRoll(ilvl,r,slot,baseI){
  const st=slot||['canon','blind','moteur','noyau','mod','mod'][Math.floor(R()*6)],BL=BASES[st],bi=baseI!=null?baseI:Math.floor(R()*BL.length),B=BL[bi];
  const it={id:meta.iseq++,s:st,r,lvl:ilvl,up:0,bi,aff:[],u:null};
  const pool=SAFX[st].filter(k=>!(k==='exec'&&r<2)),n=RAR[r].na;
  while(it.aff.length<n&&pool.length){const k=pool.splice(Math.floor(R()*pool.length),1)[0];it.aff.push([k,R()]);}
  if(r===3){const U=Object.keys(UNIQ).filter(k=>UNIQ[k].s===st);it.u=U.length?U[Math.floor(R()*U.length)]:null;if(!it.u)it.r=2;}
  return it;
}
function giName(it){const B=BASES[it.s][it.bi]||BASES[it.s][0];if(it.u)return UNIQ[it.u].n;
  const a=it.aff[0],suf=a?({burn:' ardent',frost:' cryogénique',shock:' voltaïque',acid:' corrosif',mas:' massif',flx:' fluide',pre:' précis',rsn:' résonant',ins:' vif',vit:' vivace',crit:' affûté',dmg:' brutal',rate:' rapide',armor:' renforcé',spd:' léger'}[a[0]]||''):'';
  return B.n+suf;}
function giUpM(it){return 1+.1*it.up;}
function giLines(it){const B=BASES[it.s][it.bi]||BASES[it.s][0],m=giUpM(it),out=[];
  for(const k in B.b)if(AFX[k])out.push([k,Math.round(rv(k,.5,it.lvl)*m*10)/10,1]);
  for(const [k,roll] of it.aff){let v=rv(k,roll,it.lvl)*m;v=AFX[k].i?Math.round(v):Math.round(v*10)/10;out.push([k,v,0]);}
  return out;}

/* ---------- calcul des statistiques (utilisé par le hangar ET en partie) ---------- */
function giStats(eq,pa){
  const S={},A={},U={},st={turrets:0,pierce:0,dmgM:0,rateM:0,rangeM:0,bsizeM:0,bspdM:0};
  for(const k of ATK)A[k]=(pa&&pa[k])||0;
  for(const s in eq){const it=eq[s];if(!it)continue;const B=BASES[it.s][it.bi]||BASES[it.s][0];
    for(const k in B.b)if(!AFX[k])st[k]+=B.b[k];
    for(const [k,v] of giLines(it)){if(AFX[k].i&&ATTR[k])A[k]+=v;else S[k]=(S[k]||0)+v;}
    if(it.u)U[it.u]=1;}
  const g=k=>(S[k]||0)/100,D={A,U,st};
  D.dmgMul=(1+g('dmg'))*(1+st.dmgM);
  D.rateMul=(1+g('rate')+A.flx*.012)*(1+st.rateM);
  D.crit=Math.min(.75,g('crit')+(1-Math.exp(-A.pre*.012))*.5);if(U.verre)D.crit*=.5;
  D.critM=2.5*(1+g('critd')+A.pre*.025)+(U.verre?2.5:0);
  D.range=(1+g('range')+A.pre*.01)*(1+st.rangeM);D.bspd=(1+A.flx*.01)*(1+st.bspdM);
  D.cdMul=(1-g('cdr'))*Math.pow(.992,A.flx);D.ultM=(1+g('ult')+A.flx*.015)*(U.pacte?2:1);
  D.el={};for(const e in EL)D.el[e]=g(e)>0?g(e)+A.rsn*.01:0;
  D.stp=1+g('stp')+A.rsn*.03;D.skM=1+g('skd')+A.rsn*.02;
  D.armorMul=(1-g('armor'))*Math.pow(.99,A.mas);D.dodge=Math.min(.4,g('dodge')+(1-Math.exp(-A.ins*.01))*.3);
  D.spdMul=(1+g('spd')+A.ins*.008-A.mas*.004)*(U.geant?.88:1);D.dashMul=(1-g('dashcd'))*Math.pow(.988,A.ins);
  D.magMul=(1+g('mag')+A.ins*.02)*(U.vorace?.2:1);D.bub=Math.floor((S.bub||0)+A.vit*.5+A.mas*.25+(U.geant?10:0));
  D.rgn=((S.rgn||0)+A.vit*.3)/10;D.size=1+A.mas*.012+(U.geant?.35:0);D.contact=g('contact')+A.mas*.03+(U.geant?.4:0);
  D.greed=1+A.vit*.015;D.exec=g('exec');
  const stx=D.el.burn*1.2+D.el.frost*.8+D.el.shock*1+D.el.acid*.9;
  D.pow=Math.round(100*D.dmgMul*D.rateMul*(1+D.crit*(D.critM-1))*(1+stx*D.stp)*(1+.35*st.turrets)*(1+.15*st.pierce));
  D.surv=Math.round(100*(1+D.bub/12)/D.armorMul/(1-D.dodge)*(1+D.rgn*6));
  return D;
}
function pilotA(){return meta.pilot.a||{};}

/* ---------- application en début de partie ---------- */
function giRunStart(){
  const P=G.p,D=giStats(G.daily?{}:giEquipped(),G.daily?{}:pilotA());
  G.gi={bag:[],drops:[],rg:0,echo:[],guard:0,xp0:meta.pilot.xp};
  P.dmg*=D.dmgMul;P.fireI/=D.rateMul;P.crit=Math.min(.9,P.crit+D.crit);if(D.U.verre)P.crit*=.5;P.critM=D.critM;
  P.blife*=D.range;P.bspd*=D.bspd;P.cdMul*=D.cdMul;P.ultM=D.ultM;P.st=D.el;P.stp=D.stp;P.skM=D.skM;
  P.armor*=D.armorMul;P.dodge=D.dodge;P.spd*=D.spdMul;P.dashMax*=D.dashMul;P.magnet*=D.magMul;P.bub+=D.bub;P.rg=D.rgn;
  P.baseR*=D.size;P.r=P.baseR;P.contact=D.contact;P.greed*=D.greed;P.exec=D.exec;P.u=D.U;
  P.turrets=Math.max(1,(P.turrets|0)+(D.st.turrets|0));P.pierce+=D.st.pierce|0;P.bsize*=1+(D.st.bsizeM||0);
  if(D.U.geant||D.U.verre||Object.keys(D.U).length)P.legend=1;
}

/* ---------- combat : altérations et synergies ---------- */
function giHit(e,dmg,crit){
  const P=G.p;if(!P.u)return dmg;
  if(e.acid)dmg*=1+.04*e.acid;
  if(e.frozenT>0){dmg*=P.u.zero?2:1.3;if(crit&&!G.gi.guard){G.gi.guard=1;ringFX(e.x,e.y,e.r,e.r+90,'#cfefff',14,4);sparks(e.x,e.y,'#cfefff',12,5);
    for(const o of G.en)if(o!==e&&!o.dead&&dist2(o.x,o.y,e.x,e.y)<110*110)hurtEnemy(o,dmg*.5,0,0,true);G.gi.guard=0;e.frozenT=0;e.stun=0;}}
  if(P.u.sangfroid){const miss=Math.max(0,T(P.lvl+1)-P.bub);dmg*=1+Math.min(.6,.01*miss);}
  return dmg;
}
function giAfter(e,dmg,crit){
  const P=G.p;if(!P.st||!G.gi)return;
  if(e.hp>0&&P.exec>0&&e.hp<e.mhp*P.exec&&!e.aff){e.hp=0;ringFX(e.x,e.y,e.r,e.r*2.5,COL.vi,12,3);}
  if(e.hp<0&&P.u.surtension&&!G.gi.guard){const ov=-e.hp;let b=null,bd=260*260;for(const o of G.en){if(o===e||o.dead)continue;const d=dist2(o.x,o.y,e.x,e.y);if(d<bd){bd=d;b=o;}}
    if(b){G.gi.guard=1;G.gc&&G.gc.bolts.push({x0:e.x,y0:e.y,x1:b.x,y1:b.y,life:8,max:8,s:R()*9});hurtEnemy(b,ov,0,0,true);G.gi.guard=0;}}
  if(e.hp<=0||G.gi.guard)return;
  const s=P.st,k=P.stp;
  if(s.burn&&R()<s.burn){e.burn=Math.min(5,(e.burn||0)+1);e.burnT=180;e.burnD=Math.max(e.burnD||0,P.dmg*lvlDmg()*.12*k);}
  if(s.acid&&R()<s.acid){e.acid=Math.min(10,(e.acid||0)+1);e.acidT=300;}
  if(s.frost&&R()<s.frost&&!(e.frozenT>0)){e.frost=(e.frost||0)+1;e.frostT=180;if(e.frost>=(P.u.zero?3:5)){e.frost=0;e.frozenT=Math.round(80*Math.sqrt(k));e.stun=e.frozenT;}}
  if(s.shock&&R()<s.shock){const n=P.u.tesla?4:2,hit=[e];let src=e;G.gi.guard=1;
    for(let j=0;j<n;j++){let b=null,bd=220*220;for(const o of G.en){if(o.dead||hit.includes(o))continue;const d=dist2(o.x,o.y,src.x,src.y);if(d<bd){bd=d;b=o;}}if(!b)break;hit.push(b);
      G.gc&&G.gc.bolts.push({x0:src.x,y0:src.y,x1:b.x,y1:b.y,life:9,max:9,s:R()*9});
      if(src.burn>0){b.burn=Math.min(5,(b.burn||0)+1);b.burnT=180;b.burnD=Math.max(b.burnD||0,src.burnD||0);}
      if(P.u.tesla){b.acid=Math.min(10,(b.acid||0)+1);b.acidT=300;}
      hurtEnemy(b,dmg*.45*k,0,0,true);src=b;}
    G.gi.guard=0;}
}
function giKill(e){
  const P=G.p;if(!G.gi)return;
  if(P.u&&P.u.vorace){P.bub+=1;checkLevel();}
  if(P.u&&P.u.brasier&&e.burn>0){ringFX(e.x,e.y,e.r,160,EL.burn.col,16,3);for(const o of G.en)if(!o.dead&&dist2(o.x,o.y,e.x,e.y)<160*160){o.burn=Math.min(5,(o.burn||0)+e.burn);o.burnT=180;o.burnD=Math.max(o.burnD||0,e.burnD);}}
  if(G.daily)return;
  if(e.aff){if(R()<.14)giDrop(e.x,e.y,'elite');}else if(R()<.0035)giDrop(e.x,e.y,'mob');
}
function giHurt(lost){const P=G.p;if(P.u&&P.u.miroir&&lost>0){const R0=150+lost*6;dmgAll(P.x,P.y,R0,P.dmg*lvlDmg()*lost*.9,8,0);ringFX(P.x,P.y,P.r,R0,EL.shock.col,16,4);}}
function giDodge(){const P=G.p;if(P.dodge>0&&R()<P.dodge){ringFX(P.x,P.y,P.r,P.r*2.2,COL.cy,10,2);P.inv=Math.max(P.inv,24);return true;}return false;}
function giEcho(i){const P=G.p;if(!P.u||!P.u.echo||G.gi.echoing)return;G.gi.echo.push({i,t:30});}
function giTick(){
  const P=G.p,I=G.gi;if(!I)return;
  if(P.rg>0&&!P.dead){I.rg+=P.rg/60;if(I.rg>=1){const n=Math.floor(I.rg);I.rg-=n;P.bub+=n;checkLevel();}}
  for(let i=I.echo.length-1;i>=0;i--){const q=I.echo[i];if(--q.t>0)continue;I.echo.splice(i,1);const s=P.sk[q.i];if(!s)continue;const cd=s.cd,m=P.skM;s.cd=0;P.skM*=.5;I.echoing=1;gcUse(q.i);I.echoing=0;P.skM=m;s.cd=cd;}
  if(G.t%30===0){I.guard=1;for(const e of G.en){if(e.dead)continue;
    if(e.burnT>0){e.burnT-=30;const cat=P.u&&P.u.catalyse?1+.15*(e.acid||0):1;hurtEnemy(e,e.burnD*e.burn*cat,0,0,true);if(e.burnT<=0)e.burn=0;}
    if(e.acidT>0){e.acidT-=30;if(e.acidT<=0)e.acid=0;}if(e.frostT>0){e.frostT-=30;if(e.frostT<=0)e.frost=0;}}I.guard=0;}
  for(const e of G.en)if(e.frozenT>0)e.frozenT--;
  if(P.contact>0&&G.t%8===0&&!P.dead)for(const e of G.en){if(e.dead||e.spawn>0)continue;if(dist2(e.x,e.y,P.x,P.y)<(e.r+P.r+6)**2)hurtEnemy(e,P.dmg*lvlDmg()*P.contact*(P.r/14),(e.x-P.x)*.05,(e.y-P.y)*.05,true);}
  for(let i=I.drops.length-1;i>=0;i--){const d=I.drops[i];d.t++;const dx=P.x-d.x,dy=P.y-d.y,dd=Math.hypot(dx,dy);
    if(dd<P.magnet*.6+60&&d.t>30){d.x+=dx/dd*Math.min(dd,9);d.y+=dy/dd*Math.min(dd,9);}
    if(dd<P.r+18){I.drops.splice(i,1);giGet(d.it);}}
}
function giIlvl(){return Math.max(1,Math.min(40,Math.round(1+(G.room-1)*4+G.heat*.5+meta.pilot.lvl*.3)));}
function giRar(src){const t={mob:[70,25,5,0],elite:[55,32,11,2],heart:[0,55,35,10],rift:[0,50,38,12],boss:[0,0,0,100]}[src]||[60,30,9,1];
  let x=R()*100;for(let i=0;i<4;i++){x-=t[i];if(x<0)return i;}return 0;}
function giDrop(x,y,src,direct){if(!G.gi||G.daily)return;const it=giRoll(giIlvl(),giRar(src));if(direct){giGet(it);return;}G.gi.drops.push({x,y,it,t:0});}
function giGet(it){G.gi.bag.push(it);const c=RAR[it.r].col;toast('Butin '+RAR[it.r].n.toLowerCase());SFX.ach();if(it.r>=2){G.flash=Math.max(G.flash,.2);}ringFX(G.p.x,G.p.y,G.p.r,G.p.r*3,c,18,3);}

/* ---------- rendu ---------- */
function giDrawWorld(){
  const c=ctx,I=G.gi;if(!I)return;
  for(const d of I.drops){if(!vis(d.x,d.y,80))continue;const col=RAR[d.it.r].col,b=Math.sin(RT*.1+d.x)*3;
    c.globalCompositeOperation='lighter';c.globalAlpha=.25;c.fillStyle=col;c.fillRect(d.x-5,d.y-140,10,140);glow(d.x,d.y,40,col,.5);c.globalCompositeOperation='source-over';c.globalAlpha=1;
    c.save();c.translate(d.x,d.y+b);c.rotate(Math.sin(RT*.05)*.2);c.fillStyle='rgba(10,6,20,.95)';c.strokeStyle=col;c.lineWidth=2.5;c.fillRect(-12,-10,24,20);c.strokeRect(-12,-10,24,20);c.fillStyle=col;c.fillRect(-12,-2,24,4);c.restore();}
}
function giDrawUnder(){
  const c=ctx;
  for(const e of G.en){if(e.dead||!(e.burn||e.frost||e.acid||e.frozenT>0))continue;if(!vis(e.x,e.y,e.r+20))continue;
    if(e.frozenT>0){c.globalAlpha=.55;c.fillStyle='#cfefff';c.beginPath();for(let k=0;k<6;k++){const a=k*TAU/6+.5,x=e.x+Math.cos(a)*(e.r+6),y=e.y+Math.sin(a)*(e.r+6);k?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();}
    else if(e.frost){c.globalAlpha=.8;c.strokeStyle=EL.frost.col;c.lineWidth=2;for(let k=0;k<e.frost;k++){c.beginPath();c.arc(e.x,e.y,e.r+5,k*1.2,k*1.2+.9);c.stroke();}}
    if(e.burn){c.globalAlpha=.5+.2*Math.sin(RT*.4+e.wob);c.strokeStyle=EL.burn.col;c.lineWidth=1.5+e.burn;c.beginPath();c.arc(e.x,e.y,e.r+3,0,TAU);c.stroke();if(G.t%6===0)FX({ty:0,x:e.x+rr(-e.r,e.r),y:e.y+rr(-e.r,e.r),vx:0,vy:-1,life:16,max:16,col:EL.burn.col,s:3});}
    if(e.acid){c.globalAlpha=.9;c.fillStyle=EL.acid.col;for(let k=0;k<Math.min(10,e.acid);k++){const a=k*TAU/10-Math.PI/2;c.fillRect(e.x+Math.cos(a)*(e.r+10)-1.5,e.y+Math.sin(a)*(e.r+10)-1.5,3,3);}}
    c.globalAlpha=1;}
  const P=G.p;if(P.legend&&!P.dead){c.globalAlpha=.35+.15*Math.sin(RT*.08);c.strokeStyle=RAR[3].col;c.lineWidth=2;c.setLineDash([6,10]);c.lineDashOffset=RT*.5;c.beginPath();c.arc(P.x,P.y,P.r+16,0,TAU);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
}

/* ---------- fin de partie : butin et expérience de pilote ---------- */
function giEnd(win){
  const I=G.gi;if(!I||I.ended)return;I.ended=1;
  const xp=G.daily?0:Math.round(G.score/60+G.kills*1.5+G.heartsDone*120+(win?600:0)+(G.gs?G.gs.echo*30:0));I.xp=xp;
  const PL=meta.pilot;PL.xp+=xp;I.lvUp=0;while(PL.xp>=xpFor(PL.lvl)&&PL.lvl<60){PL.xp-=xpFor(PL.lvl);PL.lvl++;PL.pts+=3;I.lvUp++;}
  for(const it of I.bag)meta.inv.push(it);
  const eqIds=new Set(Object.values(meta.eq));let sal=0;
  while(meta.inv.length>80){let w=-1;for(let i=0;i<meta.inv.length;i++){const it=meta.inv[i];if(eqIds.has(it.id)||it.lock)continue;if(w<0||it.r<meta.inv[w].r||(it.r===meta.inv[w].r&&it.lvl<meta.inv[w].lvl))w=i;}if(w<0)break;sal+=giSalv(meta.inv[w]);meta.inv.splice(w,1);}
  if(sal)meta.shards+=sal;I.autoSal=sal;saveMeta();
}
function giEndBox(){
  const I=G.gi;if(!I||G.daily)return '';let h='<div class="mt">Pilote niv. '+meta.pilot.lvl+' <span class="muted">+'+I.xp+' XP</span></div>';
  if(I.lvUp)h+='<div class="gsrow gold">Niveau de pilote gagné ! +'+(3*I.lvUp)+' points d’attribut à répartir au Hangar</div>';
  if(I.bag.length)h+='<div class="gsrow">Butin rapporté :</div><div class="lootrow">'+I.bag.map(it=>'<span class="chip" style="border-color:'+RAR[it.r].col+';color:'+RAR[it.r].col+'">'+giName(it)+'</span>').join('')+'</div>';
  if(I.autoSal)h+='<div class="gsrow muted">Inventaire plein : objets les plus faibles recyclés (+'+I.autoSal+' ◇)</div>';
  return h;
}

/* ---------- hangar ---------- */
function giSalv(it){return Math.round(5*Math.pow(1+it.r,2)+it.up*10);}
function giUpCost(it){return 40*(it.up+1)*(1+it.r);}
let HG={f:'all',sel:null};
function statRows(D,ref){
  const pc=v=>Math.round(v*100)+' %',x=v=>'×'+(Math.round(v*100)/100),r=[
    ['Attaque'],['Dégâts',x(D.dmgMul),D.dmgMul,ref&&ref.dmgMul],['Cadence',x(D.rateMul),D.rateMul,ref&&ref.rateMul],['Chance critique',pc(D.crit),D.crit,ref&&ref.crit],
    ['Dégâts critiques','×'+D.critM.toFixed(2),D.critM,ref&&ref.critM],['Portée',x(D.range),D.range,ref&&ref.range],['Canons / perforation','+'+D.st.turrets+' / +'+D.st.pierce,D.st.turrets+D.st.pierce,ref&&(ref.st.turrets+ref.st.pierce)],
    ['Altérations']];
  for(const e in EL)r.push([EL[e].n,pc(D.el[e]),D.el[e],ref&&ref.el[e]]);
  r.push(['Puissance des altérations',x(D.stp),D.stp,ref&&ref.stp],['Exécution',pc(D.exec),D.exec,ref&&ref.exec],
    ['Défense'],['Dégâts subis',x(D.armorMul),-D.armorMul,ref&&-ref.armorMul],['Esquive',pc(D.dodge),D.dodge,ref&&ref.dodge],['Bulles de départ','+'+D.bub,D.bub,ref&&ref.bub],
    ['Régénération',(Math.round(D.rgn*100)/10)+' / 10 s',D.rgn,ref&&ref.rgn],['Taille / contact',x(D.size)+' / '+pc(D.contact),D.contact,ref&&ref.contact],
    ['Mobilité et utilité'],['Vitesse',x(D.spdMul),D.spdMul,ref&&ref.spdMul],['Recharge du dash',x(D.dashMul),-D.dashMul,ref&&-ref.dashMul],['Recharge des compétences',x(D.cdMul),-D.cdMul,ref&&-ref.cdMul],
    ['Dégâts des compétences',x(D.skM),D.skM,ref&&ref.skM],['Charge d’ultime',x(D.ultM),D.ultM,ref&&ref.ultM],['Collecte',x(D.magMul),D.magMul,ref&&ref.magMul]);
  return r.map(q=>q.length===1?'<div class="sth">'+q[0]+'</div>':'<div class="str"><span>'+q[0]+'</span><b>'+q[1]+(ref&&q[3]!=null&&Math.abs(q[2]-q[3])>1e-6?' <i class="'+(q[2]>q[3]?'up':'dn')+'">'+(q[2]>q[3]?'▲':'▼')+'</i>':'')+'</b></div>').join('');
}
function itemCard(it,eqd){
  const c=RAR[it.r].col,B=BASES[it.s][it.bi]||BASES[it.s][0];
  return '<div class="itc" style="--rc:'+c+'"><div class="itn">'+giName(it)+(it.up?' +'+it.up:'')+'</div><div class="its">'+RAR[it.r].n+' · '+(it.s==='mod'?'Module':SLOTS[it.s])+' · niv. '+it.lvl+(eqd?' · équipé':'')+'</div>'+
    (B.d?'<div class="itb">'+B.d+'</div>':'')+giLines(it).map(([k,v,b])=>'<div class="ita'+(b?' base':'')+'">'+AFX[k].t(v)+'</div>').join('')+(it.u?'<div class="itu">'+UNIQ[it.u].d+'</div>':'')+'</div>';
}
function eqSlotFor(it){if(it.s!=='mod')return it.s;return !meta.eq.mod1?'mod1':!meta.eq.mod2?'mod2':'mod1';}
function renderHangar(){
  giMetaInit();const eq=giEquipped(),D=giStats(eq,pilotA()),PL=meta.pilot,eqIds=new Set(Object.values(meta.eq));
  $('hgName').value=meta.tank.name;
  $('hgIdx').innerHTML='<div class="pill"><b>'+D.pow+'</b><span>indice de puissance</span></div><div class="pill"><b>'+D.surv+'</b><span>indice de survie</span></div><div class="pill"><b>'+PL.lvl+'</b><span>niveau de pilote</span></div>';
  $('hgSlots').innerHTML=Object.keys(SLOTS).map(s=>{const it=eq[s];return '<button class="slot" data-slot="'+s+'" style="--rc:'+(it?RAR[it.r].col:'#3a3456')+'"><span class="sl">'+SLOTS[s]+'</span><span class="sn">'+(it?giName(it)+(it.up?' +'+it.up:''):'Vide')+'</span></button>';}).join('');
  let sel=HG.sel&&giItem(HG.sel),ref=null;
  if(sel&&!eqIds.has(sel.id)){const e2=Object.assign({},eq);e2[eqSlotFor(sel)]=sel;ref=D;const D2=giStats(e2,pilotA());
    $('hgStats').innerHTML='<div class="sth">Si tu équipes '+giName(sel)+' : puissance '+D2.pow+' ('+(D2.pow>=D.pow?'+':'')+(D2.pow-D.pow)+'), survie '+D2.surv+' ('+(D2.surv>=D.surv?'+':'')+(D2.surv-D.surv)+')</div>'+statRows(D2,D);}
  else $('hgStats').innerHTML=statRows(D);
  const pa=pilotA();
  $('hgPilot').innerHTML='<div class="mt">Pilote niv. '+PL.lvl+' · '+PL.xp+' / '+xpFor(PL.lvl)+' XP · <span class="gold">'+PL.pts+' point'+(PL.pts>1?'s':'')+' à répartir</span></div>'+
    ATK.map(k=>{const A=ATTR[k],tot=D.A[k];return '<div class="atr" style="--ac:'+A.col+'"><div class="atn"><b>'+A.n+'</b> '+tot+' <span class="muted">(pilote '+(pa[k]||0)+')</span></div><div class="atb"><button data-am="'+k+'" '+((pa[k]||0)?'':'disabled')+'>−</button><button data-ap="'+k+'" '+(PL.pts?'':'disabled')+'>+</button></div><div class="atf">'+A.fx.join(' · ')+'</div></div>';}).join('');
  const list=meta.inv.filter(it=>HG.f==='all'||it.s===HG.f).sort((a,b)=>(eqIds.has(b.id)-eqIds.has(a.id))||(b.r-a.r)||(b.lvl-a.lvl));
  document.querySelectorAll('#hgF button').forEach(b=>b.classList.toggle('on',b.dataset.f===HG.f));
  $('hgInv').innerHTML=list.length?list.map(it=>'<button class="inv'+(HG.sel===it.id?' on':'')+(eqIds.has(it.id)?' eq':'')+'" data-it="'+it.id+'" style="--rc:'+RAR[it.r].col+'">'+giName(it)+(it.up?' +'+it.up:'')+'<small>'+(it.s==='mod'?'Module':SLOTS[it.s])+' · niv. '+it.lvl+'</small></button>').join(''):'<p class="muted">Aucun objet. Les élites, les cœurs, les failles et l’Hypernoyau lâchent de l’équipement.</p>';
  $('hgInvN').textContent=meta.inv.length+' / 80';
  if(sel){const isEq=eqIds.has(sel.id),cur=eq[eqSlotFor(sel)];
    $('hgDet').innerHTML='<div class="cmp">'+itemCard(sel,isEq)+(cur&&!isEq?itemCard(cur,true):'')+'</div><div class="btns row">'+
      (isEq?'<button class="btn" data-act="uneq">Retirer</button>':'<button class="btn pri" data-act="eq">Équiper</button>')+
      (sel.up<5?'<button class="btn" data-act="up">Améliorer +'+(sel.up+1)+' ('+giUpCost(sel)+' ◇)</button>':'')+
      (!isEq?'<button class="btn warn" data-act="sal">Recycler (+'+giSalv(sel)+' ◇)</button>':'')+'</div>';}
  else $('hgDet').innerHTML='<p class="muted">Touche un objet pour le comparer à ce que tu portes. ◇ '+fmt(meta.shards)+' éclats disponibles.</p>';
  drawTankPreview(eq);
}
function drawTankPreview(eq){
  const cv2=$('hgPrev');if(!cv2)return;const g=cv2.getContext('2d'),w=cv2.width,h=cv2.height,sk=SKINS[meta.skin],col=(sk&&sk.col&&skinOK(meta.skin))?sk.col:(PROF[meta.lastProf]||PROF.bal).col;
  g.clearRect(0,0,w,h);const cx=w/2,cy=h/2,B=eq.canon?BASES.canon[eq.canon.bi]:BASES.canon[0],tur=1+(B.b.turrets||0),rad=34*(eq.blind&&eq.blind.u==='geant'?1.25:1);
  const rg=g.createRadialGradient(cx,cy,10,cx,cy,90);rg.addColorStop(0,col+'55');rg.addColorStop(1,'transparent');g.fillStyle=rg;g.fillRect(0,0,w,h);
  if(eq.moteur){g.fillStyle=RAR[eq.moteur.r].col;for(const s of [-1,1]){g.globalAlpha=.7;g.beginPath();g.moveTo(cx-rad*.6*s,cy+rad*.7);g.lineTo(cx-rad*.35*s,cy+rad*1.35);g.lineTo(cx-rad*.1*s,cy+rad*.7);g.fill();}g.globalAlpha=1;}
  g.strokeStyle=col;g.lineCap='round';g.lineWidth=B.b.bsizeM?11:7;for(let i=0;i<tur;i++){const a=-Math.PI/2+(i-(tur-1)/2)*.35;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(rad+(B.b.bspdM?34:22)),cy+Math.sin(a)*(rad+(B.b.bspdM?34:22)));g.stroke();}
  g.fillStyle='#120a22';g.beginPath();g.arc(cx,cy,rad,0,TAU);g.fill();g.lineWidth=eq.blind?3+eq.blind.r*2:2;g.strokeStyle=eq.blind?RAR[eq.blind.r].col:col;g.stroke();
  const n=eq.noyau;g.fillStyle=n?(EL[Object.keys(BASES.noyau[n.bi].b)[0]]||{col:'#fff'}).col:col;g.globalAlpha=.9;g.beginPath();g.arc(cx,cy,rad*.42,0,TAU);g.fill();g.globalAlpha=1;
  if(Object.values(eq).some(it=>it.r===3)){g.strokeStyle=RAR[3].col;g.setLineDash([5,7]);g.lineWidth=2;g.beginPath();g.arc(cx,cy,rad+14,0,TAU);g.stroke();g.setLineDash([]);}
}
function giBindUI(){
  $('bHangar').onclick=()=>{SFX.ui();HG.sel=null;renderHangar();show('ov-hangar');};
  $('hgName').onchange=e=>{meta.tank.name=(e.target.value||'BULGE-01').slice(0,18);e.target.value=meta.tank.name;saveMeta();};
  $('hgF').onclick=e=>{const b=e.target.closest('[data-f]');if(b){HG.f=b.dataset.f;renderHangar();}};
  $('hgInv').onclick=e=>{const b=e.target.closest('[data-it]');if(b){HG.sel=+b.dataset.it;SFX.ui();renderHangar();}};
  $('hgSlots').onclick=e=>{const b=e.target.closest('[data-slot]');if(!b)return;const id=meta.eq[b.dataset.slot];HG.f=STYPE(b.dataset.slot);HG.sel=id||null;renderHangar();};
  $('hgPilot').onclick=e=>{const b=e.target.closest('button');if(!b)return;const PL=meta.pilot;PL.a=PL.a||{};
    if(b.dataset.ap&&PL.pts>0){PL.pts--;PL.a[b.dataset.ap]=(PL.a[b.dataset.ap]||0)+1;}else if(b.dataset.am&&PL.a[b.dataset.am]>0){PL.a[b.dataset.am]--;PL.pts++;}saveMeta();SFX.ui();renderHangar();};
  $('hgDet').onclick=e=>{const b=e.target.closest('[data-act]');if(!b)return;const it=giItem(HG.sel);if(!it)return;const a=b.dataset.act;
    if(a==='eq'){meta.eq[eqSlotFor(it)]=it.id;SFX.evo();}
    else if(a==='uneq'){for(const s in meta.eq)if(meta.eq[s]===it.id)delete meta.eq[s];SFX.ui();}
    else if(a==='up'){const c=giUpCost(it);if(meta.shards<c){b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');return;}meta.shards-=c;it.up++;SFX.evo();}
    else if(a==='sal'){meta.shards+=giSalv(it);meta.inv=meta.inv.filter(x=>x!==it);HG.sel=null;SFX.pop(false);}
    saveMeta();renderHangar();};
}
giMetaInit();
