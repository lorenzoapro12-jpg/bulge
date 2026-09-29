'use strict';
/* =========================================================
   Garde-fou des ANNONCES (chantier H, 29/09/2026) : ce que l'écran annonce = ce que le code fait.

     1. Lentille de verre : « chance critique divisée par deux » → P.crit avec / sans la Lentille = 0,5
        (même équipement, sauvegarde chargée au démarrage), et la chance critique affichée au Hangar
        (renderHangar, ligne « Chance critique ») = ce que l'équipement ajoute réellement en partie.
     2. Classes : ce que chaque description affirme de la puissance (cadence, dégâts, produit dmg×rate
        face à Équilibré) est calculé et vérifié ; la jauge « Puissance » rendue par renderProf = dmg×rate/1,2.
     3. Succès « Intouchable » : un cœur brisé après un vrai coup (hurtPlayer) ne le donne pas, un cœur
        brisé sans coup le donne ; toute condition chiffrée de la phrase (« salle N+ ») doit être exigée
        par le code (essai en salle 2) ; un succès déjà obtenu n'est jamais retiré.
     4. Reliques : la carte de fin de partie (showEnd) affiche le niveau réel atteint, niveaux 1 à max,
        pour chaque relique ; au maximum, elle le dit ; pickArt ne dépasse jamais le maximum.

   node test/annonces.js              arbre de travail
   node test/annonces.js --ref=HEAD   code d'avant (témoin : doit ÉCHOUER sur 1, 2, 3, 4)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- DOM et canvas stubés (comme test/competences.js) ---------- */
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
let CLOCK = 0;
/* 1. la SAUVEGARDE chargée au démarrage : un canon unique « Lentille de verre » équipé (avec un affixe
   critique), un pilote en Précision (chance critique d'équipement conséquente), 3 crans de Fracture
   (chance critique de base), et le succès « Intouchable » déjà obtenu par un autre profil de joueur
   n'y figure pas : on le teste à part (3). */
const LENTILLE = { id: 1, s: 'canon', r: 3, lvl: 10, up: 0, bi: 0, aff: [['crit', 1], ['dmg', .5]], u: 'verre' };
const SAVE = { runs: 5, wins: 0, arts: { crit: 3 }, ach: {}, best: 0, lb: [], daily: {}, mute: true, kills: 0, seenHelp: true, iseq: 2,
  inv: [LENTILLE], eq: { canon: 1 }, pilot: { lvl: 20, xp: 0, pts: 0, a: { pre: 50 } }, tank: { name: 'T' } };
const LS = { bulge2_meta: JSON.stringify(SAVE) };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), navigator: { language: 'fr-FR' },
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
  performance: { now: () => CLOCK }, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox), call = e => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInContext(ORDER.map(readModule).join('\n'), ctx, { filename: 'game.js' });
const start = (prof, seed) => call(`Math.__seed(${seed});newRun(${JSON.stringify(prof)},false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;G.tuto=null;`);
const noSim = f => { win.__SIM = false; try { return f(); } finally { win.__SIM = true; } };
const J = e => JSON.parse(call('JSON.stringify(' + e + ')'));
const checks = []; const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d: d || '' }); console.log((ok ? '  OK     ' : '  ECHEC  ') + n + (d ? '  — ' + d : '')); };

/* ================= 1. Lentille de verre ================= */
console.log('1. Lentille de verre');
{
  const loaded = J('{u:(giItem(meta.eq.canon)||{}).u,crit:meta.arts.crit,pre:meta.pilot.a.pre}');
  check('sauvegarde chargée : Lentille équipée, Fracture 3, Précision 50', loaded.u === 'verre' && loaded.crit === 3 && loaded.pre === 50, JSON.stringify(loaded));
  const txt = call("UNIQ.verre.d");
  const annonce = /chance critique divisée par deux/.test(txt) ? .5 : null;
  check('la description annonce un facteur calculable sur la chance critique', annonce !== null, txt);
  const crit = () => { start('bal', 11); return call('G.p.crit'); };
  const avec = crit();
  call('giItem(meta.eq.canon).u=null'); const sans = crit();
  call("giItem(meta.eq.canon).u='verre'");
  /* chance critique de base (classe + Fracture), avant toute contribution de giStats (équipement + pilote) */
  call("Math.__seed(11);newRun('bal',false)"); const nu = call('G.p.crit');
  const r = avec / sans;
  check('P.crit avec / sans la Lentille (même équipement) = ' + annonce, Math.abs(r - annonce) < 1e-9, 'avec ' + avec.toFixed(4) + ', sans ' + sans.toFixed(4) + ', rapport ' + r.toFixed(4) + ' (base classe + Fracture ' + nu.toFixed(4) + ')');
  /* écran du Hangar : la ligne « Chance critique » affiche giStats(...).crit, c.-à-d. la part de l'équipement
     (+ pilote). En partie avec la Lentille, cette part vaut P.crit − (base divisée par deux). */
  noSim(() => call('HG.sel=null;renderHangar()'));
  const html = stash.get('hgStats').innerHTML, m = html.match(/Chance critique<\/span><b>(\d+) %/);
  const shown = m ? +m[1] : NaN, applied = Math.round(100 * (avec - nu * annonce));
  check('Hangar : chance critique affichée = part de l\'équipement appliquée en partie', shown === applied, 'affiché ' + shown + ' %, appliqué ' + (100 * (avec - nu * annonce)).toFixed(2) + ' %');
}

/* ================= 2. Classes : description ↔ puissance ================= */
console.log('2. Classes : description et jauge « Puissance »');
{
  const PROF = J('Object.fromEntries(Object.entries(PROF).map(([k,p])=>[k,{n:p.n,d:p.d,dmg:p.dmg,rate:p.rate}]))');
  const ref = PROF.bal.dmg * PROF.bal.rate;
  /* affirmations sur la puissance, chacune calculable face à Équilibré (dmg=rate=1) */
  const RULES = [
    [/tir plus lent|cadence (lente|faible)/i, p => p.rate < PROF.bal.rate, 'cadence < Équilibré'],
    [/tir plus rapide|cadence (rapide|élevée)/i, p => p.rate > PROF.bal.rate, 'cadence > Équilibré'],
    [/lourd|mortel|puissant|dévastat/i, p => p.dmg > PROF.bal.dmg, 'dégâts > Équilibré'],
    [/faible|peu puissant|moins de dégâts/i, p => p.dmg * p.rate < ref, 'dmg×rate < Équilibré'],
  ];
  /* vocabulaire de puissance : s'il apparaît sans qu'aucune règle ne s'applique, l'affirmation n'est pas calculable → échec */
  const VOCAB = /faible|puissan|lourd|mortel|dévastat|cadence|dégât|canon/i;
  for (const k in PROF) {
    const p = PROF[k], hits = RULES.filter(([re]) => re.test(p.d)), prod = p.dmg * p.rate;
    if (!hits.length) { check(p.n + ' : ' + (VOCAB.test(p.d) ? 'vocabulaire de puissance sans affirmation calculable' : 'aucune affirmation sur la puissance'), !VOCAB.test(p.d), '« ' + p.d + ' »'); continue; }
    for (const [, f, what] of hits) check(p.n + ' : ' + what, f(p), '« ' + p.d + ' » — dmg ' + p.dmg + ' × rate ' + p.rate + ' = ' + prod.toFixed(3) + ' (Équilibré ' + ref + ')');
  }
  /* jauge rendue par l'écran de choix de classe */
  call('for(const k in PROF)meta.ships[k]=1;renderProf()');
  const html = stash.get('profCards').innerHTML;
  for (const k in PROF) {
    const card = html.split('data-p="' + k + '"')[1].split('</button>')[0], v = [...card.matchAll(/--v:(\d+)%/g)].map(x => +x[1]);
    const exp = Math.round(Math.max(0, Math.min(1, PROF[k].dmg * PROF[k].rate / 1.2)) * 100);
    check(PROF[k].n + ' : jauge « Puissance » affichée = dmg×rate/1,2', v[1] === exp, v[1] + ' % affiché, ' + exp + ' % attendu');
  }
}

/* ================= 3. Succès « Intouchable » ================= */
console.log('3. Succès « Intouchable »');
{
  const d = call("ACH.find(a=>a.id==='nohit').d");
  const salle = (d.match(/salle (\d+)\s*\+/) || [])[1];
  /* un combat de cœur complet par les fonctions du jeu : activateHeart, (hurtPlayer), heartDie */
  const fight = (room, hit) => {
    start('bal', 21); call('delete meta.ach.nohit;G.newAch=[]');
    call(`G.room=${room};activateHeart(G.hearts[0]);`);
    if (hit) call('G.p.inv=0;G.p.dashing=0;G.p.dodge=0;G.state="play";hurtPlayer(5,G.p.x+10,G.p.y)');
    const touched = call('G.fightHit===true');
    call('G.room=' + room + ';heartDie(G.arena.ref)');
    return { touched, got: call('!!meta.ach.nohit') };
  };
  check('la phrase parle d\'un cœur brisé sans être touché', /cœur/i.test(d) && /touché|dégât/i.test(d), '« ' + d + ' »');
  const a = fight(6, true), b = fight(6, false), c = fight(2, false);
  check('cœur brisé APRÈS un coup (salle 6) : pas de succès', a.touched && !a.got, JSON.stringify(a));
  check('cœur brisé sans coup (salle 6) : succès', !b.touched && b.got, JSON.stringify(b));
  check('cœur brisé sans coup en salle 2 : ' + (salle ? 'refusé, la phrase exige la salle ' + salle + '+' : 'accordé, la phrase n\'exige pas de salle'), salle ? !c.got : c.got, JSON.stringify(c) + (salle ? ' — phrase « salle ' + salle + '+ »' : ''));
  /* un succès déjà obtenu n'est jamais retiré : sauvegarde avec nohit, cœur brisé après un coup */
  start('bal', 22); call('meta.ach.nohit=12345;activateHeart(G.hearts[0]);G.p.inv=0;G.p.dashing=0;G.p.dodge=0;G.state="play";hurtPlayer(5,G.p.x+10,G.p.y);heartDie(G.arena.ref);saveMeta()');
  check('succès déjà obtenu conservé (meta.ach.nohit inchangé, relu depuis la sauvegarde)', JSON.parse(LS.bulge2_meta).ach.nohit === 12345);
}

/* ================= 4. Reliques : niveau affiché ================= */
console.log('4. Reliques : numéro de niveau sur la carte de fin de partie');
{
  const ARTS = J('Object.fromEntries(Object.entries(ARTS).map(([k,a])=>[k,{n:a.n,max:a.max}]))'), ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const maxes = [...new Set(Object.values(ARTS).map(a => a.max))].sort((x, y) => y - x);
  console.log('     maximums des reliques : ' + Object.entries(ARTS).map(([k, a]) => k + '=' + a.max).join(' ') + '  (valeurs distinctes : ' + maxes.join(', ') + ')');
  start('bal', 31);
  const card = (k, n) => { call(`meta.arts[${JSON.stringify(k)}]=${n};G.artChoices=[${JSON.stringify(k)}];G.freeArts=[];G.newAch=[];G.artPicked=false;G.state='end';G.win=false`); noSim(() => call('showEnd()'));
    return (stash.get('endArts').innerHTML.match(/<span class="nm">([^<]*)<\/span>/) || [])[1]; };
  const bad = [], seen = [];
  for (const k in ARTS) {
    const a = ARTS[k];
    for (let lvl = 1; lvl <= a.max; lvl++) {           /* niveau atteint en prenant la relique = possédés + 1 */
      const nm = card(k, lvl - 1), num = nm.slice(a.n.length).replace(/ · max$/, '').trim();
      const ok = nm.startsWith(a.n) && (lvl === 1 ? num === '' : num === ROMAN[lvl]) && (/ · max$/.test(nm) === (lvl === a.max));
      if (k === 'dmg') seen.push(lvl + ':' + JSON.stringify(nm.slice(a.n.length)));
      if (!ok) bad.push(k + ' niv. ' + lvl + ' → « ' + nm + ' »');
    }
    const over = card(k, a.max);                       /* déjà au maximum (relique offerte le même soir) */
    if (!/max atteint/.test(over) || /[IVX]+\b/.test(over.slice(a.n.length))) bad.push(k + ' au max → « ' + over + ' »');
  }
  console.log('     Noyau dense (max 10) : ' + seen.join(' '));
  check('carte de relique : niveau affiché = ROMAN du niveau réel (1 sans numéro, 2 à max), max signalé', !bad.length, bad.length ? bad.length + ' faux : ' + bad.slice(0, 6).join(' | ') : Object.keys(ARTS).length + ' reliques, tous niveaux');
  const k = 'reroll', mx = ARTS[k].max;
  call(`meta.arts.${k}=${mx};G.artPicked=false`); noSim(() => call(`pickArt('${k}',null)`));
  check('pickArt sur une relique déjà au maximum : ne dépasse pas le maximum', call(`meta.arts.${k}`) === mx, 'meta.arts.' + k + ' = ' + call(`meta.arts.${k}`) + ' (max ' + mx + ')');
}

const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE (' + checks.length + ' critères)' : 'ECHEC : ' + checks.filter(c => !c.ok).length + ' / ' + checks.length);
process.exit(all ? 0 : 1);
