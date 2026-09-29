'use strict';
/* =========================================================
   FRONTIÈRE SONORE (chantier E3) : la frontière s'entend avant de se voir.

   node test/frontiere-sonore.js              graines 1..12, 3 frontières chacune ; résumé
   node test/frontiere-sonore.js --ref=HEAD   TÉMOIN : même traversée sur l'ancien code (doit échouer)
   node test/frontiere-sonore.js --detail     courbe du poids audio sur la première traversée

   On fait tourner le VRAI ordonnanceur musical (schedStep, g1.js) dans un AudioContext factice qui
   enregistre les automations, pendant qu'on déplace G.p pas à pas (4 px) à travers une frontière de biome,
   avec la vraie bascule franche (setBiome quand biomeAt change, comme updWorld). À chaque temps :
     1. le poids audio du biome d'arrivée B VAUT biomeMix(G.p.x,G.p.y) (AU.bm est l'objet renvoyé : on
        recalcule biomeMix ici et on compare), et la nappe d'ambiance de B reçoit AMB[B].niveau × ce poids ;
     2. il MONTE avant la frontière : > 0 au moins 150 px avant le point où biomeAt bascule ;
     3. il est CONTINU : aucun saut > 0,05 entre deux relevés distants de 4 px ;
     4. une fois monté, il ne REPASSE PAS par zéro, et finit à 1.
   Sur l'ancien code, le seul « poids » que l'audio connaisse est la palette AU.pal : 0 puis 1 d'un coup.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), DETAIL = !!ARG('detail');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
const mkEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
  querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
const stash = new Map();
const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
  createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };

/* ---------- AudioContext factice : chaque paramètre retient sa dernière cible ; on compte les nœuds créés ---------- */
const NODES = {};
function mkParam(v) { return { value: v, last: v, setValueAtTime(x) { this.last = x; }, linearRampToValueAtTime(x) { this.last = x; }, exponentialRampToValueAtTime(x) { this.last = x; },
  setTargetAtTime(x) { this.last = x; }, cancelScheduledValues() {} }; }
function mkNode(kind) { NODES[kind] = (NODES[kind] || 0) + 1;
  return { kind, gain: mkParam(1), frequency: mkParam(350), Q: mkParam(1), detune: mkParam(0), pan: mkParam(0), delayTime: mkParam(0), threshold: mkParam(0), ratio: mkParam(1),
    type: '', buffer: null, loop: false, connect(d) { return d; }, disconnect() {}, start() {}, stop() {} }; }
class FakeAC { constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = mkNode('dest'); }
  createBuffer(ch, len) { const d = [...Array(ch)].map(() => new Float32Array(len)); return { getChannelData: c => d[c] }; }
  resume() {} }
for (const k of ['Gain', 'Oscillator', 'BiquadFilter', 'BufferSource', 'Convolver', 'Delay', 'StereoPanner', 'DynamicsCompressor']) FakeAC.prototype['create' + k] = function () { return mkNode(k); };

const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {}, AudioContext: FakeAC };
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} });
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
vm.runInThisContext(ORDER.map(read).join('\n'), { filename: 'game.js' });
const call = e => vm.runInThisContext(e);

call(`meta.mute=false;auInit();`);
const INIT = Object.assign({}, NODES);
const HAS = call(`typeof musW==='function'`);
console.log(`code : ${REF ? 'TÉMOIN ' + REF : 'arbre de travail'} — musW ${HAS ? 'présent' : 'ABSENT (poids = palette AU.pal, binaire)'}`);
console.log(`nœuds permanents créés par auInit : ${Object.entries(INIT).map(([k, v]) => k + '=' + v).join(' ')}`);

/* poids audio du biome b, tel que l'audio le voit */
const audioW = b => HAS ? call(`musW(${JSON.stringify(b)})`) : call(`AU.pal===PAL[${JSON.stringify(b)}]?1:0`);
/* poids de b dans biomeMix, recalculé ici (source de vérité) */
const mixW = (b, x, y) => call(`biomeMix(${x},${y}).reduce((s,e)=>s+(e.b===${JSON.stringify(b)}?e.w:0),0)`);

/* frontières : depuis le site i, marcher vers un voisin de type différent ; retenir le point où biomeAt bascule */
function frontiers(n) {
  const S = JSON.parse(call(`JSON.stringify(WD.sites.map(s=>({x:s.x,y:s.y,t:s.t})))`)), out = [];
  for (let i = 0; i < S.length && out.length < n; i++) {
    let bj = -1, bd = 1e18;
    for (let j = 0; j < S.length; j++) if (S[j].t !== S[i].t) { const d = Math.hypot(S[j].x - S[i].x, S[j].y - S[i].y); if (d < bd) { bd = d; bj = j; } }
    if (bj < 0) continue;
    const ux = (S[bj].x - S[i].x) / bd, uy = (S[bj].y - S[i].y) / bd;
    /* point de départ : 700 px avant la bascule, dans A, et à l'écart de toute autre frontière ; arrivée 700 px après */
    let cx = null;
    for (let s = 0; s < bd; s += 4) { const b = call(`biomeAt(${S[i].x + ux * s},${S[i].y + uy * s})`); if (b !== S[i].t) { cx = s; break; } }
    if (cx === null) continue;
    const B = call(`biomeAt(${S[i].x + ux * (cx + 8)},${S[i].y + uy * (cx + 8)})`);
    let ok = true;
    for (let s = cx - 700; s <= cx + 700; s += 4) { const b = call(`biomeAt(${S[i].x + ux * s},${S[i].y + uy * s})`); if ((s < cx && b !== S[i].t) || (s >= cx + 8 && b !== B)) { ok = false; break; } }
    if (!ok) continue;
    out.push({ A: S[i].t, B, x0: S[i].x + ux * (cx - 700), y0: S[i].y + uy * (cx - 700), ux, uy, len: 1400, cross: 700 });
  }
  return out;
}

let fails = 0, done = 0, ex = null;
const JUMP = .05, EARLY = 150;
for (let seed = 1; seed <= 12; seed++) {
  call(`genWorld(${seed});newRun('bal',false);G.state='play';AU.layer=1;meta.mute=false;`);
  for (const F of frontiers(3)) {
    call(`G.biome=${JSON.stringify(F.A)};setBiome(G.biome);musNewPal(0);AU.trans=0;AU.tier=0;AU.step=0;`);
    const W = [], err = [];
    let step = 0, t = 0;
    for (let s = 0; s <= F.len; s += 4) {
      const x = F.x0 + F.ux * s, y = F.y0 + F.uy * s;
      call(`G.p.x=${x};G.p.y=${y};{const b=biomeAt(G.p.x,G.p.y);if(b!==G.biome){G.biome=b;setBiome(b);}}`);
      /* un temps complet (4 pas) : musMix y relève biomeMix ; la bascule de palette se fait aux débuts de mesure */
      for (let k = 0; k < 4; k++) { call(`schedStep(${step},${t})`); step++; t += .121; }
      const w = audioW(F.B);
      W.push({ s: s - F.cross, w });
      if (HAS) {
        const m = mixW(F.B, x, y);
        if (Math.abs(w - m) > 1e-12 && err.length < 3) err.push(`à ${s - F.cross} px : poids audio ${w.toFixed(4)} ≠ biomeMix ${m.toFixed(4)}`);
        const same = call(`JSON.stringify(AU.bm)===JSON.stringify(biomeMix(G.p.x,G.p.y))`);
        if (!same && err.length < 3) err.push(`à ${s - F.cross} px : AU.bm n'est pas biomeMix(G.p)`);
        const ga = call(`(()=>{const a={};for(const k in AMB)a[k]=0;for(const e of biomeMix(G.p.x,G.p.y))a[PAL[e.b].amb]+=e.w;let d=0;for(const k in AMB)d=Math.max(d,Math.abs(AU.ambL[k].gain.last-AMB[k][3]*a[k]));return d;})()`);
        if (ga > 1e-12 && err.length < 3) err.push(`à ${s - F.cross} px : nappe d'ambiance ≠ AMB × poids (écart ${ga})`);
      }
    }
    let maxJ = 0, jAt = 0; for (let i = 1; i < W.length; i++) { const d = Math.abs(W[i].w - W[i - 1].w); if (d > maxJ) { maxJ = d; jAt = W[i].s; } }
    const first = W.find(p => p.w > 0), up = first ? first.s : null;
    let zero = null; if (first) for (const p of W) if (p.s > first.s && p.w === 0) { zero = p.s; break; }
    if (maxJ > JUMP) err.push(`saut de ${maxJ.toFixed(3)} à ${jAt} px de la frontière (seuil ${JUMP} pour 4 px)` + (maxJ > .99 ? ' — poids BINAIRE : 0 puis 1 d\'un coup' : ''));
    if (up === null || up > -EARLY) err.push(`le poids de ${F.B} ne monte qu'à ${up} px (exigé : dès ${-EARLY} px avant la frontière)`);
    if (zero !== null) err.push(`le poids repasse par 0 à ${zero} px`);
    if (W[W.length - 1].w < 1 - 1e-9) err.push(`poids final ${W[W.length - 1].w.toFixed(3)} ≠ 1`);
    done++;
    if (!ex) ex = { seed, F, W };
    if (err.length) { fails++; if (fails <= 6) console.log(`  ÉCHEC graine ${seed} ${F.A} → ${F.B} : ${err.join(' ; ')}`); }
    else if (done <= 3) console.log(`  ok graine ${seed} ${F.A} → ${F.B} : monte dès ${up} px, saut max ${maxJ.toFixed(4)}/4 px, jamais 0, final 1`);
  }
}
if (DETAIL && ex) { console.log(`courbe (graine ${ex.seed}, ${ex.F.A} → ${ex.F.B}) :`); console.log(ex.W.filter((p, i) => i % 10 === 0).map(p => `${p.s}:${p.w.toFixed(3)}`).join(' ')); }
if (!done) { console.log('ÉCHEC : aucune frontière trouvée — le test ne mesure rien'); process.exit(1); }
console.log(`${done} traversées, ${fails} en échec`);
if (fails) { console.log('ÉCHEC' + (HAS ? '' : ' — cause : sur ce code le poids audio est la palette AU.pal, binaire (0 puis 1 à la bascule de G.biome) : aucun fondu avant la frontière')); process.exit(1); }
console.log('TOUT PASSE');
