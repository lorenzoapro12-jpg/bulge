'use strict';
/* =========================================================
   Garde-fou des COMPÉTENCES (chantier E, 29/09/2026).

   Demande du joueur : « + de skill disponibles, pas juste 3, et de nouveaux skills ».
   Ce que ce test défend :
     1. L'autel propose 6 à 8 compétences quand l'emplacement E est libre (toutes pages confondues),
        au plus ALT_PG par page (lisibilité téléphone, mesurée par test/choix-ecran.js).
     2. POUR CHAQUE compétence de SKL : elle s'active, son temps de recharge est débité puis
        décompté, et son effet est MESURÉ (écart chiffré face à une partie témoin identique sans
        la compétence) — pas « pas d'exception ».
     3. Deux compétences ne partagent pas le même effet : chacune a sa grandeur propre.
     4. Compatibilité : une sauvegarde (meta) écrite par le code d'AVANT (git, 3 choix, 6
        compétences) se charge et la partie reste jouable ; un état de partie en cours d'avant
        (P.sk à l'ancienne) fonctionne ; le duel ne plante pas avec une compétence nouvelle.

   node test/competences.js                  arbre de travail
   node test/competences.js --ref=0837805    code d'avant (doit ÉCHOUER : témoin)
   node test/competences.js --muter=arc      retire l'effet d'une compétence (doit ÉCHOUER)
   node test/competences.js --pages          imprime les pages de l'autel (JSON, pour choix-ecran.js)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), MUT = ARG('muter'), PAGES = !!ARG('pages'), DUMP = !!ARG('dump-meta');
const AVANT = '0837805';   /* dernier commit avant le chantier E : 6 compétences, autel à 3 choix */
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- DOM et canvas stubés : tout appel est accepté ---------- */
const any = () => new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => 0 : (p in t ? t[p] : (t[p] = any())), set: (t, p, v) => (t[p] = v, true), apply: () => any() });
function mkCtx() { const b = { measureText: s => ({ width: String(s).length * 7 }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) };
  return new Proxy(b, { get: (t, p) => (p in t ? t[p] : () => any()), set: (t, p, v) => (t[p] = v, true) }); }
function mkEl(id, tag) {
  const e = { id, tagName: (tag || 'div').toUpperCase(), style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, dataset: {}, hidden: false, innerHTML: '', textContent: '', value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    setAttribute() {}, getAttribute: () => null, closest: () => null, focus() {}, blur() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    after() {}, appendChild: c => c, setPointerCapture() {}, releasePointerCapture() {}, width: 800, height: 600, getContext: () => mkCtx(), parentElement: null, offsetWidth: 0, offsetHeight: 0 };
  return e; }
const stash = new Map();
const doc = { hidden: false, activeElement: null, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, body: mkEl('body'), createElement: t => mkEl('', t),
  getElementById: id => { if (!stash.has(id)) { const e = mkEl(id); if (id === 'cv') e.parentElement = mkEl('stage'); stash.set(id, e); } return stash.get(id); } };
let CLOCK = 0; const LS = {};
if (process.env.BULGE_META) LS.bulge2_meta = process.env.BULGE_META;
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), navigator: { language: 'fr-FR' },
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
  performance: { now: () => CLOCK }, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;
let code = ORDER.map(readModule).join('\n');
if (MUT) { /* mutant : la branche d'effet de la compétence ne correspond plus à rien (le temps de recharge reste débité) */
  const a = "s.id==='" + MUT + "'"; if (!code.includes(a)) { console.log('muter : branche introuvable ' + a); process.exit(2); } code = code.split(a).join("s.id==='__mute'"); }
const ctx = vm.createContext(sandbox), call = e => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInContext(code, ctx, { filename: 'game.js' });
const STEP = call('(function(){step();})');
/* compteur des gcTick réellement exécutés (les images gelées du hit-stop n'en exécutent pas) */
call('var __gt=gcTick;gcTick=function(){G.__ticks=(G.__ticks||0)+1;return __gt();}');
const steps = n => { for (let i = 0; i < n; i++) { STEP(); CLOCK += 1000 / 60; } };
const start = (prof, seed) => { call(`Math.__seed(${seed});newRun(${JSON.stringify(prof)},false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;G.tuto=null;`); };
const noSim = f => { win.__SIM = false; try { return f(); } finally { win.__SIM = true; } };
const checks = []; const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d: d || '' }); };

/* ---------- pages de l'autel (emplacement E libre), en passant par le VRAI parcours joueur :
   openAltar hors simulation, puis pickEvo (g4.js) sur la carte « Autres compétences », puis gcTick ---------- */
const SUB = [];
function altarPages(prof) {
  start(prof, 7); const pages = []; SUB.length = 0;
  noSim(() => call('G.p.sk[1]=null;openAltar(-1)'));
  for (let g = 0; g < 6; g++) {
    const ch = JSON.parse(call('JSON.stringify(G.choices.map(c=>({id:c.u.id,n:c.u.n,ic:c.u.ic,c:c.u.c,d:c.u.d})))'));
    pages.push(ch); SUB.push(call('G.evoAlt[1]')); const nav = ch.findIndex(c => c.id === 'alt_page'); if (nav < 0) break;
    if (pages.length > 1 && JSON.stringify(ch) === JSON.stringify(pages[0])) { pages.pop(); break; }   /* retour à la page 1 */
    noSim(() => { call(`pickEvo(${nav})`); call('gcTick()'); });
    if (call('G.state') !== 'evo') break;
  }
  return pages;
}
if (PAGES) { const pages = altarPages('bal'); console.log(JSON.stringify({ pages, sub: SUB })); process.exit(0); }

/* ---------- sauvegarde d'avant : produite par le code d'AVANT lui-même ---------- */
if (DUMP) {
  start('bal', 4242); win.__SIM_INPUT = () => { const P = call('G.p'); call('G.inX=Math.cos(G.t/300);G.inY=Math.sin(G.t/300)'); if (P.sk[0].cd <= 0) call('gcUse(0)'); };
  call('G.p.bub+=40;checkLevel()'); call('openAltar(-1)'); steps(3000);
  call('endRun&&typeof endRun==="function"?0:0'); call('saveMeta()');
  console.log(JSON.stringify({ meta: LS.bulge2_meta, sk: call('JSON.stringify(G.p.sk)') })); process.exit(0);
}

if (ARG('charge')) { /* processus fils : meta d'avant dans localStorage (BULGE_META), P.sk d'avant injecté */
  checks.length = 0; let err = null;
  try { const sv = JSON.parse(process.env.BULGE_META), m = JSON.parse(call('JSON.stringify(meta)'));
    const miss = Object.keys(sv).filter(k => JSON.stringify(sv[k]) !== JSON.stringify(m[k]));
    if (miss.length) throw new Error('meta d’avant mal chargée, clés différentes : ' + miss.join(','));
    start('bal', 11); call('G.p.sk=' + ARG('sk'));
    win.__SIM_INPUT = () => call('G.inX=Math.cos(G.t/250);G.inY=Math.sin(G.t/250);for(let i=0;i<2;i++)if(G.p.sk[i]&&G.p.sk[i].cd<=0)gcUse(i)');
    call('openAltar(-1)'); steps(4000); call('saveMeta()'); JSON.parse(LS.bulge2_meta);
  } catch (e) { err = String(e.stack || e).split('\n').slice(0, 2).join(' | '); }
  console.log(err ? 'ECHEC ' + err : 'OK meta runs=' + call('meta.runs') + ' sk=' + call('JSON.stringify(G.p.sk)') + ' état=' + call('G.state'));
  process.exit(err ? 1 : 0);
}

/* =========================================================
   1. NOMBRE DE COMPÉTENCES PROPOSÉES
   ========================================================= */
const ids = JSON.parse(call('JSON.stringify(Object.keys(SKL))'));
console.log('compétences dans SKL : ' + ids.length + ' (' + ids.join(', ') + ')');
for (const prof of MUT ? [] : ['bal', 'reine']) {
  const pages = altarPages(prof);
  const offered = [...new Set(pages.flat().filter(c => c.id.startsWith('nsk_')).map(c => c.id.slice(4)))];
  const perPage = pages.map(p => p.filter(c => c.id.startsWith('nsk_')).length);
  console.log(prof + ' : ' + pages.length + ' page(s), compétences par page ' + perPage.join('/') + ' → ' + offered.length + ' proposées : ' + offered.join(', '));
  check('autel (' + prof + ') : 6 à 8 compétences proposées quand E est libre', offered.length >= 6 && offered.length <= 8, offered.length + ' proposées');
  check('autel (' + prof + ') : au plus 3 compétences par page, navigation incluse (≤ 4 cartes, cf. test/choix-ecran.js)', pages.every(p => p.length <= 4 && p.filter(c => c.id.startsWith('nsk_')).length <= 3), pages.map(p => p.length).join('/') + ' cartes');
  check('autel (' + prof + ') : chaque carte a un nom, une icône et une description', pages.flat().every(c => c.n && c.ic && c.d && c.d.length > 20));
  check('autel (' + prof + ') : le sous-titre dit l’emplacement et la page', /Nouvelle compétence · . · page 1 \/ \d/.test(SUB[0] || ''), SUB[0]);
  const sig = call(`SIG[${JSON.stringify(prof)}]`);
  check('autel (' + prof + ') : la compétence déjà tenue n\'est pas reproposée', !offered.includes(sig));
}
/* choisir une compétence de la page 2 : elle arrive bien dans l'emplacement E */
if (!MUT) { start('bal', 7); noSim(() => call('G.p.sk[1]=null;openAltar(-1)'));
  const nav = call('G.choices.findIndex(c=>c.u.id==="alt_page")');
  let got = null, want = null;
  if (nav >= 0) { noSim(() => { call(`pickEvo(${nav})`); call('gcTick()'); }); want = call('G.choices[0].u.id.slice(4)'); noSim(() => call('pickEvo(0)')); got = call('G.p.sk[1]&&G.p.sk[1].id'); }
  check('autel : une compétence choisie en page 2 est bien équipée en E', nav >= 0 && got === want && call('G.state') === 'play', 'voulu=' + want + ' obtenu=' + got); }

/* =========================================================
   2. CHAQUE COMPÉTENCE : activation, recharge, effet mesuré
   Scène fixe : le joueur au centre, 6 ennemis « pop » en couronne à 150 px + 2 à 360 px, sans tir
   automatique (fireT bloqué) ; on compare à une scène témoin identique où la compétence n'est pas lancée.
   ========================================================= */
function scene(id, use, frames, opt = {}) {
  start('bal', 99);
  call(`(function(){const P=G.p;P.x=0;P.y=0;P.px=0;P.py=0;P.ang=0;P.inv=0;P.crit=0;P.sk=[{id:${JSON.stringify(id)},l:1,cd:0},null];G.en.length=0;G.eb.length=0;G.pb.length=0;
    const at=[[150,0],[106,106],[0,150],[-106,106],[-150,0],[0,-150],[360,10],[380,-90]];for(const [x,y] of at){const e=mkEnemy('pop',x,y,{aggro:true,noElite:true});e.spawn=0;e.hp=e.mhp=500;}
    P.bub=${opt.bub || 30};checkLevel();P.fireT=1e9;inp.mt=-1e9;G.__en0=G.en.slice();})()`);
  win.__SIM_INPUT = () => { call('G.inX=0;G.inY=0;G.p.fireT=1e9;G.p.ang=0'); };
  const r = { cd0: 0, cdAfter: 0 };
  if (use) { call('gcUse(0)'); r.cd0 = call('G.p.sk[0].cd'); r.cdFull = call('Math.round(SKL[G.p.sk[0].id].cd[0]*G.p.cdMul)'); }
  if (opt.during) opt.during();
  call('G.__ticks=0'); steps(frames); r.cdAfter = call('G.p.sk[0].cd'); r.ticks = call('G.__ticks');
  Object.assign(r, JSON.parse(call(`JSON.stringify({hpLost:G.__en0.reduce((s,e)=>s+(e.mhp-Math.max(0,e.hp)),0),hit:G.__en0.filter(e=>e.hp<e.mhp).length,
    dist:G.__en0.reduce((s,e)=>s+Math.hypot(e.x,e.y),0)/G.__en0.length,dh:G.__en0.reduce((s,e)=>s+Math.hypot(e.x-416,e.y),0)/G.__en0.length,bub:G.p.bub,px:G.p.x,py:G.p.y,shieldT:G.p.shieldT,holes:G.gc.holes.length,sentries:(G.gc.sentries||[]).length})`)));
  return r;
}
/* grandeur propre à chaque compétence : ce qui DOIT bouger, et de combien, face au témoin */
const EFFECT = {
  shock: { f: 3, m: (a, b) => a.hit - b.hit, min: 6, u: 'ennemis touchés autour de toi (couronne à 150 px)', also: a => a.dist > 215 },
  lance: { f: 3, m: (a, b) => a.hpLost - b.hpLost, min: 1, u: 'PV retirés sur la ligne visée', also: a => a.hit >= 2 && a.hit <= 4 },
  trou: { f: 90, m: (a, b) => b.dh - a.dh, min: 10, u: 'px d’aspiration moyenne des 8 ennemis vers le trou (au viseur, 416 px)' },
  shield: { f: 3, m: (a, b) => a.bub - b.bub, min: 5, u: 'bulles préservées sous 3 coups de 10' },
  salve: { f: 90, m: (a, b) => a.hpLost - b.hpLost, min: 1, u: 'PV retirés par les missiles' },
  blink: { f: 3, m: (a, b) => Math.hypot(a.px - b.px, a.py - b.py), min: 100, u: 'px de téléportation' },
  tour: { f: 240, m: (a, b) => a.hpLost - b.hpLost, min: 1, u: 'PV retirés par la tourelle', also: a => a.sentries === 1 },
  siph: { f: 190, m: (a, b) => a.bub - b.bub, min: 6, u: 'bulles rendues' },
  /* chaîne attendue : joueur → (106,106) → (150,0) → (360,10) → (380,-90), puis plus aucun ennemi libre à ≤ 300 px : 4 */
  arc: { f: 3, m: (a, b) => a.hit - b.hit, min: 4, u: 'ennemis touchés en chaîne (4 atteignables par sauts de 300 px)' },
  marq: { f: 3, m: null, min: 1.55, u: '× dégâts subis par la cible marquée' },
};
const meas = {}, TEMOIN = {};   /* scène témoin : la compétence n'est pas lancée, donc identique pour toutes */
for (const id of MUT ? [MUT] : ids) {
  const E = EFFECT[id];
  if (!E) { check('compétence ' + id + ' : a une mesure d’effet dans ce test', false, 'ajouter une entrée EFFECT'); continue; }
  const hits = id === 'shield' ? () => { call('for(let k=0;k<3;k++){G.p.inv=0;hurtPlayer(10,0,0);}'); } : null;
  const a = scene(id, true, E.f, { during: hits }), b = TEMOIN[E.f + (hits ? 'h' : '')] || (TEMOIN[E.f + (hits ? 'h' : '')] = scene(id, false, E.f, { during: hits }));
  let v;
  if (id === 'marq') { /* un coup fixe de 100 sur la cible marquée vs une cible non marquée */
    scene(id, true, 1); v = call('(function(){const m=G.gc.marks&&G.gc.marks[0];const o=G.en.find(e=>!e.dead&&e!==m);if(!m||!o)return 0;const h0=m.hp,o0=o.hp;G.p.crit=0;hurtEnemy(m,100,0,0,true);hurtEnemy(o,100,0,0,true);return (h0-m.hp)/(o0-o.hp);})()');
  } else v = E.m(a, b);
  meas[id] = v;
  const cdOk = a.cd0 > 0 && a.cd0 === a.cdFull && a.ticks > 0 && a.cdAfter === Math.max(0, a.cd0 - a.ticks);
  check('compétence ' + id + ' : s’active et sa recharge est débitée (' + a.cdFull + ' images) puis décomptée', cdOk, 'cd après lancer=' + a.cd0 + ' après ' + a.ticks + ' gcTick=' + a.cdAfter);
  const ok = v >= E.min && (!E.also || E.also(a));
  check('compétence ' + id + ' : effet mesuré ' + (+v).toFixed(2) + ' ' + E.u + ' (seuil ' + E.min + ')', ok, 'lancée=' + JSON.stringify(a) + ' témoin=' + JSON.stringify(b));
}
/* 3. effets distincts : sur la scène, chaque compétence NOUVELLE a une signature que les autres n'ont pas */
if (!MUT) { const sig = {};
  const b = scene(ids[0], false, 190);
  for (const id of ids) { const a = scene(id, true, 190);
    sig[id] = [Math.round(a.hpLost - b.hpLost), a.hit - b.hit, Math.round(a.dist - b.dist), Math.round(a.bub - b.bub), Math.round(Math.hypot(a.px - b.px, a.py - b.py)), a.sentries].join(','); }
  const dup = ids.filter((x, i) => ids.findIndex(y => sig[y] === sig[x]) !== i);
  console.log('signatures (ΔPV, Δtouchés, Δdistance, Δbulles, déplacement, tourelles) sur 190 images :'); for (const id of ids) console.log('   ' + id.padEnd(7) + sig[id]);
  check('effets distincts : aucune paire de compétences n’a la même signature mesurée', !dup.length, dup.join(', ')); }

/* =========================================================
   4. COMPATIBILITÉ
   ========================================================= */
if (!REF && !MUT) {
  /* (a) partie en cours d'avant : P.sk à l'ancienne (anciens identifiants, niveaux, recharge en cours) */
  start('bal', 5);
  let err = null;
  try {
    call('G.p.sk=[{id:"lance",l:3,cd:0},{id:"salve",l:2,cd:40}];G.p.bub+=30;checkLevel()');
    call('gcUse(0);gcUse(1)'); steps(60); call('openAltar(-1)');
    win.__SIM_INPUT = () => call('G.inX=Math.cos(G.t/200);G.inY=Math.sin(G.t/200);if(G.p.sk[0].cd<=0)gcUse(0);if(G.p.sk[1]&&G.p.sk[1].cd<=0)gcUse(1)');
    steps(3000);
  } catch (e) { err = String(e.stack || e).split('\n').slice(0, 2).join(' | '); }
  check('compatibilité : partie en cours d’avant (Lance III + Salve II) jouable 3000 images, compétences conservées', !err && call('G.p.sk[0].id') === 'lance' && call('G.p.sk[1].id') === 'salve' && call('G.p.sk[0].l') === 3,
    err || ('sk=' + call('JSON.stringify(G.p.sk)')));
  /* (b) duel avec une compétence nouvelle en E : gx.js lit DSK[id].d */
  err = null;
  try { start('bal', 6); call('G.p.sk[1]={id:"arc",l:1,cd:0}'); if (call('WD.hunt&&WD.hunt.length')) call('duelStart(0)'); else err = 'aucun chasseur'; } catch (e) { err = String(e.stack || e).split('\n').slice(0, 2).join(' | '); }
  check('duel : ouvert avec une compétence nouvelle en E sans exception', !err, err || '');
  /* (c) sauvegarde écrite par le code d'AVANT (commit ' + AVANT + ') chargée par le code actuel */
  const d = cp.spawnSync(process.execPath, [__filename, '--ref=' + AVANT, '--dump-meta'], { cwd: ROOT, encoding: 'utf8' });
  let dump = null; try { dump = JSON.parse(d.stdout.trim().split('\n').pop()); } catch (e) {}
  if (!dump || !dump.meta) check('compatibilité : sauvegarde d’avant produite par ' + AVANT, false, (d.stdout + d.stderr).slice(-300));
  else {
    const r = cp.spawnSync(process.execPath, [__filename, '--charge', '--sk=' + dump.sk], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { BULGE_META: dump.meta }) });
    check('compatibilité : sauvegarde d’avant (' + AVANT + ', ' + dump.meta.length + ' octets, sk=' + dump.sk + ') chargée, partie de 4000 images jouée', r.status === 0, (r.stdout + r.stderr).trim().split('\n').pop());
  }
}

let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.n + (c.ok ? '' : '  — ' + c.d)); if (!c.ok) all = false; }
console.log(all ? 'COMPÉTENCES : TOUT PASSE' : 'COMPÉTENCES : ÉCHEC');
process.exit(all ? 0 : 1);
