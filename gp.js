/* =========================================================
   POUVOIRS : power-ups temporaires, bonus permanents (cartes), fusions, pactes
   Un power-up se RAMASSE (losange vert-jaune au sol, quelques secondes) ; un bonus se CHOISIT
   (1 carte parmi 3 à l'arrivée sur chaque îlot) et dure toute la partie. Rien ne se garde
   d'une partie à l'autre.
   ========================================================= */
/* d : durée en pas (60 par seconde) ; 0 = effet instantané. Invincibilité courte (6 s), voulu par le propriétaire. */
const PUC='#e4ff3a',PU_LIFE=540;
const PU={
  inv:{n:'Invincibilité',d:360,w:9},
  rapid:{n:'Tir rapide',d:480,w:16},
  triple:{n:'Tir triple',d:480,w:16},
  pierce:{n:'Perforant',d:480,w:13},
  slow:{n:'Ralenti',d:300,w:11},
  shield:{n:'Bouclier',d:1200,w:12},
  wave:{n:'Onde',d:0,w:12},
  repair:{n:'Réparation',d:0,w:9},
};
const PUK=Object.keys(PU);
function rollPU(){const P=G.p;let tot=0;const ok=k=>!(k==='repair'&&P.seg>=P.segMax)&&!(k==='shield'&&P.pu.shield>0);
  for(const k of PUK)if(ok(k))tot+=PU[k].w;let r=R()*tot;for(const k of PUK){if(!ok(k))continue;r-=PU[k].w;if(r<=0)return k;}return 'wave';}
function dropPU(x,y,k){if(G.pus.length>=8)return;const a=R()*TAU;G.pus.push({x,y,vx:Math.cos(a)*1.6,vy:Math.sin(a)*1.6,k:k||rollPU(),life:PU_LIFE,ph:R()*TAU});
  if(!G.tut.pu){G.tut.pu=1;toast('Losange vert : un power-up. Passe dessus.');}}
/* un power-up chronométré est-il actif ? (Surcharge) */
function puAny(){const p=G.p.pu;for(const k in p)if(p[k]>0)return true;return false;}
function takePU(q){
  const P=G.p,D=PU[q.k];SFX.power();FX({ty:1,x:P.x,y:P.y,vx:0,vy:0,r:P.r,r1:P.r*3,life:16,max:16,col:PUC,w:3});
  ftext(P.x,P.y-P.r-16,D.n,PUC,15);G.score+=50;
  if(q.k==='wave'){shockwave(P.x,P.y,340,P.dmg*4,true);return;}
  if(q.k==='repair'){if(P.seg<P.segMax){P.seg++;SFX.seg();}return;}
  const d=Math.round(D.d*P.puDur);P.pu[q.k]=Math.max(P.pu[q.k]||0,d);P.puMax[q.k]=Math.max(P.pu[q.k],d);
}
function updPUs(){
  const P=G.p;for(const k in P.pu)if(P.pu[k]>0&&--P.pu[k]===0)delete P.pu[k];
  G.slowF=P.pu.slow>0?.5:1;
  const mag=P.magnet?260:0;
  for(let i=G.pus.length-1;i>=0;i--){const q=G.pus[i];q.life--;
    const dx=P.x-q.x,dy=P.y-q.y,d=Math.hypot(dx,dy)||1;
    if(mag&&d<mag&&!P.dead){q.vx=lerp(q.vx,dx/d*7,.2);q.vy=lerp(q.vy,dy/d*7,.2);}else{q.vx*=.9;q.vy*=.9;}
    q.x+=q.vx;q.y+=q.vy;confine(q,14);
    if(d<P.r+16&&!P.dead&&G.state==='play'){takePU(q);G.pus.splice(i,1);continue;}
    if(q.life<=0)G.pus.splice(i,1);}
}

/* ---------- bonus permanents ----------
   c : catégorie affichée ; max : nombre de prises ; f : effet sur le joueur (g2.js mkPlayer pour les champs). */
const BON=[
  {id:'twin',n:'Canons jumeaux',d:'+1 canon, tir en éventail.',c:'Arme',ic:'⋔',max:3,f:p=>{p.turrets++;}},
  {id:'heavy',n:'Obus lourds',d:'Dégâts ×1,35, obus plus gros.',c:'Arme',ic:'●',max:3,f:p=>{p.dmg*=1.35;p.bsize+=1.5;p.fireI*=1.06;}},
  {id:'rapid',n:'Surcadence',d:'Cadence de tir +22 %.',c:'Arme',ic:'≫',max:4,f:p=>{p.fireI/=1.22;}},
  {id:'rail',n:'Rail',d:'Tirs plus rapides, plus loin, ils traversent un ennemi de plus.',c:'Arme',ic:'━',max:3,f:p=>{p.bspd*=1.3;p.blife*=1.15;p.pierce++;}},
  {id:'homing',n:'Tête chercheuse',d:'Tes tirs dévient vers les ennemis.',c:'Arme',ic:'↝',max:3,f:p=>{p.homing+=.06;}},
  {id:'rico',n:'Ricochet',d:'Tes tirs rebondissent sur le décor et sur le bord.',c:'Arme',ic:'↯',max:2,f:p=>{p.rico++;}},
  {id:'split',n:'Fragmentation',d:'Chaque impact projette des éclats.',c:'Arme',ic:'✺',max:2,f:p=>{p.split++;}},
  {id:'crit',n:'Point faible',d:'+10 % de coups critiques, qui font ×2,5.',c:'Arme',ic:'✕',max:3,f:p=>{p.crit+=.1;}},
  {id:'mirror',n:'Tir arrière',d:'Un canon tire derrière toi.',c:'Arme',ic:'⇋',max:1,f:p=>{p.mirror=1;}},
  {id:'chain',n:'Arc électrique',d:'Un impact sur cinq saute sur un ennemi proche.',c:'Arme',ic:'ϟ',max:2,f:p=>{p.chain+=.2;}},
  {id:'burst',n:'Rafale',d:'Un tir sur cinq est un obus énorme qui traverse tout.',c:'Arme',ic:'⁂',max:2,f:p=>{p.burst++;}},
  {id:'aura',n:'Champ de mort',d:'Une aura ronge les ennemis proches.',c:'Module',ic:'◌',max:3,f:p=>{p.aura++;}},
  {id:'orbs',n:'Satellites',d:'+2 sphères qui tranchent les ennemis et bloquent les tirs.',c:'Module',ic:'∘',max:3,f:p=>{p.orbs+=2;}},
  {id:'drone',n:'Drone',d:'+1 drone qui tire tout seul.',c:'Module',ic:'⊛',max:3,f:p=>{p.drones++;}},
  {id:'missile',n:'Missiles',d:'Salve régulière de missiles explosifs.',c:'Module',ic:'➶',max:3,f:p=>{p.missile++;}},
  {id:'mines',n:'Mines',d:'Ton dash sème des mines.',c:'Module',ic:'⊕',max:2,f:p=>{p.mines++;}},
  {id:'speed',n:'Hyperdrive',d:'Vitesse +12 %.',c:'Corps',ic:'➤',max:3,f:p=>{p.spd*=1.12;}},
  {id:'armor',n:'Blindage',d:'+1 segment de membrane.',c:'Corps',ic:'⬡',max:3,f:p=>{p.segMax++;p.seg++;}},
  {id:'regen',n:'Mitose',d:'Tu regagnes 1 segment toutes les 40 s (25 s au 2e).',c:'Corps',ic:'✚',max:2,f:p=>{p.regen++;}},
  {id:'spur',n:'Éperon',d:'Ton dash blesse tout ce qu’il traverse.',c:'Corps',ic:'⟫',max:2,f:p=>{p.dashDmg+=4;}},
  {id:'dashc',n:'Dash court',d:'Dash rechargé 30 % plus vite.',c:'Corps',ic:'⇥',max:2,f:p=>{p.dashMax*=.7;}},
  {id:'riposte',n:'Riposte',d:'Quand tu perds un segment, une onde blesse et repousse tout autour.',c:'Corps',ic:'✹',max:1,f:p=>{p.riposte=1;}},
  {id:'second',n:'Second souffle',d:'Une fois par îlot, un coup fatal te laisse à 1 segment.',c:'Corps',ic:'◈',max:1,f:p=>{p.second=1;}},
  {id:'trophy',n:'Trophée',d:'Chaque élite abattue rend 1 segment.',c:'Corps',ic:'♛',max:1,f:p=>{p.trophy=1;}},
  {id:'echo',n:'Écho',d:'Ton dash efface les tirs ennemis autour de toi.',c:'Corps',ic:'◎',max:1,f:p=>{p.echo=1;}},
  {id:'glouton',n:'Glouton',d:'Tu avales les proies de plus loin, et elles remplissent davantage la jauge.',c:'Absorption',ic:'◉',max:2,f:p=>{p.glouton++;}},
  {id:'digest',n:'Digestion',d:'Toutes les 12 absorptions, 1 segment revient.',c:'Absorption',ic:'❂',max:1,f:p=>{p.digest=1;}},
  {id:'gfast',n:'Gonflement rapide',d:'La jauge de gonflement se remplit 40 % plus vite.',c:'Absorption',ic:'⇡',max:2,f:p=>{p.gGain*=1.4;}},
  {id:'ggiant',n:'Gonflement géant',d:'Gonflé, tu es plus gros et tu le restes plus longtemps.',c:'Absorption',ic:'⬤',max:2,f:p=>{p.gScale+=.45;p.gDur=Math.round(p.gDur*1.3);}},
  {id:'appetit',n:'Appétit',d:'Un ennemi blessé sous 30 % de sa vie s’avale au contact.',c:'Absorption',ic:'◐',max:1,f:p=>{p.appetit=1;}},
  {id:'prolong',n:'Prolongation',d:'Power-ups : +50 % de durée.',c:'Power-ups',ic:'⧗',max:2,f:p=>{p.puDur*=1.5;}},
  {id:'lucky',n:'Chanceux',d:'Power-ups plus fréquents.',c:'Power-ups',ic:'✦',max:2,f:p=>{p.luck++;}},
  {id:'magnet',n:'Aimant',d:'Les power-ups viennent à toi.',c:'Power-ups',ic:'⊙',max:1,f:p=>{p.magnet=1;}},
  {id:'overload',n:'Surcharge',d:'Tant qu’un power-up est actif, +40 % de dégâts.',c:'Power-ups',ic:'✧',max:1,f:p=>{p.overload=1;}},
  {id:'demol',n:'Démolisseur',d:'Tes tirs cassent le décor 3× plus vite, et ses débris blessent.',c:'Power-ups',ic:'▦',max:1,f:p=>{p.demol=1;}},
];
/* fusions : apparaissent (cartes dorées) quand tu possèdes leurs deux ingrédients */
const FUS=[
  {id:'hydra',n:'Hydre',d:'+2 canons et cadence +20 %.',ic:'⋔',a:'twin',b:'rapid',f:p=>{p.turrets+=2;p.fireI/=1.2;p.spreadW=.22;}},
  {id:'titan',n:'Titan',d:'Dégâts ×1,8 et obus énormes.',ic:'⬤',a:'heavy',b:'armor',f:p=>{p.dmg*=1.8;p.titan=true;p.bsize+=3;}},
  {id:'nova',n:'Nova',d:'Toutes les 3 s, une onde pulvérise les tirs ennemis.',ic:'✹',a:'aura',b:'orbs',f:p=>{p.nova++;}},
  {id:'queen',n:'Reine',d:'+3 drones à tête chercheuse.',ic:'♛',a:'drone',b:'homing',f:p=>{p.drones+=3;p.dronesHome=true;}},
  {id:'ghost',n:'Fantôme',d:'Dash deux fois plus fréquent, qui laisse une traînée mortelle.',ic:'◐',a:'spur',b:'dashc',f:p=>{p.dashMax*=.5;p.ghost=true;}},
  {id:'prism',n:'Prisme',d:'Chaque impact se fragmente, les tirs traversent +2.',ic:'◇',a:'split',b:'rail',f:p=>{p.split+=2;p.pierce+=2;}},
  {id:'vortex',n:'Vortex',d:'Les tirs ennemis ralentissent près de toi.',ic:'@',a:'speed',b:'magnet',f:p=>{p.vortex=true;}},
  {id:'hole',n:'Trou noir',d:'Gonflé, tu aspires les ennemis proches.',ic:'●',a:'glouton',b:'ggiant',f:p=>{p.hole=true;}},
];
/* pactes : à partir de l'îlot 3, un pouvoir fort contre un prix */
const PAC=[
  {id:'verre',n:'Pacte de verre',d:'Dégâts ×1,8.',cost:'Membrane max −2.',ic:'◇',f:p=>{p.dmg*=1.8;p.segMax=Math.max(1,p.segMax-2);p.seg=Math.min(p.seg,p.segMax);}},
  {id:'frenzy',n:'Pacte de frénésie',d:'Cadence ×1,5.',cost:'Plus de dash.',ic:'♨',f:p=>{p.fireI/=1.5;p.noDash=true;}},
  {id:'colosse',n:'Pacte du colosse',d:'+2 segments de membrane.',cost:'Vitesse −15 %, taille +20 %.',ic:'⬣',f:p=>{p.segMax+=2;p.seg+=2;p.spd*=.85;p.baseR*=1.2;}},
  {id:'avarice',n:'Pacte d’avarice',d:'Power-ups deux fois plus longs.',cost:'Plus de segment regagné en fin d’îlot.',ic:'⧖',f:p=>{p.puDur*=2;p.noRegen=true;}},
];
const CARDS={};for(const u of BON)CARDS[u.id]={k:'b',u};for(const u of FUS)CARDS[u.id]={k:'f',u};for(const u of PAC)CARDS[u.id]={k:'p',u};
/* tirage de 3 cartes : au plus une fusion (dorée), au plus un pacte (rouge, dès l'îlot 3), le reste
   dans le pool en variant les catégories. Tout passe par R() : une partie à graine se rejoue à l'identique. */
function rollCards(){
  const P=G.p,own=id=>P.cards[id]||0,out=[];
  const fu=FUS.filter(f=>!own(f.id)&&own(f.a)&&own(f.b));
  if(fu.length&&R()<.65)out.push({k:'f',u:pick(fu)});
  const pa=G.isl>=3?PAC.filter(q=>!own(q.id)):[];
  if(pa.length&&R()<.3)out.push({k:'p',u:pick(pa)});
  const pool=shuffle(BON.filter(u=>own(u.id)<u.max));
  const cats={};for(const c of out)cats[c.u.c||'x']=1;
  for(const u of pool){if(out.length>=3)break;if(cats[u.c]&&pool.some(v=>!cats[v.c]&&!out.some(o=>o.u===v)))continue;out.push({k:'b',u});cats[u.c]=1;}
  for(const u of pool){if(out.length>=3)break;if(!out.some(o=>o.u===u))out.push({k:'b',u});}
  return out.slice(0,3);
}
function applyCard(ch){const P=G.p;ch.u.f(P);P.cards[ch.u.id]=(P.cards[ch.u.id]||0)+1;G.picks.push(ch.u.id);}
/* ouverture du choix : à l'arrivée sur un îlot, puis (mid) après la vague 2. Simulation : __SIM_PICK choisit, sinon la première carte. */
function openPick(mid){
  G.choices=rollCards();G.pkMid=!!mid;if(mid)G.pickMid=G.isl;else G.pickIsl=G.isl;if(!G.choices.length){pickDone();return;}
  if(SIMF()){applyCard(window.__SIM_PICK?window.__SIM_PICK(G.choices):G.choices[0]);pickDone();return;}
  G.state='pick';renderPick();show('ov-evo');
}
function pickDone(){if(G.pkMid){G.pkMid=false;banner('Vague finale','puis le gardien de l’îlot',BIO[G.biome].a,110);}else arriveBanner();}
function pickCard(i){
  if(!G||G.state!=='pick')return;const ch=G.choices[i];if(!ch)return;
  applyCard(ch);G.state='play';show(null);SFX.evo();
  const P=G.p,c=ch.k==='f'?COL.gd:ch.k==='p'?COL.rd:COL.cy;ringFX(P.x,P.y,P.r,P.r*4,c,24,4);sparks(P.x,P.y,c,20,5);
  pickDone();
}
function reroll(){if(!G||G.state!=='pick'||G.rerolls<=0)return;G.rerolls--;G.choices=rollCards();renderPick();SFX.ui();}
