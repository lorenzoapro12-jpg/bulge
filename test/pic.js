'use strict';
/* =========================================================
   MESURE (chantier P1) — le pic d'image qui reste AVEC le worker vient-il de la CUISSON ou du COLLAGE ?
   Ce n'est pas un test (pas de verdict, code de sortie 0) : un instrument. Vrai Chromium par CDP, CPU ralenti,
   vrai bulge.html, vraie boucle frame(), pilote de bulge-verif/perf.py (comme test/perf-worker.js).

   node test/pic.js [ralentissement=4] [duree_s=20] [runs=2] [--gpu]

   Trois conditions, en alternance :
     WORKER voyage  : le defaut (aucun parametre d'URL), deplacement force 12 px/pas (~1,4 chunk/s)
     ?wk=0  voyage  : le temoin sur place, meme deplacement
     WORKER fixe    : le defaut, joueur epingle => aucun chunk neuf : le plancher des pics SANS cuisson NI collage
   Par image i : debut rAF ts[i], travail JS de frame() js[i], BKMS[i] (streamWorld : tout ce que la cuisson coute
   au fil principal — avec le worker : demandes + sprites d'obstacles), bakeStep ms, chunks recus du worker depuis
   l'image precedente, et « neufs » = surfaces de chunk (512 px) dessinees sur l'ecran pour la PREMIERE fois
   (drawImage de drawChunks, g3.js : le COLLAGE ; sa rasterisation/televersement est hors JS).
   L'intervalle attribue a l'image i est ts[i+1]-ts[i] : celui qui CONTIENT son JS et sa composition.
   Lecture : si les pires intervalles suivent des images « neufs » alors que leur JS et leur BKMS sont bas,
   le pic est du collage ; si BKMS/bakeStep y est haut, c'est de la cuisson ; s'ils existent aussi en « fixe »,
   ni l'un ni l'autre.
   LIMITE : banc ARM64 sans GPU (rasterisation logicielle) et CPU ralenti, pas un telephone. La variance du banc
   est forte (CLAUDE.md) : lire les ecarts entre classes d'images d'un MEME run, pas les valeurs absolues.
   ========================================================= */
const fs = require('fs'), path = require('path');
const { launch } = require('./worker.js');
const NUM = process.argv.slice(2).filter(a => !a.startsWith('--'));
const RATE = parseFloat(NUM[0] || '4'), SECS = parseFloat(NUM[1] || '20'), RUNS = parseInt(NUM[2] || '2', 10);
const ROOT = path.resolve(__dirname, '..'), sleep = ms => new Promise(r => setTimeout(r, ms));
const py = fs.readFileSync('/root/work/bulge-verif/perf.py', 'utf8');
const DRIVER = py.slice(py.indexOf('DRIVER = r"""') + 13, py.indexOf('"""', py.indexOf('DRIVER = r"""') + 13));
if (!DRIVER.includes('PILOTE DE MESURE')) throw new Error('pilote de perf.py introuvable');
const EXTRA = fixe => `
<script>
/* ===== compteurs de la mesure du pic : ne font pas partie du jeu ===== */
window.__pc={f:[],go:0};
(function(){const P=window.__pc;let bms=0,neufs=0,recv=0,ang=0,pin=null;const vus=new WeakSet();
  const bs=bakeStep;bakeStep=function(c){const a=performance.now(),r=bs(c);bms+=performance.now()-a;return r;};
  /* le collage, pris a la source : tout drawImage d'une surface de chunk (ImageBitmap du worker, ou OffscreenCanvas de
     CH px cuit sur place) vue pour la premiere fois — quel que soit le chemin de rendu qui l'appelle dans g3.js */
  for(const pr of [CanvasRenderingContext2D.prototype,OffscreenCanvasRenderingContext2D.prototype]){const di=pr.drawImage;pr.drawImage=function(s){
    if((s instanceof ImageBitmap||s instanceof OffscreenCanvas)&&s.width===CH&&!vus.has(s)){vus.add(s);neufs++;}return di.apply(this,arguments);};}
  let wkn=0;
  const os=step;step=function(){const r=os.apply(this,arguments);try{if(G&&G.p&&G.state==='play'){const p=G.p;
    if(${fixe ? 1 : 0}){if(!pin)pin=[p.x,p.y];p.x=pin[0];p.y=pin[1];}
    else{ang+=.002;p.x+=Math.cos(ang)*12;p.y+=Math.sin(ang)*12;const d=Math.hypot(p.x,p.y);if(d>WR*.8){p.x*=WR*.8/d;p.y*=WR*.8/d;ang+=Math.PI*.7;}}}}catch(e){}return r;};
  /* recus : par l'ecart de WKN (wkRecv peut deja etre branche sur le worker quand ce script s'installe) */
  const of=frame;frame=function(ts){bms=0;neufs=0;recv=WKN-wkn;wkn=WKN;const a=performance.now();const r=of.apply(this,arguments);const b=performance.now();
    if(P.go&&G&&G.state==='play')P.f.push([ts,b-a,typeof BKMS==='number'?BKMS:0,bms,neufs,recv]);return r;};
})();
</script>`;
function page(label, fixe) { const html = fs.readFileSync(path.join(ROOT, 'bulge.html'), 'utf8'), i = html.lastIndexOf('</body>'), out = '/root/shots/pic-' + label + '.html';
  fs.writeFileSync(out, html.slice(0, i) + DRIVER + EXTRA(fixe) + html.slice(i)); return out; }
const pct = (a, p) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const f = v => v.toFixed(1).padStart(6);
const ligne = (nom, a) => `  ${nom.padEnd(44)} n=${String(a.length).padStart(4)}  med ${f(pct(a, .5))}  p95 ${f(pct(a, .95))}  p99 ${f(pct(a, .99))}  max ${f(a.length ? Math.max(...a) : 0)}`;

async function run(file, query, label) {
  const B = await launch({ gpu: process.argv.includes('--gpu') });
  try {
    await B.cdp('Emulation.setCPUThrottlingRate', { rate: RATE });
    await B.nav('file://' + file + query);
    await sleep(6000);                       /* chargement, entree en partie, pre-cuisson : pas mesure */
    await B.ev('window.__pc.go=1;true');
    await sleep(SECS * 1000);
    /* garde de validite : sans camera finie, ou sans aucun collage en voyage, la mesure ne dit RIEN du collage */
    const V = await B.ev('({cam:isFinite(CAM.x)&&isFinite(CAM.y)&&isFinite(VL)&&VR>VL,n:__pc.f.reduce((s,x)=>s+x[4],0)})');
    if (!V.cam || (!/fixe/.test(label) && !V.n)) console.log(`\n!!! MESURE INVALIDE (${label}) : camera ${V.cam ? 'finie' : 'NON FINIE (CAM/VL..VR)'} , ${V.n} collage(s) neuf(s) — aucune surface de chunk n'est dessinee, le collage n'est PAS exerce ; ne rien conclure des lignes ci-dessous`);
    const P = await B.ev('({f:__pc.f,wk:WK===null?"?":WK?"worker "+WKN:"sur place",st:G&&G.state,s:location.search})');
    /* image i : [intervalle qui la contient, js, BKMS, bakeStep, neufs, recus] */
    const F = []; for (let i = 0; i + 1 < P.f.length; i++) F.push([P.f[i + 1][0] - P.f[i][0], P.f[i][1], P.f[i][2], P.f[i][3], P.f[i][4], P.f[i][5]]);
    const dt = F.map(x => x[0]), N = F.filter(x => x[4] > 0), S = F.filter(x => x[4] === 0), Rv = F.filter(x => x[5] > 0 && x[4] === 0);
    console.log(`\n### ${label} — URL « ${P.s} », compteur « cuisson ${P.wk} », CPU x${RATE}, ${SECS}s, ${F.length} images (${(1000 * F.length / dt.reduce((s, v) => s + v, 0)).toFixed(1)} ips), etat ${P.st}`);
    console.log(ligne('intervalle d\'image (ms), toutes', dt));
    console.log(ligne('travail JS de frame() (ms), toutes', F.map(x => x[1])));
    console.log(ligne('dont streamWorld = BKMS (ms), toutes', F.map(x => x[2])));
    console.log(ligne('dont bakeStep sur le fil principal (ms)', F.map(x => x[3])));
    console.log(`  chunks colles pour la 1re fois : ${N.reduce((s, x) => s + x[4], 0)} sur ${N.length} images ; chunks recus du worker : ${F.reduce((s, x) => s + x[5], 0)}`);
    console.log(ligne('intervalle des images AVEC collage neuf', N.map(x => x[0])));
    console.log(ligne('  leur JS', N.map(x => x[1])));
    console.log(ligne('  leur BKMS', N.map(x => x[2])));
    console.log(ligne('  leur hors-JS (intervalle - JS)', N.map(x => x[0] - x[1])));
    console.log(ligne('intervalle des images SANS collage neuf', S.map(x => x[0])));
    console.log(ligne('  leur hors-JS (intervalle - JS)', S.map(x => x[0] - x[1])));
    console.log(ligne('intervalle : chunk RECU mais pas colle', Rv.map(x => x[0])));
    const top = F.map((x, i) => [x, i]).sort((a, b) => b[0][0] - a[0][0]).slice(0, 10);
    console.log(`  10 pires intervalles : ${top.filter(t => t[0][4] > 0).length}/10 contiennent un collage neuf (taux de base ${(100 * N.length / Math.max(1, F.length)).toFixed(1)} % des images)`);
    for (const [x] of top.slice(0, 5)) console.log(`     ${f(x[0])} ms  JS ${f(x[1])}  BKMS ${f(x[2])}  bakeStep ${f(x[3])}  neufs ${x[4]}  recus ${x[5]}`);
  } finally { B.close(); }
}
(async () => {
  fs.mkdirSync('/root/shots', { recursive: true });
  const voy = page('voyage', false), fix = page('fixe', true);
  for (let r = 0; r < RUNS; r++) { await run(voy, '', 'WORKER voyage, run ' + (r + 1)); await run(voy, '?wk=0', '?wk=0 voyage (temoin sur place), run ' + (r + 1)); await run(fix, '', 'WORKER fixe (aucun chunk neuf), run ' + (r + 1)); }
})().catch(e => { console.error(e); process.exit(1); });
