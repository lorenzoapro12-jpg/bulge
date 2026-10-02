'use strict';
/* =========================================================
   FRONTIÈRE SONORE — refonte en îlots : il n'y a plus de frontière de biome à traverser à pied (un biome par îlot) ;
   la frontière, c'est le PASSAGE d'un îlot au suivant (transStart → updTrans → genIslet → islStart → setBiome).

   node test/frontiere-sonore.js              les 8 îlots d'une partie, par le vrai passage ; code de sortie 0 si tout passe
   node test/frontiere-sonore.js --ref=HEAD   mêmes mesures sur un commit (avant la refonte : « API différente »)

   On fait tourner le VRAI ordonnanceur musical (schedStep, g1.js) dans un AudioContext factice qui enregistre les
   automations (chaque paramètre retient sa dernière cible). Sur CHAQUE îlot, trois mesures après l'arrivée :
     1. (gardé de l'ancien critère 1) le poids audio de chaque biome VAUT son poids dans biomeMix(G.p.x,G.p.y) — AU.bm
        est l'objet renvoyé (on recalcule biomeMix ici et on compare) — et chaque nappe d'ambiance reçoit
        AMB[type].niveau × la somme des poids des biomes de ce type ;
     2. (gardé de l'ancien critère 4, « finit à 1 ») le biome de l'îlot pèse 1, la palette musicale est la sienne
        (AU.pal = PAL[ISL[k-1]] : tonalité, gamme, grille), sa nappe joue à son niveau, les autres sont muettes.
   Retiré avec les frontières : la montée du poids AVANT la frontière (≥ 150 px), la continuité (saut ≤ 0,05 par 4 px)
   et le « ne repasse pas par zéro » — ils se mesuraient sur une traversée à pied, qui n'existe plus.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');

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

const H = L.mkGame({ ref: REF, seed: 5 }), call = H.call;
if (call(`typeof genIslet`) !== 'function' || call(`typeof transStart`) !== 'function') { console.log(`API différente : ${REF || 'l’arbre'} n’a pas d’îlots (genIslet/transStart absents) — rien à comparer`); console.log('ECHEC'); process.exit(1); }
H.win.AudioContext = FakeAC;
call(`meta.mute=false`); H.start();
if (!call(`!!AU.ac&&!!AU.ambL`)) { console.log('ÉCHEC : l’AudioContext factice n’a pas été pris (AU.ac / AU.ambL absents) — le test ne mesure rien'); process.exit(1); }
console.log(`code : ${REF ? 'git ' + REF : 'arbre de travail'} — nœuds créés par auInit : ${Object.entries(NODES).map(([k, v]) => k + '=' + v).join(' ')}`);

/* trois mesures du vrai ordonnanceur (la palette bascule au début d'une mesure) */
let step = 0, t = 0;
const mesures = n => { for (let i = 0; i < 16 * n; i++) { call(`schedStep(${step},${t})`); step++; t += call('STEP'); } };
const NISL = call('NISL');
let fails = 0;
for (let k = 1; k <= NISL; k++) {
  if (k > 1) { call(`transStart()`); const n = H.steps(400, () => call(`G.state==='play'`)); if (call(`G.state`) !== 'play' || call(`G.isl`) !== k) { console.log(`  ÉCHEC passage vers l’îlot ${k} : état ${call('G.state')}, îlot ${call('G.isl')} après ${n} pas`); fails++; break; } }
  mesures(3);
  const D = JSON.parse(call(`JSON.stringify((()=>{const b=ISL[G.isl-1],m=biomeMix(G.p.x,G.p.y),w={};for(const q in PAL){let s=0;for(const e of m)if(e.b===q)s+=e.w;w[q]=s;}
    const aw={};for(const a in AMB)aw[a]=0;for(const q in PAL)aw[PAL[q].amb]+=w[q];const amb={};for(const a in AMB)amb[a]=[AU.ambL[a].gain.last,AMB[a][3]*aw[a]];
    const aud={};for(const q in PAL)aud[q]=musW(q);
    return {b,isl:G.isl,bio:AU.bio,pal:AU.pal===PAL[b],bm:JSON.stringify(AU.bm)===JSON.stringify(m),w,aud,amb,a:PAL[b].amb,lvl:AMB[PAL[b].amb][3]};})())`));
  const err = [];
  for (const q in D.w) if (Math.abs(D.aud[q] - D.w[q]) > 1e-12) err.push(`poids audio de ${q} ${D.aud[q]} ≠ biomeMix ${D.w[q]}`);
  if (!D.bm) err.push('AU.bm n’est pas biomeMix(G.p)');
  for (const a in D.amb) if (Math.abs(D.amb[a][0] - D.amb[a][1]) > 1e-12) err.push(`nappe ${a} : ${D.amb[a][0]} ≠ AMB × poids ${D.amb[a][1]}`);
  if (D.w[D.b] !== 1) err.push(`le biome de l’îlot pèse ${D.w[D.b]} dans biomeMix`);
  if (D.aud[D.b] !== 1) err.push(`poids audio du biome de l’îlot ${D.aud[D.b]} (attendu 1)`);
  if (!D.pal || D.bio !== D.b) err.push(`palette musicale : AU.bio=${D.bio}, AU.pal ${D.pal ? '=' : '≠'} PAL.${D.b}`);
  if (Math.abs(D.amb[D.a][0] - D.lvl) > 1e-12) err.push(`la nappe « ${D.a} » de l’îlot joue à ${D.amb[D.a][0]} (attendu ${D.lvl})`);
  for (const a in D.amb) if (a !== D.a && D.amb[a][0] !== 0) err.push(`la nappe « ${a} » d’un autre biome joue (${D.amb[a][0]})`);
  if (err.length) { fails++; console.log(`  ÉCHEC îlot ${k} (${D.b}) : ${err.slice(0, 4).join(' ; ')}`); }
  else console.log(`  ok îlot ${k} (${D.b}) : poids audio = biomeMix (${D.b} 1), palette PAL.${D.b}, nappe « ${D.a} » à ${D.lvl}, les autres muettes`);
}
console.log(`${NISL} îlots, ${fails} en échec`);
console.log(fails ? 'ECHEC' : 'TOUT PASSE');
process.exit(fails ? 1 : 0);
