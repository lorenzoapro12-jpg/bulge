'use strict';
/* =========================================================
   BULGE — absorbe, évolue, dévore
   ========================================================= */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const $=id=>document.getElementById(id);
const SIMF=()=>typeof window!=='undefined'&&!!window.__SIM;
const COL={cy:'#2de2ff',mg:'#ff2d95',gd:'#ffc93c',lm:'#7dff4a',rd:'#ff3355',vi:'#a45cff',or:'#ff8a2d',wh:'#ffffff',bl:'#4d8dff',ac:'#e4ff3a',pk:'#9ff3ff'};
const REDUCED=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const FD='"Chakra Petch","Space Mono",monospace';
const _rgb={};
function rgb(h){let c=_rgb[h];if(!c)c=_rgb[h]=[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];return c;}
function rgba(h,a){const c=rgb(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
let _seed=1;
function srand(s){_seed=(s>>>0)||1;}
function R(){_seed=(_seed+0x6D2B79F5)>>>0;let t=_seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
const rr=(a,b)=>a+R()*(b-a);
const pick=a=>a[Math.floor(R()*a.length)];
const fr=(a,b)=>a+Math.random()*(b-a);
function shuffle(a,r){r=r||R;for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function dist2(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}
function angDiff(a,b){let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;else if(d<-Math.PI)d+=TAU;return d;}
function fmt(n){return Math.round(n).toLocaleString('fr-FR');}
function mmss(f){const s=Math.floor(f/60);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}

/* ---------- sauvegarde ---------- */
const store={
  get(k,d){try{const v=localStorage.getItem('bulge2_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('bulge2_'+k,JSON.stringify(v));}catch(e){}}
};
let meta=Object.assign({runs:0,wins:0,arts:{},ach:{},best:0,lb:[],daily:{},mute:false,kills:0,seenHelp:false},store.get('meta',{})||{});
function saveMeta(){store.set('meta',meta);}
let ARTS_ON=true;
function art(k){return ARTS_ON?(meta.arts[k]||0):0;}
function artCount(){let n=0;for(const k in meta.arts)n+=meta.arts[k];return n;}

/* ---------- données ---------- */
const ARTS={
  dmg:{n:'Noyau dense',d:'+12 % de dégâts',ic:'◆',max:10},
  rate:{n:'Surcadence',d:'+8 % de cadence de tir',ic:'≫',max:10},
  spd:{n:'Propulseurs',d:'+6 % de vitesse',ic:'➤',max:8},
  hp:{n:'Membrane épaisse',d:'+6 bulles au départ',ic:'◯',max:10},
  armor:{n:'Résilience',d:'-7 % de dégâts subis',ic:'⬡',max:8},
  greed:{n:'Avidité',d:'+12 % de bulles lâchées',ic:'✦',max:10},
  magnet:{n:'Champ magnétique',d:'+25 % de rayon de collecte',ic:'⊙',max:6},
  reroll:{n:'Chance',d:'+1 relance d\'évolution par partie',ic:'↻',max:5},
  echo:{n:'Écho',d:'L\'onde de niveau grandit et blesse',ic:'◎',max:5},
  dash:{n:'Surcharge',d:'-12 % de recharge du dash',ic:'⚡',max:5},
  crit:{n:'Fracture',d:'+6 % de chance de critique',ic:'✕',max:8},
};
const PROF={
  scout:{n:'Éclaireur',d:'Petit, rapide, fragile. Dash qui recharge vite.',spd:4.1,rate:1.15,dmg:.85,size:.85,bub:7,armor:1.1,dash:.7,col:'#7dff4a',ic:'➤'},
  bal:{n:'Équilibré',d:'Rien d\'extrême. Le choix sûr pour apprendre.',spd:3.4,rate:1,dmg:1,size:1,bub:10,armor:1,dash:1,col:'#2de2ff',ic:'◯'},
  tank:{n:'Colosse',d:'Lent et très blindé, canon un peu faible au départ.',spd:2.8,rate:.9,dmg:1.12,size:1.15,bub:16,armor:.67,dash:1.25,col:'#ffc93c',ic:'⬤'},
};
const UPG=[
  {id:'twin',n:'Canons jumeaux',d:'+1 canon, tir en éventail.',c:'Arme',ic:'⋔',max:3,f:p=>{p.turrets++;}},
  {id:'heavy',n:'Obus lourds',d:'Dégâts ×1,4, projectiles plus gros, cadence -10 %.',c:'Arme',ic:'●',max:4,f:p=>{p.dmg*=1.4;p.bsize+=1.6;p.fireI*=1.1;}},
  {id:'rapid',n:'Surcadence',d:'Cadence de tir +25 %.',c:'Arme',ic:'≫',max:5,f:p=>{p.fireI/=1.25;}},
  {id:'rail',n:'Rail',d:'Vitesse et portée +30 %, traverse +1 ennemi.',c:'Arme',ic:'━',max:3,f:p=>{p.bspd*=1.3;p.blife*=1.15;p.pierce++;}},
  {id:'homing',n:'Tête chercheuse',d:'Les tirs dévient vers les ennemis.',c:'Arme',ic:'↝',max:3,f:p=>{p.homing+=.07;}},
  {id:'rico',n:'Ricochet',d:'Les tirs rebondissent sur la membrane.',c:'Arme',ic:'↯',max:3,f:p=>{p.rico++;}},
  {id:'split',n:'Fragmentation',d:'Chaque impact projette des éclats.',c:'Arme',ic:'✺',max:2,f:p=>{p.split++;}},
  {id:'aura',n:'Champ de mort',d:'Une aura ronge les ennemis proches.',c:'Module',ic:'◌',max:4,f:p=>{p.aura++;}},
  {id:'orbs',n:'Satellites',d:'+2 sphères orbitales qui tranchent et bloquent les tirs.',c:'Module',ic:'∘',max:3,f:p=>{p.orbs+=2;}},
  {id:'drone',n:'Essaim',d:'+1 drone-bulle qui tire tout seul.',c:'Module',ic:'⊛',max:3,f:p=>{p.drones++;}},
  {id:'missile',n:'Missiles',d:'Salve régulière de missiles explosifs.',c:'Module',ic:'➶',max:4,f:p=>{p.missile++;}},
  {id:'speed',n:'Hyperdrive',d:'Vitesse +12 %.',c:'Corps',ic:'➤',max:4,f:p=>{p.spd*=1.12;}},
  {id:'armor',n:'Blindage',d:'Dégâts subis -15 %.',c:'Corps',ic:'⬡',max:4,f:p=>{p.armor*=.85;}},
  {id:'magnet',n:'Aimant',d:'Rayon de collecte +50 %.',c:'Corps',ic:'⊙',max:3,f:p=>{p.magnet*=1.5;}},
  {id:'regen',n:'Mitose',d:'Tu génères une bulle toutes les 1,5 s.',c:'Corps',ic:'✚',max:3,f:p=>{p.regen++;}},
  {id:'crit',n:'Point faible',d:'+10 % de chance de critique (×2,5).',c:'Corps',ic:'✕',max:3,f:p=>{p.crit+=.1;}},
  {id:'spur',n:'Éperon',d:'Dash rechargé 20 % plus vite, et il blesse.',c:'Corps',ic:'⚡',max:3,f:p=>{p.dashMax*=.8;p.dashDmg+=3;}},
  {id:'greed',n:'Symbiose',d:'+20 % de bulles lâchées.',c:'Corps',ic:'✦',max:3,f:p=>{p.greed*=1.2;}},
];
const MUT=[
  {id:'hydra',n:'Hydre',d:'+2 canons et cadence +20 %. Trois têtes valent mieux qu\'une.',ic:'⋔',f:p=>{p.turrets+=2;p.fireI/=1.2;p.spreadW=.22;}},
  {id:'titan',n:'Titan',d:'Dégâts ×1,8, taille ×1,25, obus énormes. Vitesse -10 %.',ic:'⬤',f:p=>{p.dmg*=1.8;p.titan=true;p.bsize+=3;p.spd*=.9;}},
  {id:'nova',n:'Nova',d:'Toutes les 3 s, une onde de choc pulvérise les tirs ennemis.',ic:'✹',f:p=>{p.nova++;}},
  {id:'vortex',n:'Vortex',d:'Les tirs ennemis ralentissent près de toi. Aimant ×2.',ic:'@',f:p=>{p.vortex=true;p.magnet*=2;}},
  {id:'queen',n:'Reine',d:'+3 drones à tête chercheuse.',ic:'♛',f:p=>{p.drones+=3;p.dronesHome=true;}},
  {id:'ghost',n:'Fantôme',d:'Dash deux fois plus fréquent, laisse une traînée mortelle.',ic:'◐',f:p=>{p.dashMax*=.5;p.ghost=true;p.dashDmg+=4;}},
  {id:'prism',n:'Prisme',d:'Chaque impact se fragmente, les tirs traversent +2.',ic:'◇',f:p=>{p.split+=2;p.pierce+=2;}},
  {id:'fury',n:'Surchauffe',d:'Cadence ×1,6, dispersion aléatoire.',ic:'♨',f:p=>{p.fireI/=1.6;p.jitter=true;p.fury=true;}},
];
const ET={
  mite:{n:'Mite',r:9,hp:1.5,spd:2.3,bub:1,col:COL.vi,cost:.7,min:1,dmg:4},
  pop:{n:'Bulleur',r:14,hp:4,spd:.8,bub:3,col:COL.mg,cost:1.5,min:1,dmg:3},
  spread:{n:'Tireur',r:16,hp:6,spd:1.1,bub:4,col:COL.or,cost:2.5,min:2,dmg:3},
  spike:{n:'Épine',r:15,hp:5,spd:1,bub:3,col:COL.rd,cost:2,min:2,dmg:7},
  orbit:{n:'Orbiteur',r:14,hp:5,spd:2,bub:4,col:COL.bl,cost:2.5,min:3,dmg:3},
  ring:{n:'Pulsar',r:20,hp:11,spd:.55,bub:6,col:COL.gd,cost:3.5,min:3,dmg:3},
  sniper:{n:'Tireur d\'élite',r:13,hp:4,spd:1.2,bub:4,col:COL.ac,cost:2.5,min:4,dmg:6},
  gatling:{n:'Gatling',r:18,hp:9,spd:.4,bub:6,col:COL.or,cost:3.5,min:5,dmg:2.5},
  spawner:{n:'Porteur',r:26,hp:18,spd:.45,bub:10,col:COL.vi,cost:5,min:4,dmg:0},
  cache:{n:'Grappe',r:18,hp:3,spd:0,bub:9,col:COL.pk,cost:0,min:99,dmg:0},
  life:{n:'Porteur de vie',r:22,hp:6,spd:1.6,bub:16,col:COL.lm,cost:0,min:99,dmg:0},
};
const ACH=[
  {id:'boss',n:'Brise-noyau',d:'Vaincre l\'Hypernoyau'},
  {id:'lvl10',n:'Géant',d:'Atteindre le niveau 10'},
  {id:'combo25',n:'Réaction en chaîne',d:'Enchaîner un combo ×25'},
  {id:'nohit',n:'Intouchable',d:'Purger une salle 5+ sans dégât'},
  {id:'scout',n:'Fil du rasoir',d:'Gagner en Éclaireur'},
  {id:'tank',n:'Forteresse',d:'Gagner en Colosse'},
  {id:'fast',n:'Éclair',d:'Gagner en moins de 5 min'},
  {id:'explorer',n:'Explorateur',d:'Traverser les 8 biomes en une partie'},
  {id:'kills',n:'Fléau',d:'Absorber 1 000 ennemis au total'},
  {id:'daily',n:'Rituel',d:'Terminer un défi du jour'},
];

/* ---------- audio synthétisé ---------- */
const AU={ac:null,master:null,sfx:null,mus:null,musF:null,dly:null,nb:null,last:{},step:0,next:0,layer:0};
function auInit(){
  if(AU.ac){if(AU.ac.state==='suspended')AU.ac.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{
    const ac=new AC();AU.ac=ac;
    const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=5;comp.connect(ac.destination);
    AU.master=ac.createGain();AU.master.gain.value=meta.mute?0:.8;AU.master.connect(comp);
    AU.sfx=ac.createGain();AU.sfx.gain.value=.55;AU.sfx.connect(AU.master);
    AU.mus=ac.createGain();AU.mus.gain.value=.64;AU.mus.connect(AU.master);
    const len=ac.sampleRate*2,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;AU.nb=b;
    musInit(ac);AU.next=ac.currentTime+.15;setInterval(musTick,25);
  }catch(e){AU.ac=null;}
}
function setMute(m){meta.mute=m;saveMeta();if(AU.master)AU.master.gain.setTargetAtTime(m?0:.8,AU.ac.currentTime,.05);}
function osc(dest,type,f0,f1,t,dur,vol,att){const ac=AU.ac,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(att||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05);}
function nz(dest,t,dur,vol,type,freq,q){const ac=AU.ac,s=ac.createBufferSource();s.buffer=AU.nb;const f=ac.createBiquadFilter();f.type=type||'lowpass';f.frequency.value=freq||2000;if(q)f.Q.value=q;const g=ac.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t,Math.random()*.6);s.stop(t+dur+.05);}
function can(k,ms){if(!AU.ac||meta.mute)return false;const n=performance.now();if(AU.last[k]&&n-AU.last[k]<ms)return false;AU.last[k]=n;return true;}
const PENTA=[0,3,5,7,10];
function note(i,base){const o=Math.floor(i/5),s=PENTA[((i%5)+5)%5];return base*Math.pow(2,(o*12+s)/12);}
const SFX={
  shoot(){if(!can('sh',75))return;const t=AU.ac.currentTime;osc(AU.sfx,'square',900+Math.random()*250,420,t,.05,.010);},
  hit(){if(!can('hit',40))return;const t=AU.ac.currentTime;osc(AU.sfx,'triangle',620,260,t,.05,.026);},
  pop(big){if(!can(big?'popb':'pop',big?60:28))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',big?340:720,big?55:140,t,big?.3:.13,big?.16:.075);nz(AU.sfx,t,big?.35:.09,big?.14:.045,'bandpass',big?700:2600,1.4);},
  pick(i){if(!can('pk',30))return;const t=AU.ac.currentTime,f=note(Math.min(i,24),330);osc(AU.sfx,'sine',f,f,t,.16,.04);osc(AU.sfx,'triangle',f*2,f*2,t,.07,.012);},
  lvl(){if(!can('lv',250))return;const t=AU.ac.currentTime;[0,4,7,12,16,19].forEach((s,k)=>osc(AU.sfx,'square',330*Math.pow(2,s/12),0,t+k*.045,.2,.03));nz(AU.sfx,t,.5,.06,'highpass',4000);osc(AU.sfx,'sine',110,440,t,.4,.08);},
  delvl(){if(!can('dl',250))return;const t=AU.ac.currentTime;[12,7,3,0].forEach((s,k)=>osc(AU.sfx,'sawtooth',220*Math.pow(2,s/12),0,t+k*.06,.16,.03));},
  evo(){if(!can('ev',100))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',220,880,t,.35,.07);nz(AU.sfx,t,.3,.05,'bandpass',3000,2);},
  hurt(){if(!can('hu',90))return;const t=AU.ac.currentTime;nz(AU.sfx,t,.28,.25,'lowpass',1000);osc(AU.sfx,'sawtooth',200,55,t,.32,.09);},
  dash(){if(!can('da',100))return;const t=AU.ac.currentTime;nz(AU.sfx,t,.22,.12,'bandpass',1800,.8);osc(AU.sfx,'sine',300,900,t,.14,.04);},
  warp(){if(!can('wa',300))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',120,1800,t,.6,.09);osc(AU.sfx,'triangle',240,3600,t+.05,.5,.03);nz(AU.sfx,t,.6,.08,'highpass',2000);},
  clear(){if(!can('cl',300))return;const t=AU.ac.currentTime;[0,7,12,19].forEach((s,k)=>osc(AU.sfx,'triangle',440*Math.pow(2,s/12),0,t+k*.07,.3,.05));},
  spawn(){if(!can('sp',200))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',1600,200,t,.25,.03);},
  eshot(){if(!can('es',110))return;const t=AU.ac.currentTime;osc(AU.sfx,'triangle',340,190,t,.07,.016);},
  tele(){if(!can('te',150))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',600,1500,t,.8,.025);},
  snipe(){if(!can('sn',100))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',1400,200,t,.18,.05);},
  missile(){if(!can('mi',120))return;const t=AU.ac.currentTime;nz(AU.sfx,t,.18,.05,'bandpass',1200,3);},
  boom(){if(!can('bo',70))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',140,35,t,.5,.18);nz(AU.sfx,t,.5,.16,'lowpass',600);},
  nova(){if(!can('no',150))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',80,40,t,.5,.2);nz(AU.sfx,t,.4,.1,'bandpass',500,.7);osc(AU.sfx,'triangle',1200,300,t,.3,.03);},
  bossIn(){if(!can('bi',500))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',55,40,t,1.6,.2,.2);osc(AU.sfx,'square',110,82,t+.1,1.2,.06,.1);nz(AU.sfx,t,1.4,.1,'lowpass',300);},
  phase(){if(!can('ph',300))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',160,30,t,1,.25);nz(AU.sfx,t,.9,.2,'lowpass',800);for(let k=0;k<6;k++)osc(AU.sfx,'square',200+Math.random()*1800,0,t+k*.04,.04,.03);},
  bshot(){if(!can('bs',120))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',260,120,t,.14,.04);},
  ach(){if(!can('ac',300))return;const t=AU.ac.currentTime;[0,4,7,11,14].forEach((s,k)=>osc(AU.sfx,'triangle',523*Math.pow(2,s/12),0,t+k*.06,.35,.04));},
  death(){if(!can('de',500))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',300,30,t,1.4,.15);nz(AU.sfx,t,1.2,.25,'lowpass',1200);},
  ui(){if(!can('ui',60))return;const t=AU.ac.currentTime;osc(AU.sfx,'triangle',880,1320,t,.06,.03);},
};
/* musique : Am - F - C - G, couches selon l'intensité */
/* =========================================================
   MUSIQUE ADAPTATIVE
   6 pistes (nappe, basse, arpège, mélodie, batterie, ambiance) mixées en direct
   selon l'action : exploration calme, alerte, combat, arène/boss, vie basse, pause.
   Chaque biome a sa tonalité, ses accords, ses timbres et son ambiance sonore.
   ========================================================= */
const BPM=124,STEP=60/BPM/4;
const PAL={
  plains:{key:0, sc:[0,2,4,7,9,12,14,16], prog:[[0,4,7,11],[-3,0,4,7],[5,9,12,16],[7,11,14,17]], cut:2200,arp:'bell', lead:'flute',dr:'soft', amb:'wind'},
  floral:{key:2, sc:[0,3,5,7,10,12,15,17],prog:[[0,3,7,10],[5,8,12,15],[-4,0,3,7],[-2,2,5,9]], cut:1800,arp:'pluck',lead:'flute',dr:'break',amb:'wind'},
  sea:   {key:-3,sc:[0,2,3,7,10,12,14,15],prog:[[0,3,7,14],[-4,0,3,10],[3,7,10,14],[-2,2,5,12]], cut:1000,arp:'bell', lead:'bell', dr:'soft', amb:'deep'},
  sky:   {key:5, sc:[0,2,4,7,9,12,14,16], prog:[[0,4,7,14],[5,9,12,16],[-3,0,4,11],[7,11,14,18]], cut:3000,arp:'bell', lead:'flute',dr:'soft', amb:'wind'},
  cyber: {key:-2,sc:[0,3,5,7,10,12,15,17],prog:[[0,3,7,10],[0,3,7,10],[-4,0,3,7],[-2,2,5,9]], cut:2600,arp:'pluck',lead:'saw',  dr:'four', amb:'hum'},
  urban: {key:-5,sc:[0,3,5,6,7,10,12,15], prog:[[0,3,7,10],[-4,0,3,10],[-7,-4,0,3],[-2,2,5,9]], cut:1500,arp:'pluck',lead:'saw',  dr:'break',amb:'rain'},
  ice:   {key:4, sc:[0,2,3,7,8,12,14,15], prog:[[0,3,7,14],[-4,0,3,11],[1,5,8,12],[-2,2,5,14]], cut:3400,arp:'bell', lead:'bell', dr:'soft', amb:'wind'},
  core:  {key:-4,sc:[0,1,3,5,7,8,12,13], prog:[[0,3,7,10],[1,5,8,12],[0,3,6,10],[-2,1,5,8]], cut:1900,arp:'pluck',lead:'saw',  dr:'four', amb:'deep'}};
const AMB={wind:['bandpass',700,.5,.05],deep:['lowpass',260,.8,.09],hum:['bandpass',120,6,.05],rain:['highpass',3500,.4,.035]};
const hz=n=>110*Math.pow(2,n/12);
function mkImpulse(ac,dur,dec){const len=Math.floor(ac.sampleRate*dur),b=ac.createBuffer(2,len,ac.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,dec);}return b;}
function musInit(ac){
  const M=AU.mus;
  AU.mLP=ac.createBiquadFilter();AU.mLP.type='lowpass';AU.mLP.frequency.value=18000;AU.mLP.Q.value=.8;AU.mLP.connect(M);
  AU.rev=ac.createConvolver();AU.rev.buffer=mkImpulse(ac,3,2.4);const rg=ac.createGain();rg.gain.value=.6;AU.rev.connect(rg);rg.connect(AU.mLP);
  AU.rsend=ac.createGain();AU.rsend.connect(AU.rev);
  /* écho ping-pong stéréo calé sur le tempo */
  const dL=ac.createDelay(1),dR=ac.createDelay(1),fb=ac.createGain(),lf=ac.createBiquadFilter(),pl=ac.createStereoPanner(),pr=ac.createStereoPanner();
  dL.delayTime.value=dR.delayTime.value=STEP*3;fb.gain.value=.24;lf.type='lowpass';lf.frequency.value=3200;pl.pan.value=-.75;pr.pan.value=.75;
  AU.dsend=ac.createGain();AU.dsend.connect(dL);dL.connect(lf);lf.connect(dR);dR.connect(fb);fb.connect(dL);dL.connect(pl);dR.connect(pr);pl.connect(AU.mLP);pr.connect(AU.mLP);pl.connect(AU.rsend);
  /* bus « pompé » par la grosse caisse (nappe, basse, arpège) */
  AU.duck=ac.createGain();AU.duck.connect(AU.mLP);
  AU.st={};let sid=0;AU.buses={};for(const k of ['pad','bass','arp','lead','drums','amb']){const g=ac.createGain();g.__id=sid++;g.gain.value=0;g.connect(k==='drums'||k==='lead'||k==='amb'?AU.mLP:AU.duck);AU.st[k]=g;}
  const src=ac.createBufferSource();src.buffer=AU.nb;src.loop=true;AU.ambF=ac.createBiquadFilter();AU.ambF.type='bandpass';AU.ambF.frequency.value=700;
  AU.ambG=ac.createGain();AU.ambG.gain.value=.05;src.connect(AU.ambF);AU.ambF.connect(AU.ambG);AU.ambG.connect(AU.st.amb);src.start();
  AU.bio='plains';AU.pal=PAL.plains;AU.tier=0;AU.tierT=0;AU.mel=null;AU.layer=AU.layer||0;
}
function setBiome(b){if(PAL[b])AU.bio=b;}
function setMusic(l){AU.layer=l;}
/* ---------- instruments ---------- */
function env(g,t,a,v,dec,sus,end,rel){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.setTargetAtTime(v*sus,t+a,dec);g.gain.setTargetAtTime(0,end,rel);}
/* bus partagés (créés une fois) : évite ~6 nœuds audio par note */
function bus(dest,p,ds,rs){const key=dest.__id+'|'+(Math.round(p*2)/2)+'|'+ds+'|'+rs;AU.buses=AU.buses||{};let b=AU.buses[key];if(b)return b;const ac=AU.ac;
  b=ac.createGain();const pn=ac.createStereoPanner();pn.pan.value=Math.round(p*2)/2;b.connect(pn);pn.connect(dest);
  if(ds){const g=ac.createGain();g.gain.value=ds;pn.connect(g);g.connect(AU.dsend);}if(rs){const g=ac.createGain();g.gain.value=rs;pn.connect(g);g.connect(AU.rsend);}
  return AU.buses[key]=b;}
function pan(dest,p){return bus(dest,p,0,0);}
function iPad(t,notes,dur,cut){const ac=AU.ac;
  for(const n of notes.slice(0,3)){const f=hz(n+12),lp=ac.createBiquadFilter(),g=ac.createGain(),P=bus(AU.st.pad,(Math.random()-.5)*.9,0,.5);
    lp.type='lowpass';lp.Q.value=.6;lp.frequency.setValueAtTime(cut*.4,t);lp.frequency.linearRampToValueAtTime(cut,t+dur*.5);lp.frequency.linearRampToValueAtTime(cut*.6,t+dur);
    for(const dt of [-6,6]){const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=dt+(Math.random()-.5)*4;o.connect(lp);o.start(t);o.stop(t+dur+2);}
    lp.connect(g);env(g,t,1.2,.05,1.5,.85,t+dur,.9);g.connect(P);}}
function iBass(t,n,dur,v,bright){const ac=AU.ac,f=hz(n-12),o=ac.createOscillator(),o2=ac.createOscillator(),lp=ac.createBiquadFilter(),g=ac.createGain(),g2=ac.createGain();
  o.type='sine';o.frequency.value=f;o2.type='sawtooth';o2.frequency.value=f;lp.type='lowpass';lp.Q.value=3;
  lp.frequency.setValueAtTime(180+bright*900,t);lp.frequency.exponentialRampToValueAtTime(140,t+Math.max(.08,dur));
  o.connect(g);o2.connect(lp);lp.connect(g2);env(g,t,.006,.26*v,.2,.8,t+dur,.05);env(g2,t,.004,.1*v,.1,.5,t+dur,.04);g.connect(AU.st.bass);g2.connect(AU.st.bass);
  o.start(t);o2.start(t);o.stop(t+dur+.4);o2.stop(t+dur+.4);}
function iBell(t,n,v,dest,p){const ac=AU.ac,f=hz(n+24),c=ac.createOscillator(),m=ac.createOscillator(),mg=ac.createGain(),g=ac.createGain();
  c.type='sine';c.frequency.value=f;m.type='sine';m.frequency.value=f*3.51;mg.gain.setValueAtTime(f*2.2,t);mg.gain.exponentialRampToValueAtTime(f*.05,t+.6);
  m.connect(mg);mg.connect(c.frequency);c.connect(g);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+1.6);
  g.connect(bus(dest,p,.45,.5));
  c.start(t);m.start(t);c.stop(t+1.7);m.stop(t+1.7);}
function iPluck(t,n,v,dest,p,cut){const ac=AU.ac,f=hz(n+24),o=ac.createOscillator(),o2=ac.createOscillator(),lp=ac.createBiquadFilter(),g=ac.createGain();
  o.type='sawtooth';o2.type='sawtooth';o.frequency.value=f;o2.frequency.value=f;o2.detune.value=12;lp.type='lowpass';lp.Q.value=5;
  lp.frequency.setValueAtTime(cut*2,t);lp.frequency.exponentialRampToValueAtTime(300,t+.18);o.connect(lp);o2.connect(lp);lp.connect(g);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+.35);
  g.connect(bus(dest,p,.5,0));o.start(t);o2.start(t);o.stop(t+.4);o2.stop(t+.4);}
function iLead(t,n,dur,v,kind){const ac=AU.ac,f=hz(n+24),g=ac.createGain(),lfo=ac.createOscillator(),lg=ac.createGain();
  lfo.frequency.value=5.2;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*.012,t+.35);lfo.connect(lg);
  if(kind==='bell'){iBell(t,n,v*1.4,AU.st.lead,(Math.random()-.5)*.4);return;}
  const os=[];
  if(kind==='flute'){const o=ac.createOscillator();o.type='triangle';o.frequency.value=f;const o2=ac.createOscillator();o2.type='sine';o2.frequency.value=f*2;const g2=ac.createGain();g2.gain.value=.25;o2.connect(g2);g2.connect(g);o.connect(g);os.push(o,o2);}
  else{const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(900,t);lp.frequency.linearRampToValueAtTime(1700,t+.08);lp.Q.value=2;lp.connect(g);
    for(const d of [-7,7]){const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;o.connect(lp);os.push(o);}}
  for(const o of os){lg.connect(o.frequency);o.start(t);o.stop(t+dur+.6);}lfo.start(t);lfo.stop(t+dur+.6);
  env(g,t,kind==='flute'?.05:.02,v,.3,.8,t+dur,.12);g.connect(bus(AU.st.lead,0,.35,.6));}
function dKick(t,v){const ac=AU.ac,o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(165,t);o.frequency.exponentialRampToValueAtTime(44,t+.12);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.42);o.connect(g);g.connect(AU.st.drums);o.start(t);o.stop(t+.45);
  nz(AU.st.drums,t,.012,v*.25,'highpass',3000);
  const d=AU.duck.gain;d.cancelScheduledValues(t);d.setValueAtTime(.35,t);d.setTargetAtTime(1,t+.02,.09);}
function dSnare(t,v){const ac=AU.ac;nz(AU.st.drums,t,.18,v,'bandpass',1900,.7);const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(130,t+.08);
  g.gain.setValueAtTime(v*.8,t);g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.connect(g);g.connect(bus(AU.st.drums,0,0,.4));o.start(t);o.stop(t+.15);}
function dClap(t,v){for(let k=0;k<3;k++)nz(AU.st.drums,t+k*.011,.05+(k===2?.12:0),v,'bandpass',1250,1.2);nz(AU.rsend,t,.2,v*.5,'bandpass',1250,1);}
function dHat(t,v,open){nz(AU.st.drums,t,open?.22:.035,v,'highpass',open?7000:9000);}
function dTom(t,f0,v){const ac=AU.ac,o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f0*.55,t+.25);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(AU.st.drums);o.start(t);o.stop(t+.32);}
/* ---------- état du jeu -> intensité ---------- */
function musState(){
  if(typeof G==='undefined'||!G||!G.p||AU.layer===0)return{tier:-1};
  const P=G.p,st=G.state;
  if(st==='dying'||P.dead)return{tier:0,dead:true};
  if(G.gv&&G.gv.k>.3)return{tier:-2};
  let tier=0;
  if((G.boss&&!G.boss.dead)||G.arena||st==='duel')tier=3;
  else if(G.gx&&G.gx.scene)tier=2;
  else{let n=0;for(const e of G.en)if(!e.dead&&e.aggro&&e.spawn<=0&&e.t!=='cache'&&e.t!=='life'&&dist2(e.x,e.y,P.x,P.y)<760*760)n++;tier=n>=5?2:n>=1?1:0;}
  return{tier,low:P.lvl===1&&P.bub<6,pause:st==='pause'||st==='evo',duel:st==='duel'};
}
const MIXES=[[.9,.6,.55,.6,.4,.7],[.75,.8,.7,.6,.8,.55],[.65,1,.8,.75,1,.35],[.7,1,.9,.85,1.05,.25]]; /* pad bass arp lead drums amb */
const MIX_MENU=[1,.3,.8,.6,0,.5],MIX_CALM=[1,.15,.7,.5,0,.9];
function musMix(S,t,brk){
  const K=['pad','bass','arp','lead','drums','amb'],m=S.tier===-1?MIX_MENU:S.tier===-2?MIX_CALM:MIXES[Math.max(0,S.tier)];
  K.forEach((k,i)=>AU.st[k].gain.setTargetAtTime(m[i]*(S.dead?.3:1)*(brk&&k==='drums'?.35:1)*(brk&&k==='bass'?.6:1),t,S.tier>AU.tier?.25:1.2));
  let cut=S.dead?350:S.pause?700:S.low?1100:S.tier===-1?6000:S.tier===-2?4200:18000;if(brk)cut=Math.min(cut,2600);if(AU.trans)cut=900;
  AU.mLP.frequency.setTargetAtTime(cut,t,AU.trans?.5:.35);AU.rsend.gain.setTargetAtTime(S.tier===-2?1.7:1,t,1.5);
  const a=AMB[AU.pal.amb];AU.ambF.type=a[0];AU.ambF.frequency.setTargetAtTime(a[1],t,1);AU.ambF.Q.value=a[2];AU.ambG.gain.setTargetAtTime(a[3],t,1);
}
/* souffle (montée ou descente) et cymbale : les ponctuations des transitions */
function swell(t,dur,vol,up){const ac=AU.ac,s=ac.createBufferSource();s.buffer=AU.nb;s.loop=true;const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=.8;
  f.frequency.setValueAtTime(up?400:5000,t);f.frequency.exponentialRampToValueAtTime(up?6000:500,t+dur);const g=ac.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.95);g.gain.exponentialRampToValueAtTime(.0001,t+dur+.08);
  s.connect(f);f.connect(g);g.connect(AU.mLP);const r=ac.createGain();r.gain.value=.6;g.connect(r);r.connect(AU.rsend);s.start(t);s.stop(t+dur+.1);}
function crash(t,v){nz(AU.st.drums,t,1.6,v,'highpass',5200);nz(AU.rsend,t,1.2,v*.6,'highpass',3000);dKick(t,.7);}
function varMel(m){return m.map((v,i)=>v<0?-1:(i%16===0?v:(v+1)%4));}
/* mélodie générée par biome (4 mesures), marche aléatoire sur la gamme */
const RHY=[[[0,8]],[[0,6],[8,4],[12,4]],[[0,4],[4,4],[8,8]],[[0,10],[12,4]],[[0,3],[4,4],[8,6]],[[0,12]]];
function genMel(b){const r=mkRngA(b.length*977+b.charCodeAt(0)*31),out=new Array(64).fill(-1);let last=0;
  for(let bar=0;bar<4;bar++){const R=bar===3?[[0,8],[8,8]]:RHY[Math.floor(r()*RHY.length)];
    R.forEach(([st],i)=>{let d=last+(r()<.5?1:-1)*(r()<.7?1:0);d=Math.max(0,Math.min(3,d));if(bar===3&&i===R.length-1)d=0;if(i===0&&r()<.4)d=r()<.5?0:2;out[bar*16+st]=d;last=d;});}
  return out;}
function mkRngA(s){let a=s>>>0||1;return()=>{a=(a*16807)%2147483647;return a/2147483647;};}
function musTick(){const ac=AU.ac;if(!ac||!AU.st)return;while(AU.next<ac.currentTime+.2){schedStep(AU.step,AU.next);AU.step++;AU.next+=STEP;}}
function musNewPal(barN){AU.pal=PAL[AU.bio];AU.mel=genMel(AU.bio);AU.mel2=varMel(AU.mel);AU.bb=barN;}
function schedStep(s,t){
  if(meta.mute)return;
  const st=s%16,S=musState(),barN=Math.floor(s/16);
  if(st===0){
    const want=PAL[AU.bio];
    if(!AU.mel)musNewPal(barN);
    else if(AU.trans){AU.trans=0;musNewPal(barN);if(AU.tier>=0)crash(t,.13);}
    else if(AU.pal!==want){if(S.tier>=0){AU.trans=1;swell(t,STEP*16,.09,false);}else musNewPal(barN);}
    const prev=AU.tier;
    if(S.tier<0)AU.tier=S.tier;
    else if(S.tier>AU.tier){AU.tier=S.tier;AU.tierT=0;if(prev>=0&&S.tier>=2&&!AU.trans)crash(t,.12);}
    else if(S.tier<AU.tier){if(++AU.tierT>=2||AU.tier<0){AU.tier=S.tier;AU.tierT=0;}}else AU.tierT=0;
  }
  const T=AU.tier,rel=barN-(AU.bb||0),P=AU.pal,TR=AU.trans;
  /* sections : combat sur 32 mesures (A, A', B, respiration, montée), exploration sur 16 (A, B) */
  const pb=T>=1?rel%32:rel%16,sec=T>=1?(pb<8?0:pb<16?1:pb<24?2:pb<28?3:4):(pb<8?0:2),brk=sec===3||TR;
  if(st%4===0)musMix(S,t,brk);
  const prog=sec===2?[P.prog[2],P.prog[3],P.prog[0],P.prog[1]]:P.prog,bar=rel%4,k=P.key,ch=prog[bar].map(n=>n+k),root=ch[0],nxt=prog[(bar+1)%4][0]+k,vel=.8+Math.random()*.2;
  const sw=(P.dr==='break'&&st%2===1)?STEP*.14:0,ts=t+sw;
  if(st===0&&!TR)iPad(t,ch,STEP*16,P.cut*(T>=2?1.4:1)*(brk?.6:1));
  if(sec===4&&st===0&&pb===30)swell(t,STEP*32,.12,true);
  if(TR){if(st===0)dKick(t,.4);if(st>=8&&st%2===0)dTom(t,260-(st-8)*18,.22);}
  else if(T>=0){
    /* basse, avec une note de passage vers l'accord suivant */
    if(brk){if(st===0)iBass(t,root,STEP*14,.7,0);}
    else{const bp=T===0?[0]:T===1?[0,6,8,14]:[0,3,6,8,11,14];
      if(bp.includes(st)){const oct=(T>=2&&st===6)?12:0;iBass(t,root+oct,T===0?STEP*14:STEP*1.8,T===0?.75:1,T/4);}
      if(T>=1&&st===15&&nxt!==root)iBass(t,nxt+(nxt>root?-1:1),STEP*.9,.7,T/3);
      if(T>=3&&st===7)iBass(t,root+7,STEP,.8,.8);}
    /* batterie */
    const D=P.dr;
    if(brk){if(st===0)dKick(t,.4);if(st%4===2)dHat(ts,.04,false);}
    else if(T===0){if(st===0&&bar%2===0)dKick(t,.35);if(st===8)dHat(ts,.025,false);}
    else if(S.duel){if(st===0||st===6||st===10)dTom(t,st===10?120:90,.5);if(st===0||st===8)dKick(t,.8);if(st===4||st===12)dClap(t,.18);if(st%2===0)dHat(t,.035*vel);}
    else if(D==='four'){if(T>=1&&st%4===0)dKick(t,.9);if(T===0&&(st===0||st===8))dKick(t,.55);if(T>=1&&(st===4||st===12))dClap(t,.2);if(st%4===2)dHat(ts,T?.07:.04,true);}
    else if(D==='break'){if(st===0||st===10||(T>=2&&st===7))dKick(t,T?.85:.5);if(T>=1&&(st===4||st===12))dSnare(t,.22);if(T>=2&&(st===14||st===9))dSnare(t,.06);if(st%4===2)dHat(ts,.05*vel);}
    else{if(st===0||(T>=1&&st===8)||(T>=2&&st===10))dKick(t,T?.8:.45);if(T>=1&&(st===4||st===12))dSnare(t,T>=2?.2:.12);if(st%4===2)dHat(ts,.04*vel);}
    if(sec===4&&!brk){if(pb===31){if(st%2===0)dSnare(t,.05+.012*st);}else if(pb===30&&st%4===0)dSnare(t,.08);}
    if(T>=3&&!brk){if(bar===3&&st>=12)dTom(t,220-(st-12)*30,.3);if(rel%8===0&&st===0)dHat(t,.1,true);}
    if(S.low&&(st===0||st===3))dKick(t,.35);
  }
  /* arpège */
  const aStep=T===-2?8:T<=0?4:2;
  if(!TR&&st%aStep===0){const seq=[0,1,2,3,2,1],n=ch[seq[(st/aStep)%seq.length]%ch.length]+((st>>3)%2?12:0),p=((st%8)-3.5)/5;
    if(P.arp==='bell'||T===-2)iBell(ts,n,.07*(T>=2?1:.8),AU.st.arp,p);else iPluck(ts,n,.05,AU.st.arp,p,P.cut*.8);}
  /* mélodie : thème, variation à l'octave, pont transformé ; silencieuse pendant les respirations */
  if(!brk&&(T>=1||T===-1||(T===0&&pb%8>=2&&pb%8<6))){const M=sec===2?AU.mel2:AU.mel,i=bar*16+st,m=M[i];
    if(m>=0){let len=1;while(len<10&&M[(i+len)%64]===-1)len++;iLead(t,ch[m%3]+(m>=3?12:0)+(T>=3?12:0)+(sec===1&&st>=8?12:0),STEP*len*.95,.06,P.lead);}}
  /* contemplation : quelques cloches, espacées */
  if(T===-2&&st===8&&Math.random()<.5)iBell(t,ch[Math.floor(Math.random()*3)]+12,.07,AU.st.lead,(Math.random()-.5)*.8);
}
