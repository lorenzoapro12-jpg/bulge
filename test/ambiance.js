'use strict';
/* =========================================================
   Garde-fou du COÛT DE L'AMBIANCE (décor lointain, halos, météo, décor vivant) — fluidité complète, 01/10/2026.

   Le défaut : au canevas logiciel (Firefox du propriétaire, AzureCanvasBackend skia), un sprite étiré coûte ~8,8 ns par
   pixel d'écran, quelle que soit son opacité ; posé à l'échelle 1 au pixel entier, ~1,4 ns. Les couches d'ambiance
   étiraient jusqu'à 1,7 million de pixels par image (brume des Plaines presque invisible : ~12 ms ; nuages de l'Archipel :
   ~26 ms en Skia brut ; halo du joueur : ~6 ms partout). Mesure Chromium logiciel 1920x1080 : en coupant toute
   l'ambiance, chaque biome passe de 26-47 ips à 60.

   Ce que ce test défend, pour CHAQUE biome, qualité haute, 1920x1080 :
     A1. la surface ÉTIRÉE (drawImage hors échelle 1) dessinée par l'ambiance reste sous AMB_ETIRE pixels par image ;
     A2. la surface totale posée par l'ambiance (étirée + à l'échelle 1) reste sous AMB_TOTAL pixels par image ;
     A0. la mesure n'est PAS VIDE : chaque fonction d'ambiance exigée (FN) existe, est enveloppée, est appelée pendant la
         mesure, et chaque biome pose quelque chose (au moins le halo du joueur).

   Refonte en îlots (02/10/2026) : un îlot = un biome (ISL[k-1], gw.js). Les biomes ne se cherchent plus par biomeMix sur
   le monde continu : on génère l'îlot k (genIslet + islStart, comme le passage d'un îlot à l'autre) pour k = 1..8 et on
   mesure à DEUX places — le point d'arrivée (centre, sur la relique) et à mi-rayon de l'arène — en gardant la pire.
   Ancienne liste : drawVista (gv.js, décors du rêve), drawAmers et drawSeuils (sentiers et monuments) ont disparu avec
   leur sujet. Avant, une fonction absente était sautée EN SILENCE (typeof) : le test aurait passé à vide si l'ambiance
   avait été renommée. Désormais chaque fonction de FN est EXIGÉE (A0) : une fonction retirée ou renommée fait échouer
   le test en la nommant — mettre FN à jour, jamais assouplir A0.

   node test/ambiance.js                arbre de travail
   node test/ambiance.js --ref=<commit> un commit de la refonte en îlots ou plus récent (genIslet). Le témoin d'avant le
                                        correctif (monde continu) reste l'ancienne version : git show 6717bb4:test/ambiance.js
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const VW = 1920, VH = 1080;
const REF = L.ARG('ref');

/* ---------- contexte 2D : suit la transformation, journalise les drawImage (destination, échelle, translation) ---------- */
const OPS = { n: 0, main: null };
const LOG = [];
function mkCtx(el) {
  if (el.__ctx) return el.__ctx;
  const grad = { addColorStop() {} };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 }, T = [1, 1, 0, 0, 0], S = [];   /* échelle x, y, translation x, y, rotation */
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
    setTransform(a, b, c, d, e, f) { T[0] = Math.hypot(a, b); T[1] = Math.hypot(c, d); T[2] = e; T[3] = f; T[4] = b || c ? 1 : 0; OPS.n += this.__cv === OPS.main; },
    resetTransform() { T[0] = T[1] = 1; T[2] = T[3] = T[4] = 0; }, scale(x, y) { T[0] *= Math.abs(x); T[1] *= Math.abs(y); OPS.n += this.__cv === OPS.main; },
    translate(x, y) { T[2] += T[0] * x; T[3] += T[1] * y; OPS.n += this.__cv === OPS.main; }, rotate(r) { if (r) T[4] = 1; OPS.n += this.__cv === OPS.main; },
    save() { S.push(T.slice()); OPS.n += this.__cv === OPS.main; }, restore() { const t = S.pop(); if (t) for (let i = 0; i < 5; i++) T[i] = t[i]; OPS.n += this.__cv === OPS.main; },
  };
  base.drawImage = function (src, ...a) {
    if (this.__cv === OPS.main) OPS.n++;
    LOG.push({ dst: this.__cv, src, gco: st.globalCompositeOperation, ga: st.globalAlpha, a, sx: T[0], sy: T[1], tx: T[2], ty: T[3], rot: T[4] });
  };
  const c = new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : function () { if (this && this.__cv === OPS.main) OPS.n++; }), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
  c.__cv = el; el.__ctx = c;
  return c;
}

const H = L.mkGame({ ref: REF, w: VW, h: VH, mkCtx });
const call = H.call;
if (call("typeof genIslet") !== 'function') { console.log(`test/ambiance.js — ${REF}\n  ECHEC ce commit précède la refonte en îlots (pas de genIslet) : voir git show 6717bb4:test/ambiance.js`); process.exit(1); }

/* au 01/10/2026 : étiré ≤ 0,15 Mpx, total ≤ 0,91 Mpx selon le biome ; avant : étiré 0,9 à 5,7 Mpx. Ne compte que les drawImage
   (pas les aplats ni les traits : rais de lumière, aurores, réseau). */
const AMB_ETIRE = 250e3, AMB_TOTAL = 1.2e6;
/* fonctions d'ambiance du rendu (g3.js), TOUTES exigées (A0) */
const FN = ['drawFar', 'drawLowGlows', 'drawWeather', 'drawLive', 'drawDeco', 'drawMarks'];
const manquantes = JSON.parse(call(`JSON.stringify(${JSON.stringify(FN)}.filter(n=>typeof globalThis[n]!=='function'))`));
call(`(function(){globalThis.__AMB=0;globalThis.__AMBN={};for(const n of ${JSON.stringify(FN)}){if(typeof globalThis[n]!=='function')continue;const f=globalThis[n];__AMBN[n]=0;globalThis[n]=function(){__AMB++;__AMBN[n]++;try{return f.apply(this,arguments);}finally{__AMB--;}};}})()`);
const realPush = LOG.push.bind(LOG);
LOG.push = e => realPush(Object.assign(e, { amb: call('__AMB') > 0 }));
OPS.main = call('MAINCTX').__cv;
call(`DPR=1;QL=3;RES=1;resize();applyRes();perf=function(){};`);
H.start();
call(`G.state='play';meta.fps=false;`);
const cw = call('cv.width'), ch = call('cv.height');
/* surface d'écran réellement couverte (rectangle de destination coupé au canevas ; sans coupe sous rotation) */
const area = e => { const s = e.src || {}, a = e.a; let x, y, w, h;
  if (a.length === 2) { [x, y] = a; w = s.width; h = s.height; } else if (a.length === 4) { [x, y, w, h] = a; } else { x = a[4]; y = a[5]; w = a[6]; h = a[7]; }
  const nat = a.length === 2 && Math.abs(e.sx - 1) < 1e-6 && Math.abs(e.sy - 1) < 1e-6;
  if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
  let X0 = e.tx + x * e.sx, Y0 = e.ty + y * e.sy, X1 = X0 + w * e.sx, Y1 = Y0 + h * e.sy;
  if (!e.rot) { X0 = Math.max(0, X0); Y0 = Math.max(0, Y0); X1 = Math.min(cw, X1); Y1 = Math.min(ch, Y1); }
  return { px: Math.max(0, X1 - X0) * Math.max(0, Y1 - Y0), nat }; };
const fmt = v => (v / 1e6).toFixed(2) + ' Mpx';
const res = [];
const t0 = Date.now(), PRM = call('PR') * 0.5;
for (let k = 1; k <= 8; k++) {
  /* l'îlot k, comme au passage d'un îlot à l'autre (g2.js updTrans) ; la météo repart de zéro (sinon les particules de
     l'îlot précédent, qui ne changent de type qu'en sortant de l'écran, seraient comptées ici) */
  const B = call(`G.isl=${k};genIslet(G.seed,${k});islStart();G.state='play';WEA.length=0;G.biome`);
  const r = { B, k, et: 0, tot: 0, pos: [] };
  for (const [nom, px, py] of [['centre', 0, 0], ['mi-rayon', Math.cos(k * 0.9) * PRM, Math.sin(k * 0.9) * PRM]]) {
    call(`G.p.x=G.cx=${px};G.p.y=G.cy=${py};G.pcx=G.pcy=null;G.zoom=zoomTarget();G.pzoom=null;G.trauma=0;`);
    for (let i = 0; i < 40; i++) call('render(0,16.7)');   /* cuisson sur place, sprites, décors */
    let et = 0, tot = 0; const N = 6;
    for (let i = 0; i < N; i++) { LOG.length = 0; call('G.t+=1;render(0,16.7)');
      for (const e of LOG) if (e.amb && e.dst === OPS.main) { const a = area(e); tot += a.px; if (!a.nat) et += a.px; } }
    r.et = Math.max(r.et, et / N); r.tot = Math.max(r.tot, tot / N); r.pos.push(nom + ' ' + fmt(et / N) + '/' + fmt(tot / N));
  }
  res.push(r);
}
const appels = JSON.parse(call('JSON.stringify(__AMBN)'));
const muettes = FN.filter(n => !(appels[n] > 0));
const biomes = res.map(r => r.B), attendus = JSON.parse(call('JSON.stringify(ISL)'));
const A0 = manquantes.length === 0 && muettes.length === 0 && res.length === 8 && res.every(r => r.tot > 0) && attendus.every(b => biomes.includes(b));
const A1 = res.every(r => r.et <= AMB_ETIRE), A2 = res.every(r => r.tot <= AMB_TOTAL);
console.log(`test/ambiance.js — ${REF ? 'code ' + REF : 'arbre de travail'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
for (const r of res) console.log('  îlot ' + r.k + ' ' + r.B.padEnd(7) + ` étiré ${fmt(r.et)}, total ${fmt(r.tot)} (pire de : ${r.pos.join(' ; ')})`);
console.log((A0 ? '  OK   ' : '  ECHEC') + ' A0. mesure non vide : ' + FN.length + ' fonctions exigées présentes et appelées, 8 biomes, chacun pose > 0 px'
  + (A0 ? '' : ' — ' + [manquantes.length ? 'absentes : ' + manquantes.join(', ') : '', muettes.length ? 'jamais appelées : ' + muettes.join(', ') : '', 'biomes mesurés : ' + biomes.join(',')].filter(Boolean).join(' ; ')));
console.log((A1 ? '  OK   ' : '  ECHEC') + ' A1. surface étirée par l\'ambiance ≤ ' + fmt(AMB_ETIRE) + ' par image, dans chaque biome');
console.log((A2 ? '  OK   ' : '  ECHEC') + ' A2. surface totale posée par l\'ambiance ≤ ' + fmt(AMB_TOTAL) + ' par image, dans chaque biome');
const all = A0 && A1 && A2;
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
