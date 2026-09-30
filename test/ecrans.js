'use strict';
/* =========================================================
   Garde-fou des ÉCRANS (chantier I, 29/09/2026) : deux choses que l'écran affirmait sans que le code les fasse.

     1. Classes : chaque mot d'une description de classe (PROF[k].d) doit être rattaché à une RÈGLE qui le
        vérifie sur une valeur calculée (joueur réellement créé par newRun + gsRunStart, portées réellement
        mesurées). Un mot qu'aucune règle ne couvre → ÉCHEC en le nommant.
        En particulier l'Oracle « entend les échos de loin » : la portée de la flèche vers un écho (drawSubs)
        et le rayon de réveil (gsTick) sont MESURÉS par dichotomie, pour l'Oracle et pour chaque autre classe.
     2. Série de jours : la pastille « N j série » du menu (gsMenu) dit la vérité aujourd'hui. lastDay = J−3,
        streak = 5 : (a) le menu n'affiche pas 5 j, (b) afficher ne modifie ni meta.streak ni la sauvegarde,
        (c) après le lancement d'une partie, streak = 1. Témoins : série vivante (hier, aujourd'hui).

   node test/ecrans.js              arbre de travail
   node test/ecrans.js --ref=HEAD   code d'avant (témoin : doit ÉCHOUER sur 1 et 2)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- DOM et canvas stubés (comme test/annonces.js) ---------- */
const any = () => new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => 0 : (p in t ? t[p] : (t[p] = any())), set: (t, p, v) => (t[p] = v, true), apply: () => any() });
function mkCtx() { const b = { measureText: s => ({ width: String(s).length * 7 }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) };
  return new Proxy(b, { get: (t, p) => (p in t ? t[p] : () => any()), set: (t, p, v) => (t[p] = v, true) }); }
function mkEl(id, tag) {
  return { id, tagName: (tag || 'div').toUpperCase(), style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, dataset: {}, hidden: false, innerHTML: '', textContent: '', value: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    setAttribute() {}, getAttribute: () => null, closest: () => null, focus() {}, blur() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    after() {}, appendChild: c => c, setPointerCapture() {}, releasePointerCapture() {}, width: 800, height: 600, getContext: () => mkCtx(), parentElement: null, offsetWidth: 0, offsetHeight: 0 }; }
const stash = new Map();
const doc = { hidden: false, activeElement: null, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, body: mkEl('body'), createElement: t => mkEl('', t),
  getElementById: id => { if (!stash.has(id)) { const e = mkEl(id); if (id === 'cv') e.parentElement = mkEl('stage'); stash.set(id, e); } return stash.get(id); } };
const SAVE = { runs: 5, wins: 0, arts: {}, ach: {}, best: 0, lb: [], daily: {}, mute: true, kills: 0, seenHelp: true, tank: { name: 'T' } };
const LS = { bulge2_meta: JSON.stringify(SAVE) };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), navigator: { language: 'fr-FR' },
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
  performance: { now: () => 0 }, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox), call = e => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInContext(ORDER.map(readModule).join('\n'), ctx, { filename: 'game.js' });
const start = (prof, seed) => call(`Math.__seed(${seed});newRun(${JSON.stringify(prof)},false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;G.tuto=null;`);
const noSim = f => { win.__SIM = false; try { return f(); } finally { win.__SIM = true; } };
const J = e => JSON.parse(call('JSON.stringify(' + e + ')'));
const checks = []; const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d: d || '' }); console.log((ok ? '  OK     ' : '  ECHEC  ') + n + (d ? '  — ' + d : '')); };

/* ---------- mesures en jeu ---------- */
/* Un seul monument factice (plaine, R=300) posé à la distance d, à l'est du joueur ; on remet tout en place après. */
call(`globalThis.__echoProbe=function(d,mode){
  const lms=WD.lms,lore=JSON.stringify(meta.lore),S=G.gs,P=G.p,save=saveMeta;saveMeta=()=>{};
  const L={x:P.x+d,y:P.y,t:'plains',R:300,parts:[]};WD.lms=[L];S.lm={};meta.lore.plains=0;let r=false;
  try{
    if(mode==='wake'){S.tick=5;P.dead=false;gsTick();r=!!S.lm[0];}
    else{CAM.x=P.x;CAM.y=P.y;S.subs.length=0;let n=0;const ro=ctx.rotate;ctx.rotate=function(){n++;};try{drawSubs();}finally{ctx.rotate=ro;}r=n>0;}
  }finally{WD.lms=lms;meta.lore=JSON.parse(lore);saveMeta=save;S.lm={};}
  return r;}`);
/* plus grande distance (à 1 unité près) où la mesure est vraie, en partant d'un point où elle l'est */
function reach(mode, lo, hi) { const ok = d => call(`__echoProbe(${d},'${mode}')`); if (!ok(lo)) return 0; if (ok(hi)) return Infinity;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; } return lo; }
/* la flèche n'existe que hors écran : on part du premier point hors écran */
const offscreen = () => Math.ceil(J('{W,RZ}').W / 2 / J('{W,RZ}').RZ) + 40;
function measure(k) {
  start(k, 7);
  const p = J('{magnet:G.p.magnet,homing:G.p.homing,drones:G.p.drones,crit:G.p.crit,dash:G.p.dashMax,spd:G.p.spd,bub:G.p.bub,r:G.p.r,fireI:G.p.fireI,dmg:G.p.dmg,armor:G.p.armor}');
  p.wake = reach('wake', 1, 3000); p.arrow = reach('arrow', offscreen(), 60000);
  return p;
}

/* ================= 1. Classes : chaque mot rattaché à une règle ================= */
console.log('1. Classes : description ↔ valeurs calculées');
{
  const PROF = J('Object.fromEntries(Object.entries(PROF).map(([k,p])=>[k,Object.assign({},p)]))');
  const M = {}; for (const k in PROF) M[k] = measure(k);
  const others = k => Object.keys(PROF).filter(x => x !== k);
  const B = M.bal, K = Object.keys(PROF);
  for (const k of K) console.log('     ' + PROF[k].n.padEnd(10) + ' réveil ' + String(M[k].wake).padStart(4) + '  flèche ' + String(M[k].arrow).padStart(5) + '  aimant ' + M[k].magnet.toFixed(0) + '  chercheur ' + M[k].homing.toFixed(2));
  /* dichotomie : ne fait confiance à la mesure que si elle trouve une frontière finie */
  check('mesures finies (réveil et flèche ont une portée bornée pour toutes les classes)', K.every(k => M[k].wake > 0 && isFinite(M[k].wake) && M[k].arrow > 0 && isFinite(M[k].arrow)), K.map(k => k + ' ' + M[k].wake + '/' + M[k].arrow).join(', '));
  const FAR = 1.5;  /* « de loin » : au moins 1,5 × la portée de TOUTE autre classe, pour la flèche ET pour le réveil */
  /* [expression, test(k), ce qui est vérifié] — l'expression « consomme » ses mots dans la description */
  const RULES = [
    [/entend les échos de loin/, k => others(k).every(o => M[k].wake >= FAR * M[o].wake && M[k].arrow >= FAR * M[o].arrow), k => 'réveil ' + M[k].wake + ' et flèche ' + M[k].arrow + ' ≥ ' + FAR + ' × toute autre classe (max autres : ' + Math.max(...others(k).map(o => M[o].wake)) + ' / ' + Math.max(...others(k).map(o => M[o].arrow)) + ')'],
    [/aimant immense/, k => M[k].magnet >= 2 * B.magnet, k => 'aimant ' + M[k].magnet.toFixed(0) + ' ≥ 2 × Équilibré (' + B.magnet.toFixed(0) + ')'],
    [/aimant élargi/, k => M[k].magnet > B.magnet * 1.25, k => 'aimant ' + M[k].magnet.toFixed(0) + ' > 1,25 × Équilibré (' + B.magnet.toFixed(0) + ')'],
    [/tirs chercheurs/, k => M[k].homing > 0 && B.homing === 0, k => 'P.homing ' + M[k].homing + ' au départ (Équilibré ' + B.homing + ')'],
    [/commence avec un drone qui combat pour elle/, k => M[k].drones >= 1 && B.drones === 0, k => 'P.drones ' + M[k].drones + ' au départ'],
    [/petit/, k => M[k].r < B.r, k => 'rayon ' + M[k].r + ' < ' + B.r],
    [/rapide/, k => M[k].spd > B.spd, k => 'vitesse ' + M[k].spd.toFixed(2) + ' > ' + B.spd.toFixed(2)],
    [/tir plus lent/, k => M[k].fireI > B.fireI, k => 'intervalle de tir ' + M[k].fireI.toFixed(2) + ' > ' + B.fireI.toFixed(2)],
    [/lent/, k => M[k].spd < B.spd, k => 'vitesse ' + M[k].spd.toFixed(2) + ' < ' + B.spd.toFixed(2)],
    [/fragile/, k => M[k].bub < B.bub, k => 'bulle ' + M[k].bub + ' < ' + B.bub],
    [/très blindé/, k => others(k).every(o => M[k].armor < M[o].armor), k => 'armure (dégâts subis ×) ' + M[k].armor + ' = la plus basse de toutes'],
    [/plus lourd|mortel/, k => M[k].dmg > B.dmg, k => 'dégâts ' + M[k].dmg + ' > ' + B.dmg],
    [/critiques fréquents/, k => M[k].crit > B.crit, k => 'chance critique ' + M[k].crit.toFixed(3) + ' > ' + B.crit.toFixed(3)],
    [/dash qui recharge vite|dash nerveux/, k => M[k].dash < B.dash, k => 'recharge du dash ' + M[k].dash + ' < ' + B.dash],
    /* chaque statistique d'Équilibré est strictement dans l'éventail des autres classes */
    [/rien d'extrême/, k => ['spd', 'rate', 'dmg', 'size', 'bub', 'armor', 'dash'].every(s => { const v = others(k).map(o => PROF[o][s]); return PROF[k][s] >= Math.min(...v) && PROF[k][s] <= Math.max(...v); }), () => 'chaque stat dans l\'éventail des autres classes'],
    /* disponible sans rien débloquer, et c'est la classe imposée par le défi du jour */
    [/le choix sûr pour apprendre/, k => !PROF[k].cost && !PROF[k].story && (call("newRun('scout',true);G.prof") === k), () => 'gratuit, et classe du défi du jour'],
  ];
  const LIENS = new Set(['et', 'mais']);
  for (const k of K) {
    let d = PROF[k].d.toLowerCase().replace(/’/g, "'");
    for (const [re, f, what] of RULES) { if (!re.test(d)) continue; check(PROF[k].n + ' : « ' + d.match(re)[0] + ' »', f(k), what(k)); d = d.replace(re, ' '); }
    const reste = d.split(/[\s.,:;!]+/).filter(w => w && !LIENS.has(w));
    check(PROF[k].n + ' : tous les mots de la description sont vérifiés par une règle', !reste.length, reste.length ? 'sans règle : ' + reste.map(w => '« ' + w + ' »').join(' ') : '« ' + PROF[k].d + ' »');
  }
  /* le cercle dessiné autour du monument = le rayon qui réveille réellement (sinon l'écran mentirait à nouveau) */
  const drawn = k => { start(k, 7); return call(`(function(){const P=G.p,lms=WD.lms,L={x:P.x+100,y:P.y,t:'plains',R:300,parts:[]};WD.lms=[L];G.gs.lm={};let r=0;const a=ctx.arc;ctx.arc=function(x,y,rr){if(x===L.x&&y===L.y)r=rr;};try{gsDrawWorld();}finally{ctx.arc=a;WD.lms=lms;}return r;})()`); };
  const bad = K.filter(k => Math.abs(drawn(k) - M[k].wake) > 1.5);
  check('cercle d\'écho dessiné = rayon de réveil mesuré (toutes classes)', !bad.length, bad.length ? bad.map(k => k + ' dessiné ' + drawn(k) + ' / réveil ' + M[k].wake).join(', ') : K.map(k => k + ' ' + M[k].wake).join(', '));
}

/* ================= 2. Série de jours ================= */
console.log('2. Série de jours : la pastille du menu');
{
  const pill = () => { stash.get('mStats') && (stash.get('mStats').innerHTML = ''); noSim(() => call('gsMenu()')); const m = doc.getElementById('mStats').innerHTML.match(/<b>(\d+) j<\/b><span>série<\/span>/); return m ? +m[1] : null; };
  const pose = (off, n) => call(`meta.lastDay=dayKeyOff(${off});meta.streak=${n};saveMeta();`);
  const disk = () => { const m = JSON.parse(LS.bulge2_meta); return { streak: m.streak, lastDay: m.lastDay }; };

  pose(-3, 5);
  const avant = J('{streak:meta.streak,lastDay:meta.lastDay}'), dAvant = disk();
  const shown = pill();
  check('(a) J−3, série 5 : le menu n\'affiche pas une série vivante', shown === null || shown === 0, 'pastille : ' + (shown === null ? 'absente' : shown + ' j'));
  const apres = J('{streak:meta.streak,lastDay:meta.lastDay}'), dApres = disk();
  check('(b) afficher le menu ne touche ni meta.streak ni meta.lastDay (mémoire)', apres.streak === 5 && apres.lastDay === avant.lastDay, JSON.stringify(avant) + ' → ' + JSON.stringify(apres));
  check('(b) … ni la sauvegarde', dApres.streak === dAvant.streak && dApres.lastDay === dAvant.lastDay, JSON.stringify(dAvant) + ' → ' + JSON.stringify(dApres));
  start('bal', 3);
  const run = J('{streak:meta.streak,lastDay:meta.lastDay,today:todayKey()}');
  check('(c) après le lancement d\'une partie : série = 1, lastDay = aujourd\'hui', run.streak === 1 && run.lastDay === run.today, JSON.stringify(run));
  check('(c) le menu affiche alors la vérité (série 1 : pas de pastille, comme avant)', pill() === null, '');

  /* témoins : une série vivante s'affiche toujours, et la règle de compte n'a pas bougé */
  pose(-1, 5);
  check('témoin : dernier jour = hier, série 5 → le menu affiche 5 j (on peut encore la prolonger)', pill() === 5, '');
  start('bal', 3);
  check('témoin : partie jouée le lendemain → série 6', call('meta.streak') === 6, 'streak ' + call('meta.streak'));
  check('témoin : même jour → le menu affiche 6 j', pill() === 6, '');
  start('bal', 3);
  check('témoin : seconde partie le même jour → série inchangée (6)', call('meta.streak') === 6, 'streak ' + call('meta.streak'));
}

const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE (' + checks.length + ' critères)' : 'ECHEC : ' + checks.filter(c => !c.ok).length + ' / ' + checks.length);
process.exit(all ? 0 : 1);
