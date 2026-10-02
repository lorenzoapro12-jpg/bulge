'use strict';
/* =========================================================
   Garde-fou du RYTHME (g2.js) — « trop lent, peu dynamique, ennemis pas amusants, pas de sensation de progression »,
   02/10/2026.

   Ce que ce test défend :
     R1. les temps morts d'un îlot (arrivée, pauses entre vagues, avant le boss, îlot nettoyé : aucun ennemi à combattre)
         durent moins de TMORT secondes par îlot (avant : 10,5 s ; maintenant 5,3 s) — partie assistée, îlots 1 à 3 ;
     R2. la bulle est vive : vitesse ≥ VMIN unités/s (avant : 195) et cadence de tir ≥ TIRMIN tirs/s (avant : 4,3) ;
     R3. tuer vite paie : une SÉRIE (kills ou proies à moins de 1,5 s d'écart) multiplie le score — le 10ᵉ kill d'une
         série rapporte au moins 1,5 × le premier (avant : pas de série, tous égaux) ;
     R4. la mite n'est plus un pion qui avance : à portée, elle BONDIT (pointe de vitesse ≥ 1,8 × son allure médiane ;
         avant : ×1,04, elle glissait droit sur toi).

   node test/rythme.js                arbre de travail
   node test/rythme.js --ref=<commit> code d'un commit (avant le correctif : R1 à R4 doivent ECHOUER)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
const TMORT = 6.5, VMIN = 240, TIRMIN = 6;

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

/* ================= R1 : temps morts par îlot ================= */
{
  const H = L.mkGame({ ref: REF, seed: 4242 });
  H.win.__SIM_PICK = c => c[0];
  H.ai(true); H.call('window.__SIM_BOOST=4'); H.start();
  const mort = {}, MORT = new Set(['arrive', 'pause', 'preboss', 'clear']);
  H.steps(60 * 60 * 15, () => {
    const s = H.call("G.state==='play'?G.isl+':'+G.ph:''");
    if (s) { const [k, ph] = s.split(':'); if (MORT.has(ph)) mort[k] = (mort[k] || 0) + 1; }
    return H.call('G.isl>3||G.state==="end"');
  });
  const ks = ['1', '2', '3'].filter(k => mort[k]);
  const sec = ks.map(k => mort[k] / 60);
  check(`R1 temps morts d'un îlot (arrivée, pauses, avant le boss, nettoyé) < ${TMORT} s`,
    ks.length === 3 && sec.every(s => s < TMORT), ks.map((k, i) => `îlot ${k} : ${sec[i].toFixed(1)} s`).join(' · ') || 'aucun îlot joué');
}

/* ================= R2 : vitesse et cadence de tir ================= */
{
  const H = L.mkGame({ ref: REF, seed: 11 });
  H.start(); H.call(`G.state='play';G.ph='essai';G.en=[];G.eb=[];G.p.inv=1e9;window.__SIM_INPUT=function(){G.inX=window.__IX;G.inY=window.__IY;G.aimMan=false;};`);
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    H.call(`G.p.x=0;G.p.y=0;G.p.vx=G.p.vy=0;G.p.dashing=0;`); H.win.__IX = Math.cos(a); H.win.__IY = Math.sin(a);
    H.steps(15); const x0 = H.call('G.p.x'), y0 = H.call('G.p.y'); H.steps(30);
    v = Math.max(v, Math.hypot(H.call('G.p.x') - x0, H.call('G.p.y') - y0) * 2);
  }
  H.win.__IX = 0; H.win.__IY = 0;
  H.call(`G.p.x=0;G.p.y=0;const e=mkEnemy(ETL[0],0,-180,{spawn:0});e.hp=e.mhp=1e9;window.__NB=0;const pb=pbul;pbul=function(){window.__NB++;return pb.apply(this,arguments);};`);
  H.call('(function(){const e=G.en[0];const u=e.d;e.d=Object.assign({},u,{spd:0});})()');
  const tient = () => H.call('G.en[0].x=G.p.x;G.en[0].y=G.p.y-180;G.en[0].vx=G.en[0].vy=0;');   /* le recul des impacts l'éloignerait hors de portée */
  for (let i = 0; i < 60; i++) { H.steps(1); tient(); }
  H.call('window.__NB=0'); for (let i = 0; i < 180; i++) { H.steps(1); tient(); }
  const tirs = H.call('window.__NB') / 3;
  check(`R2 la bulle est vive : vitesse ≥ ${VMIN} u/s et ≥ ${TIRMIN} tirs/s`, v >= VMIN && tirs >= TIRMIN,
    `vitesse ${v.toFixed(0)} u/s ; ${tirs.toFixed(1)} tirs/s`);
}

/* ================= R3 : série ================= */
{
  const H = L.mkGame({ ref: REF, seed: 21 });
  H.start(); H.call(`G.state='play';G.ph='essai';G.en=[];G.eb=[];G.p.inv=1e9;window.__SIM_INPUT=function(){G.inX=G.inY=0;};`);
  const gains = [];
  for (let i = 0; i < 10; i++) {
    const s0 = H.call('G.score');
    H.call(`killEnemy(mkEnemy(ETL[0],G.p.x+300,G.p.y+300,{spawn:0}))`);
    gains.push(H.call('G.score') - s0);
    H.steps(30);
  }
  check('R3 une série paie : le 10ᵉ kill rapide rapporte ≥ 1,5 × le premier', gains[9] >= 1.5 * gains[0],
    `gains : ${gains.join(', ')} ; série affichée : ${H.call("typeof G.combo==='number'?G.combo:'absente'")}`);
}

/* ================= R4 : la mite bondit ================= */
{
  const H = L.mkGame({ ref: REF, seed: 31 });
  H.start(); H.call(`G.state='play';G.ph='essai';G.en=[];G.eb=[];G.p.inv=1e9;G.p.fireI=1e9;window.__SIM_INPUT=function(){G.inX=G.inY=0;};`);
  H.call(`(function(){const e=mkEnemy('mite',G.p.x+230,G.p.y,{spawn:0,age:0});e.hp=e.mhp=1e9;window.__M=e;})()`);
  /* allure = déplacement par pas, hors contact avec la bulle (qui la repousse) ; replacée à 230 si elle s'éloigne */
  const vs = [], pos = () => H.call('[window.__M.x,window.__M.y,Math.hypot(window.__M.x-G.p.x,window.__M.y-G.p.y)-window.__M.r-G.p.r]');
  let [x, y, g] = pos();
  for (let i = 0; i < 360; i++) {
    H.steps(1);
    if (H.call('window.__M.dead')) break;
    const [nx, ny, ng] = pos();
    if (g > 8 && ng > 8) vs.push(Math.hypot(nx - x, ny - y));
    if (ng > 300) H.call('window.__M.x=G.p.x+230;window.__M.y=G.p.y;window.__M.vx=window.__M.vy=0;');
    [x, y, g] = pos();
  }
  const m = med(vs), mx = Math.max(...vs);
  check('R4 la mite bondit : pointe de vitesse ≥ 1,8 × son allure médiane', vs.length > 60 && mx >= 1.8 * m,
    `${vs.length} pas ; allure médiane ${m.toFixed(2)} u/pas, pointe ${mx.toFixed(2)} u/pas (×${(mx / m).toFixed(2)})`);
}

console.log(`test/rythme.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
