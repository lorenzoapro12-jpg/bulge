'use strict';
/* =========================================================
   Garde-fou du PLAISIR (gb.js, g2.js) — « Le jeu est fluide, mais pas amusant. Le premier boss est chiant. », 08/10/2026.
   Avant : l'Essaim-Mère n'avait qu'un coup (une charge lente toutes les 2,7 s, plus trois tirs), 143 PV à user pendant
   20 à 45 s sans rien qui récompense l'adresse ; le dash ne servait qu'à fuir ; une bulle gonflait à peine une fois sur l'îlot 1.

   Ce que ce test défend :
     P1. l'Essaim-Mère enchaîne TROIS coups distincts en 20 s : charge annoncée, salve en éventail, ponte d'œufs ;
     P2. une charge qui finit dans le bord la laisse SONNÉE (≥ 1,5 s) : elle prend alors ×2 et ne blesse plus au contact ;
     P3. une charge pulvérise le rocher cassable qu'elle traverse ;
     P4. les œufs éclosent en Mites si on les laisse, s'avalent au contact, se cassent au tir ;
     P5. ESQUIVE PARFAITE : un tir traversé en dash ne coûte rien, recharge le dash et remplit la jauge ;
     P6. avec le pilote de test (sans aide), le combat dure entre BMIN et BMAX s (médiane) et chaque combat a sa fenêtre
         de punition (≥ 1 étourdissement) ;
     P7. la jauge de gonflement se remplit avant la vague finale de l'îlot 1 (pilote de test, ≥ 4 graines sur 6) : on gonfle
         au moins une fois avant le boss.

   node test/plaisir.js                arbre de travail
   node test/plaisir.js --ref=<commit> code d'un commit (avant le correctif, 9f1a02a : P1 à P7 ECHOUENT)
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
const BMIN = 15, BMAX = 40;

const checks = [];
const check = (name, fn) => { let r; try { r = fn(); } catch (e) { r = { ok: false, detail: 'exception : ' + String(e && e.message || e).slice(0, 160) }; } checks.push({ name, ok: !!r.ok, detail: r.detail }); };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
/* une partie posée devant l'Essaim-Mère (îlot 1, vagues sautées) */
function auBoss(seed) {
  const H = L.mkGame({ ref: REF, seed }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(30); H.call("G.en=[];G.marks=[];G.wave=3;G.ph='preboss';G.phT=99;G.pickMid=G.isl;");
  H.steps(200, () => H.call('!!G.boss&&G.boss.spawn<=0')); return H;
}

check('P1 l’Essaim-Mère enchaîne trois coups distincts en 20 s (charge, salve, ponte)', () => {
  const H = auBoss(7);
  H.call(`G.p.inv=1e9;window.__K={charge:0,salve:0,ponte:0};const __t=tele;tele=function(o){if(o.ty==='path')window.__K.charge++;return __t(o);};
    const __e=ebul;ebul=function(){const b=__e.apply(null,arguments);if(G.boss&&G.t!==window.__K.st){window.__K.st=G.t;window.__K.salve++;}return b;};`);
  let eggs = 0; H.steps(60 * 20, () => { eggs = Math.max(eggs, H.call('G.en.filter(e=>e.egg>0).length')); return false; });
  const K = JSON.parse(H.call('JSON.stringify(window.__K)')); K.ponte = eggs;
  return { ok: K.charge > 0 && K.salve > 0 && eggs > 0, detail: 'charges ' + K.charge + ', salves ' + K.salve + ', œufs en vol au plus ' + eggs };
});

check('P2 une charge finie dans le bord la laisse sonnée ≥ 1,5 s : dégâts ×2, plus de contact', () => {
  const H = auBoss(11);
  H.call('G.p.inv=1e9;G.p.crit=0;G.p.fireT=1e9;G.p.fireI=1e9;');
  let stunMax = 0, cur = 0;
  H.steps(60 * 20, () => { const s = H.call('G.boss.stun|0'); if (s > 0) cur++; else { stunMax = Math.max(stunMax, cur); cur = 0; } return stunMax > 0; });
  stunMax = Math.max(stunMax, cur);
  /* une nouvelle fenêtre : on la provoque, puis on mesure le coup et le contact */
  H.call('stunBoss(G.boss)');
  const hp0 = H.call('G.boss.hp'); H.call('hurtBoss(1,true)'); const dS = hp0 - H.call('G.boss.hp');
  H.call('G.p.inv=0;G.p.dashing=0;G.p.x=G.boss.x;G.p.y=G.boss.y;window.__s0=G.p.seg;'); H.steps(5); const seg = H.call('G.p.seg-window.__s0');
  H.call('G.boss.stun=0;G.p.inv=1e9;'); const hp1 = H.call('G.boss.hp'); H.call('hurtBoss(1,true)'); const dN = hp1 - H.call('G.boss.hp');
  return { ok: stunMax >= 90 && dS === 2 * dN && dN > 0 && seg === 0, detail: 'sonnée ' + stunMax + ' pas d’affilée, coup ' + dS + ' sonnée contre ' + dN + ' sinon, segments perdus au contact sonnée ' + (-seg) };
});

check('P3 une charge pulvérise le rocher cassable qu’elle traverse', () => {
  const H = auBoss(5);
  /* un rocher cassable dont la ligne de part et d'autre ne croise aucun autre obstacle */
  const r = JSON.parse(H.call(`(()=>{for(let cx=-4;cx<=4;cx++)for(let cy=-4;cy<=4;cy++){const c=getChunk(cx,cy);if(!c)continue;for(const o of collOf(c)){if(!o.brk||o.gone||Math.hypot(o.cx,o.cy)>PR-420)continue;
      for(let k=0;k<8;k++){const ux=Math.cos(k*Math.PI/4),uy=Math.sin(k*Math.PI/4);let ok=true;
        for(let s=-300;s<=300;s+=12){if(Math.abs(s)<o.R+8)continue;const x=o.cx+ux*s,y=o.cy+uy*s,q=pointHit(x,y,40);if(q&&q!==o){ok=false;break;}}
        if(ok){window.__O=o;return JSON.stringify({x:o.cx,y:o.cy,ux,uy});}}}}return 'null';})()`));
  if (!r) return { ok: false, detail: 'aucun rocher cassable dégagé trouvé' };
  H.call(`G.p.inv=1e9;G.p.fireT=1e9;G.p.fireI=1e9;const B=G.boss;B.x=${r.x - r.ux * 280};B.y=${r.y - r.uy * 280};B.vx=B.vy=0;G.p.x=${r.x + r.ux * 260};G.p.y=${r.y + r.uy * 260};B.cd=1e9;B.lay=0;chargeStart(B,20);`);
  H.steps(120, () => H.call('G.boss.st===0'));
  return { ok: H.call('!!window.__O.gone'), detail: 'rocher (R ' + Math.round(H.call('window.__O.R')) + ') ' + (H.call('!!window.__O.gone') ? 'pulvérisé' : 'intact') };
});

check('P4 œufs : éclosent si on les laisse, s’avalent au contact, se cassent au tir', () => {
  const H = auBoss(3);
  H.call('G.p.inv=1e9;G.p.fireT=1e9;G.p.fireI=1e9;G.boss.spawn=1e9;G.en=[];G.p.x=0;G.p.y=0;ponte(G.boss,4,120);');
  const pondus = H.call('G.en.filter(e=>e.egg>0).length');
  /* on s'écarte des œufs (ils se posent à 110-230 de la bulle) le temps qu'ils éclosent */
  H.call('const a=G.en.reduce((s,e)=>s+Math.atan2(e.ey,e.ex),0);G.p.x=-Math.cos(a)*500;G.p.y=-Math.sin(a)*500;');
  H.steps(150, () => { H.call('G.p.vx=G.p.vy=0;G.inX=G.inY=0;'); return false; });
  const eclos = H.call('G.en.filter(e=>!e.dead&&e.t==="mite"&&!(e.egg>0)).length');
  H.call('G.en=[];G.p.x=0;G.p.y=0;ponte(G.boss,2,600);for(const e of G.en){e.x=e.ex;e.y=e.ey;}'); H.steps(2);
  const e0 = H.call('G.eats'); H.call('const e=G.en[0];G.p.x=e.x;G.p.y=e.y;'); H.steps(2); const avale = H.call('G.eats') - e0;
  H.call('hurtEnemy(G.en.find(e=>!e.dead&&e.egg>0),99,0,0,true)'); const casse = H.call('G.en.filter(e=>!e.dead&&e.egg>0).length');
  return { ok: pondus === 4 && eclos === 4 && avale === 1 && casse === 0, detail: 'pondus ' + pondus + ', éclos en Mites ' + eclos + ', avalé ' + avale + ', restants après un tir ' + casse };
});

check('P5 esquive parfaite : un tir traversé en dash ne coûte rien, recharge le dash et remplit la jauge', () => {
  const H = L.mkGame({ ref: REF, seed: 9 }); H.win.__SIM_PICK = c => c[0]; H.start(); H.steps(30);
  H.call("G.en=[];G.marks=[];G.ph='pause';G.phT=-1e4;G.p.inv=0;G.p.gauge=0;G.p.dashT=0;G.p.x=G.p.y=0;G.p.vx=G.p.vy=0;window.__s0=G.p.seg;ebul(70,0,Math.PI,3,7);G.inX=1;G.inY=0;tryDash();");
  H.steps(14);
  const r = JSON.parse(H.call('JSON.stringify({seg:G.p.seg-window.__s0,dashT:G.p.dashT,dashMax:G.p.dashMax,gauge:G.p.gauge,perf:G.perfs||0})'));
  return { ok: r.seg === 0 && r.perf === 1 && r.dashT === 0 && r.gauge >= .1, detail: JSON.stringify(r) };
});

{
  const dur = [], stuns = [], full = [];let fini = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const H = L.mkGame({ ref: REF, seed }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {}; H.ai(false); H.start();
    try { H.call('window.__ST=0;const __s=stunBoss;stunBoss=function(B){window.__ST++;return __s(B);};'); } catch (e) { /* ancien code */ }
    let t0 = 0, plein = false, end = 0;
    for (let i = 0; i < 60 * 60 * 5; i++) { H.STEP(); H.advance(1000 / 60);
      const ph = H.call('G.ph');
      if (ph === 'wave' && H.call('G.wave<3&&G.p.gauge>=1')) plein = true;
      if (ph === 'boss' && !t0) t0 = i;
      if (t0 && (ph === 'clear' || H.call('G.state') !== 'play')) { end = i; break; } }
    if (end && H.call('G.ph') === 'clear') { fini++; dur.push((end - t0) / 60); }
    stuns.push(H.call('window.__ST|0')); full.push(plein);
  }
  check(`P6 combat de l’Essaim-Mère (pilote de test) : médiane entre ${BMIN} et ${BMAX} s, une fenêtre de punition à chaque combat`, () => {
    const m = dur.length ? med(dur) : 0;
    return { ok: fini === 6 && m >= BMIN && m <= BMAX && stuns.every(s => s >= 1), detail: 'durées ' + dur.map(d => d.toFixed(1)).join(' ') + ' s (médiane ' + m.toFixed(1) + '), étourdissements ' + stuns.join(' ') + ', fini ' + fini + '/6' };
  });
  check('P7 la jauge se remplit avant la vague finale de l’îlot 1 (≥ 4 graines sur 6)', () => {
    const n = full.filter(Boolean).length; return { ok: n >= 4, detail: n + ' / 6' };
  });
}

for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'PLAISIR : TOUT PASSE' : 'PLAISIR : ECHEC');
process.exit(all ? 0 : 1);
