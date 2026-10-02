'use strict';
/* =========================================================
   Garde-fou du CONTROLEUR DE QUALITE (perf(), g4.js).

   Ce que ce test defend : la qualite adaptative doit pouvoir REMONTER, et elle ne doit
   jamais etre rabaissee pour une raison qui n'est pas une vraie perte de fluidite.
   Avant le 28/09/2026, `perf()` ne savait que descendre et `meta.qAuto` figeait le
   plancher a vie : sur un ecran 90/120 Hz, un jeu a 60 ips parfaitement fluide tombait
   au plancher en 8 s. Et `QL--` n'appelait pas `applyRes()`, donc l'ecran gardait les
   pixels de l'ancien cran.

   On execute la VRAIE `perf()` : les modules du jeu sont charges dans un DOM stubé, puis
   on lui donne des intervalles d'image synthetiques. Aucune copie du code du jeu.

   node test/qualite.js              arbre de travail
   node test/qualite.js --ref=X      code d'un commit ; f9b167d (d'origine) doit ECHOUER : c'est le temoin
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
/* Refonte en îlots (02/10/2026) : chargement par le socle commun (test/lib.js : modules lus dans build.sh, à
   l'arbre ou au commit --ref=, DOM stubé, horloge virtuelle), début de partie propre au commit (L.startCode).
   Aucun critère retiré : perf(), applyQuality() et applyRes() n'ont pas changé de sujet. */
const L = require('./lib');
const REF = L.ARG('ref');
const GAME = L.mkGame({ ref: REF, w: 800, h: 600 });
const call = GAME.call;

/* ---------- instruments ---------- */
const PERF = call('(function(dt){perf(dt);})');
const STATE = call('(function(){return JSON.stringify({QL:QL,RES:RES,ref:REFDT,refn:REFN,qa:meta.qAuto,w:cv.width,h:cv.height,ps:PS});})');
const st = () => JSON.parse(STATE());

/* DPR=2 : sans cela, PS vaut 1 a tous les crans et la coherence QL/RES <-> pixels est invisible.
   C'est le cas d'un telephone (DPR plafonne a 2 par g3.js:10). */
call('DPR=2');

function reset(qAuto) {
  call(`G.state='play';meta.q='auto';meta.qAuto=${qAuto ? JSON.stringify(qAuto) : 'null'};QL=3;RES=1;REFDT=0;REFN=0;slowT=0;upT=0;DTH.length=0;applyQuality();`);
}

/* joue n images a intervalle constant */
function play(n, dt) { for (let i = 0; i < n; i++) { GAME.advance(dt); PERF(dt); } }
const secs = (s, dt) => play(Math.round(s * 1000 / dt), dt);

/* l'invariant : l'etat de qualite et la taille reelle du canevas doivent concorder */
function coherent(S) {
  const ps = Math.min(2, S.QL >= 3 ? 2 : S.QL === 2 ? 1.25 : 1) * S.RES;
  return Math.abs(S.w - Math.round(800 * ps)) <= 1 && Math.abs(S.ps - ps) < 1e-9;
}

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

GAME.start();

/* ================= S1 — ecran 120 Hz, jeu a 60 ips constants : rien ne doit bouger =================
   Le defaut d'origine : REFDT etait un MINIMUM historique, alimente meme hors du jeu. Un menu a
   8,3 ms (120 Hz) faisait de 16,7 ms la « lenteur » -> plancher atteint sans une seule image perdue. */
{
  reset(null);
  call(`G.state='menu';`);
  secs(6, 8.3);                    /* menu sur ecran 120 Hz : ne doit PAS devenir la reference */
  call(`G.state='play';`);
  secs(5, 16.7);                   /* etablissement de la reference (jeu reel) */
  const S0 = st();
  secs(60, 16.7);                  /* 60 s de jeu parfaitement fluide */
  const S = st();
  check('S1 ecran 120 Hz + jeu a 60 ips constants : la qualite ne baisse pas',
    S.QL === 3 && S.RES === 1,
    `reference=${S.ref.toFixed(1)} ms (apres 5 s de jeu) ; final QL/RES=${S.QL}/${S.RES} (attendu 3/1)`);
  check('S1 la reference est celle du JEU, pas celle du menu',
    S.ref > 15 && S.ref < 19, `reference=${S.ref.toFixed(1)} ms (attendu ~16,7 ; le menu a 8,3 ne doit pas la fixer)`);
  check('S1 etat de qualite coherent avec la taille du canevas', coherent(S),
    `QL/RES=${S.QL}/${S.RES} -> canvas ${S.w}x${S.h}, PS=${S.ps}`);
}

/* ================= S2 — lente puis rapide : la qualite doit REMONTER ================= */
{
  reset(null);
  secs(5, 16.7);                   /* reference */
  secs(20, 33.3);                  /* la machine rame : 30 ips */
  const SLOW = st();
  check('S2 pendant la phase lente, la qualite DESCEND bien',
    SLOW.QL < 3 || SLOW.RES < 1, `QL/RES=${SLOW.QL}/${SLOW.RES}`);
  secs(45, 16.7);                  /* la machine redevient fluide */
  const S = st();
  check('S2 apres 45 s fluides, la qualite est REMONTEE au maximum',
    S.QL === 3 && S.RES === 1,
    `apres la phase lente QL/RES=${SLOW.QL}/${SLOW.RES} ; final QL/RES=${S.QL}/${S.RES} (attendu 3/1) — un cliquet resterait bloque`);
  check('S2 plancher : la qualite persistee n\'est pas un etat definitif', coherent(S) && S.QL === 3,
    `qAuto=${S.qa} ; QL/RES=${S.QL}/${S.RES}`);
}

/* ================= S3 — hysteresis : une embellie courte ne doit pas faire remonter ================= */
{
  reset(null);
  secs(5, 16.7);
  secs(20, 33.3);
  const A = st();
  secs(2, 16.7);                   /* 2 s de mieux : trop court */
  const B = st();
  check('S3 une embellie de 2 s ne declenche PAS de remontee (pas d\'oscillation)',
    B.QL === A.QL && B.RES === A.RES,
    `avant ${A.QL}/${A.RES} -> apres 2 s fluides ${B.QL}/${B.RES} (doit etre identique)`);
}

/* ================= S4 — QL-- doit mettre a jour la taille du canevas =================
   Defaut mesuré en Chromium le 28/09/2026 : entre les deux premieres baisses, le jeu tournait
   avec QL=1 mais PS=1,5 — les effets etaient retires, les pixels non. Le defaut est TRANSITOIRE
   (la baisse suivante de RES, elle, appelait applyRes()) : il faut donc controler a chaque image,
   pas seulement a la fin. */
{
  reset(null);
  secs(5, 16.7);
  let bad = 0, badAt = '';
  for (let i = 0; i < 20 * 60; i++) {
    GAME.advance(33.3); PERF(33.3);
    if (i % 5 === 0) { const S = st(); if (!coherent(S) && !bad) { bad = 1; badAt = `QL/RES=${S.QL}/${S.RES} mais canvas ${S.w}x${S.h}, PS=${S.ps}`; } }
  }
  const S = st();
  check('S4 a chaque changement de cran, applyRes() suit (taille du canevas == cran courant)',
    !bad && coherent(S),
    bad ? `incoherence pendant la descente : ${badAt}` : `QL/RES=${S.QL}/${S.RES} -> canvas ${S.w}x${S.h}, PS=${S.ps}`);
}

/* ================= S5 — le mode manuel n'est jamais adapte ================= */
{
  reset(null);
  call(`G.state='play';meta.q='low';applyQuality();`);
  const B = st();
  secs(20, 33.3);
  const S = st();
  check('S5 mode manuel (Performance) : la qualite ne bouge pas toute seule',
    S.QL === B.QL && S.RES === B.RES, `avant ${B.QL}/${B.RES} -> apres ${S.QL}/${S.RES}`);
}

/* ================= S6 — qAuto persisté repart de la, mais peut remonter ================= */
{
  reset([1, .8]);                  /* ce que l'ancienne version laissait sur le disque */
  const B = st();
  secs(5, 16.7);
  secs(45, 16.7);
  const S = st();
  check('S6 une qualité apprise au plancher remonte si la machine le permet',
    B.QL === 1 && S.QL === 3 && S.RES === 1,
    `depart qAuto=${B.qa} -> QL/RES=${B.QL}/${B.RES} ; final ${S.QL}/${S.RES} (attendu 3/1)`);
}

/* ================= S7 — machine lente DES LA PREMIERE SECONDE : elle doit quand meme etre protegee ==
   Mesure reelle (28/09/2026, PC AMD 1920x1080, Firefox) : le joueur est a ~34 ips des le lancement,
   `image 29,4 ms`. C'est un MELANGE d'images a 16,7 ms (six sur sept) et a 33,3 ms (une sur sept, un
   vsync manque) : la MEDIANE vaut donc 16,7 et ne voit rien — c'est le p90 qui porte le symptome, et
   les drops ressentis sont exactement ces images perdues.

   Sur HEAD, la decision se prend sur la MEDIANE des intervalles : celle-ci vaut 16,7 ms (six images
   sur sept), donc `med > REFDT*1,35` (22,5 ms) n'est JAMAIS vrai et la qualite ne baisse pas d'un
   cran, meme apres des minutes. Le regulateur mesurait « la fluidite typique » alors que le symptome
   est « la proportion d'images perdues » : deux choses differentes, et la mediane est aveugle a la
   seconde par construction. La decision doit se prendre sur un centile haut (p90). */
{
  reset(null);
  /* une image sur sept manque son vsync — c'est le regime reel mesure chez le joueur */
  const mixed = (n) => { for (let i = 0; i < n; i++) { const dt = (i % 7 === 3) ? 33.3 : 16.7; GAME.advance(dt); PERF(dt); } };
  mixed(20 * 60);
  const S = st();
  check('S7 machine lente des la premiere seconde : la qualite baisse quand meme',
    S.QL < 3 || S.RES < 1,
    `apres 20 s a ~34 ips (reference=${S.ref.toFixed(1)} ms) : QL/RES=${S.QL}/${S.RES} (attendu < 3/1)`);
}

/* ---------- verdict ---------- */
console.log(`test/qualite.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
