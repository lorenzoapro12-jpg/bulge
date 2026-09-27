/* =========================================================
   gt.js : LE PROLOGUE JOUABLE
   un écho d'Iris guide les premiers pas : objectifs successifs, chacun
   enseigne une mécanique ; puis des astuces contextuelles, une seule fois,
   archivées dans le Guide des Chroniques. Les systèmes avancés se
   débloquent progressivement.
   ========================================================= */
const GUIDE='Écho d’Iris';
const TUTO=[
  {id:'move',o:'Déplace-toi',h:()=>inp.touch?'Pouce gauche : glisse pour avancer.':'ZQSD ou flèches pour avancer.',
    say:'Tu m’entends ? Je suis un écho d’Iris, ce qu’il reste de sa voix. Je vais t’apprendre à survivre ici. D’abord, bouge.',done:T=>T.dist>520},
  {id:'shoot',o:'Détruis 3 ombres',h:()=>inp.touch?'Tu tires seul sur l’ennemi le plus proche. Glisse le pouce droit pour viser toi-même.':'Tu tires seul sur l’ennemi le plus proche. Bouge la souris pour viser toi-même.',
    say:'Des ombres : des souvenirs perdus que le Noyau a retournés. Elles ne sont pas méchantes, juste affamées. Tire.',start:T=>tutSpawn(3,'mite',340),done:T=>G.kills-T.k0>=3},
  {id:'absorb',o:'Absorbe 12 bulles',h:()=>'Les bulles sont ta vie ET ton expérience. Un coup reçu t’en arrache : garde-en toujours en réserve.',
    say:'Ces bulles, c’est de la mémoire pure. Absorbe-les : elles te font grandir. Et plus tu es gros, plus tu es une cible.',start:T=>{tutSpawn(4,'pop',380);},done:T=>T.got>=12},
  {id:'level',o:'Atteins le niveau 2 et choisis une évolution',h:()=>'Chaque niveau propose trois évolutions. Elles se combinent : cherche des synergies plutôt que des chiffres.',
    say:'Tu grandis. À chaque palier, le rêve t’offre une forme nouvelle. Choisis bien : certaines s’aiment entre elles.',start:T=>tutSpawn(5,'pop',400),done:T=>G.p.lvl>=2&&G.state==='play'},
  {id:'dash',o:'Utilise le dash',h:()=>inp.touch?'Bouton ⚡ en bas à droite.':'Espace ou Maj.',
    say:'Le dash te rend intouchable un court instant. Traverse les tirs au lieu de les fuir.',done:T=>G.p.dashT>0||G.p.dashing>0},
  {id:'skill',o:'Lance ta compétence sur un groupe',h:()=>inp.touch?'Appui court sur le bouton ① (à gauche du ⚡).':'Touche '+KEYL[0]+' ou clic droit.',
    say:()=>'Chaque forme porte un don. Le tien s’appelle '+SKL[G.p.sk[0].id].n+'. Il se recharge : garde-le pour les moments qui comptent.',start:T=>tutSpawn(6,'mite',300),done:T=>G.p.sk[0].cd>0},
  {id:'echo',o:'Réveille un écho',h:()=>'Entre dans le cercle doré d’un monument. La flèche dorée t’y mène.',
    say:'Les monuments gardent des fragments de l’histoire d’Iris. Ton histoire, peut-être. Va les écouter.',tgt:()=>nearestOf(WD.lms,(L,i)=>!G.gs.lm[i]),done:T=>G.gs.echo>=1},
  {id:'altar',o:'Reçois le don d’un autel',h:()=>'Reste un instant dans le cercle d’un autel doré (■ sur la mini-carte). Il t’offre une deuxième compétence.',
    say:'Iris a semé des autels le long des routes. Suis les panneaux aux embranchements : ils indiquent où mène chaque chemin.',tgt:()=>nearestOf(WD.alts,(a,i)=>!G.gc.altUsed[i]),done:T=>Object.keys(G.gc.altUsed).length>=1},
  {id:'heart',o:'Détruis un cœur de zone',h:()=>'Suis la flèche vers un cœur. Dans son arène, une membrane t’enferme : arrive avec des bulles en réserve.',
    say:'Trois gardiens protègent l’Hypernoyau. Chacun est un souvenir forcé de monter la garde. Libère le premier.',done:T=>G.heartsDone>=1}];
const TIPS={
  evo:'Évolutions : elles se cumulent et certaines débloquent des mutations quand tu les combines.',
  elite:'Élite : l’aura colorée signale un trait (Blindé, Véloce, Scindeur, Instable, Vivace). Elle lâche plus de bulles, charge vite l’ultime, et parfois de l’équipement.',
  status:'Altérations : Brûlure, Givre, Choc et Corrosion viennent de ton équipement. Elles se combinent : un critique sur un ennemi gelé le fait éclater.',
  ult:'Ultime prêt ! '+'Il se charge en absorbant des ennemis. Chaque vaisseau a le sien.',
  biome:'Chaque biome a ses ennemis, sa musique et ses échos. Les lisières lumineuses marquent les frontières.',
  combo:'Combo : enchaîne les éliminations sans pause pour multiplier ton score.',
  low:'Danger : à court de bulles, tu éclates. Dash, éloigne-toi et ramasse des bulles avant de reprendre le combat.',
  arena:'Arène : la membrane t’enferme avec le gardien. Ses attaques changent quand sa vie baisse.',
  rift:'Faille : entre dans le cercle et tiens 20 secondes. Récompense : ultime chargé, équipement et un don d’autel.',
  scn:'Souvenir d’Iris (étoile cyan) : une scène à objectif. Approche-toi pour lire l’invitation, rien ne se lance sans ton accord.',
  hunt:'Chasseur (triangle rouge) : un duel tactique au tour par tour. Lis ses intentions, analyse sa faiblesse, garde de l’énergie pour te protéger des frappes lourdes.',
  loot:'Butin : les caisses lumineuses contiennent de l’équipement. Sa couleur indique la rareté. Tu l’équipes au Hangar entre deux cycles.',
  lair:'Les trois gardiens sont tombés : le Noyau est ouvert, au centre du territoire rouge.',
  view:'Belvédère : arrête-toi dans son cercle et ne touche à rien. Le rêve se dévoile à ceux qui prennent le temps de regarder.',
  hangar:'Le Hangar est ouvert : équipe ton butin, répartis tes points de pilote et compare les objets avant de les porter.'};
function nearestOf(arr,ok){const P=G.p;let b=null,bd=1e18;arr.forEach((q,i)=>{if(ok&&!ok(q,i))return;const d=dist2(q.x,q.y,P.x,P.y);if(d<bd){bd=d;b=q;}});return b;}
function tutSpawn(n,t,d){const P=G.p;for(let k=0;k<n;k++){const a=k/n*TAU+R();const e=mkEnemy(t,P.x+Math.cos(a)*d,P.y+Math.sin(a)*d,{aggro:true,noElite:true});e.hp=Math.min(e.hp,e.mhp*.6);}}
function tutOn(){return G&&G.gt&&G.gt.on;}
function gtRunStart(){
  const on=!G.daily&&(meta.tuto||0)<TUTO.length;
  G.gt={on,step:-1,T:null,tipT:0};
  /* les systèmes avancés attendent le deuxième cycle */
  G.gc.dorm=meta.runs<1;G.gx.dorm=meta.runs<1;
  if(on){G.help=0;G.banner=null;tutGo(meta.tuto||0);}
}
function tutGo(i){
  const S=G.gt;S.step=i;meta.tuto=i;saveMeta();if(i>=TUTO.length){tutDone();return;}
  const st=TUTO[i],P=G.p;S.T={k0:G.kills,dist:0,lx:P.x,ly:P.y,got:0,lb:P.bub,t:0};
  if(st.start)st.start(S.T);if(G.gs)G.gs.subs=G.gs.subs.filter(q=>q.who!==GUIDE);gsSay(typeof st.say==='function'?st.say():st.say,GUIDE,COL.cy,1);
}
function tutDone(){
  const S=G.gt;S.on=false;meta.tuto=TUTO.length;meta.shards+=60;saveMeta();
  banner('Prologue terminé','+60 éclats · un objet rare',COL.gd,140);giDrop(G.p.x,G.p.y,'rift',1);SFX.ach();
  gsSay('Tu sais l’essentiel. Le reste, le rêve te l’apprendra. Je reste près de toi, dans chaque écho.',GUIDE,COL.gd,1);
}
function tip(id){if(!meta.tips)meta.tips={};if(meta.tips[id]||!TIPS[id]||G.daily)return false;meta.tips[id]=1;if(G.gt)G.gt.lastTip=G.time;saveMeta();gsSay(TIPS[id].split(/(?<=[.!])\s/)[0],'Astuce · détails dans le Guide',COL.gd,0,1);return true;}
function gtTick(){
  const S=G.gt;if(!S)return;const P=G.p;
  if(S.on&&S.T){const T=S.T,st=TUTO[S.step];T.t++;
    T.dist+=Math.hypot(P.x-T.lx,P.y-T.ly);T.lx=P.x;T.ly=P.y;if(P.bub>T.lb)T.got+=P.bub-T.lb;T.lb=P.bub;
    if(st&&st.done(T)&&T.t>30){ringFX(P.x,P.y,P.r,P.r*4,COL.cy,18,3);SFX.pick(8);tutGo(S.step+1);return;}}
  if(G.t%20!==0)return;
  /* astuces contextuelles : une fois chacune, jamais pendant les premiers pas */
  if(S.on&&S.step<4)return;
  if((G.gs&&G.gs.subs.length)||G.time-(S.lastTip||-1e9)<2700)return;
  const near=(arr,d,ok)=>arr.some((q,i)=>(!ok||ok(q,i))&&dist2(q.x,q.y,P.x,P.y)<d*d);
  if(G.en.some(e=>e.aff&&!e.dead&&dist2(e.x,e.y,P.x,P.y)<600*600)&&tip('elite'))return;
  if(G.en.some(e=>!e.dead&&(e.burn||e.frost||e.acid))&&tip('status'))return;
  if(P.ultC>=100&&tip('ult'))return;
  if(Object.keys(G.visited).length>=2&&tip('biome'))return;
  if(G.combo>=10&&tip('combo'))return;
  if(G.p.lvl>=3&&tip('evo'))return;
  if(P.lvl===1&&P.bub<5&&G.time>600&&tip('low'))return;
  if(G.arena&&G.arena.kind!=='boss'&&tip('arena'))return;
  if(G.gi&&G.gi.drops.length&&tip('loot'))return;
  if(G.lair.open&&tip('lair'))return;
  if(!G.gc.dorm&&near(WD.rifts,800,(q,i)=>!G.gc.riftDone[i])&&tip('rift'))return;
  if(near(WD.views,700)&&tip('view'))return;
  if(near(WD.scn,800,(q,i)=>!G.gx.done[i])&&tip('scn'))return;
  if(!G.gx.dorm&&near(WD.hunt,900,(q,i)=>!G.gx.beat[i])&&tip('hunt'))return;
}
/* objectif en cours, en haut à gauche, et flèche vers la cible */
function edgeArrow(x,y,col,label){const c=ctx,sx=(x-CAM.x)*RZ+W/2,sy=(y-CAM.y)*RZ+H/2;if(sx>30&&sx<W-30&&sy>70&&sy<H-70)return;
  const a=Math.atan2(sy-H/2,sx-W/2),ex=clamp(W/2+Math.cos(a)*W,40,W-40),ey=clamp(H/2+Math.sin(a)*H,110,H-110);
  c.save();c.translate(ex,ey);c.rotate(a);c.fillStyle=col;c.globalAlpha=.8+.2*Math.sin(RT*.15);c.beginPath();c.moveTo(14,0);c.lineTo(-7,-9);c.lineTo(-2,0);c.lineTo(-7,9);c.closePath();c.fill();c.restore();
  c.globalAlpha=.9;c.textAlign='center';c.textBaseline='middle';c.font='700 11px '+FD;c.fillStyle=col;c.fillText(label,ex,ey+20);c.globalAlpha=1;}
function gtHUD(){
  const S=G.gt;if(!S||!S.on||!S.T)return;const st=TUTO[S.step];if(!st)return;const c=ctx,narrow=W<600,x=14,y=narrow?124:134,w=narrow?Math.max(160,W-150):320;
  c.font='500 '+(narrow?11:12)+'px '+FD;const hl=S.T.t<600?wrapText(c,st.h(),w-20):[],h=(hl.length?46:36)+hl.length*15;
  c.globalAlpha=.85;c.fillStyle='rgba(6,3,14,.85)';c.beginPath();c.roundRect?c.roundRect(x,y,w,h,10):c.rect(x,y,w,h);c.fill();c.globalAlpha=1;c.strokeStyle=COL.cy;c.lineWidth=1.2;c.stroke();
  c.textAlign='left';c.textBaseline='top';c.font='700 10px '+FD;c.fillStyle=COL.cy;c.fillText('PROLOGUE · '+(S.step+1)+'/'+TUTO.length,x+10,y+8);
  fitFont(c,st.o,w-20,narrow?13:14,'700');c.fillStyle='#fff';c.fillText(st.o,x+10,y+22);
  c.font='500 '+(narrow?11:12)+'px '+FD;c.fillStyle='#b9b3dd';hl.forEach((l,i)=>c.fillText(l,x+10,y+40+i*15));
  let tg=st.tgt&&st.tgt();if(st.id==='heart'&&!G.arena)tg=nearestOf(G.hearts,h=>h.state!=='dead');
  if(tg)edgeArrow(tg.x,tg.y,COL.cy,'');
}
function gtGuideHTML(){const seen=meta.tips||{};
  const steps=TUTO.map((s,i)=>'<div class="gtip'+((meta.tuto||0)>i?'':' locked')+'"><b>'+s.o+'</b><span>'+((meta.tuto||0)>i?s.h():'Étape à venir du prologue.')+'</span></div>').join('');
  const tips=Object.keys(TIPS).map(k=>'<div class="gtip'+(seen[k]?'':' locked')+'"><span>'+(seen[k]?TIPS[k]:'??? Astuce pas encore découverte.')+'</span></div>').join('');
  return '<div class="mt">Guide du rêve</div><div class="muted">Ce que l’écho d’Iris t’a appris, et ce que tu as découvert en route.</div>'+steps+tips+'<button class="btn ghost" id="bTutoAgain">Rejouer le prologue au prochain cycle</button>';}
