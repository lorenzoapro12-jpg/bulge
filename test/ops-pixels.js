'use strict';
/* =========================================================
   MESURE : quelle SURFACE le rendu peint-il par IMAGE ? — BULGE headless

   node test/ops-pixels.js               les deux qualités × (immobile, en déplacement)
   node test/ops-pixels.js --images=N    images mesurées par scénario (défaut 300)
   node test/ops-pixels.js --chauffe=N   images de chauffe MINIMALES, joueur immobile (défaut 180) ; la chauffe dure
                                         jusqu'à 60 images de suite sans cuisson. Sa cuisson est donnée À PART.
   node test/ops-pixels.js --prologue    sauvegarde vierge (la partie est le prologue)
   node test/ops-pixels.js --resume      seulement le résumé, le verdict et l'empreinte
   node test/ops-pixels.js --k=5         coût d'une opération, en µs, pour l'HORLOGE VIRTUELLE (défaut 5)
   node test/ops-pixels.js --ref=HEAD    modules d'un commit git (sans rien écrire)

   Suite de test/ops-image.js : même harnais, mêmes quatre scénarios, même graine, même horloge virtuelle,
   même découpage (une image = un appel à la VRAIE frame(ts) de g4.js). ops-image compte les APPELS, où un
   drawImage plein canvas et un arc de 3 px pèsent pareil ; celui-ci donne à chaque appel la SURFACE qu'il
   couvre, en pixels DU CANVAS VISÉ, après la transformation courante (donc avec PS, RZ, RES réels).

   CE QU'IL MESURE — par image, en Mpx, rangé dans UNE couche :
     écran    : MAINCTX (le canvas #cv affiché), hors cuisson ;
     basse    : le canvas #low (g3.js, lowBegin) — quart de taille, décor lointain + grands halos ;
     cuisson  : tout ce qui est émis pendant bakeStep (gw2.js), quel que soit le contexte ;
     autre    : les autres canvas hors écran, hors cuisson (sprites, caches).
   Deux surfaces par appel : BRUTE (la forme entière, même hors du canvas) et ROGNÉE (la part qui tombe dans
   le canvas et dans le clip() courant). C'est la ROGNÉE qui est « peinte » : un rasteriseur ne remplit pas
   hors de sa cible. Le rognage se fait sur la boîte englobante de la forme : exact pour une forme alignée
   sur les axes (tous les drawImage et fillRect du monde), proportionnel sinon.

   PONDÉRATION, par forme d'appel, et sa qualité :
     exact     drawImage à 3, 5 ou 9 arguments (dw×dh × |det|) ; fillRect, clearRect (w×h × |det|) ;
               putImageData (w×h, sans transformation) ; fill() d'un chemin fait UNIQUEMENT de cercles/ellipses
               complets et de rect() : somme des disques (π r²) et des rectangles ;
     approché  stroke() : longueur du chemin × lineWidth (× part « pleine » du setLineDash). Ignore les bouts,
               les jointures, les recouvrements, et le fait qu'un trait de moins d'1 px touche quand même 1 px.
               Courbes de Bézier : longueur des cordes (8 segments), légèrement par défaut. strokeRect : périmètre × lineWidth ;
     BORNE SUP fill() de tout autre chemin : aire de la BOÎTE ENGLOBANTE du chemin accumulé depuis beginPath.
               C'est une borne supérieure (un triangle est compté le double, un chemin concave ou en L bien plus).
               À côté, la colonne « lacet » remplace cette boîte par la formule du lacet sur chaque sous-chemin
               (arcs échantillonnés) : exacte pour un polygone simple, c'est une ESTIMATION, pas une borne.
               roundRect est compté comme rect (coins non retirés : borne supérieure, écart négligeable) ;
     GROSSIER  fillText/strokeText : s.length×7 (la largeur que rend le stub measureText du harnais, quelle que
               soit la police) × hauteur de police lue dans `font`. Ordre de grandeur seulement ;
     NON PONDÉRÉ  toute méthode qui peint et dont la forme n'est pas ci-dessus (drawImage à 7 arguments — qui
               n'existe pas dans l'API —, fill(Path2D), méthode inconnue, surface non finie) : comptée À PART,
               en nombre d'appels, jamais convertie en pixels.
   Les dégradés et motifs ne sont pas comptés à leur création : la surface est comptée une fois, sur l'appel
   qui les consomme. Par poste : le poste est la fonction appelée DIRECTEMENT par render() (g3.js) qui était
   en cours ; le détail « a > b » donne la fonction draw… la plus profonde. Les fonctions sont enveloppées
   depuis le test (aucun module modifié) ; fichier:ligne = la ligne de `function nom(` dans le module.

   CE QU'IL NE MESURE PAS :
     - le TEMPS. Sous `vm` une durée ne vaut rien. Tout chiffre en ms de la sortie est une MULTIPLICATION
       (Mpx × un taux donné en hypothèse), étiquetée DÉDUIT. Le taux lui-même ne peut être mesuré qu'en navigateur ;
     - le coût par pixel, qui dépend de l'opération : copie opaque, mélange 'lighter', image agrandie avec
       lissage, dégradé, anticrénelage d'un chemin ne coûtent pas le même prix. Un Mpx n'est pas une unité de coût ;
     - la rasterisation DIFFÉRÉE de la source d'un drawImage (un canvas local jamais encore rasterisé est rejoué
       en entier au premier collage : coût porté par la source, pas par la surface de destination) ;
     - la composition par le navigateur : #low est un canvas du DOM (mix-blend-mode:screen, étiré en CSS à 100 %).
       Son agrandissement n'est PAS un appel canvas — lowEnd() sort sans rien dessiner quand LOWDOM est vrai ;
     - les pixels réellement modifiés (globalAlpha=0, couleur transparente, recouvrement : deux appels sur le
       même pixel comptent deux fois — c'est voulu, c'est du remplissage) ; filter=blur (gw.js, une fois) ;
     - le chemin PAR DÉFAUT en navigateur pour la cuisson (worker) : pas de Worker sous vm, cuisson sur place.

   C'est un INSTRUMENT, pas une garde : aucun seuil, code de sortie 0 sauf si la mesure elle-même est invalide
   (partie sortie de « play », qualité qui a bougé, joueur qui n'a pas avancé). Les surfaces dépendent de la
   scène (ennemis, effets, biome) : une partie « bal », graine fixe. L'empreinte doit être identique d'un
   lancement à l'autre — sinon ce n'est pas une mesure.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), NIM = +(ARG('images') || 300), NCH = +(ARG('chauffe') || 180), K = +(ARG('k') || 5) / 1000, STEPC = 1.5, VS = 1000 / 60;
const LW = 411, LH = 757, PROLO = !!ARG('prologue'), RESUME = !!ARG('resume'), CHMAX = 1500, TAU = Math.PI * 2;
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const readModule = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = ORDER.map(f => [f, readModule(f)]), CODE = SRC.map(x => x[1]).join('\n');
const CAT = ['ecran', 'basse', 'cuisson', 'autre'], QUAL = ['exact', 'approx', 'borne', 'grossier'];

/* ---------- où sont les fonctions : nom -> fichier:ligne, et la ligne de l'appel dans render() ---------- */
const DEF = new Map(); let RENDU = [], RLIG = 0;
for (const [f, src] of SRC) { const L = src.split('\n');
  L.forEach((l, i) => { const re = /(?:^|[^\w$.])function\s+([\w$]+)\s*\(/g; let m; while ((m = re.exec(l))) if (!DEF.has(m[1])) DEF.set(m[1], f + ':' + (i + 1)); });
  if (f === 'g3.js') { const a = L.findIndex(l => l.startsWith('function render(')); if (a >= 0) { let b = a + 1; while (b < L.length && !L[b].startsWith('function ')) b++; RLIG = a + 1; RENDU = L.slice(a, b).map((l, i) => [a + 1 + i, l]); } } }
const APPEL = new Map();   /* fonction appelée directement dans render() -> ligne de g3.js */
for (const [n, l] of RENDU) { const re = /([A-Za-z_$][\w$]*)\(/g; let m; while ((m = re.exec(l))) if (DEF.has(m[1]) && m[1] !== 'render' && !APPEL.has(m[1])) APPEL.set(m[1], n); }
const POSTES = [...new Set([...APPEL.keys(), ...[...DEF.keys()].filter(n => /^(draw[A-Z]|g[csixtv](Draw|HUD|Mini)|postFX$|low(Begin|End)$|soft$|fleeBuild$)/.test(n))])].filter(n => !['render', 'step', 'bakeStep', 'frame'].includes(n));
const ou = nom => { if (nom === '(render, direct)') return 'g3.js:' + RLIG; const p = nom.split(' > '), d = DEF.get(p[p.length - 1]) || '?', a = APPEL.get(p[0]); return d + (a ? ' ← render g3.js:' + a : ''); };

const inter = (b, c) => [Math.max(b[0], c[0]), Math.max(b[1], c[1]), Math.min(b[2], c[2]), Math.min(b[3], c[3])];
const ar = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const neuf = () => { const z = () => [0, 0, 0, 0], r = { n: z(), px: z(), raw: z(), lac: z(), np: z(), pas: 0, fin: 0, bk: 0 }; for (const q of QUAL) r[q] = z(); return r; };
const ajoute = (s, r) => { for (const k in s) if (Array.isArray(s[k])) for (let i = 0; i < 4; i++) s[k][i] += r[k][i]; else s[k] += r[k]; return s; };

function build() {
  /* ---------- compteur ---------- */
  let VCLK = 0, inBake = 0, inRender = 0, ON = false, I = neuf(); const pile = [];
  const M = { forme: new Map(), poste: new Map(), detail: new Map(), nonp: new Map(), toile: new Map() };
  const cle = (m, k) => { let o = m.get(k); if (!o) m.set(k, o = { n: 0, px: 0, raw: 0, lac: 0, mv: 0, ln: 0, st: 0, di: 0 }); return o; };
  /* el : l'élément canvas visé ; p : null (n'émet aucun pixel) ou {q, forme, raw, a, lac} */
  const rec = (el, n, w, p) => {
    VCLK += K * (w || 1); if (!ON) return;
    const c = inBake ? 2 : el.__id === 'cv' ? 0 : el.__id === 'low' ? 1 : 3;
    I.n[c]++;
    const po = pile.length ? pile[0] : inRender ? '(render, direct)' : '(hors render)', de = pile.length > 1 ? po + ' > ' + pile[pile.length - 1] : po;
    const cibles = [cle(M.poste, CAT[c] + '|' + po), cle(M.detail, CAT[c] + '|' + de)]; if (p) cibles.push(cle(M.forme, CAT[c] + '|' + p.forme));
    if (c === 3 && p) { const t = el.width + '×' + el.height; M.toile.set(t, (M.toile.get(t) || 0) + (p.a || 0)); }
    for (const o of cibles) { o.n++; if (n === 'moveTo') o.mv++; else if (n === 'lineTo') o.ln++; else if (n === 'stroke') o.st++; else if (n === 'drawImage') o.di++; }
    if (!p) return;
    if (p.q === 'non') { I.np[c]++; const k = CAT[c] + '|' + p.forme; M.nonp.set(k, (M.nonp.get(k) || 0) + 1); return; }
    I.px[c] += p.a; I.raw[c] += p.raw; I.lac[c] += p.lac; I[p.q][c] += p.a;
    for (const o of cibles) { o.px += p.a; o.raw += p.raw; o.lac += p.lac; }
  };
  /* méthodes qui n'émettent aucun pixel ; toute AUTRE méthode non pondérée ci-dessous tombe dans « non pondéré » */
  const MUET = new Set(['save', 'restore', 'beginPath', 'getLineDash', 'isPointInPath', 'isPointInStroke', 'getTransform', 'addColorStop', 'drawFocusIfNeeded', 'reset']);
  function mkCtx(el) {
    let m = [1, 0, 0, 1, 0, 0], clip = null, dash = 1, P; const pil = [], fns = new Map();
    const T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]], det = () => Math.abs(m[0] * m[3] - m[1] * m[2]);
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    const etend = (b, X, Y) => { if (X < b[0]) b[0] = X; if (Y < b[1]) b[1] = Y; if (X > b[2]) b[2] = X; if (Y > b[3]) b[3] = Y; };
    const boite = (x, y, w, h) => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const [X, Y] of [T(x, y), T(x + w, y), T(x, y + h), T(x + w, y + h)]) etend(b, X, Y); return b; };
    /* part de la boîte b qui tombe dans le canvas et dans le clip courant */
    const part = b => { const A = ar(b); if (!(A > 0)) return 0; const v = clip ? inter([0, 0, el.width, el.height], clip) : [0, 0, el.width, el.height]; return ar(inter(b, v)) / A; };
    const peint = (nom, forme, q, raw, b, lac) => { if (!isFinite(raw) || !b.every(isFinite)) return rec(el, nom, 1, { q: 'non', forme: forme + ' — surface non finie' });
      const f = raw > 0 ? part(b) : 0; rec(el, nom, 1, { q, forme, raw, a: raw * f, lac: (lac == null ? raw : lac) * f }); };
    const chemin = () => ({ b: [Infinity, Infinity, -Infinity, -Infinity], len: 0, subs: [], ex: 0, libre: 0 }); P = chemin();
    const dern = () => P.subs[P.subs.length - 1];
    const pt = (X, Y, sansLong) => { let s = dern(); if (!s) P.subs.push(s = []); else if (!sansLong && s.length) P.len += Math.hypot(X - s[s.length - 2], Y - s[s.length - 1]); s.push(X, Y); etend(P.b, X, Y); };
    const lacet = () => { let S = 0; for (const s of P.subs) { let a = 0; for (let i = 0, n = s.length; i < n; i += 2) { const j = (i + 2) % n; a += s[i] * s[j + 1] - s[j] * s[i + 1]; } S += Math.abs(a) / 2; } return S; };
    const balaye = (a0, a1, ccw) => { let d = ccw ? a0 - a1 : a1 - a0; if (d >= TAU - 1e-9) return TAU; d %= TAU; if (d < 0) d += TAU; return d; };
    const ell = (nom, cx, cy, rx, ry, rot, a0, a1, ccw) => { rx = Math.abs(rx); ry = Math.abs(ry);
      const sw = balaye(a0, a1, ccw), n = Math.max(1, Math.ceil(32 * sw / TAU)), s = dern(), vide = !s || !s.length, cr = Math.cos(rot), sr = Math.sin(rot), sg = ccw ? -1 : 1;
      for (let i = 0; i <= n; i++) { const t = a0 + sg * sw * i / n, u = rx * Math.cos(t), v = ry * Math.sin(t), p = T(cx + u * cr - v * sr, cy + u * sr + v * cr); pt(p[0], p[1], i > 0); }
      const R = Math.max(rx, ry), bb = boite(cx - R, cy - R, 2 * R, 2 * R); etend(P.b, bb[0], bb[1]); etend(P.b, bb[2], bb[3]);
      const h = rx + ry > 0 ? ((rx - ry) / (rx + ry)) ** 2 : 0, per = Math.PI * (rx + ry) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));   /* Ramanujan ; = 2πr pour un cercle */
      P.len += per * sw / TAU * Math.sqrt(det());
      if (sw === TAU && vide) P.ex += Math.PI * rx * ry * det(); else P.libre++;
      rec(el, nom); };
    const rect = (nom, x, y, w, h) => { const c = [T(x, y), T(x + w, y), T(x + w, y + h), T(x, y + h)]; P.subs.push([]); for (const p of c) pt(p[0], p[1], true); dern().push(c[0][0], c[0][1]); P.subs.push([c[0][0], c[0][1]]);
      P.len += 2 * (Math.abs(w) + Math.abs(h)) * Math.sqrt(det()); P.ex += Math.abs(w * h) * det(); rec(el, nom); };
    const courbe = (nom, pts) => { P.libre++; const s = dern(); const D = pts.map(p => T(p[0], p[1])); const p0 = s && s.length ? [s[s.length - 2], s[s.length - 1]] : D[0]; if (!s || !s.length) pt(p0[0], p0[1]);
      for (const d of D) etend(P.b, d[0], d[1]);
      for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; let X, Y;
        if (D.length === 2) { X = u * u * p0[0] + 2 * u * t * D[0][0] + t * t * D[1][0]; Y = u * u * p0[1] + 2 * u * t * D[0][1] + t * t * D[1][1]; }
        else { X = u * u * u * p0[0] + 3 * u * u * t * D[0][0] + 3 * u * t * t * D[1][0] + t * t * t * D[2][0]; Y = u * u * u * p0[1] + 3 * u * u * t * D[0][1] + 3 * u * t * t * D[1][1] + t * t * t * D[2][1]; }
        pt(X, Y); }
      rec(el, nom); };
    const texte = (nom, s, x, y, maxW) => { const f = /(\d+(?:\.\d+)?)px/.exec(String(base.font || '')), h = f ? +f[1] : 10; let w = String(s == null ? '' : s).length * 7; if (typeof maxW === 'number' && maxW < w) w = Math.max(0, maxW);
      const al = base.textAlign, x0 = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x; peint(nom, nom + ' [longueur×7 × police]', 'grossier', w * h * det(), boite(x0, y - h, w, h)); };
    const mkGrad = () => ({ addColorStop() { rec(el, 'addColorStop'); } });
    const base = {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
      createRadialGradient: () => { rec(el, 'createRadialGradient', 40); return mkGrad(); }, createLinearGradient: () => { rec(el, 'createLinearGradient', 40); return mkGrad(); }, createConicGradient: () => { rec(el, 'createConicGradient', 40); return mkGrad(); },
      createPattern: () => { rec(el, 'createPattern', 40); return {}; }, measureText: s => { rec(el, 'measureText'); return { width: (s || '').length * 7 }; },
      /* état */
      save() { pil.push({ m: m.slice(), clip, dash, lw: base.lineWidth, font: base.font, ta: base.textAlign }); rec(el, 'save'); },
      restore() { const s = pil.pop(); if (s) { m = s.m; clip = s.clip; dash = s.dash; base.lineWidth = s.lw; base.font = s.font; base.textAlign = s.ta; } rec(el, 'restore'); },
      setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') m = [a.a, a.b, a.c, a.d, a.e, a.f]; else if (a === undefined) m = [1, 0, 0, 1, 0, 0]; else m = [a, b, c, d, e, f]; rec(el, 'setTransform'); },
      resetTransform() { m = [1, 0, 0, 1, 0, 0]; rec(el, 'resetTransform'); },
      transform(a, b, c, d, e, f) { m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; rec(el, 'transform'); },
      translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; rec(el, 'translate'); },
      scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; rec(el, 'scale'); },
      rotate(t) { const c = Math.cos(t), s = Math.sin(t), a = m[0], b = m[1]; m[0] = a * c + m[2] * s; m[1] = b * c + m[3] * s; m[2] = -a * s + m[2] * c; m[3] = -b * s + m[3] * c; rec(el, 'rotate'); },
      setLineDash(a) { let on = 0, all = 0; if (a && a.length) a.forEach((v, i) => { all += v; if (i % 2 === 0) on += v; }); dash = all > 0 ? (a.length % 2 ? .5 : on / all) : 1; rec(el, 'setLineDash'); },
      /* chemin */
      beginPath() { P = chemin(); rec(el, 'beginPath'); },
      moveTo(x, y) { const p = T(x, y); P.subs.push([p[0], p[1]]); etend(P.b, p[0], p[1]); rec(el, 'moveTo'); },
      lineTo(x, y) { const p = T(x, y); P.libre++; pt(p[0], p[1]); rec(el, 'lineTo'); },
      closePath() { const s = dern(); if (s && s.length >= 4) { const n = s.length; P.len += Math.hypot(s[0] - s[n - 2], s[1] - s[n - 1]); s.push(s[0], s[1]); P.subs.push([s[0], s[1]]); } rec(el, 'closePath'); },
      arc(cx, cy, r, a0, a1, ccw) { ell('arc', cx, cy, r, r, 0, a0, a1, ccw); },
      ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) { ell('ellipse', cx, cy, rx, ry, rot, a0, a1, ccw); },
      rect(x, y, w, h) { rect('rect', x, y, w, h); }, roundRect(x, y, w, h) { rect('roundRect', x, y, w, h); },
      quadraticCurveTo(a, b, x, y) { courbe('quadraticCurveTo', [[a, b], [x, y]]); }, bezierCurveTo(a, b, c, d, x, y) { courbe('bezierCurveTo', [[a, b], [c, d], [x, y]]); },
      clip(a) { if (a && typeof a === 'object') return rec(el, 'clip'); if (P.subs.length && P.b.every(isFinite)) clip = clip ? inter(clip, P.b) : P.b.slice(); rec(el, 'clip'); },
      /* peinture */
      fill(a) { if (a && typeof a === 'object') return rec(el, 'fill', 1, { q: 'non', forme: 'fill(Path2D)' });
        if (!P.subs.length) return rec(el, 'fill', 1, { q: 'exact', forme: 'fill [chemin vide]', raw: 0, a: 0, lac: 0 });
        if (!P.libre && P.ex > 0) peint('fill', 'fill [disques/rect : exact]', 'exact', P.ex, P.b); else peint('fill', 'fill [boîte englobante : BORNE SUP]', 'borne', ar(P.b), P.b, Math.min(lacet(), ar(P.b))); },
      stroke(a) { if (a && typeof a === 'object') return rec(el, 'stroke', 1, { q: 'non', forme: 'stroke(Path2D)' });
        if (!P.subs.length) return rec(el, 'stroke', 1, { q: 'exact', forme: 'stroke [chemin vide]', raw: 0, a: 0, lac: 0 });
        const lw = num(base.lineWidth, 1) * Math.sqrt(det()), b = [P.b[0] - lw / 2, P.b[1] - lw / 2, P.b[2] + lw / 2, P.b[3] + lw / 2]; peint('stroke', 'stroke [longueur × lineWidth]', 'approx', P.len * lw * dash, b); },
      fillRect(x, y, w, h) { peint('fillRect', 'fillRect', 'exact', Math.abs(w * h) * det(), boite(x, y, w, h)); },
      clearRect(x, y, w, h) { peint('clearRect', 'clearRect', 'exact', Math.abs(w * h) * det(), boite(x, y, w, h)); },
      strokeRect(x, y, w, h) { const lw = num(base.lineWidth, 1), b = boite(x - lw / 2, y - lw / 2, w + lw, h + lw); peint('strokeRect', 'strokeRect [périmètre × lineWidth]', 'approx', 2 * (Math.abs(w) + Math.abs(h)) * lw * det(), b); },
      drawImage(im, a, b, c, d, e, f, g, h) { const n = arguments.length; let x, y, w, hh;
        if (n === 3) { x = a; y = b; w = num(im && im.width, NaN); hh = num(im && im.height, NaN); } else if (n === 5) { x = a; y = b; w = c; hh = d; } else if (n === 9) { x = e; y = f; w = g; hh = h; }
        else return rec(el, 'drawImage', 1, { q: 'non', forme: 'drawImage à ' + n + ' arguments' });
        peint('drawImage', 'drawImage/' + n, 'exact', Math.abs(w * hh) * det(), boite(x, y, w, hh)); },
      putImageData(im, x, y) { const w = num(im && im.width, NaN), h = num(im && im.height, NaN); if (!isFinite(w * h)) return rec(el, 'putImageData', 1, { q: 'non', forme: 'putImageData — taille inconnue' });
        const b = [x, y, x + w, y + h], A = w * h, f = A > 0 ? ar(inter(b, [0, 0, el.width, el.height])) / A : 0; rec(el, 'putImageData', 1, { q: 'exact', forme: 'putImageData', raw: A, a: A * f, lac: A * f }); },
      fillText(s, x, y, mw) { texte('fillText', s, x, y, mw); }, strokeText(s, x, y, mw) { texte('strokeText', s, x, y, mw); },
    };
    return new Proxy(base, { get: (t, p) => { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; let f = fns.get(p); if (!f) fns.set(p, f = () => { rec(el, p, 1, MUET.has(p) ? null : { q: 'non', forme: p + ' (méthode non pondérée)' }); }); return f; },
      set: (t, p, v) => { t[p] = v; return true; } });
  }
  /* ---------- stub DOM (test/ops-image.js), écran 411×757 tactile ---------- */
  const mkStyle = () => { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => { s[k] = String(v); } }, removeProperty: { value: k => { delete s[k]; return ''; } }, getPropertyValue: { value: k => (s[k] || '') } }); return s; };
  const mkEl = () => ({ style: mkStyle(), classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild(c) { return c; }, after() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: LW, bottom: LH, width: LW, height: LH, x: 0, y: 0 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
  const mkCanvas = (w, h, id) => { let c = null; const el = Object.assign(mkEl(), { width: w || 300, height: h || 150, __id: id || '', getContext: () => c || (c = mkCtx(el)) }); return el; };
  const stash = new Map();
  const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(LW, LH, id) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
    createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false, activeElement: null };
  let CLOCK = 0, TID = 0; const TIMERS = [];
  const advance = ms => { const end = CLOCK + ms; for (;;) { let k = -1; for (let i = 0; i < TIMERS.length; i++) if (TIMERS[i].at <= end && (k < 0 || TIMERS[i].at < TIMERS[k].at || (TIMERS[i].at === TIMERS[k].at && TIMERS[i].id < TIMERS[k].id))) k = i; if (k < 0) break; const t = TIMERS.splice(k, 1)[0]; CLOCK = Math.max(CLOCK, t.at); t.fn(); } CLOCK = end; };
  const H = { b(d) { inBake += d; if (d > 0 && ON) I.bk++; }, fin() { if (ON) I.fin++; }, r(d) { inRender += d; }, s() { VCLK += STEPC; if (ON) I.pas++; }, p(n) { pile.push(n); }, q() { pile.pop(); } };
  const win = { __SIM: true, devicePixelRatio: 3, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
  const sb = { window: win, document: doc, console, __H: H, matchMedia: q => ({ matches: /pointer:\s*coarse/.test(q) }), localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => VCLK }, requestAnimationFrame: () => 0,
    setTimeout: (fn, ms) => { TIMERS.push({ fn, at: CLOCK + (ms || 0), id: ++TID }); return TID; }, clearTimeout: id => { const k = TIMERS.findIndex(t => t.id === id); if (k >= 0) TIMERS.splice(k, 1); }, setInterval: () => 0, clearInterval() {},
    getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} };
  sb.globalThis = sb;
  const ctx = vm.createContext(sb), call = e => vm.runInContext(e, ctx);
  call(`(function(){let s=1;Math.random=function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`);
  vm.runInContext(CODE, ctx, { filename: 'game.js' });
  /* sondes : aucune modification du jeu, les fonctions globales sont enveloppées depuis le test */
  const enveloppees = call(`(function(N){const ok=[];for(const n of N){const f=globalThis[n];if(typeof f!=='function')continue;globalThis[n]=function(){__H.p(n);try{return f.apply(this,arguments);}finally{__H.q();}};if(globalThis[n]!==f)ok.push(n);}return ok.length;})`)(POSTES);
  call(`(function(){const b=bakeStep,r=render,s=step;
    bakeStep=function(c){__H.b(1);try{const f=b(c);if(f)__H.fin();return f;}finally{__H.b(-1);}};
    render=function(A,dt){__H.r(1);try{return r(A,dt);}finally{__H.r(-1);}};
    step=function(){__H.s();return s();};})();
    var PIL={x:0,y:0};window.__SIM_INPUT=function(){G.inX=PIL.x;G.inY=PIL.y;G.aimMan=false;};`);
  let ts = 0;
  return { call, M, enveloppees, compte(on) { ON = on; },
    image() { I = neuf(); ts += VS; call('SKIPD=0;SKS=0;SKBAD=false;'); call('frame')(ts); advance(VS); const r = I; I = neuf(); return r; },
    raz() { for (const k in M) M[k].clear(); } };
}

/* ---------- un scénario : qualité × (immobile | déplacement) — même déroulé que test/ops-image.js ---------- */
function mesure(q, bouge) {
  const B = build(), call = B.call, err = [];
  call(`meta.q=${JSON.stringify(q)};${PROLO ? '' : 'meta.tuto=TUTO.length;'}resize();applyQuality();refReset();`);
  call(`newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();inp.L=inp.R=null;`);
  const etat = () => JSON.parse(call(`JSON.stringify({QL,RES,PS,RZ,DPR,cw:cv.width,ch:cv.height,lw:typeof LOWC!=='undefined'&&LOWC?LOWC.width:0,lh:typeof LOWC!=='undefined'&&LOWC?LOWC.height:0,lowdom:typeof LOWDOM!=='undefined'&&LOWDOM,W,H,CH,st:G.state,x:G.p.x,y:G.p.y,en:G.en.length,fx:G.fx.length,wk:!!WK})`));
  const e0 = etat(), ch = neuf();
  let nch = 0, calme = 0; B.compte(true);
  while (nch < CHMAX && (nch < NCH || calme < 60)) { const r = B.image(); ajoute(ch, r); nch++; calme = r.bk ? 0 : calme + 1; }
  if (calme < 60) err.push('chauffe : la cuisson du départ n’est pas finie après ' + nch + ' images');
  const Mch = new Map(B.M.forme); B.raz();
  const e1 = etat(), caps = [[1, 0], [0, 1], [-1, 0], [0, -1]]; let cap = 0, px = e1.x, py = e1.y, dist = 0, virages = 0, lx = e1.x, ly = e1.y;
  if (bouge) call(`PIL.x=1;PIL.y=0;`);
  const ims = [], etats = {}; let rzMin = Infinity, rzMax = 0;
  for (let i = 0; i < NIM; i++) {
    const r = B.image(), e = etat(); ims.push(r); etats[e.st] = (etats[e.st] || 0) + 1; rzMin = Math.min(rzMin, e.RZ); rzMax = Math.max(rzMax, e.RZ);
    if (e.QL !== e0.QL || e.RES !== e0.RES) err.push(`image ${i} : qualité passée à QL=${e.QL} RES=${e.RES}`);
    dist += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y;
    if (bouge && i % 30 === 29) { if (Math.hypot(e.x - lx, e.y - ly) < 30) { cap = (cap + 1) % 4; virages++; call(`PIL.x=${caps[cap][0]};PIL.y=${caps[cap][1]};`); } lx = e.x; ly = e.y; }
  }
  const e2 = etat(), Mw = {}; for (const k in B.M) Mw[k] = new Map(B.M[k]);
  B.compte(false);
  if (Object.keys(etats).some(s => s !== 'play')) err.push('partie sortie de « play » : ' + JSON.stringify(etats));
  if (bouge && dist < 200) err.push('le joueur n’a pas avancé (' + dist.toFixed(0) + ' px)');
  if (!bouge && dist > 1) err.push('le joueur immobile a bougé de ' + dist.toFixed(1) + ' px');
  const S = neuf(); for (const r of ims) ajoute(S, r);
  return { q, bouge, e1, e2, ch, Mch, nch, ims, S, M: Mw, dist, virages, rzMin, rzMax, env: B.enveloppees, err };
}

/* ---------- sortie ---------- */
const pad = (s, n) => String(s).padStart(n), padE = (s, n) => String(s).padEnd(n), mp = v => (v / 1e6).toFixed(3), f2 = v => v.toFixed(2);
const toile = (R, c) => c === 0 ? R.e2.cw * R.e2.ch : c === 1 ? R.e2.lw * R.e2.lh : c === 2 ? R.e2.CH * R.e2.CH : 0;
const tri = (M, c, k) => [...M.entries()].filter(([x]) => x.startsWith(CAT[c] + '|')).map(([x, o]) => [x.slice(CAT[c].length + 1), o]).sort((a, b) => b[1][k] - a[1][k] || (a[0] < b[0] ? -1 : 1));
const SORTIE = [];
function rapport(R) {
  const n = R.ims.length, e = R.e2, S = R.S, log = RESUME ? () => {} : s => console.log(s);
  log(`\n================ QL=${e.QL} / RES=${e.RES} (meta.q=${R.q}) · PS=${f2(e.PS)} · DPR=${e.DPR} · RZ ${R.rzMin.toFixed(3)}–${R.rzMax.toFixed(3)} · écran ${e.cw}×${e.ch} = ${mp(e.cw * e.ch)} Mpx · couche basse ${e.lw}×${e.lh} = ${mp(e.lw * e.lh)} Mpx (LOWDOM=${e.lowdom}) · ${R.bouge ? 'EN DÉPLACEMENT' : 'IMMOBILE'} ================`);
  log(`  ${n} images mesurées après ${R.nch} de chauffe · worker=${e.wk} (cuisson sur place) · déplacement ${R.dist.toFixed(0)} px · ${R.e1.en}→${e.en} ennemis, ${R.e1.fx}→${e.fx} effets · ${R.env} fonctions enveloppées`);
  log('  1. SURFACE PEINTE PAR IMAGE, par couche (Mpx = millions de pixels du canvas visé ; moyenne sur les ' + n + ' images)');
  log('    ' + padE('couche', 10) + pad('appels', 9) + pad('Mpx rogné', 11) + pad('[min', 8) + pad('max]', 8) + pad('× toile', 9) + pad('Mpx brut', 10) + pad('lacet', 9) + ' |' + pad('exact', 8) + pad('approché', 10) + pad('borne sup', 11) + pad('grossier', 10) + pad('non pondéré', 13));
  for (let c = 0; c < 4; c++) { const a = R.ims.map(r => r.px[c]), t = toile(R, c);
    log('    ' + padE(CAT[c], 10) + pad(f2(S.n[c] / n), 9) + pad(mp(S.px[c] / n), 11) + pad(mp(Math.min(...a)), 8) + pad(mp(Math.max(...a)), 8) + pad(t && c < 2 ? f2(S.px[c] / n / t) : '—', 9) + pad(mp(S.raw[c] / n), 10) + pad(mp(S.lac[c] / n), 9) + ' |' + pad(mp(S.exact[c] / n), 8) + pad(mp(S.approx[c] / n), 10) + pad(mp(S.borne[c] / n), 11) + pad(mp(S.grossier[c] / n), 10) + pad(f2(S.np[c] / n) + ' app.', 13)); }
  log(`    cuisson : ${S.fin} chunk(s) fini(s) dans ces images${S.fin ? ' → ' + mp(S.px[2] / S.fin) + ' Mpx peints par chunk cuit (toile ' + mp(toile(R, 2)) + ' Mpx, soit ×' + f2(S.px[2] / S.fin / toile(R, 2)) + ')' : ''} · pendant la chauffe : ${R.ch.fin} chunks, ${mp(R.ch.px[2])} Mpx${R.ch.fin ? ' → ' + mp(R.ch.px[2] / R.ch.fin) + ' Mpx par chunk (×' + f2(R.ch.px[2] / R.ch.fin / toile(R, 2)) + ', lacet ' + mp(R.ch.lac[2] / R.ch.fin) + ')' : ''}`);
  for (const c of [0, 1, 2]) { const F = tri(R.M.forme, c, 'px'); if (!F.length) continue;
    log(`  2. formes d’appel — ${CAT[c]} (par image) :`);
    for (const [k, o] of F.slice(0, 9)) log('    ' + padE(k, 40) + pad(f2(o.n / n) + ' app.', 13) + pad(mp(o.px / n) + ' Mpx', 13) + pad((100 * o.px / (S.px[c] || 1)).toFixed(1) + ' %', 9) + '   brut ' + mp(o.raw / n) + (o.lac !== o.px ? ' · lacet ' + mp(o.lac / n) : '')); }
  for (const c of [0, 1]) { log(`  3. postes — ${CAT[c]}, par surface (par image) :`);
    for (const [k, o] of tri(R.M.poste, c, 'px').slice(0, c ? 5 : 7)) log('    ' + padE(k, 22) + pad(mp(o.px / n) + ' Mpx', 12) + pad((100 * o.px / (S.px[c] || 1)).toFixed(1) + ' %', 8) + pad(f2(o.n / n) + ' app.', 13) + pad(f2(o.di / n) + ' drawImage', 17) + '  brut ' + mp(o.raw / n) + ' · lacet ' + mp(o.lac / n) + '   ' + ou(k)); }
  log('  3b. détail (poste > fonction la plus profonde) — écran, par surface :');
  for (const [k, o] of tri(R.M.detail, 0, 'px').slice(0, 8)) log('    ' + padE(k, 34) + pad(mp(o.px / n) + ' Mpx', 12) + pad(f2(o.n / n) + ' app.', 13) + pad(f2(o.di / n) + ' drawImage', 17) + '   ' + ou(k));
  log('  4. qui trace des LIGNES (moveTo / lineTo / stroke par image, toutes couches hors cuisson) :');
  const lig = [0, 1, 3].flatMap(c => tri(R.M.detail, c, 'mv').map(([k, o]) => [CAT[c] + ' · ' + k, o, k])).sort((a, b) => b[1].mv - a[1].mv || (a[0] < b[0] ? -1 : 1));
  for (const [k, o, nom] of lig.slice(0, 6)) log('    ' + padE(k, 44) + pad(f2(o.mv / n), 8) + ' moveTo' + pad(f2(o.ln / n), 8) + ' lineTo' + pad(f2(o.st / n), 8) + ' stroke' + pad(mp(o.px / n) + ' Mpx', 12) + '   ' + ou(nom));
  const np = [...R.M.nonp.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  log('  NON PONDÉRÉ (appels par image) : ' + (np.map(([k, v]) => `${k} : ${f2(v / n)}`).join(' · ') || 'aucun appel') + ' · pendant la chauffe : ' + R.ch.np.reduce((a, b) => a + b, 0) + ' appel(s)');
  for (const m of R.err) console.log('  MESURE INVALIDE : ' + m);
  const r6 = v => +v.toFixed(3);
  SORTIE.push(JSON.stringify({ q: R.q, b: R.bouge, ims: R.ims.map(r => [r.n, r.px.map(r6), r.raw.map(r6), r.np, r.fin]), ch: [R.ch.n, R.ch.px.map(r6), R.ch.fin], M: ['forme', 'poste', 'detail'].map(k => [...R.M[k].entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([x, o]) => [x, o.n, r6(o.px), r6(o.raw), o.mv, o.st])), np: [...R.M.nonp.entries()].sort() }));
}

console.log(`# ops-pixels : ${REF ? 'git ' + REF : 'arbre de travail'} — ${PROLO ? 'PROLOGUE (sauvegarde vierge)' : 'partie normale (prologue fait)'}, ${NIM} images par scénario, chauffe ≥ ${NCH}, horloge virtuelle K=${K * 1000} µs/appel — des PIXELS, pas des durées`);
let bad = 0; const RES = [];
for (const q of ['high', 'mid']) for (const bouge of [false, true]) { const R = mesure(q, bouge); rapport(R); RES.push(R); bad += R.err.length; }
const nom = R => `QL=${R.e2.QL} PS=${f2(R.e2.PS)} ${R.bouge ? 'déplacement' : 'immobile'}`;

console.log('\n================ RÉSUMÉ — surface peinte par image, Mpx ROGNÉS, moyenne [min–max] (appels par image) ================');
console.log('  ' + padE('scénario', 26) + pad('toile écran', 12) + pad('ÉCRAN', 34) + pad('toile basse', 12) + pad('COUCHE BASSE', 34) + pad('CUISSON', 34) + pad('autre', 20));
for (const R of RES) { const n = R.ims.length, c = i => { const a = R.ims.map(r => r.px[i]); return `${mp(R.S.px[i] / n)} [${mp(Math.min(...a))}–${mp(Math.max(...a))}] (${f2(R.S.n[i] / n)})`; };
  console.log('  ' + padE(nom(R), 26) + pad(mp(toile(R, 0)), 12) + pad(c(0), 34) + pad(mp(toile(R, 1)), 12) + pad(c(1), 34) + pad(c(2), 34) + pad(`${mp(R.S.px[3] / n)} (${f2(R.S.n[3] / n)})`, 20)); }
console.log('  fourchette de l’ÉCRAN (la seule part incertaine est le fill() à boîte englobante et le texte) :');
for (const R of RES) { const n = R.ims.length, S = R.S; console.log('  ' + padE(nom(R), 26) + ` exact ${mp(S.exact[0] / n)} + approché (traits) ${mp(S.approx[0] / n)} + fill borne sup ${mp(S.borne[0] / n)} + texte grossier ${mp(S.grossier[0] / n)} = ${mp(S.px[0] / n)} Mpx ; avec le lacet à la place de la boîte : ${mp(S.lac[0] / n)} Mpx ; non pondéré : ${S.np[0]} appel(s)`); }

console.log('\n================ LES POSTES — écran puis couche basse, les 5 premiers par surface (Mpx par image, part de la couche) ================');
for (const R of RES) { const n = R.ims.length;
  for (const c of [0, 1]) console.log('  ' + padE(nom(R), 26) + padE(CAT[c], 7) + tri(R.M.poste, c, 'px').slice(0, 5).map(([k, o]) => `${k} ${mp(o.px / n)} (${(100 * o.px / (R.S.px[c] || 1)).toFixed(0)} %) [${ou(k)}]`).join(' · ')); }

console.log('\n================ LES LIGNES — ce qui change quand le joueur bouge (moveTo et stroke par image : immobile → déplacement) ================');
for (let i = 0; i < RES.length; i += 2) { const A = RES[i], B = RES[i + 1], n = A.ims.length, cles = new Set();
  for (const R of [A, B]) for (const k of R.M.detail.keys()) if (!k.startsWith('cuisson|')) cles.add(k);
  const z = { mv: 0, st: 0, ln: 0 }, rows = [...cles].map(k => { const a = A.M.detail.get(k) || z, b = B.M.detail.get(k) || z; return { k, a, b, d: (b.mv - a.mv) / n }; }).sort((x, y) => y.d - x.d || (x.k < y.k ? -1 : 1));
  const tot = (R, f) => [...R.M.detail.entries()].filter(([k]) => !k.startsWith('cuisson|')).reduce((s, [, o]) => s + o[f], 0) / n;
  console.log(`  QL=${A.e2.QL} — total hors cuisson : moveTo ${f2(tot(A, 'mv'))} → ${f2(tot(B, 'mv'))} · stroke ${f2(tot(A, 'st'))} → ${f2(tot(B, 'st'))}`);
  for (const r of rows.slice(0, 4)) console.log('    ' + padE(r.k.replace('|', ' · '), 44) + ` moveTo ${f2(r.a.mv / n)} → ${f2(r.b.mv / n)} (${r.d >= 0 ? '+' : ''}${f2(r.d)}) · stroke ${f2(r.a.st / n)} → ${f2(r.b.st / n)} · lineTo ${f2(r.a.ln / n)} → ${f2(r.b.ln / n)}   ${ou(r.k.split('|')[1])}`); }

console.log('\n================ LE CALCUL À 7,5 ns/px — ce que le comptage dit de ses TERMES ================');
for (const R of RES) { const n = R.ims.length, e = R.e2, g = (M, k) => M.get(k) || { n: 0, px: 0, raw: 0, di: 0 }, dc = g(R.M.detail, 'ecran|drawChunks'), le = g(R.M.poste, 'ecran|lowEnd');
  console.log(`  ${nom(R)} — écran ${e.cw}×${e.ch} = ${mp(e.cw * e.ch)} Mpx, RZ ${R.rzMin.toFixed(3)}–${R.rzMax.toFixed(3)}, un chunk = ${e.CH}×${e.CH} monde = ${(e.CH * e.PS * R.rzMin).toFixed(0)}–${(e.CH * e.PS * R.rzMax).toFixed(0)} px de côté à l’écran`);
  console.log(`      chunks collés (drawChunks, direct) : ${f2(dc.di / n)} drawImage/image · surface BRUTE ${mp(dc.raw / n)} Mpx · surface ROGNÉE au canvas ${mp(dc.px / n)} Mpx (×${f2(dc.px / n / (e.cw * e.ch))} la toile)`);
  console.log(`      agrandissement de la couche basse sur l’écran (lowEnd) : ${f2(le.di / n)} drawImage/image, ${mp(le.px / n)} Mpx — LOWDOM=${e.lowdom}${e.lowdom ? ' : #low est un canvas du DOM, étiré par le compositeur, pas par un appel canvas' : ''}`);
  console.log(`      TOTAL mesuré : écran ${mp(R.S.px[0] / n)} Mpx + couche basse ${mp(R.S.px[1] / n)} Mpx (dans ses propres pixels) = ${mp((R.S.px[0] + R.S.px[1]) / n)} Mpx par image   (hypothèse à vérifier : ~2 Mpx)`);
  console.log(`      DÉDUIT, non mesuré — SI 7,5 ns/px valait pour ces pixels-là : ${((R.S.px[0] + R.S.px[1]) / n * 7.5e-6).toFixed(1)} ms par image (l’hypothèse en annonçait ~15)`); }

console.log('\nNON PONDÉRÉ / LIMITES :');
for (const R of RES) console.log(`  ${padE(nom(R), 26)} appels non pondérés : écran ${R.S.np[0]}, basse ${R.S.np[1]}, cuisson ${R.S.np[2]}, autre ${R.S.np[3]} sur ${R.S.n.reduce((a, b) => a + b, 0)} appels ; chauffe ${R.ch.np.reduce((a, b) => a + b, 0)} sur ${R.ch.n.reduce((a, b) => a + b, 0)}`);
console.log('  - fill() d’un chemin quelconque : boîte englobante = BORNE SUPÉRIEURE (colonne « borne sup ») ; le « lacet » est une estimation ;');
console.log('  - fillText : longueur×7 × hauteur de police, GROSSIER (le stub measureText ne connaît pas la police) ;');
console.log('  - stroke : longueur × lineWidth, sans bouts ni jointures ni plancher d’1 px ;');
console.log('  - aucun TEMPS n’est mesuré ; le coût par pixel dépend de l’opération (copie, lighter, agrandissement lissé, dégradé) ;');
console.log('  - la composition de #low par le navigateur et la rasterisation différée des sources de drawImage ne sont pas des appels canvas : hors champ ;');
console.log('  - cuisson : repli sur place (pas de Worker sous vm) ; sa répartition par image suit l’horloge virtuelle (--k=).');
console.log('\nempreinte des surfaces (doit être identique d’un lancement à l’autre) : ' + crypto.createHash('sha256').update(SORTIE.join('\n')).digest('hex').slice(0, 16));
console.log(bad ? 'OPS-PIXELS : MESURE INVALIDE (' + bad + ')' : 'OPS-PIXELS : MESURÉ');
process.exit(bad ? 1 : 0);
