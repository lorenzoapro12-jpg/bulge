'use strict';
/* =========================================================
   Garde-fou de la VIVACITÉ (g1.js, g2.js, g3.js, gb.js) — « Les ennemis ne sont pas intéressants, les tirs sont ennuyeux,
   on ne se sent pas récompensé, c'est lent », 08/10/2026.
   Avant : un petit kill secouait l'écran de 0,04 px, l'arrêt sur image ne venait que pour les gros (r ≥ 20, 40 pas d'écart),
   chaque kill jouait le même « pop », le tir sonnait ~30 dB sous la musique, le halo de mort couvrait 7 × le rayon à chaque kill.

   Ce que ce test défend (chaque changement du plan ajoute ici ses critères, écrits AVANT le code et vus en ECHEC sur 379e0fb) :
     V1. IMPACT : un kill d'Épine arrête l'image ≥ 1 pas et donne un coup de caméra ≥ 2,5 ; un kill de Mite pousse à peine
         la caméra et n'arrête rien ; dix kills dans le même pas posent au plus un halo de mort ; un tir qui touche lance des
         étincelles en trait (FX ty 7), plus des points lumineux (ty 0) ; ces traits se dessinent en UN stroke par couleur ;
     V2. SON : le tir s'entend (crête ≥ .025) ; le « pop » d'une série monte la gamme ; la touche monte vers la mort de la
         cible ; crit et graze existent, bridés par can().

   node test/vivacite.js                arbre de travail
   node test/vivacite.js --ref=<commit> code d'un commit (379e0fb : tous les critères ECHOUENT)
   node test/vivacite.js --long         en plus, la passe d'équilibrage (réservée à COURBE ; hors GARDES de headless.js)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref'), LONG = !!L.ARG('long');

const checks = [];
const check = (name, fn) => { let r; try { r = fn(); } catch (e) { r = { ok: false, detail: 'exception : ' + String(e && e.message || e).slice(0, 160) }; } checks.push({ name, ok: !!r.ok, detail: r.detail }); };
/* une arène vide et sans vague (le motif calme() de headless.js), bulle intouchable qui ne tire pas */
const calme = H => H.call('G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph="pause";G.phT=-1e9;');
function arene(seed, opts) {
  const H = L.mkGame(Object.assign({ ref: REF, seed: seed || 4242 }, opts || {})); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(30); calme(H);
  H.call('G.p.inv=1e9;G.p.fireT=1e9;G.p.vx=G.p.vy=0;G.freeze=0;G.trauma=0;G.fx=[];window.__SIM_INPUT=function(){G.inX=G.inY=0;G.aimMan=false;};');
  return H;
}
const J = (H, e) => JSON.parse(H.call(e));

/* ================= V1 : IMPACT ================= */
check('V1 un kill d’Épine pèse : arrêt sur image ≥ 1 pas et coup de caméra ≥ 2,5', () => {
  const H = arene(4242);
  const r = J(H, `(()=>{G.kx=G.ky=0;const P=G.p;killEnemy(mkEnemy('spike',P.x+200,P.y,{spawn:0,age:0}));return JSON.stringify({fz:G.freeze,k:Math.abs(G.kx||0)+Math.abs(G.ky||0)});})()`);
  return { ok: r.fz >= 1 && r.k >= 2.5, detail: 'arrêt ' + r.fz + ' pas, coup de caméra ' + r.k.toFixed(2) };
});
check('V1 un kill de Mite : coup de caméra léger (> 0, < 2,5), aucun arrêt sur image', () => {
  const H = arene(4243);
  const r = J(H, `(()=>{G.kx=G.ky=0;const P=G.p;killEnemy(mkEnemy('mite',P.x,P.y+180,{spawn:0}));return JSON.stringify({fz:G.freeze,k:Math.abs(G.kx||0)+Math.abs(G.ky||0)});})()`);
  return { ok: r.fz === 0 && r.k > 0 && r.k < 2.5, detail: 'arrêt ' + r.fz + ' pas, coup de caméra ' + r.k.toFixed(2) };
});
check('V1 dix kills dans le même pas posent un seul halo de mort (FX ty 4), plus petit qu’avant (≤ 4,5 × r)', () => {
  const H = arene(4244);
  const r = J(H, `(()=>{const P=G.p;G.fx=[];let r0=0;for(let i=0;i<10;i++){const e=mkEnemy('spread',P.x+150+i*6,P.y,{spawn:0,age:0});r0=e.r;killEnemy(e);}
    const h=G.fx.filter(f=>f.ty===4);return JSON.stringify({n:h.length,k:h.length?h[0].r/r0:0});})()`);
  return { ok: r.n === 1 && r.k <= 4.5, detail: r.n + ' halo(s), rayon ' + r.k.toFixed(1) + ' × r' };
});
check('V1 un tir qui touche un Porteur (sans le tuer) lance des étincelles en trait (ty 7), sans points lumineux (ty 0)', () => {
  const H = arene(4245);
  H.call(`(()=>{const P=G.p;const e=mkEnemy('spawner',P.x+160,P.y,{spawn:0,age:0,cd:1e9});e.hp=e.mhp=100;window.__E=e;G.fx=[];
    pbul(e.x-e.r-6,e.y,0,{dmg:1,pierce:0,rico:0,split:0,home:0});})()`);
  H.steps(4);
  const r = J(H, 'JSON.stringify({t7:G.fx.filter(f=>f.ty===7).length,t0:G.fx.filter(f=>f.ty===0).length,hp:window.__E.hp,pb:G.pb.length})');
  return { ok: r.hp < 100 && r.t7 >= 1 && r.t0 === 0, detail: 'vie ' + r.hp + '/100, ty 7 : ' + r.t7 + ', ty 0 : ' + r.t0 + ', tirs restants ' + r.pb };
});
{
  /* contexte 2D qui compte les appels qui coûtent (le reste passe au stub de test/lib.js) */
  let CNT = null;
  const cpt = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (CNT && (p === 'stroke' || p === 'drawImage' || p === 'arc') ? () => { CNT[p] = (CNT[p] || 0) + 1; } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V1 quarante étincelles en trait de deux couleurs : deux stroke(), aucun drawImage ni arc', () => {
    const H = arene(4246, { mkCtx: cpt });
    H.call('render(1,16.7)');
    H.call(`G.fx=[];for(let i=0;i<40;i++)FX({ty:7,x:G.p.x+i*2,y:G.p.y+10,vx:3,vy:1,life:8,max:8,col:i%2?'#ff3355':'#e040ff'});`);
    CNT = {}; H.call('drawFX()'); const n = CNT; CNT = null;
    const cap = H.call('ctx.lineCap');
    return { ok: (n.stroke | 0) === 2 && !n.drawImage && !n.arc && cap === 'butt', detail: 'stroke ' + (n.stroke | 0) + ', drawImage ' + (n.drawImage | 0) + ', arc ' + (n.arc | 0) + ', lineCap après : ' + cap };
  });
}

/* ================= V2 : SON =================
   osc et nz remplacés par des enregistreurs ; AU.ac factice le temps de l'appel seulement (le pas de jeu, lui, reste muet) ;
   l'horloge virtuelle avance entre deux appels pour que can() laisse passer. */
const sonore = H => H.call(`window.__O=[];window.__N=0;meta.mute=false;AU.sfx={};osc=function(d,ty,f0,f1,t,dur,vol){window.__O.push([ty,f0,f1,vol]);};nz=function(){window.__N++;};`);
const son = (H, e) => { H.advance(100); H.call('window.__O=[];AU.ac={currentTime:0};'); try { H.call(e); } finally { H.call('AU.ac=null;'); } return J(H, 'JSON.stringify(window.__O)'); };
check('V2 le tir s’entend : crête ≥ .025', () => {
  const H = arene(4247); sonore(H);
  const o = son(H, 'SFX.shoot(4.5,0)'), pk = Math.max(0, ...o.map(x => x[3]));
  return { ok: pk >= .025, detail: 'crête ' + pk + ' (' + o.length + ' oscillateur(s))' };
});
check('V2 une série de dix Mites (30 pas d’écart) : la note du « pop » monte à chaque kill', () => {
  const H = arene(4248); sonore(H); const f = [];
  for (let i = 0; i < 10; i++) {
    const o = son(H, "killEnemy(mkEnemy('mite',G.p.x+200,G.p.y,{spawn:0}))"), p = o.find(x => x[0] === 'sine' && x[2] < x[1]);
    f.push(p ? Math.round(p[1]) : 0); H.steps(30);
  }
  return { ok: f.every((x, i) => x > 0 && (i === 0 || x > f[i - 1])), detail: 'f0 : ' + f.join(', ') + ' Hz' };
});
check('V2 trois touches sur un Porteur (100 PV, sans critique) : la note monte vers la mort', () => {
  const H = arene(4249); sonore(H);
  H.call(`G.p.crit=0;const e=mkEnemy('spawner',G.p.x+200,G.p.y,{spawn:0,age:0,cd:1e9});e.hp=e.mhp=100;window.__E=e;`);
  const f = [];
  for (let i = 0; i < 3; i++) { const o = son(H, 'hurtEnemy(window.__E,10,0,0)'), p = o.find(x => x[0] === 'triangle'); f.push(p ? Math.round(p[1]) : 0); }
  return { ok: f.every((x, i) => x > 0 && (i === 0 || x > f[i - 1])), detail: 'f0 : ' + f.join(', ') + ' Hz' };
});
check('V2 crit et graze jouent, bridés par can() (deux appels de suite = un seul son)', () => {
  const H = arene(4250); sonore(H);
  const c = son(H, 'SFX.crit();SFX.crit()'), g = son(H, 'SFX.graze();SFX.graze()');
  return { ok: c.length === 2 && g.length === 1, detail: 'crit : ' + c.length + ' oscillateur(s), graze : ' + g.length };
});

if (LONG) { /* réservé : passe d'équilibrage de COURBE */ }

console.log('test/vivacite.js — ' + (REF ? 'code ' + REF : 'arbre de travail'));
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'VIVACITÉ : TOUT PASSE' : 'VIVACITÉ : ECHEC');
process.exit(all ? 0 : 1);
