'use strict';
/* =========================================================
   Garde-fou des ANNONCES DU DUEL (chantier J2, 29/09/2026) : ce que l'écran du duel annonce = ce que le code fait.

     1. Compétence sans effet en duel : son bouton est désactivé, et l'appui ne débite rien (énergie, recharge).
        Vérifié pour TOUTES les compétences de SKL : bouton actif  ⇔  l'appui change réellement le combat.
     2. Marque : l'intention affichée de chaque ennemi (dvFoes) = la ligne du journal quand il frappe
        (marque sur deux attaquants ; marque posée en cours de tour par un ennemi, attaque du suivant).
     3. Singularité : le bonus « groupé » mesuré (1er coup, 2e coup, coup à 100 %) correspond à ce que le
        texte promet (« prochain » seulement s'il se consomme, restriction nommée seulement si elle existe).
     4. Niveau : le pourcentage affiché par Lance I, II, III et Égide I, II, III = l'effet réellement appliqué.
     5. Chasseur endormi (première partie) : pas dessiné comme un adversaire (nom, silhouette), comme il n'a
        ni invite ni minicarte ; témoin : éveillé, il l'est.

   node test/duel-annonces.js              arbre de travail
   node test/duel-annonces.js --ref=<sha>  code d'avant (témoin : doit ÉCHOUER sur 1, 2, 3, 4, 5)

   ⚠️ PAS --ref=HEAD : le chantier J2 (annonces du duel) est MERGE dans main depuis le 30/09/2026, donc
   HEAD contient déjà le corrigé et le témoin ne désigne plus rien — « code d'avant » veut dire un commit
   ANTÉRIEUR à la fusion. Vérifié le 30/09/2026 : avec --ref=HEAD, l'arbre et le témoin rendent la MÊME
   sortie (7 critères OK), ce qui n'accuse pas le test mais le choix de la référence. Lire l'en-tête d'un
   témoin avant de conclure qu'il discrimine.
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- DOM et canvas stubés (comme test/annonces.js) ; setTimeout en file virtuelle (le tour ennemi en dépend) ---------- */
const any = () => new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => 0 : (p in t ? t[p] : (t[p] = any())), set: (t, p, v) => (t[p] = v, true), apply: () => any() });
function mkCtx(rec) { const b = { measureText: s => ({ width: String(s).length * 7 }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) };
  if (rec) { b.fillText = s => rec.push(['fillText', String(s)]); b.fill = () => rec.push(['fill']); b.stroke = () => rec.push(['stroke']); }
  return new Proxy(b, { get: (t, p) => (p in t ? t[p] : () => any()), set: (t, p, v) => (t[p] = v, true) }); }
function mkEl(id, tag) {
  return { id, tagName: (tag || 'div').toUpperCase(), style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, dataset: {}, hidden: false, innerHTML: '', textContent: '', value: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    setAttribute() {}, getAttribute: () => null, closest: () => null, focus() {}, blur() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    after() {}, appendChild: c => c, setPointerCapture() {}, releasePointerCapture() {}, width: 800, height: 600, getContext: () => mkCtx(), parentElement: null, offsetWidth: 0, offsetHeight: 0 }; }
const stash = new Map();
const doc = { hidden: false, activeElement: null, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, body: mkEl('body'), createElement: t => mkEl('', t),
  getElementById: id => { if (!stash.has(id)) { const e = mkEl(id); if (id === 'cv') e.parentElement = mkEl('stage'); stash.set(id, e); } return stash.get(id); } };
let CLOCK = 0, TID = 0; const TQ = [];
const flush = () => { for (let n = 0; TQ.length && n < 1000; n++) { TQ.sort((a, b) => a.at - b.at || a.id - b.id); const t = TQ.shift(); CLOCK = Math.max(CLOCK, t.at); t.fn(); } };
const SAVE = { runs: 5, wins: 0, arts: {}, ach: {}, best: 0, lb: [], daily: {}, mute: true, kills: 0, seenHelp: true, iseq: 1, inv: [], eq: {}, tank: { name: 'T' } };
const LS = { bulge2_meta: JSON.stringify(SAVE) };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
const sandbox = { window: win, document: doc, console, matchMedia: () => ({ matches: false }), navigator: { language: 'fr-FR' },
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
  performance: { now: () => CLOCK }, requestAnimationFrame: () => 0, setTimeout: (fn, ms) => (TQ.push({ at: CLOCK + (ms || 0), fn, id: ++TID }), TID), clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox), call = e => vm.runInContext(e, ctx);
call(`(function(){let s=1;Math.__seed=v=>{s=(v>>>0)||1;};Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
vm.runInContext(ORDER.map(readModule).join('\n'), ctx, { filename: 'game.js' });
const start = (prof, seed) => call(`Math.__seed(${seed});newRun(${JSON.stringify(prof)},false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;G.tuto=null;`);
const J = e => JSON.parse(call('JSON.stringify(' + e + ')'));
const checks = []; const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d: d || '' }); console.log((ok ? '  OK     ' : '  ECHEC  ') + n + (d ? '  — ' + d : '')); };
console.log('Annonces du duel' + (REF ? ' — code de ' + REF : ' — arbre de travail'));

/* un duel propre et déterministe : pas de critique, pas d'altération, pas d'esquive, énergie pleine */
const duel = (sk) => { start('bal', 7); TQ.length = 0;
  call(`G.p.sk=${JSON.stringify(sk)};G.p.crit=0;G.p.st={};G.p.dodge=0;duelStart(0);DU.me.crit=0;for(const f of DU.foes){f.sh=0;f.st={};f.grouped=0;}renderDuel()`); };
/* boutons d'action rendus : data-a, désactivé, nom, description */
const buttons = () => { const h = call(`document.getElementById('dvAct').innerHTML`), r = {};
  for (const m of h.matchAll(/<button class="dact" data-a="([^"]+)" ([^>]*)><b>(.*?)<\/b><span>(.*?)<\/span>/g)) r[m[1]] = { off: /disabled/.test(m[2]), n: m[3].replace(/<[^>]+>/g, ''), d: m[4] };
  return r; };
const pct = s => { const m = /(\d+) %/.exec(s); return m ? +m[1] : NaN; };

/* ---------- 1. compétence sans effet en duel ---------- */
{
  const ids = J('Object.keys(SKL)'), bad = [], seen = [];
  for (const id of ids) {
    duel([{ id: 'lance', l: 1, cd: 0 }, { id, l: 1, cd: 0 }]);
    const b = buttons().sk1;
    const before = J(`{en:DU.me.en,cd:DU.me.cd,st:JSON.stringify([DU.me.hp,DU.me.sh,DU.me.evade,DU.foes.map(f=>[f.hp,f.sh,f.grouped,f.pi])]),log:DU.log.length}`);
    call(`duelAct('sk1')`);
    const after = J(`{en:DU.me.en,cd:DU.me.cd,st:JSON.stringify([DU.me.hp,DU.me.sh,DU.me.evade,DU.foes.map(f=>[f.hp,f.sh,f.grouped,f.pi])]),log:DU.log.length}`);
    const acted = after.st !== before.st || after.log !== before.log, spent = after.en !== before.en || after.cd[1] !== before.cd[1];
    seen.push(id + (b.off ? '(off)' : ''));
    if (b.off === acted) bad.push(id + ' : bouton ' + (b.off ? 'désactivé' : 'actif') + ' mais l’appui ' + (acted ? 'agit' : 'n’agit pas') + ' (énergie ' + before.en + '→' + after.en + ', recharge ' + after.cd[1] + ')');
    else if (!acted && spent) bad.push(id + ' : sans effet mais débite énergie ' + before.en + '→' + after.en + ', recharge ' + after.cd[1]);
  }
  console.log('     ' + seen.join(' '));
  check('compétence : bouton actif ⇔ l’appui agit ; sans effet → désactivée, rien de débité', !bad.length, bad.join(' | ') || ids.length + ' compétences');
}

/* ---------- 2. marque : intention affichée = coup reçu, ennemi par ennemi ---------- */
{
  const run = (setup) => { duel([null, null]);
    call(`DU.foes.length=2;for(const f of DU.foes){f.hp=f.mhp=999;f.frozen=0;}DU.me.hp=DU.me.mhp=9999;DU.me.drones=0;DU.me.evade=0;DU.me.sh=0;${setup};renderDuel()`);
    const html = call(`document.getElementById('dvFoes').innerHTML`), names = J('DU.foes.map(f=>f.n)');
    const shown = [...html.matchAll(/<div class="fi">(.*?)<\/div>/g)].map(m => { const x = /(\d+)/.exec(m[1].replace(/<[^>]+>/g, '')); return /Attaque|Frappe/.test(m[1]) ? +x[1] : null; });
    call('duelEndTurn()'); flush();
    const log = J('DU?DU.log:[]').join(' | ');
    const got = names.map(n => { const m = new RegExp(n + ' : (?:attaque|frappe lourde) (\\d+)').exec(log); return m ? +m[1] : null; });
    return { shown, got, log };
  };
  const cases = [['marqué, deux attaquants', `DU.me.mark=1;for(const f of DU.foes){f.p=[['atk',10]];f.pi=0;}`],
                 ['marque posée par le 1er, le 2e attaque', `DU.me.mark=0;DU.foes[0].p=[['mark',0]];DU.foes[0].pi=0;DU.foes[1].p=[['atk',10]];DU.foes[1].pi=0;`]];
  for (const [n, s] of cases) { const r = run(s);
    check('marque (' + n + ') : intention affichée = coup reçu', JSON.stringify(r.shown) === JSON.stringify(r.got), 'écran ' + JSON.stringify(r.shown) + ' / journal ' + JSON.stringify(r.got) + ' — ' + r.log); }
}

/* ---------- 3. Singularité : promesse du texte = bonus mesuré ---------- */
{
  duel([{ id: 'trou', l: 1, cd: 0 }, null]);
  const txt = buttons().sk0.d;
  call(`DU.foes.length=1;const f=DU.foes[0];f.hp=f.mhp=99999;DU.me.en=9;duelAct('sk0')`);
  /* coup unitaire à 40 % (Rafale, 3 tirs) puis 100 % (Tir standard), groupé vs attendu non groupé */
  const hit = (k) => J(`(()=>{const f=DU.foes[0],h=f.hp;DU.kind=${k};DU.me.en=9;DU.me.crit=0;duelAct('tir');return h-f.hp;})()`);
  const base = J('dBase()'), r1 = hit(3), r2 = hit(3), t1 = hit(0), grp = J('DU.foes[0].grouped');
  const n40 = 3 * Math.round(base * .4), n100 = Math.round(base);
  const persists = r1 > n40 && r2 > n40, full = t1 > n100;
  const saysNext = /prochain/i.test(txt), namesLimit = /moins de|sous \d+ %|< ?\d+ %/.test(txt);
  const ok = saysNext === !persists && namesLimit === !full && r1 > n40;
  check('Singularité : le texte dit ce que fait le bonus', ok,
    '« ' + txt + ' » — Rafale ' + n40 + ' sans bonus → ' + r1 + ', ' + r2 + ' (groupé=' + grp + ') ; Tir 100 % ' + n100 + ' → ' + t1 +
    (saysNext && persists ? ' ; promet « prochain » mais le bonus reste' : '') + (!namesLimit && !full ? ' ; tait que les coups à 100 % n’en profitent pas' : ''));
}

/* ---------- 4. pourcentage affiché = effet au niveau courant ---------- */
{
  const bad = [], seen = [];
  for (let l = 1; l <= 3; l++) {
    duel([{ id: 'lance', l, cd: 0 }, { id: 'shield', l, cd: 0 }]);
    const B = buttons(), a = pct(B.sk0.d), e = pct(B.sk1.d), base = J('dBase()');
    call(`DU.foes[DU.sel].hp=DU.foes[DU.sel].mhp=99999`);
    const d = J(`(()=>{const f=DU.foes[DU.sel],h=f.hp;duelAct('sk0');return h-f.hp;})()`);
    const sh = J(`(()=>{const s=DU.me.sh;DU.me.en=9;duelAct('sk1');return DU.me.sh-s;})()`), mhp = J('DU.me.mhp');
    const ra = 100 * d / base, re = 100 * sh / mhp;
    seen.push(B.sk0.n + ' ' + a + '→' + ra.toFixed(0) + ' / ' + B.sk1.n + ' ' + e + '→' + re.toFixed(0));
    if (Math.abs(ra - a) > 1 + 50 / base) bad.push(B.sk0.n + ' annonce ' + a + ' %, fait ' + ra.toFixed(1) + ' %');
    if (Math.abs(re - e) > 1 + 50 / mhp) bad.push(B.sk1.n + ' annonce ' + e + ' %, fait ' + re.toFixed(1) + ' %');
  }
  console.log('     ' + seen.join(' | '));
  check('niveau : % affiché = % appliqué (Lance, Égide, niveaux I à III)', !bad.length, bad.join(' | ') || 'annonces exactes');
}

/* ---------- 5. chasseur endormi ---------- */
{
  start('bal', 7);
  const draw = (dorm) => { const rec = [];
    call(`(()=>{G.gx.dorm=${dorm};G.state='play';const h=WD.hunt[0];G.p.x=h.x;G.p.y=h.y+80;VL=h.x-2000;VR=h.x+2000;VT=h.y-2000;VB=h.y+2000;})()`);
    const old = call('ctx'); sandbox.__REC = mkCtx(rec); call('ctx=__REC;gxDrawWorld()'); sandbox.__OLD = old; call('ctx=__OLD');
    const n = call('WD.hunt[0].n.toUpperCase()'), near = J('(gxNear()||{}).k||null');
    return { name: rec.some(x => x[0] === 'fillText' && x[1] === n), near, n };
  };
  const awake = draw(false), asleep = draw(true);
  check('chasseur éveillé (témoin) : nom dessiné, invite proposée', awake.name && awake.near === 'hunt', 'nom ' + awake.name + ', invite ' + awake.near);
  check('chasseur endormi : pas dessiné comme adversaire (pas d’invite ⇒ pas de nom)', !asleep.name && asleep.near !== 'hunt',
    '« ' + asleep.n + ' » ' + (asleep.name ? 'dessiné' : 'non dessiné') + ', invite ' + asleep.near);
}

const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE (' + checks.length + ' critères)' : 'ECHEC : ' + checks.filter(c => !c.ok).length + ' / ' + checks.length);
process.exit(all ? 0 : 1);
