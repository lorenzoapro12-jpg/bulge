/* =========================================================
   RENDU (interpolé, sprites pré-calculés)
   ========================================================= */
const cv=$('cv');let ctx=cv.getContext('2d',{alpha:false});const MAINCTX=ctx;
let QL=3,W=800,H=600,DPR=1,RES=1,PS=1,RZ=1,RSX=0,RSY=0,VL=0,VT=0,VR=0,VB=0,RT=0,FRAME=0,VIG=null,CAUSP=null,SPRB=0,RDT=16.7;
const CAM={x:0,y:0,z:1};
let SAFE={t:0,b:0,l:0,r:0};
function readSafe(){const d=document.getElementById('safeprobe');if(!d)return;const cs=getComputedStyle(d);SAFE={t:parseFloat(cs.paddingTop)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0,r:parseFloat(cs.paddingRight)||0};}
function fitFont(c,s,maxW,px,wt){c.font=wt+' '+px+'px '+FD;const w=c.measureText(s).width;if(w>maxW){px=Math.max(10,Math.floor(px*maxW/w));c.font=wt+' '+px+'px '+FD;}return px;}
function resize(){readSafe();const r=cv.parentElement.getBoundingClientRect();W=Math.max(300,r.width);H=Math.max(300,r.height);DPR=Math.min(2,window.devicePixelRatio||1);applyRes();}
function applyRes(){CVOK=false;BGK='';BGN=0;PS=Math.min(DPR,QL>=3?(COARSE?1.5:2):QL===2?1.25:1)*RES;cv.width=Math.round(W*PS);cv.height=Math.round(H*PS);
  if(!VIG){VIG=mkCanvas(128,128);const g=VIG.getContext('2d'),gr=g.createRadialGradient(64,64,30,64,64,92);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(2,0,8,.62)');g.fillStyle=gr;g.fillRect(0,0,128,128);}
  if(!CAUSP)buildCaus();}
const SPR={};
function spr(key,size,fn){let s=SPR[key];if(!s){s=mkCanvas(size,size);fn(s.getContext('2d'),size);SPR[key]=s;}return s;}
function glowSpr(col){return spr('g'+col,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.18,rgba(col,1));gr.addColorStop(.45,rgba(col,.35));gr.addColorStop(1,rgba(col,0));g.fillStyle=gr;g.fillRect(0,0,64,64);});}
function softSpr(col){return spr('s'+col,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,rgba(col,.9));gr.addColorStop(.5,rgba(col,.32));gr.addColorStop(1,rgba(col,0));g.fillStyle=gr;g.fillRect(0,0,64,64);});}
function ebSpr(col){return spr('e'+col,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#fff');gr.addColorStop(.2,'#fff');gr.addColorStop(.3,rgba(col,1));gr.addColorStop(.5,rgba(col,.55));gr.addColorStop(.62,'rgba(0,0,0,.5)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});}
function shadowSpr(){return spr('shd',64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.6)');gr.addColorStop(.55,'rgba(0,0,0,.28)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});}
function sphSpr(col,big){const S=big?256:96;return spr((big?'B':'b')+col,S,(g,s)=>{const r=s/2;
  let gr=g.createRadialGradient(r*.7,r*.6,r*.04,r,r,r);gr.addColorStop(0,rgba(col,.62));gr.addColorStop(.45,rgba(col,.17));gr.addColorStop(.8,rgba(col,.36));gr.addColorStop(1,rgba(col,1));
  g.fillStyle=gr;g.beginPath();g.arc(r,r,r*.985,0,TAU);g.fill();
  g.save();g.beginPath();g.arc(r,r,r*.95,0,TAU);g.clip();gr=g.createRadialGradient(r*1.45,r*1.5,0,r*1.45,r*1.5,r*.9);gr.addColorStop(0,'rgba(255,255,255,.3)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);g.restore();
  g.strokeStyle=rgba(col,.45);g.lineWidth=s*.022;g.beginPath();g.arc(r*1.04,r*1.07,r*.6,.2,2.1);g.stroke();
  g.lineWidth=Math.max(1.5,s*.04);g.strokeStyle=col;g.beginPath();g.arc(r,r,r-g.lineWidth/2,0,TAU);g.stroke();
  g.fillStyle='rgba(255,255,255,.82)';g.beginPath();g.ellipse(r*.62,r*.55,r*.22,r*.1,-.7,0,TAU);g.fill();
  g.fillStyle='#fff';g.beginPath();g.arc(r*.92,r*.42,r*.045,0,TAU);g.fill();});}
function sphere(x,y,r,col,flash,alpha){const s=sphSpr(flash?'#ffffff':col,r*RZ*PS>44);if(alpha!=null&&alpha!==1){ctx.globalAlpha=alpha;ctx.drawImage(s,x-r,y-r,r*2,r*2);ctx.globalAlpha=1;}else ctx.drawImage(s,x-r,y-r,r*2,r*2);}
function glow(x,y,r,col,a){ctx.globalAlpha=a*LOWA;ctx.drawImage(glowSpr(col),x-r,y-r,r*2,r*2);}
function soft(x,y,r,col,a){ctx.globalAlpha=a*LOWA;ctx.drawImage(softSpr(col),x-r,y-r,r*2,r*2);}
/* Grand halo à l'échelle 1 : le sprite est agrandi UNE fois à sa taille d'écran (pas de 6 %), puis posé au pixel entier.
   Canevas logiciel (Firefox du propriétaire, skia), mesuré le 01/10/2026 : un sprite de 64 px étiré coûte ~8,8 ns par pixel,
   le même à l'échelle 1 et au pixel entier ~1,4 ns ; le halo du joueur (810 px) coûtait ~6 ms par image, à toute qualité.
   Coordonnées en pixels du canevas ; la transformation est laissée à l'identité (l'appelant la rétablit). */
const NAT=new Map();
function natSpr(src,key,n){const k=key+'|'+n;let S=NAT.get(k);if(S){NAT.delete(k);NAT.set(k,S);return S;}
  S=mkCanvas(n,n);const g=S.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(src,0,0,n,n);if(NAT.size>=24)NAT.delete(NAT.keys().next().value);NAT.set(k,S);return S;}
function natD(D){return Math.max(8,Math.round(Math.exp(Math.round(Math.log(D)/.0583)*.0583)));}
function softPx(X,Y,D,col,a){if(!(D>=8))return;if(D>2048)D=2048;const n=natD(D);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=a*LOWA;ctx.drawImage(natSpr(softSpr(col),'s'+col,n),Math.round(X-n/2),Math.round(Y-n/2));}
function glowPx(X,Y,D,col,a){if(!(D>=8))return;if(D>2048)D=2048;const n=natD(D);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=a*LOWA;ctx.drawImage(natSpr(glowSpr(col),'g'+col,n),Math.round(X-n/2),Math.round(Y-n/2));}
/* halo en coordonnées du monde (appelant en worldTf) */
function softW(x,y,r,col,a){const s=PS*RZ;softPx(PS*(W/2+RSX)+(x-CAM.x)*s,PS*(H/2+RSY)+(y-CAM.y)*s,2*r*s,col,a);worldTf();}
function buildCaus(){const s=256,c=mkCanvas(s,s),g=c.getContext('2d');g.strokeStyle='rgba(170,240,255,.6)';g.lineWidth=2.2;
  for(let k=0;k<9;k++){g.beginPath();for(let x=0;x<=s;x+=4){const y=k*s/9+Math.sin(x/s*TAU*2+k)*9+Math.sin(x/s*TAU*3+k*2)*5;if(x)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}
  for(let k=0;k<9;k++){g.beginPath();for(let y=0;y<=s;y+=4){const x=k*s/9+Math.sin(y/s*TAU*2+k*1.7)*9+Math.sin(y/s*TAU*3+k)*5;if(y)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}
  CAUS=c;CAUSP=ctx.createPattern(c,'repeat');}

/* ---------- interpolation entre deux pas de logique ---------- */
const SW=[];
function lerpObj(o,A){if(o.px===undefined)return;o._x=o.x;o._y=o.y;o.x=o.px+(o.x-o.px)*A;o.y=o.py+(o.y-o.py)*A;SW.push(o);}
function lerpArr(a,A){for(let i=0;i<a.length;i++)lerpObj(a[i],A);}
function lerpIn(A){SW.length=0;lerpObj(G.p,A);
  /* angle du vaisseau : interpolé, et en visée souris on prend directement la position actuelle du curseur (zéro latence) */
  {const P=G.p;P._ang=P.ang;if(P.pang!==undefined)P.ang=P.pang+angDiff(P.pang,P.ang)*A;
   if(G.aimMan&&!inp.touch&&!P.dead&&G.state==='play'){const sx=(P.x-CAM.x)*RZ+W/2,sy=(P.y-CAM.y)*RZ+H/2;P.ang=Math.atan2(inp.my-sy,inp.mx-sx);}}lerpArr(G.en,A);lerpArr(G.pb,A);lerpArr(G.eb,A);lerpArr(G.pus,A);lerpArr(G.fx,A);
  const B=G.boss;if(B){lerpObj(B,A);lerpArr(B.nodes,A);}}
function lerpOut(){for(let i=0;i<SW.length;i++){const o=SW[i];o.x=o._x;o.y=o._y;}SW.length=0;if(G&&G.p&&G.p._ang!==undefined)G.p.ang=G.p._ang;}
function w2s(x,y){return[(x-CAM.x)*RZ+W/2+RSX,(y-CAM.y)*RZ+H/2+RSY];}
function vis(x,y,r){return x+r>VL&&x-r<VR&&y+r>VT&&y-r<VB;}
function worldTf(){ctx.setTransform(PS*RZ,0,0,PS*RZ,PS*(W/2+RSX-CAM.x*RZ),PS*(H/2+RSY-CAM.y*RZ));}
function screenTf(){ctx.setTransform(PS,0,0,PS,0,0);}

/* passe « basse » : décor lointain + grands halos additifs, dessinés DIRECTEMENT dans le canevas principal. */
/* ⚠️ Saccades sur ordinateur (01/10/2026), deux temps. 1) Cette couche était un <canvas id="low"> du DOM, au quart
   de la taille, en mix-blend-mode:screen : le navigateur mélangeait deux calques plein écran à chaque image (PC du
   propriétaire, Firefox 1680×1050 : « hors-JS » 12,0 ms avec, 2,9 ms sans). 2) Étirée ensuite DANS le canevas
   principal en 'screen' : le coût est revenu dans notre JS — même PC, auto 3/3, 38 ips, JS 23 ms dont lowEnd
   9,38 ms pour CE SEUL drawImage plein écran, et drawChunks 8,85 ms (contre JS 5 ms au total avant). Un canevas
   intermédiaire redessiné à chaque image puis composé en plein écran coûte un plein écran de mélange, quoi qu'il
   contienne (quelques halos). Désormais pas de canevas intermédiaire : chaque halo et chaque élément lointain est
   dessiné à sa place en 'lighter' (un ajout ne fonce jamais, comme 'screen' ; sur un fond sombre et à ces
   opacités, l'écart est négligeable). On ne peint plus que la surface des halos. À la mort, LOWA atténue soft()
   et glow() à 0,4 comme le faisait #cv.dying+#low. LOWN compte encore ce qui a été dessiné (bancs). */
let LOWN=0,LOWA=1;
function lowBegin(){ctx=MAINCTX;LOWN=0;LOWA=G&&G.p&&G.p.dead?.4:1;}
function lowWorld(){worldTf();}
function lowScreen(){screenTf();}
function lowEnd(){ctx=MAINCTX;LOWA=1;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
/* grands halos du monde (joueur, boss, explosions) */
function drawLowGlows(){
  const c=ctx;c.globalCompositeOperation='lighter';
  if(G&&G.p){const P=G.p;
    if(!P.dead){softW(P.x,P.y,P.gon>0?250:180,P.gon>0?'#ffffff':P.col,.1+P.glow*.07);LOWN++;}   /* rayon 250 -> 180 (01/10/2026) : surface /2, le centre garde son éclat */
    const B=G.boss;if(B&&!B.gone&&vis(B.x,B.y,B.r*3)){softW(B.x,B.y,B.r*3,bossCol(B),.18+(B.flash>0?.15:0));LOWN++;}
    for(const f of G.fx){if(f.ty!==4||!vis(f.x,f.y,f.r))continue;const a=f.life/f.max;soft(f.x,f.y,f.r*(1.2-a*.2),f.col,a*.45);LOWN++;}}
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
}
function chunksCover(){const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy);if(!c||!c.bake&&!c.bk)return false;}return true;}
/* Niveau de degradation decide par la boucle (g4.js) : 0 = tout dessiner, 1 = les postes
   decoratifs cedent, 2 = en plus les halos. Le jeu n'a aucun budget global
   par image : seule la cuisson en avait un. Quand l'image ne tient pas dans son budget, ce
   sont les postes dont l'absence ne se voit pas qui doivent ceder, pas le monde ni le joueur.
   Le test typeof est volontaire : si la boucle n'expose pas SKIPD, on dessine tout (aucune
   dependance dure entre les deux modules). */
function skLev(){return typeof SKIPD==='number'?SKIPD:0;}
/* Fond gelé, derrière TOUT écran d'interface (pause, évolution, duel, fin, menu principal et ses sous-écrans).
   Avant le 01/10/2026 le fond était redessiné (menu : le monde entier une image sur deux ; pause : une recopie plein écran
   une image sur quatre). Chaque retouche du canevas obligeait le navigateur à refaire le flou et la composition des
   calques d'interface par-dessus : 15 à 18 ips dans les menus au canevas logiciel (mesure Chromium logiciel, 1920x1080).
   Désormais le canevas n'est plus TOUCHÉ : en jeu, la dernière image reste ; au menu principal, le monde est rendu à une
   place fixe jusqu'à ce que tout ce qui est visible soit prêt (chunks cuits, sprites et décors calculés), puis plus rien.
   CVOK : le canevas contient une image valide (faux après applyRes, qui le vide). BGK : '' (vivant), 'g' (figé en jeu), 'm'. */
let CVOK=false,BGK='',MRT=-1,BGN=0;
function render(A,dt){
  FRAME++;RDT=dt||16.7;SPRB=3;ctx=MAINCTX;const c=ctx;const sk=skLev();
  const fige=!G||G.state!=='play'&&G.state!=='dying'&&G.state!=='trans',fk=G?'g':'m';
  if(!fige){BGK='';MRT=-1;}
  /* figé : le canevas n'est pas touché. Pendant le choix d'un bonus (arrivée sur un îlot), la cuisson de l'îlot
     continue (file de prewarm) : sans quoi chaque îlot démarrerait sur le sol de secours. */
  else if(CVOK&&WD&&(BGK===fk||G&&!BGK)){BGK=fk;if(G&&G.state==='pick'&&WD.pq&&WD.pq.length)streamWorld(bakeBudget());return;}
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  if(!WD){c.fillStyle='#05030c';c.fillRect(0,0,cv.width,cv.height);CVOK=false;return;}
  const inGame=!!(G&&G.p);
  if(inGame){RT=G.t+A;
    CAM.x=G.pcx==null?G.cx:G.pcx+(G.cx-G.pcx)*A;CAM.y=G.pcy==null?G.cy:G.pcy+(G.cy-G.pcy)*A;CAM.z=G.pzoom==null?G.zoom:G.pzoom+(G.zoom-G.pzoom)*A;
    RSX=RSY=0;if(G.trauma>0){const s=G.trauma*G.trauma*16;RSX=fr(-s,s);RSY=fr(-s,s);}}
  else{if(MRT<0){MRT=performance.now()/16.67;BGN=0;}RT=MRT;CAM.x=Math.cos(RT*.0007)*RELR*1.6;CAM.y=Math.sin(RT*.00091)*RELR*1.3;CAM.z=Math.min(W,H)/760;RSX=RSY=0;}
  RZ=CAM.z;if(inGame){lerpIn(A);markStep();}
  VL=CAM.x-(W/2+60)/RZ;VR=CAM.x+(W/2+60)/RZ;VT=CAM.y-(H/2+60)/RZ;VB=CAM.y+(H/2+60)/RZ;
  const mix=biomeMix(CAM.x,CAM.y);
  streamWorld(bakeBudget());
  /* le sol de secours n'est dessiné que si un chunk visible n'est pas encore prêt */
  if(!chunksCover()){c.fillStyle='#05030c';c.fillRect(0,0,cv.width,cv.height);screenTf();drawGround();}
  worldTf();drawChunks();if(inGame)drawWhaleShadow(mix);
  /* ambiance lointaine + halos */
  lowBegin();if(QL>=2){lowScreen();drawFar(mix);drawWhale(mix);LOWN++;}lowWorld();if(sk<2)drawLowGlows();lowEnd();
  worldTf();drawEdges();if(inGame)drawTerrain();drawObstacles();
  if(inGame){drawSpawns();drawTele();drawPUs();drawShadows(mix);drawMarks();drawTrails();drawMines();if(DEC==='sky')drawFalls();drawEnemies();if(DEC==='floral'||DEC==='urban')drawDecFX();drawBoss();drawPlayer();drawBullets();drawFX();}
  screenTf();if(sk<1)drawWeather(mix);
  if(inGame){if(G.state==='trans')drawTrSnap();else if(sk<1)drawIndicators();drawTexts();}
  postFX();
  if(inGame){screenTf();ctx.translate(SAFE.l,SAFE.t);const w0=W,h0=H;W-=SAFE.l+SAFE.r;H-=SAFE.t+SAFE.b;try{drawHUD();}finally{W=w0;H=h0;}lerpOut();}
  /* capture du fond, une seule fois par entrée en pause : les images suivantes n'auront qu'un
     composite à faire au lieu du rendu complet */
  CVOK=true;if(fige){if(G)BGK=fk;else if(++BGN>=120||bgPret()&&BGN>=3)BGK=fk;}
}
/* menu principal : tout ce qui est visible est prêt — chunks cuits, et cette image n'a créé ni sprite d'obstacle (SPRB),
   ni décor de chunk (DCB), ni surface de mer (CAUB), ni grappe de lueurs (FLB) faute de budget */
function bgPret(){if(FACM||SPRB!==3||DCB!==1||CAUB!==1||QL>=2&&FLB!==2)return false;
  for(let cx=Math.floor(VL/CH);cx<=Math.floor(VR/CH);cx++)for(let cy=Math.floor(VT/CH);cy<=Math.floor(VB/CH);cy++){const c=getChunk(cx,cy);if(c&&!c.bake)return false;}return true;}
function drawGround(){
  const k=256/(2*WR),wl=CAM.x-(W/2+RSX)/RZ,wt=CAM.y-(H/2+RSY)/RZ;
  let sx=(wl+WR)*k,sy=(wt+WR)*k,sw=W/RZ*k,sh=H/RZ*k,dx=0,dy=0,dw=W,dh=H;
  if(sx<0){const f=-sx/sw;dx+=dw*f;dw*=1-f;sw+=sx;sx=0;}
  if(sy<0){const f=-sy/sh;dy+=dh*f;dh*=1-f;sh+=sy;sy=0;}
  if(sx+sw>256){const f=(sx+sw-256)/sw;dw*=1-f;sw=256-sx;}
  if(sy+sh>256){const f=(sy+sh-256)/sh;dh*=1-f;sh=256-sy;}
  ctx.imageSmoothingEnabled=true;if(sw>0&&sh>0&&dw>0&&dh>0)ctx.drawImage(WD.map,sx,sy,sw,sh,dx,dy,dw,dh);
}
/* couche lointaine en parallaxe (sous le sol) */
/* Allégé le 01/10/2026 (fluidité d'abord, demande du propriétaire) : la brume des Plaines (alpha .035, ~12 ms par image au
   canevas logiciel), les traînées du Récif (~10 ms), les aurores du Glacier (~8 ms), les lueurs du Jardin (~6 ms) et les pulsations
   du Cœur (~5 ms) sont retirées. Les nuages de l'Archipel deviennent un seul halo par cellule, trois tailles, posé à l'échelle 1. */
const FAR={
  clouds(x,y,s,sc,w){if(s<.45)return;ctx.globalCompositeOperation='source-over';softPx(PS*x,PS*y,PS*2*(130+(s<.7?0:s<.85?50:100))*sc,'#eef4ff',.22*w);},
  grid(x,y,s,sc,w,cell){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.07*w;ctx.strokeStyle='#2de2ff';ctx.lineWidth=1;const d=cell*sc;ctx.strokeRect(x-d/2,y-d/2,d,d);if(s>.6){ctx.globalAlpha=.25*w;ctx.fillStyle='#ff2d95';ctx.fillRect(x-2,y-2,4,4);}},
  /* grappe de 5 lueurs : 16 variantes composées une fois, agrandies une fois à l'échelle de l'écran */
  lights(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';const q=(s*16)|0;if(!SPR['fl'+q]){if(FLB<=0)return;FLB--;}const S=spr('fl'+q,144,g=>{g.globalCompositeOperation='lighter';for(let k=0;k<5;k++){const a=(q+.5)/16*50+k*1.3,r=5;
      g.drawImage(glowSpr(k%2?'#ffc93c':'#ff2d95'),72+Math.cos(a)*16*k-r,72+Math.sin(a)*16*k-r,r*2,r*2);}});
    const n=natD(144*sc*PS);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.35*w;ctx.drawImage(natSpr(S,'fl'+q,n),Math.round(PS*x-n/2),Math.round(PS*y-n/2));},
};
let FLB=0;
function drawFar(mix){
  FLB=2;const f=.55,sc=RZ*.72,cell=QL<3||COARSE?760:560,fx=CAM.x*f,fy=CAM.y*f,hw=W/2/sc+cell,hh=H/2/sc+cell;
  const i0=Math.floor((fx-hw)/cell),i1=Math.floor((fx+hw)/cell),j0=Math.floor((fy-hh)/cell),j1=Math.floor((fy+hh)/cell);
  for(const m of mix){const t=BIO[m.b].far,fn=t&&FAR[t];if(!fn||m.w<.3)continue;
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const h=hash2(i,j,WD.seed^77),u=(h&1023)/1024,v=((h>>>10)&1023)/1024,s=((h>>>20)&255)/255;
      const x=((i+u)*cell-fx)*sc+W/2+RSX*.5,y=((j+v)*cell-fy)*sc+H/2+RSY*.5;fn(x,y,s,sc,m.w,cell);screenTf();}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
/* Chantier J0 — « collé pour la première fois » : le premier drawImage d'une cuisson TERMINÉE (c.bake ;
   une cuisson en cours, c.bk.cv, n'en est pas une). Clé = la surface cuite, tenue FAIBLEMENT : rien
   n'est retenu après l'éviction (un ImageBitmap fermé, une toile rendue au pool restent libres). La
   valeur est le chunk, pour qu'une toile du pool recuite pour un AUTRE chunk recompte. frame() (g4.js)
   lit CHNEW puis le remet à zéro à chaque image. N'émet aucune opération de dessin. */
const CHV=new WeakMap();let CHNEW=0;
/* SOL EN CACHE (01/10/2026). Sur un canevas dessiné par le PROCESSEUR (Firefox du propriétaire : AzureCanvasBackend
   « skia », Ryzen 3 5350G à graphique intégré), recopier les chunks À L'ÉCHELLE de la caméra coûte un plein écran
   filtré à chaque image : drawChunks 12,4 ms sur 24,5 ms de JS, en 1920×1080. Ce chemin garde le sol de l'image
   précédente dans une toile de la taille de l'écran, la DÉCALE d'un nombre entier de pixels (copie sans
   redimensionnement, bien moins chère), et ne redessine que la bande entrée à l'écran et les chunks qui ont changé
   (cuisson terminée, cuisson en cours, éviction). Le sol est posé au pixel entier près (écart ≤ 0,5 px avec le reste
   du monde) ; un zoom qui s'écarte de plus de 0,1 % de celui de la toile la redessine entière.
   Sur un canevas dessiné par la CARTE GRAPHIQUE, la copie des chunks ne coûte presque rien au JS (0,4 ms mesuré dans
   Chromium) et ce chemin doublerait la surface remplie : il ne s'enclenche donc que si la copie directe coûte
   (moyenne glissante SOLE > 3 ms sur au moins 30 images), et le reste ensuite. ?sol=1 le force, ?sol=0 l'interdit. */
let SOLC=null,SOLK=null,SOLZ=0,SOLZI=0,SOLE=0,SOLN=0,SOLON=false;const SOLB=new Map(),SOLZH=new Float64Array(8);
/* compteur de diagnostic (meta.fps) : par seconde, toiles refaites entières, chunks redessinés, images en chemin direct */
const SOLST=[0,0,0,0];let SOLD=null;
function solStat(i,n){SOLST[i]+=n;const t=performance.now();if(!SOLST[3])SOLST[3]=t;else if(t-SOLST[3]>=1000){const k=1000/(t-SOLST[3]);SOLD=['sol : toile '+(SOLST[0]*k).toFixed(1)+'/s','chunks '+(SOLST[1]*k).toFixed(1)+'/s','direct '+(SOLST[2]*k).toFixed(0)+'/s'];SOLST[0]=SOLST[1]=SOLST[2]=0;SOLST[3]=t;}}
const SOLM=(()=>{const m=typeof location!=='undefined'&&/[?&]sol=([01])\b/.exec(location.search||'');return m?+m[1]:-1;})();
function solMeasure(ms){SOLK=null;if(SOLM>=0)return;SOLE=SOLN?SOLE*.9+ms*.1:ms;if(++SOLN>=30&&SOLE>3)SOLON=true;}
/* La toile est TORIQUE : le pixel d'écran X (translation tx) vit au pixel ((X-tx) mod w) de la toile, donc un déplacement
   ne recopie rien. Une image coûte UNE recopie plein écran sans redimensionnement (en 1 à 4 morceaux) + les bandes neuves.
   (Première version : deux toiles alternées, décalées par une recopie — deux plein écran par image : drawChunks
   6,95 ms chez le propriétaire, contre 12,4 sans cache.) */
const solMod=(a,n)=>(a%n+n)%n;
/* découpe [a,b) de l'écran en morceaux qui ne passent pas le bord de la toile : [écran début, écran fin, toile début] */
function solCut(a,b,t,n){const o=solMod(a-t,n),k=Math.min(b-a,n-o);return k<b-a?[[a,a+k,o],[a+k,b,0]]:[[a,b,o]];}
function solDraw(c0,c1,r0,r1){
  if(!(SOLM===1||SOLM<0&&SOLON)||typeof document==='undefined')return false;
  const w=cv.width,h=cv.height,s=PS*RZ;
  if(!SOLC||SOLC.width!==w||SOLC.height!==h){SOLC=mkCanvas(w,h);SOLK=null;}
  /* zoom en mouvement (début de partie, approche d'un cœur, coup de zoom) : la toile serait à refaire ENTIÈRE à chaque
     image, soit le chemin direct PLUS une recopie (Récif abyssal chez le propriétaire : solDraw 14,8 ms, 17 ips).
     On dessine alors en direct, et la toile n'est refaite qu'une fois le zoom posé (deux images de suite à 0,05 % près). */
  const zs=SOLZ;SOLZ=s;const zh=SOLZH[SOLZI&7];SOLZH[SOLZI++&7]=s;if(!(zs>0)||Math.abs(s/zs-1)>.0005){SOLK=null;return false;}
  /* zoom qui GLISSE lentement (fin du lerp de G.zoom à 3 % par image, joueur qui grossit) : sous le seuil par image, mais
     l'écart à la toile dépasse 0,1 % toutes les 2 à 4 images => toile refaite ENTIÈRE autant de fois (Mégapole chez le
     propriétaire : solDraw 15,7 ms en moyenne, 42 ms au pire). On ne refait la toile que si le zoom est posé sur 8 images. */
  let K=SOLK;if(K&&Math.abs(s/K.s-1)>.001)K=null;if(!K&&!(zh>0&&Math.abs(s/zh-1)<=.0005)){SOLK=null;return false;}
  const sc=K?K.s:s,tx=Math.round(PS*(W/2+RSX)-CAM.x*sc),ty=Math.round(PS*(H/2+RSY)-CAM.y*sc),R=[];
  let full=!K;
  if(K){const dx=tx-K.tx,dy=ty-K.ty;if(Math.abs(dx)>=w||Math.abs(dy)>=h)full=true;
    else{if(dx>0)R.push([0,0,dx,h]);else if(dx<0)R.push([w+dx,0,-dx,h]);
      if(dy>0)R.push([0,0,w,dy]);else if(dy<0)R.push([0,h+dy,w,-dy]);}}
  if(full){SOLB.clear();R.length=0;R.push([0,0,w,h]);}
  /* chunks changés : cuisson sur place en cours (toujours), ou surface différente de celle déjà posée dans la toile.
     Chunk pas encore cuit (worker en route, voyage rapide vers l'inconnu) : posé UNE fois sur le sol de secours (WD.map, comme
     drawGround), puis redessiné à sa cuisson. Avant, un seul chunk manquant renvoyait au chemin direct ET
     jetait la toile : à chaque chunk reçu, toile refaite ENTIÈRE (Récif chez le propriétaire : solDraw 9,2 ms, 20 ms au pire). */
  const V=[];
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy)||{x0:cx*CH,y0:cy*CH},r=c.bake||c.bk&&c.bk.cv,b=r?chSurf(c,r):null,k=cx+','+cy;V.push(c,b);
    if(c.bake&&CHV.get(r)!==c){CHV.set(r,c);CHNEW++;}
    const id=c.bake?b:b?null:WD.map;
    if(!full&&(!id||SOLB.get(k)!==id)){const x=Math.floor(c.x0*sc+tx)-1,y=Math.floor(c.y0*sc+ty)-1,e=Math.ceil(CH*sc)+3;R.push([x,y,e,e]);}
    SOLB.set(k,id);}
  if(SOLB.size>256)SOLB.clear();
  const g=SOLC.getContext('2d');g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;
  for(const r of R){const x0=Math.max(0,r[0]),y0=Math.max(0,r[1]),x1=Math.min(w,r[0]+r[2]),y1=Math.min(h,r[1]+r[3]);if(x1<=x0||y1<=y0)continue;
    for(const X of solCut(x0,x1,tx,w))for(const Y of solCut(y0,y1,ty,h)){
      const ox=X[2]-X[0],oy=Y[2]-Y[0],a0=X[2],b0=Y[2],a1=a0+X[1]-X[0],b1=b0+Y[1]-Y[0];
      g.save();g.setTransform(1,0,0,1,0,0);g.beginPath();g.rect(a0,b0,a1-a0,b1-b0);g.clip();g.fillStyle='#05030c';g.fillRect(a0,b0,a1-a0,b1-b0);
      g.setTransform(sc,0,0,sc,tx+ox,ty+oy);
      for(let i=0;i<V.length;i+=2){const c=V[i],P=c.x0*sc+tx,Q=c.y0*sc+ty,E=CH*sc;if(P+E<X[0]||P>X[1]||Q+E<Y[0]||Q>Y[1])continue;
        if(V[i+1])g.drawImage(V[i+1],c.x0,c.y0,CH,CH);else{const k=256/(2*WR),u=(c.x0+WR)*k,v=(c.y0+WR)*k;if(u>=0&&v>=0&&u+CH*k<=256&&v+CH*k<=256)g.drawImage(WD.map,u,v,CH*k,CH*k,c.x0,c.y0,CH,CH);}}
      g.restore();}}
  solStat(0,full?1:0);solStat(1,full?0:R.length-(K&&(tx!==K.tx)?1:0)-(K&&(ty!==K.ty)?1:0));SOLK={s:sc,tx,ty};
  ctx.setTransform(1,0,0,1,0,0);
  for(const X of solCut(0,w,tx,w))for(const Y of solCut(0,h,ty,h))ctx.drawImage(SOLC,X[2],Y[2],X[1]-X[0],Y[1]-Y[0],X[0],Y[0],X[1]-X[0],Y[1]-Y[0]);
  worldTf();
  return true;
}
function drawChunks(){
  const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  /* un chunk en cours de cuisson (c.bk) s'affiche tel quel : opaque, il part du même sol que drawGround */
  CAUB=1;
  if(!solDraw(c0,c1,r0,r1)){const t0=performance.now();
    for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy),b=c&&(c.bake||c.bk&&c.bk.cv);if(b){if(c.bake&&CHV.get(b)!==c){CHV.set(b,c);CHNEW++;}ctx.drawImage(chSurf(c,b),c.x0,c.y0,CH,CH);}}
    solMeasure(performance.now()-t0);if(SOLM===1||SOLON)solStat(2,1);}
  STB=10;DCB=1;DEC=G&&G.p&&G.dec?G.biome:'';
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy);if(c){for(const it of c.live)drawLive(it);if(c.bake||c.bk)drawDeco(c);}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function drawLive(it){
  const c=ctx;
  switch(it.t){
    case 'kelp':{if(!vis(it.x,it.y,90))return;c.strokeStyle='rgba(47,191,143,.78)';c.lineCap='round';c.lineWidth=4;
      for(let k=0;k<3;k++){const a0=it.ph+k*2.1;let x=it.x,y=it.y;c.beginPath();c.moveTo(x,y);for(let j=1;j<=6;j++){const a=a0+Math.sin(RT*.03+j*.7+it.ph+k)*.5;x+=Math.cos(a)*12*it.s;y+=Math.sin(a)*12*it.s;c.lineTo(x,y);}c.stroke();c.fillStyle='rgba(109,255,217,.85)';c.beginPath();c.arc(x,y,2.6,0,TAU);c.fill();}
      c.lineCap='butt';break;}
    case 'bloom':{if(!vis(it.x,it.y,60))return;const p=.5+.5*Math.sin(RT*.05+it.ph);c.globalCompositeOperation='lighter';soft(it.x,it.y,42*it.s*(1+p*.3),'#ff5ad8',.3+.25*p);c.globalCompositeOperation='source-over';c.globalAlpha=1;
      if(DEC==='floral'&&bloomLive(it)){drawBloomJaw(it);break;}
      c.fillStyle='#ff8fe0';for(let k=0;k<6;k++){const a=k/6*TAU+RT*.004;c.beginPath();c.ellipse(it.x+Math.cos(a)*11*it.s,it.y+Math.sin(a)*11*it.s,9*it.s,4*it.s,a,0,TAU);c.fill();}
      c.fillStyle='#ffe9a8';c.beginPath();c.arc(it.x,it.y,4*it.s,0,TAU);c.fill();break;}
    case 'beacon':{if(!vis(it.x,it.y,40))return;const on=Math.sin(RT*.08+it.ph)>.3,col=on?'#2de2ff':'#ff2d95';c.globalCompositeOperation='lighter';soft(it.x,it.y,26,col,.5);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle=col;c.fillRect(it.x-4,it.y-4,8,8);break;}
    case 'car':{const q=carAt(it,RT),x=q[0],y=q[1];if(!vis(x,y,30))return;
      const dx=it.vert?0:Math.sign(it.spd),dy=it.vert?Math.sign(it.spd):0;c.globalCompositeOperation='lighter';soft(x+dx*18,y+dy*18,16,'#fff3c4',.55);soft(x-dx*13,y-dy*13,9,'#ff3355',.7);
      /* Mégapole (règle active) : faisceau des phares devant la voiture, là où elle percute */
      if(DEC==='urban'){const nx=-dy,ny=dx;c.globalAlpha=.22;c.fillStyle='#fff3c4';c.beginPath();c.moveTo(x+dx*10+nx*5,y+dy*10+ny*5);c.lineTo(x+dx*70+nx*20,y+dy*70+ny*20);c.lineTo(x+dx*70-nx*20,y+dy*70-ny*20);c.lineTo(x+dx*10-nx*5,y+dy*10-ny*5);c.fill();}
      c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#2c2b3e';c.fillRect(x-(it.vert?5:10),y-(it.vert?10:5),it.vert?10:20,it.vert?20:10);break;}
    case 'shimmer':{if(!vis(it.x,it.y,20))return;const p=Math.pow(Math.max(0,Math.sin(RT*.04+it.ph)),8);if(p<.05)return;c.globalAlpha=p;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.moveTo(it.x-8,it.y);c.lineTo(it.x+8,it.y);c.moveTo(it.x,it.y-8);c.lineTo(it.x,it.y+8);c.stroke();c.globalAlpha=1;break;}
    case 'node':{ /* Veines du Coeur : le halo bat sur la noire de la musique (STEP, g1.js) et tout le
       reseau s'intensifie a l'approche de WD.core (coreK, monotone). */
      if(!vis(it.x,it.y,150))return;const k=coreK(it.x,it.y),p=beatP(it.ph),V=veinsOf(it);
      c.lineCap='round';c.globalCompositeOperation='lighter';c.strokeStyle='#ff3355';
      c.globalAlpha=.6*k*(.6+.4*p);c.lineWidth=2.5;c.beginPath();for(const v of V){c.moveTo(it.x,it.y);for(let j=0;j<v.length;j+=2)c.lineTo(v[j],v[j+1]);}c.stroke();
      soft(it.x,it.y,(22+p*20)*(.8+.4*k),'#ff3355',(.18+.5*p)*k);soft(it.x,it.y,7,'#ffd0c0',.5*k);
      c.globalCompositeOperation='source-over';c.globalAlpha=1;c.lineCap='butt';
      if(G&&G.p){c.fillStyle=G.t-(it.hf==null?-99:it.hf)<4?'#ffffff':'#ff3355';c.strokeStyle=EDK;c.lineWidth=3;c.beginPath();c.arc(it.x,it.y,13,0,TAU);c.stroke();c.fill();
        if(it.hp!=null&&it.hp<it.mhp){c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(it.x,it.y,19,-Math.PI/2,-Math.PI/2+TAU*Math.max(0,it.hp/it.mhp));c.stroke();}}
      break;}
  }
}
/* =========================================================
   DÉCOR VIVANT ET LECTURES DU MONDE (chantier E2)
   Tout ce qui suit est dessiné À CHAQUE IMAGE et jamais cuit : la cuisson (test/cuisson.js) et l'art
   des chunks (test/art.js) ne bougent pas. Les placements utilisent des générateurs PROPRES
   (mkRng(hash2(cx,cy,WD.seed^K))), jamais `rnd` ni R() : la génération et la simulation restent
   identiques (test/trace.js). Les caches sont tenus ICI (WeakMap) et non dans l'objet chunk, pour
   ne pas changer l'empreinte du monde.
   Pourquoi par le MONDE et pas par l'ambiance : le lointain exige QL>=2 et la météo saute dès
   que skLev()>=1 (render). Sur un téléphone qui a dégradé sa qualité, seul ce qui est dessiné
   dans la passe du monde (drawChunks, drawObstacles, marques) reste visible.
   ========================================================= */
/* intensité du Cœur : 1 sur l'Hypernoyau, décroît STRICTEMENT avec la distance (test/decor-vivant.js) */
function coreK(x,y){if(!WD||!WD.core)return .5;const d=Math.hypot(x-WD.core.x,y-WD.core.y)/1800;return .3+.7/(1+d*d);}
let EMK=.5;
/* battement : une noire = 4 pas de séquenceur (STEP, g1.js) ; RT est en images à 60 i/s */
const BEATF=STEP*240;
function beatP(off){const f=(((RT-off)/BEATF)%1+1)%1;return (1-f)*(1-f)*(1-f);}
const VEIN=new WeakMap();
function veinsOf(it){let V=VEIN.get(it);if(V)return V;V=[];const r=mkRng(hash2(it.x|0,it.y|0,WD.seed^0x7e1));
  for(let k=0;k<3;k++){let a=it.ph+k*2.1+r()*.6,x=it.x,y=it.y;const v=[];for(let j=0;j<5;j++){a+=(r()-.5)*.9;x+=Math.cos(a)*(14+r()*8);y+=Math.sin(a)*(14+r()*8);v.push(x,y);}V.push(v);}
  VEIN.set(it,V);return V;}
/* décor par chunk, calculé une fois au premier affichage */
const DECV=new WeakMap();
function decoOf(c){let d=DECV.get(c);if(d)return d;d={v:[],pk:[],st:[]};DECV.set(c,d);
  const r=mkRng(hash2(c.cx,c.cy,WD.seed^0x5e2a1)),x0=c.x0,y0=c.y0,Q=[biomeAt(x0+128,y0+128),biomeAt(x0+384,y0+128),biomeAt(x0+128,y0+384),biomeAt(x0+384,y0+384)];
  /* 1. lianes du Jardin : entre deux obstacles floraux du chunk séparés de moins de 220 px (bord à bord) */
  const F=c.obs.filter(o=>o.b==='floral'&&o.k===0);
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){const a=F[i],b=F[j],L=Math.hypot(b.x-a.x,b.y-a.y);if(L-a.r-b.r>=220||d.v.length>=8)continue;
    for(let k=0;k<2;k++)d.v.push({a,b,L,sg:(k?-1:1)*(.08+r()*.14),ph:r()*TAU,w:2.2+r()*1.4});}
  /* 2. paquets de la Grille : sur une ligne de 64 px, le long de la plus longue suite de cases cyber
     (drawGrid, gw2.js, trace le bord haut et le bord gauche de chaque case cyber) */
  if(Q.includes('cyber'))for(let i=0;i<8;i++){const h=r()<.5,li=1+(r()*7|0);let a=-1,best=[0,0];
    for(let s=0;s<=8;s++){const ok=s<8&&biomeAt(h?x0+s*64+32:x0+li*64+32,h?y0+li*64+32:y0+s*64+32)==='cyber';if(ok&&a<0)a=s;if(!ok&&a>=0){if(s-a>best[1]-best[0])best=[a,s];a=-1;}}
    const sp=(r()<.5?-1:1)*(1.4+r()*1.6),ph=r()*1e3;if(best[1]-best[0]>=2)d.pk.push({h,u:li*64,a:best[0]*64,b:best[1]*64,sp,ph});}
  /* méduses du Récif : retirées le 01/10/2026 à la demande du propriétaire (« au premier plan, c'est moche ») */
  /* 3. bouches de vapeur : sur la grille des lampadaires de drawCity (gw2.js : hash2(L>>8,t>>7,seed^0xc17e)),
     sur la chaussée d'en face, décalées de 70 px le long de la rue */
  if(Q.includes('urban')){const S=WD.seed^0xc17e;
    for(let v=0;v<2;v++)for(let L=(v?y0:x0);L<(v?y0:x0)+CH;L+=256)for(let t=(v?x0:y0)+128;t<(v?x0:y0)+CH;t+=256){
      const hh=hash2(L>>8,t>>7,S+v),sd=hh&1?1:-1,vx=v?t+70*sd:L-sd*20,vy=v?L-sd*20:t+70*sd,keep=r()<.6;
      if(!keep||vx<x0||vx>=x0+CH||vy<y0||vy>=y0+CH||biomeAt(vx,vy)!=='urban'||hitList(c.obs,vx,vy,10))continue;d.st.push({x:vx,y:vy,v,ph:r()});}}
  return d;}
/* STB : bouches de vapeur par image ; DCB : décors de chunk CALCULÉS par image (le premier calcul d'un
   chunk appelle biomeAt des dizaines de fois : mesuré 26 ms au pire à x4 sans borne) */
let STB=0,DCB=0;
function drawDeco(c){let d=DECV.get(c);if(!d){if(DCB<=0)return;DCB--;d=decoOf(c);}const g=ctx;
  if(d.v.length){g.lineCap='round';
    for(const q of d.v){const a=q.a,b=q.b,ux=(b.x-a.x)/q.L,uy=(b.y-a.y)/q.L,ax=a.x+ux*a.r*.7,ay=a.y+uy*a.r*.7,bx=b.x-ux*b.r*.7,by=b.y-uy*b.r*.7;
      if(Math.max(ax,bx)+40<VL||Math.min(ax,bx)-40>VR||Math.max(ay,by)+40<VT||Math.min(ay,by)-40>VB)continue;
      const sw=Math.sin(RT*.02+q.ph)*.03,k=(q.sg+sw)*q.L,mx=(ax+bx)/2-uy*k,my=(ay+by)/2+ux*k;
      g.strokeStyle='#0d1f0c';g.lineWidth=q.w+2.5;g.beginPath();g.moveTo(ax,ay);g.quadraticCurveTo(mx,my,bx,by);g.stroke();
      g.strokeStyle='#3f8f36';g.lineWidth=q.w;g.stroke();
      g.fillStyle='#57b544';for(let t=.18;t<.9;t+=.16){const u=1-t,px=u*u*ax+2*u*t*mx+t*t*bx,py=u*u*ay+2*u*t*my+t*t*by,s=((t*7|0)&1)?1:-1;
        g.beginPath();g.ellipse(px-uy*s*4,py+ux*s*4,4.5,2.2,Math.atan2(uy,ux)+s*.8,0,TAU);g.fill();}}
    g.lineCap='butt';}
  if(d.pk.length){g.globalCompositeOperation='lighter';
    for(const q of d.pk){const L=q.b-q.a,p=q.a+(((q.ph+RT*q.sp)%L)+L)%L,x=q.h?c.x0+p:c.x0+q.u,y=q.h?c.y0+q.u:c.y0+p;if(!vis(x,y,30))continue;
      const tx=q.h?-Math.sign(q.sp):0,ty=q.h?0:-Math.sign(q.sp),tl=Math.min(26,p-q.a,q.b-p);
      g.globalAlpha=.7;g.strokeStyle='#2de2ff';g.lineWidth=2.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+tx*Math.max(0,tl),y+ty*Math.max(0,tl));g.stroke();
      soft(x,y,13,'#2de2ff',.45);g.globalAlpha=1;g.fillStyle='#eaffff';g.fillRect(x-2.5,y-2.5,5,5);}
    g.globalCompositeOperation='source-over';g.globalAlpha=1;}
  for(const q of d.st){if(STB<=0||!vis(q.x,q.y,70))continue;STB--;
    g.fillStyle='#0b0a12';g.fillRect(q.x-7,q.y-4,14,8);g.strokeStyle='rgba(150,150,175,.5)';g.lineWidth=1;g.beginPath();for(let k=-4;k<=4;k+=4){g.moveTo(q.x+k,q.y-3);g.lineTo(q.x+k,q.y+3);}g.stroke();
    for(let k=0;k<5;k++){const f=((RT*.011+q.ph+k/5)%1),r=5+f*17;soft(q.x+Math.sin(RT*.02+k*1.7+q.ph*9)*4*f+f*10,q.y-f*56,r,'#eef0fa',Math.min(1,f*9)*(1-f)*.75);}
    g.globalAlpha=1;}
}
/* 5. baleine céleste : une silhouette qui traverse le lointain toutes les 45 s (couche basse, QL>=2),
   et son ombre sur la mer de nuages, dans la passe du monde (visible à toute qualité) */
const WHP=2700;
function whaleAt(mix){let w=0;for(const m of mix)if(m.b==='sky')w=m.w;if(w<.3)return null;
  const n=Math.floor(RT/WHP),f=(RT-n*WHP)/WHP,h=hash2(n,0,WD.seed^0x3a1e),dir=h&1?1:-1,sc=RZ*.72,span=W+1300*sc,
    x=dir>0?-650*sc+f*span:W+650*sc-f*span,y=H*(.2+.6*((h>>>4)&1023)/1023)+Math.sin(f*6)*20*sc;return{x,y,dir,sc,w,f};}
function drawWhale(mix){const q=whaleAt(mix);if(!q)return;const c=ctx;
  c.save();c.globalCompositeOperation='lighter';c.translate(q.x,q.y);c.scale(q.dir*q.sc,q.sc);const sw=Math.sin(RT*.03)*.12;
  c.globalAlpha=.62*q.w;c.fillStyle='#16224f';c.beginPath();c.ellipse(0,0,270,74,0,0,TAU);c.fill();
  c.beginPath();c.moveTo(-230,-18);c.quadraticCurveTo(-330,0,-360,0);c.lineTo(-420,-60+sw*200);c.quadraticCurveTo(-400,0,-420,60-sw*200);c.lineTo(-360,0);c.quadraticCurveTo(-330,0,-230,18);c.fill();
  c.beginPath();c.moveTo(60,40);c.quadraticCurveTo(20,130+sw*80,-40,150+sw*80);c.quadraticCurveTo(0,90,-10,50);c.fill();
  c.globalAlpha=.28*q.w;c.strokeStyle='#cfe0ff';c.lineWidth=5;c.beginPath();for(let k=0;k<5;k++){c.moveTo(210-k*6,20+k*9);c.quadraticCurveTo(40,34+k*9,-120,18+k*8);}c.stroke();
  c.fillStyle='#cfe0ff';c.beginPath();c.arc(185,-8,7,0,TAU);c.fill();c.restore();c.globalAlpha=1;}
function drawWhaleShadow(mix){const q=whaleAt(mix);if(!q)return;const x=CAM.x+(q.x-W/2)/RZ+160,y=CAM.y+(q.y-H/2)/RZ+220,L=560*q.sc/RZ;
  ctx.globalAlpha=.3*q.w;ctx.drawImage(shadowSpr(),x-L,y-L*.32,L*2,L*.64);ctx.globalAlpha=1;}
/* 8. N3 — trace du joueur, propre au biome. G.trails (g2.js) n'est rempli qu'en fantôme et g2.js est
   hors périmètre : pool FIXE de MKN marques, anneau réécrit sur place (sa taille ne croît jamais). */
const MKN=48,MKL=150,MK=[];for(let i=0;i<MKN;i++)MK.push({x:0,y:0,px:0,py:0,a:0,t:-1e9,b:'',s:0,r:10});
let MKI=0,MKX=null,MKY=0,MKS=0;
function markStep(){const P=G.p;if(!P||P.dead||G.state!=='play')return;if(MKX===null){MKX=P.x;MKY=P.y;return;}
  const dx=P.x-MKX,dy=P.y-MKY,d=Math.hypot(dx,dy);if(d>400){MKX=P.x;MKY=P.y;return;}
  const b=G.biome,st=b==='ice'?20:b==='sea'?28:16;if(d<st)return;
  const m=MK[MKI];MKI=(MKI+1)%MKN;m.px=MKX;m.py=MKY;m.x=P.x;m.y=P.y;m.a=Math.atan2(dy,dx);m.t=RT;m.b=b;m.s=MKS^=1;m.r=P.r;MKX=P.x;MKY=P.y;}
function drawMarks(){const c=ctx,P=G.p;
  for(const m of MK){const f=(RT-m.t)/MKL;if(f<0||f>=1||!vis(m.x,m.y,50))continue;const a=1-f,ca=Math.cos(m.a),sa=Math.sin(m.a),nx=-sa,ny=ca;
    switch(m.b){
      case 'plains':case 'floral':{c.globalAlpha=.3*a;c.strokeStyle='rgba(0,0,0,.6)';c.lineWidth=m.r*1.7;c.beginPath();c.moveTo(m.px,m.py);c.lineTo(m.x,m.y);c.stroke();
        c.globalAlpha=.6*a;c.strokeStyle=BIO[m.b].a;c.lineWidth=1.3;c.beginPath();
        for(const s of [-1,1])for(let k=0;k<2;k++){const o=m.r*(.35+k*.45)*s,qx=m.x+nx*o,qy=m.y+ny*o;c.moveTo(qx,qy);c.lineTo(qx-ca*12+nx*s*3,qy-sa*12+ny*s*3);}c.stroke();break;}
      case 'sea':{c.strokeStyle='#dffbff';c.lineWidth=1.2;for(let k=0;k<3;k++){const z=f*(34+k*10),x=m.x+nx*(k-1)*m.r*.6+Math.sin(RT*.1+k+m.t)*3,y=m.y-z;c.globalAlpha=.75*a;c.beginPath();c.arc(x,y,1.8+k*1.1+f*2,0,TAU);c.stroke();}break;}
      case 'ice':{const o=(m.s?1:-1)*m.r*.45,x=m.x+nx*o,y=m.y+ny*o;c.globalAlpha=.8*a;c.fillStyle='#ffffff';c.beginPath();c.ellipse(x+ca*1.2,y+sa*1.2,8.5,5.2,m.a,0,TAU);c.fill();
        c.fillStyle='#0b2436';c.globalAlpha=.75*a;c.beginPath();c.ellipse(x,y,7,4.2,m.a,0,TAU);c.fill();break;}
      case 'cyber':case 'urban':{c.globalCompositeOperation='lighter';c.strokeStyle=P.col;c.lineCap='round';c.globalAlpha=.16*a;c.lineWidth=10;c.beginPath();c.moveTo(m.px,m.py);c.lineTo(m.x,m.y);c.stroke();
        c.globalAlpha=.8*a;c.lineWidth=2.5;c.stroke();c.lineCap='butt';c.globalCompositeOperation='source-over';break;}
      case 'sky':{soft(m.x-ca*6,m.y-sa*6,14+f*12,'#ffffff',.22*a);break;}
      case 'core':{c.globalAlpha=.45*a;c.drawImage(shadowSpr(),m.x-12,m.y-12,24,24);c.globalCompositeOperation='lighter';soft(m.x,m.y,5,'#ff3355',.5*a*a);c.globalCompositeOperation='source-over';break;}}}
  c.globalAlpha=1;}
/* Reflets de la mer, FIGÉS dans le sol (01/10/2026, choix du propriétaire). C'était un remplissage plein écran par image
   (motif répété, 'lighter') : avec Skia — le moteur du canvas de Firefox — 2,2 ms, plus que tout le sol (1,0 ms) ; chez le
   propriétaire (Firefox 140 ESR) ~20 ms estimés, 17-20 ips au Récif abyssal. Désormais posés UNE fois par chunk de mer
   terminé, dans une copie de sa surface cuite (la cuisson et son art ne changent pas : test/art.js), ancrés au monde,
   donc continus d'un chunk à l'autre. Au plus une copie par image (CAUB) : un chunk pas encore orné s'affiche nu. */
const CAUV=new WeakMap();let CAUB=0,CAUS=null;
function chSurf(c,b){if(!c.bake||typeof document==='undefined')return b;
  if(c.sea===undefined){let w=0;for(const m of biomeMix(c.x0+CH/2,c.y0+CH/2))if(m.b==='sea')w=m.w;c.sea=w;}
  if(c.sea<=.3)return b;let o=CAUV.get(b);if(o)return o;if(CAUB<=0||!CAUS)return b;CAUB--;
  o=mkCanvas(b.width,b.height);const g=o.getContext('2d'),k=b.width/CH;g.drawImage(b,0,0);
  g.globalCompositeOperation='lighter';g.globalAlpha=.1*c.sea;g.fillStyle=g.createPattern(CAUS,'repeat');g.setTransform(k,0,0,k,-c.x0*k,-c.y0*k);g.fillRect(c.x0,c.y0,CH,CH);
  CAUV.set(b,o);return o;}
function membrane(cx,cy,R,col,t){
  const c=ctx,N=R>2000?220:130;c.beginPath();
  for(let i=0;i<=N;i++){const a=i/N*TAU,r=R+Math.sin(a*7+t*.03)*4+Math.sin(a*3-t*.02)*3;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
  c.globalCompositeOperation='lighter';if(QL>=3){c.strokeStyle=rgba(col,.06);c.lineWidth=26;c.stroke();}c.strokeStyle=rgba(col,.18);c.lineWidth=9;c.stroke();c.strokeStyle=rgba(col,.9);c.lineWidth=2.6;c.stroke();c.globalCompositeOperation='source-over';
}
/* bord jouable de l'îlot (confine, g2.js) : une membrane à la couleur du biome */
function drawEdges(){membrane(0,0,PR+6,BIO[G&&G.p?G.biome:WD.sites[0].t].a,RT);}
function drawObstacles(){
  const c0=Math.floor(VL/CH)-1,c1=Math.floor(VR/CH)+1,r0=Math.floor(VT/CH)-1,r1=Math.floor(VB/CH)+1;
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const ch=getChunk(cx,cy);if(!ch)continue;
    for(const o of ch.obs){if(o.wall)continue;const m=o.R+140;if(o.cx+m<VL||o.cx-m>VR||o.cy+m<VT||o.cy-m>VB)continue;
      if(!o.spr){if(SPRB<=0)continue;SPRB--;OSPR.push(o);}
      o.su=FRAME;if(o.b==='urban'||o.lt==='urban'&&o.role==='center'){obsSprite(o);TWL.push(o);continue;}ctx.drawImage(obsSprite(o),o.sx,o.sy,o.sw,o.sh);
      if(o.brk)drawBrk(o);
      if(o.b==='core'){ctx.globalCompositeOperation='lighter';soft(o.x,o.y,o.r*1.3,'#ff3355',(.1+.08*Math.sin(RT*.05+o.s))*(.5+coreK(o.x,o.y)));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}}}
  drawTowers();
}
/* décor cassable (o.brk, gw.js) : fêlures selon les dégâts, éclat blanc au coup reçu, étincelle vert-jaune s'il cache un power-up */
function drawBrk(o){const c=ctx,f=1-o.hp/o.mhp;
  if(f>0){c.strokeStyle='rgba(0,0,0,.62)';c.lineWidth=2.2;c.beginPath();const n=1+Math.floor(f*5);
    for(let k=0;k<n;k++){let a=((o.s>>>(k*3))%628)/100,x=o.cx,y=o.cy;c.moveTo(x,y);for(let j=1;j<=3;j++){a+=((o.s>>>(k*2+j))&7)/7-.5;x+=Math.cos(a)*o.R*.3;y+=Math.sin(a)*o.R*.3;c.lineTo(x,y);}}c.stroke();}
  if(G&&G.t-(o.hf==null?-99:o.hf)<4){c.globalAlpha=.45;c.fillStyle='#fff';c.beginPath();c.arc(o.cx,o.cy,o.R*.85,0,TAU);c.fill();c.globalAlpha=1;}
  if(o.pu){const p=.5+.5*Math.sin(RT*.12+o.s);c.globalCompositeOperation='lighter';glow(o.cx,o.cy-o.R*.2,10+6*p,PUC,.5+.4*p);c.globalCompositeOperation='source-over';c.globalAlpha=1;}}
/* Mégapole : tours extrudées en perspective. Le toit glisse loin du centre de l'écran à proportion de sa
   hauteur ; chaque façade tournée vers la caméra est un parallélogramme, donc l'image AFFINE d'une texture
   de fenêtres (facTex) : un setTransform et un drawImage. La collision reste l'emprise au sol. Ordre du
   peintre : la plus éloignée d'abord, pour qu'un toit proche recouvre la façade d'une tour plus lointaine. */
const TWL=[],TWK=.13,TWM=100,PHH=2.6;let FACM=0;/* une façade manquait à la dernière image (texture pas encore prête ici, ex. chunk cuit par le worker) : le menu ne se fige pas dessus */
/* décalage du sommet d'un objet de hauteur T posé en x,y (borné à m) */
function twOff(x,y,T,m){const k=T*TWK;return[clamp((x-CAM.x)*k,-m,m),clamp((y-CAM.y)*k,-m,m)];}
function drawTowers(){
  FACM=0;if(!TWL.length)return;const c=ctx,s=PS*RZ,tx=PS*(W/2+RSX-CAM.x*RZ),ty=PS*(H/2+RSY-CAM.y*RZ);let nb=1;
  TWL.sort((a,b)=>dist2(b.cx,b.cy,CAM.x,CAM.y)-dist2(a.cx,a.cy,CAM.x,CAM.y));
  const face=(o,x0,y0,x1,y1,dx,dy,dk)=>{let t=FACS[(o.s%FACN)*2+(dk?1:0)];if(!t){if(nb<=0){FACM=1;return;}nb--;t=facTex(o.s%FACN,dk);}
    const L=Math.hypot(x1-x0,y1-y0),u0=(o.s>>>4)%(FACW-L|0||1);
    c.setTransform(s*(x1-x0)/L,s*(y1-y0)/L,-s*dx/FACH,-s*dy/FACH,s*(x0+dx)+tx,s*(y0+dy)+ty);c.drawImage(t,u0*2,0,L*2,FACH*2,0,0,L,FACH);};
  for(const o of TWL){
    if(o.b==='lm'){ /* le phare, monument de la ville : un fût rond (le disque balayé), le plus haut de tous */
      const [dx,dy]=twOff(o.x,o.y,PHH,TWM*2),r=o.r,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
      c.lineCap='round';c.strokeStyle='#1b1930';c.lineWidth=r*2;c.beginPath();c.moveTo(o.x,o.y);c.lineTo(o.x+dx,o.y+dy);c.stroke();c.lineCap='butt';
      c.lineWidth=2;c.strokeStyle='#ffd27a';c.globalAlpha=.55;c.beginPath();for(let t=.12;t<.96;t+=.085){const px=o.x+dx*t,py=o.y+dy*t;c.moveTo(px-nx*r*.92,py-ny*r*.92);c.lineTo(px+nx*r*.92,py+ny*r*.92);}c.stroke();
      c.lineWidth=3;c.globalAlpha=.9;for(const [f,col] of [[-.95,'#ff2d95'],[.95,'#2de2ff']]){c.strokeStyle=col;c.beginPath();c.moveTo(o.x+nx*r*f,o.y+ny*r*f);c.lineTo(o.x+dx+nx*r*f,o.y+dy+ny*r*f);c.stroke();}
      c.globalAlpha=1;c.drawImage(o.spr,o.sx+dx,o.sy+dy,o.sw,o.sh);c.globalCompositeOperation='lighter';glow(o.x+dx,o.y+dy,r*1.4,'#fff3c4',.55+.2*Math.sin(RT*.05));c.globalCompositeOperation='source-over';c.globalAlpha=1;continue;}
    const T=twH(o),[dx,dy]=twOff(o.cx,o.cy,T,TWM),X=o.x,Y=o.y,R=X+o.w,B=Y+o.h;
    if(R+Math.max(dx,0)+12<VL||X+Math.min(dx,0)-12>VR||B+Math.max(dy,0)+12<VT||Y+Math.min(dy,0)-12>VB)continue;
    if(dx>.6)face(o,X,Y,X,B,dx,dy,0);else if(dx<-.6)face(o,R,Y,R,B,dx,dy,1);
    if(dy>.6)face(o,X,Y,R,Y,dx,dy,0);else if(dy<-.6)face(o,X,B,R,B,dx,dy,1);
    c.setTransform(s,0,0,s,tx,ty);c.drawImage(o.spr,o.sx+dx,o.sy+dy,o.sw,o.sh);
    if(T>1.15&&Math.sin(RT*.07+o.s)>.55){c.globalCompositeOperation='lighter';glow(o.cx+dx,o.cy+dy,9,'#ff3355',.9);c.globalCompositeOperation='source-over';c.globalAlpha=1;}}
  TWL.length=0;
}
/* ---------- power-ups au sol (G.pus, gp.js) : losange vert-jaune (PUC) au pictogramme, anneau qui pulse ;
   ils clignotent leurs deux dernières secondes. Couleur réservée : ni les ennemis ni leurs tirs ne la portent. ---------- */
function puIcon(c,k,s){c.fillStyle=PUC;c.strokeStyle=PUC;c.lineWidth=Math.max(1.5,s*.28);c.lineCap='round';c.lineJoin='round';c.beginPath();
  switch(k){
    case 'inv':for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?s*.45:s;if(i)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);else c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();break;
    case 'rapid':for(const o of [-.4,.4]){c.moveTo(s*(o-.32),-s*.6);c.lineTo(s*(o+.28),0);c.lineTo(s*(o-.32),s*.6);}c.stroke();break;
    case 'triple':for(const a of [-.55,0,.55]){c.moveTo(0,s*.7);c.lineTo(Math.sin(a)*s*1.2,s*.7-Math.cos(a)*s*1.45);}c.stroke();break;
    case 'pierce':c.moveTo(-s,0);c.lineTo(s,0);c.moveTo(s*.45,-s*.45);c.lineTo(s,0);c.lineTo(s*.45,s*.45);c.moveTo(-s*.15,-s*.75);c.lineTo(-s*.15,s*.75);c.stroke();break;
    case 'slow':c.moveTo(-s*.6,-s*.75);c.lineTo(s*.6,-s*.75);c.lineTo(-s*.6,s*.75);c.lineTo(s*.6,s*.75);c.closePath();c.stroke();break;
    case 'shield':for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2;if(i)c.lineTo(Math.cos(a)*s*.85,Math.sin(a)*s*.85);else c.moveTo(Math.cos(a)*s*.85,Math.sin(a)*s*.85);}c.closePath();c.stroke();break;
    case 'wave':c.arc(0,0,s*.3,0,TAU);c.fill();c.beginPath();c.arc(0,0,s*.85,0,TAU);c.stroke();break;
    default:c.moveTo(-s*.75,0);c.lineTo(s*.75,0);c.moveTo(0,-s*.75);c.lineTo(0,s*.75);c.stroke();}
  c.lineCap='butt';c.lineJoin='miter';}
function drawPUs(){const c=ctx;
  for(const q of G.pus){if(!vis(q.x,q.y,50))continue;const a=q.life<120&&(FRAME>>2)%2?.35:1,s=14+Math.sin(RT*.12+q.ph)*1.5,f=(RT*.02+q.ph)%1;
    c.globalCompositeOperation='lighter';glow(q.x,q.y,s*2.4,PUC,.45*a);c.globalCompositeOperation='source-over';
    c.globalAlpha=a*(1-f)*.8;c.strokeStyle=PUC;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,s+4+f*18,0,TAU);c.stroke();
    c.globalAlpha=a;c.save();c.translate(q.x,q.y);c.rotate(Math.sin(RT*.05+q.ph)*.3);
    c.beginPath();c.moveTo(0,-s);c.lineTo(s,0);c.lineTo(0,s);c.lineTo(-s,0);c.closePath();c.fillStyle='#161a06';c.fill();c.strokeStyle=PUC;c.lineWidth=3;c.stroke();
    puIcon(c,q.k,s*.5);c.restore();}
  c.globalAlpha=1;}
/* ---------- annonces des attaques du boss (G.tele, gb.js) : rien ne frappe sans avoir été montré.
   path = bande de charge, beam = trait fin puis rayon, ring = anneau au sol, arc = secteur de rafale ---------- */
function drawTele(){const c=ctx;
  for(const q of G.tele){const pre=q.warn>0,f=pre?q.t/(q.t+q.warn):1,col=q.col||COL.rd;
    if(q.ty==='path'){c.save();c.translate(q.x,q.y);c.rotate(q.a);c.globalAlpha=.08+.2*f;c.fillStyle=col;c.fillRect(0,-q.w/2,q.len,q.w);
      c.globalAlpha=.45+.45*f;c.strokeStyle=col;c.lineWidth=2.5;c.setLineDash([16,10]);c.lineDashOffset=-RT*2;c.beginPath();c.moveTo(0,-q.w/2);c.lineTo(q.len,-q.w/2);c.moveTo(0,q.w/2);c.lineTo(q.len,q.w/2);c.stroke();c.setLineDash([]);
      c.lineWidth=4;c.beginPath();const w=q.w*.22;for(let d=q.w*.6+(RT*3)%80;d<q.len;d+=80){c.moveTo(d-w,-w);c.lineTo(d,0);c.lineTo(d-w,w);}c.stroke();c.restore();}
    else if(q.ty==='beam'){const x2=q.x+Math.cos(q.a)*q.len,y2=q.y+Math.sin(q.a)*q.len;c.lineCap='round';
      if(pre){c.globalAlpha=.08+.12*f;c.strokeStyle=col;c.lineWidth=q.w;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(x2,y2);c.stroke();
        c.globalAlpha=.3+.6*f;c.lineWidth=1+2.5*f;c.setLineDash([10,8]);c.lineDashOffset=-RT;c.stroke();c.setLineDash([]);}
      else{c.globalCompositeOperation='lighter';c.globalAlpha=.5;c.strokeStyle=col;c.lineWidth=q.w*1.5;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(x2,y2);c.stroke();
        c.globalAlpha=.95;c.strokeStyle='#ffffff';c.lineWidth=q.w*.45;c.stroke();c.globalCompositeOperation='source-over';}
      c.lineCap='butt';}
    else if(q.ty==='ring'){c.globalAlpha=.06+.14*f;c.fillStyle=col;c.beginPath();c.arc(q.x,q.y,q.r+20,0,TAU);c.arc(q.x,q.y,Math.max(1,q.r-20),0,TAU,true);c.fill();
      c.globalAlpha=.5+.4*f;c.strokeStyle=col;c.lineWidth=3;c.setLineDash([18,12]);c.lineDashOffset=RT*1.5;c.beginPath();c.arc(q.x,q.y,q.r,0,TAU);c.stroke();c.setLineDash([]);
      c.globalAlpha=.3+.5*f;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,q.r*(1-f)+8,0,TAU);c.stroke();}
    else if(q.ty==='arc'){c.globalAlpha=.07+.18*f;c.fillStyle=col;c.beginPath();c.moveTo(q.x,q.y);c.arc(q.x,q.y,q.r,q.a-q.sp,q.a+q.sp);c.closePath();c.fill();
      c.globalAlpha=.45+.45*f;c.strokeStyle=col;c.lineWidth=2.5;c.stroke();
      const s=q.a-q.sp+2*q.sp*f;c.lineWidth=4;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x+Math.cos(s)*q.r,q.y+Math.sin(s)*q.r);c.stroke();}}
  c.globalAlpha=1;}
/* ---------- annonces d'apparition (G.marks, g2.js) : un cercle au sol, la silhouette du type au centre ; or = élite ---------- */
function drawSpawns(){const c=ctx;
  for(const m of G.marks){if(!vis(m.x,m.y,90))continue;const f=m.t/m.max,col=m.prey?pale(m.col):m.col,r=(m.prey?22:34)+(m.n>1?16:0)+(m.el?14:0);
    c.globalAlpha=.12+.25*f;c.fillStyle=col;c.beginPath();c.arc(m.x,m.y,r*f,0,TAU);c.fill();
    c.globalAlpha=.55+.4*f;c.strokeStyle=m.el?COL.gd:col;c.lineWidth=m.el?3.5:2;c.setLineDash([7,6]);c.lineDashOffset=RT*.8;c.beginPath();c.arc(m.x,m.y,r,0,TAU);c.stroke();c.setLineDash([]);
    c.globalAlpha=.35+.4*f;shapePath(c,m.t2,m.x,m.y,m.prey?9:14,-Math.PI/2);c.fillStyle=col;c.fill();}
  c.globalAlpha=1;}
function drawMines(){const c=ctx;
  for(const m of G.mines){if(!vis(m.x,m.y,30))continue;c.fillStyle='#0c1420';c.beginPath();c.arc(m.x,m.y,9,0,TAU);c.fill();c.strokeStyle=COL.cy;c.lineWidth=2;c.stroke();
    if(m.t<30||(m.t>>4)%2){c.globalCompositeOperation='lighter';glow(m.x,m.y,14,COL.cy,.8);c.globalCompositeOperation='source-over';c.globalAlpha=1;}}}
/* ---------- le terrain agit (g2.js) : courant du Récif, balayage de la Grille, givre du Glacier, relais du Cœur ---------- */
function drawTerrain(){const c=ctx,D=G.dec,C=G.courant;
  if(C){c.strokeStyle='#bff8ff';c.lineCap='round';c.lineWidth=2;const nx=-C.y,ny=C.x,L=2*PR;
    for(let i=0;i<26;i++){const h=hash2(i,7,WD.seed),o=((h&1023)/1023-.5)*2*PR,p=((((h>>>10)&1023)/1023*L+RT*1.6)%L)-PR,x=C.x*p+nx*o,y=C.y*p+ny*o;
      if(x*x+y*y>(PR-40)**2||!vis(x,y,80))continue;c.globalAlpha=.22*Math.min(1,(PR-Math.hypot(x,y))/200);c.beginPath();c.moveTo(x,y);c.lineTo(x-C.x*70,y-C.y*70);c.stroke();}
    c.lineCap='butt';c.globalAlpha=1;}
  const S=D.sw;if(S){const s=swS(RT),hot=D.vu;
    c.save();c.beginPath();c.arc(0,0,PR+20,0,TAU);c.clip();c.translate(S.x+S.dx*s,S.y+S.dy*s);c.rotate(Math.atan2(S.dy,S.dx));
    c.globalAlpha=hot?.16:.09;c.fillStyle=hot?COL.mg:COL.cy;c.fillRect(-SW_W/2,-2*WR,SW_W,4*WR);
    c.globalAlpha=hot?.8:.5;c.fillRect(-SW_W/2-1,-2*WR,2,4*WR);c.fillRect(SW_W/2-1,-2*WR,2,4*WR);c.restore();c.globalAlpha=1;}
  if(D.givre.length){c.fillStyle='#b5f3ff';for(const q of D.givre){const a=1-(G.t-q.t)/GIVRE_T;if(a<=0||!vis(q.x,q.y,q.r))continue;c.globalAlpha=.22*a;c.beginPath();c.arc(q.x,q.y,q.r,0,TAU);c.fill();}c.globalAlpha=1;}
  if(D.relais.length){c.strokeStyle='#ff3355';c.lineWidth=2;c.setLineDash([5,7]);c.lineDashOffset=-RT;c.globalAlpha=.6;c.beginPath();for(const q of D.relais)for(const e of q.pro){c.moveTo(q.it.x,q.it.y);c.lineTo(e.x,e.y);}c.stroke();c.setLineDash([]);c.globalAlpha=1;}
}
function drawShadows(mix){
  const sky=G.biome==='sky'?1:0,k=.32+.9*sky,a=.5-.25*sky,S=shadowSpr(),c=ctx;
  const sh=(x,y,r)=>{if(!vis(x,y,r*3))return;const o=r*k;c.drawImage(S,x-r*1.1+o,y-r*1.1+o*1.3,r*2.2,r*2.2);};
  c.globalAlpha=a;for(const e of G.en)if(e.spawn<=0)sh(e.x,e.y,e.r);const P=G.p;if(!P.dead)sh(P.x,P.y,P.r*1.3);
  const B=G.boss;if(B&&!B.gone)sh(B.x,B.y,B.r);for(const q of G.pus)sh(q.x,q.y,12);c.globalAlpha=1;
}
function drawTrails(){const c=ctx,P=G.p;for(const tr of G.trails){c.globalAlpha=tr.life/70*.35;c.fillStyle=rgba(P.col,.4);c.beginPath();c.arc(tr.x,tr.y,tr.r,0,TAU);c.fill();}c.globalAlpha=1;}
/* ---------- le décor mord : AFFICHAGE des règles de g2.js (decorTick, skyFalls) ----------
   Rien n'est recalculé ici : l'ouverture vient de bloomOpen, la voiture de carAt, les instants de G.dec (tick de
   l'événement) ; RT=G.t+A, donc le dessin tombe sur le tick de la règle, interpolé. Actif seulement si G.biome
   (DEC, fixé par drawChunks) est celui de la règle ; hors floral/urban/sky, rien n'est parcouru. Plafonné par image. */
/* DEC_N traces par image au plus ; le halo (soft, grand et coûteux à DPR 2,6 : mesuré +28 ms/image à ×4 pour 8) seulement pour les DEC_H plus récentes */
let DEC='';const DEC_N=8,DEC_H=2;
/* la gueule ne mord que dans les 5×5 chunks autour du joueur (decorTick) : hors de là, elle reste au repos */
function bloomLive(it){const P=G.p;return Math.abs(Math.floor(it.x/CH)-Math.floor(P.x/CH))<=2&&Math.abs(Math.floor(it.y/CH)-Math.floor(P.y/CH))<=2;}
function drawBloomJaw(it){
  const c=ctx,s=it.s,o=bloomOpen(it,RT);let sn=0;
  for(const q of G.dec.bite)if(q.it===it){const f=(RT-q.t)/12;if(f>=0&&f<1)sn=1-f;}
  /* ouverture = avertissement : la zone de morsure (BLOOM_R) se remplit du centre au bord, le contour se durcit */
  if(o>0){c.globalAlpha=.1+.12*o;c.fillStyle='#ff8fe0';c.beginPath();c.arc(it.x,it.y,BLOOM_R*o,0,TAU);c.fill();
    c.globalAlpha=.25+.6*o*o;c.strokeStyle='#ffd6f3';c.lineWidth=1.5+2*o;c.setLineDash([9,7]);c.lineDashOffset=-RT*.6;c.beginPath();c.arc(it.x,it.y,BLOOM_R,0,TAU);c.stroke();c.setLineDash([]);c.lineDashOffset=0;c.globalAlpha=1;}
  /* pétales : s'écartent et s'allongent à l'ouverture, claquent (serrés) juste après la morsure */
  const d=(11+16*o-6*sn)*s,L=(9+7*o-3*sn)*s,sp=RT*(.004+.02*o);
  c.fillStyle=o>.75?'#ff5ad8':'#ff8fe0';for(let k=0;k<6;k++){const a=k/6*TAU+sp;c.beginPath();c.ellipse(it.x+Math.cos(a)*d,it.y+Math.sin(a)*d,L,(4+2*o)*s,a,0,TAU);c.fill();}
  const h=(4+5*o)*s*(1+(o>0?.25*Math.sin(RT*(.2+.8*o)):0));c.fillStyle=sn>0?'#ffffff':'#ffe9a8';c.beginPath();c.arc(it.x,it.y,h,0,TAU);c.fill();
}
/* traces des événements (G.dec.bite, G.dec.car : purgés à 30 ticks par la règle), au-dessus des ennemis */
function drawDecFX(){
  const c=ctx,D=G.dec;let n=0;c.globalCompositeOperation='lighter';
  if(DEC==='floral')for(let i=D.bite.length-1;i>=0&&n<DEC_N;i--){const q=D.bite[i],f=(RT-q.t)/30;if(f<0||f>=1||!vis(q.x,q.y,q.r))continue;n++;
    /* claquement : éclair sur toute la zone, puis anneau qui se referme sur le cœur */
    if(n<=DEC_H)soft(q.x,q.y,q.r*(1-.3*f),'#ff8fe0',.55*(1-f)*(1-f));c.globalAlpha=1-f;c.strokeStyle='#ffe9a8';c.lineWidth=4*(1-f)+1;
    c.beginPath();c.arc(q.x,q.y,q.r*(1-.8*f),0,TAU);c.stroke();
    c.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU,r0=q.r*(1-f*.9),r1=r0*.55;c.moveTo(q.x+Math.cos(a)*r0,q.y+Math.sin(a)*r0);c.lineTo(q.x+Math.cos(a)*r1,q.y+Math.sin(a)*r1);}c.stroke();}
  if(DEC==='urban')for(let i=D.car.length-1;i>=0&&n<DEC_N;i--){const q=D.car[i],f=(RT-q.t)/30,e=q.e;if(f<0||f>=1||!vis(q.x,q.y,120))continue;n++;
    const it=q.it,dx=it.vert?0:Math.sign(it.spd),dy=it.vert?Math.sign(it.spd):0,g=1-f;
    /* choc : flash de phares au point d'impact, gerbe d'étincelles vers l'avant, sillage jusqu'à l'ennemi projeté */
    if(n<=DEC_H)soft(q.x+dx*14,q.y+dy*14,30*g+8,'#fff3c4',.8*g);c.globalAlpha=g;c.strokeStyle='#fff3c4';c.lineWidth=2;c.beginPath();
    for(let k=0;k<7;k++){const a=Math.atan2(dy,dx)+(k-3)*.38,r0=10+f*40,r1=r0+8+10*g;c.moveTo(q.x+Math.cos(a)*r0,q.y+Math.sin(a)*r0);c.lineTo(q.x+Math.cos(a)*r1,q.y+Math.sin(a)*r1);}c.stroke();
    c.globalAlpha=.6*g;c.lineWidth=e.r*.9*g+1;c.lineCap='round';c.beginPath();c.moveTo(q.x,q.y);c.lineTo(e.x,e.y);c.stroke();c.lineCap='butt';
    if(!e.dead){c.globalAlpha=g;c.lineWidth=2.5;c.beginPath();c.arc(e.x,e.y,e.r+4+f*14,0,TAU);c.stroke();}}
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
}
/* chute (skyFalls) : l'ennemi, retiré de G.en, vit dans G.dec.fall FALL_T ticks ; il glisse vers le vide (fdx,fdy),
   rétrécit et se noie dans le bleu du ciel. Dessiné sous les ennemis vivants. */
function drawFalls(){
  const c=ctx,F=G.dec.fall;
  for(let i=0,n=0;i<F.length&&n<DEC_N;i++){const e=F[i],f=Math.min(1,Math.max(0,(FALL_T-e.fall+RT-G.t)/FALL_T)),x=e.x+e.fdx*e.r*1.6*f,y=e.y+e.fdy*e.r*1.6*f;if(!vis(x,y,e.r*3))continue;n++;
    c.globalCompositeOperation='lighter';soft(x,y,e.r*(2.6-f),'#cfe0ff',.45*(1-f*.5));c.globalCompositeOperation='source-over';
    c.globalAlpha=.7*(1-f);c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.arc(x,y,e.r*(1.2+f*1.4),0,TAU);c.stroke();c.globalAlpha=1;
    const k=1-.85*f;c.save();c.translate(x,y);c.scale(k,k);c.rotate(f*2.5);c.translate(-e.x,-e.y);drawEnemy(e);c.restore();
    c.globalAlpha=.85*f;c.fillStyle='#223673';c.beginPath();c.arc(x,y,e.r*k*1.05,0,TAU);c.fill();c.globalAlpha=1;}
}
/* ---------- ennemis : UNE silhouette par type, lisible d'un coup d'œil (couleurs chaudes, contour sombre, un œil qui te
   regarde). Proie (assez petite pour être avalée) : pâle, sans contour ni œil. Élite : liseré blanc et couronne d'or.
   Le boss reprend la silhouette de son type, en géant, avec une couronne de pointes. ---------- */
function shapePath(c,t,x,y,r,a){c.beginPath();
  const P=(n,fn)=>{for(let k=0;k<n;k++){const q=fn(k);if(k)c.lineTo(x+q[0],y+q[1]);else c.moveTo(x+q[0],y+q[1]);}c.closePath();};
  switch(t){
    case 'mite':P(3,k=>{const b=a+(k===1?2.45:k===2?-2.45:0),q=k?r*.95:r*1.35;return[Math.cos(b)*q,Math.sin(b)*q];});break;
    case 'spike':P(8,k=>{const b=a+k*Math.PI/4,q=k%2?r*.55:r*1.4;return[Math.cos(b)*q,Math.sin(b)*q];});break;
    case 'spread':P(8,k=>{const b=a+Math.PI/4+(k>>1)*Math.PI/2+(k%2?.32:-.32);return[Math.cos(b)*r*1.12,Math.sin(b)*r*1.12];});break;
    case 'sniper':P(4,k=>{const b=a+k*Math.PI/2,q=k===0?r*1.75:k===2?r*.95:r*.55;return[Math.cos(b)*q,Math.sin(b)*q];});break;
    case 'orbit':c.arc(x,y,r,0,TAU);c.moveTo(x+r*.45,y);c.arc(x,y,r*.45,0,TAU,true);break;
    case 'gatling':P(8,k=>{const b=a+Math.PI/8+k*Math.PI/4;return[Math.cos(b)*r*1.08,Math.sin(b)*r*1.08];});break;
    case 'ring':P(6,k=>{const b=a+k*Math.PI/3;return[Math.cos(b)*r*1.12,Math.sin(b)*r*1.12];});break;
    case 'spawner':c.ellipse(x,y,r*1.15,r*.88,a,0,TAU);break;
    default:P(12,k=>{const b=a+k*Math.PI/6,q=k%2?r*.8:r*1.12;return[Math.cos(b)*q,Math.sin(b)*q];});}
}
const PALE={};
function pale(col){return PALE[col]||(PALE[col]=(q=>'rgb('+(q[0]+255>>1)+','+(q[1]+255>>1)+','+(q[2]+255>>1)+')')(rgb(col)));}
/* orientation de la silhouette : vers où il va (Mite), vers sa cible (Tireur, Mitrailleuse), ou une rotation lente */
function eAng(e){const P=G.p,aP=Math.atan2(P.y-e.y,P.x-e.x);
  switch(e.t){case 'mite':return e.vx||e.vy?Math.atan2(e.vy,e.vx):aP;case 'sniper':return e.tele>0?e.ta:aP;case 'spike':return e.st===2?e.ca:e.wob*2;
    case 'gatling':return e.st>0?e.ca:aP;case 'spawner':return Math.sin(e.wob)*.4;default:return e.wob*.6;}}
const EDK='rgba(12,4,18,.9)';
function drawEnemies(){for(const e of G.en)if(vis(e.x,e.y,e.r*3))drawEnemy(e);}
function drawEnemy(e){
  const c=ctx,col=e.col,P=G.p;let r=e.r;
  if(e.spawn>0){const f=1-e.spawn/24;c.globalAlpha=f;shapePath(c,e.t,e.x,e.y,r*f,eAng(e));c.fillStyle=e.prey?pale(col):col;c.fill();c.globalAlpha=1;return;}
  const a=eAng(e);
  if(e.prey){r*=1+Math.sin(RT*.15+e.wob*3)*.06;c.globalAlpha=.85;shapePath(c,e.t,e.x,e.y,r,a);c.fillStyle=e.flash>0?'#fff':pale(col);c.fill();c.globalAlpha=1;
    c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(e.x,e.y,Math.max(1.5,r*.22),0,TAU);c.fill();return;}
  c.globalCompositeOperation='lighter';glow(e.x,e.y,r*2.2,col,e.elite?.45:.25);c.globalCompositeOperation='source-over';c.globalAlpha=1;
  /* annonces propres au type : visée de l'Épine, trait du Tireur */
  if(e.t==='spike'&&e.st===1){c.globalAlpha=.25+.5*(1-e.st2/40);c.strokeStyle=col;c.lineWidth=2;c.setLineDash([10,8]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.ca)*260,e.y+Math.sin(e.ca)*260);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
  if(e.t==='sniper'&&e.tele>0){const f=1-e.tele/60;c.globalAlpha=.15+.7*f;c.strokeStyle=col;c.lineWidth=1+f*2.5;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.ta)*1500,e.y+Math.sin(e.ta)*1500);c.stroke();c.globalAlpha=1;}
  if(e.t==='orbit'){c.fillStyle=col;for(let k=0;k<2;k++){const b=e.wob*5+k*Math.PI;c.beginPath();c.arc(e.x+Math.cos(b)*r*1.7,e.y+Math.sin(b)*r*1.7,r*.26,0,TAU);c.fill();}}
  const fl=e.flash>0;
  shapePath(c,e.t,e.x,e.y,r,a);c.strokeStyle=e.elite?'#ffffff':EDK;c.lineWidth=e.elite?Math.max(3,r*.24):Math.max(2,r*.18);c.stroke();c.fillStyle=fl?'#ffffff':col;c.fill();
  if(!fl){c.globalAlpha=.3;shapePath(c,e.t,e.x-r*.18,e.y-r*.22,r*.5,a);c.fillStyle='#ffffff';c.fill();c.globalAlpha=1;}
  c.fillStyle=EDK;
  switch(e.t){
    case 'spread':{const b0=Math.atan2(P.y-e.y,P.x-e.x);for(let k=-1;k<=1;k++){const b=b0+k*.45;c.beginPath();c.arc(e.x+Math.cos(b)*r*.78,e.y+Math.sin(b)*r*.78,r*.17,0,TAU);c.fill();}break;}
    case 'gatling':{const sp=e.st>0?.5:.05;for(let k=0;k<3;k++){const b=RT*sp+k*TAU/3;c.beginPath();c.arc(e.x+Math.cos(b)*r*.5,e.y+Math.sin(b)*r*.5,r*.19,0,TAU);c.fill();}break;}
    case 'ring':for(let k=0;k<6;k++){const b=a+k*Math.PI/3+Math.PI/6;c.beginPath();c.arc(e.x+Math.cos(b)*r*.74,e.y+Math.sin(b)*r*.74,r*.12,0,TAU);c.fill();}break;
    case 'spawner':c.fillStyle=COL.vi;for(let k=0;k<3;k++){const b=e.wob*2+k*TAU/3;c.beginPath();c.arc(e.x+Math.cos(b)*r*.45,e.y+Math.sin(b)*r*.45,r*.18,0,TAU);c.fill();}break;
  }
  if(e.t!=='gatling'&&e.t!=='spawner'){const b=Math.atan2(P.y-e.y,P.x-e.x),o=e.t==='mite'?r*.25:e.t==='sniper'?r*.45:0,ex=e.x+Math.cos(a)*o,ey=e.y+Math.sin(a)*o,er=r*(e.t==='mite'?.3:.26);
    c.fillStyle='#ffffff';c.beginPath();c.arc(ex,ey,er,0,TAU);c.fill();c.fillStyle='#0c0412';c.beginPath();c.arc(ex+Math.cos(b)*er*.4,ey+Math.sin(b)*er*.4,er*.52,0,TAU);c.fill();}
  if(e.elite){c.fillStyle=COL.gd;c.beginPath();for(let k=-1;k<=1;k++){const b=-Math.PI/2+k*.55,x=e.x+Math.cos(b)*(r+4),y=e.y+Math.sin(b)*(r+4);
    c.moveTo(x+Math.cos(b+1.6)*5,y+Math.sin(b+1.6)*5);c.lineTo(x+Math.cos(b)*12,y+Math.sin(b)*12);c.lineTo(x+Math.cos(b-1.6)*5,y+Math.sin(b-1.6)*5);}c.fill();}
  if(e.frostT>G.t){c.strokeStyle='#b5f3ff';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r+5,0,TAU);c.stroke();}
  if(e.alarmT>G.t&&(FRAME>>3)%2){c.fillStyle=COL.mg;c.fillRect(e.x-1.5,e.y-r-18,3,9);c.fillRect(e.x-1.5,e.y-r-7,3,3);}
  if(e.hp<e.mhp){c.globalAlpha=.75;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r+7,-Math.PI/2,-Math.PI/2+TAU*Math.max(0,e.hp/e.mhp));c.stroke();c.globalAlpha=1;}
}
function drawBoss(){
  const B=G.boss;if(!B||B.gone)return;const c=ctx,P=G.p,col=bossCol(B),t=B.D.t;
  const sa=B.spawn>0?1-B.spawn/110:1,df=B.dead?B.dieT/90:0,al=B.dead?1-df*.5:sa;
  const r=B.r*(B.spawn>0?.3+.7*sa:1)*(1+Math.sin(RT*.08)*.025)*(1+.15*df),aP=Math.atan2(P.y-B.y,P.x-B.x);
  c.globalCompositeOperation='lighter';glow(B.x,B.y,r*2.6,col,.4*al);c.globalCompositeOperation='source-over';c.globalAlpha=al;
  /* nœuds de l'Hypernoyau : tant qu'il en reste, il ne prend que 40 % des dégâts (anneau pointillé) */
  if(B.nodes.length){let alive=false;
    for(const n of B.nodes){if(n.dead)continue;alive=true;c.strokeStyle=rgba(COL.or,.4);c.lineWidth=2;c.beginPath();c.moveTo(B.x,B.y);c.lineTo(n.x,n.y);c.stroke();
      shapePath(c,'ring',n.x,n.y,n.r,RT*.03);c.strokeStyle=EDK;c.lineWidth=3;c.stroke();c.fillStyle=n.flash>0?'#fff':COL.or;c.fill();
      if(n.hp<n.mhp){c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(n.x,n.y,n.r+6,-Math.PI/2,-Math.PI/2+TAU*Math.max(0,n.hp/n.mhp));c.stroke();}}
    if(alive){c.strokeStyle=rgba(COL.or,.6);c.lineWidth=3;c.setLineDash([12,8]);c.lineDashOffset=RT;c.beginPath();c.arc(B.x,B.y,r*1.45,0,TAU);c.stroke();c.setLineDash([]);}}
  const a=t==='mite'||t==='spike'||t==='sniper'?(B.st===2?B.ca:aP):B.wob*(t==='core'?.5:.4);
  c.fillStyle=col;c.beginPath();for(let k=0;k<10;k++){const b=-B.wob*.7+k*TAU/10;
    c.moveTo(B.x+Math.cos(b-.13)*r*1.1,B.y+Math.sin(b-.13)*r*1.1);c.lineTo(B.x+Math.cos(b)*r*1.34,B.y+Math.sin(b)*r*1.34);c.lineTo(B.x+Math.cos(b+.13)*r*1.1,B.y+Math.sin(b+.13)*r*1.1);}c.fill();
  const fl=B.flash>0||B.trans>0&&(FRAME>>2)%2||B.dead&&(FRAME>>2)%2;
  shapePath(c,t,B.x,B.y,r,a);c.strokeStyle=EDK;c.lineWidth=Math.max(4,r*.12);c.stroke();c.fillStyle=fl?'#ffffff':col;c.fill();
  if(!fl){c.globalAlpha=al*.3;shapePath(c,t,B.x-r*.18,B.y-r*.22,r*.5,a);c.fillStyle='#ffffff';c.fill();c.globalAlpha=al;}
  if(B.phase>1){c.strokeStyle=B.phase===3?'#fff3c4':'#ffd27a';c.lineWidth=2.5;c.beginPath();for(let k=0;k<5;k++){const b=k*1.3+.4;
    c.moveTo(B.x+Math.cos(b)*r*.35,B.y+Math.sin(b)*r*.35);c.lineTo(B.x+Math.cos(b+.2)*r*.7,B.y+Math.sin(b+.2)*r*.7);c.lineTo(B.x+Math.cos(b-.1)*r*.95,B.y+Math.sin(b-.1)*r*.95);}c.stroke();}
  const er=r*(t==='sniper'?.4:.3);c.fillStyle='#fff';c.beginPath();c.arc(B.x,B.y,er,0,TAU);c.fill();c.fillStyle='#0c0412';c.beginPath();c.arc(B.x+Math.cos(aP)*er*.45,B.y+Math.sin(aP)*er*.45,er*.5,0,TAU);c.fill();
  c.globalAlpha=1;
}
/* ---------- la bulle : membrane en segments (ta vie), jauge de gonflement au cœur, anneaux des power-ups actifs,
   arc de recharge du dash dessous. Tout ce qui te concerne est SUR toi : rien à chercher dans un coin d'écran. ---------- */
function drawPlayer(){
  const P=G.p;if(P.dead)return;const c=ctx,r=P.r,gon=P.gon>0,pu=P.pu,col=gon?'#e8fdff':P.col;
  const base=P.inv>0&&P.dashing<=0&&!(pu.inv>0)&&!gon&&(FRAME>>2)%2===0?.4:(P.ghost?.85:1);
  if(P.aura>0){c.globalCompositeOperation='lighter';soft(P.x,P.y,P.auraR*1.15,COL.vi,.2);c.globalCompositeOperation='source-over';c.globalAlpha=1;
    c.strokeStyle=rgba(COL.vi,.6);c.lineWidth=2;c.setLineDash([10,14]);c.lineDashOffset=-RT;c.beginPath();c.arc(P.x,P.y,P.auraR,0,TAU);c.stroke();c.setLineDash([]);}
  if(P.vortex){c.strokeStyle=rgba(COL.cy,.35);c.lineWidth=2;for(let k=0;k<3;k++){const a=RT*.04+k*TAU/3;c.beginPath();c.arc(P.x,P.y,r*2.4,a,a+1.2);c.stroke();}}
  c.globalCompositeOperation='lighter';glow(P.x,P.y,r*2.6,pu.inv>0?COL.gd:col,(.35+P.glow*.35)*base);c.globalCompositeOperation='source-over';c.globalAlpha=1;
  const n=P.turrets+(pu.triple>0?2:0),w=P.spreadW*(n>3?.85:1),rc=P.recoil*.5;c.lineCap='round';c.globalAlpha=base;
  const barrel=(a,cl)=>{c.strokeStyle='#0b1c26';c.lineWidth=r*.44;c.beginPath();c.moveTo(P.x+Math.cos(a)*r*.5,P.y+Math.sin(a)*r*.5);c.lineTo(P.x+Math.cos(a)*(r*1.42-rc),P.y+Math.sin(a)*(r*1.42-rc));c.stroke();c.strokeStyle=cl;c.lineWidth=r*.24;c.stroke();};
  for(let k=0;k<n;k++){const i=k-(n-1)/2;barrel(P.ang+i*w,Math.abs(i)>(P.turrets-1)/2?PUC:col);}
  if(P.mirror)barrel(P.ang+Math.PI,col);
  c.lineCap='butt';
  sphere(P.x,P.y,r,col,P.flash>0,base);
  c.globalAlpha=base;
  /* jauge : un disque blanc grandit au cœur de la bulle ; pleine, il bat. Gonflé : l'arc blanc du temps qui reste. */
  if(gon){c.strokeStyle='#ffffff';c.lineWidth=4;c.beginPath();c.arc(P.x,P.y,r+3,-Math.PI/2,-Math.PI/2+TAU*P.gon/P.gonMax);c.stroke();}
  else{const full=P.gauge>=1,gr=r*.5*(full?1+.12*Math.sin(RT*.25):Math.sqrt(P.gauge));
    if(gr>.5){c.fillStyle=full?'#ffffff':'rgba(255,255,255,.5)';c.beginPath();c.arc(P.x,P.y,gr,0,TAU);c.fill();}
    if(full){c.globalCompositeOperation='lighter';glow(P.x,P.y,r*1.3,'#ffffff',.3+.2*Math.sin(RT*.25));c.globalCompositeOperation='source-over';c.globalAlpha=base;}}
  /* membrane : un arc par segment ; perdu = gris ; au dernier, il clignote rouge */
  const N=P.segMax,R1=r+7,gp=N>1?Math.min(.2,.7/N):0,low=P.seg<=1&&N>1;
  c.lineWidth=4;c.lineCap='round';
  for(let k=0;k<N;k++){const a0=-Math.PI/2+k*TAU/N+gp,a1=-Math.PI/2+(k+1)*TAU/N-gp;
    c.strokeStyle=k<P.seg?(low&&(FRAME>>3)%2?COL.rd:COL.cy):'rgba(255,255,255,.16)';c.beginPath();c.arc(P.x,P.y,R1,a0,a1);c.stroke();}
  /* power-ups actifs : un anneau vert-jaune chacun, qui se vide (et clignote sa dernière seconde et demie) */
  let i=0;c.lineWidth=2.5;
  for(const k in pu){if(!(pu[k]>0)||k==='shield')continue;c.strokeStyle=PUC;c.globalAlpha=base*(pu[k]<90&&(FRAME>>2)%2?.3:.9);c.beginPath();c.arc(P.x,P.y,R1+7+i*5,-Math.PI/2,-Math.PI/2+TAU*pu[k]/(P.puMax[k]||pu[k]));c.stroke();i++;}
  c.globalAlpha=base;
  if(pu.shield>0){const R2=R1+7+i*5;c.strokeStyle='#ffffff';c.beginPath();for(let k=0;k<=6;k++){const a=k*TAU/6+RT*.01;if(k)c.lineTo(P.x+Math.cos(a)*R2,P.y+Math.sin(a)*R2);else c.moveTo(P.x+Math.cos(a)*R2,P.y+Math.sin(a)*R2);}c.stroke();i++;}
  if(pu.inv>0){c.strokeStyle=COL.gd;c.lineWidth=3;c.globalAlpha=.6+.4*Math.sin(RT*.4);c.beginPath();c.arc(P.x,P.y,r+1,0,TAU);c.stroke();c.globalAlpha=base;}
  if(P.dashT>0&&!P.noDash){c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=3;c.beginPath();c.arc(P.x,P.y,R1+9+i*5,Math.PI/2+.5,Math.PI/2+.5-(1-P.dashT/P.dashMax),true);c.stroke();}
  c.lineCap='butt';c.globalAlpha=1;
  for(let k=0;k<P.orbs;k++){const a=RT*.07+k*TAU/P.orbs,ox=P.x+Math.cos(a)*(r+30),oy=P.y+Math.sin(a)*(r+30);c.globalCompositeOperation='lighter';glow(ox,oy,18,COL.cy,.6);c.globalCompositeOperation='source-over';c.globalAlpha=1;sphere(ox,oy,7,COL.pk);}
  for(let k=0;k<P.drones;k++){const a=-RT*.025+k*TAU/P.drones;sphere(P.x+Math.cos(a)*(r+62),P.y+Math.sin(a)*(r+62),8,COL.pk);}
}
function drawBullets(){
  const c=ctx,groups={};
  for(const b of G.pb){if(!vis(b.x,b.y,30))continue;(groups[b.col]||(groups[b.col]=[])).push(b);}
  c.globalCompositeOperation='lighter';c.lineCap='round';
  for(const col in groups){const L=groups[col];c.strokeStyle=col;c.globalAlpha=.5;c.lineWidth=L[0].r*1.1;c.beginPath();for(const b of L){c.moveTo(b.x-b.vx*2.2,b.y-b.vy*2.2);c.lineTo(b.x,b.y);}c.stroke();for(const b of L)glow(b.x,b.y,b.r*2.6,col,1);}
  c.globalCompositeOperation='source-over';c.lineCap='butt';c.globalAlpha=1;
  for(const b of G.eb){if(!vis(b.x,b.y,20))continue;const s=b.r*2.9;c.drawImage(ebSpr(b.col),b.x-s,b.y-s,s*2,s*2);}
}
function drawFX(){
  const c=ctx;
  for(const f of G.fx){if(f.ty!==2&&f.ty!==3&&f.ty!==5)continue;if(!vis(f.x,f.y,40))continue;const a=f.life/f.max;
    if(f.ty===2)sphere(f.x,f.y,Math.max(.6,f.s*a),f.col,false,a);else if(f.ty===5)sphere(f.x,f.y,Math.max(1,f.r*a),pale(f.col),false,.4+.6*a);
    else{c.globalAlpha=a*.3;c.fillStyle=f.col;c.beginPath();c.arc(f.x,f.y,f.r,0,TAU);c.fill();}}
  c.globalCompositeOperation='lighter';
  for(const f of G.fx){if(f.ty===2||f.ty===3||f.ty===5||f.ty===4)continue;if(!vis(f.x,f.y,f.r1||f.r||40))continue;const a=f.life/f.max;
    if(f.ty===0)glow(f.x,f.y,f.s*3,f.col,a);
    else if(f.ty===6){c.globalAlpha=a;c.strokeStyle=f.col;c.lineWidth=2.5;c.beginPath();c.moveTo(f.x,f.y);for(let k=1;k<5;k++){const t=k/5;c.lineTo(f.x+(f.x2-f.x)*t+fr(-9,9),f.y+(f.y2-f.y)*t+fr(-9,9));}c.lineTo(f.x2,f.y2);c.stroke();}
    else{const t=1-a,rr_=f.r+(f.r1-f.r)*(1-(1-t)*(1-t));c.globalAlpha=a;c.strokeStyle=f.col;c.lineWidth=f.w*a+.5;c.beginPath();c.arc(f.x,f.y,rr_,0,TAU);c.stroke();}}
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
}
/* ---------- météo (espace écran, parallaxe avant) ---------- */
const WEA=[];let WCX=null,WCY=null;
function weaType(mix){let r=Math.random(),acc=0;for(const m of mix){acc+=m.w;if(r<=acc)return BIO[m.b].wea;}return BIO[mix[0].b].wea;}
function drawWeather(mix){
  const c=ctx,n=QL>=3?64:QL===2?40:22,k=Math.min(3,RDT/16.67);EMK=coreK(CAM.x,CAM.y);
  while(WEA.length<n)WEA.push({t:null});
  let dcx=0,dcy=0;if(WCX!==null){dcx=(CAM.x-WCX)*RZ*1.3;dcy=(CAM.y-WCY)*RZ*1.3;if(Math.abs(dcx)>200||Math.abs(dcy)>200)dcx=dcy=0;}WCX=CAM.x;WCY=CAM.y;
  for(let i=0;i<n;i++){const p=WEA[i];
    if(!p.t){p.t=weaType(mix);p.x=Math.random()*W;p.y=Math.random()*H;p.s=Math.random();p.a=Math.random()*TAU;}
    p.x-=dcx;p.y-=dcy;
    switch(p.t){
      case 'pollen':p.x+=Math.sin(RT*.02+p.a)*.35*k;p.y-=.18*k;break;
      case 'petals':p.x+=.9*k;p.y+=.6*k;p.a+=.03*k;break;
      case 'bubbles':p.y-=(.5+p.s)*k;p.x+=Math.sin(RT*.05+p.a)*.4*k;break;
      case 'wind':p.x+=(6+p.s*6)*k;break;
      case 'data':p.y+=(4+p.s*5)*k;break;
      case 'rain':p.x-=2*k;p.y+=(11+p.s*6)*k;break;
      case 'snow':p.y+=(.6+p.s*.8)*k;p.x+=Math.sin(RT*.02+p.a)*.5*k;break;
      case 'embers':p.y-=(.8+p.s)*k;p.x+=Math.sin(RT*.04+p.a)*.6*k;break;
    }
    const m=40;
    if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m){p.t=weaType(mix);p.s=Math.random();
      if(p.x<-m)p.x+=W+2*m;else if(p.x>W+m)p.x-=W+2*m;if(p.y<-m)p.y+=H+2*m;else if(p.y>H+m)p.y-=H+2*m;
      if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m){p.x=Math.random()*W;p.y=Math.random()*H;}}
    switch(p.t){
      case 'pollen':c.globalCompositeOperation='lighter';glow(p.x,p.y,2+p.s*3,'#d6ff7a',.25+.4*Math.pow(Math.sin(RT*.05+p.a),2));break;
      case 'petals':c.globalCompositeOperation='source-over';c.globalAlpha=.6;c.fillStyle=p.s<.5?'#ff8fe0':'#ffd166';c.beginPath();c.ellipse(p.x,p.y,4+p.s*3,2,p.a,0,TAU);c.fill();break;
      case 'bubbles':c.globalCompositeOperation='source-over';c.globalAlpha=.35;c.strokeStyle='#cffcff';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,2+p.s*4,0,TAU);c.stroke();break;
      case 'wind':c.globalCompositeOperation='source-over';c.globalAlpha=.12;c.strokeStyle='#fff';c.lineWidth=1.2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-40-p.s*60,p.y);c.stroke();break;
      case 'data':c.globalCompositeOperation='lighter';c.globalAlpha=.45;c.strokeStyle=p.s<.8?'#2de2ff':'#ff2d95';c.lineWidth=1.5;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-8-p.s*14);c.stroke();break;
      case 'rain':c.globalCompositeOperation='source-over';c.globalAlpha=.28;c.strokeStyle='#bcd8ff';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+3,p.y-17);c.stroke();break;
      case 'snow':c.globalCompositeOperation='source-over';c.globalAlpha=.75;c.fillStyle='#fff';c.beginPath();c.arc(p.x,p.y,1+p.s*2,0,TAU);c.fill();break;
      case 'embers':c.globalCompositeOperation='lighter';glow(p.x,p.y,(2+p.s*2.5)*(.7+.5*EMK),'#ff8a2d',(.4+.3*Math.sin(RT*.3+p.a))*(.45+.75*EMK));break;
    }
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
}
/* ---------- textes, indicateurs, post-traitement ---------- */
function edgePoint(x,y,m){const cx=W/2,cy=H/2,dx=x-cx,dy=y-cy,s=Math.min((W/2-m)/Math.abs(dx||1e-6),(H/2-m)/Math.abs(dy||1e-6));return[cx+dx*s,cy+dy*s,Math.atan2(dy,dx)];}
/* hors champ : flèches des ennemis (pas des proies), losanges des power-ups, grande flèche du boss */
function drawIndicators(){
  const c=ctx;let n=0;const off=s=>s[0]<-10||s[0]>W+10||s[1]<-10||s[1]>H+10;
  const arrow=(x,y,a,col,sz)=>{c.save();c.translate(x,y);c.rotate(a);c.fillStyle=col;c.beginPath();c.moveTo(sz,0);c.lineTo(-sz*.7,sz*.7);c.lineTo(-sz*.7,-sz*.7);c.closePath();c.fill();c.restore();};
  for(const e of G.en){if(e.spawn>0||e.prey||n>8)continue;const s=w2s(e.x,e.y);if(!off(s))continue;n++;const q=edgePoint(s[0],s[1],22);c.globalAlpha=.8;arrow(q[0],q[1],q[2],e.col,e.elite?10:7);}
  for(const p of G.pus){const s=w2s(p.x,p.y);if(!off(s))continue;const q=edgePoint(s[0],s[1],26);c.globalAlpha=.9;c.save();c.translate(q[0],q[1]);c.rotate(Math.PI/4);c.fillStyle=PUC;c.fillRect(-6,-6,12,12);c.restore();}
  const B=G.boss;if(B&&!B.gone){const s=w2s(B.x,B.y);if(off(s)){const q=edgePoint(s[0],s[1],30);c.globalAlpha=1;arrow(q[0],q[1],q[2],bossCol(B),14);}}
  c.globalAlpha=1;
}
function drawTexts(){
  const c=ctx;c.textAlign='center';c.textBaseline='middle';
  for(const t of G.tx){const s=w2s(t.x,t.y);c.globalAlpha=Math.min(1,t.life/15);c.font='700 '+t.size+'px '+FD;c.fillStyle='rgba(8,4,16,.8)';c.fillText(t.s,s[0]+1.5,s[1]+1.5);c.fillStyle=t.col;c.fillText(t.s,s[0],s[1]);}
  c.globalAlpha=1;
}
function postFX(){
  const c=ctx;c.setTransform(1,0,0,1,0,0);const cw=cv.width,ch=cv.height;
  if(G&&G.glitch>0&&!REDUCED){const n=Math.min(4,2+Math.floor(G.glitch/8));c.globalCompositeOperation='lighter';
    for(let i=0;i<n;i++){c.fillStyle=rgba(i%2?COL.mg:COL.cy,.07+.05*Math.min(1,G.glitch/20));c.fillRect(0,Math.random()*ch,cw,fr(4,34)*PS);}c.globalCompositeOperation='source-over';}
  /* dernier segment de membrane : le bord de l'écran rougit et bat */
  const P=G&&G.p,danger=P&&!P.dead&&P.seg<=1&&P.segMax>1&&G.state==='play',red=Math.max(G&&G.hurtT>0?G.hurtT/22*.45:0,danger?.2+.15*Math.sin(G.t*.2):0);
  cssOp('hurt',Math.min(1,red*1.6));cssOp('flash',G&&G.flash>0?G.flash*.6:0);
}
const CSSV={};
function cssOp(id,v){v=Math.round(v*50)/50;if(CSSV[id]===v)return;CSSV[id]=v;const e=$(id);if(e)e.style.opacity=v;}
/* boutons tactiles (espace du HUD) : dash en bas à droite, gonfler juste au-dessus */
function dashBtn(){return{x:W-62,y:H-92,r:34};}
function gonBtn(){return{x:W-62,y:H-180,r:30};}
function drawHUD(){
  const c=ctx,P=G.p,pad=14,narrow=W<600;
  c.textBaseline='top';c.textAlign='left';
  /* Pendant le passage d'un îlot à l'autre, rien : la cinématique copie l'écran (trSnap) et le fait rétrécir. */
  if(G.state!=='trans'){
    /* 1. les 8 îlots (faits, en cours, à venir) ; dessous, les 3 vagues et le boss de l'îlot */
    const sp=narrow?17:22,x0=W/2-(NISL-1)*sp/2,y0=pad+10;c.lineWidth=1.5;
    for(let i=0;i<NISL;i++){const k=i+1,x=x0+i*sp,col=BIO[ISL[i]].a;
      if(i<NISL-1){c.globalAlpha=k<G.isl?.6:.2;c.fillStyle=k<G.isl?col:'#cfc9ee';c.fillRect(x+6,y0-1,sp-12,2);}
      c.globalAlpha=1;c.beginPath();c.arc(x,y0,k===G.isl?6:4,0,TAU);
      if(k<G.isl){c.fillStyle=col;c.fill();}
      else if(k===G.isl){c.fillStyle=col;c.fill();c.strokeStyle=col;c.globalAlpha=.55+.45*Math.sin(RT*.1);c.beginPath();c.arc(x,y0,10,0,TAU);c.stroke();c.globalAlpha=1;}
      else{c.strokeStyle='rgba(207,201,238,.5)';c.stroke();}}
    const y1=y0+20,ws=14,bph=G.ph==='preboss'||G.ph==='boss';
    for(let w=1;w<=NWAVE+1;w++){const x=W/2+(w-(NWAVE+2)/2)*ws*1.6;
      if(w>NWAVE){c.fillStyle=G.ph==='clear'?'#efeaff':bph?bossCol({k:G.isl,D:BOSS[G.isl-1]}):'rgba(207,201,238,.25)';c.beginPath();c.moveTo(x,y1-6);c.lineTo(x+6,y1);c.lineTo(x,y1+6);c.lineTo(x-6,y1);c.closePath();c.fill();}
      else{const done=G.wave>w||G.wave===w&&G.ph!=='wave',cur=G.wave===w&&G.ph==='wave';c.fillStyle=done?'#efeaff':cur?BIO[G.biome].a:'rgba(207,201,238,.25)';c.fillRect(x-ws/2,y1-2.5,ws,5);}}
    /* 2. le boss : son nom et sa vie ; sinon, l'annonce de la vague */
    const B=G.boss;
    if(B&&!B.gone){const w=Math.min(440,W-pad*2-(narrow?0:200)),x=(W-w)/2,y=y1+14,f=B.spawn>0?1-B.spawn/110:Math.max(0,B.hp/B.mhp),col=bossCol(B);
      c.textAlign='center';c.textBaseline='top';fitFont(c,B.D.n,w,narrow?13:15,'700');c.fillStyle=col;c.fillText(B.D.n+(B.phase>1?' · phase '+B.phase:''),W/2,y);
      c.fillStyle='rgba(255,255,255,.1)';c.fillRect(x,y+20,w,8);c.fillStyle=B.trans>0&&(G.t>>2)%2?'#fff':col;c.fillRect(x,y+20,w*f,8);
      c.fillStyle='rgba(12,7,22,.9)';for(const m of B.k===8?[.34,.67]:[.5])c.fillRect(x+w*m-1,y+20,2,8);}
    else if(G.wbn){c.globalAlpha=Math.max(0,Math.min(1,G.wbn.t/10,(150-G.wbn.t)/25));c.textAlign='center';c.textBaseline='top';c.font='700 '+(narrow?14:16)+'px '+FD;c.fillStyle=BIO[G.biome].a;c.fillText('Vague '+G.wbn.w+' sur '+NWAVE,W/2,y1+14);c.globalAlpha=1;}
    /* 3. le score, discret, sous les boutons du coin */
    c.textAlign='right';c.textBaseline='top';c.font='700 '+(narrow?16:20)+'px '+FD;c.fillStyle='#efeaff';c.fillText(fmt(G.score),W-pad,64);
    /* 4. commandes tactiles ; au clavier, seul le rappel « gonfler » quand la jauge est pleine */
    if(inp.touch){const L=inp.L,Rs=inp.R;
      for(const s of [L,Rs]){if(!s)continue;c.globalAlpha=.25;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(s.ox,s.oy,60,0,TAU);c.stroke();c.fillStyle=s===L?COL.cy:COL.mg;c.beginPath();c.arc(s.x,s.y,24,0,TAU);c.fill();c.globalAlpha=1;}
      c.textAlign='center';c.textBaseline='middle';c.font='700 22px '+FD;
      if(!P.noDash){const db=dashBtn(),rdy=P.dashT<=0;c.globalAlpha=rdy?.8:.35;c.strokeStyle=COL.cy;c.lineWidth=2;c.beginPath();c.arc(db.x,db.y,db.r,0,TAU);c.stroke();
        if(!rdy){c.lineWidth=4;c.beginPath();c.arc(db.x,db.y,db.r-5,-Math.PI/2,-Math.PI/2+TAU*(1-P.dashT/P.dashMax));c.stroke();}
        c.fillStyle='#fff';c.fillText('⚡',db.x,db.y);}
      const gb=gonBtn(),full=P.gauge>=1&&P.gon<=0;c.globalAlpha=full?.95:.4;c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.arc(gb.x,gb.y,gb.r,0,TAU);c.stroke();
      if(full){c.fillStyle='rgba(255,255,255,.2)';c.fill();}else{c.lineWidth=4;c.beginPath();c.arc(gb.x,gb.y,gb.r-5,-Math.PI/2,-Math.PI/2+TAU*(P.gon>0?P.gon/P.gonMax:P.gauge));c.stroke();}
      c.fillStyle='#fff';c.fillText('◉',gb.x,gb.y);c.globalAlpha=1;}
    else if(P.gauge>=1&&P.gon<=0){c.textAlign='center';c.textBaseline='bottom';c.font='700 14px '+FD;c.globalAlpha=.7+.3*Math.sin(RT*.2);c.fillStyle='#ffffff';c.fillText('E ou clic droit : gonfler',W/2,H-pad);c.globalAlpha=1;}
  }
  /* jusqu'à la copie de l'écran (trSnap), le compteur se tait aussi : sinon il s'imprime dans la relique de l'îlot suivant */
  if(meta.fps&&!(G.state==='trans'&&G.tr&&G.tr.t<=TR_SNAP)){c.textAlign='left';c.textBaseline='bottom';c.fillStyle='#8f89b3';
    /* ---- Compteur de diagnostic : TOUT doit tenir dans la largeur du canvas -----------------
       Mesure sur Galaxy S22 (29/09/2026) : canvas de 617 px de large pour 411 px de largeur de
       DESSIN (PS 1.50). Les lignes « PS … marge audio » et « ou : … » debordaient des DEUX cotes
       et etaient illisibles — or c'est l'instrument avec lequel le joueur mesure, donc un defaut
       qui empeche de mesurer. Trois mecanismes, dans cet ordre :
         1. la ligne materielle est PAVEE : un morceau n'est ajoute que s'il tient encore, sinon on
            ouvre la ligne suivante — le nombre de lignes s'adapte donc a la largeur ;
         2. une ligne trop longue voit sa police reduite (plancher 9 px : `fitFont` s'arrete a 10,
            ce qui ne suffisait pas ici) ;
         3. si elle ne tient toujours pas, on retire des morceaux par la FIN et on marque « … » :
            l'ordre est celui de l'importance, donc ce sont les moins utiles qui partent.
       L'etat de la cuisson est AFFICHE et non suppose : sans worker (navigateur sans
       OffscreenCanvas, worker en panne), le jeu retombe SILENCIEUSEMENT sur la cuisson sur place.
       Sans ce mot, une comparaison « avec / sans ?wk=1 » peut comparer deux fois le meme chemin.
       « worker N » : N = chunks recus du worker ; 0 = rien n'est encore passe par lui. */
    const PX0=narrow?10:12,DYS=narrow?15:16;
    /* Le bloc ne doit chevaucher AUCUN bouton. L'ancre fixe d'avant (H-132 sur tactile, H-pad-20
       sur poste fixe) ne protegeait que le bouton de dash : avec 5 lignes le bloc montait de H-208
       a H-126 sur toute la largeur et passait PAR-DESSUS les emplacements de competence de gcSlots()
       (gc.js) — « worker 558 », « marge audio » et « soft » sur le bouton AUTEL (constate sur
       capture le 30/09/2026) ; sur poste fixe il traversait les trois emplacements du centre.
       On ne devine donc plus une ancre : on lit les VRAIES positions (dashBtn, gonBtn), elargies
       a la zone de TOUCHER (rayon + 10, comme touchBtnAt de g4.js) et au libelle pose dessous, et
       le bloc monte jusqu'a n'en couper aucune. Sur poste fixe il reste au-dessus de la ligne
       « Dash pret (Espace) » (y = H-pad). Si, pleine largeur, il devait monter dans la moitie
       haute (telephone couche), on le pave plus etroit, A GAUCHE des boutons : rien n'est retire. */
    const ZB=[];if(inp.touch)for(const d of [dashBtn(),gonBtn()])ZB.push([d.x-d.r-10,d.y-d.r-10,d.x+d.r+10,d.y+d.r+10]);
    const cuis=(typeof WK==='undefined'||WK===null)?'?':(WK?'worker '+WKN:'sur place');
    /* Etat REEL de la regulation, en tete de la ligne materielle : le reglage choisi (meta.q) et ce
       qu'il vaut a cet instant (QL, RES). « auto » = la qualite s'adapte ; « plafond <cran> » = un
       prereglage manuel, ou la descente reste possible mais ou la remontee s'arrete au cran choisi.
       « ↓ » signale que la qualite est DESCENDUE sous son plafond a cet instant.
       ⚠️ Ce mot a d'abord ete ecrit « FIGÉE » (chantier P3), en se fondant sur le `return` de g4.js
       qui sortait de perf() des que meta.q n'etait pas auto. Le chantier P2 a supprime ce return le
       meme jour : en manuel, perf() descend desormais. « FIGÉE » serait donc devenu un mensonge —
       exactement le defaut que ce compteur existe pour empecher (un reglage qui n'adapte plus sans
       que rien ne le dise). Ne pas y revenir. Le cran est lu dans QPRE (g4.js, globale du bundle). */
    /* « saut N/2 P x ms W y s » (chantier FLUIDITE 2) : le filet de budget de g4.js — SKIPD (0 tout dessine, 1 sans
       decoratif, 2 sans halos), SKP la periode d'ecran qu'il croit voir (a comparer a « ref »), SKW l'attente avant
       de redescendre. Sans lui, un saut engage a vie ne se distinguait pas d'une scene pauvre. */
    const rq=meta.q||'auto',capq=rq==='auto'?[3,1]:QPRE[rq],dsc=QL<capq[0]||RES<capq[1];
    const seg3=['régul '+(rq==='auto'?'auto':'plafond '+rq+(dsc?' ↓':''))+' '+QL+'/3 ×'+RES.toFixed(2),'PS '+PS.toFixed(2),'canvas '+cv.width+'×'+cv.height,'DPR '+DPR,'ref '+REFDT.toFixed(1)+' ms'].concat(typeof SKIPD==='number'?['saut '+SKIPD+'/2 P '+SKP.toFixed(1)+' ms W '+(SKW/1e3).toFixed(0)+' s']:[],['cuisson '+cuis]);
    if(DIAG_MARGIN>=0)seg3.push('marge audio '+DIAG_MARGIN.toFixed(2)+' s');
    /* jointure : « · » entre morceaux, mais un simple espace apres un morceau qui finit par « : »
       — sinon la ligne s'ecrit « ou : · render 6.06/12 » au lieu de « ou : render 6.06/12 ». */
    const jn=a=>{let s='';for(let i=0;i<a.length;i++)s+=(i?(a[i-1].slice(-1)===':'?' ':' · '):'')+a[i];return s;};
    const MWj=a=>c.measureText(jn(a)).width;
    /* PIRE IMAGE (chantier J0) : ce qui s'est passe dans l'image dont l'intervalle est le plus long
       de la seconde — UNE image, pas des maxima independants (voir DIAG_W, g4.js). « JS » = le JS de
       CETTE image ; gen = genChunk ; spr = sprites d'obstacles crees ; reçus = chunks arrives du
       worker pendant l'intervalle ; collés = cuissons dessinees pour la premiere fois. « JS ? » =
       premiere image apres une reprise : ce qui la precede n'a pas ete mesure. Pas de detail tant que
       rien n'est publie. Si tout tient sur la ligne des ips (poste fixe), le detail la COMPLETE et
       aucune ligne n'est ajoutee ; sinon il a sa ligne, pavee comme les autres, sous la ligne materielle. */
    const pw=typeof DIAG_WORST!=='undefined'&&DIAG_WORST||null,pk='pire '+(pw?pw[0]:DIAG_PEAK).toFixed(0)+' ms';
    /* chantier A4 — le « hors JS » de CETTE image, nomme : retard = temps que le rappel N-1 a attendu avant de
       commencer ; wkRecv cumul/pire appel entre les deux rappels ; « réel » seulement si l'intervalle a ete
       plafonne a 100 ms ; longtask = la pire tâche longue de la seconde vue par le NAVIGATEUR (nom, attribution).
       Tout champ non mesure ou invalide s'ecrit « ? », l'API absente « absent » : jamais un zero de remplacement. */
    /* chantier A6 — la pire image longue de la seconde selon LoAF (DIAG_LFP, g4.js), APRES longtask : phase dominante
       (script, style/layout, ou « ni script ni style » quand le reste l'emporte), le plus long script de scripts[] (nom
       tronque a 14 signes) ou « aucun script » si la liste est VIDE, le style/layout, et « bloq » si blockingDuration
       est nettement plus court (< 3/4). PAS UNE LIGNE DE PLUS en regime calme : quand longtask ET loaf observent et
       n'ont rien vu, les deux mots fusionnent en « LT/LoAF aucune » (14 signes), PAS plus long que le « longtask
       aucune » d'A4 qu'il remplace a la meme place : le pavage glouton coupe donc exactement comme avant, 320 px en
       police large compris. Le detail (2 a 4 morceaux paves) ne s'ecrit que quand il y a eu une image longue. */
    const lf=typeof DIAG_LFP!=='undefined'?DIAG_LFP:null,lfs=typeof LF_ST!=='undefined'?LF_ST:0,
      trn=n=>n.length>14?n.slice(0,13)+'…':n,
      segL=lfs===-1?['loaf absent']:lfs!==1||!lf?['loaf ?']:!(lf[0]>0)?['loaf aucune']:
        [(r=>'loaf '+lf[0].toFixed(0)+' ms : '+(lf[2]>=lf[3]&&lf[2]>=r?'script':lf[3]>=r?'style/layout':'ni script ni style'))(lf[0]-lf[2]-lf[3]),
         lf[4]?'« '+trn(lf[4])+' » '+lf[5].toFixed(0)+' ms':'aucun script','style '+lf[3].toFixed(0)+' ms'].concat(lf[1]<lf[0]*.75?['bloq '+lf[1].toFixed(0)+' ms']:[]);
    const nb=v=>typeof v==='number'&&v>=0,lp=DIAG_LTP;
    const segW=pw?[pk+' :','JS '+(pw[1]<0?'?':pw[1].toFixed(1)+' ms'),'gen '+pw[2],'spr '+pw[3],'reçus '+pw[4],'collés '+pw[5],
      'retard '+(nb(pw[6])?pw[6].toFixed(1)+' ms':'?'),'wkRecv '+(nb(pw[7])?pw[7].toFixed(2)+'/'+pw[8].toFixed(2)+' ms':'?')]
      .concat(nb(pw[9])&&pw[9]>pw[0]+.5?['réel '+pw[9].toFixed(0)+' ms']:[],
        [LT_ST===-1?'longtask absent':LT_ST!==1||!lp?'longtask ?':lp[0]>0?'longtask '+lp[0].toFixed(0)+' ms ('+lp[1]+', '+lp[2]+')':'longtask aucune'],segL).join('\n').replace('longtask aucune\nloaf aucune','LT/LoAF aucune').split('\n'):null;
    /* mise en page pour une largeur MW donnee, puis pose : le bloc part du bas et monte au-dessus
       de chaque zone qu'il coupe (il ne fait que monter : au plus une passe par zone). */
    const pose=MW=>{
      /* les trois lignes de mesure sont PAVEES (un morceau qui ne tient plus ouvre la ligne suivante) :
         rien n'est tronque, meme a 320 px en police large. Seule « ou : » se raccourcit par la fin. */
      const out=[];c.font='500 '+PX0+'px '+FD;
      const g0=[FPSV+' ips','image '+DIAG_DT.toFixed(1)+' ms'],g1=segW?g0.concat(segW):null,un=!!g1&&MWj(g1)<=MW;
      for(const g of [un?g1:g0.concat([pk]),
                      ['JS '+DIAG_JS.toFixed(1)+' ms','hors-JS '+Math.max(0,DIAG_DT-DIAG_JS).toFixed(1)+' ms','effets '+QL+'/3','resol '+Math.round(RES*100)+' %'],seg3].concat(SOLD&&(SOLM===1||SOLON)?[SOLD]:[]).concat(segW&&!un?[segW]:[])){
        let cu=[];for(const s of g){if(cu.length&&MWj(cu.concat([s]))>MW){out.push(cu);cu=[];}cu.push(s);}
        if(cu.length)out.push(cu);}
      if(typeof JSPROFTOP!=='undefined'&&JSPROFTOP.length)out.push(['où :'].concat(JSPROFTOP.map(q=>q[0]+' '+q[1].toFixed(2)+'/'+q[2].toFixed(0))));
      const dr=[];let wmax=0;
      for(let i=0;i<out.length;i++){let n=out[i].length,p=PX0;c.font='500 '+p+'px '+FD;
        const tex=k=>jn(out[i].slice(0,k))+(k<n?' …':'');
        while(n>1&&c.measureText(tex(n)).width>MW)n--;
        const t=tex(n);let w=c.measureText(t).width;
        if(w>MW&&p>9){p=Math.max(9,Math.floor(p*MW/w));w=MW;}
        w=Math.min(w,MW);if(w>wmax)wmax=w;dr.push([t,w,p]);}
      const bh=(dr.length-1)*DYS+22;let yb=inp.touch?H-pad-6:H-pad-20;
      for(let k=0;k<=ZB.length;k++){let hit=0;for(const z of ZB)if(z[0]<pad+wmax+6&&z[2]>pad-6&&z[1]<yb+6&&z[3]>yb+6-bh){yb=z[1]-7;hit=1;}if(!hit)break;}
      return{dr,wmax,bh,yb};};
    let B=pose(W-pad*2);
    if(B.yb+6-B.bh<H*.5){let zl=W;for(const z of ZB)if(z[0]<zl)zl=z[0];const B2=pose(Math.max(120,zl-pad-13));if(B2.yb-B2.bh>B.yb-B.bh)B=B2;}
    const dr=B.dr,y0=B.yb-(dr.length-1)*DYS;
    /* Fond : en gris clair sur un terrain clair le compteur devient illisible (constate a
       l'ecran). Un bandeau sombre derriere le bloc, pose AVANT le texte, garantit la lecture
       quel que soit le biome dessous. */
    c.fillStyle='rgba(8,5,18,.62)';c.fillRect(pad-6,y0-16,B.wmax+12,B.bh);
    c.fillStyle='#8f89b3';
    /* chaque ligne est ecrite avec SA police : la reduction d'une ligne ne valait, avant, que si
       c'etait la derniere (c.font gardait la police de la derniere ligne mesuree). */
    for(let i=0;i<dr.length;i++){c.font='500 '+dr[i][2]+'px '+FD;c.fillText(dr[i][0],pad,y0+i*DYS);}}
  G.toasts.forEach((t,i)=>{const a=Math.min(1,t.t/10,(200-t.t)/20);c.globalAlpha=Math.max(0,a);c.textAlign='center';c.textBaseline='top';fitFont(c,t.s,W-40,15,'700');const y=(narrow?H*.62:H*.72)+i*30,w=c.measureText(t.s).width+28;
    c.fillStyle='rgba(20,12,34,.9)';c.fillRect(W/2-w/2,y,w,24);c.strokeStyle=COL.gd;c.lineWidth=1;c.strokeRect(W/2-w/2+.5,y+.5,w-1,23);c.fillStyle=COL.gd;c.fillText(t.s,W/2,y+4);});
  c.globalAlpha=1;
  const bn=G.banner;
  if(bn){const a=Math.min(1,bn.t/12,(bn.max-bn.t)/20),y=W<600?H*.4:H*.3;c.globalAlpha=Math.max(0,a);c.textAlign='center';c.textBaseline='middle';const sz=fitFont(c,bn.s,W-28,Math.min(54,W*.095),'700');
    if(bn.t<12){c.fillStyle=rgba(COL.mg,.7);c.fillText(bn.s,W/2-4,y);c.fillStyle=rgba(COL.cy,.7);c.fillText(bn.s,W/2+4,y);}
    c.fillStyle=bn.col;c.fillText(bn.s,W/2,y);if(bn.sub){fitFont(c,bn.sub,W-24,16,'500');c.fillStyle='#e6e2ff';c.fillText(bn.sub,W/2,y+sz*.7);}c.globalAlpha=1;}
}

/* ---------- passage d'un îlot au suivant (g2.js updTrans) ----------
   À TR_SNAP, l'écran (l'îlot entier, vu de loin, la bulle gonflée au centre) est copié, puis l'îlot suivant est généré :
   sa relique, au centre, EST l'îlot quitté en miniature (gw.js relicInto). La copie rétrécit jusqu'au disque de la
   relique et s'y fond : la dimension visible change d'échelle. Hors navigateur (harnais), rien n'est copié. */
let TRS=null;
function trSnap(){if(typeof document==='undefined'||!cv.width)return;if(!TRS||TRS.width!==cv.width||TRS.height!==cv.height)TRS=mkCanvas(cv.width,cv.height);
  const g=TRS.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='copy';g.drawImage(cv,0,0);g.globalCompositeOperation='source-over';TRS.ok=1;
  /* la relique de l'îlot suivant : le disque de l'îlot (rayon WR) recadré à la résolution du sol (un pixel par unité de monde) */
  const R0=PS*WR*zoomFull(),N=512,rc=mkCanvas(N,N),rg=rc.getContext('2d');rg.fillStyle='#05030c';rg.fillRect(0,0,N,N);
  rg.imageSmoothingEnabled=true;rg.drawImage(cv,PS*W/2-R0,PS*H/2-R0,2*R0,2*R0,0,0,N,N);RELSNAP={run:G.seed,k:G.isl+1,img:rc,data:null};}
function drawTrSnap(){const T=G.tr;if(!T||!TRS||!TRS.ok||T.t<=TR_SNAP)return;
  const f=Math.min(1,(T.t-TR_SNAP)/(TR_SHRINK-TR_SNAP));if(f>=1){TRS.ok=0;return;}
  const e=f*f*(3-2*f),s=1+(RELR/WR-1)*e,cx=PS*W/2,cy=PS*H/2,R=PS*(WR+40)*zoomFull()*s,c=ctx;
  c.setTransform(1,0,0,1,0,0);c.save();c.beginPath();c.arc(cx,cy,R,0,TAU);c.clip();
  c.globalAlpha=f<.7?1:1-(f-.7)/.3;c.drawImage(TRS,cx-cx*s,cy-cy*s,TRS.width*s,TRS.height*s);c.restore();
  const b=BIO[ISL[G.isl-2]];c.globalCompositeOperation='lighter';c.globalAlpha=.7*(1-f);c.strokeStyle=b?b.a:'#ffffff';c.lineWidth=3*PS;c.beginPath();c.arc(cx,cy,R,0,TAU);c.stroke();
  c.globalAlpha=1;c.globalCompositeOperation='source-over';screenTf();}
