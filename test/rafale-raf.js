'use strict';
/* =========================================================
   RAFALES rAF — d'ou viennent les intervalles < 4 ms ? (chantier A5, 30/09/2026)

   node test/rafale-raf.js [--tours=2] [--cpu=N] [--gpu] [--sansvsync]
     --sansvsync  TEMOIN : Chromium lance avec --disable-frame-rate-limit --disable-gpu-vsync (rendu NON cadence)
   Banc d'exploration (pas une porte, branche nulle part). Vrai Chromium pilote par CDP.

   On enrobe requestAnimationFrame : pour CHAQUE rappel de frame(), on note ts (l'argument, ce que le jeu
   soustrait : dt = ts - last, g4.js frame), l'heure reelle de debut, la duree et G.state. Pour chaque essai,
   on applique une perturbation puis on decrit la fenetre [tA, tB + FEN] :
     n rappels · cadence (rappels/s) · dt min · dt p5 · dt mediane · dt max · nb dt < 4 ms · dont en jeu (les deux
     images en 'play' : les seules que perf() aurait retenues) · plus longue suite de dt < 4 ms · nb dt <= 0.
   La police : les requetes fonts.googleapis.com / fonts.gstatic.com sont INTERCEPTEES (Fetch). La feuille CSS
   est servie tout de suite (elle bloque le rendu : elle ne peut PAS arriver en cours de partie) ; les fichiers
   de police (Chakra Petch 500/700, servis avec DejaVuSans faute de reseau) sont RETENUS et relaches pendant la
   partie : c'est le « swap » de font-display:swap, l'unique evenement police possible en cours de partie.
   ========================================================= */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const HTML = 'file://' + path.resolve(__dirname, '..', 'bulge.html');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const CPU = +(ARG('cpu') || 1), TOURS = +(ARG('tours') || 2), GPU = !!ARG('gpu'), FEN = 2500;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TTF = fs.readFileSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').toString('base64');
const CSS = Buffer.from(`@font-face{font-family:'Chakra Petch';font-style:normal;font-weight:500;font-display:swap;src:url(https://fonts.gstatic.com/a5/cp500.ttf) format('truetype');}
@font-face{font-family:'Chakra Petch';font-style:normal;font-weight:700;font-display:swap;src:url(https://fonts.gstatic.com/a5/cp700.ttf) format('truetype');}`).toString('base64');

async function launch() {
  const port = 9500 + Math.floor(Math.random() * 190), dir = '/root/shots/a5-' + port + '-' + Date.now();
  const flags = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=390,780', 'about:blank'];
  if (!GPU) flags.splice(2, 0, '--disable-gpu');
  if (ARG('sansvsync')) flags.splice(2, 0, '--disable-frame-rate-limit', '--disable-gpu-vsync');
  const chrome = spawn('chromium', flags, { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 80 && !ver; i++) { await sleep(250); try { ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); } catch (e) { } }
  if (!ver) { chrome.kill('SIGKILL'); throw new Error('chromium : port de debogage muet'); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let id = 0; const pend = new Map(), hand = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } else if (m.method && hand[m.method]) hand[m.method](m.params); };
  const send = (method, params, sessionId) => new Promise((res, rej) => { const m = { id: ++id, method, params: params || {} }; if (sessionId) m.sessionId = sessionId; pend.set(m.id, { res, rej }); ws.send(JSON.stringify(m)); setTimeout(() => { if (pend.has(m.id)) { pend.delete(m.id); rej(new Error('CDP muet 15 s : ' + method)); } }, 15000); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, S); await send('Page.enable', {}, S);
  const ev = async (expression, userGesture) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: !!userGesture }, S);
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };
  return { ev, hand, targetId, cdp: (m, p) => send(m, p, S), send, nav: u => send('Page.navigate', { url: u }, S),
    close: () => { try { ws.close(); } catch (e) { } try { chrome.kill('SIGKILL'); } catch (e) { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } } };
}

const INSTR = `(()=>{if(window.__F)return 0;window.__F=[];
  const oraf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=function(cb){if(cb!==frame)return oraf(cb);return oraf(ts=>{const t0=performance.now();try{cb(ts);}finally{__F.push([ts,t0,performance.now()-t0,G?G.state:'-']);}});};
  return 1;})()`;
/* statistiques d'une fenetre de rappels (calculees dans la page) */
const STATS = (tA, tB) => `(()=>{const F=__F.filter(f=>f[1]>=${tA}&&f[1]<=${tB}+${FEN});const d=[];let nj=0,run=0,rmax=0,neg=0,smin=null;
  for(let i=1;i<F.length;i++){const x=F[i][0]-F[i-1][0];d.push(x);if(x<=0)neg++;if(x<4){run++;rmax=Math.max(rmax,run);if(F[i][3]==='play'&&F[i-1][3]==='play')nj++;if(smin==null)smin=F[i-1][3]+'>'+F[i][3];}else run=0;}
  const s=d.slice().sort((a,b)=>a-b),q=p=>s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:null;
  const dur=F.length>1?(F[F.length-1][1]-F[0][1])/1000:0;
  return {n:F.length,cad:dur?(F.length-1)/dur:0,min:s[0],p5:q(.05),med:q(.5),max:s[s.length-1],n4:d.filter(x=>x<4).length,nj,rmax,neg,etats:[...new Set(F.map(f=>f[3]))].join('/'),ex:smin,vis:document.visibilityState};})()`;

const PLAY = '(()=>{try{if(!G||G.state!=="play"){startGame("bal",false);show(null);}}catch(e){}return G?G.state:"-";})()';
const ESSAIS = [
  ['repos (aucune perturbation)', async () => { }],
  ['visibilite : Emulation.setPageVisibilityOverride hidden 600 ms -> visible', async B => {
    await B.cdp('Emulation.setPageVisibilityOverride', { hidden: true }); const v = await B.ev('document.visibilityState+":"+G.state');
    await sleep(600); await B.cdp('Emulation.setPageVisibilityOverride', { hidden: false }); const r = await B.ev('document.visibilityState+":"+G.state');
    await B.ev('(()=>{if(G.state==="pause")togglePause();return G.state;})()'); return 'pendant ' + v + ' ; apres ' + r + ' ; reprise'; }],
  ['visibilite : autre onglet actif 600 ms puis retour', async B => {
    const { targetId } = await B.send('Target.createTarget', { url: 'about:blank' }); await B.send('Target.activateTarget', { targetId });
    await sleep(600); const v = await B.ev('document.visibilityState+":"+G.state'); await B.send('Target.closeTarget', { targetId }); await B.send('Target.activateTarget', { targetId: B.targetId }); await sleep(100);
    await B.ev('(()=>{if(G.state==="pause")togglePause();return 1;})()'); return 'pendant ' + v; }],
  ['cycle de vie : Page.setWebLifecycleState frozen 600 ms -> active', async B => { await B.cdp('Page.setWebLifecycleState', { state: 'frozen' }); await sleep(600); await B.cdp('Page.setWebLifecycleState', { state: 'active' }); await sleep(300); return 'rappels de frame dans les 900 ms : ' + await B.ev('__F.filter(f=>f[1]>performance.now()-900).length'); }, 1],
  ['resize 360x780 -> 412x915', async B => { await B.cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true }); await sleep(1000); await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true }); }],
  ['orientation portrait -> paysage -> portrait', async B => {
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: 780, height: 360, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } }); await sleep(1000);
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } }); }],
  ['plein ecran : requestFullscreen puis exitFullscreen', async B => {
    const a = await B.ev('Promise.race([document.documentElement.requestFullscreen().then(()=>"entre:"+!!document.fullscreenElement,e=>"refus:"+e.message),new Promise(r=>setTimeout(()=>r("promesse pendante 2 s, plein ecran="+!!document.fullscreenElement),2000))])', true); await sleep(1000);
    const b = await B.ev('document.fullscreenElement?Promise.race([document.exitFullscreen().then(()=>"sorti",e=>"refus:"+e.message),new Promise(r=>setTimeout(()=>r("sortie pendante 2 s"),2000))]):"pas en plein ecran"', true); return a + ' ; ' + b; }],
  ['pause -> reprise (togglePause x2, 600 ms)', async B => { await B.ev('togglePause()'); await sleep(600); await B.ev('togglePause()'); }],
  ['nouvelle partie : endRun puis startGame', async B => { await B.ev('(()=>{endRun(false);return G.state;})()'); await sleep(800); return 'etat ' + await B.ev(PLAY); }],
  ['mort : die() -> ecran de fin -> nouvelle partie', async B => { await B.ev('(()=>{die();return G.state;})()'); for (let i = 0; i < 20; i++) { await sleep(250); if (await B.ev('G.state') !== 'dying') break; } const s = await B.ev('G.state'); await sleep(500); return 'apres die : ' + s + ' ; ' + await B.ev(PLAY); }],
  ['glitch : G.glitch=45 (fondu/glitch d\'affichage)', async B => B.ev('(()=>{G.glitch=45;return 1;})()')],
  ['TEMOIN rafale : 2000 rAF(()=>{}) dans une image', async B => B.ev('(()=>{for(let i=0;i<2000;i++)requestAnimationFrame(()=>{});return 1;})()'), 1],
  ['TEMOIN boucle doublee : 2e requestAnimationFrame(frame) pendant 1 s', async B => { await B.ev('(()=>{window.__dbl=1;const f=()=>{if(!__dbl)return;requestAnimationFrame(frame);};requestAnimationFrame(f);return 1;})()'); await sleep(1000); await B.ev('(()=>{__dbl=0;return 1;})()'); return 'la 2e boucle survit (chaque frame() se re-arme)'; }, 1],
];
const f1 = x => x == null ? '—' : (+x).toFixed(1);
const ligne = (nom, r, note) => [nom, r.n, f1(r.cad), f1(r.min), f1(r.p5), f1(r.med), f1(r.max), r.n4, r.nj, r.rmax, r.neg, r.etats].join(' | ') + (r.ex ? ' | 1er <4 : ' + r.ex : '') + (note ? '  [' + note + ']' : '');

async function preparer(B, retenir) {
  const tenus = [];
  B.hand['Fetch.requestPaused'] = p => {
    const u = p.request.url;
    if (u.includes('fonts.googleapis.com')) return B.cdp('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/css' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: CSS });
    if (retenir.on) { tenus.push(p.requestId); return; }
    return B.cdp('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'font/ttf' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: TTF });
  };
  await B.cdp('Fetch.enable', { patterns: [{ urlPattern: '*fonts.googleapis.com*' }, { urlPattern: '*fonts.gstatic.com*' }] });
  await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
  await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (CPU > 1) await B.cdp('Emulation.setCPUThrottlingRate', { rate: CPU });
  await B.nav(HTML);
  for (let i = 0; i < 80; i++) { await sleep(250); try { if (await B.ev("typeof startGame==='function'&&document.readyState==='complete'")) break; } catch (e) { } }
  console.log('  page prete : ' + await B.ev('document.readyState+" G="+(typeof G)'));
  await B.ev(INSTR);
  for (let i = 0; i < 40; i++) { if (await B.ev(PLAY) === 'play') break; await sleep(500); }
  await sleep(3000);
  return tenus;
}
async function mesure(B, act) {
  await B.ev('(()=>{if(G.state==="pause")togglePause();return 1;})()'); await sleep(800);
  const tA = await B.ev('performance.now()');
  let note = null; try { note = await act(B); } catch (e) { note = 'ERREUR : ' + e.message.slice(0, 160); }
  const tB = await B.ev('performance.now()');
  await sleep(FEN + 300);
  return [await B.ev(STATS(tA, tB)), note];
}

(async () => {
  const OUT = [];
  const ENT = 'essai | n rappels | cadence /s | dt min | dt p5 | dt med | dt max | nb dt<4 | dont en jeu | suite max <4 | nb dt<=0 | etats';
  console.log('Chromium ' + (GPU ? 'SANS' : 'AVEC') + ' --disable-gpu' + (ARG('sansvsync') ? ' + SANS VSYNC' : '') + ' · CPU x' + CPU + ' · fenetre = action + ' + FEN + ' ms');
  for (let tour = 1; tour <= TOURS; tour++) {
    /* A. police retenue puis relachee en cours de partie */
    { const B = await launch(); try {
      const ret = { on: true }, tenus = await preparer(B, ret);
      const av = await B.ev('[...document.fonts].map(f=>f.weight+":"+f.status).join(",")+" check700="+document.fonts.check(\'700 16px "Chakra Petch"\')');
      let [r, n] = await mesure(B, async () => { }); OUT.push([tour, ligne('police RETENUE (repli en service)', r, 'polices ' + av + ' ; requetes tenues ' + tenus.length)]);
      [r, n] = await mesure(B, async B => { ret.on = false; for (const id of tenus.splice(0)) await B.cdp('Fetch.fulfillRequest', { requestId: id, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'font/ttf' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: TTF });
        await sleep(400); return 'apres : ' + await B.ev('[...document.fonts].map(f=>f.weight+":"+f.status).join(",")+" check700="+document.fonts.check(\'700 16px "Chakra Petch"\')'); });
      OUT.push([tour, ligne('police ARRIVE en cours de partie (swap)', r, n)]);
    } finally { B.close(); } }
    /* B. les autres essais, police servie tout de suite */
    /* les essais marques « seul » (3e element) laissent la page dans un etat anormal : navigateur neuf */
    const grp = [ESSAIS.filter(e => !e[2])].concat(ESSAIS.filter(e => e[2]).map(e => [e]));
    for (const g of grp) { const B = await launch(); try {
      await preparer(B, { on: false });
      for (const [nom, act] of g) { const [r, n] = await mesure(B, act); OUT.push([tour, ligne(nom, r, n)]); console.log('[' + tour + '] ' + ligne(nom, r, n)); }
    } finally { B.close(); } }
  }
  console.log('\nTABLEAU\ntour | ' + ENT);
  for (const [t, l] of OUT) console.log(t + ' | ' + l);
})().catch(e => { console.error(e); process.exit(1); });
