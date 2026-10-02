'use strict';
/* =========================================================
   Garde-fou du MONDE À L'ÉCHELLE 1 (g3.js applyRes, worldTf, img1, obsImg) — fluidité, 02/10/2026.

   Fait mesuré (Chromium en rendu LOGICIEL, 1920x1080 : le moteur du canevas de Firefox chez le propriétaire, skia) :
   le monde était dessiné à 1,5 pixel du canevas par unité (1920x1080, PS=1) ; chaque chunk, chaque sprite, chaque halo
   était donc ÉTIRÉ, donc filtré : ~8,8 ns par pixel, contre ~1,4 ns posé tel quel au pixel entier. Rendu 13 à 15 ms par
   image, dont 9 à 10 ms pour le seul sol ; pires images 83 à 116 ms (boss, passage d'îlot).
   Désormais : le canevas a ~720 lignes en paysage (560 colonnes en portrait), un pixel par unité du monde, et tout ce
   qui est un sprite est posé à sa taille naturelle au pixel entier. Mesuré : rendu 4 à 6 ms, 7,7 ms en combat chargé.

   Ce que ce test défend :
     E1. en jeu, à 1920x1080, 1366x768 et 390x844 (téléphone) : PS×zoom = 1 et la transformation du monde est
         [1,0,0,1,entier,entier] ;
     E2. sur les 8 îlots, en pleine vague (ennemis, tirs, explosions, power-up, obstacles), la surface ÉTIRÉE posée
         par drawImage dans le canevas principal reste sous ETIRE pixels par image (avant : 2,9 à 5,9 millions) ;
     E3. passage d'îlot : dessiné en demi-résolution (un quart des pixels), sauf l'image copiée pour la relique, faite
         en pleine résolution ; la pleine résolution revient à l'arrivée ;
     E4. pale() rend une couleur hexadécimale : sphere() en fait un sprite (avant : rgba(NaN,NaN,…) levait une exception
         dans le rendu à chaque proie avalée, et l'image s'arrêtait là).

   node test/echelle.js                arbre de travail
   node test/echelle.js --ref=<commit> code d'un commit (avant le correctif : E1, E2, E3, E4 doivent ECHOUER)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
/* seuls restent étirés, par construction, les flancs des tours (îlot urbain : façades cisaillées en perspective, ~40 kpx) */
const ETIRE = 100e3;

/* ---------- contexte 2D : suit la transformation, journalise les drawImage du canevas principal ---------- */
const LOG = [];
let MAIN = null;
function mkCtx(el) {
  if (el.__ctx) return el.__ctx;
  const grad = { addColorStop(o, c) { if (/NaN/.test(String(c))) throw new Error('couleur invalide : ' + c); } };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
  const T = [1, 0, 0, 1, 0, 0], S = [];
  const mul = (a, b, c, d, e, f) => { const [A, B, C, D, E, F] = T; T[0] = A * a + C * b; T[1] = B * a + D * b; T[2] = A * c + C * d; T[3] = B * c + D * d; T[4] = A * e + C * f + E; T[5] = B * e + D * f + F; };
  const base = {
    __T: T,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
    setTransform(a, b, c, d, e, f) { T[0] = a; T[1] = b; T[2] = c; T[3] = d; T[4] = e; T[5] = f; },
    resetTransform() { this.setTransform(1, 0, 0, 1, 0, 0); },
    transform(a, b, c, d, e, f) { mul(a, b, c, d, e, f); },
    scale(x, y) { mul(x, 0, 0, y, 0, 0); }, translate(x, y) { mul(1, 0, 0, 1, x, y); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); mul(c, s, -s, c, 0, 0); },
    save() { S.push(T.slice()); }, restore() { const t = S.pop(); if (t) for (let i = 0; i < 6; i++) T[i] = t[i]; },
  };
  base.drawImage = function (src, ...a) { if (this.__cv === MAIN) LOG.push({ src, a, T: T.slice() }); };
  const c = new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : function () {}), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
  c.__cv = el; el.__ctx = c;
  return c;
}
/* surface d'écran d'un drawImage et s'il est posé TEL QUEL (échelle 1, sans rotation, taille naturelle, pixel entier) */
function area(e, cw, ch) {
  const s = e.src || {}, a = e.a, T = e.T;
  let x, y, w, h;
  if (a.length === 2) { [x, y] = a; w = s.width; h = s.height; } else if (a.length === 4) { [x, y, w, h] = a; } else { x = a[4]; y = a[5]; w = a[6]; h = a[7]; }
  const un = T[0] === 1 && T[3] === 1 && T[1] === 0 && T[2] === 0;
  const X0 = T[0] * x + T[2] * y + T[4], Y0 = T[1] * x + T[3] * y + T[5];
  const nat = un && w === s.width && h === s.height && (a.length !== 8 || (a[2] === a[6] && a[3] === a[7])) && Number.isInteger(X0) && Number.isInteger(Y0);
  const sx = Math.hypot(T[0], T[1]), sy = Math.hypot(T[2], T[3]);
  const x0 = Math.max(0, X0), y0 = Math.max(0, Y0), x1 = Math.min(cw, X0 + w * sx), y1 = Math.min(ch, Y0 + h * sy);
  return { px: Math.max(0, x1 - x0) * Math.max(0, y1 - y0), nat };
}

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const has = (H, n) => H.call(`typeof ${n}!=='undefined'`);

/* ================= E1 : échelle 1 à trois tailles d'écran ================= */
for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844]]) {
  const H = L.mkGame({ ref: REF, w, h, mkCtx, seed: 77 });
  MAIN = H.call('MAINCTX').__cv;
  H.call('DPR=1;resize();'); H.start(); H.call(`G.state='play';meta.fps=false;`);
  H.steps(5); H.call('render(0,16.7)');
  H.call('worldTf()');
  const T = H.call('MAINCTX').__T.slice(), ps = H.call('PS'), rz = H.call('RZ'), cw = H.call('cv.width'), chh = H.call('cv.height');
  const ok = T[0] === 1 && T[3] === 1 && T[1] === 0 && T[2] === 0 && Number.isInteger(T[4]) && Number.isInteger(T[5]) && Math.abs(ps * rz - 1) < 1e-3;
  check(`E1 ${w}x${h} : le monde est dessiné à l'échelle 1, au pixel entier`, ok,
    `PS=${ps.toFixed(4)} zoom=${rz.toFixed(4)} PS×zoom=${(ps * rz).toFixed(4)} ; worldTf=[${T.map(v => +v.toFixed(3)).join(',')}] ; canevas ${cw}x${chh}`);
}

/* ================= E2 : surface étirée en pleine vague, 8 îlots ================= */
{
  const H = L.mkGame({ ref: REF, w: 1920, h: 1080, mkCtx, seed: 99 });
  MAIN = H.call('MAINCTX').__cv;
  H.call('DPR=1;QL=3;RES=1;resize();perf=function(){};'); H.start(); H.call(`G.state='play';meta.fps=false;window.__SIM_GOD=1;`);
  const cw = H.call('cv.width'), ch = H.call('cv.height');
  const res = [];
  for (let k = 1; k <= 8; k++) {
    H.call(`G.isl=${k};genIslet(G.seed,${k});islStart();G.pickIsl=${k};G.state='play';G.ph='wave';G.phT=0;G.wave=1;G.wq={left:0,n:12,el:99,eld:true,prey:0,nextT:1e9};G.p.inv=1e9;`);
    for (let i = 0; i < 30; i++) H.call('render(0,16.7)');   /* cuisson sur place, sprites, décors */
    /* la scène : 14 ennemis des types de l'îlot (et une proie), des tirs des deux camps, trois explosions, un power-up */
    H.call(`(function(){const P=G.p;for(let i=0;i<14;i++){const a=i/14*6.283,t=ETL[Math.max(0,${k}-1-(i%2))];mkEnemy(t,P.x+Math.cos(a)*(120+i*12),P.y+Math.sin(a)*(90+i*8),{spawn:0});}
      if(${k}>=3)mkEnemy(ETL[${k}-3],P.x+60,P.y-140,{spawn:0});
      for(let i=0;i<24;i++){ebul(P.x+Math.cos(i)*200,P.y+Math.sin(i)*150,i,2,6);pbul(P.x,P.y,i*.26);}
      for(let i=0;i<3;i++)killEnemy(G.en[i]);dropPU(P.x+80,P.y+40,'rapid');G.p.orbs=2;G.p.drones=1;})()`);
    let et = 0, tot = 0; const N = 6;
    for (let i = 0; i < N; i++) { LOG.length = 0; H.call('G.t+=1;render(0,16.7)'); for (const e of LOG) { const a = area(e, cw, ch); tot += a.px; if (!a.nat) et += a.px; } }
    res.push({ k, b: H.call('G.biome'), et: et / N, tot: tot / N });
  }
  const pire = res.reduce((m, r) => r.et > m.et ? r : m, res[0]);
  check(`E2 8 îlots en pleine vague : surface étirée ≤ ${(ETIRE / 1e3).toFixed(0)} kpx par image dans le canevas principal`, res.every(r => r.et <= ETIRE),
    res.map(r => `${r.k} ${r.b} ${(r.et / 1e3).toFixed(0)}/${(r.tot / 1e3).toFixed(0)} kpx`).join(' · ') + ` (étiré/total) ; pire : îlot ${pire.k}`);
}

/* ================= E3 : passage d'îlot en demi-résolution, relique en pleine résolution ================= */
{
  const H = L.mkGame({ ref: REF, w: 1920, h: 1080, mkCtx, seed: 5 });
  MAIN = H.call('MAINCTX').__cv;
  H.call('DPR=1;resize();'); H.start(); H.call(`G.state='play';meta.fps=false;G.p.inv=1e9;`);
  H.call('render(0,16.7)');
  const full = [H.call('PS'), H.call('cv.width')];
  H.call('G.en=[];G.boss=null;islClear();');
  H.steps(400, () => H.call("G.state==='trans'&&G.tr.t>=2")); H.call('render(0,16.7)');
  const mid = [H.call('PS'), H.call('cv.width')];
  H.steps(200, () => H.call("G.state==='trans'&&G.tr.t>=TR_SNAP"));
  const snap = has(H, 'TRS') ? H.call('TRS&&TRS.width') : null;
  H.steps(600, () => H.call("G.state!=='trans'")); H.call('render(0,16.7)');
  const back = [H.call('PS'), H.call('cv.width')];
  check('E3 passage d\'îlot : demi-résolution pendant, copie de la relique en pleine résolution, pleine résolution à l\'arrivée',
    Math.abs(mid[0] - full[0] / 2) < 1e-9 && mid[1] === Math.round(full[1] / 2) && snap === full[1] && back[0] === full[0] && back[1] === full[1],
    `jeu PS=${full[0].toFixed(3)} canevas ${full[1]} ; passage PS=${mid[0].toFixed(3)} canevas ${mid[1]} ; copie ${snap} ; arrivée PS=${back[0].toFixed(3)} canevas ${back[1]}`);
}

/* ================= E4 : couleur pâle des proies ================= */
{
  const H = L.mkGame({ ref: REF, w: 800, h: 600, mkCtx, seed: 3 });
  MAIN = H.call('MAINCTX').__cv;
  H.start(); H.call(`G.state='play';meta.fps=false;`);
  const p = H.call("pale('#ff3355')");
  let err = '';
  try { H.call(`(function(){const P=G.p;const e=mkEnemy('mite',P.x+40,P.y,{spawn:0,age:2});absorb(e);render(0,16.7);G.t++;render(0,16.7);})()`); } catch (e) { err = String(e.message || e).split('\n')[0]; }
  check('E4 pale() rend une couleur hexadécimale, et une proie avalée se dessine sans exception', /^#[0-9a-f]{6}$/.test(p) && !err, `pale('#ff3355')=${p}` + (err ? ` ; exception : ${err}` : ''));
}

console.log(`test/echelle.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
