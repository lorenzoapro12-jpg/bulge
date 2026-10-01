'use strict';
/* =========================================================
   Garde-fou du REGULATEUR EN MODE MANUEL (perf(), g4.js) — chantier P2, 30/09/2026.

   Ce que ce test defend : un mode de qualite MANUEL (« Haute », « Équilibrée », « Performance »)
   est un PLAFOND, pas un interrupteur qui eteint le regulateur.
     - quand ca saccade, QL puis RES doivent DESCENDRE sous le cran choisi ;
     - quand ca va mieux, la remontee doit revenir AU cran choisi et S'Y ARRETER, jamais au-dessus ;
     - le mode « Auto » ne doit pas avoir bouge d'un cran (trajectoire comparee a celle de TEMOIN).
   Bloc X (chantier A1) : entrees ABERRANTES — fenetre a 0,4 ms, rafale breve a 8 ms, reprise apres
   pause. La reference doit rester plausible et le regulateur ne doit ni tomber ni rester verrouille.
   Bloc R (chantier R2) : la reference doit pouvoir REMONTER — debut leger PUIS 60 ips (l'ordre du S22),
   saccade toujours combattue, jeu uniformement lent (decision ecrite), delai de revision borne des deux cotes.

   Fait mesure a l'origine (S22 du proprietaire) : 46 ips / pire 59 ms et 58 ips / pire 25 ms avec
   exactement le meme « effets 2/3 · PS 1.25 · ref 0.0 ms » — perf() sortait des que meta.q!=='auto'.

   On execute la VRAIE `perf()` (modules charges dans un DOM stube, comme test/qualite.js) et on lui
   donne des intervalles d'image FABRIQUES ICI : aucune lecture du temps reel, aucun tirage. Deux
   executions sur le meme arbre rendent donc la meme sortie, octet pour octet.

   node test/regule.js              arbre de travail
   node test/regule.js --ref=HEAD   code d'un commit (sur l'ancien code : doit ECHOUER en nommant la cause)
   node test/regule.js --temoin=X   commit de reference du mode Auto (defaut cd10e7c, avant le chantier)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), TEMOIN = ARG('temoin') || 'cd10e7c';
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = (ref, f) => ref ? cp.execFileSync('git', ['show', ref + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- une instance du jeu (stubs repris de test/qualite.js), horloge virtuelle propre ---------- */
function mkGame(ref) {
  let CLOCK = 0, TID = 0;
  const TIMERS = [];
  function mkCtx() {
    const grad = { addColorStop() {} };
    const base = {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      createRadialGradient: () => grad, createLinearGradient: () => grad,
      createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
    };
    return new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => (t[p] = v, true) });
  }
  function mkStyle() { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: (k) => { const v = s[k]; delete s[k]; return v || ''; } }, getPropertyValue: { value: (k) => (s[k] || '') } }); return s; }
  function mkClassList() { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) }; }
  function mkListeners() { const L = {}; return { add: (t, fn) => (L[t] = L[t] || []).push(fn), fire: (t, e) => (L[t] || []).forEach(fn => fn(e)), has: (t) => !!(L[t] && L[t].length) }; }
  const doc = { activeElement: null };
  function mkEl(id, tag) {
    const L = mkListeners(), attrs = {};
    return {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: mkStyle(), classList: mkClassList(), dataset: {},
      hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', className: '', offsetWidth: 0, offsetHeight: 0, parentElement: null,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }),
      setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
      closest: () => null, focus: () => {}, blur() {}, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: (t, fn) => L.add(t, fn), removeEventListener() {}, _fire: L.fire, _has: L.has,
      after() {}, appendChild: (c) => c, setPointerCapture() {}, releasePointerCapture() {},
    };
  }
  function mkCanvasEl(w, h, id) { const el = mkEl(id, 'canvas'); el.width = w || 300; el.height = h || 150; el.getContext = () => mkCtx(); return el; }
  const stash = new Map();
  Object.assign(doc, {
    hidden: false,
    getElementById(id) { if (!stash.has(id)) { const el = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvasEl(800, 600, id) : mkEl(id); if (id === 'cv') el.parentElement = mkEl('stage'); stash.set(id, el); } return stash.get(id); },
    createElement: (t) => (t === 'canvas' ? mkCanvasEl() : mkEl('', t)),
    querySelectorAll: () => [], querySelector: () => null, body: mkEl('body', 'body'),
  });
  const DOCL = mkListeners(); doc.addEventListener = DOCL.add;
  const WINL = mkListeners();
  const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener: WINL.add, removeEventListener() {} };
  const sandbox = {
    window: win, document: doc, console, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => CLOCK }, requestAnimationFrame: win.requestAnimationFrame,
    setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; },
    clearTimeout: (id) => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); },
    setInterval: () => 0, clearInterval() {},
    getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }),
    addEventListener: WINL.add, removeEventListener() {},
    Date: Object.assign(function () { return new Date(0); }, { now: () => CLOCK }),   /* pas de temps reel dans le bac */
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const call = (e) => vm.runInContext(e, ctx);
  call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})()`);
  vm.runInContext(ORDER.map(f => readModule(ref, f)).join('\n'), ctx, { filename: 'game.js' });
  const PERF = call('(function(dt){perf(dt);})');
  const STATE = call('(function(){return JSON.stringify({QL:QL,RES:RES,ref:REFDT,q:meta.q||"auto",qa:meta.qAuto||null,w:cv.width,h:cv.height,ps:PS});})');
  const st = () => JSON.parse(STATE());
  /* DPR=2 (telephone) : sans cela PS vaut 1 a tous les crans et la coherence cran <-> pixels est invisible */
  call('DPR=2');
  call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();`);
  /* pose une qualite comme le fait le bouton « Qualité » puis startGame : meta.q, applyQuality(), refReset() */
  const pose = (q, qAuto) => call(`G.state='play';meta.q=${JSON.stringify(q)};meta.qAuto=${qAuto ? JSON.stringify(qAuto) : 'null'};applyQuality();refReset();`);
  /* joue n images ; dtOf(i) fabrique l'intervalle ; vu(S) est appele apres CHAQUE image */
  const play = (n, dtOf, vu) => { for (let i = 0; i < n; i++) { const dt = dtOf(i); CLOCK += dt; PERF(dt); if (vu) vu(st()); } };
  return { call, st, pose, play };
}

/* ---------- regimes fabriques (aucune horloge reelle) ---------- */
const SAIN = () => 16.7;                               /* 60 ips constants */
const SACCADE = (i) => (i % 5 === 2 ? 33.3 : 16.7);    /* une image sur cinq manque son vsync : ~50 ips, p90 = 33,3 ms */
const IMG = s => Math.round(s * 60);

/* l'invariant de test/qualite.js : l'etat de qualite et la taille reelle du canevas concordent */
function coherent(S) {
  const ps = Math.min(2, S.QL >= 3 ? 2 : S.QL === 2 ? 1.25 : 1) * S.RES;
  return Math.abs(S.w - Math.round(800 * ps)) <= 1 && Math.abs(S.ps - ps) < 1e-9;
}

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const J = S => `${S.QL}/${S.RES}`;

const GAME = mkGame(REF);
const CRAN = { high: [3, 1], mid: [2, 1], low: [1, .8] }, NOM = { high: 'Haute', mid: 'Équilibrée', low: 'Performance' };

/* ================= M — pour chaque mode manuel : descente sous saccade, remontee bornee au cran ================= */
for (const q of ['mid', 'high', 'low']) {
  const [cQL, cRES] = CRAN[q], T = `${q} (« ${NOM[q]} », cran ${cQL}/${cRES})`;
  GAME.pose(q, null);
  const D = GAME.st();
  check(`${T} : depart au cran choisi`, D.QL === cQL && D.RES === cRES && D.q === q, `QL/RES=${J(D)}, meta.q=${D.q}`);

  /* pendant TOUTE la sequence : jamais au-dessus du cran, pixels coherents, meta.q et meta.qAuto intacts */
  let haut = '', incoh = '', touche = '';
  const vu = (S) => {
    if (!haut && (S.QL > cQL || S.RES > cRES)) haut = `QL/RES=${J(S)} au-dessus du cran ${cQL}/${cRES}`;
    if (!incoh && !coherent(S)) incoh = `QL/RES=${J(S)} mais canvas ${S.w}x${S.h}, PS=${S.ps}`;
    if (!touche && (S.q !== q || S.qa !== null)) touche = `meta.q=${S.q}, meta.qAuto=${JSON.stringify(S.qa)}`;
  };

  GAME.play(IMG(5), SAIN, vu);                 /* etablissement de la reference */
  const R = GAME.st();
  GAME.play(IMG(30), SACCADE, vu);             /* 30 s qui saccadent */
  const B = GAME.st();
  const cause = B.ref === 0
    ? `CAUSE : REFDT=0 apres 35 s de jeu — perf() sort avant toute decision des que meta.q!=='auto' (le mode manuel ETEINT le regulateur)`
    : `reference=${B.ref.toFixed(1)} ms`;
  if (q === 'low') {
    /* deja au plancher : rien a retirer, mais le regulateur doit TOURNER (reference mesuree) */
    check(`${T} : deja au plancher, reste au plancher sous saccade`, B.QL === 1 && B.RES === .8, `apres 30 s de saccade QL/RES=${J(B)}`);
  } else {
    check(`${T} : sous saccade, les effets (QL) DESCENDENT`, B.QL < cQL,
      `depart ${J(D)} -> apres 30 s de saccade ${J(B)} (attendu QL < ${cQL}) ; ${cause}`);
    check(`${T} : sous saccade prolongee, la resolution (RES) DESCEND aussi (dernier recours)`, B.QL === 1 && B.RES < cRES,
      `depart ${J(D)} -> apres 30 s de saccade ${J(B)} (attendu 1/0.8) ; ${cause}`);
  }
  check(`${T} : la reference de periode d'ecran est mesuree (« ref » du compteur ≠ 0)`, R.ref > 15 && R.ref < 19 && B.ref > 15 && B.ref < 19,
    `REFDT=${R.ref.toFixed(1)} ms apres 5 s saines, ${B.ref.toFixed(1)} ms apres la saccade (attendu ~16,7)` + (B.ref === 0 ? ` ; ${cause}` : ''));

  GAME.play(IMG(90), SAIN, vu);                /* 90 s saines : bien plus qu'il n'en faut pour remonter de deux crans */
  const F = GAME.st();
  check(`${T} : regime sain, la remontee REVIENT au cran choisi`, F.QL === cQL && F.RES === cRES && (q === 'low' || B.QL < cQL),
    `apres saccade ${J(B)} -> apres 90 s saines ${J(F)} (attendu ${cQL}/${cRES})` + (q !== 'low' && B.QL >= cQL ? ` ; rien n'etait descendu : ${cause}` : ''));
  check(`${T} : la remontee S'ARRETE au cran choisi — jamais au-dessus, a aucune image`, !haut,
    haut || `${IMG(125)} images controlees une a une, aucune au-dessus de ${cQL}/${cRES} ; final ${J(F)}`);
  check(`${T} : pixels coherents avec le cran a chaque image (applyRes suit)`, !incoh, incoh || `final canvas ${F.w}x${F.h}, PS=${F.ps}`);
  check(`${T} : le choix du joueur (meta.q) et la qualite apprise du mode Auto (meta.qAuto) ne sont pas touches`, !touche,
    touche || `meta.q=${F.q}, meta.qAuto=${JSON.stringify(F.qa)}`);
}

/* ================= H — hysteresis conservee en manuel : une embellie de 2 s ne fait pas remonter ================= */
{
  GAME.pose('mid', null);
  GAME.play(IMG(5), SAIN); GAME.play(IMG(30), SACCADE);
  const A = GAME.st();
  GAME.play(IMG(2), SAIN);
  const B = GAME.st();
  check('mid : une embellie de 2 s ne declenche pas de remontee (asymetrie conservee)', A.QL < 2 && B.QL === A.QL && B.RES === A.RES,
    `apres saccade ${J(A)} -> apres 2 s saines ${J(B)} (doit etre identique, et sous 2/1)`);
}

/* ================= P — le cran choisi est un POINT DE DEPART : une nouvelle partie y repart ================= */
{
  GAME.pose('mid', null);
  GAME.play(IMG(5), SAIN); GAME.play(IMG(30), SACCADE);
  const A = GAME.st();
  GAME.call('applyQuality();refReset();');      /* ce que fait startGame (g4.js) */
  const B = GAME.st();
  check('mid : apres une descente, la partie suivante repart du cran choisi', A.QL < 2 && B.QL === 2 && B.RES === 1,
    `fin de partie ${J(A)} -> applyQuality() ${J(B)} (attendu 2/1)`);
}

/* ================= A — le mode Auto n'a pas bouge : meme trajectoire que TEMOIN, image par image ================= */
{
  const traj = (g) => {
    const out = [];
    const vu = (S) => out.push(S.QL + '/' + S.RES + '/' + S.ref.toFixed(3) + '/' + JSON.stringify(S.qa) + '/' + S.w);
    for (const qa of [null, [1, .8]]) {
      g.pose('auto', qa);
      g.play(IMG(5), SAIN, vu); g.play(IMG(30), SACCADE, vu); g.play(IMG(90), SAIN, vu);
      g.play(IMG(20), () => 33.3, vu); g.play(IMG(2), SAIN, vu); g.play(IMG(10), (i) => (i % 7 === 3 ? 33.3 : 16.7), vu);
    }
    return out;
  };
  let ok = false, detail;
  try {
    const a = traj(GAME), b = traj(mkGame(TEMOIN));
    let k = -1; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { k = i; break; }
    const crans = new Set(a.map(s => s.split('/').slice(0, 2).join('/')));
    ok = k < 0 && crans.has('3/1') && crans.has('1/0.8');
    detail = k < 0 ? `${a.length} images identiques a ${TEMOIN} (QL/RES/REFDT/qAuto/canvas) ; crans parcourus : ${[...crans].join(' ')}`
      : `diverge a l'image ${k} : ici ${a[k]} , ${TEMOIN} ${b[k]}`;
  } catch (e) { detail = `temoin ${TEMOIN} illisible : ${String(e.message || e).split('\n')[0]}`; }
  check(`Auto : trajectoire identique a ${TEMOIN}, image par image (descente, remontee, qAuto persiste)`, ok, detail);
}

/* ================= X — entrees ABERRANTES (chantier A1, 30/09/2026) =================
   Fait mesure (S22 du proprietaire) : « 65 ips · image 15.4 ms … régul plafond mid ↓ 1/3 ×0.90 … ref 0.4 ms ».
   0,4 ms = 2500 Hz : aucune dalle. La reference etait le MINIMUM BRUT des medianes, donc une seule fenetre
   aberrante la verrouillait pour la partie : p90 > 1,35×0,4 toujours vrai (descente permanente), mediane
   < 1,10×0,4 jamais vraie (aucune remontee). P2 n'avait teste que des entrees saines ; ce bloc teste le bruit.
   PLANCHER = 4 ms (250 Hz) : une reference en dessous n'est pas une periode d'ecran. */
const PLANCHER = 4;
const S15 = () => 15.4;                                /* le regime du S22 : 65 ips */
const ABS = () => 0.4;                                 /* rafale de rappels rAF : mediane absurde */
const RAF8 = () => 8;                                  /* rafale PLAUSIBLE (120 Hz) mais breve, sur un ecran 60 Hz */
/* suit une sequence : pire reference non nulle, pire cran, et le cran final */
function suivi(g, etapes) {
  let refMin = Infinity, qMin = '9/9', bas = null;
  const vu = (S) => {
    if (S.ref > 0 && S.ref < refMin) refMin = S.ref;
    if (!bas || S.QL < bas.QL || (S.QL === bas.QL && S.RES < bas.RES)) { bas = S; qMin = J(S); }
  };
  for (const e of etapes) typeof e === 'string' ? g.call(e) : g.play(e[0], e[1], vu);
  return { refMin, qMin, F: g.st() };
}
const cause0 = (r) => r < PLANCHER ? ` ; CAUSE : la reference a pris ${r.toFixed(1)} ms — REFDT est le minimum BRUT des medianes, une fenetre aberrante la verrouille (g4.js, perf())` : '';
const plausible = (r) => r >= PLANCHER && r > 14 && r < 17;
const PAUSE = [`G.state='pause'`, [1, S15], `G.state='play'`];   /* sortie de play : perf() appelle refReset() */

/* X1 — Auto au cran haut : une fenetre absurde au milieu de 15,4 ms ne doit RIEN changer */
for (const [q, qa, cran] of [['auto', null, '3/1'], ['mid', null, '2/1']]) {
  GAME.pose(q, qa);
  const R = suivi(GAME, [[IMG(10), S15], [120, ABS], [IMG(60), S15]]);
  check(`${q} : fenetre absurde (120 images a 0,4 ms) — la reference reste PLAUSIBLE (jamais sous ${PLANCHER} ms, ~15,4 ms)`,
    R.refMin >= PLANCHER && plausible(R.F.ref), `pire REFDT=${R.refMin.toFixed(2)} ms, final ${R.F.ref.toFixed(2)} ms` + cause0(R.refMin));
  check(`${q} : fenetre absurde — la qualite ne tombe PAS pour rien (reste ${cran} a toute image)`, R.qMin === cran && J(R.F) === cran,
    `pire cran ${R.qMin}, final ${J(R.F)} (le jeu tient 65 ips du debut a la fin)` + cause0(R.refMin));
}

/* X2 — l'etat du proprietaire : deja au plancher (qAuto 1/0.8 appris), fenetre absurde, puis 90 s saines : il DOIT remonter */
{
  GAME.pose('auto', [1, .8]);
  const R = suivi(GAME, [[IMG(10), S15], [120, ABS], [IMG(90), S15]]);
  check(`auto depuis le plancher 1/0.8 : apres une fenetre absurde puis 90 s a 65 ips, la remontee se DECLENCHE (pas de verrou)`,
    J(R.F) === '3/1', `final ${J(R.F)} (attendu 3/1), REFDT=${R.F.ref.toFixed(2)} ms` + cause0(R.refMin));
}
/* X2b — meme chose en manuel « Équilibrée » apres une vraie descente (le libelle « plafond mid ↓ » du S22) */
{
  GAME.pose('mid', null);
  const R = suivi(GAME, [[IMG(5), SAIN], [IMG(30), SACCADE], [120, ABS], [IMG(90), S15]]);
  check(`mid descendu par saccade, puis fenetre absurde, puis 90 s saines : remonte AU cran 2/1`,
    J(R.F) === '2/1' && R.qMin !== '2/1', `pire cran ${R.qMin}, final ${J(R.F)} (attendu 2/1), REFDT=${R.F.ref.toFixed(2)} ms` + cause0(R.refMin));
}

/* X3 — rafale PLAUSIBLE mais BREVE (90 images a 8 ms, > plancher) sur un ecran 60 Hz : ne doit pas devenir la reference */
{
  GAME.pose('auto', null);
  const R = suivi(GAME, [[IMG(10), SAIN], [90, RAF8], [IMG(60), SAIN]]);
  check(`auto : rafale breve a 8 ms (plausible, au-dessus du plancher) — la reference reste ~16,7 ms, la qualite reste 3/1`,
    R.refMin > 16 && J(R.F) === '3/1' && R.qMin === '3/1',
    `pire REFDT=${R.refMin.toFixed(2)} ms, pire cran ${R.qMin}, final ${J(R.F)}` + (R.refMin < 16 ? ` ; CAUSE : une seule fenetre breve a abaisse la reference (minimum brut)` : ''));
}

/* X4 — REPRISE : sortie puis retour en play (refReset), et la rafale tombe juste a la reprise */
for (const [nom, raf] of [['rafale absurde (0,4 ms)', [120, ABS]], ['rafale breve a 8 ms', [90, RAF8]]]) {
  GAME.pose('auto', null);
  const R = suivi(GAME, [[IMG(10), S15], ...PAUSE, raf, [IMG(60), S15]]);
  check(`auto, reprise apres pause suivie d'une ${nom} : reference plausible et qualite 3/1 conservee`,
    plausible(R.F.ref) && R.refMin >= PLANCHER && J(R.F) === '3/1' && R.qMin === '3/1',
    `pire REFDT=${R.refMin.toFixed(2)} ms, final ${R.F.ref.toFixed(2)} ms, pire cran ${R.qMin}, final ${J(R.F)}` + cause0(R.refMin)
    + (R.refMin >= PLANCHER && R.F.ref < 14 ? ` ; CAUSE : la premiere fenetre apres refReset() a fixe seule la reference` : ''));
}

/* X5 — une VRAIE lenteur reste vue malgre le filtre : ecran 60 Hz, jeu a 30 ips -> descente (le filtre n'aveugle pas) */
{
  GAME.pose('auto', null);
  const R = suivi(GAME, [[IMG(5), SAIN], [120, ABS], [IMG(20), () => 33.3]]);
  check(`auto : apres une fenetre absurde, une vraie lenteur (30 ips sur ecran 60 Hz) fait toujours DESCENDRE`,
    R.F.QL === 1 && R.F.RES === .8 && R.F.ref > 16 && R.F.ref < 17.5, `final ${J(R.F)} (attendu 1/0.8), REFDT=${R.F.ref.toFixed(2)} ms`);
}

/* ================= R — la reference doit pouvoir REMONTER (chantier R2, 01/10/2026) =================
   Fait mesure (S22 du proprietaire, artefact 1167a527…) : « 60 ips · image 16.6 ms … régul plafond mid ↓ 1/3 ×0.80
   … ref 8.4 ms ». REFDT etait un MINIMUM entre deux refReset() : un debut de partie leger (~2 s a 8,3 ms, ecran
   120 Hz) la fixait a 8,3, puis 16,6 ms passait pour lent a vie — p90 > 1,35×8,3 toujours vrai (descente),
   mediane < 1,10×8,3 jamais vraie (remontee impossible). Les blocs X1/X3 ne testaient que l'ordre inverse
   (sain PUIS rafale) : avec un minimum historique, c'est l'ORDRE qui decide. */
const R120 = () => 8.3;                                /* debut de partie leger sur ecran 120 Hz */
const LENT = () => 33.3;
const cliquet = (r) => r < 10 ? ` ; CAUSE : reference restee a ${r.toFixed(1)} ms — cliquet, REFDT est un minimum historique (g4.js, perf()), elle ne remonte jamais` : '';

/* R1 — l'ordre du proprietaire : 240 images a 8,3 ms (2 s reelles a 120 Hz) puis 90 s a 16,7 ms, manuel « Équilibrée » */
{
  GAME.pose('mid', null);
  let haut = '';
  const vu = (S) => { if (!haut && (S.QL > 2 || S.RES > 1)) haut = `QL/RES=${J(S)} au-dessus du cran 2/1`; };
  GAME.play(240, R120, vu);
  const A = GAME.st();
  GAME.play(IMG(90), SAIN, vu);
  const F = GAME.st();
  check(`R1 mid, ordre du proprietaire (2 s a 8,3 ms PUIS 90 s a 16,7 ms) : la reference ne reste pas a 8,3 ms`,
    A.ref < 9 && F.ref > 16 && F.ref < 17.5,
    `REFDT=${A.ref.toFixed(2)} ms apres le debut leger, ${F.ref.toFixed(2)} ms apres 90 s a 60 ips (attendu ~16,7)` + cliquet(F.ref)
    + (A.ref >= 9 ? ` ; BANC : le debut leger n'a pas abaisse la reference, le cas n'est pas reproduit` : ''));
  check(`R1 mid, ordre du proprietaire : la qualite REMONTE a 2/1 (la machine tient 60 ips)`, J(F) === '2/1',
    `final ${J(F)} (attendu 2/1)` + cliquet(F.ref));
  /* cas 4 — en manuel la remontee s'arrete au cran choisi : controle image par image sur toute la sequence */
  check(`R1 mid : la remontee s'arrete a 2/1, jamais au-dessus, a aucune image`, !haut, haut || `${240 + IMG(90)} images controlees, final ${J(F)}`);
}

/* R2 — regime IRREGULIER (majorite 16,7, pointes 33,3), y compris apres que la reference a remonte : la descente
   doit TOUJOURS se declencher, et la reference ne doit pas suivre les pointes (la mediane reste 16,7). */
for (const [nom, pre, irr] of [
  ['1 image sur 5 a 33,3 ms', [[IMG(5), SAIN]], SACCADE],
  ['1 image sur 7 a 33,3 ms', [[IMG(5), SAIN]], (i) => (i % 7 === 3 ? 33.3 : 16.7)],
  ['apres l\'ordre du proprietaire, 1 image sur 5 a 33,3 ms', [[240, R120], [IMG(90), SAIN]], SACCADE]]) {
  for (const q of ['auto', 'mid']) {
    GAME.pose(q, null);
    const P = suivi(GAME, pre).F;                /* avant l'irregularite : la qualite doit etre AU cran, sinon rien a prouver */
    const R = suivi(GAME, [[IMG(120), irr]]);
    check(`R2 ${q}, ${nom} pendant 120 s : la descente se declenche (depuis le cran) et la qualite RESTE au plancher 1/0.8`,
      J(P) === J({ QL: CRAN[q === 'auto' ? 'high' : q][0], RES: 1 }) && J(R.F) === '1/0.8' && R.F.ref > 16 && R.F.ref < 17.5,
      `avant ${J(P)}, final ${J(R.F)} (attendu 1/0.8), REFDT=${R.F.ref.toFixed(2)} ms (attendu ~16,7 : les pointes ne deviennent pas la reference)` + cliquet(R.F.ref));
  }
}

/* R3 — jeu UNIFORMEMENT a 33,3 ms. Ce que l'instrument decide, ecrit ici pour qu'aucun changement ne le deplace en silence :
   a) des le debut : la reference S'ETABLIT a 33,3 ms (2 premieres secondes de jeu), rien ne descend. Aveugle par
      construction — c'etait deja le cas avant R2 (l'etablissement prend le maximum glissant), R2 n'y change rien.
   b) apres 5 s saines : descente au plancher 1/0.8 (X5) ; puis, si le PLANCHER LUI-MEME reste a 33,3 ms (~20 s
      d'images au plancher, lentes, mediane >= 1,10× la reference), la reference est revisee a 33,3 ms et la qualite
      remonte au cran : tout retirer n'a rien rendu, la lenteur ne vient pas des pixels — les garder bas ne coute
      que de la qualite. C'est exactement la situation du S22 (60 ips au plancher comme au cran). */
{
  GAME.pose('auto', null);
  const a = suivi(GAME, [[IMG(60), LENT]]);
  check(`R3a auto, 33,3 ms des la premiere image (60 s) : reference etablie a 33,3 ms, aucune descente (aveugle, comme avant R2)`,
    a.qMin === '3/1' && a.F.ref > 33 && a.F.ref < 34, `pire cran ${a.qMin}, final ${J(a.F)}, REFDT=${a.F.ref.toFixed(2)} ms`);
  GAME.pose('auto', null);
  const b1 = suivi(GAME, [[IMG(5), SAIN], [IMG(20), LENT]]);
  check(`R3b auto, 5 s saines puis 20 s a 33,3 ms : DESCENTE au plancher, reference toujours 16,7 ms`,
    J(b1.F) === '1/0.8' && b1.F.ref > 16 && b1.F.ref < 17.5, `final ${J(b1.F)}, REFDT=${b1.F.ref.toFixed(2)} ms`);
  /* le delai de revision est BORNE PAR LE BAS : une phase lourde de 25 s (descente ~10 s, puis ~15 s au plancher)
     est encore COMBATTUE — sinon la qualite remonterait au milieu d'une scene chargee. Sans ce point, un seuil
     de 300 images passait toute la garde. */
  GAME.pose('auto', null);
  const c = suivi(GAME, [[IMG(5), SAIN], [IMG(25), LENT]]);
  check(`R3c auto, 5 s saines puis 25 s a 33,3 ms : toujours au plancher, reference NON revisee (pas d'abandon precoce)`,
    J(c.F) === '1/0.8' && c.F.ref > 16 && c.F.ref < 17.5,
    `final ${J(c.F)}, REFDT=${c.F.ref.toFixed(2)} ms` + (c.F.ref > 20 ? ` ; CAUSE : reference revisee apres moins de ~15 s au plancher — la lenteur est acceptee au lieu d'etre combattue` : ''));
  GAME.pose('auto', null);
  GAME.play(IMG(5), SAIN); GAME.play(IMG(20), LENT);
  const b2 = suivi(GAME, [[IMG(100), LENT]]);
  check(`R3b auto, puis 100 s de plus a 33,3 ms AU PLANCHER : reference revisee a 33,3 ms, qualite rendue (3/1)`,
    J(b2.F) === '3/1' && b2.F.ref > 33 && b2.F.ref < 34, `final ${J(b2.F)}, REFDT=${b2.F.ref.toFixed(2)} ms`
    + (b2.F.ref < 20 ? ` ; CAUSE : reference restee a ${b2.F.ref.toFixed(1)} ms alors que le plancher lui-meme tient 33,3 ms — cliquet, minimum historique` : ''));
}

/* ---------- verdict ---------- */
console.log(`test/regule.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
