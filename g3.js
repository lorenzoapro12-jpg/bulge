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
  RZ=CAM.z;if(inGame)lerpIn(A);
  VL=CAM.x-(W/2+60)/RZ;VR=CAM.x+(W/2+60)/RZ;VT=CAM.y-(H/2+60)/RZ;VB=CAM.y+(H/2+60)/RZ;
  const mix=biomeMix(CAM.x,CAM.y);
  streamWorld(bakeBudget());
  /* le sol de secours n'est dessiné que si un chunk visible n'est pas encore prêt */
  if(!chunksCover()){c.fillStyle='#05030c';c.fillRect(0,0,cv.width,cv.height);screenTf();drawGround();}
  worldTf();drawChunks();
  for(const m of mix)if(m.b==='sea'&&m.w>.3&&QL>=2)drawCaustics(m.w);
  /* couche basse résolution : ambiance lointaine + halos */
  lowBegin();if(QL>=2){lowScreen();drawFar(mix);drawVista(mix);LOWN++;}lowWorld();if(sk<2)drawLowGlows();lowEnd();
  worldTf();drawEdges();drawObstacles();if(inGame){gcDrawWorld();gsDrawWorld();giDrawWorld();gxDrawWorld();gvDrawWorld();}
  if(inGame){drawObjectives();drawPickups();drawShadows(mix);drawTrails();gcDrawUnder();giDrawUnder();drawEnemies();drawBoss();drawPlayer();drawBullets();drawFX();gcDrawOver();}
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
  for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy);if(c)for(const it of c.live)drawLive(it);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function drawLive(it){
  const c=ctx;
  switch(it.t){
    case 'kelp':{if(!vis(it.x,it.y,90))return;c.strokeStyle='rgba(47,191,143,.78)';c.lineCap='round';c.lineWidth=4;
      for(let k=0;k<3;k++){const a0=it.ph+k*2.1;let x=it.x,y=it.y;c.beginPath();c.moveTo(x,y);for(let j=1;j<=6;j++){const a=a0+Math.sin(RT*.03+j*.7+it.ph+k)*.5;x+=Math.cos(a)*12*it.s;y+=Math.sin(a)*12*it.s;c.lineTo(x,y);}c.stroke();c.fillStyle='rgba(109,255,217,.85)';c.beginPath();c.arc(x,y,2.6,0,TAU);c.fill();}
      c.lineCap='butt';break;}
    case 'bloom':{if(!vis(it.x,it.y,60))return;const p=.5+.5*Math.sin(RT*.05+it.ph);c.globalCompositeOperation='lighter';soft(it.x,it.y,42*it.s*(1+p*.3),'#ff5ad8',.3+.25*p);c.globalCompositeOperation='source-over';c.globalAlpha=1;
      c.fillStyle='#ff8fe0';for(let k=0;k<6;k++){const a=k/6*TAU+RT*.004;c.beginPath();c.ellipse(it.x+Math.cos(a)*11*it.s,it.y+Math.sin(a)*11*it.s,9*it.s,4*it.s,a,0,TAU);c.fill();}
      c.fillStyle='#ffe9a8';c.beginPath();c.arc(it.x,it.y,4*it.s,0,TAU);c.fill();break;}
    case 'beacon':{if(!vis(it.x,it.y,40))return;const on=Math.sin(RT*.08+it.ph)>.3,col=on?'#2de2ff':'#ff2d95';c.globalCompositeOperation='lighter';soft(it.x,it.y,26,col,.5);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle=col;c.fillRect(it.x-4,it.y-4,8,8);break;}
    case 'car':{const p=((it.ph+RT*it.spd)%CH+CH)%CH;const x=it.vert?it.x:it.x+p,y=it.vert?it.y+p:it.y;if(!vis(x,y,30))return;
      const dx=it.vert?0:Math.sign(it.spd),dy=it.vert?Math.sign(it.spd):0;c.globalCompositeOperation='lighter';soft(x+dx*18,y+dy*18,16,'#fff3c4',.55);soft(x-dx*13,y-dy*13,9,'#ff3355',.7);
      c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#2c2b3e';c.fillRect(x-(it.vert?5:10),y-(it.vert?10:5),it.vert?10:20,it.vert?20:10);break;}
    case 'shimmer':{if(!vis(it.x,it.y,20))return;const p=Math.pow(Math.max(0,Math.sin(RT*.04+it.ph)),8);if(p<.05)return;c.globalAlpha=p;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.moveTo(it.x-8,it.y);c.lineTo(it.x+8,it.y);c.moveTo(it.x,it.y-8);c.lineTo(it.x,it.y+8);c.stroke();c.globalAlpha=1;break;}
    case 'node':{if(!vis(it.x,it.y,40))return;const p=.5+.5*Math.sin(RT*.06+it.ph);c.globalCompositeOperation='lighter';soft(it.x,it.y,20+p*12,'#ff3355',.3+.3*p);c.globalCompositeOperation='source-over';c.globalAlpha=1;break;}
    case 'moth':{ /* Phalenes des plaines. Elles s'ecartent du joueur puis reviennent SANS AUCUN
       ETAT : le decalage est une fonction pure de la distance, donc la position reste
       reproductible et le retour est automatique des qu'on s'eloigne.
       Lisibilite : le sol des plaines est vert, donc un halo vert-jaune s'y noie (mesure du
       27/09 : +0 pixel visible). Coeur blanc chaud et ailes claires pour contraster. */
      if(!vis(it.x,it.y,110))return;
      let x=it.x,y=it.y;
      if(G&&G.p){const dx=x-G.p.x,dy=y-G.p.y,d=Math.hypot(dx,dy)||1,R=175;
        if(d<R){const k=(1-d/R)*(1-d/R)*52;x+=dx/d*k;y+=dy/d*k;}}
      if(!vis(x,y,34))return;
      const bf=.5+.5*Math.sin(RT*.22+it.ph*3);
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
      const sp=RT*.05+it.ph,bx=it.x+((sp*170)%760)-380,by=it.y+Math.sin(sp*.8+it.ph)*34;
      if(!vis(bx,by,70))return;
      const f=.5+.5*Math.sin(RT*.22+it.ph*5);
      c.strokeStyle='rgba(16,20,46,.30)';c.lineWidth=2;c.lineCap='round';   /* ombre */
      c.beginPath();c.moveTo(bx-6*it.s+30,by+34);c.lineTo(bx+30,by+34-3*it.s);c.lineTo(bx+6*it.s+30,by+34);c.stroke();
      c.strokeStyle='rgba(242,248,255,.92)';c.lineWidth=1.7;
      c.beginPath();c.moveTo(bx-8*it.s,by);c.quadraticCurveTo(bx,by-7*it.s*(.55+f),bx+8*it.s,by);c.stroke();break;}
  }
}
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
      if(o.b==='core'){ctx.globalCompositeOperation='lighter';soft(o.x,o.y,o.r*1.3,'#ff3355',.1+.08*Math.sin(RT*.05+o.s));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}}}
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
  const c=ctx,n=QL>=3?64:QL===2?40:22,k=Math.min(3,RDT/16.67);
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
      case 'embers':c.globalCompositeOperation='lighter';glow(p.x,p.y,2+p.s*2.5,'#ff8a2d',.4+.3*Math.sin(RT*.3+p.a));break;
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
    const MW=W-pad*2,PX0=narrow?10:12,DYS=narrow?15:16;
    /* Le bloc est ancre AU-DESSUS des controles du bas, jamais colle au bord : sur tactile le
       bouton de dash occupe (W-62, H-92) avec un rayon de 34, et sur poste fixe la ligne
       « Dash pret (Espace) » occupe deja y = H-pad. Colle au bord, le compteur passait SOUS le
       bouton de dash (constate a l'ecran le 29/09/2026) : « cuisson worker N » etait a moitie
       masque — soit exactement le mot qu'on est venu lire. */
    const YB=inp.touch?H-132:H-pad-20;
    const cuis=(typeof WK==='undefined'||WK===null)?'?':(WK?'worker '+WKN:'sur place');
    const seg3=['PS '+PS.toFixed(2),'canvas '+cv.width+'×'+cv.height,'DPR '+DPR,'ref '+REFDT.toFixed(1)+' ms','cuisson '+cuis];
    if(DIAG_MARGIN>=0)seg3.push('marge audio '+DIAG_MARGIN.toFixed(2)+' s');
    const out=[[FPSV+' ips','image '+DIAG_DT.toFixed(1)+' ms','pire '+DIAG_PEAK.toFixed(0)+' ms'],
               ['JS '+DIAG_JS.toFixed(1)+' ms','hors-JS '+Math.max(0,DIAG_DT-DIAG_JS).toFixed(1)+' ms','effets '+QL+'/3','resol '+Math.round(RES*100)+' %']];
    c.font='500 '+PX0+'px '+FD;
    /* jointure : « · » entre morceaux, mais un simple espace apres un morceau qui finit par « : »
       — sinon la ligne s'ecrit « ou : · render 6.06/12 » au lieu de « ou : render 6.06/12 ». */
    const jn=a=>{let s='';for(let i=0;i<a.length;i++)s+=(i?(a[i-1].slice(-1)===':'?' ':' · '):'')+a[i];return s;};
    const MWj=a=>c.measureText(jn(a)).width;
    let cu=[];for(const s of seg3){if(cu.length&&MWj(cu.concat([s]))>MW){out.push(cu);cu=[];}cu.push(s);}
    if(cu.length)out.push(cu);
    if(typeof JSPROFTOP!=='undefined'&&JSPROFTOP.length)out.push(['où :'].concat(JSPROFTOP.map(q=>q[0]+' '+q[1].toFixed(2)+'/'+q[2].toFixed(0))));
    const y0=YB-(out.length-1)*DYS,dr=[];
    for(let i=0;i<out.length;i++){let n=out[i].length,p=PX0;c.font='500 '+p+'px '+FD;
      const tex=k=>jn(out[i].slice(0,k))+(k<n?' …':'');
      while(n>1&&c.measureText(tex(n)).width>MW)n--;
      const t=tex(n);let w=c.measureText(t).width;
      if(w>MW&&p>9){p=Math.max(9,Math.floor(p*MW/w));c.font='500 '+p+'px '+FD;w=MW;}
      dr.push([t,Math.min(w,MW)]);}
    /* Fond : en gris clair sur un terrain clair le compteur devient illisible (constate a
       l'ecran). Un bandeau sombre derriere le bloc, pose AVANT le texte, garantit la lecture
       quel que soit le biome dessous. */
    let wmax=0;for(const d of dr)if(d[1]>wmax)wmax=d[1];
    c.fillStyle='rgba(8,5,18,.62)';c.fillRect(pad-6,y0-16,wmax+12,(out.length-1)*DYS+22);
    c.fillStyle='#8f89b3';
    for(let i=0;i<out.length;i++)c.fillText(dr[i][0],pad,y0+i*DYS);}
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
