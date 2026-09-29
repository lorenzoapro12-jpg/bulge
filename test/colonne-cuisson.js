'use strict';
/* =========================================================
   COÛT DE CUISSON PAR CHUNK, AVANT / APRÈS le chemin principal (chantier A) — VRAI Chromium, CPU ralenti.

   node test/colonne-cuisson.js [--lent=4] [--rep=5] [--graines=20260927,12345]

   Pour chaque graine : les chunks que traverse le chemin principal (WD.mainE, arbre de travail) et autant
   de chunks témoins sans chemin principal. Chaque chunk est cuit ENTIER (bakeStep jusqu'au bout, comme
   wkBake) puis RASTERISÉ (getImageData d'un pixel : force l'exécution des opérations en attente), `rep`
   fois ; on garde le minimum (bruit d'ordonnanceur exclu). Même liste de chunks, même graine, des deux
   côtés : AVANT = bulge.html du commit --ref, APRÈS = bulge.html de l'arbre de travail (bash build.sh).
   Ce n'est pas un seuil : c'est une mesure rapportée.
   --capture=/root/shots/x.png : au lieu de mesurer, compose les 4×4 chunks cuits autour d'un carrefour du chemin
   principal (site de degré >= 3) et en fait une capture (voir le fil à l'œil nu).
   ========================================================= */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const LENT = +(ARG('lent') || 4), REP = +(ARG('rep') || 5);
const SEEDS = String(ARG('graines') || '20260927,12345').split(',').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  const port = 9500 + Math.floor(Math.random() * 190), dir = '/root/shots/col-' + port + '-' + Date.now();
  const chrome = spawn('chromium', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=390,780', 'about:blank'], { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 80 && !ver; i++) { await sleep(250); try { ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); } catch (e) { } }
  if (!ver) { chrome.kill('SIGKILL'); throw new Error('chromium : port de débogage muet'); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  const send = (method, params, s) => new Promise((res, rej) => { const m = { id: ++id, method, params: params || {} }; if (s) m.sessionId = s; pend.set(m.id, { res, rej }); ws.send(JSON.stringify(m)); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, S); await send('Page.enable', {}, S);
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, S); if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; };
  return { ev, cdp: (m, p) => send(m, p, S), close: () => { try { ws.close(); } catch (e) { } chrome.kill('SIGKILL'); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } } };
}
/* A/B dans la MÊME page, le même chunk, en alternance (ordre inversé à chaque essai) : A = WD.mainE vidé
   (aucun fil dessiné, exactement le code d'avant pour drawPaths), B = WD.mainE réel. */
const MESURE = (seed, list) => `(()=>{genWorld(${seed});const ME=WD.mainE,out=[];
  const one=(cx,cy)=>{const c=getChunk(cx,cy);c.bake=null;c.bk=null;const t0=performance.now();while(!bakeStep(c));
    const cv=c.bake||(c.bk&&c.bk.cv);if(cv)cv.getContext('2d').getImageData(0,0,1,1);const t=performance.now()-t0;WD.bakes.length=0;return t;};
  for(const [cx,cy] of ${JSON.stringify(list)}){const a=[],b=[];one(cx,cy);
    for(let r=0;r<${REP};r++)for(const m of (r%2?[1,0]:[0,1])){WD.mainE=m?ME:new Set();(m?b:a).push(one(cx,cy));}
    WD.mainE=ME;out.push([Math.min(...a),Math.min(...b)]);}
  return out;})()`;

(async () => {
  const b = await launch();
  try {
    await b.cdp('Page.navigate', { url: 'file://' + path.join(ROOT, 'bulge.html') }); await sleep(2500);
    if (ARG('capture')) {
      const info = await b.ev(`(()=>{genWorld(${SEEDS[0]});const deg=WD.sites.map((_,i)=>WD.edges.filter(e=>e.includes(i)).length),M=WD.mainPath,si=M.find((i,k)=>k>0&&deg[i]>=3)??M[1],s=WD.sites[si];
        const cx0=Math.floor(s.x/CH)-2,cy0=Math.floor(s.y/CH)-2,cv=document.createElement('canvas');cv.width=cv.height=800;cv.style.cssText='position:fixed;left:0;top:0;z-index:99999';document.body.appendChild(cv);
        const g=cv.getContext('2d'),k=800/(4*CH);for(let i=0;i<4;i++)for(let j=0;j<4;j++){const c=getChunk(cx0+i,cy0+j);if(!c)continue;c.bake=null;c.bk=null;while(!bakeStep(c));const b=c.bake||c.bk.cv;g.drawImage(b,i*CH*k,j*CH*k,CH*k,CH*k);WD.bakes.length=0;}
        return {si,deg:deg[si],t:s.t,M:M.join('-')};})()`);
      await b.cdp('Emulation.setDeviceMetricsOverride', { width: 800, height: 800, deviceScaleFactor: 1, mobile: false }); await sleep(300);
      const shot = await b.cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(ARG('capture'), Buffer.from(shot.data, 'base64'));
      console.log('capture ' + ARG('capture') + ' — graine ' + SEEDS[0] + ', carrefour au site ' + info.si + ' (' + info.t + ', degré ' + info.deg + '), chemin ' + info.M); return;
    }
    console.log('# cuisson ENTIÈRE + rasterisation par chunk, Chromium --disable-gpu, CPU ralenti ×' + LENT + ', min de ' + REP + ' essais alternés ; SANS fil = WD.mainE vide, AVEC = réel');
    const st = a => { const s = a.slice().sort((x, y) => x - y), m = s[s.length >> 1], moy = s.reduce((x, y) => x + y, 0) / s.length; return 'médiane ' + m.toFixed(2) + ' ms, moyenne ' + moy.toFixed(2) + ', pire ' + s[s.length - 1].toFixed(2); };
    for (const seed of SEEDS) {
      const L = await b.ev(`(()=>{genWorld(${seed});const on=[],off=[];for(let x=-COFF;x<NC-COFF;x++)for(let y=-COFF;y<NC-COFF;y++){const l=WD.segB.get(bk(x,y));if(!l||!getChunk(x,y))continue;
        (l.some(s=>WD.mainE.has(s.e))?on:off).push([x,y]);}const pick=(a,n)=>a.filter((_,i)=>i%Math.max(1,Math.floor(a.length/n))===0).slice(0,n);return {on:pick(on,30),off:pick(off,15),non:on.length};})()`);
      await b.cdp('Emulation.setCPUThrottlingRate', { rate: LENT });
      for (const k of ['on', 'off']) {
        const r = await b.ev(MESURE(seed, L[k])), A = r.map(x => x[0]), B = r.map(x => x[1]), D = r.map(x => x[1] - x[0]);
        console.log('graine ' + seed + ' — ' + (k === 'on' ? 'chunks SUR le chemin principal (' + L.on.length + ' sur ' + L.non + ')' : 'chunks témoins HORS chemin principal (' + L.off.length + ')'));
        console.log('   SANS fil : ' + st(A));
        console.log('   AVEC fil : ' + st(B));
        console.log('   écart par chunk : ' + st(D));
      }
      /* coût ISOLÉ du fil : exactement les opérations ajoutées à drawPaths, sur une surface de chunk, rasterisées ;
         répétées 20 fois par mesure (performance.now est arrondi à 0,1 ms en file://), divisé par 20 */
      const F = await b.ev(`(()=>{genWorld(${seed});const cv=new OffscreenCanvas(CH,CH),g=cv.getContext('2d',{alpha:false}),out=[];
        for(const [cx,cy] of ${JSON.stringify(L.on)}){const c=getChunk(cx,cy),Mn=WD.segB.get(bk(cx,cy)).filter(q=>WD.mainE.has(q.e)),t=[];
          for(let r=0;r<${REP * 3};r++){g.setTransform(1,0,0,1,0,0);g.fillRect(0,0,1,1);g.getImageData(0,0,1,1);g.translate(-c.x0,-c.y0);g.lineCap='round';g.lineJoin='round';const t0=performance.now();
            for(let z=0;z<20;z++){g.beginPath();let lx=NaN,ly=NaN;for(const q of Mn){if(q.ax!==lx||q.ay!==ly)g.moveTo(q.ax,q.ay);g.lineTo(q.bx,q.by);lx=q.bx;ly=q.by;}
            g.strokeStyle='rgba(255,138,45,.2)';g.lineWidth=34;g.stroke();g.strokeStyle='rgba(255,176,96,.8)';g.lineWidth=6;g.stroke();}g.getImageData(0,0,1,1);t.push((performance.now()-t0)/20);}
          out.push(Math.min(...t));}return out;})()`);
      console.log('   coût ISOLÉ du fil (chunks sur le chemin) : ' + st(F));
      await b.cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  } finally { b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
