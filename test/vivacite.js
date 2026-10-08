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
         cible ; crit et graze existent, bridés par can() ;
     V3. CARTES : une carte chiffre son effet (« Cadence 6,0 → 7,2 tirs/s », calculé sur une copie : le joueur n'est jamais
         touché) ; l'écran de fin raconte la partie (meilleure série et son record gardé dans meta, esquives parfaites,
         gonflements, power-ups) ;
     V4. CRIT : un critique se voit (tir doré, anneau doré, « ×2,5 »), base 6 % ; une esquive parfaite déclenche la
         Contre-attaque (75 pas de tirs tous critiques, cadence ≥ 1,3 ×) ; le boss prend le critique décidé au tir.

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

/* ================= V3 : CARTES =================
   une carte dit ce qu'elle change en chiffres (avant → après, calculés sur une COPIE du joueur) ; l'écran de fin raconte
   la partie (meilleure série et son record, esquives parfaites, gonflements, power-ups). */
check('V3 la carte Surcadence chiffre son effet (« Cadence 6,0 → 7,2 tirs/s »), affiché sur la carte', () => {
  const H = arene(4251);
  const s = H.call('cardDelta(CARDS.rapid.u)');
  H.noSim('G.choices=[{k:"b",u:CARDS.rapid.u},{k:"b",u:CARDS.homing.u},{k:"p",u:CARDS.verre.u}];G.state="pick";renderPick();');
  const html = H.doc.getElementById('evoCards').innerHTML, cl = (html.match(/class="dl"/g) || []).length;
  return { ok: /Cadence\s\d+,\d\s→\s\d+,\d\stirs\/s/.test(s) && cl === 2 && html.includes(s) && !/undefined|NaN/.test(html), detail: '« ' + s.replace(/<[^>]+>/g, '') + ' », ' + cl + ' ligne(s) chiffrée(s) sur 3 cartes (Tête chercheuse n’en a pas)' };
});
check('V3 cardDelta ne touche jamais au joueur (toutes les cartes), au plus deux lignes, ni « undefined » ni « NaN »', () => {
  const H = arene(4252);
  const r = J(H, `(()=>{const bad=[],txt=[];let n=0;for(const id in CARDS){const a=JSON.stringify(G.p),s=cardDelta(CARDS[id].u);if(JSON.stringify(G.p)!==a)bad.push(id);
    if(s){n++;txt.push(id+': '+s.replace(/<[^>]+>/g,''));if(/undefined|NaN/.test(s)||s.split(' · ').length>2)bad.push(id+'!');}}return JSON.stringify({bad,n,tot:Object.keys(CARDS).length,ex:txt.filter(t=>/^(heavy|twin|colosse|crit):/.test(t))});})()`);
  return { ok: !r.bad.length && r.n >= 15, detail: r.n + ' cartes chiffrées sur ' + r.tot + (r.bad.length ? ', FAUTIVES : ' + r.bad.join(', ') : '') + ' ; ' + r.ex.join(' | ') };
});
check('V3 compteurs de la partie : un gonflement compte (G.gonN), un power-up ramassé compte (G.puN)', () => {
  const H = arene(4253);
  const r = J(H, `(()=>{G.state='play';G.p.gauge=1;tryGonfle();takePU({k:'rapid'});return JSON.stringify({g:G.gonN,p:G.puN});})()`);
  return { ok: r.g === 1 && r.p === 1, detail: 'gonflements ' + r.g + ', power-ups ' + r.p };
});
check('V3 record de série : endRun le garde (meta.bestCombo), la sauvegarde le rend ; l’écran de fin montre série, esquives, gonflements, power-ups', () => {
  const H = arene(4254);
  H.call('G.comboMx=12;G.perfs=3;G.gonN=2;G.puN=5;'); H.noSim('endRun(false)'); H.advance(1000);
  const best = H.call('meta.bestCombo'), nc = H.call('!!G.newCombo'), html = H.doc.getElementById('endStats').innerHTML;
  const H2 = L.mkGame({ ref: REF, seed: 4255, storage: { bulge3_meta: JSON.stringify({ runs: 3, bestCombo: 15 }) } }), relu = H2.call('meta.bestCombo');
  const tuile = (l, v) => new RegExp('<span class="l">' + l + '</span><span class="v">' + v + '</span>').test(html);
  const ok = best === 12 && nc && relu === 15 && tuile('Meilleure série', 12) && /Record/.test(html) && tuile('Esquives parfaites', 3) && tuile('Gonflements', 2) && tuile('Power-ups', 5) && !/undefined|NaN/.test(html);
  return { ok, detail: 'meta.bestCombo ' + best + ' (nouveau ' + nc + '), relu de la sauvegarde ' + relu + ' ; fin : ' + html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(-110) };
});

/* ================= V4 : CRIT =================
   un critique se voit (tir doré, plus gros, anneau doré à l'impact, « ×2,5 » sur un kill) ; base 6 % ; CONTRE-ATTAQUE :
   une esquive parfaite rend critiques tous les tirs des 75 pas qui suivent, cadence ×1/0,7 (≥ 1,3 ×). */
/* une cible immortelle tenue à 180 au-dessus de la bulle (le motif R2 de test/rythme.js) ; les tirs sont comptés à la sortie */
function cible(seed) {
  const H = arene(seed);
  H.call(`G.state='play';G.ph='essai';G.p.fireT=0;G.p.x=G.p.y=0;const e=mkEnemy(ETL[0],0,-180,{spawn:0,age:0});e.hp=e.mhp=1e9;e.d=Object.assign({},e.d,{spd:0});window.__E=e;
    window.__B=[];const __pb=pbul;pbul=function(){const b=__pb.apply(this,arguments);window.__B.push(b);return b;};`);
  const tient = () => H.call('window.__E.x=G.p.x;window.__E.y=G.p.y-180;window.__E.vx=window.__E.vy=0;G.p.inv=1e9;');
  H.tenir = n => { for (let i = 0; i < n; i++) { H.steps(1); tient(); } };
  return H;
}
check('V4 un critique se voit : tir doré (crit), anneau doré à l’impact, e.crit posé ; kill critique = « ×2,5 » ; base 6 %', () => {
  const H = cible(4256);
  H.call('G.p.crit=1;'); H.tenir(40);
  const r = J(H, `(()=>{const b=window.__B[0]||{},e=window.__E;return JSON.stringify({n:window.__B.length,crit:b.crit,col:b.col,isGd:b.col===COL.gd,ec:e.crit,eh:e.hitT,ring:G.fx.some(f=>f.ty===1&&f.col===COL.gd)});})()`);
  const k = J(H, `(()=>{G.tx=[];const e=mkEnemy(ETL[0],G.p.x+120,G.p.y,{spawn:0,age:0});hurtEnemy(e,e.hp*2,0,0,true,true);const t=G.tx.find(t=>t.col===COL.gd);return JSON.stringify({t:t?t.s:null,base:mkPlayer().crit});})()`);
  return { ok: r.n > 0 && r.crit === true && r.isGd && r.ec != null && r.ec === r.eh && r.ring && k.t === '×2,5' && k.base === .06,
    detail: r.n + ' tirs, 1ᵉʳ : crit=' + r.crit + ' couleur ' + r.col + ' ; e.crit ' + r.ec + ' (touché à ' + r.eh + '), anneau doré ' + r.ring + ' ; texte du kill ' + k.t + ' ; base ' + k.base };
});
check('V4 Contre-attaque : après une esquive parfaite (P.crit = 0), tous les tirs des 75 pas suivants sont critiques', () => {
  const H = cible(4257);
  H.call('G.p.crit=0;'); H.tenir(20); H.call('window.__B=[];G.p.perf=0;perfect(G.p.x,G.p.y);');
  H.tenir(75); const B = J(H, 'JSON.stringify(window.__B.map(b=>!!b.crit))'), toast = H.call('G.toasts.map(t=>t.s).join(" | ")');
  H.call('window.__B=[];'); H.tenir(60); const apres = J(H, 'JSON.stringify(window.__B.map(b=>!!b.crit))');
  return { ok: B.length >= 6 && B.every(Boolean) && apres.length > 0 && !apres.some(Boolean) && /Contre-attaque/.test(toast), detail: B.filter(Boolean).length + ' / ' + B.length + ' tirs critiques pendant la Contre-attaque, ' + apres.filter(Boolean).length + ' / ' + apres.length + ' après ; toast : ' + toast };
});
/* sur 180 pas (3 s, comme R2), et en PÉRIODE (écart moyen entre le premier et le dernier tir) plutôt qu'en compte : sur
   60 pas, la phase du premier tir décide d'un tir de plus ou de moins. L'intervalle ×0,75 du plan ne donne que ×1,29 (la
   période vaut fireI × 0,75 + 1 pas) : ×0,7 donne ×1,37. */
check('V4 Contre-attaque : cadence ≥ 1,3 × sur une cible tenue (période moyenne des tirs, 180 pas)', () => {
  const H = cible(4258), per = () => { const t = J(H, 'JSON.stringify(window.__B.map(b=>b.__t))'); return t.length > 1 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 1e9; };
  H.call('const __pb2=pbul;pbul=function(){const b=__pb2.apply(this,arguments);b.__t=G.t;return b;};');
  H.call('G.p.crit=0;G.p.ctr=0;'); H.tenir(30); H.call('window.__B=[];'); H.tenir(180); const p0 = per(), n0 = H.call('window.__B.length');
  H.tenir(30); H.call('window.__B=[];'); for (let i = 0; i < 180; i++) { H.call('G.p.ctr=60;'); H.tenir(1); } const p1 = per(), n1 = H.call('window.__B.length');
  return { ok: n0 > 1 && n1 > 1 && p0 >= 1.3 * p1, detail: 'sans : ' + n0 + ' tirs, un toutes les ' + p0.toFixed(2) + ' pas ; avec : ' + n1 + ' tirs, un toutes les ' + p1.toFixed(2) + ' pas (×' + (p0 / p1).toFixed(2) + ')' };
});
check('V4 boss : hurtBoss(d, quiet, true) fait ×2,5 et pose un anneau doré ; hurtBoss(d, quiet, false) ne critique jamais', () => {
  const H = L.mkGame({ ref: REF, seed: 4259 }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(30); H.call("G.en=[];G.marks=[];G.wave=3;G.ph='preboss';G.phT=99;G.pickMid=G.isl;G.p.inv=1e9;");
  H.steps(200, () => H.call('!!G.boss&&G.boss.spawn<=0'));
  const r = J(H, `(()=>{const B=G.boss;B.stun=0;G.p.crit=1;G.fx=[];let h=B.hp;hurtBoss(1,true,false);const dN=h-B.hp;h=B.hp;hurtBoss(1,true,true);const dC=h-B.hp;
    return JSON.stringify({dN,dC,ring:G.fx.some(f=>f.ty===1&&f.col===COL.gd)});})()`);
  return { ok: r.dN === 1 && r.dC === 2.5 && r.ring, detail: 'sans critique ' + r.dN + ', critique ' + r.dC + ', anneau doré ' + r.ring };
});

if (LONG) { /* réservé : passe d'équilibrage de COURBE */ }

console.log('test/vivacite.js — ' + (REF ? 'code ' + REF : 'arbre de travail'));
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'VIVACITÉ : TOUT PASSE' : 'VIVACITÉ : ECHEC');
process.exit(all ? 0 : 1);
