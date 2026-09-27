/* =========================================================
   MONDE CONTINU : biomes, obstacles, décor
   ========================================================= */
const WR=7000,CH=512,NC=Math.ceil(2*WR/CH)+4,COFF=NC>>1;
const BIO={
  plains:{n:'Plaines de Lumen',sub:'Prairies phosphorescentes',g:'#10302a',a:'#6dffb5',b:'#d6ff7a',wea:'pollen',far:'mist',en:{pop:3,mite:2,spike:1.2,orbit:1,spread:1,ring:.6}},
  floral:{n:'Jardin carnivore',sub:'Les fleurs ont faim',g:'#330f35',a:'#ff5ad8',b:'#ffd166',wea:'petals',far:'blooms',en:{spawner:1.4,mite:2.5,pop:2,spike:1.5,ring:1}},
  sea:{n:'Récif abyssal',sub:'Pression et lumière froide',g:'#062150',a:'#34e6ff',b:'#6dffd9',wea:'bubbles',far:'rays',en:{orbit:3,pop:2,ring:1.5,spawner:.8,sniper:.6}},
  sky:{n:'Archipel céleste',sub:'Au-dessus des nuages',g:'#223673',a:'#cfe0ff',b:'#ffffff',wea:'wind',far:'clouds',en:{sniper:2.5,orbit:2,spread:1.5,pop:1}},
  cyber:{n:'Grille néon',sub:'Le réseau te voit',g:'#0a0822',a:'#2de2ff',b:'#ff2d95',wea:'data',far:'grid',en:{gatling:2.5,sniper:1.5,spread:2,mite:1.5}},
  urban:{n:'Mégapole',sub:'Pluie acide et néons',g:'#13131f',a:'#ffc93c',b:'#ff2d95',wea:'rain',far:'lights',en:{spread:2.5,spike:2,gatling:1.5,pop:1.5,sniper:1}},
  ice:{n:'Glacier fractal',sub:'Tout se fige',g:'#0f2d42',a:'#b5f3ff',b:'#ffffff',wea:'snow',far:'mist',en:{ring:2.5,spread:1.5,orbit:1.5,spike:1}},
  core:{n:'Le Cœur',sub:'Territoire de l’Hypernoyau',g:'#300a10',a:'#ff3355',b:'#ff8a2d',wea:'embers',far:'pulse',en:{spike:2,ring:2,spawner:1.5,gatling:1.5,sniper:1}},
};
const BTYPES=['plains','floral','sea','sky','cyber','urban','ice'];
function mkRng(s){let a=(s>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,-2048144789))|0;h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;}
function hn(ix,iy,s){return hash2(ix,iy,s)/4294967296;}
function vnoise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),a=hn(ix,iy,s),b=hn(ix+1,iy,s),c=hn(ix,iy+1,s),d=hn(ix+1,iy+1,s);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}

let WD=null;
function genWorld(seed){
  const rnd=mkRng(seed),sites=[{x:0,y:0,t:'plains'}];
  let g=0;
  while(sites.length<30&&g++<6000){const a=rnd()*TAU,d=Math.sqrt(rnd())*WR*1.05,x=Math.cos(a)*d,y=Math.sin(a)*d;let ok=true;for(const s of sites)if((s.x-x)**2+(s.y-y)**2<1600*1600){ok=false;break;}if(ok)sites.push({x,y,t:null});}
  const far=sites.filter(s=>{const d=Math.hypot(s.x,s.y);return d>WR*.66&&d<WR*.9;});
  const core=far.length?far[Math.floor(rnd()*far.length)]:sites[sites.length-1];core.t='core';
  const pool=[];for(let i=0;i<6;i++)for(const t of BTYPES)pool.push(t);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=pool[i];pool[i]=pool[j];pool[j]=t;}
  const un=sites.filter(s=>!s.t).sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
  for(const s of un){let k=pool.findIndex(t=>!sites.some(o=>o.t===t&&Math.hypot(o.x-s.x,o.y-s.y)<1900));if(k<0)k=0;s.t=pool.length?pool.splice(k,1)[0]:BTYPES[Math.floor(rnd()*7)];}
  const hc=sites.filter(s=>s.t!=='core'&&s.t!=='plains'&&Math.hypot(s.x,s.y)>WR*.36&&Math.hypot(s.x,s.y)<WR*.74&&Math.hypot(s.x-core.x,s.y-core.y)>1500);
  for(let i=hc.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=hc[i];hc[i]=hc[j];hc[j]=t;}
  const hearts=[];
  for(const s of hc){if(hearts.length>=3)break;if(hearts.some(h=>h.t===s.t))continue;const a=Math.atan2(s.y,s.x);if(hearts.some(h=>Math.abs(angDiff(Math.atan2(h.y,h.x),a))<.8))continue;hearts.push({x:s.x,y:s.y,t:s.t});}
  for(const s of hc){if(hearts.length>=3)break;if(!hearts.some(h=>h.x===s.x&&h.y===s.y))hearts.push({x:s.x,y:s.y,t:s.t});}
  while(hearts.length<3){const a=rnd()*TAU;hearts.push({x:Math.cos(a)*WR*.55,y:Math.sin(a)*WR*.55,t:null});}
  WD={seed,sites,core:{x:core.x,y:core.y},hearts,chunks:new Array(NC*NC),bakes:[],warp:[rnd()*100,rnd()*100],map:null,mini:null,fog:null,fogG:null,fogA:new Uint8Array(64*64),used:false};
  for(const h of hearts)if(!h.t)h.t=biomeAt(h.x,h.y);
  WD.hs=(seed%9973)+17;
  buildTrails(rnd);buildLandmarks(rnd);buildWalls();gcWorld(rnd);gxWorld(rnd);gvWorld();
  buildMaps();
}
function warpXY(x,y){const w=WD.warp;return[x+Math.sin(y*.0013+w[0])*190+Math.sin(y*.0041+w[1])*60,y+Math.sin(x*.0012+w[1])*190+Math.sin(x*.0037+w[0])*60];}
function siteAt(x,y){const q=warpXY(x,y),S=WD.sites;let b=0,bd=1e18;for(let i=0;i<S.length;i++){const dx=S[i].x-q[0],dy=S[i].y-q[1],d=dx*dx+dy*dy;if(d<bd){bd=d;b=i;}}return S[b];}
function biomeAt(x,y){return siteAt(x,y).t;}
/* poids des deux biomes les plus proches (pour les fondus) */
function biomeMix(x,y){const q=warpXY(x,y),S=WD.sites;let b1=0,b2=0,d1=1e18,d2=1e18;
  for(let i=0;i<S.length;i++){const dx=S[i].x-q[0],dy=S[i].y-q[1],d=dx*dx+dy*dy;if(d<d1){d2=d1;b2=b1;d1=d;b1=i;}else if(d<d2){d2=d;b2=i;}}
  const t=clamp((Math.sqrt(d2)-Math.sqrt(d1))/520,0,1),w=.5+.5*t;
  return S[b1].t===S[b2].t?[{b:S[b1].t,w:1}]:[{b:S[b1].t,w},{b:S[b2].t,w:1-w}];}
function buildMaps(){
  const N=256,k=2*WR/N,S=WD.sites;
  const cm=document.createElement('canvas');cm.width=cm.height=N;const gm=cm.getContext('2d'),img=gm.createImageData(N,N),d=img.data;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=-WR+(i+.5)*k,y=-WR+(j+.5)*k,o=(j*N+i)*4,r0=Math.hypot(x,y);d[o+3]=255;
    if(r0>WR+80){d[o]=5;d[o+1]=3;d[o+2]=12;continue;}
    const q=warpXY(x,y);let b1=0,b2=0,d1=1e18,d2=1e18;
    for(let s=0;s<S.length;s++){const dx=S[s].x-q[0],dy=S[s].y-q[1],dd=dx*dx+dy*dy;if(dd<d1){d2=d1;b2=b1;d1=dd;b1=s;}else if(dd<d2){d2=dd;b2=s;}}
    const t=clamp((Math.sqrt(d2)-Math.sqrt(d1))/300,0,1),m=.5+.5*t*t*(3-2*t);
    const c1=rgb(BIO[S[b1].t].g),c2=rgb(BIO[S[b2].t].g);
    const n=.78+.44*(vnoise(x*.0016,y*.0016,7)*.65+vnoise(x*.005,y*.005,9)*.35);
    const e=r0>WR-220?clamp((WR+80-r0)/300,0,1):1;
    for(let q2=0;q2<3;q2++)d[o+q2]=clamp((c1[q2]*m+c2[q2]*(1-m))*n*e+5*(1-e),0,255);
  }
  gm.putImageData(img,0,0);{const bl=mkCanvas(256,256),bg=bl.getContext('2d');bg.fillStyle='#05030c';bg.fillRect(0,0,256,256);bg.filter='blur(2.2px)';bg.drawImage(cm,0,0);bg.filter='none';WD.map=bl;}
  const M=128,km=2*WR/M,cn=document.createElement('canvas');cn.width=cn.height=M;const gn=cn.getContext('2d'),im2=gn.createImageData(M,M),d2=im2.data;
  for(let j=0;j<M;j++)for(let i=0;i<M;i++){const x=-WR+(i+.5)*km,y=-WR+(j+.5)*km,o=(j*M+i)*4;if(Math.hypot(x,y)>WR){d2[o+3]=0;continue;}
    const b=BIO[biomeAt(x,y)],c1=rgb(b.g),c2=rgb(b.a);for(let q2=0;q2<3;q2++)d2[o+q2]=c1[q2]*.55+c2[q2]*.45;d2[o+3]=255;}
  gn.putImageData(im2,0,0);
  {const q=M/(2*WR);gn.fillStyle='rgba(0,0,0,.5)';for(let j=0;j<NG;j++)for(let i=0;i<NG;i++)if(WD.wall[j*NG+i])gn.fillRect((G0+i*WC+WR)*q,(G0+j*WC+WR)*q,WC*q+.3,WC*q+.3);
   gn.strokeStyle='rgba(255,240,200,.5)';gn.lineWidth=.8;gn.beginPath();for(const sg of WD.segs){gn.moveTo((sg.ax+WR)*q,(sg.ay+WR)*q);gn.lineTo((sg.bx+WR)*q,(sg.by+WR)*q);}gn.stroke();
   gn.fillStyle='#fff';for(const L of WD.lms){gn.beginPath();gn.arc((L.x+WR)*q,(L.y+WR)*q,1.6,0,TAU);gn.fill();}}
  WD.mini=cn;
  const cf=document.createElement('canvas');cf.width=cf.height=64;const gf=cf.getContext('2d');gf.fillStyle='rgba(6,3,14,.9)';gf.fillRect(0,0,64,64);WD.fog=cf;WD.fogG=gf;
}
function revealFog(x,y,rad){
  const n=64,k=2*WR/n,i0=Math.floor((x-rad+WR)/k),i1=Math.floor((x+rad+WR)/k),j0=Math.floor((y-rad+WR)/k),j1=Math.floor((y+rad+WR)/k);let c=0;
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){if(i<0||j<0||i>=n||j>=n)continue;const id=j*n+i;if(WD.fogA[id])continue;const cx=-WR+(i+.5)*k,cy=-WR+(j+.5)*k;
    if((cx-x)**2+(cy-y)**2<rad*rad){WD.fogA[id]=1;WD.fogG.clearRect(i,j,1,1);c++;}}
  return c;
}

/* ---------- morceaux (chunks) et obstacles ---------- */
const EMPTY=[];
function getChunk(cx,cy){const ix=cx+COFF,iy=cy+COFF;if(ix<0||iy<0||ix>=NC||iy>=NC)return null;const i=ix*NC+iy;return WD.chunks[i]||(WD.chunks[i]=genChunk(cx,cy));}
function clearOK(x,y,r){
  if(x*x+y*y<(430+r)**2)return false;
  if(x*x+y*y>(WR-90-r)**2)return false;
  for(const h of WD.hearts)if((x-h.x)**2+(y-h.y)**2<(690+r)**2)return false;
  const c=WD.core;if((x-c.x)**2+(y-c.y)**2<(900+r)**2)return false;
  return true;
}
function addObs(c,o){
  if(o.k===0){o.cx=o.x;o.cy=o.y;o.R=o.r;}else{o.cx=o.x+o.w/2;o.cy=o.y+o.h/2;o.R=Math.hypot(o.w,o.h)/2;}
  if(!clearOK(o.cx,o.cy,o.R))return false;
  if(wallNear(o.cx,o.cy,o.R+22))return false;
  if(trailDist(o.cx,o.cy)<o.R+(o.b==='urban'?40:70))return false;
  for(const L of WD.lms)if((L.x-o.cx)**2+(L.y-o.cy)**2<(L.R+o.R+30)**2)return false;
  for(const q of c.obs)if(!q.wall&&Math.hypot(q.cx-o.cx,q.cy-o.cy)<q.R+o.R+46)return false;
  o.home=c;c.obs.push(o);return true;
}
const OBS_SPEC={plains:[2.2,26,60],floral:[1.8,34,70],sea:[2,30,66],sky:[.9,70,130],cyber:[1.6,56,120],ice:[2.2,26,58],core:[1.7,36,72]};
const LIVE_SPEC={floral:['bloom',2],sea:['kelp',5],cyber:['beacon',3],urban:['car',3],ice:['shimmer',4],core:['node',4]};
function hitList(L,x,y,r){for(const o of L){if(o.k===0){if((o.x-x)**2+(o.y-y)**2<(o.r+r)**2)return o;}else if(x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r)return o;}return null;}
function genChunk(cx,cy){
  const rnd=mkRng(hash2(cx,cy,WD.seed)),x0=cx*CH,y0=cy*CH;
  const c={cx,cy,x0,y0,obs:[],live:[],coll:null,bake:null,used:0,cacheDone:false,cachePos:null};
  if(Math.hypot(x0+CH/2,y0+CH/2)>WR+CH)return c;
  chunkWalls(c);
  for(const L of WD.lms)for(const p of L.parts){if(p.home)continue;const px=p.k===0?p.x:p.x+p.w/2,py=p.k===0?p.y:p.y+p.h/2;if(px<x0||px>=x0+CH||py<y0||py>=y0+CH)continue;
    p.cx=px;p.cy=py;p.R=p.k===0?p.r:Math.hypot(p.w,p.h)/2;p.home=c;c.obs.push(p);}
  for(let bx=0;bx<2;bx++)for(let by=0;by<2;by++){const X=x0+bx*256,Y=y0+by*256;
    if(biomeAt(X+128,Y+128)!=='urban'||rnd()<.2)continue;
    const m=36+rnd()*18;
    if(rnd()<.4){const hw=(256-2*m-26)/2;addObs(c,{k:1,x:X+m,y:Y+m,w:hw,h:256-2*m,b:'urban',s:(rnd()*1e9)|0});addObs(c,{k:1,x:X+m+hw+26,y:Y+m,w:hw,h:256-2*m,b:'urban',s:(rnd()*1e9)|0});}
    else addObs(c,{k:1,x:X+m,y:Y+m,w:256-2*m,h:256-2*m,b:'urban',s:(rnd()*1e9)|0});}
  for(let i=0;i<5;i++){const x=x0+rnd()*CH,y=y0+rnd()*CH,b=biomeAt(x,y);if(b==='urban')continue;const sp=OBS_SPEC[b];if(rnd()>sp[0]/5)continue;
    const r=sp[1]+rnd()*(sp[2]-sp[1]);
    if(b==='cyber'){const w=r*(1+rnd()*.6),h=r*(1+rnd()*.6);addObs(c,{k:1,x:x-w/2,y:y-h/2,w,h,b,s:(rnd()*1e9)|0});}
    else addObs(c,{k:0,x,y,r,b,s:(rnd()*1e9)|0});}
  for(let i=0;i<6;i++){const x=x0+rnd()*CH,y=y0+rnd()*CH,b=biomeAt(x,y),q=LIVE_SPEC[b];if(!q||rnd()>q[1]/6)continue;
    if(hitList(c.obs,x,y,24)||wallNear(x,y,30))continue;
    if(q[0]==='car'){const vert=rnd()<.5;c.live.push({t:'car',x:vert?Math.round(x/256)*256+(rnd()<.5?-13:13):x0,y:vert?y0:Math.round(y/256)*256+(rnd()<.5?-13:13),vert,ph:rnd()*CH,spd:(rnd()<.5?-1:1)*(1.3+rnd()*1.2)});continue;}
    c.live.push({t:q[0],x,y,s:.7+rnd()*.6,ph:rnd()*TAU});}
  if(rnd()<.34){const x=x0+60+rnd()*(CH-120),y=y0+60+rnd()*(CH-120);if(clearOK(x,y,40)&&!hitList(c.obs,x,y,50)&&!wallNear(x,y,70))c.cachePos={x,y};}
  return c;
}
function collOf(c){
  if(c.coll)return c.coll;const out=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const n=getChunk(c.cx+dx,c.cy+dy);if(!n)continue;
    for(const o of n.obs)if(o.cx+o.R>c.x0&&o.cx-o.R<c.x0+CH&&o.cy+o.R>c.y0&&o.cy-o.R<c.y0+CH)out.push(o);}
  return c.coll=out;
}
function obsNear(x,y){const c=getChunk(Math.floor(x/CH),Math.floor(y/CH));return c?collOf(c):EMPTY;}
function pointHit(x,y,r){return hitList(obsNear(x,y),x,y,r);}
/* repousse un cercle hors des obstacles ; renvoie la normale du dernier contact */
function collideCircle(o,r){
  const L=obsNear(o.x,o.y);let hit=null;
  for(let i=0;i<L.length;i++){const q=L[i];
    if(q.k===0){const dx=o.x-q.x,dy=o.y-q.y,rs=q.r+r,d2=dx*dx+dy*dy;if(d2<rs*rs){const d=Math.sqrt(d2)||.01,nx=dx/d,ny=dy/d;o.x=q.x+nx*rs;o.y=q.y+ny*rs;hit=[nx,ny];}}
    else{const px=clamp(o.x,q.x,q.x+q.w),py=clamp(o.y,q.y,q.y+q.h),dx=o.x-px,dy=o.y-py,d2=dx*dx+dy*dy;
      if(d2<r*r){if(d2>1e-6){const d=Math.sqrt(d2),nx=dx/d,ny=dy/d;o.x=px+nx*r;o.y=py+ny*r;hit=[nx,ny];}
        else{const l=o.x-q.x,rt=q.x+q.w-o.x,t=o.y-q.y,bt=q.y+q.h-o.y,m=Math.min(l,rt,t,bt);
          if(m===l){o.x=q.x-r;hit=[-1,0];}else if(m===rt){o.x=q.x+q.w+r;hit=[1,0];}else if(m===t){o.y=q.y-r;hit=[0,-1];}else{o.y=q.y+q.h+r;hit=[0,1];}}}}}
  return hit;
}

/* =========================================================
   RELIEF, SENTIERS, FALAISES ET MONUMENTS
   ========================================================= */
/* grille des falaises : alignée sur les chunks (8 cellules par chunk) */
const WC=64,NGH=Math.ceil(WR/WC)+1,NG=NGH*2,G0=-NGH*WC;
/* hauteur du terrain (collines, vallées) */
function fbmH(x,y){const s=WD.hs;return vnoise(x*.0009,y*.0009,s)*.55+vnoise(x*.0024,y*.0024,s+1)*.3+vnoise(x*.006,y*.006,s+2)*.15;}
const WALLD={plains:1,floral:1.05,sea:1.1,sky:1.2,cyber:1,ice:1.1,core:1.2,urban:0};
const bk=(cx,cy)=>(cx+64)*256+cy+64;
function segD2(s,x,y){const dx=s.bx-s.ax,dy=s.by-s.ay,l=dx*dx+dy*dy,t=l?clamp(((x-s.ax)*dx+(y-s.ay)*dy)/l,0,1):0,ex=s.ax+dx*t-x,ey=s.ay+dy*t-y;return ex*ex+ey*ey;}
function trailDist(x,y){const L=WD.segB.get(bk(Math.floor(x/CH),Math.floor(y/CH)));if(!L)return 1e9;let m=1e18;for(let i=0;i<L.length;i++){const d=segD2(L[i],x,y);if(d<m)m=d;}return Math.sqrt(m);}
/* réseau de sentiers : arbre couvrant entre les biomes + quelques boucles => embranchements */
function buildTrails(rnd){
  const S=WD.sites,n=S.length,dd=(a,b)=>Math.hypot(S[a].x-S[b].x,S[a].y-S[b].y),E=[],K=new Set(),key=(a,b)=>Math.min(a,b)*64+Math.max(a,b);
  const add=(a,b)=>{const k=key(a,b);if(K.has(k))return;K.add(k);E.push([a,b]);};
  const inT=new Uint8Array(n),best=new Float64Array(n),par=new Int32Array(n);inT[0]=1;for(let i=1;i<n;i++)best[i]=dd(0,i);
  for(let it=1;it<n;it++){let m=-1;for(let i=0;i<n;i++)if(!inT[i]&&(m<0||best[i]<best[m]))m=i;inT[m]=1;add(par[m],m);
    for(let i=0;i<n;i++)if(!inT[i]){const d=dd(m,i);if(d<best[i]){best[i]=d;par[i]=m;}}}
  for(let a=0;a<n;a++){let b=-1,bd=1e18;for(let i=0;i<n;i++){if(i===a||K.has(key(a,i)))continue;const d=dd(a,i);if(d<bd){bd=d;b=i;}}if(b>=0&&bd<2400&&rnd()<.45)add(a,b);}
  const segs=[],B=new Map();
  E.forEach(([a,b],ei)=>{const A=S[a],Z=S[b],L=dd(a,b),nx=-(Z.y-A.y)/L,ny=(Z.x-A.x)/L,N=Math.max(4,Math.ceil(L/70)),amp=110+rnd()*170,s0=rnd()*100;
    let px=A.x,py=A.y;
    for(let k=1;k<=N;k++){const t=k/N,o=(vnoise(t*L/480+s0,ei*7.3,5)-.5)*2*amp*Math.sin(Math.PI*t);let x=A.x+(Z.x-A.x)*t+nx*o,y=A.y+(Z.y-A.y)*t+ny*o;
      const r=Math.hypot(x,y);if(r>WR-240){x*=(WR-240)/r;y*=(WR-240)/r;}
      const sg={ax:px,ay:py,bx:x,by:y,e:ei,k,n:N};segs.push(sg);
      const i0=Math.floor((Math.min(px,x)-180)/CH),i1=Math.floor((Math.max(px,x)+180)/CH),j0=Math.floor((Math.min(py,y)-180)/CH),j1=Math.floor((Math.max(py,y)+180)/CH);
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const q=bk(i,j);let l=B.get(q);if(!l)B.set(q,l=[]);l.push(sg);}
      px=x;py=y;}});
  WD.edges=E;WD.segs=segs;WD.segB=B;
}
/* monuments : un par grande clairière de biome, ouverts là où passent les sentiers */
const LMS={plains:{R:230,n:12,r:[18,26],c:34},floral:{R:215,n:14,r:[13,18],c:70},sea:{R:220,n:10,r:[20,28],c:40},sky:{R:200,n:8,r:[17,20],c:32},
  cyber:{R:230,n:12,r:[20,24],c:30,rect:1},urban:{R:170,n:0,c:52},ice:{R:195,n:9,r:[18,32],c:46}};
function buildLandmarks(rnd){
  WD.lms=[];
  WD.sites.forEach((s,si)=>{const cf=LMS[s.t];if(!cf)return;const r0=Math.hypot(s.x,s.y);if(r0<760||r0>WR-560)return;
    if(WD.hearts.some(h=>Math.hypot(h.x-s.x,h.y-s.y)<1000))return;if(Math.hypot(s.x-WD.core.x,s.y-WD.core.y)<1400)return;
    if(biomeAt(s.x,s.y)!==s.t)return;
    const gaps=[];for(const q of WD.segs){const d=Math.sqrt(segD2(q,s.x,s.y));if(d>60)continue;for(const p of [[q.ax,q.ay],[q.bx,q.by]]){const e=Math.hypot(p[0]-s.x,p[1]-s.y);if(e>90&&e<420)gaps.push(Math.atan2(p[1]-s.y,p[0]-s.x));}}
    for(const q of WD.segs){const e=Math.hypot(q.bx-s.x,q.by-s.y);if(e>cf.R-40&&e<cf.R+60)gaps.push(Math.atan2(q.by-s.y,q.bx-s.x));}
    const L={x:s.x,y:s.y,t:s.t,R:cf.R+70,parts:[],s:(rnd()*1e9)|0},off=rnd()*TAU;
    for(let k=0;k<cf.n;k++){const a=off+k/cf.n*TAU;if(gaps.some(g=>Math.abs(angDiff(a,g))<.36))continue;if(!cf.rect&&rnd()<.14)continue;
      const r=cf.r[0]+rnd()*(cf.r[1]-cf.r[0]),x=s.x+Math.cos(a)*cf.R,y=s.y+Math.sin(a)*cf.R;
      L.parts.push(cf.rect?{k:1,x:x-r,y:y-r,w:r*2,h:r*2,b:'lm',lt:s.t,role:'ring',s:(rnd()*1e9)|0}:{k:0,x,y,r,b:'lm',lt:s.t,role:'ring',s:(rnd()*1e9)|0,a});}
    L.parts.push(cf.rect?{k:1,x:s.x-cf.c,y:s.y-cf.c,w:cf.c*2,h:cf.c*2,b:'lm',lt:s.t,role:'center',s:(rnd()*1e9)|0}:{k:0,x:s.x,y:s.y,r:cf.c,b:'lm',lt:s.t,role:'center',s:(rnd()*1e9)|0});
    WD.lms.push(L);});
}
function wallRaw(x,y){
  if(x*x+y*y>(WR-150)**2)return 0;
  const s=WD.hs,h=fbmH(x,y),rd=Math.abs(vnoise(x*.0015,y*.0015,s+4)-.5);
  if(h<.555&&rd>.05)return 0;
  if(vnoise(x*.0026,y*.0026,s+3)>.7||!clearOK(x,y,40))return 0;
  const dn=WALLD[biomeAt(x,y)];if(!dn)return 0;
  if(!(h>.6-(dn-1)*.25||rd<.04*dn))return 0;
  for(const L of WD.lms)if((x-L.x)**2+(y-L.y)**2<(L.R+100)**2)return 0;
  return trailDist(x,y)<120?0:1;
}
function buildWalls(){
  const N=NG,M=new Uint8Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)M[j*N+i]=wallRaw(G0+(i+.5)*WC,G0+(j+.5)*WC);
  /* nettoyage : pas de rochers isolés */
  for(let p=0;p<2;p++)for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){const k=j*N+i;if(!M[k])continue;if(M[k-1]+M[k+1]+M[k-N]+M[k+N]<2)M[k]=0;}
  /* remplissage : toute poche inaccessible devient falaise (aucune zone piégée) */
  const R=new Uint8Array(N*N),st=[],o=NGH*N+NGH,lim=(WR-60)**2;st.push(o);R[o]=1;
  while(st.length){const k=st.pop(),i=k%N,j=(k/N)|0;for(const q of [k-1,k+1,k-N,k+N]){const qi=q%N,qj=(q/N)|0;if(q<0||q>=N*N||Math.abs(qi-i)+Math.abs(qj-j)!==1||R[q]||M[q])continue;const x=G0+(qi+.5)*WC,y=G0+(qj+.5)*WC;if(x*x+y*y>lim)continue;R[q]=1;st.push(q);}}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;if(!M[k]&&!R[k]&&x*x+y*y<(WR-150)**2)M[k]=1;}
  WD.wall=M;
}
function wallAt(i,j){return i<0||j<0||i>=NG||j>=NG?0:WD.wall[j*NG+i];}
function wallNear(x,y,r){const i0=Math.floor((x-r-G0)/WC),i1=Math.floor((x+r-G0)/WC),j0=Math.floor((y-r-G0)/WC),j1=Math.floor((y+r-G0)/WC);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(wallAt(i,j)){const px=clamp(x,G0+i*WC,G0+(i+1)*WC),py=clamp(y,G0+j*WC,G0+(j+1)*WC);if((px-x)**2+(py-y)**2<r*r)return true;}return false;}
/* falaises du chunk => rectangles de collision fusionnés par rangée */
function chunkWalls(c){
  const i0=Math.round((c.x0-G0)/WC),j0=Math.round((c.y0-G0)/WC);
  for(let j=j0;j<j0+8;j++){let s=-1;for(let i=i0;i<=i0+8;i++){const w=i<i0+8&&wallAt(i,j);if(w&&s<0)s=i;else if(!w&&s>=0){
    const o={k:1,x:G0+s*WC,y:G0+j*WC,w:(i-s)*WC,h:WC,wall:1,b:'wall'};o.cx=o.x+o.w/2;o.cy=o.y+o.h/2;o.R=Math.hypot(o.w,o.h)/2;o.home=c;c.obs.push(o);s=-1;}}}
}
