'use strict';
/* =========================================================
   Garde-fou du CONTROLEUR DE SAUT (skipCtl, g4.js) — chantier FLUIDITE 2, 01/10/2026.

   Question : le filet « image hors budget » (SKBAD -> SKIPD) peut-il se VERROUILLER tout seul — sauter le
   decor et les halos pour le reste de la partie — sans que la machine soit lente ?
   Trois mecanismes, chacun mesure ici avant d'etre corrige :
     V1  SKP (periode d'ecran estimee) n'a pas de plancher : des rappels rAF en double (< 4 ms, cf. DTMIN de
         perf()) la tirent sous 16,7/1,4 ; toute image normale devient alors « hors budget ».
     V2  sa remontee exige w < dt/2, w = FWK+BKMS ; or la cuisson remplit DELIBEREMENT ~60 % de la periode
         (bakeBudget, gw2.js) : pendant le streaming, SKP ne remonte jamais.
     V3  SKW ne fait que doubler (3 -> 60 s) ; il ne revient a 3 s qu'apres 30 s au cran 0, cran qu'on
         n'atteint qu'apres SKW ms d'images TOUTES saines.

   skipCtl(w,dt[,b]) ne depend que de ses arguments et de ses globales : on extrait du source le bloc
   `let SKIPD=…` … `function skipCtl…` (et DTMIN), on l'execute seul dans un contexte vm, et on lui donne des
   intervalles FABRIQUES ICI. Aucune horloge reelle, aucun tirage : sortie reproductible octet pour octet.
   Le 3e argument b (= BKMS, cuisson budgetee) est passe explicitement ; l'ancien code l'ignore.

   node test/saut.js              arbre de travail
   node test/saut.js --ref=HEAD   code d'un commit (6e4d40c, avant le chantier : doit ECHOUER en nommant la cause)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref');
let src = null;
const lit = () => {
  try { return REF ? cp.execFileSync('git', ['show', REF + ':g4.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) : fs.readFileSync(path.join(ROOT, 'g4.js'), 'utf8'); }
  catch (e) { throw new Error(`g4.js illisible ${REF ? 'au commit ' + REF : 'dans l\'arbre'}`); }
};

/* ---------- extraction : le controleur seul ---------- */
function extrait() {
  if (src === null) src = lit();
  const a = src.indexOf('let SKIPD='), z = src.indexOf('\nlet FRN=', a), d = src.match(/^const DTMIN=[^\n]*$/m);
  if (a < 0 || z < 0) throw new Error('bloc `let SKIPD=` … `let FRN=` introuvable dans g4.js');
  return (d ? d[0] : '') + '\n' + src.slice(a, z);
}
function mk() {
  const ctx = vm.createContext({ Math, BKMS: 0 });
  vm.runInContext(extrait() + '\nthis.__ST=()=>({SKIPD,SKBAD,SKP,SKS,SKO,SKW,SKT});', ctx);
  const CTL = vm.runInContext('(function(w,dt,b){BKMS=b;skipCtl(w,dt,b);})', ctx);
  let t = 0;
  /* joue n images ; f(i) -> [dt, FWK, BKMS] ; vu(S,t) apres CHAQUE image */
  const play = (n, f, vu) => { for (let i = 0; i < n; i++) { const [dt, fw, bk] = f(i); t += dt; CTL(fw + bk, dt, bk); if (vu) vu(ctx.__ST(), t); } };
  return { play, st: () => ctx.__ST(), t: () => t };
}

/* ---------- regimes fabriques (ecran 60 Hz) ---------- */
const P = 16.7, SEUIL = P / 1.4;            /* SKBAD des que SKP < 16,7/1,4 = 11,93 : une image normale passe pour un vsync manque */
const IMG = s => Math.round(s * 1000 / P);
const STREAM = () => [P, 3, 7];             /* en mouvement : 3 ms de JS + 7 ms de cuisson (bakeBudget : 0,6×16,7 − 3) */
const REPOS = () => [P, 3, 0];              /* a l'arret : rien a cuire */
/* rafale de k rappels courts (0,4 ms) ; l'image suivante garde la phase du vsync */
const rafale = (k, base) => (i) => i < k ? [0.4, 0.2, 0] : [P - 0.4 * k, base()[1], base()[2]];
const R8 = (i) => [8, 3, 7];                /* rafale PLAUSIBLE (120 Hz) mais breve, en mouvement (REFDT reste 16,7 : test/regule.js X3) */

const checks = [], mesures = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const m = (s) => mesures.push(s);
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
/* suit une sequence : temps avec SKBAD, SKIPD max/final, SKP min, SKW max */
function suivi(G, segs) {
  const r = { nbad: 0, kmax: 0, pmin: Infinity, wmax: 0, k2: 0 };
  for (const [n, f] of segs) G.play(n, f, (S) => {
    if (S.SKBAD) r.nbad++;
    if (S.SKIPD > r.kmax) r.kmax = S.SKIPD; if (S.SKIPD) r.k2++;
    if (S.SKP < r.pmin) r.pmin = S.SKP; if (S.SKW > r.wmax) r.wmax = S.SKW;
  });
  r.F = G.st(); return r;
}

let FAIL = null;
try {
  /* ================= V1 — rafale de rappels courts (< 4 ms) : combien en faut-il ? ================= */
  let kmin = 0;
  for (let k = 1; k <= 12 && !kmin; k++) {
    let p = Infinity; const H = mk(); H.play(IMG(5), STREAM); H.play(k, rafale(k, STREAM), S => { p = Math.min(p, S.SKP); });
    if (p < SEUIL) kmin = k;
  }
  m(`V1 rafale de rappels a 0,4 ms : ${kmin ? kmin + ' rappels amenent SKP sous ' + f2(SEUIL) + ' ms (seuil de SKBAD)' : 'aucun nombre de rappels (1..12) n\'amene SKP sous ' + f2(SEUIL) + ' ms'}`);
  for (const [nom, base] of [['en mouvement (cuisson 7 ms)', STREAM], ['au repos (sans cuisson)', REPOS]]) {
    const G = mk(); G.play(IMG(5), base);
    const r = suivi(G, [[9, rafale(8, base)], [IMG(60), base]]);
    m(`V1 8 rappels a 0,4 ms puis 60 s ${nom} : SKP min ${f2(r.pmin)} ms, final ${f2(r.F.SKP)} ms ; ${r.nbad} images SKBAD sur ${IMG(60) + 9} ; SKIPD max ${r.kmax}, final ${r.F.SKIPD} ; ${(r.k2 * P / 1000).toFixed(1)} s avec SKIPD>0`);
    check(`V1 ${nom} : 8 rappels a 0,4 ms (pas des images, < DTMIN) ne font RIEN sauter — SKP reste >= ${f2(SEUIL)} ms, SKIPD reste 0`,
      r.pmin >= SEUIL && r.kmax === 0,
      `SKP min ${f2(r.pmin)} ms, ${r.nbad} images SKBAD, SKIPD max ${r.kmax}, final ${r.F.SKIPD}`
      + (r.pmin < SEUIL ? ` ; CAUSE : SKP sans plancher — un intervalle < DTMIN (rappel en double) nourrit la periode estimee (g4.js, skipCtl)` : ''));
  }

  /* ================= V2 — rafale PLAUSIBLE (8 ms) en mouvement : SKP doit remonter malgre la cuisson ================= */
  for (const [nom, base, n8] of [['en mouvement', STREAM, 90], ['en mouvement', STREAM, 30], ['au repos', REPOS, 90]]) {
    const G = mk(); G.play(IMG(5), base);
    const r = suivi(G, [[n8, base === STREAM ? R8 : (i) => [8, 3, 0]], [IMG(60), base]]);
    m(`V2 ${n8} images a 8 ms puis 60 s ${nom} a 16,7 ms : SKP min ${f2(r.pmin)}, final ${f2(r.F.SKP)} ms ; ${r.nbad} images SKBAD ; SKIPD max ${r.kmax}, final ${r.F.SKIPD} ; ${(r.k2 * P / 1000).toFixed(1)} s avec SKIPD>0`);
    check(`V2 ${n8} images a 8 ms puis 60 s ${nom} : SKP revient a la periode (> 16 ms) et SKIPD finit a 0 (pas de verrou)`,
      r.F.SKP > 16 && r.F.SKIPD === 0,
      `SKP final ${f2(r.F.SKP)} ms, SKIPD final ${r.F.SKIPD}, ${(r.k2 * P / 1000).toFixed(1)} s avec SKIPD>0`
      + (r.F.SKP < SEUIL ? ` ; CAUSE : remontee de SKP bloquee — elle exige (FWK+BKMS) < dt/2, or la cuisson DELIBEREE remplit 0,6×periode (g4.js skipCtl / gw2.js bakeBudget)` : ''));
  }

  /* ================= V3 — SKW : montee, puis sortie sur preuve =================
     Charge qui REPOND au saut : a SKIPD=0, l'image coute 20 ms de JS (hors budget) ; a SKIPD>=1, 10 ms (saine).
     Chaque descente est refutee en ~400 ms : SKW double. Puis la charge disparait (changement de scene) ; il ne
     reste qu'un raté ISOLE (50 ms, GC) toutes les 20 s. */
  {
    const G = mk(); G.play(IMG(5), REPOS);
    let tW = -1;
    const rep = () => (G.st().SKIPD ? [P, 10, 0] : [33.3, 20, 0]);
    for (let s = 0; s < IMG(240) && tW < 0; s++) G.play(1, rep, (S, t) => { if (S.SKW >= 60000 && tW < 0) tW = t; });
    const A = G.st();
    m(`V3 charge qui repond au saut : SKW ${tW >= 0 ? 'atteint 60 s apres ' + (tW / 1000 - 5).toFixed(1) + ' s' : 'plafonne a ' + A.SKW + ' ms en 240 s'} (SKIPD=${A.SKIPD})`);
    check(`V3 l'ordre « descente puis remontee en < 2 s » reste PUNI : SKW monte (>= 24 s) sous une charge qui repond au saut`, A.SKW >= 24000,
      `SKW=${A.SKW} ms`);
    /* la charge disparait ; rates isoles toutes les 20 s */
    const gc = (i) => (i % IMG(20) === IMG(20) - 1 ? [50, 3, 0] : [P, 3, 0]);
    const t0 = G.t(); let tz = -1, w3 = -1;
    G.play(IMG(120), gc, (S, t) => { if (tz < 0 && S.SKIPD === 0) tz = t - t0; if (tz >= 0 && w3 < 0 && t - t0 >= tz + 3000) w3 = S.SKW; });
    const F = G.st();
    m(`V3 puis 120 s saines avec un rate isole (50 ms) toutes les 20 s : SKIPD final ${F.SKIPD}, SKW final ${F.SKW} ms ; retour a 0 ${tz >= 0 ? 'apres ' + f1(tz / 1000) + ' s' : 'JAMAIS en 120 s'}`);
    check(`V3 apres disparition de la charge, un rate ISOLE toutes les 20 s n'empeche pas le retour a SKIPD=0 (en < 70 s)`,
      tz >= 0 && tz < 70000,
      tz >= 0 ? `retour a 0 apres ${f1(tz / 1000)} s, SKW final ${F.SKW} ms`
        : `SKIPD reste ${F.SKIPD} pendant 120 s ; CAUSE : SKW=${A.SKW} ms exige ${A.SKW / 1000} s d'images TOUTES saines (un seul rate remet SKO a 0) et SKW ne redescend qu'apres 30 s au cran 0 — doublement sans sortie (g4.js, skipCtl)`);
    /* 3 s apres la descente (tenue 2 s : confirmee), bien avant les 30 s au cran 0 : si la charge revenait la, combien attendrait-on ? */
    check(`V3 descente CONFIRMEE (tenue 2 s) : SKW est divise des ce moment (3 s apres, avant les 30 s au cran 0)`,
      w3 >= 0 && w3 < A.SKW, w3 < 0 ? `aucune descente : rien a confirmer` : `SKW=${w3} ms 3 s apres la descente (etait ${A.SKW} ms)`
      + (w3 >= A.SKW ? ` ; CAUSE : une descente confirmee ne revise pas SKW — seule la regle des 30 s au cran 0 le fait (g4.js, skipCtl)` : ''));
    check(`V3 apres un retour a 0 confirme, SKW est REVISE (< ${A.SKW} ms) : la prochaine charge ne repart pas de ${A.SKW / 1000} s`,
      F.SKW < A.SKW, `SKW=${F.SKW} ms (etait ${A.SKW} ms)`);
  }

  /* ================= T — temoins : le filet doit TOUJOURS jouer quand la machine est lente ================= */
  /* SKP peut deriver vers le haut sous saccade (equilibre ~19,5 ms, deja vrai avant ce chantier) : ce qui compte
     est que l'image longue reste hors budget, donc SKP < 33,3/1,4 = 23,8 ms. Cuisson en mouvement a 30 ips :
     bakeBudget la divise par 2 des que l'image precedente depasse 1,5×la periode, donc elle est au plancher (1,5 ms).
     Partout ici la cuisson suit bakeBudget : b = clamp(0,6×16,7 − FWK, 1,5, 10) — « JS 8 + cuisson 10 » n'existe pas. */
  for (const [nom, f] of [
    ['jeu a 30 ips sur ecran 60 Hz, JS 20 ms (le JS explique la lenteur)', () => [33.3, 20, 0]],
    ['jeu a 30 ips en mouvement, JS 17 ms + cuisson au plancher 1,5 ms', () => [33.3, 17, 1.5]],
    ['JS hors cuisson > periode a lui seul (18 ms, intervalle 18 ms)', () => [18, 18, 0]],
    ['JS + cuisson > periode (16 + 1,5 ms au plancher, intervalle 17,5 ms)', () => [17.5, 16, 1.5]],
    ['1 image sur 2 a 33,3 ms (saccade), JS 12 ms', (i) => [i % 2 ? 33.3 : P, 12, 0]]]) {
    const G = mk(); G.play(IMG(5), REPOS);
    const r = suivi(G, [[IMG(10), f]]);
    check(`T ${nom} : le saut S'ENGAGE (SKIPD = 2) et l'image longue reste hors budget (SKP < 23,8 ms)`,
      r.F.SKIPD === 2 && r.F.SKP < 33.3 / 1.4, `SKIPD final ${r.F.SKIPD}, SKP ${f2(r.F.SKP)} ms, ${r.nbad} images SKBAD`);
  }
  {
    const G = mk(); const r = suivi(G, [[IMG(60), STREAM], [IMG(60), REPOS]]);
    check(`T machine saine (60 s en mouvement + 60 s au repos) : SKIPD reste 0, aucune image SKBAD`, r.kmax === 0 && r.nbad === 0,
      `SKIPD max ${r.kmax}, ${r.nbad} images SKBAD, SKP final ${f2(r.F.SKP)}`);
    const H = mk(); const q = suivi(H, [[IMG(30), () => [33.3, 3, 0]]]);
    check(`T ecran 30 Hz (mode economie), JS 3 ms : SKP rejoint 33,3 ms, SKIPD retombe a 0`, q.F.SKP > 32 && q.F.SKIPD === 0,
      `SKP final ${f2(q.F.SKP)} ms, SKIPD final ${q.F.SKIPD}`);
  }
} catch (e) { FAIL = String(e && e.message || e).split('\n')[0]; }

/* ---------- verdict ---------- */
console.log(`test/saut.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
if (FAIL) { console.log('  ECHEC  banc inexecutable : ' + FAIL); console.log('ECHEC PARTIEL'); process.exit(1); }
console.log('  mesures :'); for (const s of mesures) console.log('    ' + s);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
