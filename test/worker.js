'use strict';
/* =========================================================
   SOCLE DU WORKER DE CUISSON — un chunk cuit DANS UN WORKER est-il identique AU PIXEL au meme chunk
   cuit SUR PLACE ? Et l'ilot regenere dans le worker depuis la graine et le numero d'ilot est-il le MEME ilot,
   relique comprise ?

   Ce test ne peut pas tourner sous `vm` (pas de rasterisation, pas de Worker) : il pilote un VRAI
   Chromium par CDP, sur le vrai bulge.html ouvert en file:// (comme un joueur).

   node test/worker.js                 parties 12345 et 777, les 8 ilots, Chromium sans GPU
   node test/worker.js --gpu           idem, Chromium avec son GPU (ici probablement logiciel)
   node test/worker.js --graines=1,2,3 --ilots=1,2
   Code de sortie : 0 si tout passe, 1 sinon.
   CHROMIUM : $BULGE_CHROMIUM, sinon `chromium` (le snap du serveur : son /tmp est prive, d'ou le profil sous
   /root/shots), et si `chromium` est introuvable (ENOENT) le Chromium de Playwright (/opt/pw-browsers/chromium-*).
   BRANCHEMENT : lance par `node test/navigateur.js` (la porte « vrai navigateur »), PAS par test/headless.js —
   la raison est ecrite en tete de test/navigateur.js ; headless.js affiche « NON EXERCE ICI » pour le rappeler.

   (Surfaces : la page cuit sur OffscreenCanvas depuis la passe d'integration, comme le worker ; « DOM » = la surface d'avant.)
   RESULTAT CONNU : a surface egale (OffscreenCanvas des deux cotes) le worker est identique a l'octet ; contre
   le canvas actuel (HTMLCanvasElement) il ne l'est PAS, a cause de clip() (verifie au point 5).
     0. RELIQUE REELLE — un VRAI passage d'ilot dans la page (partie lancee par startGame, ilot 1 nettoye par islClear,
                  la boucle du jeu fait transStart -> updTrans -> trSnap -> genIslet) : la relique de l'ilot 2 est la
                  copie d'ecran (RELSNAP). Le worker la recoit en pixels ({monde ... rs:relData()}, comme wkSync) :
                  ilot (WD) champ par champ, les QUATRE chunks du centre (la relique) au pixel, par les voies A et B
                  ci-dessous et par la voie branchee ; temoin : le meme worker SANS les pixels (rs:null, il retombe sur
                  la miniature calculee) DOIT differer.
     Pour chaque partie et chaque ilot k (genIslet(graine,k)) :
     1. ILOT    — dans la page et dans le worker ; WD parcouru champ par champ (nombres a pleine precision, tableaux
                  types, Map, et canevas WD.map/mini/relic par empreinte de leurs OCTETS) ; listes identiques ligne a ligne.
     2. CHUNKS  — chunks choisis pour passer par des branches differentes de BAKE_STEPS : relique (ilots >= 2),
                  falaises, sans falaise, bord de l'ilot, hors de l'ilot ; le biome est celui de l'ilot (8 ilots = 8 biomes).
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
     4. DISCRIMINATION — le meme protocole avec un worker volontairement fausse doit ECHOUER, chacun sur un ilot ou
                  il mord : couleur decalee (texture des plaines, ilot 1), unite de BAKE_STEPS sautee (relique, ilot 2 ;
                  decor, ilot 2), graine de chunk changee (generateur du decor), graine de partie changee, numero d'ilot change.
   Criteres abandonnes avec le monde continu (genWorld) : les categories « cotier », « lisiere de ville » et
   « monument » (un seul biome par ilot, WD.lms vide), la carte de brouillard WD.fog (n'existe plus).
   ========================================================= */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.BULGE_ROOT || path.resolve(__dirname, '..');  /* BULGE_ROOT : juger le bulge.html d'une copie (test/lib.js) */
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const GPU = !!ARG('gpu');
const SEEDS = (ARG('graines') || '12345,777').split(',').map(Number);
const ILOTS = (ARG('ilots') || '1,2,3,4,5,6,7,8').split(',').map(Number);
const CHB = 512 * 512 * 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- quel Chromium : $BULGE_CHROMIUM, sinon `chromium` (snap du serveur), sinon celui de Playwright ---------- */
let BIN = null;
function chromeBin() {
  if (BIN) return BIN;
  if (process.env.BULGE_CHROMIUM) return (BIN = process.env.BULGE_CHROMIUM);
  const r = spawnSync('chromium', ['--version'], { encoding: 'utf8' });
  if (r.error && r.error.code === 'ENOENT') {
    const base = '/opt/pw-browsers', vs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]) : [];
    for (const d of vs) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return (BIN = p); }
  }
  return (BIN = 'chromium');
}

/* ---------- client CDP minimal (aucune dependance) ---------- */
async function launch() {
  const port = 9700 + Math.floor(Math.random() * 200);
  /* profil hors de /tmp : le /tmp du snap chromium est prive (CLAUDE.md) */
  fs.mkdirSync('/root/shots', { recursive: true });
  const dir = '/root/shots/wk-' + port + '-' + Date.now();
  const flags = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=390,780', 'about:blank'];
  if (!GPU) flags.splice(2, 0, '--disable-gpu');
  const chrome = spawn(chromeBin(), flags, { stdio: 'ignore' });
  let err = null; chrome.on('error', e => { err = e; });
  /* profil efface a la fermeture : les processus enfants d'un Chromium tue (SIGKILL) ecrivent encore quelques ms, et un
     seul rmSync laissait des profils dans /root/shots — on re-essaie ~1 s, jusqu'a ce que le dossier reste absent */
  let fini = false; const rmProfil = () => { if (fini) return; fini = true; const Z = new Int32Array(new SharedArrayBuffer(4));
    for (let i = 0; i < 20; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } Atomics.wait(Z, 0, 0, 50); if (!fs.existsSync(dir)) return; } };
  /* un test qui meurt en route (exception, tube ferme par `| head`) ne laisse pas un Chromium orphelin, ni son profil */
  process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch (e) { } rmProfil(); });
  let ver = null;
  for (let i = 0; i < 80 && !ver && !err; i++) { await sleep(250); try { ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); } catch (e) { } }
  if (!ver) { try { chrome.kill('SIGKILL'); } catch (e) { } rmProfil(); throw new Error(chromeBin() + ' : ' + (err ? 'ne demarre pas (' + err.code + ')' : 'port de debogage muet')); }
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
  return { ev, nav, cdp: (m, p) => send(m, p, S), send, close: () => { try { ws.close(); } catch (e) { } try { chrome.kill('SIGKILL'); } catch (e) { } rmProfil(); } };
}

/* ---------- entrer en partie dans la page (startGame), choix d'arrivee pris, bulle invulnerable ----------
   A rappeler jusqu'a `true` (le choix s'ouvre ~20 images apres le debut de l'ilot : G.pickIsl===G.isl une fois pris).
   Partage par navigateur.js, sol.js, pire-navigateur.js : sans le choix pris, l'ecran est FIGE (render ne dessine rien
   en etat « pick », g3.js) ; sans invulnerabilite, une vague peut finir la partie pendant la mesure (etat « end », fige aussi). */
const START = (pre) => `(()=>{${pre || ''}try{if(!G||G.state==='end')startGame();if(G&&G.state==='pick')pickCard(0);if(G&&G.p)G.p.inv=Math.max(G.p.inv,1e9);}catch(e){}return !!G&&G.state==='play'&&G.pickIsl===G.isl;})()`;

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
    if(isCtx(v)){out.push(p+'=ctx2d('+(v.canvas===root.map?'map':v.canvas===root.mini?'mini':'?')+')');return;}
    if(ArrayBuffer.isView(v)){out.push(p+'='+v.constructor.name+'#'+v.length+' fnv='+__fnv(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)));return;}
    if(v instanceof Map){out.push(p+'=Map#'+v.size);for(const [k,x] of v)walk(x,p+'<'+String(k)+'>');return;}
    if(v instanceof Set){out.push(p+'=Set#'+v.size);let i=0;for(const x of v)walk(x,p+'{'+(i++)+'}');return;}
    if(Array.isArray(v)){out.push(p+'=Array#'+v.length);for(let i=0;i<v.length;i++)if(i in v)walk(v[i],p+'['+i+']');return;}
    const ks=Object.keys(v);out.push(p+'={'+ks.join(',')+'}');for(const k of ks)walk(v[k],p+'.'+k);};
  walk(root,name);return out;}`;

/* extension de TEST du worker (jamais dans bulge.html) : ajoutee au texte de #wk-src, elle garde le
   protocole de production (gk.js) et ajoute 'dump' (etat de l'ilot) et 'px' (chunk + octets bruts). */
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
  /* le chunk touche-t-il la relique (meme rectangle que drawRelic, gw2.js) */
  rel(cx,cy){return !!WD.relic&&!(cx*CH>RELR+20||cx*CH+CH<-RELR-20||cy*CH>RELR+20||cy*CH+CH<-RELR-20);},
  /* choisit des chunks qui passent par des branches differentes de BAKE_STEPS ; tous=true : les quatre chunks de la relique */
  pick(tous){const cats={},add=(k,cx,cy)=>{if(!cats[k])cats[k]=[cx,cy];};
    for(let cx=-COFF;cx<NC-COFF;cx++)for(let cy=-COFF;cy<NC-COFF;cy++){const x=cx*CH+CH/2,y=cy*CH+CH/2,r=Math.hypot(x,y);
      if(this.rel(cx,cy)){add(tous?'relique '+cx+','+cy:'relique',cx,cy);continue;}
      if(tous)continue;
      if(r>WR+CH){add('hors de l\\'ilot',cx,cy);continue;}
      if(r>WR-CH*.2){add('bord de l\\'ilot',cx,cy);continue;}
      let w=0;const i0=Math.round((cx*CH-G0)/WC),j0=Math.round((cy*CH-G0)/WC);for(let i=i0;i<i0+CH/WC;i++)for(let j=j0;j<j0+CH/WC;j++)w+=wallAt(i,j);
      if(w>=12)add('falaises',cx,cy);else if(w===0)add('sans falaise',cx,cy);}
    return Object.entries(cats).sort((a,b)=>a[0]<b[0]?-1:1);},
  /* SYNCHRONE : ilot + choix + cuissons sur place, sans que la boucle du jeu puisse s'intercaler */
  here(seed,k,tous){genIslet(seed,k);const dump=__dump(WD,'WD'),P=this.pick(tous),out=[];this.M={};
    for(const [cat,[cx,cy]] of P){const c=getChunk(cx,cy),cd=__dump(c,'C'),o=this.bakeHere(cx,cy),o2=this.bakeHere(cx,cy),h1=this.bakeHere(cx,cy,true);
      if(h1.type!=='HTMLCanvasElement'||o.type!=='OffscreenCanvas')throw new Error('surfaces inattendues : DOM '+h1.type+' / production '+o.type+' (la page doit cuire sur OffscreenCanvas)');
      this.M[cx+','+cy]={d:h1.d,o:o.d,cd};out.push({cat,cx,cy,sp:c.sp?c.sp.t||'oui':null,obs:c.obs.length,urb:c.obs.filter(q=>q.b==='urban').length,
        temoin:this.cmp(o.d,o2.d).n,clips:h1.clips,surf:this.cmp(h1.d,o.d).n});}
    this.D=dump;return {n:dump.length,b:WD.sites[0].t,rel:WD.relic?(WD.relic===(typeof RELSNAP!=='undefined'&&RELSNAP&&RELSNAP.img)?'copie d\\'ecran':'miniature'):'aucune',chunks:out};},
  /* compare un worker (texte src, ou null = bakeWorker() de production) a ce que la page a cuit. o.k : ilot ;
     o.rs : true = les pixels de la copie d'ecran (relData(), comme wkSync), sinon null */
  async vs(src,seed,route,o){const w=this.wk(src),r={monde:null,chunks:{}};
    try{await w.ask({t:'monde',seed,k:o.k,g:1,rs:o.rs?relData():null});
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
/* Toute la grille de l'ilot est GENEREE d'avance (genChunk, pas la cuisson) : streamWorld borne la generation (GENK par image,
   la seconde au budget, donc a l'horloge) ; sans cela la premiere passe generait ce que la seconde trouvait deja fait, et
   l'ordre de cuisson sur place dependait de la charge de la machine (vu : 1 fois sur 6, ilot 6 de la partie 777). */
__T.stream=async function(x,y,mode,budget){render=function(){};this.cam(x,y);STRM.x=x;STRM.y=y;STRM.vx=STRM.vy=0;this.razMonde();
  for(let cx=-COFF;cx<NC-COFF;cx++)for(let cy=-COFF;cy<NC-COFF;cy++)getChunk(cx,cy);
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
  return {ord,bm,nbs,nf,ncov,nvol,rafs,ms:performance.now()-t0,wk:!!WK,rs:!!(WK&&WK.wd===WD&&relData())};};
/* octets de chaque chunk recu, compares a la cuisson sur place de production (et, pour info, au canvas DOM d'avant) */
__T.octets=function(dom){const cs=WD.bakes.slice(),r=[];WD.bakes.length=0;const cv=document.createElement('canvas');cv.width=cv.height=CH;const g=cv.getContext('2d',{alpha:false});
  for(const c of cs){g.drawImage(c.bake,0,0);const got=g.getImageData(0,0,CH,CH).data,b=c.bake;
    const ref=this.bakeHere(c.cx,c.cy,dom);c.bake=b;r.push({k:c.cx+','+c.cy,n:this.cmp(ref.d,got).n,rel:this.rel(c.cx,c.cy)});}WD.bakes.push(...cs);return r;};
/* eviction : les ImageBitmap sont fermes (width 0 apres close), aucun n'entre dans BPOOL */
__T.evict=function(){const bms=WD.bakes.map(c=>c.bake).filter(isBm);FRAME+=2;evictBakes(0);
  return {n:bms.length,fermes:bms.filter(b=>b.width===0).length,pool:BPOOL.filter(isBm).length,reste:WD.bakes.length};};
true`;

/* ---------- discrimination : workers volontairement faux, chacun sur un ilot ou il mord ---------- */
function mutate(src, a, b) { const n = src.split(a).length - 1; if (n !== 1) throw new Error('mutation introuvable ou ambigue (' + n + ') : ' + a); return src.replace(a, b); }
const CONTROLES = [
  { nom: 'couleur decalee (GTEX.plains : rgba(150,230,160,.18) -> rgba(160,…)), ilot 1', k: 1, f: s => mutate(s, "'rgba(150,230,160,.18)'", "'rgba(160,230,160,.18)'") },
  { nom: 'unite de BAKE_STEPS sautee (relique, BAKE_STEPS[4] : drawRelic), ilot 2', k: 2, f: s => mutate(s, '(g,c,k)=>{drawRelic(g,c);}', '(g,c,k)=>{}') },
  { nom: 'unite de BAKE_STEPS sautee (decor, BAKE_STEPS[6]), ilot 2', k: 2, f: s => s + '\nBAKE_STEPS[6]=()=>{};' },
  { nom: 'graine de chunk changee (decor : WD.seed^0x5bd1e995 -> ^0x5bd1e996), ilot 2', k: 2, f: s => mutate(s, 'WD.seed^0x5bd1e995', 'WD.seed^0x5bd1e996') },
  { nom: 'graine de partie changee (worker recoit graine+1), ilot 2', k: 2, f: s => s, seed: 1 },
  { nom: 'numero d\'ilot change (worker recoit k+1), ilot 2', k: 2, f: s => s, dk: 1 },
];

if (require.main !== module) { module.exports = { launch, chromeBin, START, DUMP_SRC, WK_EXT, PAGE_SRC }; return; }
(async () => {
  const html = path.join(ROOT, 'bulge.html');
  if (!fs.existsSync(html)) { console.error('bulge.html absent : lancer bash build.sh'); process.exit(1); }
  const B = await launch();
  let ok = true;
  const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '  — ' + info : '')); };
  let totPix = 0, totChunks = 0, totDiff = 0, totH = 0, nH = 0, nClip = 0;
  /* un tableau de chunks (voies A et B) ; renvoie le nombre de chunks faux */
  const table = (H, A, P) => {
    let bad = 0;
    console.log('  chunk (cx,cy)     categorie            obs urb piece  temoin chunk  A=off B=off | clip() surface A=htm B=htm');
    for (const c of H.chunks) {
      const k = c.cx + ',' + c.cy, a = A.chunks[k], b = P.chunks[k];
      totChunks++; totPix += 2; totDiff += a.pix.n + b.pix.n; totH += a.pixH.n; if (a.pixH.n) nH++; if (c.clips) nClip++;
      /* identite du chemin worker (meme surface) + l'ecart au canvas actuel est EXACTEMENT l'ecart de surface,
         et il n'existe que dans les chunks qui ont appele clip() */
      const good = c.temoin === 0 && a.chunk.n === 0 && a.pix.n === 0 && b.pix.n === 0 && a.pixH.n === c.surf && b.pixH.n === c.surf && (c.clips > 0 || c.surf === 0);
      if (!good) { ok = false; bad++; }
      console.log('  ' + (good ? 'OK   ' : 'ECHEC') + ' ' + ('(' + k + ')').padEnd(10) + ' ' + c.cat.padEnd(20) + String(c.obs).padStart(3) + String(c.urb).padStart(4) + '  ' + String(c.sp || '-').padEnd(5) +
        String(c.temoin).padStart(6) + String(a.chunk.n).padStart(6) + String(a.pix.n).padStart(7) + String(b.pix.n).padStart(6) + ' |' +
        String(c.clips).padStart(7) + String(c.surf).padStart(8) + String(a.pixH.n).padStart(7) + String(b.pixH.n).padStart(6) +
        (a.pix.first ? '  1er ecart A ' + JSON.stringify(a.pix.first) : '') + (a.chunk.first ? '  chunk ' + JSON.stringify(a.chunk.first) : ''));
    }
    return bad;
  };
  try {
    await B.nav('file://' + html);
    for (let i = 0; i < 120; i++) { await sleep(250); try { if (await B.ev("typeof bakeWorker==='function'&&typeof startGame==='function'&&!!document.getElementById('wk-src')&&document.readyState==='complete'")) break; } catch (e) { } }
    await B.ev(PAGE_SRC);
    console.log(chromeBin() + ' ' + (GPU ? 'AVEC GPU' : 'sans GPU') + ', bulge.html en file://, parties ' + SEEDS.join(', ') + ', ilots ' + ILOTS.join(','));
    check('bakeWorker() fournit un worker (bloc #wk-src present, OffscreenCanvas.transferToImageBitmap)', await B.ev('(()=>{const w=bakeWorker();if(w)w.terminate();return !!w;})()'));

    console.log('\n=== 0. RELIQUE REELLE : un vrai passage d\'ilot dans la page, puis worker = sur place sur la relique (copie d\'ecran)');
    {
      let st = null;
      /* partie de graine connue : newRun reprend l'ilot 1 deja genere s'il n'a pas servi (g2.js) */
      for (let i = 0; i < 60; i++) { if ((st = await B.ev(START('if(!G&&!window.__S0){window.__S0=1;genIslet(' + SEEDS[0] + ',1);WD.used=false;}'))) === true) break; await sleep(250); }
      check('partie lancee (startGame, choix d\'arrivee pris) : ilot 1 en jeu', st === true, await B.ev('G?G.state+" ilot "+G.isl:"G null"'));
      await sleep(1500);
      /* ilot 1 nettoye : la boucle du jeu fera clearTick -> transStart -> updTrans -> trSnap -> genIslet(seed,2) */
      const f0 = await B.ev('(()=>{islClear();G.phT=170;G.p.inv=1e9;window.__F0=FRAME;return FRAME;})()');
      let tr = null;
      for (let i = 0; i < 120; i++) { await sleep(250);
        tr = await B.ev('(()=>{if(G.state==="pick")pickCard(0);return {st:G.state,isl:G.isl,snap:!!RELSNAP&&RELSNAP.run===G.seed&&RELSNAP.k===2,rel:WD.relic===(RELSNAP&&RELSNAP.img),wd:WD.isl,f:FRAME-window.__F0,seed:G.seed};})()');
        if (tr.isl === 2 && tr.snap && tr.st !== 'trans') break; }
      /* la page s'arrete ici : plus de simulation ni de cuisson par la boucle, WD n'est touche que par le test */
      await B.ev('(()=>{G.state="pause";return 1;})()');
      const snapInfo = await B.ev(`(()=>{const c=RELSNAP.img,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,s=new Set();for(let i=0;i<d.length;i+=4*7)s.add(d[i]<<16|d[i+1]<<8|d[i+2]);return {w:c.width,h:c.height,type:c.constructor.name,couleurs:s.size};})()`);
      check('passage fait par la boucle du jeu : ilot 2, sa relique est la copie d\'ecran RELSNAP (trSnap)', tr && tr.isl === 2 && tr.wd === 2 && tr.snap && tr.rel && snapInfo.couleurs > 50,
        tr ? 'etat ' + tr.st + ', ilot ' + tr.isl + ' apres ' + tr.f + ' images ; RELSNAP ' + snapInfo.w + 'x' + snapInfo.h + ' (' + snapInfo.type + ', ' + snapInfo.couleurs + ' couleurs echantillonnees), relique = copie : ' + tr.rel : 'pas de passage');
      const seed = tr.seed;
      const H = await B.ev('__T.here(' + seed + ',2,true)');
      const A = await B.ev('__T.vs(__T.src()+' + JSON.stringify(WK_EXT) + ',' + seed + ",'A',{k:2,rs:true})");
      const P = await B.ev('__T.vs(null,' + seed + ",'B',{k:2,rs:true})");
      check('ilot 2 de la partie ' + seed + ' (relique : ' + H.rel + ') : page vs worker qui a recu la copie, ' + H.n + ' champs compares', H.rel === 'copie d\'ecran' && A.monde.n === 0, A.monde.n ? A.monde.n + ' lignes differentes, premiere : ' + JSON.stringify(A.monde.first) : '0 ligne differente');
      const bad = table(H, A, P);
      check('les quatre chunks de la relique (copie d\'ecran) : worker = sur place, voies A et B', H.chunks.length === 4 && bad === 0, H.chunks.length + ' chunks, ' + bad + ' faux');
      const T = await B.ev('__T.vs(__T.src()+' + JSON.stringify(WK_EXT) + ',' + seed + ",'A',{k:2,rs:false})");
      const td = Object.keys(T.chunks).filter(k => T.chunks[k].pix.n);
      check('temoin : le worker SANS les pixels (rs:null : miniature calculee) differe sur la relique', td.length === 4 && T.monde.n > 0, td.length + '/4 chunks differents (' + td.reduce((s, k) => s + T.chunks[k].pix.n, 0) + ' octets), ilot : ' + T.monde.n + ' lignes differentes ' + JSON.stringify(T.monde.first || '').slice(0, 120));
      /* voie branchee : wkSync envoie lui-meme relData() */
      const W0 = await B.ev("__T.stream(0,0,'worker',6)");
      const oct = await B.ev('__T.octets()'), orl = oct.filter(q => q.rel), nd = oct.filter(q => q.n).length;
      check('voie branchee (streamWorld -> wkSync -> rs:relData()) : chunks recus = cuits sur place, relique comprise', W0.wk && W0.rs && W0.bm === W0.ord.length && W0.nbs === 0 && nd === 0 && orl.length === 4,
        W0.bm + '/' + W0.ord.length + ' ImageBitmap, bakeStep x' + W0.nbs + ', rs envoye : ' + W0.rs + ' ; ' + oct.length + ' chunks dont ' + orl.length + ' de la relique, ' + nd + ' differents (' + oct.reduce((s, q) => s + q.n, 0) + ' octets)');
      /* la copie d'ecran a servi : sans cela, l'ilot 2 de cette partie la reprendrait plus bas (genIslet la voit encore),
         et la section suivante, qui juge la miniature CALCULEE, comparerait une page a copie et un worker sans */
      await B.ev('(()=>{__T.evict();RELSNAP=null;return 1;})()');
    }

    for (const seed of SEEDS) for (const k of ILOTS) {
      const H = await B.ev('__T.here(' + seed + ',' + k + ')');
      console.log('\n=== partie ' + seed + ', ilot ' + k + ' (' + H.b + ', relique : ' + H.rel + ')');
      const A = await B.ev('__T.vs(__T.src()+' + JSON.stringify(WK_EXT) + ',' + seed + ",'A',{k:" + k + '})');
      const P = await B.ev('__T.vs(null,' + seed + ",'B',{k:" + k + '})');
      check('ilot : genIslet(' + seed + ',' + k + ') page vs worker, ' + H.n + ' champs compares', A.monde.n === 0, A.monde.n ? A.monde.n + ' lignes differentes, premiere : ' + JSON.stringify(A.monde.first) : '0 ligne differente');
      table(H, A, P);
      if (k >= 2) check('la relique (miniature calculee de l\'ilot ' + (k - 1) + ') est couverte : un chunk sous la relique compare', H.rel === 'miniature' && H.chunks.some(c => c.cat === 'relique'), 'relique : ' + H.rel + ' ; ' + H.chunks.map(c => c.cat).join(', '));
    }
    console.log('\nWORKER = SUR PLACE (meme surface OffscreenCanvas) : ' + totChunks + ' chunks, ' + totPix + ' comparaisons de 1 048 576 octets : ' + totDiff + ' octet(s) different(s)');
    console.log('WORKER vs canvas ACTUEL (HTMLCanvasElement)      : ' + nH + '/' + totChunks + ' chunks differents, ' + totH + ' octets ; ' + nClip + ' chunks appellent clip()');

    console.log('\n=== VOIE BRANCHEE : streamWorld -> worker de production -> ImageBitmap, camera fixe au centre de l\'ilot, budget 6 ms');
    let vDiff = 0, vN = 0;
    const VOIE = [[SEEDS[0], 2], [SEEDS[1 % SEEDS.length], 6]];
    for (const [seed, k] of VOIE) {
      /* meme page, meme worker d'un ilot a l'autre : le second passe par wkSync (regeneration, generation g) */
      await B.ev('genIslet(' + seed + ',' + k + ')');
      const P0 = await B.ev("__T.stream(0,0,'place',6)");
      const W0 = await B.ev("__T.stream(0,0,'worker',6)");
      const oct = await B.ev('__T.octets()'), dom = await B.ev('(()=>{const r=__T.octets(true);return r;})()');
      const ev = await B.ev('__T.evict()');
      const nd = oct.filter(q => q.n).length; vDiff += oct.reduce((s, q) => s + q.n, 0); vN += oct.length;
      console.log('  partie ' + seed + ' ilot ' + k + ', camera (0,0) — sur place : ' + P0.ord.length + ' chunks en ' + P0.nf + ' images, bakeStep x' + P0.nbs + ', sol de secours ' + P0.ncov + ' images');
      console.log('                        worker    : ' + W0.ord.length + ' chunks en ' + W0.nf + ' images, bakeStep x' + W0.nbs + ', sol de secours ' + W0.ncov + ' images, ' + W0.rafs + ' rAF pendant ' + W0.ms.toFixed(0) + ' ms');
      check('le worker est BRANCHE : chunks recus en ImageBitmap, aucun bakeStep sur le thread principal', W0.wk && W0.bm === W0.ord.length && W0.ord.length > 0 && W0.nbs === 0, W0.bm + '/' + W0.ord.length + ' ImageBitmap, bakeStep x' + W0.nbs);
      const io = W0.ord.findIndex((q, i) => q !== P0.ord[i]);
      check('ordre de cuisson du worker = ordre de la cuisson sur place (priorite de streamWorld conservee)', JSON.stringify(W0.ord) === JSON.stringify(P0.ord), io < 0 && W0.ord.length === P0.ord.length ? JSON.stringify(W0.ord.slice(0, 6)) + '…'
        : 'premier ecart au rang ' + io + ' : worker ' + JSON.stringify(W0.ord.slice(Math.max(0, io - 2), io + 4)) + ' / sur place ' + JSON.stringify(P0.ord.slice(Math.max(0, io - 2), io + 4)) + ' (' + W0.ord.length + '/' + P0.ord.length + ' chunks)');
      check('chunk recu du worker = chunk cuit sur place (surface livree) : 0 octet', nd === 0 && oct.length === W0.ord.length, oct.length + ' chunks (' + oct.filter(q => q.rel).length + ' sous la relique), ' + nd + ' differents, ' + oct.reduce((s, q) => s + q.n, 0) + ' octets');
      console.log('         pour info, contre le canvas DOM d\'avant cette passe : ' + dom.filter(q => q.n).length + '/' + dom.length + ' chunks differents, ' + dom.reduce((s, q) => s + q.n, 0) + ' octets sur ' + (dom.length * CHB) + ' (' + (100 * dom.reduce((s, q) => s + q.n, 0) / (dom.length * CHB)).toFixed(3) + ' %)');
      check('eviction : ImageBitmap fermes (close), aucun dans BPOOL', ev.n > 0 && ev.fermes === ev.n && ev.pool === 0 && ev.reste === 0, ev.fermes + '/' + ev.n + ' fermes, ' + ev.pool + ' dans BPOOL');
    }
    console.log('VOIE BRANCHEE = SUR PLACE : ' + vN + ' chunks recus du worker, ' + vDiff + ' octet(s) different(s)');

    console.log('\n=== discrimination de la voie branchee : chaque sabotage DOIT faire echouer une verification ci-dessus');
    {
      await B.ev('genIslet(' + SEEDS[0] + ',2)');
      const W1 = await B.ev("(async()=>{const o=WKW;const r=await __T.stream(0,0,'worker',6);WKW=o;return r;})()");
      const oct = await B.ev('__T.octets()');
      /* 1. la page remise sur le canvas DOM (la surface d'avant) : l'identite doit tomber */
      const s1 = await B.ev('(()=>{const m=mkBake;mkBake=()=>mkCanvas(CH,CH);try{return __T.octets();}finally{mkBake=m;}})()');
      const d1 = s1.filter(q => q.n).length;
      check('detecte : cuisson sur place remise sur canvas DOM (mkBake -> mkCanvas)', W1.ord.length > 0 && d1 > 0 && oct.every(q => !q.n), d1 + '/' + s1.length + ' chunks differents, ' + s1.reduce((s, q) => s + q.n, 0) + ' octets');
      await B.ev('__T.evict()');
      /* 2. le worker debranche (cuisson remise sur place) : la verification « branche » doit tomber */
      const s2 = await B.ev("(async()=>{WKW=false;WK&&WK.w&&WK.w.terminate();WK=null;return await __T.stream(0,0,'tel-quel',6);})()");
      check('detecte : worker debranche (WKW=false => repli sur place)', !(s2.wk && s2.bm === s2.ord.length && s2.nbs === 0), 'ImageBitmap ' + s2.bm + '/' + s2.ord.length + ', bakeStep x' + s2.nbs);
      await B.ev('__T.evict();render=__T.R0;WKW=true;WK=null;');
    }

    console.log('\n=== cause, isolee sans le jeu : clip() sur HTMLCanvasElement vs OffscreenCanvas, dans la PAGE (pas de worker)');
    const cz = await B.ev(`(()=>{const run=cv=>{const g=cv.getContext('2d',{alpha:false});g.fillStyle='#42825e';g.fillRect(0,0,64,64);g.beginPath();g.arc(30.3,31.7,20.2,0,TAU);g.clip();g.fillStyle='#fff0c8';g.fillRect(0,0,64,64);return g.getImageData(0,0,64,64).data;};
      const h=document.createElement('canvas');h.width=h.height=64;const n=(cv,f)=>{const g=cv.getContext('2d',{alpha:false});g.fillStyle='#42825e';g.fillRect(0,0,64,64);f(g);return g.getImageData(0,0,64,64).data;};
      const fillArc=g=>{g.beginPath();g.arc(30.3,31.7,20.2,0,TAU);g.fillStyle='#fff0c8';g.fill();};
      const h2=document.createElement('canvas');h2.width=h2.height=64;
      return {clip:__T.cmp(run(h),run(new OffscreenCanvas(64,64))).n,fill:__T.cmp(n(h2,fillArc),n(new OffscreenCanvas(64,64),fillArc)).n};})()`);
    check('le meme arc rempli par fill() est identique sur les deux surfaces', cz.fill === 0, cz.fill + ' octets');
    check('le meme arc utilise en clip() DIFFERE entre les deux surfaces (cause de l\'ecart au canvas actuel)', cz.clip > 0, cz.clip + ' octets sur 16 384');

    console.log('\n=== discrimination (partie ' + SEEDS[0] + ') : chaque worker fausse DOIT etre detecte');
    const src = await B.ev('__T.src()');
    let kh = -1;
    for (const C of CONTROLES) {
      if (kh !== C.k) { await B.ev('__T.here(' + SEEDS[0] + ',' + C.k + ')'); kh = C.k; }
      const bad = C.f(src) + WK_EXT;
      const r = await B.ev('__T.vs(' + JSON.stringify(bad) + ',' + (SEEDS[0] + (C.seed || 0)) + ",'A',{k:" + (C.k + (C.dk || 0)) + '})');
      const ks = Object.keys(r.chunks), diff = ks.filter(k => r.chunks[k].pix.n !== 0);
      const oct = diff.reduce((s, k) => s + r.chunks[k].pix.n, 0);
      check('detecte : ' + C.nom, diff.length > 0 || r.monde.n > 0,
        diff.length + '/' + ks.length + ' chunks differents (' + oct + ' octets), ilot : ' + r.monde.n + ' lignes differentes');
    }
  } catch (e) { ok = false; console.log('  ECHEC exception : ' + (e && e.stack || e)); }
  finally { B.close(); }
  console.log('\nNON COUVERT : un vrai telephone / un vrai GPU ; les graines non listees ; les chunks hors des categories testees ;');
  console.log('  la voie branchee est pilotee camera FIXE (streamWorld appele comme la boucle l\'appelle, pas la boucle frame()) ;');
  console.log('  les sprites d\'obstacles (obsSprite) restent cuits sur le thread principal. Les performances : bulge-verif/');
  console.log('  (perf-run.js etc.), pas ce test. La page cuit desormais sur OffscreenCanvas : l\'ecart au canvas DOM d\'AVANT');
  console.log('  cette passe (bords clippes) est chiffre ci-dessus et assume ; test/art.js compare des operations, il ne le voit pas.');
  console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
  process.exit(ok ? 0 : 1);
})();
