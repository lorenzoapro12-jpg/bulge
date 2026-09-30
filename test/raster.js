'use strict';
/* =========================================================
   MESURE — le collage d'un chunk NEUF (drawChunks -> drawImage) force-t-il une rasterisation
   differee couteuse, d'un coup ?  Ce n'est pas un test (pas de verdict) : un instrument.

   Pourquoi il faut un instrument a part : canvas 2D ENREGISTRE les operations et ne rasterise
   qu'a la fin de l'image, hors du JS. Chronometrer drawImage en JS ne voit donc rien ; et le
   « hors-JS » du compteur embarque (intervalle d'image − JS) contient aussi l'ATTENTE de la
   synchro verticale, qui n'est pas du travail. Trois mesures, vrai Chromium par CDP, CPU ralenti
   (Emulation.setCPUThrottlingRate), vrai jeu, vraie boucle frame(), joueur qui voyage :

     passif — rien n'est force. Par image : chunks colles pour la PREMIERE fois par drawChunks
              (« neufs »), JS de frame(), et l'intervalle jusqu'a l'image suivante (c'est la que
              retombe un cout paye apres le JS). Les pics d'intervalle tombent-ils sur les images
              a chunk neuf plus souvent que leur part ?
     flush  — apres frame(), getImageData(0,0,1,1) sur le canvas principal : force la rasterisation
              de TOUT ce que l'image a enregistre, donc la rend chronometrable. Compare les images
              avec et sans chunk neuf : l'ecart est le cout differe attribuable au chunk neuf.
     sonde  — a la premiere apparition d'une surface de chunk, AVANT que le jeu la colle :
              drawImage vers un canvas-sonde 512×512 + getImageData, deux fois de suite.
              froid − chaud = cout paye UNE fois par surface neuve. C'est la reponse directe.

   node test/raster.js [ralentissement=4] [duree_s=20] [--ref=HEAD] [--gpu] [--chemin=worker|place] [--modes=passif,flush,sonde]
   --ref=HEAD : bulge.html du commit (avant/apres avec le MEME instrument).
   Limite : sans --gpu, Chromium rasterise le canvas en LOGICIEL sur le fil principal. Un telephone
   rasterise sur GPU (televersement de texture) : ce chemin-la n'est PAS mesure par cet outil.
   Pilote : celui de bulge-verif/perf.py (meme pilote que test/perf-worker.js) + voyage force.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { launch } = require('./worker.js');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const NUM = process.argv.slice(2).filter(a => !a.startsWith('--'));
const RATE = parseFloat(NUM[0] || '4'), SECS = parseFloat(NUM[1] || '20'), REF = ARG('ref'), CHEMIN = ARG('chemin'), MODES = (ARG('modes') || 'passif,flush,sonde').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const py = fs.readFileSync('/root/work/bulge-verif/perf.py', 'utf8');
const DRIVER = py.slice(py.indexOf('DRIVER = r"""') + 13, py.indexOf('"""', py.indexOf('DRIVER = r"""') + 13));
if (!DRIVER.includes('PILOTE DE MESURE')) throw new Error('pilote de perf.py introuvable');

const EXTRA = (wk, mode) => `
<script>
/* ===== instrument de rasterisation : ne fait pas partie du jeu ===== */
window.__rz={f:[],s:[],go:0,mode:'${mode}'};
(function(){const R=window.__rz,vus=new WeakSet();let neufs=0,enc=0,dc=0,ang=0,sonde=null,sg=null;
  const isBm=v=>typeof ImageBitmap!=='undefined'&&v instanceof ImageBitmap;
  /* voyage : deplacement force de 12 px par pas (meme regle que perf-worker.js --voyage) */
  const os=step;step=function(){const r=os.apply(this,arguments);try{if(G&&G.p&&G.state==='play'){ang+=.002;const p=G.p;
    p.x+=Math.cos(ang)*12;p.y+=Math.sin(ang)*12;const d=Math.hypot(p.x,p.y);if(d>WR*.8){p.x*=WR*.8/d;p.y*=WR*.8/d;ang+=Math.PI*.7;}}}catch(e){}return r;};
  const od=drawChunks;drawChunks=function(){
    /* meme parcours que drawChunks (g3.js) : on COMPTE, on ne dessine rien sur le canvas du jeu */
    const c0=Math.floor(VL/CH),c1=Math.floor(VR/CH),r0=Math.floor(VT/CH),r1=Math.floor(VB/CH);
    for(let cx=c0;cx<=c1;cx++)for(let cy=r0;cy<=r1;cy++){const c=getChunk(cx,cy);if(!c)continue;
      if(c.bake){if(!vus.has(c.bake)){vus.add(c.bake);neufs++;
        if(R.mode==='sonde'&&R.go){if(!sonde){sonde=document.createElement('canvas');sonde.width=sonde.height=512;sg=sonde.getContext('2d');sg.fillRect(0,0,1,1);sg.getImageData(0,0,1,1);}
          const a=performance.now();sg.drawImage(c.bake,0,0);sg.getImageData(0,0,1,1);const b=performance.now();sg.drawImage(c.bake,0,0);sg.getImageData(0,0,1,1);const d=performance.now();
          R.s.push([b-a,d-b,isBm(c.bake)?1:0,c.bake.width]);}}}
      else if(c.bk&&c.bk.cv)enc++;}
    const a=performance.now(),r=od.apply(this,arguments);dc=performance.now()-a;return r;};
  const of=frame;frame=function(ts){neufs=0;enc=0;dc=0;const a=performance.now();const r=of.apply(this,arguments);const b=performance.now();let fl=0;
    if(R.mode==='flush'){MAINCTX.getImageData(0,0,1,1);fl=performance.now()-b;}
    if(R.go&&G&&G.state==='play')R.f.push([ts,b-a,fl,neufs,enc,dc]);return r;};
})();
</script>`;

function page(label, wk, mode) {
  const html = REF ? cp.execFileSync('git', ['show', REF + ':bulge.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }) : fs.readFileSync(path.join(ROOT, 'bulge.html'), 'utf8');
  const i = html.lastIndexOf('</body>'), out = '/root/shots/rz-' + label + '.html';
  fs.writeFileSync(out, html.slice(0, i) + DRIVER + EXTRA(wk, mode) + html.slice(i));
  return out;
}
const pct = (a, p) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const st = a => 'n ' + String(a.length).padStart(4) + '  med ' + f(pct(a, .5)) + '  p90 ' + f(pct(a, .9)) + '  max ' + f(a.length ? Math.max(...a) : 0);
const f = v => v.toFixed(1).padStart(6);

async function run(wk, mode) {
  const label = (REF ? 'ref' : 'arbre') + '-' + (wk ? 'worker' : 'place') + '-' + mode;
  const B = await launch();
  try {
    await B.cdp('Emulation.setCPUThrottlingRate', { rate: RATE });
    /* « #plains » : sans lui le pilote EPINGLE le joueur sur un site toutes les 50 ms et le voyage est annule
       (constate au premier essai : 0 a 2 chunks neufs en 20 s). « ?wk=1 » : la voie d'activation du jeu. */
    await B.nav('file://' + page(label, wk, mode) + (wk ? '?wk=1' : '') + '#plains');
    await sleep(6000);                       /* chargement, entree en partie : pas mesure */
    await B.ev('window.__rz.go=1;window.__rz.p0=[G.p.x,G.p.y];window.__rz.c0=WD.chunks.filter(c=>c).length;true');
    await sleep(SECS * 1000);
    const P = await B.ev('({f:__rz.f,s:__rz.s,wk:typeof WK!=="undefined"&&!!WK,wkn:typeof WKN==="number"?WKN:0,st:G&&G.state,cw:cv.width,ch:cv.height,ps:PS,d:Math.hypot(G.p.x-__rz.p0[0],G.p.y-__rz.p0[1]),nc:WD.chunks.filter(c=>c).length-__rz.c0,wkw:WKW})');
    /* l'intervalle APRES l'image i lui est attribue : c'est la que retombe ce qu'elle a laisse a payer */
    const F = []; for (let i = 0; i + 1 < P.f.length; i++) F.push({ dt: P.f[i + 1][0] - P.f[i][0], js: P.f[i][1], fl: P.f[i][2], n: P.f[i][3], enc: P.f[i][4], dc: P.f[i][5] });
    const N0 = F.filter(x => x.n === 0), N1 = F.filter(x => x.n > 0), med = pct(F.map(x => x.dt), .5);
    console.log(`\n### ${mode.toUpperCase()} — ${REF ? 'ref ' + REF : 'arbre de travail'}, ${P.wk ? 'cuisson WORKER (' + P.wkn + ' chunks recus, surfaces ImageBitmap)' : 'cuisson SUR PLACE (surfaces canvas)'}, CPU x${RATE}, ${SECS}s, ${F.length} images en jeu (${P.st}), canvas ${P.cw}×${P.ch} PS ${P.ps}`);
    console.log(`  chunks colles pour la premiere fois : ${N1.reduce((s, x) => s + x.n, 0)} sur ${N1.length} images (${(100 * N1.length / Math.max(1, F.length)).toFixed(1)} % des images)`);
    console.log(`  pilote : joueur deplace de ${P.d.toFixed(0)} px, ${P.nc} chunks generes pendant la mesure${wk && !P.wk ? ' — WORKER DEMANDE MAIS ABSENT (WKW=' + P.wkw + ') : ce passage mesure la cuisson sur place' : ''}`);
    if (mode !== 'sonde') {
      for (const [nom, g] of [['sans chunk neuf', N0], ['AVEC chunk neuf ', N1]]) {
        console.log(`  ${nom} | JS frame() (ms)      : ${st(g.map(x => x.js))}`);
        console.log(`  ${nom} | intervalle suivant   : ${st(g.map(x => x.dt))}`);
        console.log(`  ${nom} | « hors-JS » affiche  : ${st(g.map(x => Math.max(0, x.dt - x.js)))}   (intervalle − JS : ATTENTE de synchro comprise)`);
        if (mode === 'flush') console.log(`  ${nom} | rasterisation forcee : ${st(g.map(x => x.fl))}   (travail reel du fil principal apres le JS)`);
      }
      const pics = F.filter(x => x.dt > 1.5 * med), pn = pics.filter(x => x.n > 0).length;
      console.log(`  pics (intervalle > 1,5 × mediane ${med.toFixed(1)} ms) : ${pics.length}, dont ${pn} sur une image a chunk neuf (${pics.length ? (100 * pn / pics.length).toFixed(0) : 0} % ; part des images a chunk neuf : ${(100 * N1.length / Math.max(1, F.length)).toFixed(1)} %)`);
      console.log('  5 pires intervalles : ' + F.slice().sort((a, b) => b.dt - a.dt).slice(0, 5).map(x => `${x.dt.toFixed(1)} ms [neufs ${x.n}, en cuisson ${x.enc}, JS ${x.js.toFixed(1)}${mode === 'flush' ? ', raster ' + x.fl.toFixed(1) : ''}]`).join(' · '));
    } else {
      for (const [nom, k] of [['ImageBitmap (worker)', 1], ['canvas (sur place)', 0]]) {
        const S = P.s.filter(x => x[2] === k); if (!S.length) continue;
        console.log(`  ${nom} | 1er collage + flush (froid) : ${st(S.map(x => x[0]))}`);
        console.log(`  ${nom} | 2e  collage + flush (chaud) : ${st(S.map(x => x[1]))}`);
        console.log(`  ${nom} | froid − chaud = cout UNIQUE : ${st(S.map(x => x[0] - x[1]))}   (surface ${S[0][3]} px)`);
      }
      if (!P.s.length) console.log('  aucune surface neuve vue : rien de mesure');
    }
  } finally { B.close(); }
}

(async () => {
  if (!REF && !fs.existsSync(path.join(ROOT, 'bulge.html'))) { console.error('bulge.html absent : lancer bash build.sh'); process.exit(1); }
  fs.mkdirSync('/root/shots', { recursive: true });
  console.log(`RASTER — ${process.argv.includes('--gpu') ? 'GPU demande (--gpu)' : 'rasterisation LOGICIELLE (--disable-gpu)'} ; resolution de performance.now() : 0,1 ms`);
  for (const wk of CHEMIN === 'place' ? [false] : CHEMIN === 'worker' ? [true] : [true, false])
    for (const mode of MODES) await run(wk, mode);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
