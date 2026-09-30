/* =========================================================
   RENDU (interpolé, sprites pré-calculés)
   ========================================================= */
const cv=$('cv');let ctx=cv.getContext('2d',{alpha:false});const MAINCTX=ctx;
let QL=3,W=800,H=600,DPR=1,RES=1,PS=1,RZ=1,RSX=0,RSY=0,VL=0,VT=0,VR=0,VB=0,RT=0,FRAME=0,VIG=null,CAUSP=null,SPRB=0,RDT=16.7;
const CAM={x:0,y:0,z:1},HCOL=[COL.mg,COL.or,COL.rd];
let SAFE={t:0,b:0,l:0,r:0};
function readSafe(){const d=document.getElementById('safeprobe');if(!d)return;const cs=getComputedStyle(d);SAFE={t:parseFloat(cs.paddingTop)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0,r:parseFloat(cs.paddingRight)||0};}
function fitFont(c,s,maxW,px,wt){c.font=wt+' '+px+'px '+FD;const w=c.measureText(s).width;if(w>maxW){px=Math.max(10,Math.floor(px*maxW/w));c.font=wt+' '+px+'px '+FD;}return px;}
function resize(){readSafe();const r=cv.parentElement.getBoundingClientRect();W=Math.max(300,r.width);H=Math.max(300,r.height);DPR=Math.min(2,window.devicePixelRatio||1);applyRes();}
function applyRes(){PS=Math.min(DPR,QL>=3?(COARSE?1.5:2):QL===2?1.25:1)*RES;cv.width=Math.round(W*PS);cv.height=Math.round(H*PS);
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
function glow(x,y,r,col,a){ctx.globalAlpha=a;ctx.drawImage(glowSpr(col),x-r,y-r,r*2,r*2);}
function soft(x,y,r,col,a){ctx.globalAlpha=a;ctx.drawImage(softSpr(col),x-r,y-r,r*2,r*2);}
function buildCaus(){const s=256,c=mkCanvas(s,s),g=c.getContext('2d');g.strokeStyle='rgba(170,240,255,.6)';g.lineWidth=2.2;
  for(let k=0;k<9;k++){g.beginPath();for(let x=0;x<=s;x+=4){const y=k*s/9+Math.sin(x/s*TAU*2+k)*9+Math.sin(x/s*TAU*3+k*2)*5;if(x)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}
  for(let k=0;k<9;k++){g.beginPath();for(let y=0;y<=s;y+=4){const x=k*s/9+Math.sin(y/s*TAU*2+k*1.7)*9+Math.sin(y/s*TAU*3+k)*5;if(y)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}
  CAUSP=ctx.createPattern(c,'repeat');}

/* ---------- interpolation entre deux pas de logique ---------- */
const SW=[];
function lerpObj(o,A){if(o.px===undefined)return;o._x=o.x;o._y=o.y;o.x=o.px+(o.x-o.px)*A;o.y=o.py+(o.y-o.py)*A;SW.push(o);}
function lerpArr(a,A){for(let i=0;i<a.length;i++)lerpObj(a[i],A);}
function lerpIn(A){SW.length=0;lerpObj(G.p,A);
  /* angle du vaisseau : interpolé, et en visée souris on prend directement la position actuelle du curseur (zéro latence) */
  {const P=G.p;P._ang=P.ang;if(P.pang!==undefined)P.ang=P.pang+angDiff(P.pang,P.ang)*A;
   if(G.aimMan&&!inp.touch&&!P.dead&&G.state==='play'){const sx=(P.x-CAM.x)*RZ+W/2,sy=(P.y-CAM.y)*RZ+H/2;P.ang=Math.atan2(inp.my-sy,inp.mx-sx);}}lerpArr(G.en,A);lerpArr(G.pb,A);lerpArr(G.eb,A);lerpArr(G.pk,A);lerpArr(G.fx,A);
  const B=G.boss;if(B){lerpObj(B,A);lerpArr(B.nodes,A);}for(const h of G.hearts)lerpArr(h.nodes,A);}
function lerpOut(){for(let i=0;i<SW.length;i++){const o=SW[i];o.x=o._x;o.y=o._y;}SW.length=0;if(G&&G.p&&G.p._ang!==undefined)G.p.ang=G.p._ang;}
function w2s(x,y){return[(x-CAM.x)*RZ+W/2+RSX,(y-CAM.y)*RZ+H/2+RSY];}
function vis(x,y,r){return x+r>VL&&x-r<VR&&y+r>VT&&y-r<VB;}
function worldTf(){ctx.setTransform(PS*RZ,0,0,PS*RZ,PS*(W/2+RSX-CAM.x*RZ),PS*(H/2+RSY-CAM.y*RZ));}
function screenTf(){ctx.setTransform(PS,0,0,PS,0,0);}

/* couche basse résolution (1/4) : décor lointain + grands halos additifs. Dessinée 16× moins de pixels, puis étirée une fois. */
let LOWC=null,LOWG=null,LOWN=0,LOWDOM=false;
function lowBegin(){const w=Math.max(8,Math.ceil(cv.width/4)),h=Math.max(8,Math.ceil(cv.height/4));
  if(!LOWC){LOWC=$('low')||mkCanvas(w,h);LOWG=LOWC.getContext('2d');LOWDOM=!!$('low');}if(LOWC.width!==w||LOWC.height!==h){LOWC.width=w;LOWC.height=h;}
  LOWG.setTransform(1,0,0,1,0,0);LOWG.globalCompositeOperation='source-over';LOWG.globalAlpha=1;LOWG.clearRect(0,0,w,h);LOWN=0;ctx=LOWG;}
function lowWorld(){ctx.setTransform(PS*RZ/4,0,0,PS*RZ/4,PS*(W/2+RSX-CAM.x*RZ)/4,PS*(H/2+RSY-CAM.y*RZ)/4);}
function lowScreen(){ctx.setTransform(PS/4,0,0,PS/4,0,0);}
function lowEnd(){ctx=MAINCTX;if(!LOWN||LOWDOM)return;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';ctx.imageSmoothingEnabled=true;ctx.drawImage(LOWC,0,0,cv.width,cv.height);ctx.globalCompositeOperation='source-over';}
/* grands halos du monde (joueur, cœurs, noyau, explosions) : dans la couche basse résolution */
function drawLowGlows(){
  const c=ctx;c.globalCompositeOperation='lighter';
  if(G&&G.p){const P=G.p;
    if(!P.dead){soft(P.x,P.y,250,P.col,.08+P.glow*.06);LOWN++;}
    for(const h of G.hearts){if(h.state==='dead'||!vis(h.x,h.y,h.r*3.2))continue;soft(h.x,h.y,h.r*3.2,HCOL[h.i],.35+(h.flash>0?.3:0));LOWN++;}
    const L=WD.core;if(!G.boss&&vis(L.x,L.y,300)){const open=G.lair.open;soft(L.x,L.y,open?280:180,COL.rd,open?.35+.15*Math.sin(RT*.08):.15);LOWN++;}
    for(const f of G.fx){if(f.ty!==4||!vis(f.x,f.y,f.r))continue;const a=f.life/f.max;soft(f.x,f.y,f.r*(1.2-a*.2),f.col,a*.45);LOWN++;}}
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
}
function chunksCover(){const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy);if(!c||!c.bake&&!c.bk)return false;}return true;}
/* Niveau de degradation decide par la boucle (g4.js) : 0 = tout dessiner, 1 = les postes
   decoratifs cedent, 2 = en plus les halos et la mini-carte. Le jeu n'a aucun budget global
   par image : seule la cuisson en avait un. Quand l'image ne tient pas dans son budget, ce
   sont les postes dont l'absence ne se voit pas qui doivent ceder, pas le monde ni le joueur.
   Le test typeof est volontaire : si la boucle n'expose pas SKIPD, on dessine tout (aucune
   dependance dure entre les deux modules). */
function skLev(){return typeof SKIPD==='number'?SKIPD:0;}
/* Fond gelé. En pause le monde ne change plus : le redessiner entier coûte le prix du jeu pour un
   résultat identique — et comme le fond n'est rendu qu'une image sur quatre dans cet état, ça donne
   une image lourde sur quatre (mesuré ×10 : 41 ms par appel, dont 16 ms de cuisson inutile), donc
   des à-coups de menu. On capture le fond une fois, puis on ne recompose qu'une image. */
let BGF=null;
function render(A,dt){
  FRAME++;RDT=dt||16.7;SPRB=3;ctx=MAINCTX;const c=ctx;const sk=skLev();
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  if(!WD){c.fillStyle='#05030c';c.fillRect(0,0,cv.width,cv.height);return;}
  const fige=!!G&&G.state==='pause';
  if(!fige)BGF=null;
  else if(BGF&&BGF.width===cv.width&&BGF.height===cv.height){c.drawImage(BGF,0,0);return;}
  else BGF=null;
  const inGame=!!(G&&G.p);
  if(inGame){RT=G.t+A;
    CAM.x=G.pcx==null?G.cx:G.pcx+(G.cx-G.pcx)*A;CAM.y=G.pcy==null?G.cy:G.pcy+(G.cy-G.pcy)*A;CAM.z=(G.pzoom==null?G.zoom:G.pzoom+(G.zoom-G.pzoom)*A)*(1+G.kick);
    RSX=RSY=0;if(G.trauma>0){const s=G.trauma*G.trauma*16;RSX=fr(-s,s);RSY=fr(-s,s);}}
  else{RT=performance.now()/16.67;CAM.x=Math.cos(RT*.0007)*WR*.42;CAM.y=Math.sin(RT*.00091)*WR*.38;CAM.z=Math.min(W,H)/640;RSX=RSY=0;}
  RZ=CAM.z;if(inGame){lerpIn(A);markStep();}
  VL=CAM.x-(W/2+60)/RZ;VR=CAM.x+(W/2+60)/RZ;VT=CAM.y-(H/2+60)/RZ;VB=CAM.y+(H/2+60)/RZ;
  const mix=biomeMix(CAM.x,CAM.y);
  streamWorld(bakeBudget());
  /* le sol de secours n'est dessiné que si un chunk visible n'est pas encore prêt */
  if(!chunksCover()){c.fillStyle='#05030c';c.fillRect(0,0,cv.width,cv.height);screenTf();drawGround();}
  worldTf();drawChunks();if(inGame)drawWhaleShadow(mix);
  for(const m of mix)if(m.b==='sea'&&m.w>.3&&QL>=2)drawCaustics(m.w);
  /* couche basse résolution : ambiance lointaine + halos */
  lowBegin();if(QL>=2){lowScreen();drawFar(mix);drawVista(mix);drawWhale(mix);LOWN++;}lowWorld();if(sk<2)drawLowGlows();lowEnd();
  worldTf();drawEdges();drawObstacles();if(inGame){drawSeuils();drawAmers();}if(inGame){gcDrawWorld();gsDrawWorld();giDrawWorld();gxDrawWorld();gvDrawWorld();}
  if(inGame){drawObjectives();drawPickups();drawShadows(mix);drawMarks();drawTrails();gcDrawUnder();giDrawUnder();if(DEC==='sky')drawFalls();drawEnemies();if(DEC==='floral'||DEC==='urban')drawDecFX();drawBoss();drawPlayer();drawBullets();drawFX();gcDrawOver();}
  screenTf();if(sk<1)drawWeather(mix);
  if(inGame&&!gvHideHUD()){if(sk<2)drawLabels();if(sk<1)drawIndicators();drawTexts();}
  postFX();
  if(inGame){screenTf();ctx.translate(SAFE.l,SAFE.t);const w0=W,h0=H;W-=SAFE.l+SAFE.r;H-=SAFE.t+SAFE.b;try{if(!gvHideHUD()){drawHUD();gcHUD();gxHUD();gtHUD();}gvDrawScreen();drawSubs();}finally{W=w0;H=h0;}lerpOut();}
  /* capture du fond, une seule fois par entrée en pause : les images suivantes n'auront qu'un
     composite à faire au lieu du rendu complet */
  if(fige&&!BGF){BGF=mkCanvas(cv.width,cv.height);BGF.getContext('2d').drawImage(cv,0,0);}
}
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
const FAR={
  clouds(x,y,s,sc,w){ctx.globalCompositeOperation='source-over';const r=(110+s*150)*sc;soft(x,y,r,'#e8f0ff',.2*w);soft(x+r*.5,y+r*.2,r*.7,'#ffffff',.16*w);soft(x-r*.45,y+r*.25,r*.6,'#dfe8ff',.14*w);},
  /* aurores du Glacier : rubans étirés qui ondulent, vert d'eau et mauve */
  aurora(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';const r=(90+s*80)*sc,sw=Math.sin(RT*.012+s*9);ctx.save();ctx.translate(x+sw*24*sc,y);ctx.rotate(-.3+s*.6+sw*.1);ctx.scale(3,.3);
    soft(0,0,r,s<.5?'#7dffc4':'#a98cff',.2*w);soft(r*.3,-r*1.2,r*.8,s<.5?'#b5f3ff':'#7dffc4',.12*w);ctx.restore();},
  mist(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';soft(x,y,(120+s*140)*sc,'#cffff0',.035*w);},
  rays(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';ctx.save();ctx.translate(x,y);ctx.rotate(-.5);ctx.scale(.35,2.6);soft(0,0,(90+s*80)*sc,'#8fe9ff',.08*w);ctx.restore();},
  blooms(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';soft(x,y,(80+s*110)*sc,s<.5?'#ff5ad8':'#b44dff',.1*w);},
  grid(x,y,s,sc,w,cell){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.07*w;ctx.strokeStyle='#2de2ff';ctx.lineWidth=1;const d=cell*sc;ctx.strokeRect(x-d/2,y-d/2,d,d);if(s>.6){ctx.globalAlpha=.25*w;ctx.fillStyle='#ff2d95';ctx.fillRect(x-2,y-2,4,4);}},
  /* grappe de 5 lueurs : 16 variantes composées une fois (1 drawImage par cellule au lieu de 5) */
  lights(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';const q=(s*16)|0;if(!SPR['fl'+q]){if(FLB<=0)return;FLB--;}const S=spr('fl'+q,144,g=>{g.globalCompositeOperation='lighter';for(let k=0;k<5;k++){const a=(q+.5)/16*50+k*1.3,r=5;
      g.drawImage(glowSpr(k%2?'#ffc93c':'#ff2d95'),72+Math.cos(a)*16*k-r,72+Math.sin(a)*16*k-r,r*2,r*2);}});
    ctx.globalAlpha=.35*w;ctx.drawImage(S,x-72*sc,y-72*sc,144*sc,144*sc);},
  pulse(x,y,s,sc,w){ctx.globalCompositeOperation='lighter';soft(x,y,(100+s*90)*sc,'#ff3355',(.06+.05*Math.sin(RT*.05+s*6))*w);},
};
let FLB=0;
function drawFar(mix){
  FLB=2;const f=.55,sc=RZ*.72,cell=QL<3||COARSE?760:560,fx=CAM.x*f,fy=CAM.y*f,hw=W/2/sc+cell,hh=H/2/sc+cell;
  const i0=Math.floor((fx-hw)/cell),i1=Math.floor((fx+hw)/cell),j0=Math.floor((fy-hh)/cell),j1=Math.floor((fy+hh)/cell);
  for(const m of mix){const t=BIO[m.b].far;if(!t||m.w<.3)continue;const fn=FAR[t];
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const h=hash2(i,j,WD.seed^77),u=(h&1023)/1024,v=((h>>>10)&1023)/1024,s=((h>>>20)&255)/255;
      const x=((i+u)*cell-fx)*sc+W/2+RSX*.5,y=((j+v)*cell-fy)*sc+H/2+RSY*.5;fn(x,y,s,sc,m.w,cell);}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function drawChunks(){
  const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  /* un chunk en cours de cuisson (c.bk) s'affiche tel quel : opaque, il part du même sol que drawGround */
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy),b=c&&(c.bake||c.bk&&c.bk.cv);if(b)ctx.drawImage(b,c.x0,c.y0,CH,CH);}
  fleeBuild();STB=10;DCB=1;DEC=G&&G.p&&G.dec?G.biome:'';
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
      for(let w=0;w<2;w++){c.globalAlpha=(w?.55:.16)*k*(.6+.4*p);c.lineWidth=w?2:6;c.beginPath();for(const v of V){c.moveTo(it.x,it.y);for(let j=0;j<v.length;j+=2)c.lineTo(v[j],v[j+1]);}c.stroke();}
      soft(it.x,it.y,(22+p*20)*(.8+.4*k),'#ff3355',(.18+.5*p)*k);soft(it.x,it.y,7,'#ffd0c0',.5*k);
      c.globalCompositeOperation='source-over';c.globalAlpha=1;c.lineCap='butt';break;}
    case 'jelly':{ /* Meduses du recif (E2) : montent lentement, cloche qui pulse ; fuient les ennemis en aggro.
       Teinte blanc-bleu pale : hors de la palette des ennemis (COL.pk est plus sature). */
      const cy=RT*.12*it.s+it.ph*90,x0=it.x+Math.sin(RT*.013+it.ph)*18,y0=it.y+60-((cy%240)+240)%240,fq=fleeOff(x0,y0),x=x0+fq[0],y=y0+fq[1];
      if(!vis(x,y,40))return;const p=.5+.5*Math.sin(RT*(fq[2]>.15?.3:.09)+it.ph),r=(9+3*p)*it.s,h=r*(.75-.2*p);
      c.globalCompositeOperation='lighter';soft(x,y,r*2.4,'#bfe8ff',.22);c.globalCompositeOperation='source-over';c.globalAlpha=1;
      c.strokeStyle='rgba(214,244,255,.55)';c.lineWidth=1.2;c.beginPath();for(let k=-1;k<=1;k++){c.moveTo(x+k*r*.5,y);c.quadraticCurveTo(x+k*r*.5+Math.sin(RT*.08+k+it.ph)*5,y+r*1.2,x+k*r*.4,y+r*2.2);}c.stroke();
      c.fillStyle='rgba(226,248,255,.7)';c.beginPath();c.ellipse(x,y,r,h,0,Math.PI,TAU);c.fill();
      c.fillStyle='#ffffff';c.beginPath();c.arc(x,y-h*.35,1.8*it.s,0,TAU);c.fill();break;}
    case 'moth':{ /* Phalenes des plaines. Elles s'ecartent du joueur puis reviennent SANS AUCUN
       ETAT : le decalage est une fonction pure de la distance, donc la position reste
       reproductible et le retour est automatique des qu'on s'eloigne.
       Lisibilite : le sol des plaines est vert, donc un halo vert-jaune s'y noie (mesure du
       27/09 : +0 pixel visible). Coeur blanc chaud et ailes claires pour contraster. */
      if(!vis(it.x,it.y,110))return;
      let x=it.x,y=it.y;
      if(G&&G.p){const dx=x-G.p.x,dy=y-G.p.y,d=Math.hypot(dx,dy)||1,R=175;
        if(d<R){const k=(1-d/R)*(1-d/R)*52;x+=dx/d*k;y+=dy/d*k;}}
      const fq=fleeOff(it.x,it.y);x+=fq[0];y+=fq[1];
      if(!vis(x,y,34))return;
      const bf=.5+.5*Math.sin(RT*(fq[2]>.15?.6:.22)+it.ph*3);
      c.globalCompositeOperation='lighter';
      soft(x,y,14*it.s*(.8+.3*bf),'#fff4c2',.3+.18*bf);      /* halo serre : un insecte, pas une tache */
      soft(x,y,5*it.s,'#ffffff',.6);
      c.globalCompositeOperation='source-over';c.globalAlpha=1;
      c.fillStyle='rgba(255,255,255,.95)';                   /* ailes : deux traits clairs */
      c.beginPath();c.moveTo(x-5*it.s,y-1.6*it.s);c.quadraticCurveTo(x,y-1.2*it.s*(1+bf),x+5*it.s,y-1.6*it.s);
      c.moveTo(x-5*it.s,y+1.6*it.s);c.quadraticCurveTo(x,y+1.2*it.s*(1+bf),x+5*it.s,y+1.6*it.s);
      c.lineWidth=1*it.s;c.strokeStyle='rgba(255,255,255,.85)';c.stroke();
      c.beginPath();c.arc(x,y,1.5*it.s,0,TAU);c.fill();break;}
    case 'bird':{ /* Vols de l'archipel : une bande traverse le ciel, ombre portee sur la mer de
       nuages. Trajectoire pure fonction du temps et de la phase : aucune memoire. */
      const sp=RT*.05+it.ph,bx0=it.x+((sp*170)%760)-380,by0=it.y+Math.sin(sp*.8+it.ph)*34,fq=fleeOff(bx0,by0),bx=bx0+fq[0]*1.6,by=by0+fq[1]*1.6;
      if(!vis(bx,by,70))return;
      const f=.5+.5*Math.sin(RT*(fq[2]>.15?.7:.22)+it.ph*5);
      c.strokeStyle='rgba(16,20,46,.30)';c.lineWidth=2;c.lineCap='round';   /* ombre */
      c.beginPath();c.moveTo(bx-6*it.s+30,by+34);c.lineTo(bx+30,by+34-3*it.s);c.lineTo(bx+6*it.s+30,by+34);c.stroke();
      c.strokeStyle='rgba(242,248,255,.92)';c.lineWidth=1.7;
      c.beginPath();c.moveTo(bx-8*it.s,by);c.quadraticCurveTo(bx,by-7*it.s*(.55+f),bx+8*it.s,by);c.stroke();break;}
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
/* N2 — la faune fuit le danger. Liste des ennemis en aggro, refaite une fois par image et bornée ;
   le décalage est une fonction pure des positions : aucune mémoire, retour automatique. L'ennemi
   peut être hors de l'écran : seule la bête doit être visible. */
const FLEE=[],FLR=320,FO=[0,0,0];
function fleeBuild(){FLEE.length=0;if(!G||!G.en)return;for(const e of G.en)if(e.aggro&&!e.dead&&e.spawn<=0){FLEE.push(e);if(FLEE.length>=40)break;}}
function fleeOff(x,y){let dx=0,dy=0,m=0;
  for(const e of FLEE){const ex=x-e.x,ey=y-e.y;if(ex>FLR||ex<-FLR||ey>FLR||ey<-FLR)continue;const d=Math.hypot(ex,ey)||1;if(d>=FLR)continue;const k=(1-d/FLR)*(1-d/FLR);dx+=ex/d*k;dy+=ey/d*k;if(k>m)m=k;}
  const L=Math.hypot(dx,dy);if(L>1){dx/=L;dy/=L;}FO[0]=dx*120;FO[1]=dy*120;FO[2]=m;return FO;}
/* décor par chunk, calculé une fois au premier affichage */
const DECV=new WeakMap();
function decoOf(c){let d=DECV.get(c);if(d)return d;d={v:[],pk:[],je:[],st:[]};DECV.set(c,d);
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
  /* méduses du Récif */
  if(Q.includes('sea'))for(let i=0;i<4&&d.je.length<3;i++){const x=x0+40+r()*(CH-80),y=y0+40+r()*(CH-80),s=.8+r()*.5,ph=r()*TAU;if(biomeAt(x,y)==='sea'&&!hitList(c.obs,x,y,30))d.je.push({t:'jelly',x,y,s,ph});}
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
  for(const q of d.je)drawLive(q);
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
  c.save();c.globalCompositeOperation='source-over';c.translate(q.x,q.y);c.scale(q.dir*q.sc,q.sc);const sw=Math.sin(RT*.03)*.12;
  c.globalAlpha=.62*q.w;c.fillStyle='#16224f';c.beginPath();c.ellipse(0,0,270,74,0,0,TAU);c.fill();
  c.beginPath();c.moveTo(-230,-18);c.quadraticCurveTo(-330,0,-360,0);c.lineTo(-420,-60+sw*200);c.quadraticCurveTo(-400,0,-420,60-sw*200);c.lineTo(-360,0);c.quadraticCurveTo(-330,0,-230,18);c.fill();
  c.beginPath();c.moveTo(60,40);c.quadraticCurveTo(20,130+sw*80,-40,150+sw*80);c.quadraticCurveTo(0,90,-10,50);c.fill();
  c.globalAlpha=.28*q.w;c.strokeStyle='#cfe0ff';c.lineWidth=5;c.beginPath();for(let k=0;k<5;k++){c.moveTo(210-k*6,20+k*9);c.quadraticCurveTo(40,34+k*9,-120,18+k*8);}c.stroke();
  c.fillStyle='#cfe0ff';c.beginPath();c.arc(185,-8,7,0,TAU);c.fill();c.restore();c.globalAlpha=1;}
function drawWhaleShadow(mix){const q=whaleAt(mix);if(!q)return;const x=CAM.x+(q.x-W/2)/RZ+160,y=CAM.y+(q.y-H/2)/RZ+220,L=560*q.sc/RZ;
  ctx.globalAlpha=.3*q.w;ctx.drawImage(shadowSpr(),x-L,y-L*.32,L*2,L*.64);ctx.globalAlpha=1;}
/* 9. N5 — seuils : là où un segment du chemin principal change de biome, une arche aux deux couleurs,
   posée par dichotomie sur le segment (aucun tirage), calculée une fois par monde */
let THR=[],THRW=null;
function seuils(){if(THRW===WD)return THR;THRW=WD;THR=[];if(!WD.segs||!WD.mainE)return THR;
  for(const sg of WD.segs){if(!WD.mainE.has(sg.e))continue;const A=biomeAt(sg.ax,sg.ay),B=biomeAt(sg.bx,sg.by);if(A===B)continue;
    let lo=0,hi=1;for(let i=0;i<16;i++){const m=(lo+hi)/2;if(biomeAt(sg.ax+(sg.bx-sg.ax)*m,sg.ay+(sg.by-sg.ay)*m)===A)lo=m;else hi=m;}
    const t=(lo+hi)/2,L=Math.hypot(sg.bx-sg.ax,sg.by-sg.ay)||1;THR.push({x:sg.ax+(sg.bx-sg.ax)*t,y:sg.ay+(sg.by-sg.ay)*t,ux:(sg.bx-sg.ax)/L,uy:(sg.by-sg.ay)/L,a:A,b:B});}
  return THR;}
function drawSeuils(){const c=ctx;
  for(const T of seuils()){if(!vis(T.x,T.y,260))continue;const nx=-T.uy,ny=T.ux,R=66,[dx,dy]=twOff(T.x,T.y,1.5,TWM),ca=BIO[T.a].a,cb=BIO[T.b].a;
    const p1x=T.x+nx*R,p1y=T.y+ny*R,p2x=T.x-nx*R,p2y=T.y-ny*R;
    c.lineCap='round';c.globalAlpha=.8;c.strokeStyle='#0c0a16';c.lineWidth=12;c.beginPath();c.moveTo(p1x,p1y);c.lineTo(p1x+dx,p1y+dy);c.moveTo(p2x,p2y);c.lineTo(p2x+dx,p2y+dy);
    c.moveTo(p1x+dx,p1y+dy);c.quadraticCurveTo(T.x+dx*1.45,T.y+dy*1.45,p2x+dx,p2y+dy);c.stroke();c.globalAlpha=1;
    for(const [s,col] of [[-1,ca],[1,cb]]){const ox=T.ux*s*3.5,oy=T.uy*s*3.5;c.strokeStyle=col;c.lineWidth=3.5;c.beginPath();
      c.moveTo(p1x+ox,p1y+oy);c.lineTo(p1x+dx+ox,p1y+dy+oy);c.quadraticCurveTo(T.x+dx*1.45+ox,T.y+dy*1.45+oy,p2x+dx+ox,p2y+dy+oy);c.lineTo(p2x+ox,p2y+oy);c.stroke();
      c.globalAlpha=.35;c.lineWidth=5;c.beginPath();c.moveTo(p1x+ox*3,p1y+oy*3);c.lineTo(p2x+ox*3,p2y+oy*3);c.stroke();c.globalAlpha=1;}
    c.globalCompositeOperation='lighter';soft(T.x+dx*1.2,T.y+dy*1.2,34,ca,.45);soft(T.x+dx*1.2,T.y+dy*1.2,22,cb,.45);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.lineCap='butt';}}
/* 10. N4 — amers : un monument d'un biome absent de G.visited projette une colonne de sa couleur.
   Renvoie les monuments allumés dans le champ (test/decor-vivant.js). */
function beamSpr(col){let s=SPR['bm'+col];if(s)return s;s=mkCanvas(32,256);const g=s.getContext('2d');
  let gr=g.createLinearGradient(0,0,32,0);gr.addColorStop(0,rgba(col,0));gr.addColorStop(.35,rgba(col,.55));gr.addColorStop(.5,'rgba(255,255,255,.9)');gr.addColorStop(.65,rgba(col,.55));gr.addColorStop(1,rgba(col,0));g.fillStyle=gr;g.fillRect(0,0,32,256);
  g.globalCompositeOperation='destination-in';gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.6,'rgba(0,0,0,.6)');gr.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=gr;g.fillRect(0,0,32,256);
  return SPR['bm'+col]=s;}
const BEAMH=2400;
function drawAmers(){const out=[];if(!G||!G.visited||!WD||!WD.lms)return out;const c=ctx;c.globalCompositeOperation='lighter';
  for(const L of WD.lms){if(G.visited[L.t])continue;if(L.x+60<VL||L.x-60>VR||L.y-BEAMH>VB||L.y+160<VT)continue;out.push(L);
    const col=BIO[L.t].a,p=.85+.15*Math.sin(RT*.04+(L.s&255));c.globalAlpha=.7*p;c.drawImage(beamSpr(col),L.x-40,L.y-BEAMH,80,BEAMH);soft(L.x,L.y,160,col,.4*p);}
  c.globalCompositeOperation='source-over';c.globalAlpha=1;return out;}
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
function drawCaustics(w){
  const c=ctx,d=RT*.35;c.save();c.globalCompositeOperation='lighter';c.fillStyle=CAUSP;
  c.globalAlpha=.1*w;c.translate(d,d*.6);c.fillRect(VL-d,VT-d*.6,VR-VL,VB-VT);
  if(QL>=3){c.translate(-d*2.1,d*.3);c.scale(1.6,1.6);c.globalAlpha=.06*w;c.fillRect((VL+d*1.1)/1.6,(VT-d*.9)/1.6,(VR-VL)/1.6,(VB-VT)/1.6);}
  c.restore();
}
function membrane(cx,cy,R,col,t){
  const c=ctx,N=R>2000?220:130;c.beginPath();
  for(let i=0;i<=N;i++){const a=i/N*TAU,r=R+Math.sin(a*7+t*.03)*4+Math.sin(a*3-t*.02)*3;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
  c.globalCompositeOperation='lighter';if(QL>=3){c.strokeStyle=rgba(col,.06);c.lineWidth=26;c.stroke();}c.strokeStyle=rgba(col,.18);c.lineWidth=9;c.stroke();c.strokeStyle=rgba(col,.9);c.lineWidth=2.6;c.stroke();c.globalCompositeOperation='source-over';
}
function drawEdges(){
  if(Math.hypot(CAM.x,CAM.y)>WR-1600)membrane(0,0,WR,'#a45cff',RT);
  if(!G||!G.p)return;
  const A=G.arena;
  if(A){const col=A.kind==='boss'?COL.rd:HCOL[A.ref.i];ctx.fillStyle='rgba(4,2,10,.55)';ctx.beginPath();ctx.rect(VL-50,VT-50,VR-VL+100,VB-VT+100);ctx.arc(A.x,A.y,A.r,0,TAU,true);ctx.fill();membrane(A.x,A.y,A.r,col,RT);}
  const O=G.arenaOpen;if(O){const f=O.t/40;ctx.globalAlpha=1-f;ctx.strokeStyle=O.col;ctx.lineWidth=4;ctx.beginPath();ctx.arc(O.x,O.y,O.r*(1+f*.8),0,TAU);ctx.stroke();ctx.globalAlpha=1;}
}
function drawObstacles(){
  const c0=Math.floor(VL/CH)-1,c1=Math.floor(VR/CH)+1,r0=Math.floor(VT/CH)-1,r1=Math.floor(VB/CH)+1;
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const ch=getChunk(cx,cy);if(!ch)continue;
    for(const o of ch.obs){if(o.wall)continue;const m=o.R+140;if(o.cx+m<VL||o.cx-m>VR||o.cy+m<VT||o.cy-m>VB)continue;
      if(!o.spr){if(SPRB<=0)continue;SPRB--;OSPR.push(o);}
      o.su=FRAME;if(o.b==='urban'||o.lt==='urban'&&o.role==='center'){obsSprite(o);TWL.push(o);continue;}ctx.drawImage(obsSprite(o),o.sx,o.sy,o.sw,o.sh);
      if(o.b==='core'){ctx.globalCompositeOperation='lighter';soft(o.x,o.y,o.r*1.3,'#ff3355',(.1+.08*Math.sin(RT*.05+o.s))*(.5+coreK(o.x,o.y)));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}}}
  drawTowers();
}
/* Mégapole : tours extrudées en perspective. Le toit glisse loin du centre de l'écran à proportion de sa
   hauteur ; chaque façade tournée vers la caméra est un parallélogramme, donc l'image AFFINE d'une texture
   de fenêtres (facTex) : un setTransform et un drawImage. La collision reste l'emprise au sol. Ordre du
   peintre : la plus éloignée d'abord, pour qu'un toit proche recouvre la façade d'une tour plus lointaine. */
const TWL=[],TWK=.13,TWM=100,PHH=2.6;
/* décalage du sommet d'un objet de hauteur T posé en x,y (borné à m) */
function twOff(x,y,T,m){const k=T*TWK;return[clamp((x-CAM.x)*k,-m,m),clamp((y-CAM.y)*k,-m,m)];}
function drawTowers(){
  if(!TWL.length)return;const c=ctx,s=PS*RZ,tx=PS*(W/2+RSX-CAM.x*RZ),ty=PS*(H/2+RSY-CAM.y*RZ);let nb=1;
  TWL.sort((a,b)=>dist2(b.cx,b.cy,CAM.x,CAM.y)-dist2(a.cx,a.cy,CAM.x,CAM.y));
  const face=(o,x0,y0,x1,y1,dx,dy,dk)=>{let t=FACS[(o.s%FACN)*2+(dk?1:0)];if(!t){if(nb<=0)return;nb--;t=facTex(o.s%FACN,dk);}
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
function drawObjectives(){
  const c=ctx;
  G.hearts.forEach(h=>{if(!vis(h.x,h.y,700))return;const col=HCOL[h.i];
    if(h.state==='dead'){sphere(h.x,h.y,h.r*.8,'#4a4660',false,.7);c.strokeStyle='rgba(0,0,0,.5)';c.lineWidth=3;c.beginPath();for(let k=0;k<5;k++){const a=k*1.3;c.moveTo(h.x,h.y);c.lineTo(h.x+Math.cos(a)*h.r*.8,h.y+Math.sin(a)*h.r*.8);}c.stroke();return;}
    if(h.state==='dormant'){c.globalAlpha=.25+.1*Math.sin(RT*.05);c.strokeStyle=col;c.lineWidth=3;c.setLineDash([18,22]);c.lineDashOffset=-RT*.6;c.beginPath();c.arc(h.x,h.y,520,0,TAU);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
    const p=1+Math.sin(RT*.07)*.05;
    for(const n of h.nodes){if(n.dead)continue;c.globalAlpha=.3;c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(h.x,h.y);c.lineTo(n.x,n.y);c.stroke();c.globalAlpha=1;sphere(n.x,n.y,n.r,col,n.flash>0);}
    sphere(h.x,h.y,h.r*p,col,h.flash>0);
    c.save();c.translate(h.x,h.y);c.rotate(RT*.02);for(let k=0;k<5;k++){const a=k/5*TAU;sphere(Math.cos(a)*h.r*.55,Math.sin(a)*h.r*.55,h.r*.16,'#ffffff',false,.5);}c.restore();
    sphere(h.x,h.y,h.r*.32*(1+Math.sin(RT*.15)*.1),COL.gd);});
  const L=WD.core;
  if(!G.boss&&vis(L.x,L.y,300)){const open=G.lair.open;
    sphere(L.x,L.y,70,open?COL.rd:'#5a1a28');
    for(let k=0;k<3;k++){const lit=k<G.heartsDone;c.strokeStyle=lit?HCOL[k]:'rgba(255,255,255,.18)';c.lineWidth=lit?4:2;c.beginPath();c.arc(L.x,L.y,92+k*16,RT*.01*(k%2?1:-1)+k,RT*.01*(k%2?1:-1)+k+TAU*.8);c.stroke();}}
}
function drawPickups(){
  const c=ctx;c.globalCompositeOperation='lighter';
  for(const k of G.pk){if(!vis(k.x,k.y,20))continue;let a=1;if(k.life<120&&(FRAME>>2)%2)a=.3;if(k.spill)a*=.6+.4*Math.sin(RT*.3+k.ph);glow(k.x,k.y,k.r*2.6,COL.pk,.85*a);}
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  for(const k of G.pk){if(!vis(k.x,k.y,20))continue;sphere(k.x,k.y,k.r,COL.pk,false,k.life<120&&(FRAME>>2)%2?.3:.9);}
}
function drawShadows(mix){
  const sky=mix[0].b==='sky'?mix[0].w:(mix[1]&&mix[1].b==='sky'?mix[1].w:0),k=.32+.9*sky,a=.5-.25*sky,S=shadowSpr(),c=ctx;
  const sh=(x,y,r)=>{if(!vis(x,y,r*3))return;const o=r*k;c.drawImage(S,x-r*1.1+o,y-r*1.1+o*1.3,r*2.2,r*2.2);};
  c.globalAlpha=a;for(const e of G.en)if(e.spawn<=0)sh(e.x,e.y,e.r);const P=G.p;if(!P.dead)sh(P.x,P.y,P.r*1.3);
  const B=G.boss;if(B&&!B.gone)sh(B.x,B.y,B.r);for(const h of G.hearts)if(h.state!=='dead')sh(h.x,h.y,h.r);c.globalAlpha=1;
  if(false){c.globalCompositeOperation='lighter';soft(P.x,P.y,250,P.col,.08+P.glow*.06);c.globalCompositeOperation='source-over';c.globalAlpha=1;}
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
function drawEnemies(){for(const e of G.en)if(vis(e.x,e.y,e.r*3))drawEnemy(e);}
function drawEnemy(e){
  const c=ctx,d=e.d,col=d.col,P=G.p,aP=Math.atan2(P.y-e.y,P.x-e.x);let r=e.r;
  if(e.spawn>0){const f=1-e.spawn/42;c.globalAlpha=1-f;c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r*(3-2*f),0,TAU);c.stroke();c.globalAlpha=1;sphere(e.x,e.y,r*f,col,false,f*.8);return;}
  r*=1+Math.sin(e.wob*4)*.04;
  c.globalCompositeOperation='lighter';glow(e.x,e.y,r*2.3,col,e.t==='life'||e.t==='cache'?.5+.2*Math.sin(RT*.15):.3);c.globalCompositeOperation='source-over';c.globalAlpha=1;
  if(e.t==='cache'){for(let k=0;k<6;k++){const a=k/6*TAU+RT*.01;sphere(e.x+Math.cos(a)*r*.6,e.y+Math.sin(a)*r*.6,r*.42,COL.pk,e.flash>0);}sphere(e.x,e.y,r*.5,COL.pk,e.flash>0);return;}
  if(e.t==='spike'){const n=8,L=e.st===1?r*.9*(1-e.st2/40)+r*.5:r*.5;c.fillStyle=col;c.beginPath();
    for(let k=0;k<n;k++){const a=e.wob*2+k*TAU/n;c.moveTo(e.x+Math.cos(a-.25)*r*.9,e.y+Math.sin(a-.25)*r*.9);c.lineTo(e.x+Math.cos(a)*(r+L),e.y+Math.sin(a)*(r+L));c.lineTo(e.x+Math.cos(a+.25)*r*.9,e.y+Math.sin(a+.25)*r*.9);}c.fill();
    if(e.st===1){c.globalAlpha=.25+.5*(1-e.st2/40);c.strokeStyle=COL.rd;c.lineWidth=2;c.setLineDash([10,8]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.ca)*230,e.y+Math.sin(e.ca)*230);c.stroke();c.setLineDash([]);c.globalAlpha=1;}}
  if(e.t==='sniper'&&e.tele>0){const f=1-e.tele/55;c.globalAlpha=.15+.7*f;c.strokeStyle=col;c.lineWidth=1+f*2.5;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.ta)*1500,e.y+Math.sin(e.ta)*1500);c.stroke();c.globalAlpha=1;}
  if(e.t==='mite')sphere(e.x-e.vx*3,e.y-e.vy*3,r*.5,col,false,.45);
  if(e.t==='orbit')for(let k=0;k<2;k++){const a=e.wob*5+k*Math.PI;sphere(e.x+Math.cos(a)*r*1.6,e.y+Math.sin(a)*r*1.6,r*.28,col);}
  sphere(e.x,e.y,r,col,e.flash>0,e.t==='spawner'?.85:1);
  switch(e.t){
    case 'pop':sphere(e.x+Math.cos(aP)*r*.25,e.y+Math.sin(aP)*r*.25,r*.42,col);break;
    case 'spread':for(let k=-1;k<=1;k++){const a=aP+k*.5;sphere(e.x+Math.cos(a)*r*.95,e.y+Math.sin(a)*r*.95,r*.3,col);}break;
    case 'ring':for(let k=0;k<8;k++){const a=e.wob+k*TAU/8;sphere(e.x+Math.cos(a)*r*.95,e.y+Math.sin(a)*r*.95,r*.2,col);}break;
    case 'sniper':{const a=e.tele>0?e.ta:aP;c.strokeStyle=col;c.lineWidth=r*.35;c.beginPath();c.moveTo(e.x+Math.cos(a)*r*.6,e.y+Math.sin(a)*r*.6);c.lineTo(e.x+Math.cos(a)*r*1.7,e.y+Math.sin(a)*r*1.7);c.stroke();break;}
    case 'gatling':{const sp=e.st>0?.5:.05;for(let k=0;k<3;k++){const a=RT*sp+k*TAU/3;sphere(e.x+Math.cos(a)*r*.5,e.y+Math.sin(a)*r*.5,r*.25,col);}break;}
    case 'spawner':for(let k=0;k<3;k++){const a=e.wob*2+k*TAU/3;sphere(e.x+Math.cos(a)*r*.45,e.y+Math.sin(a)*r*.45,r*.2,COL.vi,false,.8);}break;
    case 'life':c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.moveTo(e.x-r*.35,e.y);c.lineTo(e.x+r*.35,e.y);c.moveTo(e.x,e.y-r*.35);c.lineTo(e.x,e.y+r*.35);c.stroke();break;
  }
  if(e.hp<e.mhp){c.globalAlpha=.75;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r+6,-Math.PI/2,-Math.PI/2+TAU*Math.max(0,e.hp/e.mhp));c.stroke();c.globalAlpha=1;}
}
function drawBoss(){
  const B=G.boss;if(!B||B.gone)return;const c=ctx,P=G.p;
  const sa=B.spawn>0?1-B.spawn/110:1,r=B.r*(B.spawn>0?.3+.7*sa:1)*(1+Math.sin(RT*.08)*.03);
  c.globalCompositeOperation='lighter';glow(B.x,B.y,r*3,COL.rd,.5*sa);c.globalCompositeOperation='source-over';c.globalAlpha=1;
  for(const n of B.nodes){if(n.dead)continue;c.globalAlpha=.3*sa;c.strokeStyle=COL.or;c.lineWidth=2;c.beginPath();c.moveTo(B.x,B.y);c.lineTo(n.x,n.y);c.stroke();c.globalAlpha=1;sphere(n.x,n.y,n.r,COL.or,n.flash>0,sa);}
  const tr=B.trans>0&&(FRAME>>2)%2;
  sphere(B.x,B.y,r,COL.rd,B.flash>0||tr,sa);
  c.save();c.translate(B.x,B.y);c.rotate(-B.ang*2);for(let k=0;k<6;k++){const a=k*TAU/6;sphere(Math.cos(a)*r*.62,Math.sin(a)*r*.62,r*.16,COL.mg,false,sa);}c.restore();
  sphere(B.x,B.y,r*.38*(1+Math.sin(RT*.2)*.08),B.phase===3?COL.rd:COL.gd,false,sa);
  const ea=Math.atan2(P.y-B.y,P.x-B.x);c.globalAlpha=sa;c.fillStyle='#fff';c.beginPath();c.arc(B.x+Math.cos(ea)*r*.18,B.y+Math.sin(ea)*r*.18,r*.1,0,TAU);c.fill();
  if(B.phase===3){c.strokeStyle=rgba(COL.rd,.8);c.lineWidth=2;c.beginPath();for(let k=0;k<5;k++){const a=k*1.3+.4;c.moveTo(B.x+Math.cos(a)*r*.4,B.y+Math.sin(a)*r*.4);c.lineTo(B.x+Math.cos(a+.2)*r*.8,B.y+Math.sin(a+.2)*r*.8);c.lineTo(B.x+Math.cos(a-.1)*r,B.y+Math.sin(a-.1)*r);}c.stroke();}
  c.globalAlpha=1;
}
function drawPlayer(){
  const P=G.p;if(P.dead)return;const c=ctx,col=P.fury?COL.or:P.col,r=P.r;
  const base=(P.inv>0&&P.dashing<=0&&(FRAME>>2)%2===0)?.35:(P.ghost?.8:1);
  if(P.aura>0){c.globalCompositeOperation='lighter';soft(P.x,P.y,P.auraR*1.15,COL.vi,.2);c.globalCompositeOperation='source-over';c.globalAlpha=1;
    c.strokeStyle=rgba(COL.vi,.6);c.lineWidth=2;c.setLineDash([10,14]);c.lineDashOffset=-RT;c.beginPath();c.arc(P.x,P.y,P.auraR,0,TAU);c.stroke();c.setLineDash([]);}
  if(P.nova>0){const f=P.novaT/Math.max(120,180/P.nova);c.strokeStyle=rgba('#ffffff',.25+.5*f);c.lineWidth=3;c.beginPath();c.arc(P.x,P.y,r*1.7,-Math.PI/2,-Math.PI/2+TAU*f);c.stroke();}
  if(P.vortex){c.strokeStyle=rgba(COL.cy,.35);c.lineWidth=2;for(let k=0;k<3;k++){const a=RT*.04+k*TAU/3;c.beginPath();c.arc(P.x,P.y,r*1.9,a,a+1.2);c.stroke();}}
  c.globalCompositeOperation='lighter';glow(P.x,P.y,r*2.7,col,(.35+P.glow*.35)*base);c.globalCompositeOperation='source-over';c.globalAlpha=1;
  const nb=Math.min(14,2+P.lvl);
  for(let k=0;k<nb;k++){const a=k/nb*TAU+RT*.006;sphere(P.x+Math.cos(a)*r*1.02,P.y+Math.sin(a)*r*1.02,r*(.24+(k%3)*.05),col,P.flash>0,base*.9);}
  const n=P.turrets;
  for(let k=0;k<n;k++){const a=P.ang+(k-(n-1)/2)*P.spreadW,tx=P.x+Math.cos(a)*(r*1.08-P.recoil*.5),ty=P.y+Math.sin(a)*(r*1.08-P.recoil*.5);
    c.globalAlpha=base;c.strokeStyle=rgba(col,.85);c.lineWidth=r*.26;c.beginPath();c.moveTo(P.x+Math.cos(a)*r*.4,P.y+Math.sin(a)*r*.4);c.lineTo(tx+Math.cos(a)*r*.3,ty+Math.sin(a)*r*.3);c.stroke();c.globalAlpha=1;
    sphere(tx,ty,r*(P.titan?.4:.3),col,P.flash>0,base);}
  sphere(P.x,P.y,r,col,P.flash>0,base);
  sphere(P.x,P.y,r*.42*(1+Math.sin(RT*.12)*.07),'#ffffff',false,.55*base);
  c.globalAlpha=base;
  if(P.titan){c.strokeStyle=COL.gd;c.lineWidth=3;c.beginPath();c.arc(P.x,P.y,r*1.38,0,TAU);c.stroke();}
  if(P.dronesHome){c.fillStyle=COL.gd;for(let k=0;k<5;k++){const a=-RT*.02+k*TAU/5;c.beginPath();c.arc(P.x+Math.cos(a)*r*1.45,P.y+Math.sin(a)*r*1.45,2.5,0,TAU);c.fill();}}
  if(P.muts.includes('prism')){c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1.5;c.beginPath();for(let k=0;k<3;k++){const a=RT*.03+k*TAU/3,x=P.x+Math.cos(a)*r*.7,y=P.y+Math.sin(a)*r*.7;if(k)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.stroke();}
  c.globalAlpha=1;
  for(let k=0;k<P.orbs;k++){const a=RT*.07+k*TAU/P.orbs,ox=P.x+Math.cos(a)*(r+30),oy=P.y+Math.sin(a)*(r+30);c.globalCompositeOperation='lighter';glow(ox,oy,18,COL.cy,.6);c.globalCompositeOperation='source-over';c.globalAlpha=1;sphere(ox,oy,7,COL.pk);}
  for(let k=0;k<P.drones;k++){const a=-RT*.025+k*TAU/P.drones;sphere(P.x+Math.cos(a)*(r+62),P.y+Math.sin(a)*(r+62),8,COL.lm);}
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
  for(const f of G.fx){if(f.ty!==2&&f.ty!==3)continue;if(!vis(f.x,f.y,40))continue;const a=f.life/f.max;
    if(f.ty===2)sphere(f.x,f.y,Math.max(.6,f.s*a),f.col,false,a);else{c.globalAlpha=a*.3;c.fillStyle=f.col;c.beginPath();c.arc(f.x,f.y,f.r,0,TAU);c.fill();}}
  c.globalCompositeOperation='lighter';
  for(const f of G.fx){if(f.ty===2||f.ty===3)continue;if(!vis(f.x,f.y,f.r1||f.r||40))continue;const a=f.life/f.max;
    if(f.ty===0)glow(f.x,f.y,f.s*3,f.col,a);
    else if(f.ty===4){}
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
      case 'wind':p.x+=(p.s>.9?.7:6+p.s*6)*k;break;
      case 'data':p.y+=(4+p.s*5)*k;break;
      case 'rain':p.x-=2*k;p.y+=(11+p.s*6)*k;break;
      case 'snow':p.y+=(.6+p.s*.8)*k;p.x+=Math.sin(RT*.02+p.a)*.5*k;break;
      case 'embers':p.y-=(.8+p.s)*k;p.x+=Math.sin(RT*.04+p.a)*.6*k;break;
    }
    const m=p.t==='wind'&&p.s>.9?140:40;
    if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m){p.t=weaType(mix);p.s=Math.random();
      if(p.x<-m)p.x+=W+2*m;else if(p.x>W+m)p.x-=W+2*m;if(p.y<-m)p.y+=H+2*m;else if(p.y>H+m)p.y-=H+2*m;
      if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m){p.x=Math.random()*W;p.y=Math.random()*H;}}
    switch(p.t){
      case 'pollen':c.globalCompositeOperation='lighter';glow(p.x,p.y,2+p.s*3,'#d6ff7a',.25+.4*Math.pow(Math.sin(RT*.05+p.a),2));break;
      case 'petals':c.globalCompositeOperation='source-over';c.globalAlpha=.6;c.fillStyle=p.s<.5?'#ff8fe0':'#ffd166';c.beginPath();c.ellipse(p.x,p.y,4+p.s*3,2,p.a,0,TAU);c.fill();break;
      case 'bubbles':c.globalCompositeOperation='source-over';c.globalAlpha=.35;c.strokeStyle='#cffcff';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,2+p.s*4,0,TAU);c.stroke();break;
      case 'wind':c.globalCompositeOperation='source-over';if(p.s>.9){soft(p.x,p.y,130,'#ffffff',.07);}else{c.globalAlpha=.12;c.strokeStyle='#fff';c.lineWidth=1.2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-40-p.s*60,p.y);c.stroke();}break;
      case 'data':c.globalCompositeOperation='lighter';c.globalAlpha=.45;c.strokeStyle=p.s<.8?'#2de2ff':'#ff2d95';c.lineWidth=1.5;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-8-p.s*14);c.stroke();break;
      case 'rain':c.globalCompositeOperation='source-over';c.globalAlpha=.28;c.strokeStyle='#bcd8ff';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+3,p.y-17);c.stroke();break;
      case 'snow':c.globalCompositeOperation='source-over';c.globalAlpha=.75;c.fillStyle='#fff';c.beginPath();c.arc(p.x,p.y,1+p.s*2,0,TAU);c.fill();break;
      case 'embers':c.globalCompositeOperation='lighter';glow(p.x,p.y,(2+p.s*2.5)*(.7+.5*EMK),'#ff8a2d',(.4+.3*Math.sin(RT*.3+p.a))*(.45+.75*EMK));break;
    }
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
}
/* ---------- textes, indicateurs, post-traitement ---------- */
function drawLabels(){
  const c=ctx;c.textAlign='center';c.textBaseline='middle';c.font='700 14px '+FD;
  G.hearts.forEach(h=>{if(h.state!=='dormant')return;const s=w2s(h.x,h.y-h.r-26);if(s[0]<-50||s[0]>W+50||s[1]<-20||s[1]>H+20)return;c.fillStyle=HCOL[h.i];c.fillText('Cœur de zone',s[0],s[1]);});
  const L=WD.core;if(!G.boss){const s=w2s(L.x,L.y-130);if(s[0]>-80&&s[0]<W+80&&s[1]>-20&&s[1]<H+20){c.fillStyle=G.lair.open?COL.rd:'#b8a8c8';c.fillText(G.lair.open?'L’Hypernoyau t’attend':'Scellé : '+G.heartsDone+' cœur'+(G.heartsDone>1?'s':'')+' sur 3',s[0],s[1]);}}
}
function edgePoint(x,y,m){const cx=W/2,cy=H/2,dx=x-cx,dy=y-cy,s=Math.min((W/2-m)/Math.abs(dx||1e-6),(H/2-m)/Math.abs(dy||1e-6));return[cx+dx*s,cy+dy*s,Math.atan2(dy,dx)];}
function objective(){if(G.arena)return null;if(G.lair.open)return{x:WD.core.x,y:WD.core.y,col:COL.rd};let best=null,bd=1e18;G.hearts.forEach(h=>{if(h.state==='dead')return;const d=dist2(h.x,h.y,G.p.x,G.p.y);if(d<bd){bd=d;best={x:h.x,y:h.y,col:HCOL[h.i]};}});return best;}
function drawIndicators(){
  const c=ctx;let n=0;
  const arrow=(x,y,a,col,sz)=>{c.save();c.translate(x,y);c.rotate(a);c.fillStyle=col;c.beginPath();c.moveTo(sz,0);c.lineTo(-sz*.7,sz*.7);c.lineTo(-sz*.7,-sz*.7);c.closePath();c.fill();c.restore();};
  for(const e of G.en){if(e.spawn>0||!e.aggro||n>8||e.t==='cache')continue;const s=w2s(e.x,e.y);if(s[0]>-10&&s[0]<W+10&&s[1]>-10&&s[1]<H+10)continue;n++;const q=edgePoint(s[0],s[1],22);c.globalAlpha=.8;arrow(q[0],q[1],q[2],e.d.col,7);}
  const B=G.boss;if(B&&!B.gone){const s=w2s(B.x,B.y);if(s[0]<0||s[0]>W||s[1]<0||s[1]>H){const q=edgePoint(s[0],s[1],30);c.globalAlpha=1;arrow(q[0],q[1],q[2],COL.rd,14);}}
  const o=objective();
  if(o){const s=w2s(o.x,o.y);if(s[0]<30||s[0]>W-30||s[1]<30||s[1]>H-30){const q=edgePoint(s[0],s[1],46);c.globalAlpha=.7+.3*Math.sin(RT*.12);arrow(q[0],q[1],q[2],o.col,16);
    c.globalAlpha=1;c.font='700 13px '+FD;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(Math.round(Math.hypot(o.x-G.p.x,o.y-G.p.y)/10)+' m',q[0]-Math.cos(q[2])*30,q[1]-Math.sin(q[2])*30);}}
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
  const P=G&&G.p,danger=P&&!P.dead&&P.lvl===1&&P.bub<5&&G.state==='play',red=Math.max(G&&G.hurtT>0?G.hurtT/22*.45:0,danger?.2+.15*Math.sin(G.t*.2):0);
  cssOp('hurt',Math.min(1,red*1.6));cssOp('flash',G&&G.flash>0?G.flash*.6:0);
}
const CSSV={};
function cssOp(id,v){v=Math.round(v*50)/50;if(CSSV[id]===v)return;CSSV[id]=v;const e=$(id);if(e)e.style.opacity=v;}
function dashBtn(){return{x:W-62,y:H-92,r:34};}
function drawMinimap(x,y,s){
  const c=ctx,k=s/(2*WR),P=G.p;
  c.save();c.beginPath();c.arc(x+s/2,y+s/2,s/2,0,TAU);c.clip();
  c.fillStyle='rgba(5,3,12,.85)';c.fillRect(x,y,s,s);c.imageSmoothingEnabled=true;c.globalAlpha=.95;c.drawImage(WD.mini,x,y,s,s);c.globalAlpha=1;c.drawImage(WD.fog,x,y,s,s);
  G.hearts.forEach(h=>{const hx=x+(h.x+WR)*k,hy=y+(h.y+WR)*k;c.fillStyle=h.state==='dead'?'#6a6680':HCOL[h.i];c.beginPath();c.arc(hx,hy,h.state==='dead'?2.2:3.4+Math.sin(RT*.12),0,TAU);c.fill();});
  const L=WD.core,lx=x+(L.x+WR)*k,ly=y+(L.y+WR)*k;c.fillStyle=G.lair.open?COL.rd:'#7a4a5a';c.beginPath();c.moveTo(lx,ly-5);c.lineTo(lx+4,ly);c.lineTo(lx,ly+5);c.lineTo(lx-4,ly);c.closePath();c.fill();
  gcMini(x,y,k);gxMini(x,y,k);
  const px=x+(P.x+WR)*k,py=y+(P.y+WR)*k;c.save();c.translate(px,py);c.rotate(P.ang);c.fillStyle='#fff';c.beginPath();c.moveTo(6,0);c.lineTo(-4,4);c.lineTo(-4,-4);c.closePath();c.fill();c.restore();
  c.restore();c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1.5;c.beginPath();c.arc(x+s/2,y+s/2,s/2,0,TAU);c.stroke();
}
function drawHUD(){
  const c=ctx,P=G.p,pad=14,narrow=W<600,ms=narrow?92:128;
  c.textBaseline='top';c.textAlign='left';
  c.font='700 26px '+FD;c.fillStyle='#fff';c.fillText('Niv. '+P.lvl,pad,pad);
  const bw=Math.min(190,W*.42),bx=pad,by=pad+34,bh=8,lo=TL(P.lvl),hi=P.lvl>=MAXLVL?lo:TL(P.lvl+1),f=P.lvl>=MAXLVL?1:clamp((P.bub-lo)/(hi-lo),0,1);
  c.fillStyle='rgba(255,255,255,.1)';c.fillRect(bx,by,bw,bh);const danger=P.lvl===1&&P.bub<6;c.fillStyle=danger&&(G.t>>3)%2?COL.rd:COL.cy;c.fillRect(bx,by,bw*f,bh);
  c.strokeStyle=rgba(COL.cy,.45);c.lineWidth=1;c.strokeRect(bx+.5,by+.5,bw-1,bh-1);
  c.font='500 13px '+FD;c.fillStyle='#cfc9ee';c.fillText('◯ '+Math.floor(P.bub)+(P.lvl<MAXLVL?' / '+hi:' · max'),bx,by+14);
  if(P.muts.length){c.fillStyle=COL.gd;c.fillText(P.muts.map(id=>MUT.find(m=>m.id===id).n).join(' + '),bx,by+32);}
  c.textAlign='right';c.font='700 24px '+FD;c.fillStyle='#fff';c.fillText(fmt(G.score),W-pad,60);
  if(G.combo>=2){c.font='700 15px '+FD;c.fillStyle=COL.gd;c.fillText('×'+G.combo+'  (score ×'+comboMul().toFixed(1)+')',W-pad,88);c.fillStyle=rgba(COL.gd,.6);c.fillRect(W-pad-100,107,100*G.comboT/150,3);}
  if(skLev()<2)drawMinimap(W-pad-ms,116,ms);
  const B=G.boss,Hh=G.arena&&G.arena.kind==='heart'?G.arena.ref:null,big=B&&!B.gone?B:(Hh&&Hh.state==='active'?Hh:null);
  if(big){const w=narrow?W-pad*2:Math.min(460,W-520),x=narrow?pad:(W-w)/2,y=narrow?pad+100:pad+6,fB=Math.max(0,big.hp/big.mhp);
    const y2=narrow?Math.max(y,116+ms+10):y;
    c.fillStyle='rgba(255,255,255,.1)';c.fillRect(x,y2+18,w,10);c.fillStyle=big===B?(B.trans>0&&(G.t>>2)%2?'#fff':COL.rd):HCOL[Hh.i];c.fillRect(x,y2+18,w*fB,10);
    if(big===B){c.fillStyle='rgba(12,7,22,.9)';c.fillRect(x+w*.34-1,y2+18,2,10);c.fillRect(x+w*.67-1,y2+18,2,10);}
    c.textAlign='center';c.fillStyle='#fff';c.font='700 14px '+FD;c.fillText(big===B?"L'Hypernoyau · phase "+B.phase:'Cœur de zone · '+BIO[Hh.t].n,x+w/2,y2);}
  else{const b=BIO[G.biome],y=pad+(narrow?0:4);c.textAlign='center';c.font='700 '+(narrow?13:15)+'px '+FD;c.fillStyle=b.a;c.fillText(b.n,narrow?W/2+18:W/2,y);
    c.font='500 '+(narrow?11:13)+'px '+FD;c.fillStyle='#cfc9ee';let s='';for(let i=0;i<3;i++)s+=G.hearts[i].state==='dead'?'◆':'◇';c.fillText(narrow?s+' · '+G.room.toFixed(1)+' · '+mmss(G.time):'Cœurs '+s+'   Menace '+G.room.toFixed(1)+'   '+mmss(G.time),narrow?W/2+18:W/2,y+(narrow?17:20));}
  if(G.zoneT&&G.zoneT.t<150){const z=G.zoneT,a=Math.min(1,z.t/15,(150-z.t)/25);c.globalAlpha=a;c.textAlign='center';c.textBaseline='middle';c.font='700 '+Math.min(36,W*.07)+'px '+FD;c.fillStyle=BIO[z.b].a;c.fillText(BIO[z.b].n,W/2,H*.2);fitFont(c,BIO[z.b].sub||'',W-24,15,'500');c.fillStyle='#e6e2ff';c.fillText(BIO[z.b].sub,W/2,H*.2+28);c.globalAlpha=1;}
  c.textBaseline='top';
  if(inp.touch){const L=inp.L,Rs=inp.R;
    for(const s of [L,Rs]){if(!s)continue;c.globalAlpha=.25;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(s.ox,s.oy,60,0,TAU);c.stroke();c.fillStyle=s===L?COL.cy:COL.mg;c.beginPath();c.arc(s.x,s.y,24,0,TAU);c.fill();c.globalAlpha=1;}
    const db=dashBtn(),rdy=P.dashT<=0;c.globalAlpha=rdy?.8:.35;c.strokeStyle=COL.cy;c.lineWidth=2;c.beginPath();c.arc(db.x,db.y,db.r,0,TAU);c.stroke();
    if(!rdy){c.lineWidth=4;c.beginPath();c.arc(db.x,db.y,db.r-5,-Math.PI/2,-Math.PI/2+TAU*(1-P.dashT/P.dashMax));c.stroke();}
    c.textAlign='center';c.textBaseline='middle';c.font='700 22px '+FD;c.fillStyle='#fff';c.fillText('⚡',db.x,db.y);c.globalAlpha=1;}
  else{c.textAlign='left';c.textBaseline='bottom';c.font='500 12px '+FD;c.fillStyle=P.dashT<=0?COL.cy:'#6d6890';c.fillText(P.dashT<=0?'Dash prêt (Espace)':'Dash '+Math.ceil(P.dashT/60)+' s',pad,H-pad);}
  if(meta.fps){c.textAlign='left';c.textBaseline='bottom';c.fillStyle='#8f89b3';
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
       On ne devine donc plus une ancre : on lit les VRAIES positions (dashBtn, gcSlots), elargies
       a la zone de TOUCHER (rayon + 10, comme touchBtnAt de g4.js) et au libelle pose dessous, et
       le bloc monte jusqu'a n'en couper aucune. Sur poste fixe il reste au-dessus de la ligne
       « Dash pret (Espace) » (y = H-pad). Si, pleine largeur, il devait monter dans la moitie
       haute (telephone couche), on le pave plus etroit, A GAUCHE des boutons : rien n'est retire. */
    const ZB=[];if(inp.touch){const d=dashBtn();ZB.push([d.x-d.r-10,d.y-d.r-10,d.x+d.r+10,d.y+d.r+10]);}
    for(const s of gcSlots())ZB.push([s.x-s.r-10,s.y-s.r-10,s.x+s.r+10,s.y+s.r+18]);
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
    const rq=meta.q||'auto',capq=rq==='auto'?[3,1]:QPRE[rq],dsc=QL<capq[0]||RES<capq[1];
    const seg3=['régul '+(rq==='auto'?'auto':'plafond '+rq+(dsc?' ↓':''))+' '+QL+'/3 ×'+RES.toFixed(2),'PS '+PS.toFixed(2),'canvas '+cv.width+'×'+cv.height,'DPR '+DPR,'ref '+REFDT.toFixed(1)+' ms','cuisson '+cuis];
    if(DIAG_MARGIN>=0)seg3.push('marge audio '+DIAG_MARGIN.toFixed(2)+' s');
    /* jointure : « · » entre morceaux, mais un simple espace apres un morceau qui finit par « : »
       — sinon la ligne s'ecrit « ou : · render 6.06/12 » au lieu de « ou : render 6.06/12 ». */
    const jn=a=>{let s='';for(let i=0;i<a.length;i++)s+=(i?(a[i-1].slice(-1)===':'?' ':' · '):'')+a[i];return s;};
    const MWj=a=>c.measureText(jn(a)).width;
    /* mise en page pour une largeur MW donnee, puis pose : le bloc part du bas et monte au-dessus
       de chaque zone qu'il coupe (il ne fait que monter : au plus une passe par zone). */
    const pose=MW=>{
      /* les trois lignes de mesure sont PAVEES (un morceau qui ne tient plus ouvre la ligne suivante) :
         rien n'est tronque, meme a 320 px en police large. Seule « ou : » se raccourcit par la fin. */
      const out=[];c.font='500 '+PX0+'px '+FD;
      for(const g of [[FPSV+' ips','image '+DIAG_DT.toFixed(1)+' ms','pire '+DIAG_PEAK.toFixed(0)+' ms'],
                      ['JS '+DIAG_JS.toFixed(1)+' ms','hors-JS '+Math.max(0,DIAG_DT-DIAG_JS).toFixed(1)+' ms','effets '+QL+'/3','resol '+Math.round(RES*100)+' %'],seg3]){
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
  if(G.help>0){c.globalAlpha=Math.min(1,G.help/60);c.textAlign='center';c.textBaseline='bottom';c.font='500 14px '+FD;c.fillStyle='#e6e2ff';
    const hl=inp.touch?['Pouce gauche : bouger','Pouce droit : viser (auto sinon)','⚡ : dash']:['ZQSD ou flèches : bouger','Souris : viser (auto sinon)','Espace : dash'];
    if(narrow)hl.forEach((s,i)=>c.fillText(s,W/2,H-250+i*22));else c.fillText(hl.join('   ·   '),W/2,H-44);c.globalAlpha=1;}
  G.toasts.forEach((t,i)=>{const a=Math.min(1,t.t/10,(170-t.t)/20);c.globalAlpha=a;c.textAlign='center';c.textBaseline='top';fitFont(c,t.s,W-40,15,'700');const y=(narrow?H*.6:70)+i*28,w=c.measureText(t.s).width+28;
    c.fillStyle='rgba(20,12,34,.9)';c.fillRect(W/2-w/2,y,w,24);c.strokeStyle=COL.gd;c.strokeRect(W/2-w/2+.5,y+.5,w-1,23);c.fillStyle=COL.gd;c.fillText(t.s,W/2,y+4);});
  c.globalAlpha=1;
  const bn=G.banner;
  if(bn){const a=Math.min(1,bn.t/12,(bn.max-bn.t)/20),y=W<600?H*.45:H*.34;c.globalAlpha=a;c.textAlign='center';c.textBaseline='middle';const sz=fitFont(c,bn.s,W-28,Math.min(54,W*.095),'700');
    if(bn.t<12){c.fillStyle=rgba(COL.mg,.7);c.fillText(bn.s,W/2-4,y);c.fillStyle=rgba(COL.cy,.7);c.fillText(bn.s,W/2+4,y);}
    c.fillStyle=bn.col;c.fillText(bn.s,W/2,y);if(bn.sub){fitFont(c,bn.sub,W-24,16,'500');c.fillStyle='#e6e2ff';c.fillText(bn.sub,W/2,y+sz*.7);}c.globalAlpha=1;}
}
