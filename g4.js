/* =========================================================
   ENTRÉES, INTERFACE, BOUCLE
   ========================================================= */
const COARSE=typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches;
const inp={keys:{},L:null,R:null,touch:COARSE,mx:0,my:0,mdown:false,mt:-1e9};
function readInput(){
  if(!G||!G.p)return;
  let x=0,y=0;const k=inp.keys;
  if(k.KeyA||k.ArrowLeft)x--;if(k.KeyD||k.ArrowRight)x++;if(k.KeyW||k.ArrowUp)y--;if(k.KeyS||k.ArrowDown)y++;
  const l=Math.hypot(x,y);if(l){x/=l;y/=l;}
  const L=inp.L;
  if(L){let dx=L.x-L.ox,dy=L.y-L.oy;const d=Math.hypot(dx,dy),m=60;if(d>m){L.ox=L.x-dx/d*m;L.oy=L.y-dy/d*m;dx=dx/d*m;dy=dy/d*m;}if(d/m>.12){x=dx/m;y=dy/m;}}
  G.inX=x;G.inY=y;G.aimMan=false;
  const Rs=inp.R;
  if(Rs){const dx=Rs.x-Rs.ox,dy=Rs.y-Rs.oy;if(Math.hypot(dx,dy)>12){G.aimMan=true;G.aimA=Math.atan2(dy,dx);}}
  else if(!inp.touch&&(inp.mdown||performance.now()-inp.mt<1500)){const s=w2s(G.p.x,G.p.y);G.aimMan=true;G.aimA=Math.atan2(inp.my-s[1],inp.mx-s[0]);}
}
/* boutons tactiles, dans l'espace du HUD (zones réservées déduites) */
function hudHit(x,y,fn){const w0=W,h0=H;W-=SAFE.l+SAFE.r;H-=SAFE.t+SAFE.b;try{return fn(x-SAFE.l,y-SAFE.t);}finally{W=w0;H=h0;}}
function touchBtnAt(x,y){const d=dashBtn();if(Math.hypot(x-d.x,y-d.y)<d.r+10)return 'dash';if(G.p&&G.p.sk){const S=gcSlots();for(let i=0;i<3;i++)if(Math.hypot(x-S[i].x,y-S[i].y)<S[i].r+10)return i===2?'ult':i;}return null;}
let CVR=null;function localXY(e){const r=CVR||(CVR=cv.getBoundingClientRect());return[e.clientX-r.left,e.clientY-r.top];}
function onDown(e){
  auInit();const [x,y]=localXY(e);
  if(e.pointerType==='mouse'){inp.mx=x;inp.my=y;inp.mt=performance.now();if(e.button===2){if(G&&G.state==='play')gcUse(0);return;}inp.mdown=true;return;}
  inp.touch=true;e.preventDefault();
  if(!G||G.state!=='play')return;
  const hb=hudHit(x,y,touchBtnAt);
  if(hb!==null&&!inp.B){inp.B={id:e.pointerId,b:hb,x0:x,y0:y};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(x<W*.5&&!inp.L)inp.L={id:e.pointerId,ox:x,oy:y,x,y};
  else if(!inp.R)inp.R={id:e.pointerId,ox:x,oy:y,x,y};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
}
function onMove(e){
  const [x,y]=localXY(e);
  if(e.pointerType==='mouse'){inp.mx=x;inp.my=y;inp.mt=performance.now();return;}
  if(inp.B&&inp.B.id===e.pointerId){if(Math.hypot(x-inp.B.x0,y-inp.B.y0)>18){if(!inp.R)inp.R={id:e.pointerId,ox:inp.B.x0,oy:inp.B.y0,x,y};inp.B=null;}return;}
  for(const s of [inp.L,inp.R])if(s&&s.id===e.pointerId){s.x=x;s.y=y;}
}
function onUp(e){
  if(e.pointerType==='mouse'){inp.mdown=false;return;}
  if(inp.B&&inp.B.id===e.pointerId){const b=inp.B.b;inp.B=null;if(b==='dash')tryDash();else if(b==='ult')gcUlt();else gcUse(b);return;}
  if(inp.L&&inp.L.id===e.pointerId)inp.L=null;
  if(inp.R&&inp.R.id===e.pointerId)inp.R=null;
}
function onKey(e){
  const inGame=G&&G.state==='play';
  if((inGame||G&&G.state==='evo')&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  inp.keys[e.code]=true;auInit();
  if(e.code==='KeyM'){setMute(!meta.mute);updMuteBtn();return;}
  if(!G)return;
  if(G.state==='duel'){const d=/^(?:Digit|Numpad)([1-9])$/.exec(e.code),a=d&&DU?DU.keys[+d[1]-1]:null;if(a)duelAct(a);else if(e.code==='Enter')duelEndTurn();return;}
  if(G.state==='evo'){if(e.code==='Digit1'||e.code==='Numpad1')pickEvo(0);else if(e.code==='Digit2'||e.code==='Numpad2')pickEvo(1);else if(e.code==='Digit3'||e.code==='Numpad3')pickEvo(2);else if(e.code==='KeyR')reroll();return;}
  if(inGame&&(e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight'))tryDash();
  if(inGame&&!e.repeat){if(e.code==='KeyQ')gcUse(0);else if(e.code==='KeyE')gcUse(1);else if(e.code==='KeyR')gcUlt();else if(e.code==='KeyF')gxInteract();}
  if(e.code==='Escape'||e.code==='KeyP')togglePause();
}

/* ---------- écrans ---------- */
const IN_GAME=['play','dying','victory','evo','pause','duel'];
function flashFade(col,ms){const f=$('fade');if(!f||REDUCED)return;f.style.background=col;f.style.setProperty('--d',(ms||800)+'ms');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}
function show(id){
  document.querySelectorAll('.ov').forEach(o=>o.classList.toggle('on',o.id===id));
  if(id){const p=$('prompt');if(p)p.hidden=true;if(G&&G.gx){G.gx.pk='';G.gx.prompt=null;}}
  document.body.classList.toggle('ingame',!!(G&&IN_GAME.includes(G.state)));
  const el=id&&$(id);if(el){const f=el.querySelector('button:not([disabled]):not([hidden])');if(f&&!COARSE)f.focus({preventScroll:true});}
}
function updMuteBtn(){const b=$('bMute');b.textContent=meta.mute?'🔇':'🔊';b.setAttribute('aria-label',meta.mute?'Activer le son':'Couper le son');}
function todayKey(){const d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
function renderMenu(){
  $('mStats').innerHTML=
    
    '<div class="pill"><b>'+(meta.runs+1)+'</b><span>niveau de menace</span></div>'+
    '<div class="pill"><b>'+artCount()+'</b><span>reliques</span></div>'+
    (meta.best?'<div class="pill"><b>'+fmt(meta.best)+'</b><span>record</span></div>':'');
  const dk=meta.daily[String(todayKey())];
  $('bDaily').textContent=dk?'Défi du jour ('+fmt(dk)+')':'Défi du jour';
  gsMenu();
  $('mHint').textContent=COARSE?'Pouce gauche pour bouger, pouce droit pour viser. Le tir est automatique.':'ZQSD pour bouger, souris pour viser, Espace : dash, A ou clic droit : compétence, E : 2e compétence, R : ultime.';
}
function renderProf(){
  const bars=(v)=>'<i style="--v:'+Math.round(clamp(v,0,1)*100)+'%"></i>';
  $('profCards').innerHTML=Object.keys(PROF).map((k,i)=>{const p=PROF[k];
    const ok=shipOK(k);
    return '<button class="card prof'+(ok?'':' locked')+'" data-p="'+k+'" style="--c:'+p.col+'"><span class="key">'+(i+1)+'</span><span class="ic">'+(ok?p.ic:'🔒')+'</span><span class="nm">'+p.n+'</span><span class="ds">'+(ok?p.d:(p.cost?p.cost+' ◇ au Sanctuaire':'Débloqué par le récit'))+'</span>'+
    '<span class="bars"><span>Vitesse</span>'+bars(p.spd/4.2)+'<span>Puissance</span>'+bars(p.dmg*p.rate/1.2)+'<span>Robustesse</span>'+bars((p.bub/16)/(p.armor*1.4))+'</span></button>';}).join('');
}
const ROMAN=['','I','II','III','IV','V'];
function renderEvo(){
  const P=G.p;
  if(G.evoAlt){$('evoT').textContent=G.evoAlt[0];$('evoS').textContent=G.evoAlt[1];}else{
  $('evoT').textContent=G.evoMut?'Mutation':'Évolution';
  $('evoS').textContent=G.evoLv===0?'Récompense du cœur : choisis ta voie':G.evoMut?'Niveau '+G.evoLv+' : ta forme change pour de bon':'Niveau '+G.evoLv+' : choisis ta voie';}
  $('evoCards').innerHTML=G.choices.map((ch,i)=>{const cur=ch.mut?0:(P.evo[ch.u.id]||0);
    return '<button class="card'+(ch.mut?' mut':'')+'" data-i="'+i+'"><span class="key">'+(i+1)+'</span><span class="ic">'+ch.u.ic+'</span><span class="cat">'+(ch.mut?'Mutation':ch.u.c)+'</span><span class="nm">'+ch.u.n+(cur>0?' '+ROMAN[cur+1]:'')+'</span><span class="ds">'+ch.u.d+'</span></button>';}).join('');
  const rb=$('bReroll');rb.hidden=!(P.rerolls>0)||!!G.evoAlt;rb.textContent='Relancer ('+P.rerolls+')';
}
function pickEvo(i){
  if(!G||G.state!=='evo')return;const ch=G.choices[i];if(!ch)return;
  applyChoice(ch);G.state='play';show(null);SFX.evo();G.glitch=Math.max(G.glitch,12);
  const P=G.p,c=ch.mut?COL.gd:COL.cy;ftext(P.x,P.y-P.r-22,ch.u.n,c,19);ringFX(P.x,P.y,P.r,P.r*4,c,24,4);sparks(P.x,P.y,c,20,5);
  if(G.pendingEvo.length)G.evoDelay=12;
}
function reroll(){if(!G||G.state!=='evo'||G.p.rerolls<=0||G.evoAlt)return;G.p.rerolls--;G.choices=rollChoices(G.evoMut);renderEvo();SFX.ui();}
function buildSummary(){
  const P=G.p,parts=[];
  for(const id of P.muts){const m=MUT.find(x=>x.id===id);parts.push('<span class="chip mut">'+m.ic+' '+m.n+'</span>');}
  for(const u of UPG){const n=P.evo[u.id];if(n)parts.push('<span class="chip">'+u.ic+' '+u.n+(n>1?' '+ROMAN[n]:'')+'</span>');}
  return parts.length?parts.join(''):'<span class="muted">Aucune évolution pour l\'instant.</span>';
}
function togglePause(){
  if(!G)return;
  if(G.state==='play'){G.state='pause';$('pauseBuild').innerHTML=buildSummary();$('pauseInfo').textContent=BIO[G.biome].n+', cœurs '+G.heartsDone+' sur 3, niveau '+G.p.lvl+', '+mmss(G.time);$('pauseJournal').innerHTML=gxJournal();show('ov-pause');}
  else if(G.state==='pause'){G.state='play';show(null);}
}
function showEnd(){
  if(!G||G.state!=='end')return;
  if(gsEndingGate())return;
  const P=G.p;
  const t=$('endT');t.textContent=G.win?'Noyau brisé':'Éclaté';t.className='endt '+(G.win?'win':'lose');
  $('endS').textContent=(G.win?'Victoire en '+mmss(G.time):'Éclaté après '+mmss(G.time)+', '+G.heartsDone+' cœur'+(G.heartsDone>1?'s':'')+' sur 3')+(G.daily?', défi du jour':'');
  $('endStats').innerHTML=
    '<div class="st big"><span class="l">Score</span><span class="v">'+fmt(G.score)+'</span>'+(G.newBest?'<span class="rec">Nouveau record</span>':'')+'</div>'+
    '<div class="st"><span class="l">Niveau max</span><span class="v">'+P.maxLvl+'</span></div>'+
    '<div class="st"><span class="l">Absorptions</span><span class="v">'+G.kills+'</span></div>'+
    '<div class="st"><span class="l">Combo max</span><span class="v">×'+G.maxCombo+'</span></div>';
  $('endBuild').innerHTML=buildSummary();$('endGs').innerHTML=gsEndBox()+giEndBox();
  let ach='';
  for(const id of G.newAch){const a=ACH.find(x=>x.id===id);ach+='<div class="achrow">★ '+a.n+' <span class="muted">'+a.d+'</span></div>';}
  for(const k of G.freeArts)ach+='<div class="achrow gold">Relique offerte : '+ARTS[k].ic+' '+ARTS[k].n+'</div>';
  $('endAch').innerHTML=ach;$('endAch').hidden=!ach;
  const wrap=$('endArts');
  if(G.artChoices.length){
    $('endArtsL').textContent='Choisis une relique. Elle te suivra dans toutes tes prochaines parties.';
    wrap.innerHTML=G.artChoices.map(k=>{const a=ARTS[k],n=meta.arts[k]||0;return '<button class="card relic" data-k="'+k+'"><span class="ic">'+a.ic+'</span><span class="nm">'+a.n+(n?' '+ROMAN[Math.min(5,n+1)]||'':'')+'</span><span class="ds">'+a.d+'</span></button>';}).join('');
    setEndBtns(false);
  }else{
    $('endArtsL').textContent=G.daily?'Le défi du jour se joue sans reliques, à armes égales.':'Détruis un cœur de zone ou survis 2 minutes pour gagner une relique.';
    wrap.innerHTML='';setEndBtns(true);
  }
  show('ov-end');
}
function setEndBtns(on){$('bAgain').disabled=!on;$('bMenu').disabled=!on;}
function pickArt(k,btn){
  if(!G||G.artPicked)return;G.artPicked=true;
  meta.arts[k]=(meta.arts[k]||0)+1;saveMeta();SFX.evo();
  document.querySelectorAll('#endArts .card').forEach(b=>{b.disabled=true;b.classList.toggle('chosen',b===btn);});
  setEndBtns(true);$('bAgain').focus({preventScroll:true});
}
function renderArts(){
  const owned=Object.keys(ARTS).filter(k=>meta.arts[k]);
  $('artsList').innerHTML=owned.length?owned.map(k=>{const a=ARTS[k];return '<div class="relrow"><span class="ic">'+a.ic+'</span><span><b>'+a.n+' ×'+meta.arts[k]+'</b><br><span class="muted">'+a.d+' (max '+a.max+')</span></span></div>';}).join(''):'<p class="muted">Tu n\'as encore aucune relique. Atteins la salle 3 pour en gagner une.</p>';
  $('achList').innerHTML=ACH.map(a=>'<div class="relrow'+(meta.ach[a.id]?'':' locked')+'"><span class="ic">'+(meta.ach[a.id]?'★':'☆')+'</span><span><b>'+a.n+'</b><br><span class="muted">'+a.d+'</span></span></div>').join('');
  $('achCount').textContent=Object.keys(meta.ach).length+' sur '+ACH.length+'. Chaque succès offre une relique.';
  const rb=$('bReset');rb.dataset.c='';rb.textContent='Effacer la progression';
}
function renderLB(){
  const rows=meta.lb.map((e,i)=>'<tr><td>'+(i+1)+'</td><td class="num">'+fmt(e.s)+'</td><td>'+(e.w?'Victoire':e.r+' cœur'+(e.r>1?'s':''))+'</td><td>Niv. '+e.l+'</td><td>'+(PROF[e.p]?PROF[e.p].n:'')+(e.d?' (jour)':'')+'</td></tr>').join('');
  $('lbBody').innerHTML=rows||'<tr><td colspan="5" class="muted">Aucune partie terminée. Lance-toi.</td></tr>';
}

/* ---------- boucle ---------- */
let last=0,acc=0,FPSV=0,fpsN=0,fpsT=0,slowT=0;const STEPMS=1000/60,DTH=[];
/* Qualité. Ancienne méthode : baisse de résolution dès que le temps moyen dépassait 1,22× le meilleur
   temps récent -> se déclenchait sur une simple gigue de vsync, même sur une machine capable.
   Nouvelle méthode : on compare la médiane au rafraîchissement réel de l'écran, sur 3 s, et on retire
   d'abord des effets ; la résolution ne baisse qu'en dernier recours, une seule fois. */
const QPRE={high:[3,1],mid:[2,1],low:[1,.8]};
/* En mode auto, la qualité APPRISE survit d'une partie a l'autre (meta.qAuto, donc aussi d'un
   chargement a l'autre). La remettre au maximum a chaque startGame condamnait chaque debut de
   partie a resaccader le temps que perf() redescende les crans un par un. */
function applyQuality(){const q=meta.q||'auto';
  if(q==='auto'){const a=meta.qAuto;if(a&&a.length===2){QL=a[0];RES=a[1];}else{QL=3;RES=1;}}
  else{QL=QPRE[q][0];RES=QPRE[q][1];}
  applyRes();}
let REFDT=0;
function perf(dt){
  fpsN++;fpsT+=dt;if(fpsT>=500){FPSV=Math.round(fpsN*1000/fpsT);fpsN=0;fpsT=0;}
  /* fenetre de 120 images (2 s a 60 Hz) au lieu de 180 : l'echantillon revient plus vite, donc
     l'adaptation converge plus vite, sans baisser la robustesse de la mediane. */
  DTH.push(dt);if(DTH.length>120)DTH.shift();if(DTH.length<120||fpsN%15)return;
  const so=DTH.slice().sort((a,b)=>a-b),med=so[60];
  if(!G||G.state!=='play'){REFDT=REFDT?Math.min(REFDT,med):med;slowT=0;return;}
  if(!REFDT)REFDT=Math.min(med,16.8);
  if((meta.q||'auto')!=='auto')return;
  /* seuil a 60 (4 echantillons, ~1 s) contre 180 (~3 s) avant : moins de temps perdu en saccade ;
     le seuil de detection monte a 1,35x pour ne pas declencher sur une simple gigue de vsync. */
  if(med>REFDT*1.35){if((slowT+=15)>60){slowT=0;DTH.length=0;
    if(QL>1){QL--;if(G)toast('Effets allégés pour garder la fluidité');}
    else if(RES>.8){RES=.8;applyRes();if(G)toast('Résolution réduite pour garder la fluidité');}
    meta.qAuto=[QL,RES];saveMeta();}}
  else slowT=Math.max(0,slowT-30);
}
let FRN=0;
function frame(ts){
  requestAnimationFrame(frame);
  const t0=performance.now();BKMS=0;
  if(!last)last=ts;let dt=ts-last;last=ts;if(dt>100)dt=100;
  perf(dt);FDT=dt;
  let A=1;
  if(G&&(G.state==='play'||G.state==='dying'||G.state==='victory')){
    acc+=dt*G.timeScale;let n=0;while(acc>=STEPMS&&n<5){step();acc-=STEPMS;n++;}if(n>=5)acc=0;
    if(G&&(G.state==='play'||G.state==='dying'||G.state==='victory'))A=clamp(acc/STEPMS,0,1);
  }
  if(REDUCED&&G){G.trauma*=.5;G.glitch=Math.min(G.glitch,2);}
  const bgOnly=!G||['pause','duel','end','evo'].includes(G.state);FRN=(FRN+1)%4;
  if(!bgOnly||FRN%(G&&G.state!=='evo'?4:2)===0||!G&&FRN%2===0)render(A,dt);
  /* travail JS réel de cette image, hors cuisson : la mesure dont bakeBudget() part à l'image suivante */
  FWK=performance.now()-t0-BKMS;
}
function startGame(prof,daily){
  if(!shipOK(prof)){SAN_TAB='ships';renderSanct();show('ov-sanct');return;}
  if(storyGate(()=>startGame(prof,daily)))return;
  applyQuality();DTH.length=0;slowT=0;meta.lastProf=prof;saveMeta();cv.classList.remove('dying');newRun(prof,daily);flashFade('#05030c',900);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;show(null);}
function boot(){
  resize();addEventListener('resize',()=>{CVR=null;resize();});
  cv.addEventListener('pointerdown',onDown,{passive:false});cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointermove',onMove,{passive:true});
  cv.addEventListener('pointerup',onUp);cv.addEventListener('pointercancel',e=>{if(inp.B&&inp.B.id===e.pointerId)inp.B=null;onUp(e);});
  addEventListener('keydown',onKey);
  addEventListener('keyup',e=>{inp.keys[e.code]=false;if(G&&G.state==='evo'&&e.code==='Space')e.preventDefault();});
  addEventListener('blur',()=>{inp.keys={};inp.L=inp.R=null;inp.mdown=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G&&G.state==='play')togglePause();});
  $('bPlay').onclick=()=>{auInit();SFX.ui();renderProf();show('ov-prof');};
  $('bDaily').onclick=()=>{auInit();startGame('bal',true);};
  $('bArts').onclick=()=>{SFX.ui();renderArts();show('ov-arts');};gsBindUI();giBindUI();gxBindUI();
  $('bLb').onclick=()=>{SFX.ui();renderLB();show('ov-lb');};
  document.querySelectorAll('.back').forEach(b=>b.onclick=()=>{SFX.ui();renderMenu();show('ov-menu');});
  $('profCards').onclick=e=>{const b=e.target.closest('[data-p]');if(b)startGame(b.dataset.p,false);};
  $('ov-prof').addEventListener('keydown',e=>{const i=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'].indexOf(e.code);if(i>=0)startGame(Object.keys(PROF)[i],false);});
  $('evoCards').onclick=e=>{const b=e.target.closest('[data-i]');if(b)pickEvo(+b.dataset.i);};
  $('bReroll').onclick=reroll;
  $('endArts').onclick=e=>{const b=e.target.closest('[data-k]');if(b)pickArt(b.dataset.k,b);};
  $('bAgain').onclick=()=>{if(G.daily)startGame('bal',true);else startGame(G.prof,false);};
  $('bMenu').onclick=()=>{G=null;setMusic(0);renderMenu();show('ov-menu');};
  $('bPause').onclick=()=>togglePause();
  $('bResume').onclick=()=>togglePause();
  $('bQuit').onclick=()=>{if(G&&G.state==='pause'){show(null);endRun(false);}};
  $('bMute').onclick=()=>{auInit();setMute(!meta.mute);updMuteBtn();};
  $('bReset').onclick=function(){if(this.dataset.c){meta={runs:0,wins:0,arts:{},ach:{},best:0,lb:[],daily:{},mute:meta.mute,kills:0,seenHelp:false};gsMetaInit();giMetaInit();saveMeta();renderArts();renderMenu();}else{this.dataset.c='1';this.textContent='Confirmer l\'effacement';}};
  const fb=document.createElement('button');fb.className='btn ghost';fb.id='bFps';const ufb=()=>fb.textContent='Compteur d’images : '+(meta.fps?'oui':'non');ufb();
  fb.onclick=()=>{meta.fps=!meta.fps;saveMeta();ufb();SFX.ui();};const lbb=$('bLb');if(lbb.after)lbb.after(fb);
  const qb=document.createElement('button');qb.className='btn ghost';qb.id='bQual';const QN={auto:'Auto',high:'Haute',mid:'Équilibrée',low:'Performance'},QO=['auto','high','mid','low'];
  const uqb=()=>qb.textContent='Qualité : '+QN[meta.q||'auto'];uqb();
  qb.onclick=()=>{meta.q=QO[(QO.indexOf(meta.q||'auto')+1)%4];saveMeta();applyQuality();uqb();SFX.ui();};if(fb.after)fb.after(qb);applyQuality();
  genWorld((Math.random()*4294967295)>>>0);
  updMuteBtn();renderMenu();show('ov-menu');
  requestAnimationFrame(frame);
}
if(!SIMF())boot();
