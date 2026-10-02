'use strict';
/* =========================================================
   Garde-fou de la CADENCE sur écran rapide (hrCtl, g4.js) — fluidité, 02/10/2026.

   Le défaut : la logique tourne à 60 pas par seconde (STEPMS) et le rendu interpole ; sur un écran 120 Hz, une machine
   qui dessine une image en 6 à 10 ms (canevas logiciel : Firefox du propriétaire) tient tantôt une période (8,3 ms),
   tantôt deux (16,7 ms). Le mouvement hoquette (8 / 17 / 8 / 17 ms) — pire qu'un 60 ips régulier, que la machine tient.
   Le correctif : quand des images tombent en nombre sur un écran rapide, on ne dessine qu'une fois par ~16,7 ms.

   Banc : la VRAIE boucle frame() (g4.js), horloge virtuelle. Chaque rappel arrive au vsync qui suit la fin du travail
   de l'image précédente (période P) ; render() est enveloppé pour COÛTER un temps choisi (l'horloge avance d'autant).
     C1. écran 120 Hz, image de 6 à 10 ms : après mise en route, ≥ 95 % des intervalles entre deux dessins sont
         réguliers (15 à 18,4 ms) — avant : un mélange de 8,3 et 16,7 ms ;
     C2. puis l'image redevient légère (2 ms) : la cadence pleine REVIENT (dessins à 8,3 ms) ;
     C3. écran 120 Hz, image légère dès le début : jamais de demi-cadence (chaque rappel dessine) ;
     C4. écran 60 Hz, image lourde (10 à 20 ms) : jamais de demi-cadence (elle n'a de sens que sur écran rapide).

   node test/cadence.js                arbre de travail
   node test/cadence.js --ref=<commit> code d'un commit (avant le correctif : C1 doit ECHOUER)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');

function banc(P, cout, secondes, suite) {
  const H = suite ? suite.H : L.mkGame({ ref: REF, w: 1280, h: 720, seed: 4242 });
  if (!suite) {
    H.ai(true); H.start();
    H.call(`G.state='play';meta.fps=false;`);
    H.win.__ADV = (ms) => H.advance(ms);
    H.win.__RTS = [];
    H.call(`(function(){const R=render;render=function(){window.__RTS.push(performance.now());const r=R.apply(this,arguments);window.__ADV(window.__COST());return r;};})()`);
  }
  let i = 0;
  H.win.__COST = () => cout(i);
  const F = H.call('frame');
  let ts = suite ? suite.ts : H.clock() + P;
  const n = Math.round(secondes * 1000 / P), r0 = H.win.__RTS.length;
  for (; i < n; i++) {
    if (ts > H.clock()) H.advance(ts - H.clock());
    F(ts);
    if (H.call('G.state') !== 'play') H.call(`G.state='play';`);
    const fin = H.clock() + 0.3;
    ts += P * Math.max(1, Math.ceil((fin - ts) / P - 1e-9));
  }
  const R = H.win.__RTS.slice(r0), iv = [];
  for (let k = 1; k < R.length; k++) iv.push(R[k] - R[k - 1]);
  return { H, ts, iv, hr: H.call("typeof HR==='undefined'?'absent':HR") };
}
const part = (iv, a, b) => iv.length ? iv.filter(x => x >= a && x <= b).length / iv.length : 0;
const desc = (iv) => { const h = {}; for (const x of iv) { const k = x < 12 ? '8' : x < 20 ? '17' : x < 29 ? '25' : '33+'; h[k] = (h[k] || 0) + 1; } return Object.entries(h).map(([k, v]) => k + ' ms ×' + v).join(', '); };
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
/* coût pseudo-aléatoire déterministe dans [a, b] */
const osc = (a, b) => (i) => a + (b - a) * (((i * 2654435761) >>> 0) % 1000) / 999;

/* C1 puis C2 : la même partie */
{
  const P = 1000 / 120;
  const w = banc(P, () => 1.5, 2);                          /* mise en route : la période d'écran est apprise (SKP) */
  const a = banc(P, osc(6, 10), 4, w);                      /* lourd : la demi-cadence doit s'enclencher */
  const b = banc(P, osc(6, 10), 6, a);                      /* régime établi : mesuré */
  check('C1 écran 120 Hz, image de 6 à 10 ms : les dessins sont RÉGULIERS (≥ 95 % des intervalles entre 15 et 18,4 ms)',
    part(b.iv, 15, 18.4) >= .95, `demi-cadence=${b.hr} ; ${b.iv.length} intervalles : ${desc(b.iv)}`);
  const c = banc(P, () => 2, 20, b);                        /* l'image redevient légère */
  const d = banc(P, () => 2, 3, c);
  check('C2 puis image légère (2 ms) : la cadence pleine REVIENT (dessins à 8,3 ms)',
    part(d.iv, 7, 9.7) >= .95 && d.hr === false, `demi-cadence=${d.hr} ; ${d.iv.length} intervalles : ${desc(d.iv)}`);
}
/* C3 : écran 120 Hz, image légère dès le début */
{
  const P = 1000 / 120;
  const w = banc(P, () => 2, 2), a = banc(P, osc(1.5, 4), 8, w);
  check('C3 écran 120 Hz, image légère : jamais de demi-cadence (chaque rappel dessine, 8,3 ms)',
    a.hr !== true && part(a.iv, 7, 9.7) >= .97, `demi-cadence=${a.hr} ; ${a.iv.length} intervalles : ${desc(a.iv)}`);
}
/* C4 : écran 60 Hz, image lourde */
{
  const P = 1000 / 60;
  const w = banc(P, () => 3, 2), a = banc(P, osc(10, 20), 10, w);
  check('C4 écran 60 Hz, image de 10 à 20 ms : jamais de demi-cadence',
    a.hr !== true, `demi-cadence=${a.hr} ; ${a.iv.length} intervalles : ${desc(a.iv)}`);
}

console.log(`test/cadence.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
