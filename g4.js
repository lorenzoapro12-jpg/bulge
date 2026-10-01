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
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
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
    wrap.innerHTML=G.artChoices.map(k=>{const a=ARTS[k],n=meta.arts[k]||0;return '<button class="card relic" data-k="'+k+'"><span class="ic">'+a.ic+'</span><span class="nm">'+a.n+artLvl(n,a.max)+'</span><span class="ds">'+a.d+'</span></button>';}).join('');
    setEndBtns(false);
  }else{
    $('endArtsL').textContent=G.daily?'Le défi du jour se joue sans reliques, à armes égales.':'Détruis un cœur de zone ou survis 2 minutes pour gagner une relique.';
    wrap.innerHTML='';setEndBtns(true);
  }
  show('ov-end');
}
/* niveau atteint en prenant la relique (le 1er ne porte pas de numéro, comme les évolutions) ; au maximum, le dire */
function artLvl(n,mx){return n>=mx?' · max atteint':n?' '+ROMAN[n+1]+(n+1===mx?' · max':''):'';}
function setEndBtns(on){$('bAgain').disabled=!on;$('bMenu').disabled=!on;}
function pickArt(k,btn){
  if(!G||G.artPicked)return;G.artPicked=true;
  meta.arts[k]=Math.min(ARTS[k].max,(meta.arts[k]||0)+1);saveMeta();SFX.evo();
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
let last=0,acc=0,FPSV=0,slowT=0,upT=0;const STEPMS=1000/60,DTH=[];
/* ---------- DIAGNOSTIC EMBARQUE (compteur d'images) ----------
   Sert a trancher sur l'APPAREIL REEL, ou aucun banc ne peut aller : le temps de l'image est-il
   du JavaScript, ou de la composition/rasterisation (« hors-JS » = intervalle - JS) ?
   - intervalle ≈ JS + periode d'ecran  -> le goulot est le JavaScript ;
   - intervalle >> JS                   -> le goulot est la peinture, donc proportionnel a PS².
   La marge audio (AU.next - currentTime) dit en plus si l'ordonnanceur musical garde de l'avance.
   Agregats publies une fois par seconde : drawHUD est appele plusieurs fois par seconde et
   lirait sinon des moyennes d'une seule image. */
let DIAG_CJS=0,DIAG_CDT=0,DIAG_N=0,DIAG_T=0,DIAG_MX=0,DIAG_AUM=1e9;
let DIAG_JS=0,DIAG_DT=0,DIAG_PEAK=0,DIAG_MARGIN=-1;
/* ---------- PROFIL EMBARQUE ----------
   Le compteur dit COMBIEN de temps JS par image ; celui-ci dit OU. On enveloppe les postes
   chauds une fois, et le cout est nul tant que le compteur d'images est eteint (une garde en
   tete, pas un accumulateur). Le banc de mesure de l'atelier est un autre processeur que celui
   de Lorenzo : seul ce profil dit ou passent SES millisecondes. */
const JSPROF={};let JSPROF_ON=false,JSPROFTOP=[];
/* ---------- PIRE IMAGE (chantier J0) ----------
   Le profil dit des CUMULS et des pires APPELS sur une seconde : il ne dit pas QUELLE image a derape,
   ni ce qui s'y est passe. Ici on garde, pour l'image dont l'intervalle est le plus long de la fenetre,
   SON JS et SES evenements — une seule et meme image, pas des maxima independants.
   ⚠️ Appariement : `dt` lu par le rappel N vaut ts(N)-ts(N-1) ; le JS qui s'est execute PENDANT cet
   intervalle est celui du rappel N-1 (c'est lui qui, trop long, fait rater le rendez-vous et retarde
   ts(N)). On apparie donc dt(N) avec le rappel N-1, pas avec le rappel N qui ne fait que le constater.
   DIAG_EV : evenements du rappel en cours [genChunk, sprites d'obstacles crees] ; CHNEW (g3.js) : cuissons
   collees pour la premiere fois. DIAG_PV : le rappel precedent [JS, gen, spr, colles, WKN] ; JS<0 = pas
   de precedent mesure (reprise). DIAG_W : pire de la fenetre [dt, JS, gen, spr, recus, colles], publie dans
   DIAG_WORST avec le reste. « recus » = WKN gagne entre les deux rappels : les messages du worker sont des
   taches a part, ils n'arrivent jamais AU MILIEU d'un rappel. Aucun de ces nombres n'entre dans le jeu.
   ---- chantier A4 : attribuer le « hors JS ». Le pic du S22 (pire 75 ms : JS 3.0 ms, reçus 2) se loge HORS de
   frame() ; trois temoins de plus, pour la meme image :
   [6] retard du rappel N-1 = performance.now() a l'entree de frame() moins le ts recu : le temps que le rappel a
       ATTENDU (GC, minuteurs, taches du navigateur passent la). -1 = non mesure ou INVALIDE : il doit tenir dans
       [0, intervalle BRUT] (le rappel N-1 commence avant ts(N)) ; hors de la, les deux horloges ne concordent pas
       et on n'affiche PAS un nombre plausible a la place ;
   [7,8] wkRecv (gw2.js) entre les deux rappels : cumul et pire appel (DIAG_WK, par l'enveloppe de JSPROF_N) ;
       -1 = non mesure (reprise, ou wkRecv pas enveloppee) ;
   [9] intervalle BRUT : [0] est plafonne a 100 ms comme dt, [9] dit ce qu'il valait vraiment.
   DIAG_PV[5] : retard du rappel precedent. Les tâches longues (PerformanceObserver 'longtask') sont a part : le
   navigateur les livre en differe, on garde la pire de la seconde (DIAG_LT -> DIAG_LTP) avec son attribution.
   LT_ST : 0 pas lance, 1 observe, -1 API ABSENTE (supportedEntryTypes sans 'longtask'), -2 observe() a echoue.
   Une API absente s'affiche « absent », jamais « 0 » : un champ muet qui a l'air d'un zero est un mensonge.
   ---- chantier A6 : Chromium attribue toute tâche longue a (self, unknown), meme une boucle de script pure. Les
   Long Animation Frames ('long-animation-frame') DECOUPENT l'image longue ; on garde la pire de la seconde
   (DIAG_LF -> DIAG_LFP) : [0] duree · [1] blockingDuration · [2] script = somme des scripts[].duration moins le
   reflow qu'ils ont force · [3] style/layout = de styleAndLayoutStart a la fin de l'image, PLUS ce reflow force
   (spec W3C : renderStart..styleAndLayoutStart, ce sont les rappels rAF — frame() y vit —, pas du style) ·
   [4] nom du plus long script (sourceFunctionName, sinon invoker ; '' = scripts[] VIDE) · [5] sa duree.
   LF_ST : memes etats que LT_ST. */
const DIAG_EV=[0,0],DIAG_PV=[-1,0,0,0,0,-1],DIAG_W=[0,-1,0,0,0,0,-1,-1,0,0],DIAG_WK=[0,0],DIAG_LT=[0,'',''],DIAG_LF=[0,0,0,0,'',0];let DIAG_WORST=null,DIAG_LTP=null,LT_ST=0,DIAG_LFP=null,LF_ST=0;
function lfStart(){if(LF_ST)return;const P=globalThis.PerformanceObserver,T=P&&P.supportedEntryTypes;
  if(!T||T.indexOf('long-animation-frame')<0){LF_ST=-1;return;}
  try{new P(l=>{for(const e of l.getEntries())if(e.duration>DIAG_LF[0]){let sc=0,fl=0,top=null;
      for(const s of e.scripts||[]){const f=s.forcedStyleAndLayoutDuration||0;sc+=s.duration-f;fl+=f;if(!top||s.duration>top.duration)top=s;}
      DIAG_LF[0]=e.duration;DIAG_LF[1]=e.blockingDuration;DIAG_LF[2]=sc;DIAG_LF[3]=Math.max(0,e.startTime+e.duration-e.styleAndLayoutStart)+fl;
      DIAG_LF[4]=top?top.sourceFunctionName||top.invoker||top.name||'?':'';DIAG_LF[5]=top?top.duration:0;}}).observe({entryTypes:['long-animation-frame']});LF_ST=1;}
  catch(e){LF_ST=-2;}}
function ltStart(){if(LT_ST)return;const P=globalThis.PerformanceObserver,T=P&&P.supportedEntryTypes;
  if(!T||T.indexOf('longtask')<0){LT_ST=-1;return;}
  try{new P(l=>{for(const e of l.getEntries())if(e.duration>DIAG_LT[0]){const a=e.attribution&&e.attribution[0];DIAG_LT[0]=e.duration;DIAG_LT[1]=e.name||'?';DIAG_LT[2]=a&&a.name||'?';}}).observe({entryTypes:['longtask']});LT_ST=1;}
  catch(e){LT_ST=-2;}}
const JSPROF_N=['render','step','streamWorld','bakeStep','genChunk','getChunk','perf',
  'drawChunks','drawLive','drawHUD','gcHUD','gxHUD','gtHUD','drawMinimap',
  'drawEdges','drawObstacles','drawEnemies','drawBoss','drawPlayer','drawBullets',
  'drawFX','drawWeather','drawLabels','drawIndicators','drawTexts','drawShadows',
  'drawTrails','drawPickups','drawObjectives','postFX','lowBegin','lowWorld','lowEnd',
  'lowScreen','drawLowGlows','drawFar','drawVista','drawGround',
  'gcDrawWorld','gsDrawWorld','giDrawWorld','gxDrawWorld','gvDrawWorld',
  'gcDrawUnder','gcDrawOver','gvDrawScreen','soft','softSpr','glow','worldTf','screenTf','wkRecv'];
function jsProfStart(){
  if(JSPROF_ON)return;JSPROF_ON=true;ltStart();lfStart();
  /* wkRecv : w.onmessage=wkRecv (gw2.js, wkOn) lit la globale a la creation du worker, APRES boot() : c'est donc
     cette enveloppe qui recoit les messages. Elle alimente en plus DIAG_WK (l'intervalle en cours). */
  for(const n of JSPROF_N){
    const f=globalThis[n];if(typeof f!=='function')continue;
    JSPROF[n]=[0,0];const gen=n==='genChunk',wk=n==='wkRecv';
    globalThis[n]=function(){if(!meta.fps)return f.apply(this,arguments);
      if(gen)DIAG_EV[0]++;
      const a=performance.now();try{return f.apply(this,arguments);}
      finally{const d=performance.now()-a;const s=JSPROF[n];s[0]+=d;if(d>s[1])s[1]=d;if(wk){DIAG_WK[0]+=d;if(d>DIAG_WK[1])DIAG_WK[1]=d;}}};
  }
  /* obsSprite est appele a CHAQUE image pour chaque obstacle visible (g3.js) et rend alors son cache :
     on ne compte que les CREATIONS (o.spr encore vide), et sans le chronometrer — deux performance.now()
     par obstacle visible fausseraient la mesure qu'on cherche a faire. */
  const os=globalThis.obsSprite;if(typeof os==='function')globalThis.obsSprite=function(o){if(!o.spr)DIAG_EV[1]++;return os(o);};
}
/* Qualité. Ancienne méthode : baisse de résolution dès que le temps moyen dépassait 1,22× le meilleur
   temps récent -> se déclenchait sur une simple gigue de vsync, même sur une machine capable.
   Nouvelle méthode : on compare la médiane au rafraîchissement réel de l'écran, sur 3 s, et on retire
   d'abord des effets ; la résolution ne baisse qu'en dernier recours, une seule fois. */
const QPRE={high:[3,1],mid:[2,1],low:[1,.8]};
/* En mode auto, la qualité APPRISE survit d'une partie à l'autre (meta.qAuto, donc aussi d'un
   chargement à l'autre). La remettre au maximum à chaque startGame condamnait chaque début de
   partie à resaccader le temps que perf() redescende les crans un par un. Elle reste un POINT DE
   DÉPART, jamais un plafond : perf() sait aussi remonter (voir plus bas). */
function applyQuality(){const q=meta.q||'auto';
  if(q==='auto'){const a=meta.qAuto;if(a&&a.length===2){QL=a[0];RES=a[1];}else{QL=3;RES=1;}}
  else{QL=QPRE[q][0];RES=QPRE[q][1];}
  applyRes();}
/* Référence de fluidité = ce que la machine fait RÉELLEMENT en début de partie, pas le meilleur
   temps jamais vu. Un minimum historique ne peut que descendre : sur un écran 90 ou 120 Hz il vaut
   11,1 ou 8,3 ms, et un jeu à 60 ips parfaitement fluide est alors compté comme lent en permanence —
   ce qui rabaissait la qualité jusqu'au plancher sans qu'aucune image ne soit perdue. La référence
   est donc établie sur les 2 premières secondes de jeu, puis FIGÉE pour la partie : écran 120 Hz
   mais machine qui tient 60 ips -> référence 16,7 ms -> rien ne se déclenche. Elle n'est jamais
   mesurée hors du jeu (un menu n'a pas la charge d'une partie) ni héritée de la partie précédente. */
/* ⚠️ Chantier A1 (30/09/2026) : « ref 0.4 ms » sur le S22 du proprietaire, a 65 ips, qualite bloquee au
   plancher. La reference etait le MINIMUM BRUT des medianes : un minimum sur une serie bruitee n'est pas
   une borne, c'est l'extreme du bruit, et il ne remonte jamais. Deux filtres, chacun contre un bruit nomme :
   - DTMIN (4 ms = 250 Hz, au-dela de toute dalle mobile) : un intervalle plus court n'est PAS une image
     mais un rappel rAF en double (rafale, reprise, transition d'etat). Il n'entre ni dans la fenetre ni
     dans aucune decision. C'est le plancher physique ; il elimine l'absurde (0,4 ms).
   - REFM, les 9 dernieres medianes : la reference est le minimum de leur MAXIMUM glissant. 9 evaluations
     a 15 images d'ecart couvrent deux fenetres DISJOINTES de 120 images : une mediane basse n'abaisse la
     reference que si elle a TENU ~2 s. Il elimine la rafale plausible mais breve (8 ms une seconde sur un
     ecran 60 Hz), que le plancher laisse passer. Le minimum reste l'operateur de fond (un jeu lent ne
     redefinit pas sa propre reference), mais il s'applique a une valeur SOUTENUE, pas a un echantillon. */
const DTMIN=4,REFM=[];
let REFDT=0,REFN=0,qn=0,flT=0;
function refReset(){REFDT=0;REFN=0;qn=0;flT=0;slowT=0;upT=0;DTH.length=0;REFM.length=0;}
function perf(dt){
  /* Les ips ne se calculent plus ici. Un compteur de 500 ms qui avancait sur TOUTES les images
     (menu, pause, ecran de fin compris, bien moins cheres) pouvait afficher 84 ips quand le jeu en
     tenait 34 : le chiffre mentait sur l'appareil meme ou l'on cherche a trancher. Ils derivent
     desormais du cumul du diagnostic, dont la fenetre est une seconde de JEU (voir plus bas). */
  /* Hors du jeu (menu, pause, écran de fin), on ne MESURE pas du tout : la fenêtre ne se remplit
     qu'avec des images de jeu. Avant, elle se remplissait au menu et ces durées — bien plus courtes —
     entraient dans la référence, qui décrivait alors autre chose que le jeu. */
  if(!G||G.state!=='play'){refReset();return;}
  /* fenetre de 120 images (2 s a 60 Hz) au lieu de 180 : l'echantillon revient plus vite, donc
     l'adaptation converge plus vite, sans baisser la robustesse de la mediane. L'echantillonnage est
     compte sur les images DE JEU (qn). */
  if(dt<DTMIN)return;   /* rappel en double, pas une image (voir DTMIN) */
  DTH.push(dt);if(DTH.length>120)DTH.shift();
  if(DTH.length<120||(++qn%15))return;
  const so=DTH.slice().sort((a,b)=>a-b),med=so[60],p90=so[108];
  /* Un mode MANUEL est un PLAFOND, pas une sortie de fonction (chantier P2, 30/09/2026). Avant, perf()
     sortait ici des que la qualite n'etait pas « auto » : choisir « Équilibrée » supprimait toute
     adaptation — ni descente quand ca saccade, ni remontee ensuite — et REFDT restait a 0 (« ref 0.0 ms »
     au compteur). Mesure sur le S22 du proprietaire : 46 ips / pire 59 ms et 58 ips / pire 25 ms avec
     le MEME QL 2, PS 1.25. Desormais la descente reste possible sous le cran choisi et la remontee
     s'arrete a ce cran (cap), jamais au-dessus. En auto cap=[3,1] : comportement inchange. Le cran
     appris en manuel n'est PAS persiste (meta.qAuto appartient au mode auto) : applyQuality() repart
     du cran choisi a chaque partie. */
  const man=(meta.q||'auto')!=='auto',cap=man?QPRE[meta.q]:[3,1];
  /* La reference est la PERIODE D'ECRAN. Un minimum et non une moyenne des premieres fenetres — sinon le
     demarrage (chunks a cuire, chargement) fixe la reference vers le haut et le filet ne joue plus. Mais
     le minimum porte sur le maximum glissant REFM, pas sur la mediane brute : deux rappels rAF PEUVENT
     etre separes de moins d'une periode, et un minimum brut garde a vie la pire fenetre (voir DTMIN).
     Tant que REFM n'est pas plein (etablissement, apres chaque refReset), la reference EST ce maximum :
     sinon la premiere fenetre apres une reprise — la plus exposee aux rafales — se figerait seule. */
  REFM.push(med);if(REFM.length>9)REFM.shift();
  const env=Math.max(...REFM);REFDT=REFDT>0&&REFM.length>8?Math.min(REFDT,env):env;
  if(REFN<8){REFN++;return;}   /* ~2 s : etablissement, aucune decision */
  /* ⚠️ Chantier R2 (01/10/2026) : « 60 ips · image 16.6 ms … plafond mid ↓ 1/3 ×0.80 … ref 8.4 ms » sur le S22.
     Le minimum ci-dessus ne fait que DESCENDRE : ~2 s legeres a 8,3 ms (ecran 120 Hz, debut de partie) et 16,6 ms
     passait pour lent jusqu'a la fin de la partie (p90 > 1,35x toujours vrai, mediane < 1,10x jamais vraie).
     La reference REMONTE donc sur une seule preuve : le regulateur a TOUT retire (plancher 1/0.8) et la mediane
     reste >= 1,10x la reference pendant ~20 s d'images (1200). Retirer n'a rien rendu : la periode visee n'est
     pas atteignable par la qualite, elle devient le maximum glissant REFM (la mediane SOUTENUE, pas les pointes).
     Une saccade (mediane 16,7, p90 33,3) ne remplit pas la condition : la descente reste entiere. 20 s et non
     moins : une vraie lenteur doit d'abord etre combattue (descente en ~10 s), pas aussitot acceptee.
     Refuse : estimer la periode sur les images HORS partie (menus). La boucle y tourne bien, mais elle y mesure
     la DALLE — 8,3 ms sur ce S22 — c'est-a-dire precisement la valeur qui l'a verrouille. */
  flT=p90>REFDT*1.35&&med>=REFDT*1.10&&QL<=1&&RES<=.8?flT+15:0;
  if(flT>1200){flT=0;slowT=0;upT=0;REFDT=env;}
  /* Descente rapide (~1 s au-dessus de 1,35x), remontée LENTE et plus exigeante (~5 s sous 1,10x).
     L'asymétrie est voulue : une oscillation entre deux crans saccaderait plus que le défaut, et
     une remontée est indolore (au pire on redescend au cran suivant). Sans elle, la qualité était
     un cliquet : un seul épisode de lenteur la figeait au plancher à vie.

     ⚠️ La DESCENTE se decide sur le p90, pas sur la mediane, et c'est le correctif du 28/09/2026.
     Mesure reelle chez un joueur (PC AMD 1920x1080, Firefox) : ~34 ips des le lancement, `image
     29,4 ms`, soit six images a 16,7 ms et une a 33,3 ms. La MEDIANE vaut alors 16,7 et ne voit
     donc RIEN : le regulateur ne baissait jamais la qualite, meme apres des minutes. Ce qu'on
     cherche a corriger n'est pas « la fluidite typique » mais « la proportion d'images perdues » —
     le p90 (12e valeur sur 120, seuil de ~10 % d'images perdues) est le bon instrument, et la
     mediane y est aveugle par construction. La REMONTEE, elle, reste sur la mediane : on ne remonte
     que si le regime est reellement sain, pas seulement meilleur. */
  if(p90>REFDT*1.35){
    if((slowT+=15)>60){slowT=0;upT=0;DTH.length=0;
      if(QL>1){QL--;applyRes();if(G)toast('Effets allégés pour garder la fluidité');}
      else if(RES>.8){RES=.8;applyRes();if(G)toast('Résolution réduite pour garder la fluidité');}
      else return;
      if(!man){meta.qAuto=[QL,RES];saveMeta();}}
  }else{
    slowT=Math.max(0,slowT-30);
    /* on rétablit d'abord la résolution (la dégradation la plus visible à l'œil), puis les effets */
    if(med<REFDT*1.10){if((upT+=15)>150){upT=0;DTH.length=0;
      if(RES<cap[1]){RES=cap[1];applyRes();if(G)toast('Résolution rétablie');}
      else if(QL<cap[0]){QL++;applyRes();if(G)toast('Effets rétablis');}
      else return;
      if(!man){meta.qAuto=[QL,RES];saveMeta();}}}
    else upT=Math.max(0,upT-30);
  }
}
/* ---------- BUDGET PAR IMAGE ----------
   SKIPD, lu par le rendu : 0 = tout dessiner ; 1 = sauter les postes décoratifs ; 2 = sauter aussi les halos.
   perf() ne règle que QL/RES, donc les PIXELS ; le travail JS n'en dépend pas : ce filet agit sur lui.
   Image « hors budget » (SKBAD) : intervalle réel > 1,4× la période d'écran (au moins un vsync manqué),
   ou travail JS de l'image (FWK+BKMS) > la période à lui seul.
   SKP = période d'écran RÉELLE, enveloppe basse des intervalles : elle descend vite vers un intervalle
   court, et ne remonte (constante ~50 images) que sur des images où le JS n'explique pas la durée (écran
   30 Hz, mode économie) — sinon un jeu lent redéfinirait sa propre référence et le filet ne jouerait jamais.
   Hystérésis : montée d'un cran après 400 ms d'images hors budget (des images saines en effacent la
   moitié de leur durée : un raté isolé ne compte pas) ; descente d'un cran après SKW ms d'images TOUTES
   saines. Si le cran revient moins de 2 s après une descente, la descente était prématurée : SKW double
   (3 s -> 60 s max), et ne revient à 3 s qu'après 30 s saines au cran 0. Sans ce recul, 1 -> 0 -> 1
   battrait toutes les 3 s, puisqu'au cran 1 les images redeviennent justement saines.
   Tourne aussi sans partie (G nul) : ne dépend que de l'horloge. */
let SKIPD=0,SKBAD=false,SKP=1000/60,SKS=0,SKO=0,SKW=3000,SKT=1e9;
function skipCtl(w,dt){
  if(dt<SKP)SKP+=(dt-SKP)*.1;else if(w<dt*.5)SKP+=(Math.min(dt,50)-SKP)*.02;
  SKT+=dt;SKBAD=dt>SKP*1.4||w>SKP;
  if(SKBAD){SKO=0;if((SKS+=dt)>=400&&SKIPD<2){SKIPD++;SKS=0;if(SKT<2000)SKW=Math.min(60000,SKW*2);}}
  else{SKS=Math.max(0,SKS-dt*.5);SKO+=dt;
    if(SKIPD>0){if(SKO>=SKW){SKIPD--;SKO=0;SKT=0;}}else if(SKO>=30000)SKW=3000;}
}
let FRN=0;
function frame(ts){
  requestAnimationFrame(frame);
  const t0=performance.now();BKMS=0;
  if(!last)last=ts;let dt=ts-last;last=ts;const dtb=dt,rt=t0-ts;if(dt>100)dt=100;
  perf(dt);FDT=dt;musTick();
  let A=1;
  if(G&&(G.state==='play'||G.state==='dying'||G.state==='victory')){
    /* Rattrapage : machine saine -> jusqu'à 5 pas, comme avant. Image précédente hors budget -> 2 pas
       au plus et l'excédent est ABANDONNÉ : rattraper une image lente la rendait plus lente encore
       (rétroaction positive). Temps réel conservé jusqu'à 30 ips ; en dessous le jeu ralentit. */
    const nx=SKBAD?2:5;
    acc+=dt*G.timeScale;let n=0;while(acc>=STEPMS&&n<nx){step();acc-=STEPMS;n++;}if(n>=nx)acc=nx<5?acc%STEPMS:0;
    if(G&&(G.state==='play'||G.state==='dying'||G.state==='victory'))A=clamp(acc/STEPMS,0,1);
  }
  if(REDUCED&&G){G.trauma*=.5;G.glitch=Math.min(G.glitch,2);}
  const bgOnly=!G||['pause','duel','end','evo'].includes(G.state);FRN=(FRN+1)%4;
  if(!bgOnly||FRN%(G&&G.state!=='evo'?4:2)===0||!G&&FRN%2===0)render(A,dt);
  /* travail JS réel de cette image, hors cuisson : la mesure dont bakeBudget() part à l'image suivante */
  FWK=performance.now()-t0-BKMS;skipCtl(FWK+BKMS,dt);
  /* ---------- diagnostic embarque : cumul sur une seconde, puis publication ---------- */
  /* On ne cumule que les images qui JOUENT : la meme condition que la boucle de simulation ci-dessus.
     Avant, les images d'interface entraient dans la fenetre d'une seconde, donc « image : N ms »
     decrivait un melange de deux choses, et les ips gonflaient d'autant. */
  if(G&&(G.state==='play'||G.state==='dying'||G.state==='victory')){
    DIAG_T+=dt;DIAG_N++;DIAG_CJS+=FWK+BKMS;DIAG_CDT+=dt;if(dt>DIAG_MX)DIAG_MX=dt;
    if(AU.ac&&AU.next!=null){const m=AU.next-AU.ac.currentTime;if(m<DIAG_AUM)DIAG_AUM=m;}
    /* pire image : meme test que DIAG_MX (donc le meme nombre que « pire »), apparie au rappel PRECEDENT */
    if(dt>DIAG_W[0]){const p=DIAG_PV,w=DIAG_W;w[0]=dt;w[1]=p[0];w[2]=p[1];w[3]=p[2];w[4]=p[0]<0?0:Math.max(0,WKN-p[4]);w[5]=p[3];
      w[6]=p[0]>=0&&p[5]>=0&&p[5]<=dtb+1?p[5]:-1;const wm=p[0]>=0&&!!JSPROF.wkRecv;w[7]=wm?DIAG_WK[0]:-1;w[8]=wm?DIAG_WK[1]:0;w[9]=dtb;}
    DIAG_PV[0]=FWK+BKMS;DIAG_PV[1]=DIAG_EV[0];DIAG_PV[2]=DIAG_EV[1];DIAG_PV[3]=CHNEW;DIAG_PV[4]=WKN;DIAG_PV[5]=rt;}
  else DIAG_PV[0]=-1;
  DIAG_EV[0]=DIAG_EV[1]=0;CHNEW=0;DIAG_WK[0]=DIAG_WK[1]=0;
  if(DIAG_T>=1000){
    /* profil : on publie le top des postes (ms par image) puis on remet les compteurs a zero */
    JSPROFTOP=[];
    for(const k in JSPROF){const s=JSPROF[k];if(s[0]>=1)JSPROFTOP.push([k,s[0]/DIAG_N,s[1]]);s[0]=0;s[1]=0;}
    JSPROFTOP.sort((a,b)=>b[1]-a[1]);if(JSPROFTOP.length>6)JSPROFTOP.length=6;
    DIAG_JS=DIAG_CJS/DIAG_N;DIAG_DT=DIAG_CDT/DIAG_N;DIAG_PEAK=DIAG_MX;DIAG_WORST=DIAG_W.slice();DIAG_W[0]=0;
    DIAG_LTP=LT_ST===1?DIAG_LT.slice():null;DIAG_LT[0]=0;DIAG_LFP=LF_ST===1?DIAG_LF.slice():null;DIAG_LF[0]=0;
    /* Les ips derivent du MEME cumul que « image : N ms » : deux compteurs separes finissaient par
       afficher, sur la meme ligne, deux nombres qui ne se correspondaient pas. 1000/ips = ms, par
       construction, et non par coincidence. */
    FPSV=DIAG_DT>0?Math.round(1000/DIAG_DT):0;
    DIAG_MARGIN=DIAG_AUM>=1e9?-1:DIAG_AUM;DIAG_CJS=0;DIAG_CDT=0;DIAG_MX=0;DIAG_AUM=1e9;DIAG_N=0;DIAG_T=0;}
}
function startGame(prof,daily){
  if(!shipOK(prof)){SAN_TAB='ships';renderSanct();show('ov-sanct');return;}
  if(storyGate(()=>startGame(prof,daily)))return;
  applyQuality();refReset();meta.lastProf=prof;saveMeta();cv.classList.remove('dying');newRun(prof,daily);flashFade('#05030c',900);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;show(null);}
function boot(){
  jsProfStart();
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
