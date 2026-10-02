'use strict';
/* =========================================================
   Garde-fou de la DEGRADATION PAR BUDGET (SKIPD : decide par la boucle, lu par le rendu).

   Ce que ce test defend, dans cet ordre d'importance :
     1. **Machine saine = aucun changement.** Un mecanisme de degradation qui se declenche a
        tort est une regression, pas une protection : sans charge, SKIPD doit rester a 0.
     2. Quand une image ne tient pas son budget, ce sont les postes dont l'absence ne se voit
        pas qui cedent — meteo et indicateurs (cran 1), puis halos (cran 2).
     3. **Jamais le monde ni le joueur**, a aucun niveau.

   On execute la VRAIE `render()` : modules charges dans un DOM stube, on pose SKIPD, on appelle
   render(), et on compte les appels aux fonctions concernees PAR LEUR NOM. Aucune copie du code.

   node test/degradation.js              arbre de travail
   node test/degradation.js --ref=X      code d'un commit ; aee4e5f (d'origine, sans SKIPD) doit ECHOUER : temoin
   Code de sortie : 0 si tout passe, 1 sinon.

   Refonte en îlots (02/10/2026) : chargement par le socle commun (test/lib.js : modules et début de partie
   propres au commit). render() (g3.js) ne fait plus céder que drawWeather et drawIndicators (cran 1) et
   drawLowGlows (cran 2). RETIRÉS avec la refonte : drawLabels (étiquettes de lieux, plus de monuments ni de
   sites nommés) et drawMinimap (plus de mini-carte) — leurs critères ne valent plus que sur un commit
   d'avant la refonte (--ref=), où la liste d'origine est reprise telle quelle.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
const GAME = L.mkGame({ ref: REF, w: 800, h: 600 });
const call = GAME.call;
const AVANT = L.ordre(REF).order.includes('gs.js');   /* commit d'avant la refonte en îlots */
/* aide locale (test/lib.js ne fabrique une toile que pour #cv) : sur un ancien commit (--ref=), le calque des halos
   était un <canvas id="low"> du shell, lu par lowBegin au rendu ; l'ancien banc le fournissait, on le fournit aussi */
for (const id of ['low', 'hgPrev']) { const el = GAME.doc.createElement('canvas'); el.id = id; el.width = 800; el.height = 600; GAME.stash.set(id, el); }

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

/* postes décoratifs : [nom, cran où il cède, contrôlé dessiné au cran 0] */
const DECT = AVANT ? [['drawWeather', 1, 1], ['drawIndicators', 1, 1], ['drawLabels', 2, 1], ['drawLowGlows', 2, 1], ['drawMinimap', 2, 0]]
  : [['drawWeather', 1, 1], ['drawIndicators', 1, 1], ['drawLowGlows', 2, 1]];
const DECO = DECT.map(d => d[0]), DECO1 = DECT.filter(d => d[1] === 1).map(d => d[0]);
const CORE = ['drawChunks', 'drawPlayer', 'drawEnemies'];

/* ---------- instrumentation par nom : on compte, on ne copie rien ---------- */
call(`
__CNT={};__MISS=[];
__ALL=${JSON.stringify([].concat(DECO, CORE))};
for(var i=0;i<__ALL.length;i++){(function(n){
  var f=globalThis[n];
  if(typeof f!=='function'){__MISS.push(n);return;}
  globalThis[n]=function(){ __CNT[n]=(__CNT[n]||0)+1; return f.apply(this,arguments); };
})(__ALL[i]);}
`);
const MISS = JSON.parse(call(`JSON.stringify(__MISS)`));

const hasSkipd = call(`typeof SKIPD==='number'`);
check('la boucle expose un niveau de dégradation numérique (SKIPD)', hasSkipd,
  hasSkipd ? 'SKIPD=' + call('SKIPD') : 'absent : le rendu ne peut rien céder');
check('instrumentation : les fonctions surveillées existent', MISS.length === 0,
  MISS.length ? 'introuvables : ' + MISS.join(', ') : DECO.length + ' décoratives + ' + CORE.length + ' essentielles');

/* ---------- une partie en cours, pour que render() ait de quoi dessiner ---------- */
GAME.start(); call(`G.state='play';`);

/* dessine n images au niveau demande, puis rend le compte d'appels de la derniere */
function drawAt(level, n) {
  call(`__CNT={};`);
  for (let i = 0; i < n; i++) { GAME.advance(16.7); call(`SKIPD=${level};render(1,16.7);`); }
  return JSON.parse(call(`JSON.stringify(__CNT)`));
}
const drawn = (c, n) => (c[n] || 0) > 0 || MISS.includes(n);
const undrawn = (c, n) => (c[n] || 0) === 0 || MISS.includes(n);

/* ================= S1 — machine saine : rien ne doit ceder ================= */
{
  const c = drawAt(0, 3);
  check('niveau 0 : tous les postes décoratifs sont dessinés',
    DECT.filter(d => d[2]).every(d => drawn(c, d[0])), 'appels/3 images : ' + JSON.stringify(c));
}

/* ================= S2 — niveau 1 : la meteo et les indicateurs cedent ================= */
{
  const c = drawAt(1, 3);
  check('niveau 1 : météo et indicateurs ne sont plus dessinés',
    DECO1.every(n => undrawn(c, n)), 'appels/3 images : ' + JSON.stringify(c));
  check('niveau 1 : le monde et le joueur sont TOUJOURS dessinés',
    ['drawChunks', 'drawPlayer'].every(n => drawn(c, n)), 'drawChunks=' + (c.drawChunks || 0) + ' drawPlayer=' + (c.drawPlayer || 0));
  check(`niveau 1 : ${AVANT ? 'étiquettes et halos restent' : 'les halos restent'} (cran suivant seulement)`,
    DECT.filter(d => d[1] === 2 && d[2]).every(d => drawn(c, d[0])), DECT.filter(d => d[1] === 2 && d[2]).map(d => d[0] + '=' + (c[d[0]] || 0)).join(' '));
}

/* ================= S3 — niveau 2 : les halos cedent aussi (et, avant la refonte, etiquettes et mini-carte) ================= */
{
  const c = drawAt(2, 3);
  check('niveau 2 : tous les postes décoratifs ont cédé',
    DECO.every(n => undrawn(c, n)), 'appels/3 images : ' + JSON.stringify(c));
  check('niveau 2 : le monde, le joueur et les ennemis sont TOUJOURS dessinés',
    CORE.every(n => drawn(c, n)), 'drawChunks=' + (c.drawChunks || 0) + ' drawPlayer=' + (c.drawPlayer || 0) + ' drawEnemies=' + (c.drawEnemies || 0));
}

/* ================= S4 — machine saine, la boucle ne doit pas dégrader =================
   Le critere le plus important : un mecanisme de degradation qui se declenche sans raison est
   une regression. On fait tourner la VRAIE boucle a intervalle normal et SKIPD doit rester 0. */
{
  let err = '';
  try {
    call(`SKIPD=0;last=0;`);
    for (let i = 0; i < 240; i++) { GAME.advance(16.7); call(`frame(${GAME.clock()})`); }
  } catch (e) { err = String(e && e.message || e); }
  const v = err ? -1 : call('SKIPD');
  check('machine saine : 240 images à 16,7 ms sans charge → SKIPD reste 0',
    !err && v === 0, err ? 'exception : ' + err : 'SKIPD=' + v);
}

/* ================= verdict ================= */
let all = true;
for (const c of checks) { if (!c.ok) all = false; console.log((c.ok ? '  OK  ' : ' ECHEC') + ' ' + c.name + (c.detail ? '  — ' + c.detail : '')); }
console.log(all ? '\nDEGRADATION : TOUT PASSE' : '\nDEGRADATION : ECHEC');
process.exit(all ? 0 : 1);
