'use strict';
/* =========================================================
   SOCLE DU WORKER DE CUISSON — un chunk cuit DANS UN WORKER est-il identique AU PIXEL au meme chunk
   cuit SUR PLACE ? Et le monde regenere dans le worker depuis la graine est-il le MEME monde ?

   Ce test ne peut pas tourner sous `vm` (pas de rasterisation, pas de Worker) : il pilote un VRAI
   Chromium par CDP, sur le vrai bulge.html ouvert en file:// (comme un joueur).

   node test/worker.js                 graines 12345 et 777, Chromium sans GPU
   node test/worker.js --gpu           idem, Chromium avec son GPU (ici probablement logiciel)
   node test/worker.js --graines=1,2,3
   Code de sortie : 0 si tout passe, 1 sinon.

   (Surfaces : la page cuit sur OffscreenCanvas depuis la passe d'integration, comme le worker ; « DOM » = la surface d'avant.)
   RESULTAT CONNU : a surface egale (OffscreenCanvas des deux cotes) le worker est identique a l'octet ; contre
   le canvas actuel (HTMLCanvasElement) il ne l'est PAS, a cause de clip() (verifie au point 5).
   Pour chaque graine :
     1. MONDE   — genWorld(graine) dans la page et dans le worker ; WD parcouru champ par champ (nombres
                  a pleine precision, tableaux types, Map, et canevas WD.map/mini/fog par empreinte de
                  leurs OCTETS) ; les deux listes doivent etre identiques ligne a ligne.
     2. CHUNKS  — chunks choisis pour passer par des branches differentes de BAKE_STEPS : un par biome,
                  cotier (mer + autre biome), lisiere de ville, monument, falaises, bord du monde.
                  Pour chacun : l'objet chunk (obstacles, vie, cache) compare champ par champ, puis
                  A) octets de getImageData du OffscreenCanvas cuit dans le worker,
                  B) chemin de PRODUCTION : bakeWorker() -> {t:'cuis'} -> ImageBitmap transfere ->
                     drawImage dans un canvas neuf de la page -> getImageData,
                  compares aux octets du MEME chunk cuit sur place par bakeStep sur un OffscreenCanvas (glisse
                  dans BPOOL) : tolerance AUCUNE. Et compares au canvas actuel (HTMLCanvasElement) : l'ecart doit
                  etre exactement l'ecart de surface, et n'exister que dans les chunks qui appellent clip().
     3. TEMOIN  — la page cuit deux fois le meme chunk : 0 octet (sinon la comparaison ne veut rien dire).
     5. CAUSE   — hors du jeu, dans la page : un arc en fill() est identique sur les deux surfaces, le meme arc
                  en clip() ne l'est pas.
     4. DISCRIMINATION — le meme protocole avec un worker volontairement fausse doit ECHOUER :
                  couleur decalee (texture des plaines), unite de BAKE_STEPS sautee (decor),
                  graine de chunk changee (generateur du decor), graine du monde changee.
   ========================================================= */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const GPU = !!ARG('gpu');
const SEEDS = (ARG('graines') || '12345,777').split(',').map(Number);
const CHB = 512 * 512 * 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- client CDP minimal (aucune dependance) ---------- */
async function launch() {
  const port = 9700 + Math.floor(Math.random() * 200);
  const dir = '/root/shots/wk-' + port + '-' + Date.now();
  const flags = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=390,780', 'about:blank'];
  if (!GPU) flags.splice(2, 0, '--disable-gpu');
  const chrome = spawn('chromium', flags, { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 80 && !ver; i++) { await sleep(250); try { ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); } catch (e) { } }
  if (!ver) { chrome.kill('SIGKILL'); throw new Error('chromium : port de debogage muet'); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  const send = (method, params, sessionId) => new Promise((res, rej) => { const m = { id: ++id, method, params: params || {} }; if (sessionId) m.sessionId = sessionId; pend.set(m.id, { res, rej }); ws.send(JSON.stringify(m)); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, S); await send('Page.enable', {}, S);
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S);
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const nav = url => send('Page.navigate', { url }, S);
  return { ev, nav, cdp: (m, p) => send(m, p, S), send, close: () => { try { ws.close(); } catch (e) { } try { chrome.kill('SIGKILL'); } catch (e) { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } } };
}

/* ---------- code injecte : identique dans la page et dans le worker ----------
   __dump : WD (ou un chunk) en lignes « chemin=valeur ». Nombres par String() (aller-retour exact),
   -0 distingue, references partagees/cycles notes « @chemin », canevas par empreinte FNV-1a de TOUS
   leurs octets (getImageData), fonctions notees « fn » (elles viennent du meme texte source). */
const DUMP_SRC = `
function __fnv(d){let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;}
function __dump(root,name){const out=[],seen=new Map();
  const isCv=v=>(typeof HTMLCanvasElement!=='undefined'&&v instanceof HTMLCanvasElement)||(typeof OffscreenCanvas!=='undefined'&&v instanceof OffscreenCanvas);
  const isCtx=v=>(typeof CanvasRenderingContext2D!=='undefined'&&v instanceof CanvasRenderingContext2D)||(typeof OffscreenCanvasRenderingContext2D!=='undefined'&&v instanceof OffscreenCanvasRenderingContext2D);
  const walk=(v,p)=>{
    if(v===null||(typeof v!=='object'&&typeof v!=='function')){out.push(p+'='+(typeof v==='number'?(Object.is(v,-0)?'-0':String(v)):typeof v==='string'?JSON.stringify(v):String(v)));return;}
    if(typeof v==='function'){out.push(p+'=fn');return;}
    if(seen.has(v)){out.push(p+'=@'+seen.get(v));return;}seen.set(v,p);
    if(isCv(v)){out.push(p+'=canvas '+v.width+'x'+v.height+' fnv='+__fnv(v.getContext('2d').getImageData(0,0,v.width,v.height).data));return;}
    if(isCtx(v)){out.push(p+'=ctx2d('+(v.canvas===root.map?'map':v.canvas===root.fog?'fog':'?')+')');return;}
    if(ArrayBuffer.isView(v)){out.push(p+'='+v.constructor.name+'#'+v.length+' fnv='+__fnv(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)));return;}
    if(v instanceof Map){out.push(p+'=Map#'+v.size);for(const [k,x] of v)walk(x,p+'<'+String(k)+'>');return;}
    if(v instanceof Set){out.push(p+'=Set#'+v.size);let i=0;for(const x of v)walk(x,p+'{'+(i++)+'}');return;}
    if(Array.isArray(v)){out.push(p+'=Array#'+v.length);for(let i=0;i<v.length;i++)if(i in v)walk(v[i],p+'['+i+']');return;}
    const ks=Object.keys(v);out.push(p+'={'+ks.join(',')+'}');for(const k of ks)walk(v[k],p+'.'+k);};
  walk(root,name);return out;}`;

/* extension de TEST du worker (jamais dans bulge.html) : ajoutee au texte de #wk-src, elle garde le
   protocole de production (gk.js) et ajoute 'dump' (etat du monde) et 'px' (chunk + octets bruts). */
const WK_EXT = DUMP_SRC + `
{const prod=onmessage;onmessage=e=>{const m=e.data;
  if(m.t==='dump'){postMessage({t:'dump',s:__dump(WD,'WD')});return;}
  if(m.t==='px'){const c=getChunk(m.cx,m.cy),cd=__dump(c,'C'),cv=wkBake(m.cx,m.cy),d=cv.getContext('2d').getImageData(0,0,CH,CH).data;
    postMessage({t:'px',cd,px:d.buffer},[d.buffer]);return;}
  prod(e);};}`;

/* ---------- cote page : installe une fois ---------- */
const PAGE_SRC = DUMP_SRC + `
window.__T={M:{},
  /* worker a messages ordonnes : chaque requete attend sa reponse */
  wk(src){const w=src==null?bakeWorker():new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));if(!w)throw new Error('bakeWorker() a rendu null');
    const q=[];w.onmessage=e=>q.shift().res(e.data);w.onerror=e=>{const p=q.shift();p&&p.rej(new Error('worker : '+(e.message||e.type)));};
    return {ask:(m)=>new Promise((res,rej)=>{q.push({res,rej});w.postMessage(m);}),end:()=>w.terminate()};},
  src(){return document.getElementById('wk-src').textContent;},
  /* cuisson sur place par les vrais bakeStep. Sans dom : la surface de PRODUCTION (mkBake, gw2.js). dom=true : on
     glisse un <canvas> du DOM dans BPOOL, que bakeStep prend a la place -> la surface d'AVANT cette passe. Compte les clip(). */
  bakeHere(cx,cy,dom){const c=getChunk(cx,cy);c.bake=null;c.bk=null;BPOOL.length=0;if(dom){const e=document.createElement('canvas');e.width=e.height=CH;BPOOL.push(e);}bakeStep(c);
    const g=c.bk.g;let clips=0;g.clip=function(){clips++;return Object.getPrototypeOf(g).clip.apply(g,arguments);};
    while(!bakeStep(c));delete g.clip;const cv=c.bake,i=WD.bakes.indexOf(c);if(i>=0)WD.bakes.splice(i,1);c.bake=null;
    return {d:cv.getContext('2d').getImageData(0,0,CH,CH).data,clips,type:cv.constructor.name};},
  cmp(a,b){let n=0,px=0,first=null,max=0;if(a.length!==b.length)return{n:-1,px:-1,first:'tailles '+a.length+'/'+b.length,max:0};
    for(let i=0;i<a.length;i+=4){let d=0;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){n++;d=1;max=Math.max(max,Math.abs(a[i+j]-b[i+j]));}
      if(d){px++;if(!first)first=[(i/4)%CH,Math.floor(i/4/CH),Array.from(a.slice(i,i+4)),Array.from(b.slice(i,i+4))];}}return{n,px,first,max};},
  dcmp(a,b){let n=0,first=null;const L=Math.max(a.length,b.length);for(let i=0;i<L;i++)if(a[i]!==b[i]){n++;if(!first)first=[a[i],b[i]];}return{n,lines:a.length,first};},
  /* choisit des chunks qui passent par des branches differentes de BAKE_STEPS */
  pick(){const cats={},cen=(cx,cy)=>[cx*CH+CH/2,cy*CH+CH/2],R=Math.ceil(WR/CH);
    const add=(k,cx,cy)=>{if(!cats[k])cats[k]=[cx,cy];};
    for(let cx=-R;cx<R;cx++)for(let cy=-R;cy<R;cy++){const [x,y]=cen(cx,cy),r=Math.hypot(x,y);if(r>WR+CH*.3)continue;
      const mix=biomeMix(x,y),b=biomeAt(x,y),lm=WD.lms.some(L=>Math.abs(L.x-x)<CH/2+L.R&&Math.abs(L.y-y)<CH/2+L.R);
      if(r>WR-CH*.2&&r<WR+CH*.3){add('bord du monde',cx,cy);continue;}
      if(lm){add('monument '+b,cx,cy);continue;}
      if(mix.length===2&&mix.some(q=>q.b==='sea')&&mix[1].w>.3)add('cotier '+mix.map(q=>q.b).join('/'),cx,cy);
      else if(mix.length===2&&mix.some(q=>q.b==='urban')&&mix[1].w>.3)add('lisiere ville '+mix.map(q=>q.b).join('/'),cx,cy);
      else if(mix.length===1){let w=0;const i0=Math.floor((cx*CH-G0)/WC),j0=Math.floor((cy*CH-G0)/WC);for(let i=i0;i<i0+CH/WC;i++)for(let j=j0;j<j0+CH/WC;j++)w+=wallAt(i,j);
        if(w>=12)add('falaises '+b,cx,cy);else if(w===0)add('pur '+b,cx,cy);}}
    return Object.entries(cats).sort((a,b)=>a[0]<b[0]?-1:1);},
  /* SYNCHRONE : monde + choix + cuissons sur place, sans que la boucle du jeu puisse s'intercaler */
  here(seed){genWorld(seed);const dump=__dump(WD,'WD'),P=this.pick(),out=[];this.M={};
    for(const [cat,[cx,cy]] of P){const c=getChunk(cx,cy),cd=__dump(c,'C'),o=this.bakeHere(cx,cy),o2=this.bakeHere(cx,cy),h1=this.bakeHere(cx,cy,true),h2={d:o2.d};
      if(h1.type!=='HTMLCanvasElement'||o.type!=='OffscreenCanvas')throw new Error('surfaces inattendues : DOM '+h1.type+' / production '+o.type+' (la page doit cuire sur OffscreenCanvas)');
      this.M[cx+','+cy]={d:h1.d,o:o.d,cd};out.push({cat,cx,cy,sp:c.sp?c.sp.t||'oui':null,obs:c.obs.length,urb:c.obs.filter(q=>q.b==='urban').length,
        temoin:this.cmp(o.d,o2.d).n,clips:h1.clips,surf:this.cmp(h1.d,o.d).n});}
    this.D=dump;return {n:dump.length,chunks:out};},
  /* compare un worker (texte src, ou null = bakeWorker() de production) a ce que la page a cuit */
  async vs(src,seed,route){const w=this.wk(src),r={monde:null,chunks:{}};
    try{await w.ask({t:'monde',seed});
      if(route==='A'){const s=(await w.ask({t:'dump'})).s;r.monde=this.dcmp(this.D,s);}
      for(const k in this.M){const [cx,cy]=k.split(',').map(Number),m=this.M[k];
        if(route==='A'){const a=await w.ask({t:'px',cx,cy});const px=new Uint8ClampedArray(a.px);r.chunks[k]={pix:this.cmp(m.o,px),pixH:this.cmp(m.d,px),chunk:this.dcmp(m.cd,a.cd)};}
        else{const a=await w.ask({t:'cuis',cx,cy});const cv=document.createElement('canvas');cv.width=cv.height=CH;const g=cv.getContext('2d',{alpha:false});
          g.drawImage(a.bm,0,0);a.bm.close();const px=g.getImageData(0,0,CH,CH).data;r.chunks[k]={pix:this.cmp(m.o,px),pixH:this.cmp(m.d,px)};}}}
    finally{w.end();}return r;}};
/* ---------- VOIE BRANCHEE : streamWorld -> wkAsk -> worker -> wkRecv -> c.bake (ImageBitmap), sans raccourci ----------
   La boucle du jeu est suspendue (render neutralise) pour que la camera, STRM et l'eviction ne bougent qu'ici ;
   streamWorld est appele comme la boucle l'appelle, image apres image (setTimeout entre deux), avec un budget. */
__T.R0=render;
__T.cam=function(x,y){CAM.x=x;CAM.y=y;RZ=1;VL=x-560;VR=x+560;VT=y-560;VB=y+560;};
__T.razMonde=function(){for(const c of WD.chunks)if(c){if(isBm(c.bake))c.bake.close();c.bake=null;c.bk=null;c.wk=0;}WD.bakes.length=0;WD.pq=null;BPOOL.length=0;};
/* une passe de streaming, camera fixe, jusqu'a ce que la fenetre de streamWorld soit toute cuite. mode 'place' : WK=false
   (repli) ; mode 'worker' : le worker de production (WKW=true, wkOn()) ; autre : WKW tel quel. Rend l'ordre d'arrivee des chunks. */
__T.stream=async function(x,y,mode,budget){render=function(){};this.cam(x,y);STRM.x=x;STRM.y=y;STRM.vx=STRM.vy=0;this.razMonde();
  if(mode==='place'){WKW=false;if(WK)WK.w.terminate();WK=false;}else if(mode==='worker'){WKW=true;if(WK===false)WK=null;}
  const bs0=bakeStep;let nbs=0,nf=0,ncov=0,nvol=0,rafs=0,raf=true;bakeStep=function(c){nbs++;return bs0(c);};
  const tick=()=>{rafs++;if(raf)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  const t0=performance.now();let last=-1,stable=0;
  try{for(;;){this.cam(x,y);FRAME++;nf++;streamWorld(budget);if(!chunksCover())ncov++;if(WK&&WK.enc.length)nvol++;
      /* fini quand plus rien n'est en vol et que deux images de suite n'ont rien cuit */
      const n=WD.bakes.length;if(n===last&&!(WK&&WK.enc.length)&&!WD.chunks.some(c=>c&&c.bk))stable++;else stable=0;last=n;if(stable>=2)break;
      if(performance.now()-t0>90000)throw new Error('streaming : pas fini en 90 s ('+n+' chunks)');
      await new Promise(r=>setTimeout(r,mode==='place'?0:4));}}
  finally{bakeStep=bs0;raf=false;}
  const ord=WD.bakes.map(c=>c.cx+','+c.cy),bm=WD.bakes.filter(c=>isBm(c.bake)).length;
  return {ord,bm,nbs,nf,ncov,nvol,rafs,ms:performance.now()-t0,wk:!!WK};};
/* octets de chaque chunk recu, compares a la cuisson sur place de production (et, pour info, au canvas DOM d'avant) */
__T.octets=function(dom){const cs=WD.bakes.slice(),r=[];WD.bakes.length=0;const cv=document.createElement('canvas');cv.width=cv.height=CH;const g=cv.getContext('2d',{alpha:false});
  for(const c of cs){g.drawImage(c.bake,0,0);const got=g.getImageData(0,0,CH,CH).data,b=c.bake;
    const ref=this.bakeHere(c.cx,c.cy,dom);c.bake=b;r.push({k:c.cx+','+c.cy,n:this.cmp(ref.d,got).n});}WD.bakes.push(...cs);return r;};
/* eviction : les ImageBitmap sont fermes (width 0 apres close), aucun n'entre dans BPOOL */
__T.evict=function(){const bms=WD.bakes.map(c=>c.bake).filter(isBm);FRAME+=2;evictBakes(0);
  return {n:bms.length,fermes:bms.filter(b=>b.width===0).length,pool:BPOOL.filter(isBm).length,reste:WD.bakes.length};};
true`;

/* ---------- discrimination : workers volontairement faux ---------- */
function mutate(src, a, b) { const n = src.split(a).length - 1; if (n !== 1) throw new Error('mutation introuvable ou ambigue (' + n + ') : ' + a); return src.replace(a, b); }
const CONTROLES = [
  { nom: 'couleur decalee (GTEX.plains : rgba(150,230,160,.18) -> rgba(160,…))', f: s => mutate(s, "'rgba(150,230,160,.18)'", "'rgba(160,230,160,.18)'") },
  { nom: 'unite de BAKE_STEPS sautee (sentiers, BAKE_STEPS[4])', f: s => s + '\nBAKE_STEPS[4]=()=>{};' },
  { nom: 'graine de chunk changee (decor : WD.seed^0x5bd1e995 -> ^0x5bd1e996)', f: s => mutate(s, 'WD.seed^0x5bd1e995', 'WD.seed^0x5bd1e996') },
  { nom: 'graine du monde changee (worker recoit graine+1)', f: s => s, seed: 1 },
];

if (require.main !== module) { module.exports = { launch, DUMP_SRC, WK_EXT, PAGE_SRC }; return; }
(async () => {
  const html = path.join(ROOT, 'bulge.html');
  if (!fs.existsSync(html)) { console.error('bulge.html absent : lancer bash build.sh'); process.exit(1); }
  fs.mkdirSync('/root/shots', { recursive: true });
  const B = await launch();
  let ok = true;
  const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '  — ' + info : '')); };
  try {
    await B.nav('file://' + html);
    for (let i = 0; i < 120; i++) { await sleep(250); try { if (await B.ev("typeof bakeWorker==='function'&&!!document.getElementById('wk-src')&&document.readyState==='complete'")) break; } catch (e) { } }
    await B.ev(PAGE_SRC);
    console.log('Chromium ' + (GPU ? 'AVEC GPU' : 'sans GPU') + ', bulge.html en file://, graines ' + SEEDS.join(', '));
    check('bakeWorker() fournit un worker (bloc #wk-src present, OffscreenCanvas.transferToImageBitmap)', await B.ev('(()=>{const w=bakeWorker();if(w)w.terminate();return !!w;})()'));
    let totPix = 0, totChunks = 0, totDiff = 0, totH = 0, nH = 0, nClip = 0;
    for (const seed of SEEDS) {
      console.log('\n=== graine ' + seed);
      const H = await B.ev('__T.here(' + seed + ')');
      const A = await B.ev('__T.vs(__T.src()+' + JSON.stringify(WK_EXT) + ',' + seed + ",'A')");
      const P = await B.ev('__T.vs(null,' + seed + ",'B')");
      check('monde : genWorld(' + seed + ') page vs worker, ' + H.n + ' champs compares', A.monde.n === 0, A.monde.n ? A.monde.n + ' lignes differentes, premiere : ' + JSON.stringify(A.monde.first) : '0 ligne differente');
      console.log('  chunk (cx,cy)     categorie                              obs urb piece  temoin chunk  A=off B=off | clip() surface A=htm B=htm');
      for (const c of H.chunks) {
        const k = c.cx + ',' + c.cy, a = A.chunks[k], b = P.chunks[k];
        totChunks++; totPix += 2; totDiff += a.pix.n + b.pix.n; totH += a.pixH.n; if (a.pixH.n) nH++; if (c.clips) nClip++;
        /* identite du chemin worker (meme surface) + l'ecart au canvas actuel est EXACTEMENT l'ecart de surface,
           et il n'existe que dans les chunks qui ont appele clip() */
        const good = c.temoin === 0 && a.chunk.n === 0 && a.pix.n === 0 && b.pix.n === 0 && a.pixH.n === c.surf && b.pixH.n === c.surf && (c.clips > 0 || c.surf === 0);
        if (!good) ok = false;
        console.log('  ' + (good ? 'OK   ' : 'ECHEC') + ' ' + ('(' + k + ')').padEnd(10) + ' ' + c.cat.padEnd(38) + String(c.obs).padStart(3) + String(c.urb).padStart(4) + '  ' + String(c.sp || '-').padEnd(5) +
          String(c.temoin).padStart(6) + String(a.chunk.n).padStart(6) + String(a.pix.n).padStart(7) + String(b.pix.n).padStart(6) + ' |' +
          String(c.clips).padStart(7) + String(c.surf).padStart(8) + String(a.pixH.n).padStart(7) + String(b.pixH.n).padStart(6) +
          (a.pix.first ? '  1er ecart A ' + JSON.stringify(a.pix.first) : '') + (a.chunk.first ? '  chunk ' + JSON.stringify(a.chunk.first) : ''));
      }
    }
    console.log('\nWORKER = SUR PLACE (meme surface OffscreenCanvas) : ' + totChunks + ' chunks, ' + totPix + ' comparaisons de 1 048 576 octets : ' + totDiff + ' octet(s) different(s)');
    console.log('WORKER vs canvas ACTUEL (HTMLCanvasElement)      : ' + nH + '/' + totChunks + ' chunks differents, ' + totH + ' octets ; ' + nClip + ' chunks appellent clip()');

    console.log('\n=== VOIE BRANCHEE : streamWorld -> worker de production -> ImageBitmap, camera fixe, budget 6 ms');
    let vDiff = 0, vN = 0;
    for (const seed of SEEDS) {
      /* meme page, meme worker d'une graine a l'autre : la 2e graine passe par wkSync (regeneration, generation g) */
      await B.ev('genWorld(' + seed + ')');
      const pos = await B.ev('(()=>{const s=WD.sites.find(q=>q.t!=="plains")||WD.sites[0];return [Math.round(s.x),Math.round(s.y)];})()');
      const P0 = await B.ev('__T.stream(' + pos + ",'place',6)");
      const W0 = await B.ev('__T.stream(' + pos + ",'worker',6)");
      const oct = await B.ev('__T.octets()'), dom = await B.ev('(()=>{const r=__T.octets(true);return r;})()');
      const ev = await B.ev('__T.evict()');
      const nd = oct.filter(q => q.n).length; vDiff += oct.reduce((s, q) => s + q.n, 0); vN += oct.length;
      console.log('  graine ' + seed + ', camera (' + pos + ') — sur place : ' + P0.ord.length + ' chunks en ' + P0.nf + ' images, bakeStep x' + P0.nbs + ', sol de secours ' + P0.ncov + ' images');
      console.log('                        worker    : ' + W0.ord.length + ' chunks en ' + W0.nf + ' images, bakeStep x' + W0.nbs + ', sol de secours ' + W0.ncov + ' images, ' + W0.rafs + ' rAF pendant ' + W0.ms.toFixed(0) + ' ms');
      check('le worker est BRANCHE : chunks recus en ImageBitmap, aucun bakeStep sur le thread principal', W0.wk && W0.bm === W0.ord.length && W0.ord.length > 0 && W0.nbs === 0, W0.bm + '/' + W0.ord.length + ' ImageBitmap, bakeStep x' + W0.nbs);
      check('ordre de cuisson du worker = ordre de la cuisson sur place (priorite de streamWorld conservee)', JSON.stringify(W0.ord) === JSON.stringify(P0.ord), JSON.stringify(W0.ord.slice(0, 6)) + '…');
      check('chunk recu du worker = chunk cuit sur place (surface livree) : 0 octet', nd === 0 && oct.length === W0.ord.length, oct.length + ' chunks, ' + nd + ' differents, ' + oct.reduce((s, q) => s + q.n, 0) + ' octets');
      console.log('         pour info, contre le canvas DOM d\'avant cette passe : ' + dom.filter(q => q.n).length + '/' + dom.length + ' chunks differents, ' + dom.reduce((s, q) => s + q.n, 0) + ' octets sur ' + (dom.length * CHB) + ' (' + (100 * dom.reduce((s, q) => s + q.n, 0) / (dom.length * CHB)).toFixed(3) + ' %)');
      check('eviction : ImageBitmap fermes (close), aucun dans BPOOL', ev.n > 0 && ev.fermes === ev.n && ev.pool === 0 && ev.reste === 0, ev.fermes + '/' + ev.n + ' fermes, ' + ev.pool + ' dans BPOOL');
    }
    console.log('VOIE BRANCHEE = SUR PLACE : ' + vN + ' chunks recus du worker, ' + vDiff + ' octet(s) different(s)');

    console.log('\n=== discrimination de la voie branchee : chaque sabotage DOIT faire echouer une verification ci-dessus');
    {
      await B.ev('genWorld(' + SEEDS[0] + ')');
      const pos = await B.ev('(()=>{const s=WD.sites.find(q=>q.t!=="plains")||WD.sites[0];return [Math.round(s.x),Math.round(s.y)];})()');
      const W1 = await B.ev('(async()=>{const o=WKW;const r=await __T.stream(' + pos + ",'worker',6);WKW=o;return r;})()");
      const oct = await B.ev('__T.octets()');
      /* 1. la page remise sur le canvas DOM (la surface d'avant) : l'identite doit tomber */
      const s1 = await B.ev('(()=>{const m=mkBake;mkBake=()=>mkCanvas(CH,CH);try{return __T.octets();}finally{mkBake=m;}})()');
      const d1 = s1.filter(q => q.n).length;
      check('detecte : cuisson sur place remise sur canvas DOM (mkBake -> mkCanvas)', d1 > 0 && oct.every(q => !q.n), d1 + '/' + s1.length + ' chunks differents, ' + s1.reduce((s, q) => s + q.n, 0) + ' octets');
      await B.ev('__T.evict()');
      /* 2. le worker debranche (cuisson remise sur place) : la verification « branche » doit tomber */
      const s2 = await B.ev('(async()=>{WKW=false;WK&&WK.w&&WK.w.terminate();WK=null;return await __T.stream(' + pos + ",'tel-quel',6);})()");
      check('detecte : worker debranche (WKW=false => repli sur place)', !(s2.wk && s2.bm === s2.ord.length && s2.nbs === 0), 'ImageBitmap ' + s2.bm + '/' + s2.ord.length + ', bakeStep x' + s2.nbs);
      await B.ev('__T.evict();render=__T.R0;WK=null;');
    }

    console.log('\n=== cause, isolee sans le jeu : clip() sur HTMLCanvasElement vs OffscreenCanvas, dans la PAGE (pas de worker)');
    const cz = await B.ev(`(()=>{const run=cv=>{const g=cv.getContext('2d',{alpha:false});g.fillStyle='#42825e';g.fillRect(0,0,64,64);g.beginPath();g.arc(30.3,31.7,20.2,0,TAU);g.clip();g.fillStyle='#fff0c8';g.fillRect(0,0,64,64);return g.getImageData(0,0,64,64).data;};
      const h=document.createElement('canvas');h.width=h.height=64;const n=(cv,f)=>{const g=cv.getContext('2d',{alpha:false});g.fillStyle='#42825e';g.fillRect(0,0,64,64);f(g);return g.getImageData(0,0,64,64).data;};
      const fillArc=g=>{g.beginPath();g.arc(30.3,31.7,20.2,0,TAU);g.fillStyle='#fff0c8';g.fill();};
      const h2=document.createElement('canvas');h2.width=h2.height=64;
      return {clip:__T.cmp(run(h),run(new OffscreenCanvas(64,64))).n,fill:__T.cmp(n(h2,fillArc),n(new OffscreenCanvas(64,64),fillArc)).n};})()`);
    check('le meme arc rempli par fill() est identique sur les deux surfaces', cz.fill === 0, cz.fill + ' octets');
    check('le meme arc utilise en clip() DIFFERE entre les deux surfaces (cause de l\'ecart au canvas actuel)', cz.clip > 0, cz.clip + ' octets sur 16 384');

    console.log('\n=== discrimination (graine ' + SEEDS[0] + ') : chaque worker fausse DOIT etre detecte');
    await B.ev('__T.here(' + SEEDS[0] + ')');
    const src = await B.ev('__T.src()');
    for (const C of CONTROLES) {
      const bad = C.f(src) + WK_EXT;
      const r = await B.ev('__T.vs(' + JSON.stringify(bad) + ',' + (SEEDS[0] + (C.seed || 0)) + ",'A')");
      const ks = Object.keys(r.chunks), diff = ks.filter(k => r.chunks[k].pix.n !== 0);
      const oct = diff.reduce((s, k) => s + r.chunks[k].pix.n, 0);
      check('detecte : ' + C.nom, diff.length > 0 || r.monde.n > 0,
        diff.length + '/' + ks.length + ' chunks differents (' + oct + ' octets), monde : ' + r.monde.n + ' lignes differentes');
    }
  } catch (e) { ok = false; console.log('  ECHEC exception : ' + (e && e.stack || e)); }
  finally { B.close(); }
  console.log('\nNON COUVERT : un vrai telephone / un vrai GPU ; les graines non listees ; les chunks hors des fenetres testees ;');
  console.log('  la voie branchee est pilotee camera FIXE (streamWorld appele comme la boucle l\'appelle, pas la boucle frame()) ;');
  console.log('  les sprites d\'obstacles (obsSprite) restent cuits sur le thread principal. Les performances : bulge-verif/');
  console.log('  (perf-run.js etc.), pas ce test. La page cuit desormais sur OffscreenCanvas : l\'ecart au canvas DOM d\'AVANT');
  console.log('  cette passe (bords clippes) est chiffre ci-dessus et assume ; test/art.js compare des operations, il ne le voit pas.');
  console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
  process.exit(ok ? 0 : 1);
})();
