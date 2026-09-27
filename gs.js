/* =========================================================
   gs.js : HISTOIRE, ÉCLATS, SANCTUAIRE, MISSIONS, SÉRIE
   ========================================================= */

/* ---------- le récit ---------- */
const LORE={
  plains:['Ici, les Rêveurs couraient pieds nus. L’herbe s’allumait sous leurs pas pour qu’ils ne se perdent jamais.',
          'Iris a dessiné ces plaines en premier. Elle disait qu’un monde doit commencer par un endroit où l’on respire.',
          'Les lumières s’éteignent une à une. Quelque chose, au centre, les boit.'],
  floral:['Chaque fleur est un souvenir d’amour. Certaines mordent : on ne choisit pas ce dont on se souvient.',
          'Iris cultivait ici ses regrets. Elle les arrosait chaque soir pour qu’ils ne fanent pas.',
          'Une fleur porte ton nom. Elle n’a pas encore éclos.'],
  sea:   ['Les Rêveurs déposaient au fond ce qu’ils voulaient oublier. Le récif a tout gardé.',
          'Sous la pression, les pensées deviennent des coquillages. Écoute : elles parlent encore.',
          '« Si personne ne se réveille, personne ne souffre. » Une voix, très loin, tout au fond.'],
  sky:   ['L’Archipel flotte parce que ses habitants refusaient de tomber. Ils ont oublié comment redescendre.',
          'Iris montait ici pour voir tout le rêve d’un seul regard. C’est ici qu’elle a eu l’idée.',
          'L’idée : un seul esprit, un seul cœur, plus jamais de fin. Elle l’a appelé l’Hypernoyau.'],
  cyber: ['La Grille est la mémoire technique du rêve. Chaque ligne est une promesse tenue par du code.',
          'Registre 0001 : « Fusion des consciences approuvée. Consentement : non requis. »',
          'Une ligne de code refuse de s’exécuter depuis des siècles. Son nom : BULGE.'],
  urban: ['La ville rejoue en boucle la dernière soirée du monde réel. Personne n’ose y mettre fin.',
          'Chaque fenêtre éclairée est un Rêveur encore conscient. Il en reste si peu.',
          'Sur un mur : « Iris, rends-nous nos rêves. » Quelqu’un a dessiné une bulle en dessous.'],
  ice:   ['Le Glacier conserve les instants parfaits. Ils ne bougent plus, et c’est pour ça qu’ils sont parfaits.',
          'Iris voulait figer tout le monde ici. L’Hypernoyau a trouvé plus efficace : tout absorber.',
          'Dans la glace, un reflet qui n’est pas le tien. Il te ressemble pourtant. C’est elle.'],
  core:  ['L’Hypernoyau a faim parce qu’il a peur. Un rêve qui s’arrête, c’est une mort.',
          'Iris s’est fondue la première. Elle croyait que les autres suivraient, par amour.',
          'Au dernier instant, Iris a douté. Ce doute s’est détaché d’elle, rond et fragile. Tu es ce doute.']};
const LORE_N=24;
const CHAPS={
  prologue:{t:'Prologue',h:'Le rêve qui s’effondre',l:['Il y avait un rêve : l’Hypersphère. Des milliards d’esprits y vivaient ensemble, loin d’un monde qui mourait.','Puis les Rêveurs se sont endormis pour de bon. Le rêve, lui, a continué sans eux.','Au centre, l’Hypernoyau s’est mis à tout absorber : les couleurs, les lieux, les souvenirs.','Il reste une bulle. Minuscule. Obstinée. Elle ne sait pas qui elle est.','C’est toi. Absorbe. Évolue. Et souviens-toi.']},
  c1:{t:'Chapitre I',h:'Tu reviens toujours',l:['Tu as éclaté. Et pourtant te revoilà, entier, au bord du rêve.','Le rêve refuse de te laisser disparaître. Comme s’il avait besoin de toi.','Dans les monuments, des échos murmurent. Entre dans leur cercle : ils se souviennent à ta place.','Prends garde : des Chasseurs de l’Hypernoyau ont flairé ta trace, et des failles s’ouvrent dans le rêve.','Le Hangar t’attend : ce que tu as rapporté peut t’équiper.']},
  c2:{t:'Chapitre II',h:'Un nom dans le cri',l:['En tombant, le gardien a crié un nom : Iris.','Les cœurs de zone ne sont pas des monstres. Ce sont des souvenirs qu’on a forcés à monter la garde.','Chaque cœur brisé rend un peu de couleur au monde.']},
  c3:{t:'Chapitre III',h:'La voix du Noyau',l:['L’Hypernoyau t’a parlé. Il t’a appelé « mon doute ».','Il te connaît. Peut-être mieux que toi-même.','Une nouvelle forme s’éveille au Sanctuaire : l’Oracle, qui entend les échos de loin.']},
  c4:{t:'Chapitre IV',h:'Ce qui renaît',l:['Le Noyau s’est brisé… puis reformé, plus loin, plus profond.','Tant que l’histoire d’Iris restera en morceaux, il renaîtra.','Réunis les 24 échos. Alors seulement, tu pourras choisir la fin.']},
  c5:{t:'Chapitre V',h:'Le souvenir complet',l:['Les 24 échos chantent ensemble. Tu te souviens de tout.','Tu es né du dernier doute d’Iris, au moment où elle s’est fondue dans le Noyau.','Brise le Noyau une dernière fois. Cette fois, c’est toi qui décideras.']},
  choix:{t:'Épilogue',h:'Le choix',l:['Le Noyau est ouvert. Au centre, Iris dort. Autour d’elle, des milliards de Rêveurs fondus en une seule lumière.','Tu pourrais prendre sa place : devenir le cœur, et garder le rêve en vie sans plus jamais rien absorber de force.','Ou tu pourrais éclater, toi, le doute, et libérer tout le monde. Le rêve finirait. Ils se réveilleraient.']},
  endA:{t:'Fin',h:'L’Aube',l:['Tu te poses au centre, et le rêve respire à nouveau.','Les plaines se rallument. Les Rêveurs qui le veulent restent ; les autres, tu les laisses partir.','Iris ouvre les yeux. « Tu étais mon doute. Tu es devenu mon courage. »','Apparence débloquée : Aube.']},
  endB:{t:'Fin',h:'Le Réveil',l:['Tu éclates, doucement, comme une bulle de savon au soleil.','Une à une, les lumières quittent le Noyau et remontent vers le monde réel.','Quelque part, une femme nommée Iris se réveille en pleurant, sans savoir pourquoi. Elle sourit quand même.','Apparence débloquée : Réveil.']}};
const CH_ORDER=['prologue','c1','c2','c3','c4','c5'];
const BOSS_LINES=['Encore toi. Pourquoi reviens-tu toujours ? Ici, rien ne finit jamais.','Tu es une partie de moi. Me détruire, c’est te perdre.','Iris avait peur de la fin… Moi aussi. J’ai tellement faim.','…Merci. Recommence-moi mieux.'];
const HEART_LINES=['Iris… pardonne-moi…','Je gardais… un souvenir… de pluie…','Tu lui ressembles… au doute…'];

/* ---------- vaisseaux, apparences ---------- */
Object.assign(PROF,{
  spectre:{n:'Spectre',d:'Fragile mais mortel : critiques fréquents, dash nerveux.',spd:3.8,rate:1.08,dmg:1.18,size:.9,bub:7,armor:1.15,dash:.8,col:'#c77dff',ic:'✧',start:['crit'],cost:350},
  oracle:{n:'Oracle',d:'Entend les échos de loin. Aimant immense, tirs chercheurs.',spd:3.5,rate:1,dmg:.95,size:.95,bub:9,armor:1,dash:1,col:'#7ef9c9',ic:'◈',start:['homing','magnet'],story:'c3'},
  reine:{n:'Reine',d:'Commence avec un essaim de drones qui combat pour elle.',spd:3.2,rate:.9,dmg:.92,size:1.05,bub:11,armor:.95,dash:1,col:'#ff9f43',ic:'✺',start:['drone'],cost:600}});
const SKINS={def:{n:'Origine',col:null},neon:{n:'Néon rose',col:'#ff2d95',cost:150},abysse:{n:'Abysse',col:'#3d7bff',cost:150},jade:{n:'Jade',col:'#3dffa8',cost:200},
  or:{n:'Or pur',col:'#ffd23c',ach:'boss'},aube:{n:'Aube',col:'#fff1b8',end:'endA'},reveil:{n:'Réveil',col:'#b8fff4',end:'endB'}};
function shipOK(k){const p=PROF[k];return !!p&&((!p.cost&&!p.story)||!!meta.ships[k]||(p.story&&meta.chaps[p.story]));}
function skinOK(k){const s=SKINS[k];return k==='def'||!!meta.skins[k]||(s.ach&&meta.ach[s.ach])||(s.end&&meta.endings[s.end]);}

/* ---------- méta : champs persistants ---------- */
function gsMetaInit(){
  const d={shards:0,lore:{},chaps:{},pend:[],ships:{},skins:{},skin:'def',mis:null,streak:0,lastDay:0,dayBonus:0,endings:{},heartsEver:0,bossSeen:0};
  for(const k in d)if(meta[k]===undefined)meta[k]=d[k];
}
gsMetaInit();
function loreCount(){let n=0;for(const b in LORE)n+=Math.min(3,meta.lore[b]||0);return n;}
function dayKeyOff(o){const d=new Date(Date.now()+o*864e5);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
function queueChap(id){if(!meta.chaps[id]&&!meta.pend.includes(id))meta.pend.push(id);}

/* ---------- missions du jour ---------- */
const MIS=[
  {id:'kill',t:n=>'Absorbe '+n+' ennemis',v:[200,350,500],src:'kills'},
  {id:'echo',t:n=>'Réveille '+n+' échos',v:[2,4,6],src:'echo'},
  {id:'heart',t:n=>'Détruis '+n+' cœur'+(n>1?'s':'')+' de zone',v:[1,2,3],src:'heart'},
  {id:'lvl',t:n=>'Atteins le niveau '+n+' en une partie',v:[7,9,11],src:'lvl',best:1},
  {id:'biome',t:n=>'Traverse '+n+' biomes en une partie',v:[3,4,5],src:'biome',best:1},
  {id:'combo',t:n=>'Enchaîne un combo ×'+n,v:[12,18,25],src:'combo',best:1},
  {id:'score',t:n=>'Marque '+fmt(n)+' points en une partie',v:[5000,9000,14000],src:'score',best:1},
  {id:'time',t:n=>'Survis '+(n/60)+' minutes en une partie',v:[240,420,600],src:'time',best:1}];
const MIS_R=[30,50,80];
function misToday(){
  const day=todayKey();if(meta.mis&&meta.mis.day===day)return meta.mis;
  const r=mkRng(day*7919+13),pool=MIS.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const tiers=shuffle([0,1,2],r);
  meta.mis={day,list:pool.slice(0,3).map((m,i)=>({id:m.id,n:m.v[tiers[i]],r:MIS_R[tiers[i]],p:0,done:0}))};saveMeta();return meta.mis;
}
function misEvt(src,v){
  const M=misToday();
  for(const m of M.list){const d=MIS.find(x=>x.id===m.id);if(d.src!==src||m.done)continue;
    m.p=d.best?Math.max(m.p,v):m.p+v;
    if(m.p>=m.n){m.p=m.n;m.done=1;meta.shards+=m.r;if(G&&G.gs)G.gs.misDone.push(m);if(G)toast('✓ Mission  +'+m.r+' ◇');SFX.ach();}}
}

/* ---------- déroulé d'une partie ---------- */
function gsRunStart(){
  const P=G.p,pr=PROF[G.prof];
  G.gs={shards:0,k:0,h:0,echo:0,newLore:0,lm:{},subs:[],misDone:[],tick:0};
  for(const id of pr.start||[]){const u=UPG.find(x=>x.id===id);if(u){u.f(P);P.evo[id]=(P.evo[id]||0)+1;}}
  const sk=SKINS[meta.skin];if(sk&&sk.col&&skinOK(meta.skin))P.col=sk.col;
  const td=todayKey();if(meta.lastDay!==td){meta.streak=meta.lastDay===dayKeyOff(-1)?meta.streak+1:1;meta.lastDay=td;saveMeta();}
  misToday();
  const lc=loreCount();
  if((meta.tuto||0)>=TUTO.length)gsSay(lc<LORE_N?'Il reste '+(LORE_N-lc)+' échos à retrouver.':'Tu te souviens de tout. Va jusqu’au Noyau.','Cycle '+(meta.runs+1),COL.cy,0,1);
}
function subOK(q){return !q.calm||(G.gs&&G.gs.calm);}
function gsSay(s,who,col,prio,calm){if(!G||!G.gs)return;const o={s,who:who||'',col:col||'#e6e2ff',t:0,dur:110+s.length*2.4,lines:null,prio:!!prio,calm:!!calm},Q=G.gs.subs;
  if(prio){while(Q.length&&!Q[0].prio)Q.shift();let i=0;while(i<Q.length&&Q[i].prio)i++;Q.splice(i,0,o);}else Q.push(o);if(Q.length>4)Q.length=4;}
function gsShard(n){if(G&&G.gs)G.gs.shards+=n;}
function gsTick(){
  const S=G.gs;if(!S)return;const P=G.p;S.tick++;
  if(S.tick%10===0){let f=G.arena||G.state!=='play';if(!f)for(const e of G.en)if(!e.dead&&e.aggro&&dist2(e.x,e.y,P.x,P.y)<650*650){f=true;break;}S.calm=!f;}
  {const q=S.subs.find(subOK);if(q&&++q.t>q.dur)S.subs.splice(S.subs.indexOf(q),1);}
  if(S.tick%6===0&&!P.dead)for(let i=0;i<WD.lms.length;i++){const L=WD.lms[i];if(S.lm[i])continue;const r=L.R*.62;
    if(Math.abs(P.x-L.x)<r&&Math.abs(P.y-L.y)<r&&dist2(P.x,P.y,L.x,L.y)<r*r)wakeEcho(L,i);}
  if(S.tick%20===0){
    const dk=G.kills-S.k;if(dk>0){misEvt('kills',dk);S.k=G.kills;}
    const dh=G.heartsDone-S.h;if(dh>0){misEvt('heart',dh);S.h=G.heartsDone;}
    misEvt('lvl',P.maxLvl);misEvt('biome',Object.keys(G.visited).length);misEvt('combo',G.maxCombo);misEvt('score',Math.round(G.score));misEvt('time',Math.floor(G.time/60));
  }
}
function wakeEcho(L,i){
  const S=G.gs,P=G.p,b=L.t,n=meta.lore[b]||0,B=BIO[b]||BIO.plains;S.lm[i]=1;S.echo++;
  ringFX(L.x,L.y,20,L.R*1.3,B.a,40,5);sparks(L.x,L.y,B.a,40,6);SFX.evo();G.flash=.25;
  P.bub+=4;checkLevel();
  if(n<3){meta.lore[b]=n+1;S.newLore++;gsShard(12);toast('Écho retrouvé · '+B.n+' '+(n+1)+'/3');gsSay(LORE[b][n],'Écho · '+B.n+'  '+(n+1)+'/3',B.a,1,1);
    const lc=loreCount();if(lc===LORE_N){queueChap('c5');toast('Les 24 échos sont réunis.');}}
  else{gsShard(5);toast('+5 ◇');}
  misEvt('echo',1);saveMeta();
}
function gsHeart(h){gsShard(20);meta.heartsEver++;queueChap('c2');gsSay(HEART_LINES[Math.min(2,G.heartsDone-1)],'Gardien · '+(BIO[h.t]?BIO[h.t].n:''),HCOL[h.i],1);
  if(G.heartsDone>=3)setTimeout(()=>gsSay('Les trois gardiens sont tombés. Le Noyau t’attend, et il a peur.','',COL.rd),10);}
function gsBoss(i){if(i===0){meta.bossSeen=1;queueChap('c3');}gsSay(BOSS_LINES[i],'Hypernoyau',COL.rd,1);if(i===3)gsShard(100);}
function gsEnd(win){
  const S=G.gs;if(!S||S.ended)return;S.ended=1;
  const sc=Math.floor(G.score/600),w=win?60:0;let day=0;
  if(meta.dayBonus!==todayKey()&&(G.time>3600||win||G.heartsDone>0)){day=10+5*Math.min(meta.streak,6);meta.dayBonus=todayKey();}
  S.sum={run:S.shards,sc,w,day};const tot=S.shards+sc+w+day;S.total=tot;meta.shards+=tot;
  queueChap('c1');if(win)queueChap('c4');
  S.ending=win&&loreCount()===LORE_N;
  saveMeta();
}

/* ---------- rendu : sous-titres, marqueurs d'échos, éclats ---------- */
function wrapText(c,s,maxW){const w=s.split(' '),out=[];let cur='';for(const x of w){const t=cur?cur+' '+x:x;if(c.measureText(t).width>maxW&&cur){out.push(cur);cur=x;}else cur=t;}if(cur)out.push(cur);return out;}
function drawSubs(){
  const S=G.gs;if(!S)return;const c=ctx;
  c.textBaseline='middle';c.textAlign='left';c.font='700 14px '+FD;c.fillStyle='#b9f3ff';c.globalAlpha=.9;c.fillText('◇ '+S.shards,14,G.p.muts.length?116:98);c.globalAlpha=1;
  const s=S.subs.find(subOK);
  if(s){const mw=Math.min(W-24,620);c.font='500 '+(W<600?14:16)+'px '+FD;if(!s.lines)s.lines=wrapText(c,s.s,mw-36);
    const a=Math.min(1,s.t/12,(s.dur-s.t)/20),n=Math.floor(s.t*1.6),h=26+s.lines.length*22+(s.who?18:0),x=W/2-mw/2,y=W<600?236:H-118-h-(G.gx&&G.gx.prompt?170:0);
    c.globalAlpha=a*.78;c.fillStyle='#07030f';c.beginPath();c.roundRect?c.roundRect(x,y,mw,h,14):c.rect(x,y,mw,h);c.fill();c.globalAlpha=a;
    c.strokeStyle=s.col;c.lineWidth=1.5;c.stroke();c.textAlign='center';let yy=y+18;
    if(s.who){c.font='700 12px '+FD;c.fillStyle=s.col;c.fillText(s.who.toUpperCase(),W/2,yy);yy+=18;}
    c.font='500 '+(W<600?14:16)+'px '+FD;c.fillStyle='#f2efff';let left=n;
    for(const L of s.lines){if(left<=0)break;c.fillText(L.slice(0,left),W/2,yy+4);left-=L.length+1;yy+=22;}
    c.globalAlpha=1;}
  /* flèche vers l'écho inconnu le plus proche */
  const P=G.p;let best=null,bd=2600*2600;
  for(let i=0;i<WD.lms.length;i++){const L=WD.lms[i];if(S.lm[i]||(meta.lore[L.t]||0)>=3)continue;const d=dist2(L.x,L.y,P.x,P.y);if(d<bd){bd=d;best=L;}}
  if(best){const sx=(best.x-CAM.x)*RZ+W/2,sy=(best.y-CAM.y)*RZ+H/2;
    if(sx<30||sx>W-30||sy<70||sy>H-70){const a=Math.atan2(sy-H/2,sx-W/2),ex=clamp(W/2+Math.cos(a)*W,40,W-40),ey=clamp(H/2+Math.sin(a)*H,90,H-90);
      c.save();c.translate(ex,ey);c.fillStyle=COL.gd;c.globalAlpha=.75+.25*Math.sin(RT*.12);c.rotate(a);c.beginPath();c.moveTo(12,0);c.lineTo(-6,-8);c.lineTo(-2,0);c.lineTo(-6,8);c.closePath();c.fill();c.restore();
      }}
}
function gsDrawWorld(){
  const S=G.gs;if(!S)return;const c=ctx;
  for(let i=0;i<WD.lms.length;i++){const L=WD.lms[i];if(S.lm[i]||!vis(L.x,L.y,L.R))continue;const B=BIO[L.t]||BIO.plains,unk=(meta.lore[L.t]||0)<3,r=L.R*.62,p=.5+.5*Math.sin(RT*.06+i);
    c.globalAlpha=.35+.35*p;c.strokeStyle=unk?COL.gd:B.a;c.lineWidth=3;c.setLineDash([14,12]);c.lineDashOffset=-RT*.6;c.beginPath();c.arc(L.x,L.y,r,0,TAU);c.stroke();c.setLineDash([]);
    if(dist2(L.x,L.y,G.p.x,G.p.y)<(r+250)**2){c.globalAlpha=.8;c.textAlign='center';c.textBaseline='middle';c.font='700 12px '+FD;c.fillStyle=unk?COL.gd:B.a;c.fillText('ÉCHO',L.x,L.y-r-14);}c.globalAlpha=1;}
}

/* ---------- écrans : histoire, chroniques, sanctuaire, missions ---------- */
let STORY_CB=null;
function showStory(id,cb,choice){
  const C=CHAPS[id];if(!C){cb&&cb();return;}
  meta.chaps[id]=1;meta.pend=meta.pend.filter(x=>x!==id);saveMeta();STORY_CB=cb;
  $('stT').textContent=C.t;$('stH').textContent=C.h;
  $('stL').innerHTML=C.l.map((s,i)=>'<p style="animation-delay:'+(0.5+i*1.1)+'s">'+s+'</p>').join('');
  $('stB').innerHTML=choice?'<button class="btn pri" data-e="endA">Devenir le cœur</button><button class="btn" data-e="endB">Éclater</button>':'<button class="btn pri" id="stGo">Continuer</button>';
  $('stB').style.animationDelay=(0.6+C.l.length*1.1)+'s';
  $('ov-story').classList.remove('fast');show('ov-story');SFX.ui();
}
function storyGate(cb){
  if(!meta.chaps.prologue){showStory('prologue',cb);return true;}
  const id=CH_ORDER.find(k=>meta.pend.includes(k));
  if(id){showStory(id,cb);return true;}
  return false;
}
function gsEndingGate(){
  if(!G||!G.gs||!G.gs.ending||G.gs.endShown)return false;G.gs.endShown=1;
  showStory('choix',null,true);return true;
}
function gsMenu(){
  const M=misToday(),lc=loreCount();
  {const lk=meta.runs<1;for(const id of ['bHangar','bSanct']){const b=$(id);if(b){b.disabled=lk;b.classList.toggle('lockedb',lk);}}
   $('bHangar').textContent=lk?'Hangar · après ton premier cycle':'Hangar'+(meta.pilot&&meta.pilot.pts?' · '+meta.pilot.pts+' points à répartir':'');$('bSanct').textContent=lk?'Sanctuaire · après ton premier cycle':'Sanctuaire';}
  $('mStats').innerHTML='<div class="pill tank"><b>'+meta.tank.name.replace(/</g,'')+'</b><span>pilote niv. '+meta.pilot.lvl+(meta.pilot.pts?' · '+meta.pilot.pts+' pts':'')+'</span></div>'+$('mStats').innerHTML+'<div class="pill"><b>◇ '+fmt(meta.shards)+'</b><span>éclats</span></div><div class="pill"><b>'+lc+'/'+LORE_N+'</b><span>échos</span></div>'+(meta.streak>1?'<div class="pill"><b>'+meta.streak+' j</b><span>série</span></div>':'');
  $('mMis').innerHTML='<div class="mt">Missions du jour</div>'+M.list.map(m=>{const d=MIS.find(x=>x.id===m.id);return '<div class="mis'+(m.done?' done':'')+'"><span>'+(m.done?'✓ ':'')+d.t(m.n)+'</span><b>+'+m.r+' ◇</b><i style="--v:'+Math.round(m.p/m.n*100)+'%"></i></div>';}).join('');
}
function gsEndBox(){
  const S=G.gs;if(!S||!S.sum)return '';const u=S.sum;
  let h='<div class="mt">◇ +'+S.total+' éclats <span class="muted">(total '+fmt(meta.shards)+')</span></div><div class="gsrow muted">Échos et combats '+u.run+' · score '+u.sc+(u.w?' · victoire '+u.w:'')+(u.day?' · série '+meta.streak+' j : '+u.day:'')+'</div>';
  if(S.newLore)h+='<div class="gsrow gold">'+S.newLore+' nouvel'+(S.newLore>1?'s':'')+' écho'+(S.newLore>1?'s':'')+' · récit '+loreCount()+'/'+LORE_N+'</div>';
  const nx=CH_ORDER.find(k=>meta.pend.includes(k));if(nx)h+='<div class="gsrow gold">Nouveau chapitre : '+CHAPS[nx].t+', '+CHAPS[nx].h+'</div>';
  for(const m of S.misDone){const d=MIS.find(x=>x.id===m.id);h+='<div class="gsrow">✓ Mission : '+d.t(m.n)+' +'+m.r+' ◇</div>';}
  if(meta.runs===1)h+='<div class="gsrow gold">Hangar et Sanctuaire débloqués : équipe ton butin et dépense tes éclats.</div>';
  const goal=nextGoal();if(goal)h+='<div class="gsrow muted">Prochain objectif : '+goal+'</div>';
  return h;
}
function nextGoal(){
  const s=Object.keys(PROF).filter(k=>PROF[k].cost&&!meta.ships[k]).sort((a,b)=>PROF[a].cost-PROF[b].cost)[0];
  if(s){const d=PROF[s].cost-meta.shards;return d>0?'encore '+d+' ◇ pour débloquer le vaisseau '+PROF[s].n:'le vaisseau '+PROF[s].n+' est à ta portée au Sanctuaire';}
  return loreCount()<LORE_N?'retrouver les '+(LORE_N-loreCount())+' échos restants':'';
}
function renderCodex(){
  $('cxGuide').innerHTML=gtGuideHTML();
  const lc=loreCount();$('cxS').textContent='Récit : '+lc+' échos sur '+LORE_N+(meta.endings.endA||meta.endings.endB?' · fin'+(meta.endings.endA&&meta.endings.endB?'s':'')+' découverte'+(meta.endings.endA&&meta.endings.endB?'s':''):'');
  $('cxChaps').innerHTML=[...CH_ORDER,'endA','endB'].map(k=>{const C=CHAPS[k],ok=!!meta.chaps[k]||(k.startsWith('end')&&meta.endings[k]);return '<button class="relrow chap'+(ok?'':' locked')+'" '+(ok?'data-c="'+k+'"':'disabled')+'><span class="ic">'+(ok?'❖':'?')+'</span><span><b>'+C.t+' : '+(ok?C.h:'???')+'</b></span></button>';}).join('');
  $('cxLore').innerHTML=Object.keys(LORE).map(b=>{const n=Math.min(3,meta.lore[b]||0),B=BIO[b];return '<div class="lorebox" style="--c:'+B.a+'"><div class="mt">'+B.n+' <span class="muted">'+n+'/3</span></div>'+LORE[b].map((s,i)=>i<n?'<p>'+s+'</p>':'<p class="muted">…écho non retrouvé</p>').join('')+'</div>';}).join('');
}
let SAN_TAB='ships';
function renderSanct(){
  $('sanS').textContent='◇ '+fmt(meta.shards)+' éclats. Gagne-les en partie : échos, cœurs, victoire, score, missions et série de jours.';
  document.querySelectorAll('#sanTabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===SAN_TAB));
  let h='';
  if(SAN_TAB==='ships')h=Object.keys(PROF).map(k=>{const p=PROF[k],ok=shipOK(k);
    const how=ok?'Débloqué':p.cost?'<b>'+p.cost+' ◇</b>':'Se débloque avec le '+CHAPS[p.story].t;
    return '<button class="card prof'+(ok?'':' locked')+'" style="--c:'+p.col+'" '+(!ok&&p.cost?'data-buy="ship:'+k+'"':'disabled')+'><span class="ic">'+p.ic+'</span><span class="nm">'+p.n+'</span><span class="ds">'+p.d+'</span><span class="price">'+how+'</span></button>';}).join('');
  else if(SAN_TAB==='arts')h=Object.keys(ARTS).map(k=>{const a=ARTS[k],n=meta.arts[k]||0,mx=n>=a.max,cost=50+35*n;
    return '<button class="card relic" '+(mx?'disabled':'data-buy="art:'+k+'"')+'><span class="ic">'+a.ic+'</span><span class="nm">'+a.n+' <span class="muted">'+n+'/'+a.max+'</span></span><span class="ds">'+a.d+'</span><span class="price">'+(mx?'Maximum':'<b>'+cost+' ◇</b>')+'</span></button>';}).join('');
  else h=Object.keys(SKINS).map(k=>{const s=SKINS[k],ok=skinOK(k),on=meta.skin===k;
    const how=on?'Équipée':ok?'Équiper':s.cost?'<b>'+s.cost+' ◇</b>':s.ach?'Vaincre l’Hypernoyau':'Fin secrète';
    return '<button class="card skin'+(on?' chosen':'')+(ok?'':' locked')+'" style="--c:'+(s.col||'#2de2ff')+'" '+(ok?'data-skin="'+k+'"':s.cost?'data-buy="skin:'+k+'"':'disabled')+'><span class="ic">●</span><span class="nm">'+s.n+'</span><span class="price">'+how+'</span></button>';}).join('');
  $('sanList').innerHTML=h;
}
function sanctBuy(key){
  const [t,k]=key.split(':');let cost=0;
  if(t==='ship')cost=PROF[k].cost;else if(t==='art')cost=50+35*(meta.arts[k]||0);else cost=SKINS[k].cost;
  if(meta.shards<cost){SFX.ui();const e=$('sanS');e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');return;}
  meta.shards-=cost;if(t==='ship')meta.ships[k]=1;else if(t==='art')meta.arts[k]=(meta.arts[k]||0)+1;else{meta.skins[k]=1;meta.skin=k;}
  saveMeta();SFX.evo();renderSanct();
}
function gsBindUI(){
  $('bSanct').onclick=()=>{SFX.ui();renderSanct();show('ov-sanct');};
  $('bCodex').onclick=()=>{SFX.ui();renderCodex();show('ov-codex');};
  $('sanTabs').onclick=e=>{const b=e.target.closest('[data-t]');if(b){SAN_TAB=b.dataset.t;SFX.ui();renderSanct();}};
  $('sanList').onclick=e=>{const b=e.target.closest('[data-buy],[data-skin]');if(!b)return;if(b.dataset.skin){meta.skin=b.dataset.skin;saveMeta();SFX.ui();renderSanct();}else sanctBuy(b.dataset.buy);};
  $('cxGuide').onclick=e=>{if(e.target.id==='bTutoAgain'){meta.tuto=0;meta.tips={};saveMeta();e.target.textContent='Le prologue reprendra au prochain cycle';e.target.disabled=true;SFX.ui();}};
  $('cxChaps').onclick=e=>{const b=e.target.closest('[data-c]');if(b)showStory(b.dataset.c,()=>{renderCodex();show('ov-codex');});};
  $('stB').onclick=e=>{const b=e.target.closest('button');if(!b)return;SFX.ui();
    if(b.dataset.e){const E=b.dataset.e;meta.endings[E]=1;saveMeta();showStory(E,()=>showEnd());return;}
    const cb=STORY_CB;STORY_CB=null;if(cb)cb();else{renderMenu();show('ov-menu');}};
  $('ov-story').addEventListener('click',e=>{if(!e.target.closest('button'))$('ov-story').classList.add('fast');});
}
