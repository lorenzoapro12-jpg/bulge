'use strict';
/* =========================================================
   PIC « HORS JS » — est-il OBSERVABLE hors de l'appareil ? (chantier A3, 30/09/2026)

   node test/pic-hors-js.js [--gpu] [--cpu=N] [--tours=2]
     --gpu    Chromium SANS --disable-gpu (ce qu'il trouve ici : voir la ligne « rendu » en tete de sortie)
     --cpu=N  Emulation.setCPUThrottlingRate N (defaut 1)
   Ce n'est PAS une porte (pas de verdict vert/rouge) : un banc d'exploration. Il n'est branche nulle part.

   Pour chaque essai, une perturbation est appliquee pendant une partie en cours, compteur allume, et on decrit
   LA MEME IMAGE de deux facons independantes :
     - le banc : un enrobage de requestAnimationFrame note, pour chaque rappel du jeu (frame), ts et la duree du
       rappel ; on prend l'image de plus long intervalle dt(N)=ts(N)-ts(N-1) dans la fenetre de l'essai, et on
       l'apparie au rappel N-1 (meme appariement que DIAG_W, g4.js). dt se decompose EXACTEMENT en
         dt = retard(N-1) + JS(N-1) + fil libre - retard(N)     (retard(k) = debut reel du rappel k - ts(k))
       ⚠️ RESULTAT (30/09/2026) : un blocage du fil principal qui tombe entre le vsync ts(N-1) et le debut du rappel
       N-1 se loge dans retard(N-1), PAS entre les rappels : le rappel N-1 part en retard avec un ts ancien.
       « autre JS » = ce que le banc a mesure d'AUTRE sur le fil principal dans [ts(N-1), debut du rappel N] : messages du worker (enrobage de WK.w.onmessage) et
       taches injectees par l'essai lui-meme ;
     - le compteur du jeu : la publication DIAG_WORST qui couvre cette image (meme dt a 0,5 ms pres => c'est
       bien la meme image) : [pire, JS, gen, spr, reçus, collés].
   Verdict « hors JS » : dt - JS(jeu) - autre JS > 16,7 ms (plus d'une periode d'ecran que personne n'explique).
   ⚠️ Au REPOS, ce Chromium rate deja une periode de temps en temps (dt 33 ms, JS ~2-8 ms) : comparer chaque essai
   a la ligne « repos », pas au seuil seul. Et le jeu PLAFONNE dt a 100 ms (g4.js, frame) : le compteur ne peut
   jamais afficher « pire » au-dela de 100 ms — le banc, lui, donne le vrai intervalle.
   Deux temoins bornent l'instrument : JS DANS le rappel (drawHUD alourdi) doit etre vu « JS » ; JS HORS du
   rappel (setTimeout occupe) est un pic que le COMPTEUR classe hors JS — le banc, lui, le voit en « autre JS ».
   ========================================================= */
const { launch } = require('./worker.js');
const path = require('path');
const HTML = 'file://' + path.resolve(__dirname, '..', 'bulge.html');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const CPU = +(ARG('cpu') || 1), TOURS = +(ARG('tours') || 2), GPU = !!ARG('gpu');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const INSTR = `(()=>{if(window.__F)return 0;window.__F=[];window.__O=[];window.__P=[];let lw=null;
  const oraf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=function(cb){if(cb!==frame)return oraf(cb);return oraf(ts=>{const t0=performance.now();try{cb(ts);}finally{
    const t1=performance.now();__F.push([ts,t0,t1-t0,G&&G.state]);if(DIAG_WORST&&DIAG_WORST!==lw){lw=DIAG_WORST;__P.push([ts,DIAG_WORST.slice()]);}}});};
  const w=WK&&WK.w;if(w){const om=w.onmessage;w.onmessage=function(e){const t0=performance.now();try{return om.call(this,e);}finally{__O.push([t0,performance.now()-t0,'worker']);}};}
  window.__busy=(ms,tag)=>{const t0=performance.now();while(performance.now()-t0<ms);__O.push([t0,performance.now()-t0,tag]);};
  return 1;})()`;
/* les essais : [nom, action (B, t) => promesse]. t = temps page au debut de l'action. */
const ESSAIS = [
  ['repos (aucune perturbation)', async () => { }],
  ['TEMOIN JS dans le rappel : drawHUD +60 ms', async B => B.ev(`(()=>{const f=drawHUD;drawHUD=function(){drawHUD=f;__busy(60,'drawHUD+60');return f.apply(this,arguments);};return 1;})()`)],
  ['TEMOIN JS hors rappel : setTimeout occupe 60 ms', async B => B.ev(`(()=>{setTimeout(()=>__busy(60,'setTimeout+60'),0);return 1;})()`)],
  ['Emulation.setPageScaleFactor 2 puis 1', async B => { await B.cdp('Emulation.setPageScaleFactor', { pageScaleFactor: 2 }); await sleep(300); await B.cdp('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); }],
  ['redimensionnement 360x780 -> 412x915', async B => B.cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true })],
  ['Page.setWebLifecycleState frozen 500 ms -> active', async B => { await B.cdp('Page.setWebLifecycleState', { state: 'frozen' }); await sleep(500); await B.cdp('Page.setWebLifecycleState', { state: 'active' }); }],
  ['visibilite : onglet en arriere-plan 500 ms puis retour (+ reprise)', async B => {
    await B.ev(`(()=>{window.__vs=[];document.addEventListener('visibilitychange',()=>setTimeout(()=>__vs.push(document.visibilityState+':'+G.state),0));return 1;})()`);
    const { targetId } = await B.send('Target.createTarget', { url: 'about:blank' }); await B.send('Target.activateTarget', { targetId });
    await sleep(500); const vis = await B.ev('document.visibilityState'); await B.send('Target.closeTarget', { targetId }); await sleep(200);
    const r = await B.ev('(()=>{const s0=G.state;if(G.state==="pause")togglePause();return s0+"->"+G.state+" / "+document.visibilityState+" ; evenements vus : "+__vs.join(", ");})()'); return 'visibilite pendant : ' + vis + ' ; ' + r; }],
  ['rafale de 2000 rappels rAF dans une image', async B => B.ev(`(()=>{for(let i=0;i<2000;i++)requestAnimationFrame(()=>{});return 1;})()`)],
  /* televersements : la PREPARATION (remplissage 4096², createImageBitmap) est faite AVANT la fenetre (3e element)
     — sinon c'est du JS de l'essai, non chronometre, qui passe pour du « hors JS ». Seul le premier drawImage est dans la fenetre. */
  ['televersement : 1er drawImage d\'un canvas neuf 4096x4096 sur MAINCTX', async B => B.ev(`(()=>{requestAnimationFrame(()=>{const t0=performance.now();MAINCTX.drawImage(__cv,0,0,64,64);__O.push([t0,performance.now()-t0,'drawImage canvas4096']);});return 1;})()`),
    async B => B.ev(`(()=>{const t0=performance.now(),c=document.createElement('canvas');c.width=c.height=4096;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,4096,4096);gr.addColorStop(0,'#f00');gr.addColorStop(1,'#00f');g.fillStyle=gr;g.fillRect(0,0,4096,4096);window.__cv=c;return performance.now()-t0;})()`)],
  ['televersement : 1er drawImage d\'une ImageBitmap 4096x4096', async B => B.ev(`(()=>{requestAnimationFrame(()=>{const t0=performance.now();MAINCTX.drawImage(__bm,0,0,64,64);__O.push([t0,performance.now()-t0,'drawImage bitmap4096']);});return 1;})()`),
    async B => B.ev(`(async()=>{const t0=performance.now(),c=new OffscreenCanvas(4096,4096),g=c.getContext('2d');g.fillStyle='#0f0';g.fillRect(0,0,4096,4096);window.__bm=await createImageBitmap(c);return performance.now()-t0;})()`)],
  /* GC : les 150 Mo sont alloues puis lâches AVANT la fenetre ; dans la fenetre, seul HeapProfiler.collectGarbage (aucun JS de page) */
  ['GC force : HeapProfiler.collectGarbage apres 150 Mo lâches', async B => B.cdp('HeapProfiler.collectGarbage', {}),
    async B => B.ev(`(()=>{const t0=performance.now();let g=[];for(let i=0;i<1.5e6;i++)g.push({a:i,b:[i,i+1],c:'x'+i});window.__g=g;g=null;window.__g=null;return performance.now()-t0;})()`)],
  /* GC NATUREL : pas d'appel CDP ; une tache chronometree alloue 40 Mo par 100 ms pendant 1 s, et on regarde si une image
     a un « inexplique » que ne couvrent ni le JS du jeu ni la tache (qui est dans « autre JS ») */
  ['GC naturel : 10 x 40 Mo alloues (taches chronometrees) sur 1 s', async B => B.ev(`(()=>{let k=0;const f=()=>{const t0=performance.now();let g=[];for(let i=0;i<4e5;i++)g.push({a:i,b:[i,i+1],c:'x'+i});window.__g2=g;__O.push([t0,performance.now()-t0,'alloc']);if(++k<10)setTimeout(f,100);};setTimeout(f,0);return 1;})()`)],
];
const f1 = x => x == null ? '—' : (+x).toFixed(1);
(async () => {
  const B = await launch();
  const out = [];
  try {
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
    await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (CPU > 1) await B.cdp('Emulation.setCPUThrottlingRate', { rate: CPU });
    await B.cdp('HeapProfiler.enable', {});
    await B.nav(HTML);
    for (let i = 0; i < 80; i++) { await sleep(250); try { if (await B.ev("typeof startGame==='function'&&document.readyState==='complete'")) break; } catch (e) { } }
    const rendu = await B.ev(`(()=>{try{const g=document.createElement('canvas').getContext('webgl');if(!g)return 'pas de WebGL';const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);}catch(e){return 'erreur '+e.message;}})()`);
    console.log('RENDU : Chromium ' + (GPU ? 'SANS --disable-gpu' : 'AVEC --disable-gpu (aucune conclusion possible sur le compositeur GPU)') + ' · WebGL : ' + rendu + ' · CPU x' + CPU);
    for (let i = 0; i < 40; i++) { if (await B.ev('(()=>{meta.fps=true;try{if(!G||G.state!=="play"){startGame("bal",false);show(null);}}catch(e){}return !!G&&G.state==="play";})()')) break; await sleep(500); }
    await sleep(3000); // demarrage : cuisson initiale
    await B.ev(INSTR);
    await sleep(1500);
    for (let tour = 1; tour <= TOURS; tour++) for (const [nom, act, prep] of ESSAIS) {
      await B.ev('(()=>{if(G.state==="pause")togglePause();return 1;})()');
      let pnote = ''; if (prep) pnote = 'preparation hors fenetre ' + f1(await prep(B)) + ' ms';
      await sleep(1200); // hors de la fenetre precedente, et une publication du compteur passee
      const tA = await B.ev('performance.now()');
      let note = null; try { note = await act(B); } catch (e) { note = 'ERREUR CDP : ' + e.message; }
      note = [typeof note === 'string' ? note : '', pnote].filter(Boolean).join(' ; ') || null;
      const tB = await B.ev('performance.now()');
      await sleep(2300); // la publication d'apres (1 s de jeu) doit tomber
      const r = await B.ev(`(()=>{const F=__F,tA=${tA},tB=${tB};let best=-1,bd=0;
        for(let i=1;i<F.length;i++){if(F[i][0]<tA||F[i][0]>tB+1200)continue;if(F[i-1][3]!=='play'||F[i][3]!=='play')continue;const d=F[i][0]-F[i-1][0];if(d>bd){bd=d;best=i;}}
        if(best<0){const W=F.filter(f=>f[0]>=tA&&f[0]<=tB+1200);return {n:W.length,etats:[...new Set(W.map(f=>f[3]))].join('/'),vis:document.visibilityState};}
        const p=F[best-1],a=p[1]+p[2],b=F[best][1];
        const aut=__O.filter(o=>o[0]+o[1]>p[0]&&o[0]<b&&!(o[0]>=p[1]&&o[0]<a));
        const pub=__P.find(q=>q[0]>=F[best][0]);
        return {dt:bd,js:p[2],aut:aut.reduce((s,o)=>s+o[1],0),autq:aut.map(o=>o[2]+' '+o[1].toFixed(1)).join(', '),pub:pub?pub[1]:null,
          trou:b-a,lat:p[1]-p[0],latN:b-F[best][0],vis:document.visibilityState};})()`);
      if (r.dt == null) { console.log('[' + tour + '] ' + nom + ' : aucune paire d\'images de jeu dans la fenetre (' + r.n + ' rappels, etats ' + r.etats + ', ' + r.vis + ')' + (note ? ' — ' + note : '')); out.push([tour, nom, null]); continue; }
      const hors = r.dt - r.js - r.aut, memeImg = r.pub && Math.abs(r.pub[0] - r.dt) < 0.5;
      const cpt = r.pub ? 'pire ' + r.pub[0].toFixed(0) + ' ms : JS ' + (r.pub[1] < 0 ? '?' : r.pub[1].toFixed(1) + ' ms') + ' · gen ' + r.pub[2] + ' · spr ' + r.pub[3] + ' · reçus ' + r.pub[4] + ' · collés ' + r.pub[5] : '—';
      console.log('[' + tour + '] ' + nom + (note ? '  (' + note + ')' : ''));
      console.log('      banc     : dt ' + f1(r.dt) + ' ms · JS jeu ' + f1(r.js) + ' ms · autre JS ' + f1(r.aut) + ' ms' + (r.autq ? ' [' + r.autq + ']' : '') + ' · fil libre entre les rappels ' + f1(r.trou) + ' ms · inexplique ' + f1(hors) + ' ms => ' + (hors > 16.7 ? 'HORS JS' : 'explique par le JS'));
      console.log('      compteur : ' + cpt + (r.pub ? (memeImg ? '  (meme image)' : '  (AUTRE image : le compteur a retenu un pire different)') : ''));
      out.push([tour, nom, r.dt, r.js, r.aut, hors, r.pub, memeImg, r.lat, r.trou]);
    }
  } finally { B.close(); }
  console.log('\nTABLEAU (' + (GPU ? 'sans --disable-gpu' : 'AVEC --disable-gpu') + ', CPU x' + CPU + ')');
  console.log('tour | essai | dt ms | JS jeu ms | retard N-1 ms | fil libre ms | autre JS ms | inexplique ms | hors JS ? | compteur (pire/JS) | meme image');
  for (const o of out) console.log(o[2] == null ? o[0] + ' | ' + o[1] + ' | — ' : [o[0], o[1], f1(o[2]), f1(o[3]), f1(o[8]), f1(o[9]), f1(o[4]), f1(o[5]), o[5] > 16.7 ? 'OUI' : 'non', o[6] ? o[6][0].toFixed(0) + '/' + (o[6][1] < 0 ? '?' : o[6][1].toFixed(1)) : '—', o[7] ? 'oui' : 'NON'].join(' | '));
})().catch(e => { console.error(e); process.exit(1); });
