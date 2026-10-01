'use strict';
/* =========================================================
   SOL EN CACHE (solDraw, g3.js) — vrai Chromium, 01/10/2026.

   node test/sol.js            code de sortie 0 tout passe · 1 un echec
   BRANCHEMENT : par test/navigateur.js (liste TESTS) — le harnais `vm` n'a pas de pixels.

   Le defaut : sur un canevas dessine par le processeur (Firefox du proprietaire, AzureCanvasBackend « skia »),
   recopier les chunks a l'echelle de la camera coutait 12,4 ms par image (drawChunks, 1920x1080). Le cache garde
   le sol de l'image precedente, le decale d'un nombre entier de pixels et ne redessine que ce qui est entre a
   l'ecran ou a change. Ce que ce test defend :
     1. MEME SOL : apres un trajet (pas entiers, diagonales, retours, ~40 images), le sol pose par le cache est
        celui du chemin direct, pixel pour pixel (camera alignee sur le pixel : les deux chemins posent alors le
        sol au meme endroit). Le sol est capture juste apres sa pose, avant le decor et les personnages ;
     2. le cache a bien servi (sinon 1 ne prouverait rien) et il a DECALE la toile au lieu de tout redessiner ;
     3. un chunk dont la surface change pendant le trajet (cuisson refaite) est redessine : le cache ne garde
        pas l'ancienne image ;
     5. ZOOM EN MOUVEMENT : pas de toile refaite a chaque image (chemin direct), le cache reprend ensuite ;
     6. ZOOM QUI GLISSE (fin du lerp, sous le seuil par image) : la toile n'est pas refaite toutes les 3 images
        (Megapole chez le proprietaire : solDraw 15,7 ms en moyenne, 42 ms au pire) ;
     7. CHUNK PAS ENCORE CUIT (voyage rapide, worker en route) : le cache le pose sur le sol de secours au lieu de passer
        au chemin direct et de jeter la toile (Recif chez le proprietaire : solDraw 9,2 ms, 20 ms au pire) ;
     4. PAR DEFAUT, dans ce Chromium (copie des chunks presque gratuite pour le JS), le cache ne s'enclenche PAS :
        sur un canevas dessine par la carte graphique, il doublerait la surface remplie.
   ========================================================= */
const path = require('path');
const { launch } = require('./worker.js');
const HTML = 'file://' + path.resolve(__dirname, '..', 'bulge.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true;
const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '  — ' + info : '')); };

/* entre en partie, arrete la boucle (render est appele a la main), fige camera et zoom */
const SETUP = `(()=>{meta.q='high';applyQuality();refReset();newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();show(null);G.state='play';
  frame=function(){};G.kick=0;G.trauma=0;G.pcx=G.pcy=G.pzoom=null;
  window.__S={snap:null,want:false,hit:0,full:0};const sd=solDraw;solDraw=function(){const k=SOLK;const r=sd.apply(this,arguments);if(r){__S.hit++;if(!k||SOLK.s!==k.s)__S.full++;else if(SOLK.tx!==k.tx||SOLK.ty!==k.ty)__S.dec=(__S.dec||0)+1;}return r;};const fb=fleeBuild;fleeBuild=function(){if(__S.want){__S.want=false;const g=MAINCTX;__S.snap=g.getImageData(0,0,cv.width,cv.height).data;}return fb.apply(this,arguments);};
  return {w:cv.width,h:cv.height,ps:PS};})()`;
/* place la camera pour que la translation soit ENTIERE : PS*W/2 - CAM.x*s = n */
const PLACE = (nx, ny) => `(()=>{G.kick=0;G.trauma=0;G.pcx=G.pcy=G.pzoom=null;G.state="play";const s=PS*G.zoom;G.cx=(PS*W/2-(${nx}))/s;G.cy=(PS*H/2-(${ny}))/s;return true;})()`;
const SHOT = `(()=>{__S.want=true;render(0,16.7);return true;})()`;
const DIFF = `(()=>{const a=__S.a,b=__S.snap;let n=0,n16=0,mx=0,bb=null;for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(d>2){n++;const p=i/4,x=p%cv.width,y=(p-x)/cv.width;if(!bb)bb=[x,y,x,y];bb[0]=Math.min(bb[0],x);bb[1]=Math.min(bb[1],y);bb[2]=Math.max(bb[2],x);bb[3]=Math.max(bb[3],y);}if(d>16)n16++;if(d>mx)mx=d;}return {n,n16,mx,tot:a.length/4,bb,K:SOLK,s:PS*RZ,cx:CAM.x,cy:CAM.y};})()`;
const SETTLE = `(async()=>{for(let i=0;i<400;i++){render(0,16.7);await new Promise(r=>setTimeout(r,16));let busy=false;const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
  for(let cx=c0-1;cx<=c1+1;cx++)for(let cy=r0-1;cy<=r1+1;cy++){const c=getChunk(cx,cy);if(!c||!c.bake)busy=true;}if(!busy)return i;}return -1;})()`;

(async () => {
  const B = await launch();
  try {
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    /* ---- 4. defaut : pas de cache dans un navigateur ou la copie est gratuite ---- */
    await B.nav(HTML); await sleep(3000);
    await B.ev(`(()=>{meta.q='high';applyQuality();refReset();newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();show(null);G.state='play';return true;})()`);
    await sleep(4000);
    const d = await B.ev('({on:SOLON,n:SOLN,e:SOLE,m:SOLM})');
    check('4. par defaut (copie directe peu chere pour le JS), le cache NE s\'enclenche PAS', d.n >= 30 && !d.on && d.m === -1, `${d.n} images mesurees, copie directe ${d.e.toFixed(2)} ms (seuil 3 ms), SOLON=${d.on}`);

    /* ---- 1 a 3. trajet avec le cache force, puis meme image en direct ---- */
    await B.nav(HTML + '?sol=1'); await sleep(3000);
    const st = await B.ev(SETUP);
    let nx = Math.round(st.w / 2), ny = Math.round(st.h / 2);
    await B.ev(PLACE(nx, ny)); const s0 = await B.ev(SETTLE);
    const pas = [[7, 0], [7, 3], [0, -11], [-5, -5], [13, 2], [1, 1], [-40, 0], [0, 37], [3, 3], [-1, 0], [250, -180], [0, 0], [-6, 9]];
    let deca = 0, plein = 0, rebake = null;
    const marks = `(()=>{const K=SOLK;return K?K.tx+','+K.ty+','+K.s:'-';})()`;
    for (let i = 0; i < 40; i++) {
      const [ax, ay] = pas[i % pas.length]; nx += ax; ny += ay;
      await B.ev(PLACE(nx, ny));
      if (i === 20) {
        /* 3. un chunk visible change de surface : on le recuit dans une toile neuve (meme dessin, autre teinte) */
        rebake = await B.ev(`(()=>{const cx=Math.floor(CAM.x/CH),cy=Math.floor(CAM.y/CH),c=getChunk(cx,cy);const o=c.bake,n=mkCanvas(o.width,o.height),g=n.getContext('2d');g.drawImage(o,0,0);g.globalCompositeOperation='difference';g.fillStyle='#ffffff';g.fillRect(0,0,n.width,n.height);c.bake=n;return cx+','+cy;})()`);
      }
      await B.ev(SHOT);
      if (process.env.DBG) console.log(nx, ny, await B.ev(marks), await B.ev("JSON.stringify({h:__S.hit,f:__S.full,d:__S.dec,st:G.state,cx:G.cx,CX:CAM.x,z:G.zoom})"));
    }
    /* reflets de la mer : au plus un chunk decore par image (chSurf, CAUB) ; sans ces images, le rendu direct de controle
       decorerait le dernier chunk entre et l'ecart viendrait du banc, pas du cache */
    for (let i = 0; i < 8; i++) await B.ev(SHOT);
    const S = await B.ev(`JSON.stringify(__S,(k,v)=>k==="snap"||k==="a"?undefined:v)`), used = JSON.parse(S).hit, full = JSON.parse(S).full; deca = JSON.parse(S).dec || 0; if (process.env.DBG) console.log(S);
    await B.ev(`__S.a=__S.snap;true`);
    /* meme etat, chemin direct */
    await B.ev(`(()=>{SOLON=false;window.__SM=1;return true;})()`);
    await B.ev(`(()=>{const f=solDraw;solDraw=function(){return false;};__S.want=true;render(0,16.7);solDraw=f;return true;})()`);
    const r = await B.ev(DIFF); if (process.env.DBG) console.log('diff', JSON.stringify(r)); if (process.env.DBG && r.n) { const col = r.bb[0] + 5; console.log(await B.ev('(()=>{const a=__S.a,b=__S.snap,W2=cv.width;let o=[];for(let y=770;y<800;y++){const i=(y*W2+' + col + ')*4;o.push(y+":"+a[i]+","+a[i+1]+","+a[i+2]+"/"+b[i]+","+b[i+1]+","+b[i+2]);}return o.join(" ");})()')); }if (process.env.DBG && r.n) console.log(await B.ev(`(()=>{const o=[],s=PS*RZ,ty=Math.round(PS*(H/2+RSY)-CAM.y*s);for(let cx=Math.floor(VL/CH);cx<=Math.floor(VR/CH);cx++)for(let cy=Math.floor(VT/CH);cy<=Math.floor(VB/CH);cy++){const c=getChunk(cx,cy),k=cx+','+cy,b=c.bake,d=CAUV.get(b);o.push(k+' y='+(c.y0*s+ty).toFixed(1)+' sea='+(c.sea===undefined?'?':c.sea.toFixed(2))+' posed='+(SOLB.get(k)===b?'raw':SOLB.get(k)===d?'deco':SOLB.has(k)?'other':'none')+' deco='+!!d);}return o.join(' | ');})()`)); if (process.env.DBG) console.log("manquants", await B.ev(`(()=>{let n=0;for(let cx=Math.floor(VL/CH);cx<=Math.floor(VR/CH);cx++)for(let cy=Math.floor(VT/CH);cy<=Math.floor(VB/CH);cy++){const c=getChunk(cx,cy);if(!c||!c.bake)n++;}return n;})()`));
    check('2. le cache a servi, et a DECALE la toile au lieu de la redessiner', used >= 40 && deca >= 20, `cache pris ${used} fois (dont ${full} redessins complets), ${deca}/40 images par decalage, sol stabilise en ${s0} images`);
    check('1+3. meme sol que le chemin direct apres 40 pas (et un chunk recuit au 20e)', r.n16 === 0 && r.n <= r.tot * 1e-3, `${r.n}/${r.tot} pixels differents de plus de 2/255, ${r.n16} de plus de 16/255 (ecart max ${r.mx}) ; chunk recuit ${rebake}. Tolere : 0,1 % d'ecarts FAIBLES — quand la translation tombe sur un entier, la partie de l'ecran sous le raccord de la toile torique est filtree a quelques 1/255 pres (vu jusqu'a 13/255, deja sur 8a45978) ; un chunk perime donne des ecarts francs`);
    /* temoin : sans redessin des chunks changes, l'ecart DOIT apparaitre (sinon 3 ne prouverait rien) */
    for (let i = 0; i < 10; i++) await B.ev(SHOT); /* le cache ne reprend qu'apres 8 images de zoom pose */
    await B.ev(`(()=>{const c=getChunk(Math.floor(CAM.x/CH),Math.floor(CAM.y/CH));const o=c.bake,n=mkCanvas(o.width,o.height);n.getContext('2d').drawImage(o,0,0);n.getContext('2d').fillStyle='#ff00ff';n.getContext('2d').fillRect(0,0,64,64);c.bake=n;CAUB=1;SOLB.set(Math.floor(CAM.x/CH)+','+Math.floor(CAM.y/CH),chSurf(c,n));return true;})()`);
    await B.ev(SHOT); await B.ev(`__S.a=__S.snap;true`);
    await B.ev(`(()=>{const f=solDraw;solDraw=function(){return false;};__S.want=true;render(0,16.7);solDraw=f;return true;})()`);
    const t = await B.ev(DIFF);
    check('temoin : un chunk change MAIS marque comme deja pose => le banc voit l\'ecart', t.n > 0, `${t.n} pixels differents`);
    /* ---- 5. zoom en mouvement : chemin direct, PAS de toile refaite a chaque image ---- */
    await B.ev(`(()=>{__S.hit=0;__S.full=0;return true;})()`);
    for (let i = 0; i < 20; i++) { await B.ev(`(()=>{G.zoom*=1.003;return true;})()`); await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    const zm = JSON.parse(await B.ev(`JSON.stringify({h:__S.hit,f:__S.full})`));
    for (let i = 0; i < 10; i++) { await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    const zp = JSON.parse(await B.ev(`JSON.stringify({h:__S.hit,f:__S.full})`));
    await B.ev(`__S.a=__S.snap;true`);
    await B.ev(`(()=>{const f=solDraw;solDraw=function(){return false;};__S.want=true;render(0,16.7);solDraw=f;return true;})()`);
    const z = await B.ev(DIFF);
    check('5. zoom en mouvement (20 images a +0,3 %) : aucune toile refaite, puis le cache reprend et le sol reste juste', zm.f === 0 && zp.h >= 1 && z.n <= z.tot * 1e-4,
      `pendant : ${zm.h} images par le cache, ${zm.f} redessins complets ; apres : ${zp.h - zm.h} images par le cache ; ${z.n}/${z.tot} pixels differents (tolere : 0,01 %, les joints antialiases entre chunks a une echelle non entiere)`);
    /* ---- 6. zoom qui GLISSE (0,03 % par image, sous le seuil par image) : pas de toile refaite toutes les 3 images ---- */
    await B.ev(`(()=>{__S.hit=0;__S.full=0;return true;})()`);
    for (let i = 0; i < 40; i++) { await B.ev(`(()=>{G.zoom*=1.0003;return true;})()`); await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    const zg = JSON.parse(await B.ev(`JSON.stringify({h:__S.hit,f:__S.full})`));
    check('6. zoom qui glisse lentement (40 images a +0,03 %) : au plus 2 toiles refaites', zg.f <= 2, `${zg.h} images par le cache, ${zg.f} redessins complets`);
    /* ---- 7. chunk pas encore cuit (worker en route) : le cache le pose sur le sol de secours, sans chemin direct ni toile
       refaite ; une fois cuit, il est redessine et le sol redevient celui du chemin direct ---- */
    for (let i = 0; i < 10; i++) { await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    await B.ev(`(()=>{__S.hit=0;__S.full=0;const c=getChunk(Math.floor(CAM.x/CH),Math.floor(CAM.y/CH));__S.cb=c.bake;c.bake=null;c.bk=null;c.wk=1;return true;})()`);
    for (let i = 0; i < 5; i++) { nx += 3; await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    const mq = JSON.parse(await B.ev(`JSON.stringify({h:__S.hit,f:__S.full})`));
    await B.ev(`(()=>{const c=getChunk(Math.floor(CAM.x/CH),Math.floor(CAM.y/CH));c.bake=__S.cb;c.wk=0;return true;})()`);
    for (let i = 0; i < 2; i++) { nx += 3; await B.ev(PLACE(nx, ny)); await B.ev(SHOT); }
    const mq2 = JSON.parse(await B.ev(`JSON.stringify({h:__S.hit,f:__S.full})`));
    await B.ev(`__S.a=__S.snap;true`);
    await B.ev(`(()=>{const f=solDraw;solDraw=function(){return false;};__S.want=true;render(0,16.7);solDraw=f;return true;})()`);
    const mz = await B.ev(DIFF); if (process.env.DBG) console.log("mz", JSON.stringify(mz), await B.ev(`(()=>{const c=getChunk(Math.floor(CAM.x/CH),Math.floor(CAM.y/CH));const s=PS*RZ;return [c.x0*s+Math.round(PS*(W/2+RSX)-CAM.x*s),c.y0*s+Math.round(PS*(H/2+RSY)-CAM.y*s),CH*s];})()`));
    check('7. chunk pas encore cuit : le cache tient (pas de chemin direct ni de toile refaite), puis le chunk cuit est pose juste', mq.h === 5 && mq2.f === 0 && mz.n <= mz.tot * 1e-4,
      `manquant : ${mq.h}/5 images par le cache ; ${mq2.f} redessins complets ; apres cuisson ${mz.n} pixels differents (tolere : 0,01 %, l'echelle laissee non entiere par 5 et 6 : joints antialiases au raccord de la toile torique)`);
  } finally { B.close(); }
  console.log(ok ? 'TOUT PASSE' : 'ECHEC PARTIEL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
