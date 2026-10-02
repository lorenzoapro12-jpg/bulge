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
/* préfixe bulge3_ : la refonte en îlots repart d'une sauvegarde neuve (rien ne se garde d'une partie à l'autre, sauf les records et les réglages) */
const store={
  get(k,d){try{const v=localStorage.getItem('bulge3_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('bulge3_'+k,JSON.stringify(v));}catch(e){}}
};
const META0=()=>({runs:0,wins:0,best:0,bestIsl:0,lb:[],mute:false,kills:0,eats:0,seenHelp:false});
/* une sauvegarde abîmée (ou d'une autre version) ne doit jamais casser le menu : on ne garde que des champs du bon type */
let meta=(()=>{const m=META0(),s=store.get('meta',{});if(s&&typeof s==='object')for(const k in m)if(s[k]!=null&&typeof s[k]===typeof m[k]&&Array.isArray(s[k])===Array.isArray(m[k]))m[k]=s[k];
  for(const k of ['fps','q','qAuto'])if(s&&s[k]!=null)m[k]=s[k];m.lb=m.lb.filter(e=>e&&typeof e.s==='number');return m;})();
function saveMeta(){store.set('meta',meta);}

/* ---------- données ---------- */
/* Ennemis : un type par îlot (isl), une forme = un comportement (dessin : g3.js drawEnemy).
   r = rayon à l'îlot d'arrivée. Chaque îlot plus loin, le type paraît 1,4× plus petit (g2.js mkEnemy) :
   à 2 îlots d'écart il devient une PROIE (pâle, inoffensif, il fuit), à 4 il quitte le jeu.
   Couleurs RÉSERVÉES aux ennemis : rouge, magenta, orange ; jamais cyan (toi) ni vert-jaune (power-ups). */
const ET={
  mite:{n:'Mite',isl:1,r:10,hp:1.6,spd:2.5,col:'#ff2d95',sc:20},
  spike:{n:'Épine',isl:2,r:15,hp:5,spd:1.1,col:'#ff3355',sc:40},
  spread:{n:'Tireur',isl:3,r:16,hp:6,spd:1.15,col:'#ff8a2d',sc:50},
  sniper:{n:'Tireur d\'élite',isl:4,r:13,hp:4.5,spd:1.25,col:'#ff5a36',sc:60},
  orbit:{n:'Orbiteur',isl:5,r:14,hp:6,spd:2.1,col:'#ff4fd8',sc:60},
  gatling:{n:'Gatling',isl:6,r:19,hp:9,spd:.5,col:'#ffa22d',sc:80},
  ring:{n:'Pulsar',isl:7,r:21,hp:10,spd:.6,col:'#ff6a5a',sc:90},
  spawner:{n:'Porteur',isl:8,r:27,hp:16,spd:.5,col:'#e040ff',sc:120},
};
const ETL=['mite','spike','spread','sniper','orbit','gatling','ring','spawner'];

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
    musInit(ac);AU.next=ac.currentTime+.35;setInterval(musTick,25);
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
  absorb(){if(!can('ab',45))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',260,780,t,.12,.07);osc(AU.sfx,'triangle',520,1560,t+.03,.08,.02);},
  gonfle(){if(!can('go',400))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',70,240,t,.7,.2,.08);osc(AU.sfx,'sawtooth',110,330,t,.6,.05,.1);nz(AU.sfx,t,.7,.08,'bandpass',600,.6);},
  burst(){if(!can('bu',200))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',180,30,t,.7,.25);nz(AU.sfx,t,.6,.2,'lowpass',1400);osc(AU.sfx,'triangle',1400,200,t,.25,.05);},
  power(){if(!can('pw',120))return;const t=AU.ac.currentTime;[0,7,12,19].forEach((s,k)=>osc(AU.sfx,'triangle',440*Math.pow(2,s/12),0,t+k*.05,.18,.05));},
  wave(){if(!can('wv',500))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',110,110,t,.5,.06,.05);osc(AU.sfx,'square',165,165,t+.12,.45,.04,.05);nz(AU.sfx,t,.4,.04,'bandpass',900,1);},
  grow(){if(!can('gr',1000))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',55,440,t,2.4,.18,.6);osc(AU.sfx,'triangle',110,880,t+.2,2.2,.05,.6);swell(t,2.5,.1,true);},
  shield(){if(!can('sd',150))return;const t=AU.ac.currentTime;osc(AU.sfx,'square',900,300,t,.18,.05);nz(AU.sfx,t,.2,.08,'highpass',3000);},
  brk(){if(!can('bk',60))return;const t=AU.ac.currentTime;nz(AU.sfx,t,.22,.16,'lowpass',900);osc(AU.sfx,'triangle',240,80,t,.16,.06);},
  seg(){if(!can('sg',200))return;const t=AU.ac.currentTime;[0,4,7,12].forEach((s,k)=>osc(AU.sfx,'sine',523*Math.pow(2,s/12),0,t+k*.07,.3,.05));},
  warn(){if(!can('wn',160))return;const t=AU.ac.currentTime;osc(AU.sfx,'sine',880,880,t,.12,.03);osc(AU.sfx,'sine',880,880,t+.16,.12,.03);},
  beam(){if(!can('bm',200))return;const t=AU.ac.currentTime;osc(AU.sfx,'sawtooth',90,60,t,.5,.1);nz(AU.sfx,t,.5,.12,'bandpass',2400,2);},
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
  /* une nappe d'ambiance par type (AMB), toutes nourries par le même bruit : leur dosage suit biomeMix, pas AU.pal */
  const src=ac.createBufferSource();src.buffer=AU.nb;src.loop=true;AU.ambL={};
  for(const k in AMB){const a=AMB[k],f=ac.createBiquadFilter(),g=ac.createGain();f.type=a[0];f.frequency.value=a[1];f.Q.value=a[2];g.gain.value=k==='wind'?a[3]:0;src.connect(f);f.connect(g);g.connect(AU.st.amb);AU.ambL[k]=g;}
  src.start();
  AU.bio='plains';AU.pal=PAL.plains;AU.bm=null;AU.tier=0;AU.tierT=0;AU.mel=null;AU.layer=AU.layer||0;
}
/* Fondu sonore des frontières. Le poids audio d'un biome EST son poids dans biomeMix(P.x,P.y) (gw.js) : AU.bm est
   la valeur renvoyée telle quelle, relevée une fois par temps (musMix, tous les 4 pas = 0,48 s, ~2 Hz) — assez
   pour un fondu de ~260 px lissé par setTargetAtTime, et un seul parcours des ~30 sites par temps.
   Continu : nappes d'ambiance (AMB) et coupure du filtre (cut, moyenne géométrique). Franc, au basculement de
   G.biome (setBiome -> AU.pal à la mesure) : tonalité, gamme, grille, mélodie, arpège, lead, batterie. */
function musBM(S){AU.bm=(S.tier!==-1&&typeof biomeMix==='function'&&typeof WD!=='undefined'&&WD&&WD.sites)?biomeMix(G.p.x,G.p.y):null;}
function musW(b){const m=AU.bm;if(!m)return PAL[b]===AU.pal?1:0;let w=0;for(const e of m)if(e.b===b)w+=e.w;return w;}
function musCut(){const m=AU.bm;if(!m)return AU.pal.cut;let l=0,n=0;for(const e of m)if(PAL[e.b]){l+=e.w*Math.log(PAL[e.b].cut);n+=e.w;}return n?Math.exp(l/n):AU.pal.cut;}
function setBiome(b){if(PAL[b])AU.bio=b;}
function setMusic(l){AU.layer=l;}
/* ---------- instruments ---------- */
function env(g,t,a,v,dec,sus,end,rel){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.setTargetAtTime(v*sus,t+a,dec);g.gain.setTargetAtTime(0,end,rel);}
/* bus partagés (créés une fois) : évite ~6 nœuds audio par note */
function bus(dest,p,ds,rs){const key=dest.__id+'|'+(Math.round(p*2)/2)+'|'+ds+'|'+rs;AU.buses=AU.buses||{};let b=AU.buses[key];if(b)return b;const ac=AU.ac;
  b=ac.createGain();const pn=ac.createStereoPanner();pn.pan.value=Math.round(p*2)/2;b.connect(pn);pn.connect(dest);
  if(ds){const g=ac.createGain();g.gain.value=ds;pn.connect(g);g.connect(AU.dsend);}if(rs){const g=ac.createGain();g.gain.value=rs;pn.connect(g);g.connect(AU.rsend);}
  return AU.buses[key]=b;}
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
  /* arrivée, choix de bonus, croissance : la respiration entre deux îlots */
  if(st==='trans'||G.ph==='arrive'||G.ph==='clear')return{tier:-2,pause:st==='pick'};
  let tier=0;
  if(G.boss&&!G.boss.dead||G.ph==='preboss')tier=3;
  else{let n=0;for(const e of G.en)if(!e.dead&&!e.prey&&e.spawn<=0)n++;tier=n>=6?2:n>=1?1:0;}
  return{tier,low:P.seg<=1&&P.segMax>1,pause:st==='pause'||st==='pick'};
}
const MIXES=[[.9,.6,.55,.6,.4,.7],[.75,.8,.7,.6,.8,.55],[.65,1,.8,.75,1,.35],[.7,1,.9,.85,1.05,.25]]; /* pad bass arp lead drums amb */
const MIX_MENU=[1,.3,.8,.6,0,.5],MIX_CALM=[1,.15,.7,.5,0,.9];
function musMix(S,t,brk){
  const K=['pad','bass','arp','lead','drums','amb'],m=S.tier===-1?MIX_MENU:S.tier===-2?MIX_CALM:MIXES[Math.max(0,S.tier)];
  K.forEach((k,i)=>AU.st[k].gain.setTargetAtTime(m[i]*(S.dead?.3:1)*(brk&&k==='drums'?.35:1)*(brk&&k==='bass'?.6:1),t,S.tier>AU.tier?.25:1.2));
  let cut=S.dead?350:S.pause?700:S.low?1100:S.tier===-1?6000:S.tier===-2?4200:18000;if(brk)cut=Math.min(cut,2600);if(AU.trans)cut=900;
  AU.mLP.frequency.setTargetAtTime(cut,t,AU.trans?.5:.35);AU.rsend.gain.setTargetAtTime(S.tier===-2?1.7:1,t,1.5);
  musBM(S);const aw={};for(const k in AMB)aw[k]=0;for(const b in PAL)aw[PAL[b].amb]+=musW(b);
  for(const k in AMB)AU.ambL[k].gain.setTargetAtTime(AMB[k][3]*aw[k],t,.35);
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
/* Ordonnanceur musical. La marge (LA) doit etre plus large que le pire blocage du fil principal :
   la cuisson du monde et le rendu peuvent immobiliser le fil plusieurs centaines de millisecondes
   sur un telephone. Avec 200 ms, AU.next passait dans le PASSE et la boucle planifiait des notes
   deja depassees — le moteur audio les jouait entassees ou les jetait : c'est le crachat entendu.
   Et si le retard se produit malgre la marge, on se resynchronise au lieu d'empiler. */
/* Marge de planification. Mesure du 28/09/2026 : `setInterval(musTick,25)` est AFFAME par les taches
   consecutives du fil principal — jusqu'a 1 048 ms sans un seul appel — alors qu'aucune tache isolee
   ne depasse 285 ms. Avec 0,6 s de marge, l'ordonnanceur se resynchronisait et on entendait le trou.
   Deux reponses : la marge passe a 0,9 s, et musTick() est aussi appele depuis frame() (g4.js), ce qui
   supprime la famine par construction au lieu de la rattraper. */
const LA=.9;
function musTick(){const ac=AU.ac;if(!ac||!AU.st)return;
  if(AU.next<ac.currentTime)AU.next=ac.currentTime+.05;
  while(AU.next<ac.currentTime+LA){schedStep(AU.step,AU.next);AU.step++;AU.next+=STEP;}}
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
  if(st===0&&!TR)iPad(t,ch,STEP*16,musCut()*(T>=2?1.4:1)*(brk?.6:1));
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
    if(P.arp==='bell'||T===-2)iBell(ts,n,.07*(T>=2?1:.8),AU.st.arp,p);else iPluck(ts,n,.05,AU.st.arp,p,musCut()*.8);}
  /* mélodie : thème, variation à l'octave, pont transformé ; silencieuse pendant les respirations */
  if(!brk&&(T>=1||T===-1||(T===0&&pb%8>=2&&pb%8<6))){const M=sec===2?AU.mel2:AU.mel,i=bar*16+st,m=M[i];
    if(m>=0){let len=1;while(len<10&&M[(i+len)%64]===-1)len++;iLead(t,ch[m%3]+(m>=3?12:0)+(T>=3?12:0)+(sec===1&&st>=8?12:0),STEP*len*.95,.06,P.lead);}}
  /* contemplation : quelques cloches, espacées */
  if(T===-2&&st===8&&Math.random()<.5)iBell(t,ch[Math.floor(Math.random()*3)]+12,.07,AU.st.lead,(Math.random()-.5)*.8);
}
