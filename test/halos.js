'use strict';
/* =========================================================
   Garde-fou de la COUCHE DES HALOS (lowBegin/lowEnd, g3.js) — saccades sur ordinateur, 01/10/2026.

   Le defaut : la couche basse resolution (decor lointain + grands halos) etait un <canvas id="low"> du DOM,
   plein ecran, en `mix-blend-mode:screen`. Le navigateur devait alors MELANGER deux calques plein ecran a
   chaque image, hors de notre JS. Mesure chez le proprietaire (PC AMD, Firefox, 1680x1050, compteur
   embarque) : « hors-JS » 12,0 ms par image avec ce melange, 2,9 ms sans (meme partie, qualite basse) ; en
   auto 50 ips, pire image 50 ms, JS 5 ms et hors-JS 15 ms. Ici (Chromium sans GPU, 1920x1080) : 35 -> 59 ips.

   Ce que ce test defend :
     1. STATIQUE : shell_head.html n'a plus de canvas #low, et aucun `mix-blend-mode` hors du logo du menu
        (un melange CSS sur un calque plein ecran de jeu, c'est exactement le cout qu'on retire) ;
     2. EXECUTION (vrais modules, DOM stube, test/lib.js) : plus AUCUN calque intermediaire compose en plein ecran
        (voir l'en-tete de la section 2 : la composition 'screen' dans le canevas a coute 9,38 ms par image chez le
        proprietaire) ; halos et decor lointain sont dessines directement en 'lighter', y compris en qualite basse ;
        attenues a 0,4 a la mort, comme le faisait `#cv.dying+#low{opacity:.4}`.

   Refonte en ilots (02/10/2026) : les halos de la passe basse sont ceux du joueur, du BOSS et des explosions (FX de type
   4) — drawLowGlows, g3.js ; les coeurs (G.hearts), qui fournissaient les paires du 2d, ont disparu. Le 2d se joue donc
   avec le boss de l'ilot et une explosion dans le champ, et une VRAIE mort (die() : etat 'dying'). Le 2a/2b passe sur
   les 8 ilots (un biome chacun, dont les trois qui ont un decor lointain : Archipel, Grille, Megapole), au lieu du seul
   biome de depart. Aucun critere retire.

   node test/halos.js                arbre de travail
   node test/halos.js --ref=<commit> un autre commit (ordre des modules et debut de partie : test/lib.js)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');

/* ---------- contexte 2D : journalise les drawImage (destination, source, composition, alpha) ---------- */
const LOG = [];
function mkCtx(el) {
  if (el.__ctx) return el.__ctx;
  const grad = { addColorStop() {} };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
  };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
  base.drawImage = function (src, ...a) { LOG.push({ dst: this.__cv, src, gco: st.globalCompositeOperation, ga: st.globalAlpha, a }); };
  const c = new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : () => {}), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
  c.__cv = el; el.__ctx = c;
  return c;
}
const H = L.mkGame({ ref: REF, mkCtx });
const call = H.call;

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

/* ================= 1. statique ================= */
{
  const sh = L.readModule('shell_head.html', REF);
  check('1a. shell_head.html : plus de <canvas id="low">', !/id="low"/.test(sh), /id="low"/.test(sh) ? 'present : le navigateur compose encore un second calque plein ecran' : 'absent');
  /* chaque mix-blend-mode doit appartenir a une regle du logo (.logo::before/::after, menu seulement) */
  const bad = [];
  for (const m of sh.matchAll(/([^{}]*)\{[^{}]*mix-blend-mode[^{}]*\}/g)) if (!/^\s*\.logo/.test(m[1].trim().split('\n').pop())) bad.push(m[1].trim().split('\n').pop().slice(-60));
  check('1b. aucun mix-blend-mode hors du logo du menu', bad.length === 0, bad.length ? 'regles : ' + bad.join(' | ') : 'seul .logo en utilise');
}

/* ================= 2. execution ================= */
/* Deuxieme temps (meme jour) : etiree DANS le canevas principal en 'screen', la couche a coute 9,38 ms (lowEnd, un seul
   drawImage plein ecran) sur le meme PC, auto 3/3, JS 23 ms. Ce qui est defendu desormais :
     2a. aucun canevas intermediaire n'est compose en plein ecran : pas de drawImage d'une source de la taille de
         l'ecran (ou de son quart) dans le canevas principal pendant la passe basse, et aucun 'screen' ;
     2b. les halos arrivent pourtant a l'ecran, directement dans le canevas principal, en 'lighter' ;
     2c. en qualite basse (QL 1), la passe des halos est SAUTEE (02/10/2026 : effets retires d'abord quand ca saccade),
         et rien de plein ecran n'est compose pour autant ;
     2d. a la mort, ils sont attenues a 0,4 (comme #cv.dying+#low), et l'attenuation ne fuit pas hors de la passe ;
     2e. les grands halos (natSpr) sont poses a l'echelle 1, au pixel entier. */
H.start();
call(`G.state='play';meta.q='auto';QL=3;RES=1;DPR=1;applyRes();`);
/* les appels de la passe basse : entre lowBegin et lowEnd (enveloppes posees ici, sans toucher au code) */
call(`(function(){const b=lowBegin,e=lowEnd;globalThis.__INLOW=false;lowBegin=function(){b();__INLOW=true;};lowEnd=function(){__INLOW=false;e();};})()`);
const realDraw = LOG.push.bind(LOG);
LOG.push = (e) => realDraw(Object.assign(e, { low: call('__INLOW') }));
const frame = () => {
  LOG.length = 0; call('render(0,16.7)');
  const main = call('MAINCTX').__cv, cw = call('cv.width'), ch = call('cv.height');
  const low = LOG.filter(e => e.low), toMain = low.filter(e => e.dst === main);
  /* les grands halos posés à l'échelle 1 (natSpr, g3.js, 01/10/2026) ont un sprite de leur taille d'écran : ce n'est pas un
     calque intermédiaire (rien d'autre n'y est dessiné), mais il doit être posé au pixel entier, sans étirement (2e) */
  const nat = new Set(call("typeof NAT!=='undefined'?[...NAT.values()]:[]")), natD = toMain.filter(e => nat.has(e.src));
  const big = toMain.filter(e => e.src && e.src.width >= cw / 4 - 1 && e.src.height >= ch / 4 - 1 && e.src !== main && !nat.has(e.src));
  return { low, toMain, big, natD, screen: LOG.filter(e => e.gco === 'screen'), other: low.filter(e => e.dst !== main), n: call('LOWN'), lowa: call("typeof LOWA!=='undefined'?LOWA:1"), cw, ch };
};
const desc = r => `${r.toMain.length} drawImage dans le canevas principal pendant la passe (ops : ${[...new Set(r.toMain.map(e => e.gco))].join(',') || '-'}) ; ${r.other.length} ailleurs ; ${r.big.length} source(s) plein ecran ; ${r.screen.length} 'screen' ; LOWN=${r.n}`;
/* un ilot : genere comme au passage d'un ilot a l'autre (g2.js updTrans) */
const ilot = k => call(`G.isl=${k};genIslet(G.seed,${k});islStart();G.state='play';G.trauma=0;G.biome`);
{
  const ko = [], vus = [];
  let nb = 0, nat = 0, natBad = [], natN = 0;
  for (let k = 1; k <= 8; k++) {
    const b = ilot(k);
    /* regime etabli : les sprites en cache (grappes de lueurs de la Megapole, FLB=2 par image, et leurs copies natSpr) se
       construisent pendant les premieres images, dans leurs propres toiles — ce n'est pas un calque compose */
    for (let i = 0; i < 12; i++) frame();
    const r = frame();
    if (!(r.big.length === 0 && r.screen.length === 0 && r.other.length === 0)) ko.push(b + ' : ' + desc(r));
    if (r.n > 0 && r.toMain.length > 0 && r.toMain.some(e => e.gco === 'lighter')) nb++; else vus.push(b + ' : ' + desc(r));
    natN += r.natD.length; for (const e of r.natD) if (!(e.a.length === 2 && e.a.every(Number.isInteger))) natBad.push(b + ' ' + e.a.join(','));
    if (k === 1) nat = r;
  }
  check('2a. qualite haute, 8 ilots : aucun calque intermediaire compose en plein ecran, aucun screen', ko.length === 0, ko.length ? ko.join(' | ') : '8 ilots ; ilot 1 : ' + desc(nat));
  check('2b. les halos sont dessines directement dans le canevas principal, en lighter (8 ilots)', nb === 8, nb === 8 ? '8/8 ilots' : nb + '/8 — ' + vus.join(' | '));
  check('2e. les grands halos (natSpr) sont poses a l\'echelle 1, au pixel entier', natN > 0 && natBad.length === 0, natBad.length ? natBad.length + ' pose(s) fautive(s) : ' + natBad.slice(0, 4).join(' | ') : `${natN} pose(s) sur 8 ilots, ilot 1 : ${nat.natD.map(e => e.a.join(',')).join(' | ')}`);
}
{
  ilot(1);
  call('QL=1;applyRes();'); frame();
  const r = frame();
  check('2c. qualite basse : la passe des halos est sautee, rien de plein ecran n\'est compose', r.n === 0 && r.toMain.length === 0 && r.big.length === 0 && r.screen.length === 0, desc(r));
}
{
  /* le boss de l'ilot et une explosion (FX de type 4) dans le champ : leurs halos sont presents vivant ET mort (celui du
     joueur ne l'est plus a sa mort). Le boss est fige (pas de pas de simulation) ; ni secousse ni eclair. */
  ilot(3);
  call('QL=3;applyRes();spawnBoss();const B=G.boss;B.x=G.p.x-120;B.y=G.p.y-60;B.flash=0;G.trauma=0;G.fx.push({ty:4,x:G.p.x+140,y:G.p.y+20,vx:0,vy:0,r:60,life:10,max:14,col:COL.cy});');
  frame(); const vivant = frame();
  call('die();G.trauma=0;G.boss.flash=0;'); frame();
  const r = frame(), st = call('G.state');
  /* meme halo (meme source, meme rectangle) : son alpha mort / vivant doit valoir 0,4 */
  const key = e => e.src && e.src.width + ':' + e.a.map(v => Math.round(v)).join(',');
  const vk = new Map(vivant.toMain.filter(e => e.gco === 'lighter').map(e => [key(e), e.ga]));
  const paires = r.toMain.filter(e => e.gco === 'lighter' && vk.has(key(e)) && vk.get(key(e)) > 0).map(e => e.ga / vk.get(key(e)));
  /* deux halos au moins : celui du boss (natSpr, a l'echelle 1) et celui de l'explosion (etire) */
  const ok = st === 'dying' && paires.length >= 2 && paires.every(x => Math.abs(x - .4) < 1e-9) && r.lowa === 1;
  check('2d. a la mort (etat dying) : halos du boss et de l\'explosion attenues a 0,4 (comme #cv.dying+#low), sans fuite apres la passe', ok,
    `etat ${st} ; ${paires.length} halo(s) apparies, rapports ${[...new Set(paires.map(x => x.toFixed(3)))].join(',') || '-'} ; LOWA apres la passe = ${r.lowa}`);
}

/* ---------- verdict ---------- */
console.log(`test/halos.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
