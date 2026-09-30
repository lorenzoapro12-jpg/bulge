'use strict';
/* =========================================================
   PORTE « VRAI NAVIGATEUR » — les tests qui ont besoin d'un vrai Chromium (CDP), en une commande.

   node test/navigateur.js      code de sortie : 0 tout passe · 1 un echec · 2 NON EXERCE (Chromium ne demarre pas)

   POURQUOI UNE PORTE A PART, ET PAS UNE LIGNE DE test/headless.js (chantier P1, 30/09/2026 — ne pas defaire) :
   test/worker.js existait sans etre branche a rien : il ne tournait donc jamais. Deux branchements etaient possibles.
   - L'appeler depuis headless.js : REFUSE. headless.js est la voie DETERMINISTE, sous `vm`, qui doit tourner sur un
     serveur sans navigateur (CLAUDE.md) et que d'autres sessions lancent en parallele. Y mettre Chromium, c'est
     choisir entre un « saut » silencieux quand il manque (du vert qui ne prouve rien) et un rouge sans rapport avec
     le code (snap absent, port pris, machine chargee). De plus `--ref=` n'y a pas de sens : worker.js juge
     l'artefact bulge.html, pas les modules d'un commit.
   - Une porte separee, et headless.js qui DIT qu'il ne l'a pas exercee : RETENU. headless.js affiche une ligne
     « NON EXERCE ICI » qui nomme cette commande ; ici, l'absence de Chromium rend le code 2, jamais 0.
   Un test de navigateur nouveau s'ajoute a la liste TESTS ci-dessous, pas a headless.js.

   Ce que la porte verifie :
     0. bulge.html est bien celui des modules (empreinte de build.sh) — sinon on jugerait un artefact perime ;
     1. test/worker.js : worker = sur place a l'octet, voie branchee, discrimination ;
     2. le DEFAUT dans un vrai navigateur : bulge.html sans parametre => « cuisson worker », ?wk=0 => « sur place »,
        ?wk=1 => worker (la decision sous `vm`, avec tous les cas de repli : test/defaut.js, appele par headless.js) ;
     3. test/pire-navigateur.js (chantier A3) : la ligne « pire N ms : JS · gen · spr · reçus · collés » est REELLEMENT
        ecrite (fillText interceptes) avec les six champs de DIAG_WORST, tient dans W - pad, et le compteur n'ecrit
        AUCUNE ligne diagnostic eteint ; trois formats d'ecran, sentinelles de discrimination.
   ========================================================= */
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), sleep = ms => new Promise(r => setTimeout(r, ms));
const TESTS = [['worker.js', []], ['pire-navigateur.js', []]];
let ok = true;
const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '  — ' + info : '')); };
(async () => {
  const v = cp.spawnSync('chromium', ['--version'], { encoding: 'utf8' });
  if (v.error || v.status !== 0) { console.log('NON EXERCE : chromium ne demarre pas (' + (v.error ? v.error.code : 'code ' + v.status) + ') — rien n\'est prouve, rien n\'est refute'); process.exit(2); }
  console.log('PORTE VRAI NAVIGATEUR — ' + v.stdout.trim());
  const html = path.join(ROOT, 'bulge.html'), sha = crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'), att = fs.readFileSync(path.join(ROOT, '.build-sha256'), 'utf8').split(' ')[0];
  check('bulge.html est l\'artefact de build.sh (empreinte)', sha === att, sha === att ? sha.slice(0, 16) + '…' : 'perime : lancer bash build.sh');
  for (const [f, a] of TESTS) { const t0 = Date.now(), r = cp.spawnSync(process.execPath, [path.join(__dirname, f), ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }), out = (r.stdout || '') + (r.stderr || '');
    check('test/' + f + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)', r.status === 0, r.status === 0 ? out.split('\n').filter(l => /^\s+OK\s/.test(l)).length + ' lignes OK ; ' + (out.match(/WORKER = SUR PLACE[^\n]*/) || [''])[0] : (out.match(/ECHEC[^\n]*/g) || [out.slice(-300)]).slice(0, 4).join(' | ')); }
  const { launch } = require('./worker.js');
  for (const [q, want] of [['', 'worker'], ['?wk=0', 'sur place'], ['?wk=1', 'worker']]) { const B = await launch(); let r = null;
    try { await B.nav('file://' + html + q);
      for (let i = 0; i < 40; i++) { await sleep(500); try { r = await B.ev('(()=>{if(WK===null&&' + (i > 5) + '){try{if(!G||G.state!=="play"){startGame("bal",false);show(null);}}catch(e){}}return {wk:WK===null?"?":WK?"worker":"sur place",wkn:WKN,s:location.search};})()'); } catch (e) { r = { wk: 'exception ' + e.message }; }
        if (r.wk !== '?' && (r.wk !== 'worker' || r.wkn > 0)) break; }
    } finally { B.close(); }
    check('vrai navigateur, URL « ' + q + ' » => cuisson ' + want, r && r.wk === want && (want !== 'worker' || r.wkn > 0), r ? 'etat « ' + r.wk + ' », ' + r.wkn + ' chunks recus du worker, location.search=« ' + r.s + ' »' : ''); }
  /* 4. chantier A4 — le « hors JS » attribue, dans un VRAI Chromium (S22 standard 360x780, DPR 2.625, tactile).
     Sous `vm` il n'y a ni PerformanceObserver, ni vrai worker, ni horloges concordantes : ici, on constate que
     (a) 'longtask' est detecte au lancement (LT_ST=1) et que wkRecv recu par le worker est bien l'ENVELOPPE
     mesuree (w.onmessage === la globale enveloppee) ; (b) apres une tâche FORCEE de 150 ms hors de frame()
     (setTimeout qui boucle), la ligne ecrite nomme une tâche longue >= 150 ms, et retard / wkRecv sont des
     NOMBRES (horloges concordantes : pas de « ? ») ; (c) chaque ligne tient dans W - pad. Les durees
     affichees sont RECOPIEES, pas jugees : ce banc n'est pas le S22. */
  { const B = await launch(), H = (s, n) => B.ev(s).catch(e => ({ err: e.message }));
    try {
      await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2.625, mobile: true });
      await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await B.nav('file://' + html);
      for (let i = 0; i < 80; i++) { await sleep(250); if (await H("typeof startGame==='function'&&typeof MAINCTX!=='undefined'&&document.readyState==='complete'") === true) break; }
      for (let i = 0; i < 40; i++) { if (await H('(()=>{meta.fps=true;try{if(!G||G.state!=="play"){startGame("bal",false);show(null);}}catch(e){}return !!G&&G.state==="play";})()') === true) break; await sleep(500); }
      await sleep(3000);
      const e = await H(`(()=>({lt:LT_ST,sup:(PerformanceObserver.supportedEntryTypes||[]).indexOf('longtask')>=0,wk:WK?'worker':String(WK),wkn:WKN,
        env:!!JSPROF.wkRecv&&/meta\\.fps/.test(String(wkRecv)),lie:!!WK&&WK.w.onmessage===wkRecv}))()`);
      check('A4 vrai navigateur : API longtask detectee au lancement (LT_ST=1)', e.lt === 1 && e.sup, JSON.stringify(e));
      check('A4 vrai navigateur : wkRecv du worker passe par l\'enveloppe mesuree', e.wk === 'worker' && e.env && e.lie && e.wkn > 0, 'cuisson ' + e.wk + ', ' + e.wkn + ' chunks recus, enveloppe=' + e.env + ', onmessage=enveloppe:' + e.lie);
      await H(`(()=>{window.__L=[];const mc=MAINCTX,of=mc.fillText;mc.fillText=function(t,x,y){if(x===14&&String(mc.fillStyle).toLowerCase()==='#8f89b3')window.__L.push({f:FRAME,t:String(t),w:mc.measureText(String(t)).width,W});return of.apply(this,arguments);};
        setTimeout(()=>{const a=performance.now();while(performance.now()-a<150);},0);return 1;})()`);
      let r = null, m = null;
      for (let i = 0; i < 16 && !m; i++) { await sleep(250);
        r = await H(`(()=>{const L=window.__L,fs=[...new Set(L.map(l=>l.f))];const f=fs.length>1?fs[fs.length-2]:-1;window.__L=L.filter(l=>l.f>=f);return {lignes:L.filter(l=>l.f===f),W};})()`);
        const s = (r.lignes || []).map(l => l.t).join(' · '); if ((m = s.match(/longtask (\d+) ms \(([^,]+), ([^)]+)\)/)) && +m[1] < 150) m = null; }
      const s = r && r.lignes ? r.lignes.map(l => l.t).join(' · ') : '', i0 = s.indexOf('pire ');
      console.log('        ce que l\'ecran ECRIT (image apres la tâche forcee) :');
      for (const l of (r && r.lignes) || []) console.log('          ' + (14 + l.w).toFixed(1).padStart(7) + ' px | ' + l.t);
      check('A4 vrai navigateur : la tâche forcee de 150 ms est NOMMEE par le navigateur (longtask >= 150 ms, attribution)', !!m, m ? m[0] : 'pas de longtask >= 150 ms dans « ' + s.slice(i0, i0 + 200) + ' »');
      check('A4 vrai navigateur : retard et wkRecv sont MESURES (des nombres, pas « ? »)', /retard \d+\.\d ms/.test(s) && /wkRecv \d+\.\d\d\/\d+\.\d\d ms/.test(s), (s.match(/retard [^·]*· wkRecv [^·]*/) || ['champs introuvables'])[0]);
      const trop = ((r && r.lignes) || []).filter(l => 14 + l.w > l.W - 14 + .5);
      check('A4 vrai navigateur : chaque ligne tient dans W - pad', r && r.lignes && r.lignes.length > 0 && !trop.length, trop.length ? 'deborde : ' + trop.map(l => (14 + l.w).toFixed(1)).join(', ') : 'plus large ' + Math.max(...r.lignes.map(l => 14 + l.w)).toFixed(1) + ' / ' + (r.W - 14) + ' px');
    } catch (e) { check('A4 vrai navigateur : execution', false, e.message); } finally { B.close(); } }
  /* 5. chantier A6 — Long Animation Frames, dans le VRAI Chromium (meme S22). A4 : Chromium attribue toute tâche
     longue a (self, unknown). Ici on constate (a) 'long-animation-frame' detecte au lancement (LF_ST=1) ;
     (b) une tâche de SCRIPT forcee (setTimeout qui boucle 150 ms) : la ligne ecrite dit « loaf N ms : script »
     et nomme un script de >= 140 ms ; (c) un setTimeout qui ne fait que DORMIR 150 ms : AUCUN script de
     minuterie dans scripts[] (on recopie ce que le navigateur a livre pendant ce temps) ; (d) chaque ligne tient.
     Un second observateur, BRUT, recopie scripts[] tel quel (invoker, sourceFunctionName, duree, reflow force). */
  { const B = await launch(), H = s => B.ev(s).catch(e => ({ err: e.message }));
    try {
      await B.cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2.625, mobile: true });
      await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await B.nav('file://' + html);
      for (let i = 0; i < 80; i++) { await sleep(250); if (await H("typeof startGame==='function'&&typeof MAINCTX!=='undefined'&&document.readyState==='complete'") === true) break; }
      for (let i = 0; i < 40; i++) { if (await H('(()=>{meta.fps=true;try{if(!G||G.state!=="play"){startGame("bal",false);show(null);}}catch(e){}return !!G&&G.state==="play";})()') === true) break; await sleep(500); }
      await sleep(3000);
      const e = await H(`(()=>({lf:LF_ST,sup:(PerformanceObserver.supportedEntryTypes||[]).indexOf('long-animation-frame')>=0}))()`);
      check('A6 vrai navigateur : API long-animation-frame detectee au lancement (LF_ST=1)', e.lf === 1 && e.sup, JSON.stringify(e));
      await H(`(()=>{window.__R=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__R.push({t:e.startTime,d:+e.duration.toFixed(1),bloq:+e.blockingDuration.toFixed(1),
          rs:+(e.renderStart-e.startTime).toFixed(1),sls:+(e.styleAndLayoutStart-e.startTime).toFixed(1),
          sc:[...e.scripts].map(s=>({invoker:s.invoker,type:s.invokerType,fn:s.sourceFunctionName,src:s.sourceURL.split('/').pop(),d:+s.duration.toFixed(1),fsl:+s.forcedStyleAndLayoutDuration.toFixed(1)}))});}).observe({type:'long-animation-frame'});
        window.__L=[];const mc=MAINCTX,of=mc.fillText;mc.fillText=function(t,x,y){if(x===14&&String(mc.fillStyle).toLowerCase()==='#8f89b3')window.__L.push({f:FRAME,t:String(t),w:mc.measureText(String(t)).width,W});return of.apply(this,arguments);};return 1;})()`);
      const raw = async (t0) => (await H(`window.__R.filter(r=>r.t+r.d>=${t0})`)) || [];
      const brut = rs => rs.map(r => r.d + ' ms (bloq ' + r.bloq + ', renderStart +' + r.rs + ', style +' + r.sls + ') scripts=' + JSON.stringify(r.sc)).join('\n            ');
      /* (b) script force */
      let t0 = await H(`(()=>{const t=performance.now();setTimeout(()=>{const a=performance.now();while(performance.now()-a<150);},0);return t;})()`);
      let r = null, m = null, s = '';
      for (let i = 0; i < 16 && !m; i++) { await sleep(250);
        r = await H(`(()=>{const L=window.__L,fs=[...new Set(L.map(l=>l.f))];const f=fs.length>1?fs[fs.length-2]:-1;window.__L=L.filter(l=>l.f>=f);return {lignes:L.filter(l=>l.f===f),W};})()`);
        s = (r.lignes || []).map(l => l.t).join(' · '); if ((m = s.match(/loaf (\d+) ms : (script|style\/layout|ni script ni style) · (« [^»]+ » (\d+) ms|aucun script) · style \d+ ms/)) && +m[1] < 150) m = null; }
      console.log('        ce que l\'ecran ECRIT (image apres le script force) :');
      for (const l of (r && r.lignes) || []) console.log('          ' + (14 + l.w).toFixed(1).padStart(7) + ' px | ' + l.t);
      console.log('        ce que LoAF a LIVRE (brut, images >= 100 ms) :\n            ' + brut((await raw(t0)).filter(x => x.d >= 100)));
      check('A6 vrai navigateur : script force -> « loaf >= 150 ms : script » et un script NOMME de >= 140 ms', !!m && m[2] === 'script' && +m[4] >= 140, m ? m[0] : 'introuvable dans « ' + s.slice(s.indexOf('loaf'), s.indexOf('loaf') + 160) + ' »');
      const trop = ((r && r.lignes) || []).filter(l => 14 + l.w > l.W - 14 + .5);
      check('A6 vrai navigateur : chaque ligne tient dans W - pad (detail LoAF compris)', r && r.lignes && r.lignes.length > 0 && !trop.length, trop.length ? 'deborde : ' + trop.map(l => (14 + l.w).toFixed(1)).join(', ') : 'plus large ' + Math.max(...r.lignes.map(l => 14 + l.w)).toFixed(1) + ' / ' + (r.W - 14) + ' px');
      /* (c) setTimeout qui DORT : la minuterie ne tient pas le fil, elle ne doit pas apparaitre comme script */
      await sleep(1500);
      t0 = await H(`(()=>{const t=performance.now();window.__DORT=0;setTimeout(()=>{window.__DORT=performance.now()-t;},150);return t;})()`);
      await sleep(1500);
      const rd = await raw(t0), dort = await H('window.__DORT'), tm = rd.filter(x => x.sc.some(q => /setTimeout/.test(q.invoker)));
      console.log('        setTimeout qui DORT 150 ms (rappel apres ' + (+dort).toFixed(1) + ' ms) — LoAF livres dans les 1,5 s : ' + rd.length + (rd.length ? '\n            ' + brut(rd) : ''));
      check('A6 vrai navigateur : un setTimeout qui DORT n\'apparait comme script dans AUCUNE image longue', dort >= 150 && !tm.length, tm.length ? 'minuterie vue : ' + brut(tm) : rd.length + ' image(s) longue(s), aucune avec un script de minuterie');
    } catch (e) { check('A6 vrai navigateur : execution', false, e.message); } finally { B.close(); } }
  console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
