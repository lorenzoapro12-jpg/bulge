/* =========================================================
   ART DU MONDE : décor, obstacles, parallaxe, météo
   ========================================================= */
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();}
function shadowCircle(g,x,y,r,b,a){g.save();g.globalAlpha=(a||.5)*1.4;const R=r+(b||8);g.drawImage(shadowSpr(),x-R,y-R,R*2,R*2);g.restore();}
function shadowPoly(g,pts,dx,dy,b,a){let cx=0,cy=0;for(const p of pts){cx+=p[0];cy+=p[1];}cx/=pts.length;cy/=pts.length;let r=0;for(const p of pts)r=Math.max(r,Math.hypot(p[0]-cx,p[1]-cy));shadowCircle(g,cx+dx,cy+dy,r,b,a);}
function shadowRect(g,dx,dy,w,h,b,a){a=a||.55;g.save();g.fillStyle='rgba(0,0,0,'+(a/4)+')';for(let k=3;k>=0;k--){const e=b*k/3;g.fillRect(dx-e,dy-e,w+2*e,h+2*e);}g.restore();}
function radial(g,x,y,r,col,a){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgba(col,a));gr.addColorStop(1,rgba(col,0));g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}

let BK0=0,BK1=0;
function ix(x,r){return clamp(x,BK0+r,BK0+CH-r);}
function iy(y,r){return clamp(y,BK1+r,BK1+CH-r);}
/* ---------- décor au sol (cuit une fois par chunk) ---------- */
const DECO={
  plains(g,x,y,r,i){
    if(i%9===0){const R0=70+r()*110;radial(g,ix(x,R0),iy(y,R0),R0,'#b4ff96',.07);return;}
    if(i%4===0){g.fillStyle=['#ffe27a','#ff9ad5','#ffffff','#9dfff0'][Math.floor(r()*4)];g.globalAlpha=.8;for(let k=0;k<3;k++){g.beginPath();g.arc(x+(r()-.5)*16,y+(r()-.5)*16,1.6+r()*1.6,0,TAU);g.fill();}g.globalAlpha=1;return;}
    g.strokeStyle=r()<.5?'rgba(109,255,181,.34)':'rgba(214,255,122,.26)';g.lineWidth=1.6;g.beginPath();
    for(let k=0;k<6;k++){const a=r()*TAU,l=7+r()*11;g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.4)*l*.6,y+Math.sin(a+.4)*l*.6,x+Math.cos(a)*l,y+Math.sin(a)*l);}g.stroke();},
  floral(g,x,y,r,i){
    if(i%6===0){g.strokeStyle='rgba(60,170,110,.45)';g.lineWidth=2.4;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(ix(x+(r()-.5)*160,4),iy(y+(r()-.5)*160,4),ix(x+(r()-.5)*160,4),iy(y+(r()-.5)*160,4),ix(x+(r()-.5)*200,4),iy(y+(r()-.5)*200,4));g.stroke();return;}
    if(i%3===0){g.fillStyle=r()<.5?'rgba(255,120,220,.35)':'rgba(255,209,102,.3)';for(let k=0;k<4;k++){g.beginPath();g.ellipse(x+(r()-.5)*30,y+(r()-.5)*30,4,2,r()*TAU,0,TAU);g.fill();}return;}
    const n=5+Math.floor(r()*2),s=5+r()*6,col=['#ff5ad8','#c77dff','#ff8fb1','#ffd166'][Math.floor(r()*4)],rot=r()*TAU;
    g.fillStyle=col;g.globalAlpha=.85;for(let k=0;k<n;k++){const a=rot+k/n*TAU;g.beginPath();g.ellipse(x+Math.cos(a)*s*.7,y+Math.sin(a)*s*.7,s*.6,s*.34,a,0,TAU);g.fill();}
    g.globalAlpha=1;g.fillStyle='#ffe9a8';g.beginPath();g.arc(x,y,s*.3,0,TAU);g.fill();},
  sea(g,x,y,r,i){
    if(i%5===0){g.strokeStyle='rgba(120,210,255,.09)';g.lineWidth=2;for(let k=0;k<4;k++){g.beginPath();g.arc(x,y+k*9,40+r()*30,Math.PI*1.15,Math.PI*1.85);g.stroke();}return;}
    if(i%11===0){g.save();g.translate(x,y);g.rotate(r()*TAU);g.fillStyle='rgba(255,138,90,.8)';for(let k=0;k<5;k++){g.rotate(TAU/5);g.beginPath();g.ellipse(6,0,6,2.2,0,0,TAU);g.fill();}g.restore();return;}
    if(i%4===0){g.strokeStyle=r()<.5?'rgba(255,90,216,.5)':'rgba(52,230,255,.5)';g.lineWidth=1.5;g.beginPath();for(let k=0;k<10;k++){const a=k/10*TAU;g.moveTo(x,y);g.lineTo(x+Math.cos(a)*8,y+Math.sin(a)*8);}g.stroke();radial(g,x,y,14,'#34e6ff',.12);return;}
    g.fillStyle='rgba(20,60,120,.6)';g.beginPath();g.ellipse(x,y,3+r()*5,2+r()*4,r()*TAU,0,TAU);g.fill();},
  sky(g,x,y,r,i){
    if(i%3===0){const R0=40+r()*60;g.save();g.translate(ix(x,R0*2.2),iy(y,R0));g.scale(2.2,1);radial(g,0,0,R0,'#ffffff',.045);g.restore();return;}
    g.fillStyle='rgba(255,255,255,'+(.2+r()*.4)+')';g.beginPath();g.arc(x,y,.8+r()*1.2,0,TAU);g.fill();},
  cyber(g,x,y,r,i){
    if(i%3===0){let px=x,py=y;const col=r()<.7?'rgba(45,226,255,.38)':'rgba(255,45,149,.38)';g.strokeStyle=col;g.lineWidth=2;g.beginPath();g.moveTo(px,py);
      for(let k=0;k<4;k++){if(k%2===0)px+=(r()<.5?-1:1)*(20+r()*50);else py+=(r()<.5?-1:1)*(20+r()*50);g.lineTo(px,py);}g.stroke();
      g.fillStyle=col.replace('.38','.8');g.beginPath();g.arc(x,y,3,0,TAU);g.arc(px,py,3,0,TAU);g.fill();return;}
    if(i%5===0){g.strokeStyle='rgba(45,226,255,.25)';g.lineWidth=1;const w=10+r()*18,h=8+r()*12;g.strokeRect(x,y,w,h);for(let k=2;k<w;k+=4){g.beginPath();g.moveTo(x+k,y);g.lineTo(x+k,y-3);g.moveTo(x+k,y+h);g.lineTo(x+k,y+h+3);g.stroke();}return;}
    g.fillStyle='rgba(45,226,255,.18)';g.fillRect(x,y,2,2);},
  urban(g,x,y,r,i){
    if(i%6===0){x=ix(x,48);y=iy(y,28);const gr=g.createRadialGradient(x,y,0,x,y,26);const c=r()<.5?'255,45,149':'45,226,255';gr.addColorStop(0,'rgba('+c+',.16)');gr.addColorStop(1,'rgba('+c+',0)');g.fillStyle=gr;g.save();g.translate(x,y);g.scale(1.8,1);g.translate(-x,-y);g.fillRect(x-26,y-26,52,52);g.restore();return;}
    if(i%7===0){g.fillStyle='#0c0c14';g.beginPath();g.arc(x,y,6,0,TAU);g.fill();g.strokeStyle='#2a2838';g.lineWidth=1.5;g.stroke();return;}
    g.fillStyle='rgba(255,255,255,.035)';g.fillRect(x,y,2+r()*4,2+r()*4);},
  ice(g,x,y,r,i){
    if(i%4===0){const R0=40+r()*70;radial(g,ix(x,R0),iy(y,R0),R0,'#e0ffff',.07);return;}
    if(i%4!==3){g.strokeStyle='rgba(230,250,255,.3)';g.lineWidth=1.2;g.beginPath();let px=x,py=y;g.moveTo(px,py);const a0=r()*TAU;for(let k=0;k<6;k++){const a=a0+(r()-.5)*1.4;px+=Math.cos(a)*(8+r()*16);py+=Math.sin(a)*(8+r()*16);g.lineTo(px,py);}g.stroke();return;}
    g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.arc(x,y,1+r(),0,TAU);g.fill();},
  core(g,x,y,r,i){
    if(i%3===0){g.strokeStyle='rgba(255,51,85,.26)';g.lineWidth=4;g.beginPath();g.moveTo(x,y);const x2=ix(x+(r()-.5)*220,5),y2=iy(y+(r()-.5)*220,5);g.quadraticCurveTo(ix(x+(r()-.5)*160,5),iy(y+(r()-.5)*160,5),x2,y2);g.stroke();g.strokeStyle='rgba(255,138,45,.35)';g.lineWidth=1.2;g.stroke();return;}
    g.fillStyle='rgba(90,18,32,.8)';g.beginPath();g.arc(x,y,3+r()*6,0,TAU);g.fill();g.strokeStyle='rgba(255,51,85,.4)';g.lineWidth=1;g.stroke();},
};
function drawGrid(g,c){
  const x0=c.x0,y0=c.y0;g.strokeStyle='rgba(45,226,255,.075)';g.lineWidth=1;g.beginPath();
  for(let s=0;s<CH;s+=64)for(let t=0;t<CH;t+=64){
    if(biomeAt(x0+s+32,y0+t+32)!=='cyber')continue;g.moveTo(x0+s,y0+t);g.lineTo(x0+s+64,y0+t);g.moveTo(x0+s,y0+t);g.lineTo(x0+s,y0+t+64);}
  g.stroke();
}
function drawRoads(g,c){
  const x0=c.x0,y0=c.y0;
  for(let L=Math.floor(x0/256)*256;L<=x0+CH+30;L+=256)for(let s=y0;s<y0+CH;s+=32){
    if(biomeAt(L,s+16)!=='urban')continue;g.fillStyle='#17161f';g.fillRect(L-30,s,60,32);g.fillStyle='#2b2a3a';g.fillRect(L-34,s,4,32);g.fillRect(L+30,s,4,32);
    if(((s/32)|0)%2===0){g.fillStyle='rgba(255,201,60,.5)';g.fillRect(L-1.5,s+6,3,18);}}
  for(let L=Math.floor(y0/256)*256;L<=y0+CH+30;L+=256)for(let s=x0;s<x0+CH;s+=32){
    if(biomeAt(s+16,L)!=='urban')continue;g.fillStyle='#17161f';g.fillRect(s,L-30,32,60);g.fillStyle='#2b2a3a';g.fillRect(s,L-34,32,4);g.fillRect(s,L+30,32,4);
    if(((s/32)|0)%2===0){g.fillStyle='rgba(255,201,60,.5)';g.fillRect(s+6,L-1.5,18,3);}}
  g.fillStyle='rgba(255,255,255,.3)';
  for(let X=Math.floor(x0/256)*256;X<=x0+CH;X+=256)for(let Y=Math.floor(y0/256)*256;Y<=y0+CH;Y+=256){if(biomeAt(X,Y)!=='urban')continue;
    g.fillStyle='#17161f';g.fillRect(X-30,Y-30,60,60);g.fillStyle='rgba(255,255,255,.28)';for(let k=-24;k<24;k+=8){g.fillRect(X+k,Y-44,4,10);g.fillRect(X+k,Y+34,4,10);g.fillRect(X-44,Y+k,10,4);g.fillRect(X+34,Y+k,10,4);}}
}
/* ---------- Mégapole : trottoirs, pieds de tours, lampadaires, flaques, terrains vagues ----------
   Même étape de cuisson que les chaussées, juste après elles, par lots (générateur) ; rien n'est tracé
   hors de la ville. Lampadaires et flaques sont posés sur une grille fixe du monde (graine par cellule) :
   un chunk redessine aussi ceux de ses voisins qui débordent sur lui, sinon une rue posée sur la
   frontière de deux chunks aurait une couture. Les halos sont des sprites (drawImage) et non des dégradés. */
function* drawCity(g,c){
  const x0=c.x0,y0=c.y0,E=72,ur=(x,y)=>biomeAt(x,y)==='urban',S=WD.seed^0xc17e;let n=0,tw=0;
  for(let bx=0;bx<2;bx++)for(let by=0;by<2;by++){const X=x0+bx*256,Y=y0+by*256;if(!ur(X+128,Y+128))continue;
    const r=mkRng(hash2(X>>8,Y>>8,S)),T=c.obs.filter(o=>o.b==='urban'&&o.x>=X&&o.x<X+256&&o.y>=Y&&o.y<Y+256);tw+=T.length;
    g.fillStyle='#1d1c2a';g.fillRect(X+34,Y+34,188,188);g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=1;g.beginPath();
    for(let k=50;k<222;k+=16){g.moveTo(X+k,Y+34);g.lineTo(X+k,Y+222);g.moveTo(X+34,Y+k);g.lineTo(X+222,Y+k);}g.stroke();
    for(const o of T)shadowRect(g,o.x-3,o.y-3,o.w+6,o.h+6,16,.95);
    yield;
    if(!T.length){const L0=X+46,T0=Y+46,Z=164;
      if(r()<.5){ /* parking : places peintes, voitures garées */
        g.fillStyle='#16151e';g.fillRect(L0,T0,Z,Z);g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=1.5;g.beginPath();
        for(const yy of [T0+8,T0+Z-44])for(let xx=L0+6;xx<=L0+Z-6;xx+=19){g.moveTo(xx,yy);g.lineTo(xx,yy+36);}g.stroke();
        for(const yy of [T0+8,T0+Z-44])for(let xx=L0+6;xx+19<=L0+Z-6;xx+=19){if(r()<.4)continue;const col=['#3a2440','#233448','#4a3a22','#2c2c38','#512034'][Math.floor(r()*5)],cy=yy+5+r()*4;
          g.fillStyle='rgba(0,0,0,.45)';g.fillRect(xx+4,cy+2,13,27);g.fillStyle=col;g.fillRect(xx+3,cy,13,26);g.fillStyle='rgba(150,190,255,.3)';g.fillRect(xx+5,cy+(yy===T0+8?17:4),9,5);}
        g.fillStyle='rgba(255,201,60,.5)';for(let xx=L0+10;xx<L0+Z-10;xx+=26)g.fillRect(xx,T0+Z/2-1,12,2);}
      else{ /* square : pelouse, allée, arbres */
        g.fillStyle='#0f2621';g.fillRect(L0,T0,Z,Z);g.strokeStyle='#26253a';g.lineWidth=12;g.beginPath();g.moveTo(L0,T0+Z*r());g.lineTo(L0+Z,T0+Z*r());g.stroke();
        const nt=5+Math.floor(r()*4);for(let k=0;k<nt;k++){const tx=L0+16+r()*(Z-32),ty=T0+16+r()*(Z-32),tr=9+r()*8;
          g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.arc(tx+5,ty+6,tr,0,TAU);g.fill();g.fillStyle='#17432f';g.beginPath();g.arc(tx,ty,tr,0,TAU);g.fill();g.fillStyle='#2a6e48';g.beginPath();g.arc(tx-tr*.3,ty-tr*.3,tr*.55,0,TAU);g.fill();}}
      yield;}}
  const fx=(a,b)=>a>x0-E&&a<x0+CH+E&&b>y0-E&&b<y0+CH+E;
  /* lampadaires au sodium, au milieu de chaque tronçon de rue, côté alterné */
  for(let v=0;v<2;v++)for(let L=Math.floor((v?y0:x0)/256)*256-256;L<=(v?y0:x0)+CH+256;L+=256)for(let t=Math.floor((v?x0:y0)/256)*256-128;t<=(v?x0:y0)+CH+256;t+=256){
    const h=hash2(L>>8,t>>7,S+v),sd=h&1?1:-1,lx=v?t:L+sd*40,ly=v?L+sd*40:t;if(!fx(lx,ly)||!ur(lx,ly))continue;
    const px=v?lx:lx-sd*16,py=v?ly-sd*16:ly,dim=(h>>>3)%9===0?.35:1;
    g.globalAlpha=.3*dim;g.drawImage(softSpr('#ffb45a'),px-70,py-70,140,140);g.globalAlpha=1;g.fillStyle='#0b0a12';g.beginPath();g.arc(lx,ly,4,0,TAU);g.fill();
    g.fillStyle=dim<1?'#8a6a40':'#fff0c8';g.beginPath();g.arc(px*.35+lx*.65,py*.35+ly*.65,2.4,0,TAU);g.fill();if(++n%6===0)yield;}
  /* flaques : reflet d'enseigne étiré par la pluie */
  for(let v=0;v<2;v++)for(let L=Math.floor((v?y0:x0)/256)*256-256;L<=(v?y0:x0)+CH+256;L+=256)for(let t=Math.floor((v?x0:y0)/128)*128-64;t<=(v?x0:y0)+CH+128;t+=128){
    const h=hash2(L>>8,t>>6,S^0x5a+v);if((h&7)>2)continue;const o=((h>>>3)&63)-32,a=v?t+((h>>>9)&63):L+o,b=v?L+o:t+((h>>>9)&63);if(!fx(a,b)||!ur(a,b))continue;
    const rx=12+((h>>>15)&15),col=['#ff2d95','#2de2ff','#ffc93c'][(h>>>19)%3];
    g.fillStyle='rgba(110,130,200,.13)';g.beginPath();g.ellipse(a,b,rx,rx*.45,0,0,TAU);g.fill();
    g.globalAlpha=.4;g.fillStyle=col;g.fillRect(a-1.5,b-rx*.3,3,rx*.6);g.globalAlpha=.25;g.drawImage(softSpr(col),a-rx,b-rx*.5,rx*2,rx);g.globalAlpha=1;if(++n%6===0)yield;}
  /* textures de façade (partagées, une fois pour toutes) : préparées ici, par lots, avant qu'une tour ne les demande */
  if(tw)for(let k=0;k<FACN*2;k++)if(!FACS[k]){const it=facIt(k);while(!it.next().done)yield;}
}
/* ---------- relief ombré (collines et vallées), sans couture entre chunks ---------- */
let RELC=null,RELG=null,RELI=null;
function drawRelief(g,c){
  const n=16,s=CH/n;if(!RELC){RELC=mkCanvas(n+1,n+1);RELG=RELC.getContext('2d');RELI=RELG.createImageData(n+1,n+1);}
  const d=RELI.data,e=24;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=c.x0+i*s,y=c.y0+j*s,h=fbmH(x,y),gx=(fbmH(x+e,y)-h)/e,gy=(fbmH(x,y+e)-h)/e;
    const lit=clamp((-gx*.72-gy*.7)*2600,-1,1),low=clamp((.5-h)*2.2,0,1),o=(j*(n+1)+i)*4;
    if(lit>0){d[o]=d[o+1]=235;d[o+2]=255;d[o+3]=lit*46;}else{d[o]=d[o+1]=0;d[o+2]=10;d[o+3]=-lit*80+low*70;}}
  RELG.putImageData(RELI,0,0);g.imageSmoothingEnabled=true;g.drawImage(RELC,.5,.5,n,n,c.x0,c.y0,CH,CH);
}
/* ---------- sentiers ---------- */
const TSTY={plains:['rgba(62,52,26,.55)','rgba(200,180,120,.2)',62],floral:['rgba(70,18,58,.5)','rgba(255,150,220,.2)',58],sea:['rgba(160,190,170,.07)','rgba(220,255,240,.06)',64],
  sky:['rgba(255,255,255,.1)','rgba(255,255,255,.3)',46,[10,14]],cyber:['rgba(45,226,255,.07)','rgba(45,226,255,.5)',48,[26,10]],urban:['rgba(4,4,12,.42)','rgba(255,214,120,.85)',74,[1,21]],
  ice:['rgba(210,245,255,.14)','rgba(255,255,255,.22)',60],core:['rgba(80,8,18,.55)','rgba(255,90,60,.32)',54]};
function drawPaths(g,c){
  const L=WD.segB.get(bk(c.cx,c.cy));if(!L)return;const by={};
  for(const sg of L){const b=biomeAt((sg.ax+sg.bx)/2,(sg.ay+sg.by)/2);(by[b]||(by[b]=[])).push(sg);}
  g.lineCap='round';g.lineJoin='round';
  for(const b in by){const st=TSTY[b],A=by[b];
    const path=()=>{g.beginPath();let lx=NaN,ly=NaN;for(const q of A){if(q.ax!==lx||q.ay!==ly)g.moveTo(q.ax,q.ay);g.lineTo(q.bx,q.by);lx=q.bx;ly=q.by;}};
    path();g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=st[2]+14;g.stroke();
    g.strokeStyle=st[0];g.lineWidth=st[2];g.stroke();
    if(st[3])g.setLineDash(st[3]);g.strokeStyle=st[1];g.lineWidth=b==='cyber'?2:b==='urban'?7:st[2]*.34;g.stroke();g.setLineDash([]);
    /* bornes lumineuses le long du chemin : repères de voyage */
    for(const q of A){if(q.k%6!==3)continue;const dx=q.bx-q.ax,dy=q.by-q.ay,l=Math.hypot(dx,dy)||1,sd=(q.e%2?1:-1)*(st[2]/2+14),x=q.bx-dy/l*sd,y=q.by+dx/l*sd;
      radial(g,x,y,22,BIO[b].a,.28);g.fillStyle='#10101c';g.beginPath();g.arc(x,y,5,0,TAU);g.fill();g.fillStyle=BIO[b].a;g.beginPath();g.arc(x,y,2.4,0,TAU);g.fill();}}
  g.lineCap='butt';g.lineJoin='miter';
}
/* ---------- sol des monuments ---------- */
const LMG={
  plains(g,L){radial(g,L.x,L.y,L.R+50,'#3a3018',.55);g.strokeStyle='rgba(220,210,160,.16)';g.lineWidth=3;for(const r of [L.R-70,L.R-110]){g.beginPath();g.arc(L.x,L.y,r,0,TAU);g.stroke();}
    g.strokeStyle='rgba(109,255,181,.22)';g.lineWidth=2;g.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU;g.moveTo(L.x+Math.cos(a)*50,L.y+Math.sin(a)*50);g.lineTo(L.x+Math.cos(a)*(L.R-110),L.y+Math.sin(a)*(L.R-110));}g.stroke();},
  floral(g,L){g.save();g.translate(L.x,L.y);for(let k=0;k<9;k++){g.rotate(TAU/9);g.fillStyle=k%2?'rgba(255,90,216,.1)':'rgba(255,209,102,.07)';g.beginPath();g.ellipse(L.R*.5,0,L.R*.5,L.R*.2,0,0,TAU);g.fill();}g.restore();radial(g,L.x,L.y,L.R*.6,'#ff5ad8',.12);},
  sea(g,L){radial(g,L.x,L.y,L.R+40,'#d8c894',.2);g.strokeStyle='rgba(255,255,220,.08)';g.lineWidth=2;for(let r=60;r<L.R;r+=34){g.beginPath();g.arc(L.x,L.y,r,0,TAU);g.stroke();}},
  sky(g,L){g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(L.x+18,L.y+26,L.R-30,0,TAU);g.fill();g.fillStyle='rgba(225,232,255,.2)';g.beginPath();g.arc(L.x,L.y,L.R-30,0,TAU);g.fill();
    g.strokeStyle='rgba(255,230,160,.4)';g.lineWidth=2;g.beginPath();g.arc(L.x,L.y,L.R-44,0,TAU);g.stroke();g.beginPath();g.arc(L.x,L.y,70,0,TAU);g.stroke();
    g.beginPath();for(let k=0;k<12;k++){const a=k/12*TAU;g.moveTo(L.x+Math.cos(a)*70,L.y+Math.sin(a)*70);g.lineTo(L.x+Math.cos(a)*(L.R-44),L.y+Math.sin(a)*(L.R-44));}g.strokeStyle='rgba(255,255,255,.14)';g.stroke();},
  cyber(g,L){const r=L.R-50;g.fillStyle='rgba(10,8,34,.7)';g.fillRect(L.x-r,L.y-r,r*2,r*2);g.strokeStyle='rgba(45,226,255,.3)';g.lineWidth=2;g.strokeRect(L.x-r,L.y-r,r*2,r*2);
    g.strokeStyle='rgba(45,226,255,.12)';g.lineWidth=1;g.beginPath();for(let k=-r;k<=r;k+=32){g.moveTo(L.x+k,L.y-r);g.lineTo(L.x+k,L.y+r);g.moveTo(L.x-r,L.y+k);g.lineTo(L.x+r,L.y+k);}g.stroke();radial(g,L.x,L.y,120,'#ff2d95',.15);},
  urban(g,L){g.save();g.beginPath();g.arc(L.x,L.y,L.R-10,0,TAU);g.fillStyle='#22212e';g.fill();g.clip();g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=1;g.beginPath();for(let k=-L.R;k<=L.R;k+=22){g.moveTo(L.x+k,L.y-L.R);g.lineTo(L.x+k,L.y+L.R);g.moveTo(L.x-L.R,L.y+k);g.lineTo(L.x+L.R,L.y+k);}g.stroke();g.restore();
    g.strokeStyle='rgba(255,201,60,.35)';g.lineWidth=3;g.beginPath();g.arc(L.x,L.y,L.R-10,0,TAU);g.stroke();
    /* parvis du phare : pavage en rosace, couronne de réverbères, pied de la tour dans l'ombre */
    g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=2;for(const r of [90,140,190]){g.beginPath();g.arc(L.x,L.y,r,0,TAU);g.stroke();}
    g.beginPath();for(let k=0;k<24;k++){const a=k/24*TAU;g.moveTo(L.x+Math.cos(a)*90,L.y+Math.sin(a)*90);g.lineTo(L.x+Math.cos(a)*(L.R-14),L.y+Math.sin(a)*(L.R-14));}g.stroke();
    radial(g,L.x,L.y,110,'#000000',.55);
    for(let k=0;k<12;k++){const a=k/12*TAU+.13,x=L.x+Math.cos(a)*(L.R-40),y=L.y+Math.sin(a)*(L.R-40);g.globalAlpha=.3;g.drawImage(softSpr('#ffb45a'),x-56,y-56,112,112);g.globalAlpha=1;
      g.fillStyle='#0b0a12';g.beginPath();g.arc(x,y,4,0,TAU);g.fill();g.fillStyle='#fff0c8';g.beginPath();g.arc(x,y,2.2,0,TAU);g.fill();}},
  ice(g,L){radial(g,L.x,L.y,L.R+30,'#bff4ff',.22);g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1.2;const r=mkRng(L.s);g.beginPath();
    for(let k=0;k<10;k++){let x=L.x,y=L.y,a=r()*TAU;g.moveTo(x,y);for(let j=0;j<6;j++){a+=(r()-.5)*.9;x+=Math.cos(a)*L.R/7;y+=Math.sin(a)*L.R/7;g.lineTo(x,y);}}g.stroke();},
};
/* ---------- falaises, haies, récifs, gouffres : pseudo-3D ---------- */
const WACC={plains:'#9dffc8',floral:'#ff7ae6',sea:'#5fe8ff',ice:'#ffffff',core:'#ff5570'};
const WSTY={plains:['#0f2a20','#1f4a36','#3b7d58','rgba(190,255,210,.4)'],floral:['#240824','#46123f','#7a2468','rgba(255,160,235,.45)'],sea:['#041627','#0b3150','#17597c','rgba(120,230,255,.4)'],
  ice:['#1c4660','#4d8fb0','#c8f2ff','rgba(255,255,255,.85)'],core:['#1e0308','#420a14','#7e1a2a','rgba(255,120,110,.45)']};
function shade(h,k){const n=parseInt(h.slice(1),16);let r=n>>16,gg=(n>>8)&255,b=n&255;if(k<0){r*=1+k;gg*=1+k;b*=1+k;}else{r+=(255-r)*k;gg+=(255-gg)*k;b+=(255-b)*k;}return'rgb('+(r|0)+','+(gg|0)+','+(b|0)+')';}
function qrand(q,m){let h=Math.imul(q.h^(m*2654435761),2246822519)>>>0;h^=h>>>13;return (h>>>0)/4294967296;}
/* Murs, franges et plateaux sont des générateurs : chaque `yield` rend la main à streamWorld (qui
   vérifie son budget) puis on reprend EXACTEMENT où on s'était arrêté — même corps, même ordre, mêmes
   save/clip/restore ; seuls des points de pause ont été ajoutés (tous les WY cellules et entre les
   passes). Un seul groupe de murs faisait jusqu'à 18 293 opérations d'un bloc (test/cuisson.js). */
const WY=6;
const CLIFF_TOP={
  plains:function*(g,L){let n=0;g.strokeStyle='rgba(170,255,190,.35)';g.lineWidth=1.3;g.beginPath();for(const q of L){for(let m=0;m<10;m++){const a=qrand(q,m)*TAU,d=qrand(q,m+20)*q.r*.85,x=q.x+Math.cos(a)*d,y=q.y-5+Math.sin(a)*d;g.moveTo(x,y);g.lineTo(x+qrand(q,m+40)*4-2,y-5-qrand(q,m+60)*4);}if(++n%WY===0)yield;}g.stroke();
    for(const q of L){if(qrand(q,99)<.35){g.fillStyle='rgba(120,200,120,.25)';g.beginPath();g.arc(q.x+qrand(q,5)*20-10,q.y-8,10+qrand(q,6)*8,0,TAU);g.fill();}if(++n%WY===0)yield;}},
  floral:function*(g,L){let n=0;for(const q of L){for(let m=0;m<4;m++){const a=qrand(q,m)*TAU,d=qrand(q,m+9)*q.r*.75,x=q.x+Math.cos(a)*d,y=q.y-5+Math.sin(a)*d,col=['#ff5ad8','#ffd06a','#c78bff','#ff8fb0'][m%4];
    g.fillStyle=col;for(let p=0;p<5;p++){const pa=p/5*TAU;g.beginPath();g.ellipse(x+Math.cos(pa)*3,y+Math.sin(pa)*3,2.6,1.5,pa,0,TAU);g.fill();}g.fillStyle='#fff6c8';g.beginPath();g.arc(x,y,1.4,0,TAU);g.fill();}if(++n%WY===0)yield;}},
  sea:function*(g,L){let n=0;for(const q of L){for(let m=0;m<3;m++){const a=qrand(q,m)*TAU,d=qrand(q,m+9)*q.r*.7,x=q.x+Math.cos(a)*d,y=q.y-5+Math.sin(a)*d,col=m%2?'#ff7a9c':'#ffb36b';
    g.strokeStyle=col;g.lineWidth=2;g.beginPath();for(let t=0;t<5;t++){const ta=t/5*TAU+qrand(q,m+30);g.moveTo(x,y);g.lineTo(x+Math.cos(ta)*7,y+Math.sin(ta)*7);}g.stroke();g.fillStyle=col;g.beginPath();g.arc(x,y,2.5,0,TAU);g.fill();}if(++n%WY===0)yield;}},
  ice:function*(g,L){let n=0;for(const q of L){if(qrand(q,1)<.55){const x=q.x+qrand(q,2)*30-15,y=q.y-8+qrand(q,3)*16-8,s=8+qrand(q,4)*10;
    g.fillStyle='rgba(220,245,255,.85)';g.beginPath();g.moveTo(x,y-s*1.6);g.lineTo(x+s*.45,y);g.lineTo(x,y+s*.3);g.lineTo(x-s*.45,y);g.closePath();g.fill();g.fillStyle='rgba(120,190,230,.7)';g.beginPath();g.moveTo(x,y-s*1.6);g.lineTo(x+s*.45,y);g.lineTo(x,y+s*.3);g.closePath();g.fill();}if(++n%WY===0)yield;}
    g.fillStyle='#fff';for(const q of L){for(let m=0;m<4;m++){g.globalAlpha=.4+qrand(q,m+50)*.5;g.fillRect(q.x+qrand(q,m+60)*40-20,q.y-5+qrand(q,m+70)*40-20,1.6,1.6);}if(++n%WY===0)yield;}g.globalAlpha=1;},
  core:function*(g,L){let n=0;g.lineCap='round';for(const w of [[5,'rgba(255,90,60,.25)'],[1.8,'rgba(255,190,90,.9)']]){g.strokeStyle=w[1];g.lineWidth=w[0];g.beginPath();for(const q of L){let x=q.x+qrand(q,1)*20-10,y=q.y-5+qrand(q,2)*20-10;g.moveTo(x,y);for(let m=0;m<4;m++){x+=qrand(q,m+10)*22-11;y+=qrand(q,m+20)*22-11;g.lineTo(x,y);}if(++n%WY===0)yield;}g.stroke();}}};
const CLIFF_EDGE={
  plains:function*(g,L){let n=0;g.strokeStyle='#5fbf7c';g.lineWidth=1.6;g.beginPath();for(const q of L){for(let m=0;m<9;m++){const x=q.x-q.r*.8+m*q.r*.2,y=q.y+q.r*.62+6;g.moveTo(x,y);g.quadraticCurveTo(x+2,y+6,x+qrand(q,m)*4-2,y+8+qrand(q,m+9)*8);}if(++n%WY===0)yield;}g.stroke();},
  floral:function*(g,L){let n=0;g.strokeStyle='#3c9a5a';g.lineWidth=1.8;g.beginPath();for(const q of L){for(let m=0;m<3;m++){const x=q.x-q.r*.6+m*q.r*.6,y=q.y+q.r*.6+6,l=10+qrand(q,m)*16;g.moveTo(x,y);g.bezierCurveTo(x+6,y+l*.3,x-6,y+l*.6,x+2,y+l);}if(++n%WY===0)yield;}g.stroke();
    g.fillStyle='#ff9ad8';for(const q of L){g.beginPath();g.arc(q.x-q.r*.6+qrand(q,4)*q.r*1.2,q.y+q.r*.6+16,2.2,0,TAU);g.fill();if(++n%WY===0)yield;}},
  sea:function*(g,L){let n=0;g.lineWidth=2.4;for(const q of L){for(let m=0;m<3;m++){const x=q.x-q.r*.6+m*q.r*.6,y=q.y+q.r*.6+6,l=14+qrand(q,m)*18;g.strokeStyle=m%2?'#2fbf8f':'#1d8f76';g.beginPath();g.moveTo(x,y);for(let t=1;t<=5;t++)g.lineTo(x+Math.sin(t*1.3+qrand(q,m+3)*5)*4,y+l*t/5);g.stroke();}if(++n%WY===0)yield;}},
  ice:function*(g,L){let n=0;g.fillStyle='rgba(215,240,255,.85)';for(const q of L){for(let m=0;m<5;m++){const x=q.x-q.r*.7+m*q.r*.35,y=q.y+q.r*.58+6,l=6+qrand(q,m)*14;g.beginPath();g.moveTo(x-3,y);g.lineTo(x+3,y);g.lineTo(x,y+l);g.closePath();g.fill();}if(++n%WY===0)yield;}},
  core:function*(g,L){let n=0;for(const q of L){radial(g,q.x,q.y+q.r*.7+8,26,'#ff5a3c',.35);if(++n%WY===0)yield;}}};
function* drawWalls(g,c){
  const i0=Math.round((c.x0-G0)/WC)-1,j0=Math.round((c.y0-G0)/WC)-1,cells=[];
  for(let j=j0;j<j0+10;j++)for(let i=i0;i<i0+10;i++)if(wallAt(i,j)){const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC,h=hash2(i,j,WD.seed);
    cells.push({i,j,x,y,r:WC*(.72+(h&255)/255*.1),h,b:biomeAt(x,y),n:!wallAt(i,j-1),in:wallAt(i-1,j)&&wallAt(i+1,j)&&wallAt(i,j-1)&&wallAt(i,j+1)});}
  if(!cells.length)return;
  const grp={};for(const q of cells)(grp[q.b]||(grp[q.b]=[])).push(q);
  const circ=(L,dx,dy,k)=>{g.beginPath();for(const q of L){g.moveTo(q.x+dx+q.r*k,q.y+dy);g.arc(q.x+dx,q.y+dy,q.r*k,0,TAU);}};
  let n=0;
  for(const b in grp){const L=grp[b];
    if(b==='sky'){ /* gouffres entre les îles : on voit le vide et les nuages en contrebas */
      circ(L,0,0,1.2);g.fillStyle='rgba(255,255,255,.22)';g.fill();yield;circ(L,0,0,1.03);g.strokeStyle='#dfe8ff';g.lineWidth=3;g.stroke();yield;circ(L,0,0,1);g.fillStyle='#080c2c';g.fill();yield;circ(L,0,10,.78);g.fillStyle='#03041a';g.fill();yield;
      for(const q of L){if((q.h>>9)%3)continue;g.fillStyle='rgba(200,215,255,.5)';g.beginPath();g.arc(q.x+((q.h>>12)%30)-15,q.y+((q.h>>17)%30)-10,1.2,0,TAU);g.fill();}
      yield;continue;}
    if(b==='cyber'){ /* blocs pare-feu */
      g.fillStyle='rgba(0,0,0,.45)';for(const q of L)g.fillRect(q.x-32+10,q.y-32+14,WC,WC);
      g.fillStyle='#07061a';for(const q of L)g.fillRect(q.x-32,q.y-32,WC,WC);yield;
      g.fillStyle='#16133c';for(const q of L)g.fillRect(q.x-32,q.y-32-8,WC,WC);yield;
      g.strokeStyle='rgba(45,226,255,.12)';g.lineWidth=1;g.beginPath();for(const q of L){for(let k=12;k<WC;k+=16){g.moveTo(q.x-32+k,q.y-40);g.lineTo(q.x-32+k,q.y+24);}if(++n%WY===0)yield;}g.stroke();yield;
      g.lineWidth=2.5;g.strokeStyle='#2de2ff';g.beginPath();
      for(const q of L){const X=q.x-32,Y=q.y-40;if(!wallAt(q.i,q.j-1)){g.moveTo(X,Y);g.lineTo(X+WC,Y);}if(!wallAt(q.i-1,q.j)){g.moveTo(X,Y);g.lineTo(X,Y+WC);}if(!wallAt(q.i+1,q.j)){g.moveTo(X+WC,Y);g.lineTo(X+WC,Y+WC);}if(++n%WY===0)yield;}g.stroke();yield;
      g.fillStyle='#ff2d95';for(const q of L){if(!wallAt(q.i,q.j+1)){g.fillRect(q.x-32,q.y+24,WC,5);if((q.h&7)===0){radial(g,q.x,q.y+26,18,'#ff2d95',.35);}}if(++n%WY===0)yield;}
      yield;continue;}
    const st=WSTY[b]||WSTY.plains,ac=WACC[b]||'#ffffff',B=BIO[b]||BIO.plains;
    /* 1) occlusion ambiante et ombre portée (lumière venant d'en haut à gauche) */
    circ(L,18,26,1.34);g.fillStyle='rgba(0,0,0,.14)';g.fill();yield;circ(L,14,22,1.12);g.fillStyle='rgba(0,0,0,.42)';g.fill();yield;
    /* 2) contour lisible */
    g.lineJoin='round';circ(L,0,12,1);g.strokeStyle='rgba(0,0,0,.85)';g.lineWidth=10;g.stroke();g.strokeStyle=ac;g.lineWidth=3;g.globalAlpha=.8;g.stroke();g.globalAlpha=1;yield;
    /* 3) paroi : strates superposées, de la base sombre vers le haut */
    for(let k=0;k<4;k++){const dy=12-k*4;circ(L,0,dy,1-k*.012);g.fillStyle=shade(st[1],-.35+k*.12);g.fill();yield;
      if(k<3){circ(L,0,dy-1.5,1-k*.012);g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=1.2;g.stroke();yield;circ(L,0,dy,1-k*.012);g.fillStyle=shade(st[1],-.35+k*.12);g.fill();yield;}}
    /* 4) liseré de lumière sur les arêtes exposées, puis plateau en dégradé */
    circ(L,-3,-9,.95);g.fillStyle=shade(st[2],.45);g.fill();yield;
    circ(L,0,-5,.95);g.fillStyle=shade(st[2],.04);g.fill();yield;
    g.save();circ(L,0,-5,.95);g.clip();for(const q of L){radial(g,q.x-q.r*.35,q.y-5-q.r*.4,q.r*1.1,'#ffffff',.07);radial(g,q.x+q.r*.4,q.y-5+q.r*.5,q.r*.9,'#000000',.08);if(++n%WY===0)yield;}g.restore();yield;
    const IN=L.filter(q=>q.in);if(IN.length){circ(IN,2,-2,.86);g.fillStyle='rgba(0,0,0,.18)';g.fill();yield;circ(IN,-2,-14,.8);g.fillStyle=shade(st[2],.5);g.fill();yield;circ(IN,0,-12,.8);g.fillStyle=shade(st[2],.08);g.fill();yield;}
    /* 5) matière du plateau (découpée à la forme) */
    g.save();circ(L,0,-5,.95);g.clip();
    for(const q of L){let h=q.h;for(let m=0;m<9;m++){h=Math.imul(h^(h>>>15),2246822519)>>>0;const a=(h&1023)/1023*TAU,d=((h>>>10)&1023)/1023*q.r*.9,x=q.x+Math.cos(a)*d,y=q.y-5+Math.sin(a)*d,r=1.5+((h>>>20)&7)*.6;
      g.fillStyle=(h>>>23)&1?'rgba(255,255,255,.07)':'rgba(0,0,0,.14)';g.beginPath();g.arc(x,y,r*2.2,0,TAU);g.fill();}if(++n%WY===0)yield;}
    if(CLIFF_TOP[b])yield*CLIFF_TOP[b](g,L,B);
    g.restore();yield;
    /* 6) franges sur les bords exposés au sud (herbe qui déborde, glaçons, algues…) */
    if(CLIFF_EDGE[b])yield*CLIFF_EDGE[b](g,L.filter(q=>!wallAt(q.i,q.j+1)),B);
    yield;
  }
}
/* copie la carte des biomes (couleur du sol) sur une zone du monde */
function mapInto(g,x,y,w,h){const k=256/(2*WR);let sx=(x+WR)*k,sy=(y+WR)*k,sw=w*k,sh=h*k,dx=x,dy=y,dw=w,dh=h;
  if(sx<0){const f=-sx/sw;dx+=dw*f;dw*=1-f;sw+=sx;sx=0;}if(sy<0){const f=-sy/sh;dy+=dh*f;dh*=1-f;sh+=sy;sy=0;}
  if(sx+sw>256){const f=(sx+sw-256)/sw;dw*=1-f;sw=256-sx;}if(sy+sh>256){const f=(sy+sh-256)/sh;dh*=1-f;sh=256-sy;}
  g.imageSmoothingEnabled=true;if(sw>0&&sh>0&&dw>0&&dh>0)g.drawImage(WD.map,sx,sy,sw,sh,dx,dy,dw,dh);}
/* ---------- cuisson des chunks : pool de canvas, pas de ré-allocation ---------- */
const BPOOL=[];
/* ---------- texture fine du sol, par biome ---------- */
const GTEX={
  plains:(g,x,y,r)=>{g.strokeStyle=r<.5?'rgba(150,230,160,.18)':'rgba(30,80,50,.25)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r-.5)*6,y-5-r*4);g.stroke();},
  floral:(g,x,y,r)=>{g.fillStyle=r<.3?'rgba(255,150,220,.35)':r<.5?'rgba(255,230,140,.3)':'rgba(70,20,60,.25)';g.beginPath();g.ellipse(x,y,2.2,1.2,r*6,0,TAU);g.fill();},
  sea:(g,x,y,r)=>{g.strokeStyle='rgba(160,230,255,.10)';g.lineWidth=1.2;g.beginPath();g.arc(x,y,10+r*14,Math.PI*1.1,Math.PI*1.9);g.stroke();},
  sky:(g,x,y,r)=>{g.fillStyle='rgba(255,255,255,.05)';g.beginPath();g.ellipse(x,y,18+r*20,6+r*5,0,0,TAU);g.fill();},
  cyber:(g,x,y,r)=>{g.fillStyle=r<.2?'rgba(255,45,149,.35)':'rgba(45,226,255,.18)';g.fillRect(x|0,y|0,2,2);},
  urban:(g,x,y,r)=>{g.fillStyle=r<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.18)';g.fillRect(x,y,1.5+r*2,1.5+r*2);if(r>.96){g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+14,y+6);g.lineTo(x+20,y+2);g.stroke();}},
  ice:(g,x,y,r)=>{if(r<.7){g.strokeStyle='rgba(230,248,255,.12)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+12+r*10,y+3);g.stroke();}else{g.fillStyle='rgba(255,255,255,.6)';g.fillRect(x,y,1.5,1.5);}},
  core:(g,x,y,r)=>{g.fillStyle=r<.15?'rgba(255,120,60,.45)':'rgba(0,0,0,.2)';g.beginPath();g.arc(x,y,r<.15?1.4:2+r*2,0,TAU);g.fill();}};
/* la texture de sol (220 items) est cuite par lots : voir groundTexStep, plus bas */
/* ---------- Archipel céleste : la mer de nuages ----------
   Moutonnements de cumulus, éclairés en haut à gauche, ombrés en bas à droite ; un bruit lent sépare des
   masses nuageuses et des trouées sombres. Posés sur une grille FIXE du monde (graine par cellule), et
   chaque chunk dessine aussi les bouffées voisines qui débordent sur lui : aucune couture. Chaîné à la
   texture de sol (même étape) ; hors du ciel, aucune opération. */
function* skyClouds(g,c){
  const x0=c.x0,y0=c.y0,hs=WD.hs+9,S=WD.seed^0x5c1d;let n=0,on=0;
  for(let y=y0-64;y<=y0+CH+64&&!on;y+=64)for(let x=x0-64;x<=x0+CH+64;x+=64)if(biomeAt(x,y)==='sky'){on=1;break;}
  if(!on)return;
  for(const [G,r0,r1] of [[88,24,44],[40,8,17]])for(let j=Math.floor((y0-60)/G);j<=Math.floor((y0+CH+60)/G);j++)for(let i=Math.floor((x0-60)/G);i<=Math.floor((x0+CH+60)/G);i++){
    const h=hash2(i,j,S+G),x=(i+(h&255)/255)*G,y=(j+((h>>>8)&255)/255)*G,d=vnoise(x*.0028,y*.0028,hs);if(d<(G>50?.4:.5))continue;
    const s=(r0+((h>>>16)&255)/255*(r1-r0))*(.7+.6*(d-.4)),e=s*1.45+6;if(x+e<x0||x-e>x0+CH||y+e<y0||y-e>y0+CH||biomeAt(x,y)!=='sky')continue;
    g.fillStyle='rgba(8,16,64,.2)';g.beginPath();g.arc(x+s*.32,y+s*.42,s*1.02,0,TAU);g.fill();
    g.fillStyle='rgba(206,220,255,.15)';g.beginPath();g.arc(x,y,s,0,TAU);g.fill();
    g.fillStyle='rgba(255,255,255,.13)';g.beginPath();g.arc(x-s*.28,y-s*.3,s*.58,0,TAU);g.fill();if(++n%10===0)yield;}}
/* ---------- pièces de décor remarquables (une par biome, disséminées) ---------- */
const SETP={
  plains:(g,x,y,R,rnd)=>{radial(g,x,y,R*1.3,'#9dffc8',.08);g.fillStyle='#0d3a3a';g.beginPath();g.ellipse(x,y,R,R*.72,0,0,TAU);g.fill();
    const wg=g.createRadialGradient(x-R*.3,y-R*.3,R*.1,x,y,R);wg.addColorStop(0,'#2f8f8f');wg.addColorStop(1,'#0a2c33');g.fillStyle=wg;g.beginPath();g.ellipse(x,y,R*.92,R*.64,0,0,TAU);g.fill();
    g.strokeStyle='rgba(200,255,240,.25)';g.lineWidth=1.2;for(let k=0;k<4;k++){g.beginPath();g.ellipse(x+rnd()*R*.6-R*.3,y+rnd()*R*.4-R*.2,10+k*8,3+k*2,0,0,TAU);g.stroke();}
    for(let k=0;k<7;k++){const a=rnd()*TAU,d=rnd()*R*.6,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d*.7,r=8+rnd()*8;g.fillStyle='#3f9a55';g.beginPath();g.moveTo(px,py);g.arc(px,py,r,.3,TAU-.1);g.closePath();g.fill();if(rnd()<.4){g.fillStyle='#ffd6f0';g.beginPath();g.arc(px+2,py-2,3,0,TAU);g.fill();}}
    g.strokeStyle='#4f8f4a';g.lineWidth=2;for(let k=0;k<22;k++){const a=rnd()*TAU,px=x+Math.cos(a)*R*.95,py=y+Math.sin(a)*R*.68;g.beginPath();g.moveTo(px,py);g.lineTo(px+rnd()*6-3,py-10-rnd()*10);g.stroke();}},
  /* la plus lourde (1 815 opérations) : générateur, pauses ajoutées sans rien déplacer (voir drawWalls) */
  floral:function*(g,x,y,R,rnd){radial(g,x,y,R*1.2,'#ff5ad8',.12);g.fillStyle='rgba(60,140,80,.35)';g.beginPath();g.arc(x,y,R*.45,0,TAU);g.fill();
    for(let k=0;k<7;k++){const a=k/7*TAU+rnd()*.3,px=x+Math.cos(a)*R*.72,py=y+Math.sin(a)*R*.72,s=18+rnd()*10,col=['#ff5ad8','#c78bff','#ff8fb0','#ffd06a'][k%4];
      for(let p=0;p<6;p++){const pa=p/6*TAU+a;g.fillStyle=shade(col,-.3);g.beginPath();g.ellipse(px+Math.cos(pa)*s*.6+2,py+Math.sin(pa)*s*.6+2,s*.55,s*.28,pa,0,TAU);g.fill();g.fillStyle=col;g.beginPath();g.ellipse(px+Math.cos(pa)*s*.6,py+Math.sin(pa)*s*.6,s*.55,s*.28,pa,0,TAU);g.fill();}
      radial(g,px,py,s*.5,'#fff6c8',.8);yield;}
    for(let k=0;k<30;k++){radial(g,x+rnd()*R*2-R,y+rnd()*R*2-R,4,'#fff3a0',.5);if(k%WY===WY-1)yield;}},
  sea:(g,x,y,R,rnd)=>{radial(g,x,y,R*1.2,'#5fe8ff',.1);g.fillStyle='rgba(230,210,160,.18)';g.beginPath();g.arc(x,y,R*.55,0,TAU);g.fill();
    const br=(x0,y0,a,l,d,col)=>{if(d<=0)return;const x1=x0+Math.cos(a)*l,y1=y0+Math.sin(a)*l;g.strokeStyle=col;g.lineWidth=d*1.4;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();br(x1,y1,a-.5+rnd()*.3,l*.72,d-1,col);br(x1,y1,a+.5-rnd()*.3,l*.72,d-1,col);};
    g.lineCap='round';for(let k=0;k<9;k++){const a=k/9*TAU,px=x+Math.cos(a)*R*.75,py=y+Math.sin(a)*R*.75;br(px,py,a+Math.PI+rnd()-.5,14+rnd()*8,4,['#ff7a9c','#ffb36b','#c78bff'][k%3]);}
    for(let k=0;k<6;k++){const px=x+rnd()*R-R/2,py=y+rnd()*R-R/2;g.fillStyle='#f3e2c0';g.beginPath();g.ellipse(px,py,4,3,rnd()*3,0,TAU);g.fill();}},
  sky:(g,x,y,R,rnd)=>{for(let k=0;k<14;k++){const a=rnd()*TAU,d=R*(.7+rnd()*.35);radial(g,x+Math.cos(a)*d,y+Math.sin(a)*d*.8,30+rnd()*30,'#ffffff',.35);}
    const wg=g.createRadialGradient(x,y,0,x,y,R*.75);wg.addColorStop(0,'#0a1450');wg.addColorStop(.7,'#2a4aa0');wg.addColorStop(1,'rgba(160,190,255,0)');g.fillStyle=wg;g.beginPath();g.ellipse(x,y,R*.8,R*.62,0,0,TAU);g.fill();
    g.fillStyle='rgba(255,255,255,.8)';for(let k=0;k<12;k++)g.fillRect(x+rnd()*R-R/2,y+rnd()*R*.7-R*.35,1.5,1.5);
    for(let k=0;k<4;k++){const px=x+rnd()*R*1.4-R*.7,py=y+rnd()*R*1.1-R*.55,s=6+rnd()*8;g.fillStyle='#6c6a8a';g.beginPath();g.ellipse(px,py+s*.4,s,s*.5,0,0,TAU);g.fill();g.fillStyle='#8fd18a';g.beginPath();g.ellipse(px,py,s,s*.45,0,0,TAU);g.fill();}},
  cyber:(g,x,y,R,rnd)=>{radial(g,x,y,R*1.3,'#2de2ff',.12);g.fillStyle='rgba(6,4,24,.7)';g.beginPath();g.arc(x,y,R,0,TAU);g.fill();
    g.strokeStyle='rgba(45,226,255,.7)';g.lineWidth=2;for(let k=1;k<=4;k++){g.globalAlpha=.25+k*.12;g.beginPath();g.arc(x,y,R*k/4,0,TAU);g.stroke();}
    g.globalAlpha=.35;g.beginPath();for(let k=0;k<16;k++){const a=k/16*TAU;g.moveTo(x+Math.cos(a)*R*.25,y+Math.sin(a)*R*.25);g.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R);}g.stroke();
    g.globalAlpha=1;g.fillStyle='#ff2d95';for(let k=0;k<8;k++){const a=k/8*TAU+.2;g.fillRect(x+Math.cos(a)*R*.62-3,y+Math.sin(a)*R*.62-3,6,6);}radial(g,x,y,R*.3,'#2de2ff',.5);},
  urban:(g,x,y,R,rnd)=>{g.fillStyle='rgba(120,110,140,.35)';g.fillRect(x-R,y-R,R*2,R*2);g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=1;g.beginPath();for(let k=-R;k<=R;k+=18){g.moveTo(x+k,y-R);g.lineTo(x+k,y+R);g.moveTo(x-R,y+k);g.lineTo(x+R,y+k);}g.stroke();
    g.fillStyle='#3a3450';g.beginPath();g.arc(x,y,R*.55,0,TAU);g.fill();const wg=g.createRadialGradient(x,y,0,x,y,R*.48);wg.addColorStop(0,'#5fd8ff');wg.addColorStop(1,'#1a4a7a');g.fillStyle=wg;g.beginPath();g.arc(x,y,R*.48,0,TAU);g.fill();
    g.strokeStyle='rgba(220,250,255,.4)';for(let k=1;k<4;k++){g.beginPath();g.arc(x,y,R*.12*k,0,TAU);g.stroke();}radial(g,x,y,R*.2,'#ffffff',.6);
    g.fillStyle='#2a2238';for(const [dx,dy] of [[-.8,0],[.8,0],[0,-.8],[0,.8]])g.fillRect(x+dx*R-10,y+dy*R-4,20,8);radial(g,x-R*.8,y-R*.8,40,'#ffc93c',.25);radial(g,x+R*.8,y+R*.8,40,'#ff2d95',.2);},
  ice:(g,x,y,R,rnd)=>{radial(g,x,y,R*1.2,'#bfefff',.18);for(let k=0;k<11;k++){const a=rnd()*TAU,d=rnd()*R*.7,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d,s=10+rnd()*22,t=rnd()*.6-.3;
    g.save();g.translate(px,py);g.rotate(t);g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(6,s*.3+4,s*.5,s*.18,0,0,TAU);g.fill();
    g.fillStyle='#e8f8ff';g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(s*.42,-s*.2);g.lineTo(0,s*.35);g.lineTo(-s*.42,-s*.2);g.closePath();g.fill();
    g.fillStyle='#8fcff0';g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(s*.42,-s*.2);g.lineTo(0,s*.35);g.closePath();g.fill();g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=1;g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(0,s*.35);g.stroke();g.restore();}},
  core:(g,x,y,R,rnd)=>{radial(g,x,y,R*1.1,'#000000',.35);radial(g,x,y,R*.6,'#ff5a3c',.25);g.lineCap='round';
    for(let k=0;k<7;k++){let px=x,py=y,a=k/7*TAU+rnd()*.4;const pts=[[px,py]];for(let m=0;m<6;m++){a+=rnd()*.8-.4;px+=Math.cos(a)*R*.17;py+=Math.sin(a)*R*.17;pts.push([px,py]);}
      for(const [w,col] of [[9,'rgba(255,60,40,.25)'],[4,'#ff7a2d'],[1.5,'#ffe08a']]){g.strokeStyle=col;g.lineWidth=w;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}}
    radial(g,x,y,R*.25,'#ffd06a',.7);}};
function* setPieces(g,c){const rnd=mkRng(hash2(c.cx,c.cy,WD.seed^0x77e1));c.sp=null;if(rnd()>.3)return;
  const R=110+rnd()*80,x=c.x0+R+rnd()*(CH-2*R),y=c.y0+R+rnd()*(CH-2*R);if(x*x+y*y>(WR-300)**2)return;
  if(wallNear(x,y,R+20)||trailDist(x,y)<R+60)return;for(const L of WD.lms)if(dist2(L.x,L.y,x,y)<(L.R+R+60)**2)return;
  const f=SETP[biomeAt(x,y)];if(!f)return;g.save();const it=f(g,x,y,R,rnd);if(it)yield*it;g.restore();g.globalAlpha=1;c.sp={x,y,R};}
/* Cuisson par lots. Le budget de temps est verifie ENTRE les appels a bakeStep : une unite de
   travail indivisible qui le depasse fait deborder l'image de tout son cout. On decoupe donc les
   grosses boucles en lots, avec un curseur (k.i) et le generateur (k.rnd) conserves d'une image a
   l'autre. La suite de tirages et l'ordre des traces restent EXACTEMENT ceux d'origine : un chunk
   fini est identique au pixel pres, seule sa repartition dans le temps change. */
function groundTexStep(g,c,k,n){const rnd=k.rnd[1];let m=0;
  while(k.i<220&&m<n){const x=c.x0+rnd()*CH,y=c.y0+rnd()*CH,r=rnd();m++;k.i++;if(x*x+y*y>WR*WR)continue;const f=GTEX[biomeAt(x,y)];if(f)f(g,x,y,r);}
  return k.i>=220;}
function decoStep(g,c,k,n){const rnd=k.rnd[7];let m=0;
  while(k.i<72&&m<n){const i=k.i++,x=c.x0+rnd()*CH,y=c.y0+rnd()*CH;m++;
    if(x*x+y*y>WR*WR)continue;if(wallAt(Math.floor((x-G0)/WC),Math.floor((y-G0)/WC)))continue;if(c.sp&&dist2(x,y,c.sp.x,c.sp.y)<c.sp.R*c.sp.R)continue;
    const ja=rnd()*TAU,jr=rnd()*120;DECO[biomeAt(x+Math.cos(ja)*jr,y+Math.sin(ja)*jr)](g,x,y,rnd,i);}
  return k.i>=72;}
/* meme generateur que decoStep (k.rnd[7]) : dans l'original, lisiere recevait le generateur de la
   boucle de decor et poursuivait le meme flux de tirages. */
function lisiereStep(g,c,k,n){const rnd=k.rnd[7];let m=0;
  while(k.i<42&&m<n){const x=c.x0+rnd()*CH,y=c.y0+rnd()*CH;m++;k.i++;
    if(x*x+y*y>WR*WR)continue;
    const b1=biomeAt(x-80,y),b2=biomeAt(x+80,y),b3=biomeAt(x,y-80),b4=biomeAt(x,y+80);if(b1===b2&&b3===b4&&b1===b3)continue;
    const A=BIO[b1!==b2?b1:b3],B2=BIO[b1!==b2?b2:b4];
    for(const [col,ox] of [[A.a,-10],[B2.a,10]]){const px=x+ox+rnd()*16,py=y+rnd()*16-8,r=18+rnd()*16;
      g.globalAlpha=.07;g.fillStyle=col;g.beginPath();g.arc(px,py,r,0,TAU);g.fill();g.globalAlpha=.16;g.beginPath();g.arc(px,py,r*.4,0,TAU);g.fill();
      g.globalAlpha=.85;g.fillStyle='#ffffff';g.beginPath();g.arc(px,py,1.6,0,TAU);g.fill();}
    if(rnd()<.35){g.globalAlpha=.5;g.strokeStyle=B2.a;g.lineWidth=1.5;g.beginPath();const a=rnd()*TAU,s=8+rnd()*8;g.moveTo(x,y-s);g.lineTo(x+s*.5,y);g.lineTo(x,y+s);g.lineTo(x-s*.5,y);g.closePath();g.stroke();}}
  return k.i>=42;}
/* Murs : c'etait le plus gros bloc indivisible de la cuisson (un groupe de biome allait jusqu'a
   18 293 operations d'un seul tenant, test/cuisson.js). drawWalls est un generateur : une unite =
   le travail jusqu'au prochain `yield` ; le generateur reste dans k.wk d'une image a l'autre. */
function wallsStep(g,c,k){
  if(!k.wk)k.wk=drawWalls(g,c);
  return k.wk.next().done?undefined:false;}
/* une entree par unite de travail, dans l'ORDRE EXACT d'origine. `false` = unite inachevee,
   `true` = chunk termine, autre = unite faite (on rend la main, on reprendra a la suivante). */
const BAKE_STEPS=[
  (g,c,k)=>drawRelief(g,c),
  (g,c,k)=>{if(!k.sk){if(!k.rnd[1])k.rnd[1]=mkRng(hash2(c.cx,c.cy,WD.seed^0x3c5));if(!groundTexStep(g,c,k,22))return false;g.globalAlpha=1;k.sk=skyClouds(g,c);}if(!k.sk.next().done)return false;},
  (g,c,k)=>drawGrid(g,c),
  (g,c,k)=>{if(!k.rd){drawRoads(g,c);k.rd=drawCity(g,c);return false;}if(!k.rd.next().done)return false;},
  (g,c,k)=>drawPaths(g,c),
  (g,c,k)=>{for(const L of WD.lms)if(Math.abs(L.x-c.x0-CH/2)<CH/2+L.R+60&&Math.abs(L.y-c.y0-CH/2)<CH/2+L.R+60)LMG[L.t](g,L);},
  (g,c,k)=>{if(!k.pg)k.pg=setPieces(g,c);if(!k.pg.next().done)return false;},
  (g,c,k)=>{if(!k.rnd[7])k.rnd[7]=mkRng(hash2(c.cx,c.cy,WD.seed^0x5bd1e995));if(!decoStep(g,c,k,6))return false;},
  (g,c,k)=>{if(!lisiereStep(g,c,k,6))return false;g.globalAlpha=1;},
  (g,c,k)=>{if(wallsStep(g,c,k)===false)return false;},
  (g,c,k)=>{c.bake=k.cv;c.bk=null;c.used=FRAME;WD.bakes.push(c);return true;}];
function bakeStep(c){
  let k=c.bk;
  if(!k){const cv2=BPOOL.pop()||mkCanvas(CH,CH),g=cv2.getContext('2d',{alpha:false});g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    g.fillStyle='#05030c';g.fillRect(0,0,CH,CH);g.translate(-c.x0,-c.y0);mapInto(g,c.x0,c.y0,CH,CH);k=c.bk={cv:cv2,g,s:0,i:0,rnd:{}};}
  const g=k.g;BK0=c.x0;BK1=c.y0;
  const res=BAKE_STEPS[k.s](g,c,k);
  if(res===false)return false;
  if(res===true)return true;
  k.s++;k.i=0;return false;
}
/* plus appelée par le jeu (PERF-2 : jamais un chunk d'un bloc) ; gardée pour les instruments qui
   l'enveloppent (bulge-verif/frames.js, blocages.js) — test/unused.js la signale, c'est voulu */
function bakeChunk(c){while(!bakeStep(c));}
/* lisières (42 lucioles) cuites par lots : voir lisiereStep, plus haut */
/* éviction LRU : jamais un chunk utilisé à cette frame (plus de boucle cuisson/éviction) */
function evictBakes(max){
  while(WD.bakes.length>max){let mi=-1;for(let i=0;i<WD.bakes.length;i++){const b=WD.bakes[i];if(b.used>=FRAME)continue;if(mi<0||b.used<WD.bakes[mi].used)mi=i;}
    if(mi<0)break;const ev=WD.bakes[mi];BPOOL.length<8&&BPOOL.push(ev.bake);ev.bake=null;WD.bakes.splice(mi,1);}
}
/* cache des sprites d'obstacles, indépendant des cuissons */
const OSPR=[];
function evictSprites(max){if(OSPR.length<=max)return;OSPR.sort((a,b)=>a.su-b.su);const n=OSPR.length-max;for(let i=0;i<n;i++)OSPR[i].spr=null;OSPR.splice(0,n);}
/* pré-cuisson autour d'un point (au lancement, sous le fondu d'entrée). Elle cuisait 36 chunks d'un
   bloc (144 787 opérations, mesure du 27/09/2026) : désormais elle ne fait que les mettre en file,
   du centre vers l'extérieur ; streamWorld la vide avec son budget, image après image. */
function prewarm(x,y,rad){const q=[];for(let cx=Math.floor((x-rad)/CH);cx<=Math.floor((x+rad)/CH);cx++)for(let cy=Math.floor((y-rad)/CH);cy<=Math.floor((y+rad)/CH);cy++){const c=getChunk(cx,cy);if(c)q.push(c);}
  q.sort((a,b)=>dist2(a.x0+CH/2,a.y0+CH/2,x,y)-dist2(b.x0+CH/2,b.y0+CH/2,x,y));WD.pq=q;}
/* Budget de cuisson adaptatif. frame() (g4.js) mesure le travail JS réel de chaque image et en retire
   la cuisson : FWK = coût hors cuisson de l'image précédente (ms), FDT = son intervalle rAF. La cuisson
   prend le temps libre jusqu'à 60 % de la période P (la part JS du modèle RAIL : 10 ms sur 16,7), jamais
   moins de BMIN ; une image manquée (FDT > 1,5 P : raster, GPU, que le temps JS ne voit pas) le divise
   par deux. Sans mesure (harnais qui appelle render seul), les valeurs fixes d'avant. */
let FWK=-1,FDT=0,BKMS=0;const BMIN=1.5,BURG=4;
/* Hors jeu (menu, pause, evolution, duel, fin), le monde ne change plus : cuire serait du travail
   pur perdu. Mesure (x10, pause) : `streamWorld` passait de 6,6 a 15,9 ms par appel et `render`
   de 28 a 41 ms, parce que le budget de cuisson vaut « periode d'ecran moins le JS de l'image
   precedente » — et dans un menu ce JS est nul, donc la cuisson recevait tout le temps libre.
   Resultat : une image lourde sur quatre (le fond n'est rendu qu'une fois sur quatre), donc des
   saccades de menu. Le rattrapage se fera a la reprise, ou il coute le meme prix qu'en jeu. */
function bakeBudget(){const jouable=!!G&&(G.state==='play'||G.state==='dying'||G.state==='victory');if(!jouable)return 0;if(FWK<0)return 3;const P=REFDT||16.7,J=P*.6;let b=clamp(J-FWK,BMIN,J);if(FDT>P*1.5)b=Math.max(BMIN,b/2);return b;}
/* streaming : cuit en avance dans la direction du mouvement, avec un budget de temps par frame */
const STRM={x:0,y:0,vx:0,vy:0};
function streamWorld(budget){
  const t0=performance.now();
  STRM.vx=lerp(STRM.vx,CAM.x-STRM.x,.08);STRM.vy=lerp(STRM.vy,CAM.y-STRM.y,.08);STRM.x=CAM.x;STRM.y=CAM.y;
  const PV=G&&G.p?[G.p.vx,G.p.vy]:[STRM.vx,STRM.vy],lx=clamp(Math.max(Math.abs(STRM.vx),Math.abs(PV[0]))*Math.sign(PV[0]||STRM.vx)*130/CH,-4,4),ly=clamp(Math.max(Math.abs(STRM.vy),Math.abs(PV[1]))*Math.sign(PV[1]||STRM.vy)*130/CH,-4,4);
  const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  const a0=c0-2+Math.min(0,Math.floor(lx)),a1=c1+2+Math.max(0,Math.ceil(lx)),b0=r0-2+Math.min(0,Math.floor(ly)),b1=r1+2+Math.max(0,Math.ceil(ly));
  const fx=CAM.x+PV[0]*50,fy=CAM.y+PV[1]*50,need=[];let n=0;
  for(let cx=a0;cx<=a1;cx++)for(let cy=b0;cy<=b1;cy++){const c=getChunk(cx,cy);if(!c)continue;n++;
    const iv=cx>=c0&&cx<=c1&&cy>=r0&&cy<=r1;
    if(c.bake)c.used=FRAME;else need.push([(c.x0+CH/2-fx)**2+(c.y0+CH/2-fy)**2+(iv?0:1e8),c]);
    for(const o of c.obs){if(o.wall)continue;if(o.spr){o.su=FRAME;continue;}if(performance.now()-t0<budget){obsSprite(o);o.su=FRAME;OSPR.push(o);}}}
  need.sort((a,b)=>a[0]-b[0]);
  /* Plus jamais un chunk entier d'un bloc : les chunks visibles passent en tête et reçoivent au moins
     BURG ms de cuisson par image, comptés depuis ici (les sprites d'obstacles, plus haut, peuvent avoir
     mangé le budget) ; un chunk en cours s'affiche tel quel (drawChunks) — le sol de secours (mapInto)
     plus les couches déjà posées, dans l'ordre d'origine. Puis la file de prewarm, avec le reste. */
  const tb=performance.now(),ok=u=>performance.now()-t0<budget||u&&performance.now()-tb<BURG;
  for(let i=0;i<need.length;i++){const c=need[i][1],u=need[i][0]<1e8;
    while(ok(u)){if(bakeStep(c))break;}
    if(!ok(u))break;}
  const Q=WD.pq;
  while(Q&&Q.length&&performance.now()-t0<budget){const c=Q[0];if(!c.bake){bakeStep(c);continue;}let k=0;
    for(const o of c.obs){if(o.wall||o.spr)continue;if(performance.now()-t0>=budget){k=1;break;}obsSprite(o);o.su=1e9;OSPR.push(o);}
    if(!k)Q.shift();}
  evictBakes(Math.max(60,n+8));evictSprites(Math.max(360,OSPR.length>600?360:600));BKMS=performance.now()-t0;
}

/* ---------- obstacles : sprites illustrés avec ombre portée ---------- */
const OBS_DRAW={
  plains(g,o,w,h,r){const R=o.r,c=R,pts=[];for(let i=0;i<9;i++){const a=i/9*TAU+r()*.3,q=R*(.84+r()*.18);pts.push([c+Math.cos(a)*q,c+Math.sin(a)*q]);}
    shadowPoly(g,pts,14,20,9);poly(g,pts);g.fillStyle='#21403a';g.fill();
    g.save();poly(g,pts);g.clip();const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'rgba(170,255,210,.38)');gr.addColorStop(.55,'rgba(80,140,110,.06)');gr.addColorStop(1,'rgba(0,0,0,.4)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1.6;g.beginPath();for(let k=0;k<3;k++){const a=r()*TAU;g.moveTo(c,c);g.lineTo(c+Math.cos(a)*R*.85,c+Math.sin(a)*R*.85);}g.stroke();
    g.fillStyle='rgba(157,255,122,.6)';for(let k=0;k<8;k++){g.beginPath();g.arc(c+(r()-.65)*R,c+(r()-.65)*R,1.5+r()*3,0,TAU);g.fill();}
    g.restore();poly(g,pts);g.strokeStyle='rgba(109,255,181,.5)';g.lineWidth=2;g.stroke();},
  floral(g,o,w,h,r){const R=o.r,c=R,n=7+Math.floor(r()*3),rot=r()*TAU;shadowCircle(g,c+12,c+18,R*.95,10);
    for(let k=0;k<n;k++){const a=rot+k/n*TAU;g.save();g.translate(c,c);g.rotate(a);const gr=g.createLinearGradient(0,0,R,0);gr.addColorStop(0,'#5a1a55');gr.addColorStop(.6,'#ff5ad8');gr.addColorStop(1,'#ffc4f0');g.fillStyle=gr;g.beginPath();g.ellipse(R*.55,0,R*.5,R*.25,0,0,TAU);g.fill();g.strokeStyle='rgba(255,220,250,.5)';g.lineWidth=1.2;g.stroke();g.restore();}
    g.fillStyle='#1e0a1f';g.beginPath();g.arc(c,c,R*.42,0,TAU);g.fill();radial(g,c,c,R*.42,'#ffd166',.85);
    g.fillStyle='#fff2c4';for(let k=0;k<9;k++){const a=k/9*TAU;g.beginPath();g.arc(c+Math.cos(a)*R*.22,c+Math.sin(a)*R*.22,2.2,0,TAU);g.fill();}},
  sea(g,o,w,h,r){const R=o.r,c=R;shadowCircle(g,c+8,c+12,R*.9,12,.45);
    g.fillStyle='#0d3350';g.beginPath();g.arc(c,c,R*.66,0,TAU);g.fill();
    const col=['#ff7a9a','#ffb36b','#ff5ad8'][Math.floor(r()*3)];g.strokeStyle=col;g.lineCap='round';
    const br=(x,y,a,l,d)=>{const x2=x+Math.cos(a)*l,y2=y+Math.sin(a)*l;g.lineWidth=Math.max(1.5,d*2.3);g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();
      if(d>1){br(x2,y2,a-.45-r()*.3,l*.7,d-1);br(x2,y2,a+.45+r()*.3,l*.7,d-1);}else{g.fillStyle='#6dffd9';g.beginPath();g.arc(x2,y2,2.6,0,TAU);g.fill();}};
    const n=5+Math.floor(r()*3);for(let k=0;k<n;k++)br(c,c,k/n*TAU+r()*.4,R*.42,3);
    radial(g,c-R*.2,c-R*.2,R*.7,'#6dffd9',.2);},
  sky(g,o,w,h,r){const R=o.r,c=R;shadowCircle(g,c+70,c+95,R*.9,22,.32);
    g.fillStyle='#2a2455';g.beginPath();g.ellipse(c+4,c+R*.2,R*.97,R*.9,0,0,TAU);g.fill();
    g.fillStyle='#1b1640';g.beginPath();g.ellipse(c+6,c+R*.34,R*.7,R*.6,0,0,TAU);g.fill();
    const gr=g.createRadialGradient(c-R*.3,c-R*.35,R*.1,c,c,R);gr.addColorStop(0,'#86f5b8');gr.addColorStop(.7,'#2f8f6a');gr.addColorStop(1,'#1d5a48');g.fillStyle=gr;g.beginPath();g.arc(c,c,R*.93,0,TAU);g.fill();
    const nt=5+Math.floor(r()*6);for(let k=0;k<nt;k++){const a=r()*TAU,d=r()*R*.6,x=c+Math.cos(a)*d,y=c+Math.sin(a)*d,s=6+r()*10;
      g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(x+3,y+4,s,0,TAU);g.fill();g.fillStyle='#1f6b4a';g.beginPath();g.arc(x,y,s,0,TAU);g.fill();g.fillStyle='#4fd08f';g.beginPath();g.arc(x-s*.3,y-s*.3,s*.55,0,TAU);g.fill();}
    g.fillStyle='rgba(215,230,255,.95)';for(let k=0;k<3;k++){const a=r()*TAU,d=R*(.2+r()*.6),x=c+Math.cos(a)*d,y=c+Math.sin(a)*d;g.beginPath();g.moveTo(x,y-7);g.lineTo(x+4,y);g.lineTo(x,y+7);g.lineTo(x-4,y);g.closePath();g.fill();}
    g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=2;g.beginPath();g.arc(c,c,R*.93,0,TAU);g.stroke();},
  cyber(g,o,w,h,r){shadowRect(g,10,14,w,h,10);
    g.fillStyle='#0b0a1e';g.fillRect(0,0,w,h);
    const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'rgba(45,226,255,.2)');gr.addColorStop(1,'rgba(255,45,149,.1)');g.fillStyle=gr;g.fillRect(4,4,w-8,h-8);
    g.strokeStyle='rgba(45,226,255,.13)';g.lineWidth=1;g.beginPath();for(let x=12;x<w;x+=12){g.moveTo(x,4);g.lineTo(x,h-4);}for(let y=12;y<h;y+=12){g.moveTo(4,y);g.lineTo(w-4,y);}g.stroke();
    g.strokeStyle='rgba(45,226,255,.25)';g.lineWidth=9;g.strokeRect(0,0,w,h);g.strokeStyle='#2de2ff';g.lineWidth=2.5;g.strokeRect(1.5,1.5,w-3,h-3);
    g.fillStyle='#ff2d95';const s=7;g.fillRect(0,0,s,s);g.fillRect(w-s,0,s,s);g.fillRect(0,h-s,s,s);g.fillRect(w-s,h-s,s,s);
    radial(g,w/2,h/2,Math.min(w,h)*.35,'#2de2ff',.35);g.fillStyle='#fff';g.fillRect(w/2-3,h/2-3,6,6);},
  /* le TOIT seulement : les façades et la hauteur sont dessinées par image (drawTowers, g3.js) */
  urban(g,o,w,h,r){const T=twH(o);
    g.fillStyle='#3a3852';g.fillRect(0,0,w,h);g.fillStyle='#1c1b2b';g.fillRect(4,4,w-8,h-8);
    const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'rgba(190,200,255,.1)');gr.addColorStop(1,'rgba(0,0,0,.3)');g.fillStyle=gr;g.fillRect(4,4,w-8,h-8);
    g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=3;g.strokeRect(5.5,5.5,w-11,h-11);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(0,0,w,1.5);g.fillRect(0,0,1.5,h);
    if(T>1.15){const ax=w/2,ay=h/2;g.strokeStyle='#5a5878';g.lineWidth=2;g.beginPath();g.arc(ax,ay,9,0,TAU);g.moveTo(ax-14,ay);g.lineTo(ax+14,ay);g.moveTo(ax,ay-14);g.lineTo(ax,ay+14);g.stroke();}
    const nu=3+Math.floor(r()*5);for(let k=0;k<nu;k++){const uw=10+r()*24,uh=10+r()*18,ux=10+r()*Math.max(1,w-uw-20),uy=10+r()*Math.max(1,h-uh-20);
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(ux+3,uy+4,uw,uh);g.fillStyle='#2b2a3d';g.fillRect(ux,uy,uw,uh);g.strokeStyle='#44425e';g.lineWidth=1;g.strokeRect(ux+.5,uy+.5,uw-1,uh-1);}
    if(r()<.35&&w>80&&h>80){const cx=w*.5,cy=h*.5,rr2=Math.min(w,h)*.22;g.strokeStyle='rgba(255,201,60,.7)';g.lineWidth=2.5;g.beginPath();g.arc(cx,cy,rr2,0,TAU);g.stroke();g.fillStyle='rgba(255,201,60,.8)';g.fillRect(cx-rr2*.4,cy-rr2*.45,rr2*.18,rr2*.9);g.fillRect(cx+rr2*.22,cy-rr2*.45,rr2*.18,rr2*.9);g.fillRect(cx-rr2*.4,cy-rr2*.08,rr2*.8,rr2*.16);}
    const nc=[COL.mg,COL.cy,COL.gd][Math.floor(r()*3)],side=Math.floor(r()*4);
    const edge=()=>{g.beginPath();if(side===0){g.moveTo(8,7);g.lineTo(w-8,7);}else if(side===1){g.moveTo(w-7,8);g.lineTo(w-7,h-8);}else if(side===2){g.moveTo(8,h-7);g.lineTo(w-8,h-7);}else{g.moveTo(7,8);g.lineTo(7,h-8);}g.stroke();};
    g.strokeStyle=rgba(nc,.28);g.lineWidth=11;edge();g.strokeStyle=nc;g.lineWidth=3;edge();
    g.fillStyle='rgba(255,220,140,.55)';for(let x=10;x<w-8;x+=9){if(r()<.3)g.fillRect(x,0,4,2);if(r()<.3)g.fillRect(x,h-2,4,2);}},
  ice(g,o,w,h,r){const R=o.r,c=R,rot=r()*TAU,pts=[];for(let i=0;i<6;i++){const a=rot+i/6*TAU,q=R*(.85+r()*.15);pts.push([c+Math.cos(a)*q,c+Math.sin(a)*q]);}
    shadowPoly(g,pts,10,16,10,.45);poly(g,pts);
    const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'rgba(225,250,255,.96)');gr.addColorStop(.5,'rgba(120,200,235,.78)');gr.addColorStop(1,'rgba(40,110,160,.88)');g.fillStyle=gr;g.fill();
    g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=1.2;g.beginPath();for(const p of pts){g.moveTo(c,c);g.lineTo(p[0],p[1]);}g.stroke();
    poly(g,pts);g.strokeStyle='#fff';g.lineWidth=2;g.stroke();},
  core(g,o,w,h,r){const R=o.r,c=R;shadowCircle(g,c+10,c+14,R*.95,12);
    const gr=g.createRadialGradient(c-R*.3,c-R*.3,R*.1,c,c,R);gr.addColorStop(0,'#7a1a28');gr.addColorStop(.7,'#3a0a12');gr.addColorStop(1,'#1a0406');g.fillStyle=gr;g.beginPath();g.arc(c,c,R,0,TAU);g.fill();
    g.strokeStyle='rgba(255,51,85,.6)';g.lineWidth=2;for(let k=0;k<6;k++){const a=r()*TAU;g.beginPath();g.moveTo(c,c);g.quadraticCurveTo(c+Math.cos(a+.5)*R*.5,c+Math.sin(a+.5)*R*.5,c+Math.cos(a)*R*.95,c+Math.sin(a)*R*.95);g.stroke();}
    for(let k=0;k<4;k++){const a=r()*TAU,d=r()*R*.6;radial(g,c+Math.cos(a)*d,c+Math.sin(a)*d,R*.22,'#ff8a2d',.5);}},
};
OBS_DRAW.lm=function(g,o,w,h,r){
  const t=o.lt,ring=o.role==='ring';
  if(t==='plains'){const R=o.r,c=R;if(ring){shadowCircle(g,c+16,c+26,R*.9,10,.55);g.fillStyle='#3d4a44';g.beginPath();g.ellipse(c,c+6,R*.82,R*.95,0,0,TAU);g.fill();
      const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#b7c4b8');gr.addColorStop(1,'#56655c');g.fillStyle=gr;g.beginPath();g.ellipse(c,c-4,R*.78,R*.9,0,0,TAU);g.fill();
      g.strokeStyle='rgba(109,255,181,.75)';g.lineWidth=2;g.beginPath();g.moveTo(c-R*.3,c-R*.3);g.lineTo(c,c+R*.2);g.lineTo(c+R*.3,c-R*.3);g.stroke();g.fillStyle='rgba(90,160,80,.7)';g.beginPath();g.arc(c+R*.3,c+R*.2,R*.3,0,TAU);g.fill();}
    else{shadowCircle(g,c+10,c+16,R,10);g.fillStyle='#4b5550';g.beginPath();g.arc(c,c+5,R,0,TAU);g.fill();g.fillStyle='#8a978d';g.beginPath();g.arc(c,c-2,R*.95,0,TAU);g.fill();radial(g,c,c-2,R*.9,'#6dffb5',.8);
      g.strokeStyle='#e8fff2';g.lineWidth=2;g.beginPath();g.arc(c,c-2,R*.45,0,TAU);g.stroke();}return;}
  if(t==='floral'){if(ring){const R=o.r,c=R;shadowCircle(g,c+8,c+12,R,6);g.fillStyle='#1d3b24';g.beginPath();g.arc(c,c,R*.7,0,TAU);g.fill();g.fillStyle='#ff5ad8';
      for(let k=0;k<7;k++){const a=k/7*TAU;g.beginPath();g.moveTo(c+Math.cos(a-.25)*R*.6,c+Math.sin(a-.25)*R*.6);g.lineTo(c+Math.cos(a)*R,c+Math.sin(a)*R);g.lineTo(c+Math.cos(a+.25)*R*.6,c+Math.sin(a+.25)*R*.6);g.fill();}return;}
    OBS_DRAW.floral(g,o,w,h,r);const c=o.r;g.fillStyle='#fff';for(let k=0;k<14;k++){const a=k/14*TAU;g.beginPath();g.moveTo(c+Math.cos(a)*o.r*.42,c+Math.sin(a)*o.r*.42);g.lineTo(c+Math.cos(a+.1)*o.r*.3,c+Math.sin(a+.1)*o.r*.3);g.lineTo(c+Math.cos(a-.1)*o.r*.3,c+Math.sin(a-.1)*o.r*.3);g.fill();}return;}
  if(t==='sea'){if(ring){OBS_DRAW.sea(g,o,w,h,r);return;}const R=o.r,c=R;shadowCircle(g,c+8,c+12,R,10);
    const gr=g.createRadialGradient(c-R*.3,c-R*.3,2,c,c,R);gr.addColorStop(0,'#ffe6d0');gr.addColorStop(1,'#c77a5a');g.fillStyle=gr;g.beginPath();g.arc(c,c,R,0,TAU);g.fill();
    g.strokeStyle='#7a3f2c';g.lineWidth=2.5;g.beginPath();for(let k=0;k<=80;k++){const a=k/80*TAU*2.6,d=R*(.08+k/80*.85);const x=c+Math.cos(a)*d,y=c+Math.sin(a)*d;k?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();radial(g,c,c,R*.5,'#6dffd9',.3);return;}
  if(t==='sky'){const R=o.r,c=R;shadowCircle(g,c+40,c+60,R,14,.4);g.fillStyle='#9aa3c8';g.beginPath();g.arc(c,c+6,R,0,TAU);g.fill();
    const gr=g.createRadialGradient(c-R*.4,c-R*.4,1,c,c,R);gr.addColorStop(0,'#ffffff');gr.addColorStop(1,'#c9d2f0');g.fillStyle=gr;g.beginPath();g.arc(c,c,R*.96,0,TAU);g.fill();
    g.strokeStyle='rgba(120,130,170,.5)';g.lineWidth=1.2;g.beginPath();for(let k=0;k<10;k++){const a=k/10*TAU;g.moveTo(c+Math.cos(a)*R*.35,c+Math.sin(a)*R*.35);g.lineTo(c+Math.cos(a)*R*.9,c+Math.sin(a)*R*.9);}g.stroke();
    if(!ring){g.strokeStyle='#ffc93c';g.lineWidth=3;g.beginPath();g.arc(c,c,R*.6,0,TAU);g.stroke();radial(g,c,c,R*.5,'#ffc93c',.6);}return;}
  if(t==='cyber'){OBS_DRAW.cyber(g,o,w,h,r);if(!ring){radial(g,w/2,h/2,w*.6,'#ff2d95',.5);}return;}
  /* sommet du phare (le fût est dessiné par image, drawTowers) : lanterne vitrée */
  if(t==='urban'){const R=o.r,c=R;g.fillStyle='#46445e';g.beginPath();g.arc(c,c,R,0,TAU);g.fill();g.fillStyle='#1c1b2b';g.beginPath();g.arc(c,c,R*.86,0,TAU);g.fill();
    radial(g,c,c,R*.75,'#fff3c4',.6);g.strokeStyle='#ffc93c';g.lineWidth=3;g.beginPath();g.arc(c,c,R*.52,0,TAU);g.stroke();
    g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.beginPath();for(let k=0;k<8;k++){const a=k/8*TAU;g.moveTo(c+Math.cos(a)*R*.52,c+Math.sin(a)*R*.52);g.lineTo(c+Math.cos(a)*R*.84,c+Math.sin(a)*R*.84);}g.stroke();
    g.fillStyle='#fff8e0';g.beginPath();g.arc(c,c,R*.2,0,TAU);g.fill();return;}
  if(t==='ice'){OBS_DRAW.ice(g,o,w,h,r);if(!ring)radial(g,o.r,o.r,o.r*.7,'#ffffff',.5);return;}
};
function obsSprite(o){
  if(o.spr)return o.spr;
  const pad=o.b==='sky'?120:o.lt==='sky'?90:o.b==='lm'?48:o.b==='urban'?12:36,SS=1.3,w=o.k===0?o.r*2:o.w,h=o.k===0?o.r*2:o.h;
  const c=mkCanvas((w+pad*2)*SS,(h+pad*2)*SS),g=c.getContext('2d');g.scale(SS,SS);g.translate(pad,pad);
  OBS_DRAW[o.b](g,o,w,h,mkRng(o.s));
  o.spr=c;o.sx=(o.k===0?o.x-o.r:o.x)-pad;o.sy=(o.k===0?o.y-o.r:o.y)-pad;o.sw=w+pad*2;o.sh=h+pad*2;return c;
}
/* ---------- Mégapole : hauteur des tours, textures de façade ---------- */
/* hauteur relative d'une tour (0,6 à 1,5), tirée de sa graine : la même pour le toit et les façades */
function twH(o){return .6+((o.s>>>7)&1023)/1023*.9;}
/* FACN styles partagés par toutes les tours, en deux éclairages (côté lumière / côté ombre : seule la
   maçonnerie s'assombrit, une fenêtre allumée reste allumée). Texture 2x de FACW×FACH ; v=0 (en haut)
   est le toit, v=FACH la rue : drawTowers l'étire sur la hauteur apparente de la façade. */
const FACN=6,FACW=256,FACH=64,FACS=[];
const FACP=[['#23213a','#ffd27a',6,.42],['#1d2334','#a8f4ff',7,.5],['#27202f','#ffb86b',5,.34],['#1f1f2c','#fff0c0',8,.46],['#241e30','#ff9ad8',6,.38],['#1b2530','#d6fbff',5,.55]];
/* générateur (une rangée de fenêtres par unité) : la cuisson des chunks de la ville les prépare par lots
   (drawCity) ; facTex n'est qu'un recours synchrone si une façade manque encore à l'affichage */
const FACG=[];
function facIt(k){return FACG[k]||(FACG[k]=facGen(k>>1,k&1));}
function facTex(i,dk){const k=i*2+(dk?1:0);if(!FACS[k]){const it=facIt(k);while(!it.next().done);}return FACS[k];}
function* facGen(i,dk){const key=i*2+(dk?1:0);
  const t=mkCanvas(FACW*2,FACH*2),g=t.getContext('2d'),r=mkRng(0x9ac0+i*977),P=FACP[i],cw=P[2];g.scale(2,2);
  g.fillStyle=shade(P[0],dk?-.4:0);g.fillRect(0,0,FACW,FACH);g.fillStyle=shade(P[0],dk?-.1:.3);g.fillRect(0,0,FACW,3);
  for(let y=7;y<FACH-15;y+=7){for(let x=2;x+cw-2<FACW;x+=cw){const q=r(),on=q<P[3];
    g.fillStyle=on?(q<.05?'#ff5ad8':q<.09?'#6ff0ff':P[1]):(dk?'#0a0d18':'#111a2c');g.globalAlpha=on?.5+r()*.45:1;g.fillRect(x,y,cw-2,4);}yield;}
  g.globalAlpha=1;g.fillStyle='rgba(0,0,0,.35)';for(let x=r()*40;x<FACW;x+=36+r()*30)g.fillRect(x,3,2.5,FACH-15);
  g.fillStyle='#0b0a12';g.fillRect(0,FACH-12,FACW,12);
  for(let x=0;x<FACW;){const l=18+r()*40,col=['#ff2d95','#2de2ff','#ffc93c','#ff8a2d'][Math.floor(r()*4)];g.fillStyle=col;g.globalAlpha=.9;g.fillRect(x+2,FACH-12,l-4,2);g.globalAlpha=.35;g.fillRect(x+3,FACH-9,l-6,7);x+=l;}
  g.globalAlpha=1;
  for(let k=0;k<2;k++){const x=20+r()*(FACW-40),y=10+r()*10,col=['#ff2d95','#2de2ff','#ffc93c'][Math.floor(r()*3)];radial(g,x+3,y+14,22,col,.4);g.fillStyle=col;g.fillRect(x,y,6,28);g.fillStyle='rgba(255,255,255,.7)';g.fillRect(x+2,y+2,2,24);}
  const hz=g.createLinearGradient(0,FACH*.5,0,FACH);hz.addColorStop(0,'rgba(255,45,149,0)');hz.addColorStop(1,'rgba(255,45,149,.18)');g.fillStyle=hz;g.fillRect(0,0,FACW,FACH);
  FACS[key]=t;FACG[key]=null;}
