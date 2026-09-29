'use strict';
/* Mesure REELLE (chromium, CDP, emulation telephone tactile DPR 2,625) : le doigt touche-t-il ce qu'il vise ?
   1. Duel : pour chaque carte d'action, a TOUTES les positions de defilement, le centre visible de la carte
      (dans le rectangle non rogne par ses ancetres) renvoie cette carte par elementFromPoint — jamais « Fin du tour ».
      Les boutons Fuir / Fin du tour sont visibles sans defiler.
   2. Invite « Defier / Entrer » : la zone du pouce gauche (moitie gauche, tiers bas) renvoie le canvas ; un vrai appui
      tactile sur le TEXTE de l'invite pose le joystick (inp.L) ; son bouton marche encore.
   3. Fuir : ecart >= 48 px avec Fin du tour ; un premier appui tactile ne fait PAS fuir, un second (>= 350 ms) oui.
   Tailles : largeurs 411 et 320, hauteurs 846, 730 et 640 ; 1, 2 puis 3 ennemis.
   node test/tactile-ecran.js [--page=/chemin/bulge.html] [--ref=<commit>] [--port=9555]
   (outil de verification, pas appele par headless.js : il exige chromium) */
const path = require('path'), cp = require('child_process'), fs = require('fs');
const ARG = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
/* --ref=<commit> : joue la page DE CE COMMIT (l'artefact bulge.html est suivi par git, donc
   `git show <ref>:bulge.html` est exactement ce que ce commit servait). Sans cela, le temoin
   mesurait le meme fichier que le nouveau code : il ne pouvait pas echouer, et ne prouvait rien.
   Le fichier va dans /root/shots et NON dans /tmp : chromium est un snap, son /tmp est prive. */
const REF = ARG('ref');
const PAGE = (() => {
  if (!REF) return path.resolve(ARG('page') || path.join(__dirname, '..', 'bulge.html'));
  const dir = '/root/shots'; fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'ref-' + String(REF).replace(/[^\w.-]/g, '') + '.html');
  fs.writeFileSync(f, cp.execFileSync('git', ['show', REF + ':bulge.html'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }));
  return f;
})();
const GAP = 48;   /* px CSS : ≈ 7,5 mm sur S22 (1 px CSS = 2,625/425 po ≈ 0,157 mm), ≈ 2× l'erreur a 95 % d'un pouce */
const PORT = +(ARG('port') || 9555);
const WS = [411, 320], HS = [846, 730, 640];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (method, params) => new Promise((res, rej) => { const m = { id: ++id, method, params: params || {}, sessionId: SID }; pend.set(m.id, { res, rej }); ws.send(JSON.stringify(m)); });
let SID;
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: '(' + expr + ')', returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' : ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; }
async function touch(type, x, y) { await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }); }
async function tap(x, y) { await touch('touchStart', x, y); await sleep(60); await touch('touchEnd', x, y); await sleep(120); }

/* centre VISIBLE d'un element : son rectangle rogne par le viewport et par chaque ancetre qui rogne (overflow != visible) */
const VIS = `e=>{let r=e.getBoundingClientRect(),x0=Math.max(0,r.left),y0=Math.max(0,r.top),x1=Math.min(innerWidth,r.right),y1=Math.min(innerHeight,r.bottom);
  for(let a=e.parentElement;a;a=a.parentElement){const cs=getComputedStyle(a);if(cs.overflowY!=='visible'||cs.overflowX!=='visible'){const q=a.getBoundingClientRect();x0=Math.max(x0,q.left);y0=Math.max(y0,q.top);x1=Math.min(x1,q.right);y1=Math.min(y1,q.bottom);}}
  return x1-x0>4&&y1-y0>4?[(x0+x1)/2,(y0+y1)/2]:null;}`;
const nm = `e=>e?(e.id||(e.dataset&&e.dataset.a)||e.className||e.tagName):'rien'`;

async function duelCase(w, h, n) {
  await ev(`(()=>{G.state='play';DU=null;G.room=2;G.p.sk[1]={id:'arc',l:1,cd:0};duelStart(0);DU.foes.length=${n};DU.sel=0;
    for(let k=0;k<4;k++)duelLog('Le choc rebondit sur Drone (12). Tu te retranches : bouclier 30, +1 énergie au prochain tour.');renderDuel();return 1})()`);
  await sleep(650);   /* fin de l'animation d'entree */
  return ev(`(()=>{const VIS=${VIS},nm=${nm},bad=[];let cells=0;
    const cards=[...document.querySelectorAll('#dvAct .dact')],c0=cards[0];let sc=c0.parentElement;while(sc&&!(sc.scrollHeight>sc.clientHeight+1&&/auto|scroll/.test(getComputedStyle(sc).overflowY)))sc=sc.parentElement;
    const max=sc?sc.scrollHeight-sc.clientHeight:0;
    for(let t=0;t<=max+15;t+=15){if(sc)sc.scrollTop=Math.min(t,max);
      for(const c of cards){const p=VIS(c);if(!p)continue;cells++;const e=document.elementFromPoint(p[0],p[1]),b=e&&e.closest('button');
        if(b!==c)bad.push(c.dataset.a+'@'+Math.round(sc?sc.scrollTop:0)+'->'+nm(b||e));}}
    if(sc)sc.scrollTop=0;
    const E=$('dvEnd').getBoundingClientRect(),F=$('dvFlee').getBoundingClientRect();
    for(const [k,r] of [['dvEnd',E],['dvFlee',F]]){if(r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth)bad.push(k+' hors ecran');
      const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!e||e.closest('button')!==$(k))bad.push(k+' recouvert par '+nm(e));}
    const gx=Math.max(0,Math.max(E.left,F.left)-Math.min(E.right,F.right)),gy=Math.max(0,Math.max(E.top,F.top)-Math.min(E.bottom,F.bottom));
    return{bad:[...new Set(bad)],cells,max,gap:Math.round(Math.hypot(gx,gy)),E:[E.left,E.top,E.width,E.height].map(Math.round),F:[F.left,F.top,F.width,F.height].map(Math.round)};})()`);
}

async function fleeCase() {
  const b0 = await ev(`(()=>{G.state='play';DU=null;show(null);duelStart(0);renderDuel();return G.p.bub})()`), b1 = Math.max(1, Math.floor(b0 * .8)); await sleep(650);
  /* le joueur fait defiler jusqu'au bouton s'il le faut (HEAD : Fuir est sous le pli) */
  const r = await ev(`(()=>{const e=$('dvFlee');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]})()`); await sleep(100);
  await tap(r[0], r[1]);
  const a = await ev(`[G.state,!!DU,G.p.bub,$('dvFlee')?$('dvFlee').textContent:'']`);
  await sleep(400);
  const r2 = await ev(`(()=>{const e=$('dvFlee');if(!e||!DU)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]})()`);
  if (r2) await tap(r2[0], r2[1]);
  const b = await ev(`[G.state,!!DU,G.p.bub]`);
  return { un: a, deux: b, att: 'duel/' + b0 + ' puis play/' + b1, ok: a[0] === 'duel' && a[1] && a[2] === b0 && b[0] === 'play' && !b[1] && b[2] === b1 };
}

async function promptCase(w, h) {
  await ev(`(()=>{DU=null;show(null);G.state='play';G.gx.pk='';G.gx.prompt=null;const hh=WD.hunt[0];G.p.x=hh.hx;G.p.y=hh.hy;G.p.vx=G.p.vy=0;return 1})()`);
  await sleep(700);
  const m = await ev(`(()=>{const nm=${nm},p=$('prompt');if(p.hidden)return{hid:1};const r=p.getBoundingClientRect(),bad=[];
    const C=cv.getBoundingClientRect();
    for(let fx=.04;fx<.5;fx+=.06)for(let fy=.67;fy<.98;fy+=.05){const x=C.left+C.width*fx,y=C.top+C.height*fy,e=document.elementFromPoint(x,y);if(e!==cv)bad.push(Math.round(x)+','+Math.round(y)+'->'+nm(e));}
    const jx=C.left+C.width*.25,jy=C.top+C.height*.8,j=document.elementFromPoint(jx,jy);
    return{r:[r.left,r.top,r.width,r.height].map(Math.round),centre:nm(j),bad,txt:[r.left+24,r.top+22]};})()`);
  if (m.hid) return { ok: false, detail: 'invite non affichee' };
  await ev(`(()=>{inp.L=inp.R=null;return 1})()`);
  await touch('touchStart', m.txt[0], m.txt[1]); await sleep(80);
  await touch('touchMove', m.txt[0] + 40, m.txt[1] + 10); await sleep(80);
  const L = await ev(`!!inp.L`); await touch('touchEnd', 0, 0); await sleep(100);
  const g = await ev(`(()=>{const b=$('pGo');if(!b)return null;const r=b.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]})()`);
  if (g) await tap(g[0], g[1]);
  const st = await ev(`G.state`); await ev(`(()=>{if(DU){DU=null;show(null);G.state='play';}return 1})()`);
  return { ok: !m.bad.length && L && st === 'duel', detail: 'invite ' + JSON.stringify(m.r) + ' | centre du joystick -> ' + m.centre + ' | zone du pouce : ' + (m.bad.length ? m.bad.length + ' points captes (' + m.bad.slice(0, 3).join(' ') + ')' : 'tout au canvas') +
    ' | appui sur le texte -> joystick ' + (L ? 'OUI' : 'NON (inp.L=false)') + ' | bouton -> ' + st };
}

(async () => {
  const chrome = cp.spawn(process.env.CHROME || 'chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT,
    '--user-data-dir=/root/shots/cdp-tactile-' + PORT, '--window-size=411,846', 'about:blank'], { stdio: 'ignore' });
  let fail = 0;
  try {
    let ver = null; for (let i = 0; i < 60 && !ver; i++) { await sleep(300); try { ver = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch (_) { } }
    if (!ver) throw new Error('chromium : le port de debogage ne repond pas');
    ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    SID = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    await send('Page.enable'); await send('Runtime.enable');
    console.log('page : ' + PAGE);
    for (const w of WS) for (const h of HS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2.625, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await send('Page.navigate', { url: 'file://' + PAGE }); await sleep(2500);
      await ev(`(()=>{meta.chaps.prologue=1;meta.pend=[];meta.runs=Math.max(1,meta.runs);startGame('bal');inp.touch=true;return 1})()`); await sleep(1500);
      for (const n of [1, 2, 3]) {
        const r = await duelCase(w, h, n), ok = !r.bad.length && r.gap >= GAP; if (!ok) fail++;
        console.log((ok ? 'OK    ' : 'ECHEC ') + w + 'x' + h + ' duel ' + n + ' ennemi(s) : ' + r.cells + ' centres testes sur ' + (r.max + 1) + ' px de defilement' +
          (r.bad.length ? ' ; RECOUVERTS ' + r.bad.length + ' : ' + r.bad.slice(0, 4).join(' ') : ' ; chaque carte recoit son centre') + ' | ecart Fuir/Fin ' + r.gap + ' px (min ' + GAP + ') Fin ' + JSON.stringify(r.E) + ' Fuir ' + JSON.stringify(r.F));
      }
      const f = await fleeCase(); if (!f.ok) fail++;
      console.log((f.ok ? 'OK    ' : 'ECHEC ') + w + 'x' + h + ' fuite : 1er appui -> ' + JSON.stringify(f.un) + ' ; 2e appui -> ' + JSON.stringify(f.deux) + ' (attendu : ' + f.att + ')');
      const p = await promptCase(w, h); if (!p.ok) fail++;
      console.log((p.ok ? 'OK    ' : 'ECHEC ') + w + 'x' + h + ' ' + p.detail);
    }
  } catch (e) { console.log('ERREUR ' + e.stack); fail++; }
  finally { try { ws && ws.close(); } catch (_) { } chrome.kill('SIGKILL'); }
  console.log(fail ? 'ECHEC : ' + fail + ' cas' : 'TOUT PASSE'); process.exit(fail ? 1 : 0);
})();
