/* =========================================================
   WORKER DE CUISSON — ce module n'est PAS dans la page : build.sh le place, avec les modules du monde
   (g1 gw gw2 gc gx gv) et les trois sprites de g3.js dont la cuisson a besoin, dans un
   bloc script de type text/js-worker, id wk-src, que bakeWorker() (gw2.js) lance en worker.
   Le worker ne recoit que la GRAINE : il regenere le monde lui-meme (genWorld est deterministe, prouve
   champ par champ par test/worker.js), puis cuit un chunk avec les MEMES bakeStep que la page, sur un
   OffscreenCanvas neuf (mkCanvas, gw2.js). Branche par streamWorld (gw2.js, wkAsk/wkRecv) PAR DEFAUT ;
   ?wk=0 garde le temoin sur place (gw2.js : WKW).
   Protocole : {t:'monde',seed,g} -> {t:'monde',seed}   (g : generation, renvoyee avec chaque chunk)
               {t:'cuis',cx,cy}   -> {t:'cuis',cx,cy,g,bm}  (ImageBitmap transfere ; null hors du monde)
   ========================================================= */
let FRAME=0,WG=0;
function wkBake(cx,cy){const c=getChunk(cx,cy);if(!c)return null;c.bake=null;c.bk=null;while(!bakeStep(c));WD.bakes.length=0;const cv=c.bake;c.bake=null;return cv;}
onmessage=e=>{const m=e.data;
  if(m.t==='monde'){genWorld(m.seed);WG=m.g|0;postMessage({t:'monde',seed:m.seed});return;}
  if(m.t==='cuis'){const cv=wkBake(m.cx,m.cy),bm=cv?cv.transferToImageBitmap():null;postMessage({t:'cuis',cx:m.cx,cy:m.cy,g:WG,bm},bm?[bm]:[]);}};
