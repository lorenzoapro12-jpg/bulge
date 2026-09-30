'use strict';
/* =========================================================
   MESURE — la cuisson en worker fait-elle tomber le temps du THREAD PRINCIPAL par image ?
   Ce n'est pas un test (pas de verdict) : un instrument. Vrai Chromium par CDP, CPU ralenti
   (Emulation.setCPUThrottlingRate), vrai jeu, vraie boucle frame(), joueur qui explore.

   node test/perf-worker.js [ralentissement=4] [duree_s=25] [runs=2] [--voyage]   (--voyage : deplacement force, ~1,4 chunk/s)
   --lent=70 : chaque chunk du worker est rendu 70 ms plus tard (worker simule plus lent ; il reste « en vol »)
   node test/perf-worker.js --memoire                                           (memoire d'un monde, donc d'un worker)

   Pilote : celui de bulge-verif/perf.py, extrait TEL QUEL (meme pilote que les mesures precedentes).
   Trois pages : AVANT (bulge.html de HEAD), REPLI (cette branche, defaut), WORKER (cette branche, WKW=true).
   Par image, au meme endroit que la ligne « ou : » du compteur embarque (g4.js : FWK+BKMS) :
     - travail JS de frame()          (tout le thread principal de l'image, cuisson comprise)
     - BKMS                           (streamWorld : cuisson + sprites d'obstacles, ce que la cuisson coute ici)
     - drawGround                     (sol de secours : un chunk visible n'etait pas pret)
   Hors image : les longtasks (PerformanceObserver) — la plus longue plage sans rendre la main, que
   le travail vienne de frame() ou d'un message du worker. Memoire : WD mesure dans le tas de la page (voir run()).
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { launch } = require('./worker.js');

const NUM = process.argv.slice(2).filter(a => !a.startsWith('--'));
const RATE = parseFloat(NUM[0] || '4'), SECS = parseFloat(NUM[1] || '25'), RUNS = parseInt(NUM[2] || '2', 10);
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const py = fs.readFileSync('/root/work/bulge-verif/perf.py', 'utf8');
const DRIVER = py.slice(py.indexOf('DRIVER = r"""') + 13, py.indexOf('"""', py.indexOf('DRIVER = r"""') + 13));
if (!DRIVER.includes('PILOTE DE MESURE')) throw new Error('pilote de perf.py introuvable');
const LENT = +((process.argv.find(a => a.startsWith('--lent=')) || '=0').split('=')[1]);
const EXTRA = (wk, voy) => `
<script>
/* ===== compteurs de la mesure worker : ne font pas partie du jeu ===== */
${wk ? 'WKW=true;' : 'WKW=false;/* depuis P1 le worker est le defaut : le REPLI se force */'}${voy ? 'window.__VOY=1;' : ''}${wk && LENT ? '{const r=wkRecv;wkRecv=e=>setTimeout(()=>r(e),' + LENT + ');}' : ''}
window.__pw={f:[],lt:[],sol:0,t0:0,n0:0,s0:0,go:0};
(function(){const P=window.__pw;let sol=0,bms=0,bn=0,ang=0;
  const dg=drawGround;drawGround=function(){sol++;return dg.apply(this,arguments);};
  /* cuisson SUR LE THREAD PRINCIPAL : temps passe dans bakeStep, chunks termines */
  const bs=bakeStep;bakeStep=function(c){const a=performance.now(),r=bs(c);bms+=performance.now()-a;if(r)bn++;return r;};
  /* voyage : deplacement force de 12 px par pas (720 px/s, ~1,4 chunk/s), cap qui tourne, rebond au bord */
  if(window.__VOY){const os=step;step=function(){const r=os.apply(this,arguments);try{if(G&&G.p&&G.state==='play'){ang+=.002;const p=G.p;
    p.x+=Math.cos(ang)*12;p.y+=Math.sin(ang)*12;const d=Math.hypot(p.x,p.y);if(d>WR*.8){p.x*=WR*.8/d;p.y*=WR*.8/d;ang+=Math.PI*.7;}}}catch(e){}return r;};}
  const of=frame;frame=function(ts){sol=0;bms=0;bn=0;const a=performance.now();const r=of.apply(this,arguments);const b=performance.now();
    if(G&&!P.go){P.n0++;if(sol)P.s0++;}if(G&&G.state==='play')P.f.push([b-a,typeof BKMS==='number'?BKMS:0,sol,bms,bn]);if(P.f.length>20000)P.f.splice(0,5000);return r;};
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())P.lt.push(e.duration);}).observe({type:'longtask',buffered:true});}catch(e){P.lterr=String(e);}
})();
</script>`;

function page(src, label, wk, voy) {
  const html = fs.readFileSync(src, 'utf8'), i = html.lastIndexOf('</body>');
  const out = '/root/shots/pw-' + label + '.html';
  fs.writeFileSync(out, html.slice(0, i) + DRIVER + EXTRA(wk, voy) + html.slice(i));
  return out;
}
const pct = (a, p) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const st = a => ({ med: pct(a, .5), p90: pct(a, .9), p99: pct(a, .99), max: a.length ? Math.max(...a) : 0, moy: a.reduce((s, v) => s + v, 0) / Math.max(1, a.length) });
const f = v => v.toFixed(1).padStart(6);

async function run(file, label) {
  const B = await launch();
  try {
    await B.cdp('Emulation.setCPUThrottlingRate', { rate: RATE });
    await B.nav('file://' + file);
    await sleep(6000);                       /* chargement, entree en partie : pas mesure */
    await B.ev('window.__pw.go=1;window.__pw.f.length=0;window.__pw.lt.length=0;window.__pw.wk0=typeof WKN==="number"?WKN:0;true');
    await sleep(SECS * 1000);
    const P = await B.ev('({n0:__pw.n0,s0:__pw.s0,f:__pw.f,lt:__pw.lt,lterr:__pw.lterr,wk:typeof WK!=="undefined"&&!!WK,wkn:(typeof WKN==="number"?WKN:0)-__pw.wk0,st:G&&G.state,heap:0})');
    const S = P.f.map(x => x[3]), bn = P.f.reduce((s, x) => s + x[4], 0), s3 = st(S);
    const W = P.f.map(x => x[0]), K = P.f.map(x => x[1]), sol = P.f.filter(x => x[2] > 0).length, nsol = P.f.reduce((s, x) => s + x[2], 0);
    const w = st(W), k = st(K);
    console.log(`\n### ${label} — CPU x${RATE}, ${SECS}s, ${P.f.length} images en jeu (${P.st})${P.wk ? ', WORKER actif, ' + P.wkn + ' chunks recus' : ', cuisson sur place'}`);
    console.log(`  thread principal par image, frame() (ms) : med ${f(w.med)} p90 ${f(w.p90)} p99 ${f(w.p99)} max ${f(w.max)} moy ${f(w.moy)}`);
    console.log(`  dont streamWorld = BKMS          (ms) : med ${f(k.med)} p90 ${f(k.p90)} p99 ${f(k.p99)} max ${f(k.max)} moy ${f(k.moy)}  cumul ${K.reduce((s, v) => s + v, 0).toFixed(0)} ms`);
    console.log(`  CUISSON sur le thread principal (bakeStep, ms/image) : moy ${f(s3.moy)} p99 ${f(s3.p99)} max ${f(s3.max)}  cumul ${S.reduce((s, v) => s + v, 0).toFixed(0)} ms, ${bn} chunks cuits ici${P.wk ? ', ' + P.wkn + ' recus du worker' : ''}`);
    console.log(`  DEMARRAGE (partie lancee -> 6 s) : sol de secours sur ${P.s0}/${P.n0} images`);
    console.log(`  sol de secours (drawGround) : ${nsol} appels, ${sol}/${P.f.length} images (${(100 * sol / Math.max(1, P.f.length)).toFixed(1)} %)`);
    console.log(`  longtasks (>50 ms, tout le thread) : ${P.lt.length}, la plus longue ${P.lt.length ? Math.max(...P.lt).toFixed(0) : 0} ms${P.lterr ? ' (' + P.lterr + ')' : ''}`);
    return { label, n: P.f.length, w, k, s3, sol, nsol, lt: P.lt, wkn: P.wkn, bn };
  } finally { B.close(); }
}

/* memoire d'un worker = ce qu'il porte en plus de la page : un 2e monde (genWorld) et son cache de chunks.
   Mesure dans une page VIERGE (bulge.html, menu, sans GC entre deux) : tas JS apres GC, puis 3 mondes gardes en vie,
   puis 200 chunks generes dans chacun. Les canevas du monde (map/mini/fog) sont hors tas JS : comptes a part. */
async function memoire() {
  const B = await launch();
  try {
    await B.nav('file://' + path.join(ROOT, 'bulge.html')); await sleep(4000);
    const gc = () => B.cdp('HeapProfiler.collectGarbage', {}), hu = async () => { await gc(); await gc(); return (await B.cdp('Runtime.getHeapUsage', {})).usedSize; };
    await B.ev('render=function(){};true');
    const h0 = await hu();
    await B.ev('window.__K=[];for(let i=0;i<3;i++){genWorld(1000+i);__K.push(WD);}true');
    const h1 = await hu();
    await B.ev('for(const w of __K){WD=w;let n=0;for(let cx=-7;cx<7&&n<200;cx++)for(let cy=-7;cy<7&&n<200;cy++)if(getChunk(cx,cy))n++;}true');
    const h2 = await hu();
    const cv = await B.ev('[WD.map,WD.mini,WD.fog].filter(Boolean).reduce((s,c)=>s+c.width*c.height*4,0)'), src = await B.ev('document.getElementById("wk-src").textContent.length');
    const Mo = v => (v / 1048576).toFixed(2) + ' Mo';
    console.log(`\n### MEMOIRE d'un worker (tas JS de la page, apres GC, moyenne sur 3 mondes)`);
    console.log(`  un monde (genWorld, sans chunk) : ${Mo((h1 - h0) / 3)} ; + 200 chunks generes : ${Mo((h2 - h1) / 3)} (${((h2 - h1) / 3 / 200 / 1024).toFixed(1)} Ko/chunk)`);
    /* cout TOTAL d'un worker (isolat V8, code compile, WD, canevas) : RSS des processus de rendu de Chromium,
       avant puis apres 3 workers reels (bakeWorker + {t:'monde'} attendu). Bruite a ~1 Mo pres. */
    const rss = () => { let t = 0; for (const pid of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) { try {
      const cl = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8'); if (!cl.includes('--type=renderer') || !cl.includes('wk-')) continue;
      const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync('/proc/' + pid + '/status', 'utf8')); if (m) t += +m[1] * 1024; } catch (e) { } } return t; };
    await B.ev('delete window.__K;true'); await hu(); await sleep(1500); const r0 = rss();
    await B.ev('(async()=>{window.__WS=[];for(let i=0;i<3;i++){const w=bakeWorker();await new Promise(r=>{w.onmessage=r;w.postMessage({t:"monde",seed:12345+i,g:1});});__WS.push(w);}return true;})()');
    await hu(); await sleep(1500); const r1 = rss();
    console.log(`  RSS des processus de rendu : ${Mo(r0)} -> ${Mo(r1)} avec 3 workers prets, soit ${Mo((r1 - r0) / 3)} PAR WORKER (tout compris)`);
    console.log(`  canevas du monde hors tas : ${Mo(cv)} ; texte du code du worker : ${Mo(src)} (plus son compilé) ; + 1 Mo transitoire par chunk en cuisson`);
  } finally { B.close(); }
}

(async () => {
  if (process.argv.includes('--memoire')) return memoire();
  fs.mkdirSync('/root/shots', { recursive: true });
  const avant = '/root/shots/pw-src-avant.html';
  fs.writeFileSync(avant, execSync('git show HEAD:bulge.html', { cwd: ROOT, maxBuffer: 1 << 26 }));
  const voy = process.argv.includes('--voyage'), sf = voy ? '-voy' : '';
  const P = [page(avant, 'avant' + sf, false, voy), page(path.join(ROOT, 'bulge.html'), 'repli' + sf, false, voy), page(path.join(ROOT, 'bulge.html'), 'worker' + sf, true, voy)];
  const L = ['AVANT (HEAD, canvas DOM, sur place)', 'REPLI (OffscreenCanvas, sur place)', 'WORKER (WKW=true)'].map(x => x + (voy ? ' VOYAGE' : ' pilote perf.py'));
  /* en alternance, pour que la derive du banc touche les trois pareil */
  if (LENT) { for (let r = 0; r < RUNS; r++) await run(P[2], L[2] + ' LENT +' + LENT + ' ms/chunk run ' + (r + 1)); return; }
  for (let r = 0; r < RUNS; r++) for (let i = 0; i < 3; i++) await run(P[i], L[i] + ' run ' + (r + 1));
})().catch(e => { console.error(e); process.exit(1); });
