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
  console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
