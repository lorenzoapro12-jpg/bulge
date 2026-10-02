/* =========================================================
   ÎLOTS : un monde rond par niveau (biome, falaises de bord, obstacles, relique)
   Chaque îlot est généré dans SON repère : même rayon WR pour tous, la croissance (×1,4 par îlot)
   est portée par le jeu (g2.js : tailles des ennemis selon leur âge) et par la cinématique de
   passage (g3.js). Le sol garde donc la même résolution d'un îlot à l'autre : jamais plus de
   NC² = 81 chunks cuits (512², ~1 Mo chacun), quel que soit l'îlot. Pur (mkRng/hash2 seulement) : le worker (gk.js) le
   régénère à l'identique à partir de la graine de partie et du numéro d'îlot.
   ========================================================= */
const WR=1050,CH=512,NC=Math.ceil(2*WR/CH)+4,COFF=NC>>1;
/* PR : rayon jouable (membrane de l'îlot, confine) ; RELR : rayon de la relique (l'îlot précédent, en miniature) */
const PR=WR-150,RELR=250;
const BIO={
  plains:{n:'Plaines de Lumen',sub:'Prairies phosphorescentes',g:'#10302a',a:'#6dffb5',b:'#d6ff7a',wea:'pollen'},
  floral:{n:'Jardin carnivore',sub:'Les fleurs mordent les ennemis',g:'#330f35',a:'#ff5ad8',b:'#ffd166',wea:'petals'},
  sea:{n:'Récif abyssal',sub:'Suis le courant',g:'#062150',a:'#34e6ff',b:'#6dffd9',wea:'bubbles'},
  sky:{n:'Archipel céleste',sub:'Pousse-les dans le vide',g:'#223673',a:'#cfe0ff',b:'#ffffff',wea:'wind',far:'clouds'},
  cyber:{n:'Grille néon',sub:'Le balayage te voit',g:'#0a0822',a:'#2de2ff',b:'#ff2d95',wea:'data',far:'grid'},
  urban:{n:'Mégapole',sub:'Les voitures ne freinent pas',g:'#13131f',a:'#ffc93c',b:'#ff2d95',wea:'rain',far:'lights'},
  ice:{n:'Glacier fractal',sub:'Ton dash glisse et gèle',g:'#0f2d42',a:'#b5f3ff',b:'#ffffff',wea:'snow'},
  core:{n:'Le Cœur',sub:'Brise les nœuds qui les protègent',g:'#300a10',a:'#ff3355',b:'#ff8a2d',wea:'embers'},
};
/* l'ordre des îlots : du plus petit monde au plus grand */
const ISL=['plains','floral','sea','sky','cyber','urban','ice','core'],NISL=ISL.length;
function mkRng(s){let a=(s>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,-2048144789))|0;h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;}
function hn(ix,iy,s){return hash2(ix,iy,s)/4294967296;}
function vnoise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),a=hn(ix,iy,s),b=hn(ix+1,iy,s),c=hn(ix,iy+1,s),d=hn(ix+1,iy+1,s);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}

let WD=null;
/* cartes des îlots déjà générés pour la partie en cours (la relique de l'îlot k est la carte de l'îlot k-1) */
const ISLM=new Map();let ISLS=-1;
function islMap(seed,k){if(k<1)return null;if(ISLS!==seed){ISLM.clear();ISLS=seed;}let m=ISLM.get(k);if(m)return m;const S=WD;genIslet(seed,k);m=WD.mini;WD=S;return m;}
/* RELSNAP : l'image RÉELLE de l'îlot quitté, copiée à l'écran au passage (g3.js trSnap, transmise au worker) ;
   sans elle (harnais, îlot régénéré pour une autre relique), la miniature calculée (WD.mini) */
let RELSNAP=null;
function genIslet(seed,k){
  const rs=RELSNAP&&RELSNAP.run===seed&&RELSNAP.k===k?RELSNAP.img:null,relic=rs||islMap(seed,k-1),s=(seed^Math.imul(k,0x9E3779B1))>>>0,rnd=mkRng(s),t=ISL[k-1];
  WD={seed:s,run:seed,isl:k,sites:[{x:0,y:0,t}],core:{x:0,y:0},chunks:new Array(NC*NC),bakes:[],warp:[rnd()*100,rnd()*100],map:null,relic,relicB:k>1?ISL[k-2]:null,lms:[],used:false};
  WD.hs=(s%9973)+17;
  buildWalls();buildMaps();
  if(ISLS!==seed){ISLM.clear();ISLS=seed;}ISLM.set(k,WD.mini);
}
/* un seul biome par îlot : les fonctions de lecture du monde gardent leur forme (art, audio, météo) */
function biomeAt(x,y){return WD.sites[0].t;}
function biomeMix(x,y){return[{b:WD.sites[0].t,w:1}];}
/* carte 256² de l'îlot : couleur du sol, bord qui s'éteint dans le vide, relique au centre */
function buildMaps(){
  const N=256,k=2*WR/N,B=BIO[WD.sites[0].t],c1=rgb(B.g);
  const cm=mkCanvas(N,N);const gm=cm.getContext('2d'),img=gm.createImageData(N,N),d=img.data;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=-WR+(i+.5)*k,y=-WR+(j+.5)*k,o=(j*N+i)*4,r0=Math.hypot(x,y);d[o+3]=255;
    if(r0>WR+80){d[o]=5;d[o+1]=3;d[o+2]=12;continue;}
    const n=.78+.44*(vnoise(x*.0016,y*.0016,7)*.65+vnoise(x*.005,y*.005,9)*.35);
    const e=r0>WR-220?clamp((WR+80-r0)/300,0,1):1;
    for(let q2=0;q2<3;q2++)d[o+q2]=clamp(c1[q2]*n*e+5*(1-e),0,255);
  }
  gm.putImageData(img,0,0);
  const bl=mkCanvas(N,N),bg=bl.getContext('2d');bg.fillStyle='#05030c';bg.fillRect(0,0,N,N);bg.filter='blur(2.2px)';bg.drawImage(cm,0,0);bg.filter='none';
  if(WD.relic)relicInto(bg,N/2,N/2,RELR/k,WD.relic,WD.relicB);
  WD.map=bl;
  /* la miniature (relique de l'îlot suivant) : la même carte, plus ses falaises en ombre, pour qu'on reconnaisse l'îlot quitté */
  const wc=mkCanvas(N,N),wg=wc.getContext('2d'),q=WC/k;wg.fillStyle='rgb(5,3,12)';wg.beginPath();
  for(let j=0;j<NG;j++)for(let i=0;i<NG;i++)if(WD.wall[j*NG+i]){const x=(G0+(i+.5)*WC+WR)/k,y=(G0+(j+.5)*WC+WR)/k;wg.moveTo(x+q*.72,y);wg.arc(x,y,q*.72,0,TAU);}
  wg.fill();
  const mi=mkCanvas(N,N),mg=mi.getContext('2d');mg.drawImage(bl,0,0);mg.filter='blur(1.2px)';mg.drawImage(wc,0,0);mg.filter='none';WD.mini=mi;
}
/* l'îlot précédent, réduit, dans un disque : ombre portée, liseré à la couleur de son biome */
function relicInto(g,x,y,r,map,b){
  g.save();g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.arc(x,y,r*1.08,0,TAU);g.fill();
  g.beginPath();g.arc(x,y,r,0,TAU);g.clip();g.imageSmoothingEnabled=true;g.drawImage(map,x-r*WR/(WR-30),y-r*WR/(WR-30),2*r*WR/(WR-30),2*r*WR/(WR-30));g.restore();
  g.strokeStyle=rgba(BIO[b].a,.55);g.lineWidth=Math.max(1,r*.025);g.beginPath();g.arc(x,y,r,0,TAU);g.stroke();
}

/* ---------- morceaux (chunks) et obstacles ---------- */
const EMPTY=[];
function getChunk(cx,cy){const ix=cx+COFF,iy=cy+COFF;if(ix<0||iy<0||ix>=NC||iy>=NC)return null;const i=ix*NC+iy;return WD.chunks[i]||(WD.chunks[i]=genChunk(cx,cy));}
/* index du chunk dans WD.chunks (-1 hors grille), SANS le générer : streamWorld (gw2.js) s'en sert pour
   borner la génération. genChunk ne dépend ni de l'ordre ni du moment de l'appel : il ne lit que l'état
   figé par genIslet et un générateur PROPRE au chunk (hash2(cx,cy,seed)). */
function chunkIdx(cx,cy){const ix=cx+COFF,iy=cy+COFF;return ix<0||iy<0||ix>=NC||iy>=NC?-1:ix*NC+iy;}
/* centre (relique, arrivée du boss) et bord (apparitions) restent dégagés */
function clearOK(x,y,r){const d2=x*x+y*y;return d2>(RELR+90+r)**2&&d2<(PR-70-r)**2;}
function addObs(c,o){
  if(o.k===0){o.cx=o.x;o.cy=o.y;o.R=o.r;}else{o.cx=o.x+o.w/2;o.cy=o.y+o.h/2;o.R=Math.hypot(o.w,o.h)/2;}
  if(!clearOK(o.cx,o.cy,o.R))return false;
  if(wallNear(o.cx,o.cy,o.R+22))return false;
  for(const q of c.obs)if(!q.wall&&Math.hypot(q.cx-o.cx,q.cy-o.cy)<q.R+o.R+(q.b==='urban'?26:62))return false;
  o.home=c;c.obs.push(o);return true;
}
/* obstacles par biome : [densité, rayon min, rayon max]. Moyens (R ≤ BRKR) : cassables par les tirs ; grands : solides */
const OBS_SPEC={plains:[2.2,26,60],floral:[1.8,34,70],sea:[2,30,66],sky:[.9,70,130],cyber:[1.6,56,120],ice:[2.2,26,58],core:[1.7,36,72]},BRKR=82;
const LIVE_SPEC={floral:['bloom',2],sea:['kelp',5],cyber:['beacon',3],urban:['car',3],ice:['shimmer',4],core:['node',4]};
function hitList(L,x,y,r){for(const o of L){if(o.k===0){if((o.x-x)**2+(o.y-y)**2<(o.r+r)**2)return o;}else if(x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r)return o;}return null;}
function genChunk(cx,cy){
  const rnd=mkRng(hash2(cx,cy,WD.seed)),x0=cx*CH,y0=cy*CH,b=WD.sites[0].t,k=WD.isl||1;
  const c={cx,cy,x0,y0,obs:[],live:[],coll:null,bake:null,used:0};
  if(Math.hypot(x0+CH/2,y0+CH/2)>WR+CH)return c;
  chunkWalls(c);
  /* Mégapole : tours (solides) au milieu des pâtés de 256 */
  if(b==='urban')for(let bx=0;bx<2;bx++)for(let by=0;by<2;by++){const X=x0+bx*256,Y=y0+by*256;
    if(rnd()<.3)continue;const m=40+rnd()*18;
    if(rnd()<.4){const hw=(256-2*m-26)/2;addObs(c,{k:1,x:X+m,y:Y+m,w:hw,h:256-2*m,b,s:(rnd()*1e9)|0});addObs(c,{k:1,x:X+m+hw+26,y:Y+m,w:hw,h:256-2*m,b,s:(rnd()*1e9)|0});}
    else addObs(c,{k:1,x:X+m,y:Y+m,w:256-2*m,h:256-2*m,b,s:(rnd()*1e9)|0});}
  const sp=OBS_SPEC[b];
  if(sp)for(let i=0;i<14;i++){const x=x0+rnd()*CH,y=y0+rnd()*CH;if(rnd()>sp[0]/5)continue;
    const r=sp[1]+rnd()*(sp[2]-sp[1]),s=(rnd()*1e9)|0,pu=rnd()<.17;let o;
    if(b==='cyber'){const w=r*(1+rnd()*.6),h=r*(1+rnd()*.6);o={k:1,x:x-w/2,y:y-h/2,w,h,b,s};}
    else o={k:0,x,y,r,b,s};
    if(addObs(c,o)&&o.R<=BRKR){o.brk=1;o.hp=o.mhp=Math.round((6+o.R*.2)*(1+.55*(k-1)));o.pu=pu;}}
  for(let i=0;i<6;i++){const x=x0+rnd()*CH,y=y0+rnd()*CH,q=LIVE_SPEC[b];if(!q||rnd()>q[1]/6)continue;
    const r0=Math.hypot(x,y);if(r0<RELR+40||r0>PR-40||hitList(c.obs,x,y,24)||wallNear(x,y,30))continue;
    if(q[0]==='car'){const vert=rnd()<.5;c.live.push({t:'car',x:vert?Math.round(x/256)*256+(rnd()<.5?-13:13):x0,y:vert?y0:Math.round(y/256)*256+(rnd()<.5?-13:13),vert,ph:rnd()*CH,spd:(rnd()<.5?-1:1)*(1.3+rnd()*1.2)});continue;}
    c.live.push({t:q[0],x,y,s:.7+rnd()*.6,ph:rnd()*TAU});}
  return c;
}
function collOf(c){
  if(c.coll)return c.coll;const out=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const n=getChunk(c.cx+dx,c.cy+dy);if(!n)continue;
    for(const o of n.obs)if(o.cx+o.R>c.x0&&o.cx-o.R<c.x0+CH&&o.cy+o.R>c.y0&&o.cy-o.R<c.y0+CH)out.push(o);}
  return c.coll=out;
}
/* un obstacle cassé quitte son chunk ; les listes de collision voisines sont à refaire */
function dropObs(o){const c=o.home;if(!c)return;const i=c.obs.indexOf(o);if(i>=0)c.obs.splice(i,1);o.gone=1;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const n=getChunk(c.cx+dx,c.cy+dy);if(n)n.coll=null;}}
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
   RELIEF ET FALAISES
   ========================================================= */
/* grille des falaises : alignée sur les chunks (8 cellules par chunk) */
const WC=64,NGH=Math.ceil(WR/WC)+2,NG=NGH*2,G0=-NGH*WC;
/* hauteur du terrain (collines, vallées) */
function fbmH(x,y){const s=WD.hs;return vnoise(x*.0009,y*.0009,s)*.55+vnoise(x*.0024,y*.0024,s+1)*.3+vnoise(x*.006,y*.006,s+2)*.15;}
/* densité des massifs intérieurs (la Mégapole a ses tours, pas de falaises au milieu) */
const WALLD={plains:1,floral:1.05,sea:1.1,sky:1.2,cyber:1,ice:1.1,core:1.2,urban:0};
/* falaise de bord tout autour (dentelée), quelques massifs entre la relique et le bord : des couverts */
function wallRaw(x,y){
  const r=Math.hypot(x,y),s=WD.hs;
  if(r>WR+WC)return 0;
  if(r>PR+30-vnoise(x*.004,y*.004,s+5)*56)return 1;
  if(r<RELR+190||r>PR-170)return 0;
  const dn=WALLD[WD.sites[0].t];if(!dn)return 0;
  return vnoise(x*.0055,y*.0055,s+3)>.8-(dn-1)*.25?1:0;
}
function buildWalls(){
  const N=NG,M=new Uint8Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)M[j*N+i]=wallRaw(G0+(i+.5)*WC,G0+(j+.5)*WC);
  /* nettoyage : pas de rochers isolés */
  for(let p=0;p<2;p++)for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){const k=j*N+i;if(!M[k])continue;if(M[k-1]+M[k+1]+M[k-N]+M[k+N]<2&&Math.hypot(G0+(i+.5)*WC,G0+(j+.5)*WC)<PR)M[k]=0;}
  /* remplissage : toute poche inaccessible devient falaise (aucune zone piégée) */
  const R=new Uint8Array(N*N),st=[],o=NGH*N+NGH,lim=(PR+40)**2;st.push(o);R[o]=1;
  while(st.length){const k=st.pop(),i=k%N,j=(k/N)|0;for(const q of [k-1,k+1,k-N,k+N]){const qi=q%N,qj=(q/N)|0;if(q<0||q>=N*N||Math.abs(qi-i)+Math.abs(qj-j)!==1||R[q]||M[q])continue;const x=G0+(qi+.5)*WC,y=G0+(qj+.5)*WC;if(x*x+y*y>lim)continue;R[q]=1;st.push(q);}}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;if(!M[k]&&!R[k]&&x*x+y*y<PR*PR)M[k]=1;}
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
