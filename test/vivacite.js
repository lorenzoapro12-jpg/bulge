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
     V5. TEMPO : temps morts d'un îlot ≤ 4,3 s (5,3 s avant ; pilote assisté comme R1) ; bulle à ≥ 290 u/s, dash rechargé
         en ≤ 45 pas ; un ennemi éclot en 14 pas (24 avant), sa marque au sol dure 30 pas (24 pour des proies) ; le boss
         entre en 80 pas (110) et change de phase en 55 (80) ; l'îlot nettoyé rend son segment à 40 pas (55) ;
     V6. VISÉE : le tir automatique préfère l'ennemi qu'il peut toucher (ligne de tir libre de tout obstacle solide), sinon
         le plus proche ; il change de cible dès que la sienne meurt ; un tireur hors de l'écran ne tire pas et revient
         ≥ 2 × plus vite ; un tir de base ne pousse plus l'ennemi que de ≤ 0,45 u/pas (1,2 avant).

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

/* ================= V5 : TEMPO =================
   moins de temps morts : arrivée, pauses, avant le boss, apparitions, entrée du boss et changement de phase ; bulle plus vive. */
check('V5 temps morts d’un îlot ≤ 4,3 s (arrivée, pauses, avant le boss, nettoyé ; pilote assisté comme R1, îlots 1 à 3)', () => {
  const H = L.mkGame({ ref: REF, seed: 4242 }); H.win.__SIM_PICK = c => c[0];
  H.ai(true); H.call('window.__SIM_BOOST=4'); H.start();
  const mort = {}, MORT = new Set(['arrive', 'pause', 'preboss', 'clear']);
  H.steps(60 * 60 * 15, () => {
    const s = H.call("G.state==='play'?G.isl+':'+G.ph:''");
    if (s) { const [k, ph] = s.split(':'); if (MORT.has(ph)) mort[k] = (mort[k] || 0) + 1; }
    return H.call('G.isl>3||G.state==="end"');
  });
  const sec = ['1', '2', '3'].map(k => (mort[k] || 0) / 60);
  return { ok: sec.every(s => s > 0 && s <= 4.3), detail: sec.map((s, i) => 'îlot ' + (i + 1) + ' : ' + s.toFixed(2) + ' s').join(' · ') };
});
check('V5 la bulle est plus vive : ≥ 290 u/s, dash rechargé en ≤ 45 pas', () => {
  const H = arene(4263);
  const r = J(H, 'JSON.stringify({v:mkPlayer().spd*60,d:mkPlayer().dashMax})');
  return { ok: r.v >= 290 && r.d <= 45, detail: 'vitesse ' + r.v.toFixed(0) + ' u/s, dash ' + r.d + ' pas' };
});
check('V5 apparition : marque au sol 30 pas (24 pour des proies), puis l’ennemi éclot en 14 pas', () => {
  const H = arene(4264);
  const r = J(H, `(()=>{G.wq={left:9,n:9,el:99,eld:true,prey:0,nextT:0};G.marks=[];spawnGroup();const m=G.marks[0]||{};
    const k0=G.isl;G.isl=4;G.wq={left:0,n:9,el:99,eld:true,prey:5,nextT:0};G.marks=[];spawnGroup();const q=G.marks[0]||{};G.isl=k0;G.marks=[];
    return JSON.stringify({m:m.max,mp:!!m.prey,q:q.max,qp:!!q.prey,s:mkEnemy('spread',G.p.x+300,G.p.y).spawn});})()`);
  return { ok: r.m === 30 && !r.mp && r.q === 24 && r.qp && r.s === 14, detail: 'marque ' + r.m + ' pas, de proies ' + r.q + ' pas (proie ' + r.qp + ') ; éclosion ' + r.s + ' pas' };
});
check('V5 boss : entrée en 80 pas, changement de phase en 55 ; îlot nettoyé : le segment revient à 40 pas', () => {
  const H = arene(4265);
  const r = J(H, `(()=>{spawnBoss();const s=G.boss.spawn;bossPhase(2);const t=G.boss.trans;G.boss=null;G.freeze=0;G.p.seg=G.p.segMax-1;islClear();window.__s0=G.p.seg;return JSON.stringify({s,t});})()`);
  let n = 0; for (; n < 120 && H.call('G.p.seg===window.__s0'); n++) H.steps(1);
  return { ok: r.s === 80 && r.t === 55 && n === 40, detail: 'entrée ' + r.s + ' pas, phase ' + r.t + ' pas ; segment rendu après ' + n + ' pas' };
});

/* ================= V6 : VISÉE =================
   des tirs qui tuent au lieu de pousser : le tir automatique vise ce qu'il peut toucher et change de cible aussitôt ;
   un tireur hors de l'écran revient sans tirer ; le recul d'un tir de base est léger. */
check('V6 le tir automatique préfère l’ennemi à découvert (330 u) à celui caché derrière un massif (200 u) ; seul, le caché est visé', () => {
  const H = arene(4266);
  const r = J(H, `(()=>{const P=G.p,hw=W/2/G.zoom,hh=H/2/G.zoom;
    const free=(x,y,r)=>Math.hypot(x,y)<PR-60&&!pointHit(x,y,r)&&!wallNear(x,y,r);
    const clr=(x0,y0,x1,y1,r)=>{const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/4);for(let k=0;k<=n;k++){const t=k/n;if(pointHit(x0+(x1-x0)*t,y0+(y1-y0)*t,r))return false;}return true;};
    for(let k=1;k<=8;k++){if(k>1){genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph='pause';G.phT=-1e9;}
      for(let cx=-3;cx<=3;cx++)for(let cy=-3;cy<=3;cy++){const c=getChunk(cx,cy);if(!c)continue;
        for(const o of c.obs){if(o.brk||o.gone)continue;
          for(let i=0;i<16;i++){const u=i*TAU/16,ux=Math.cos(u),uy=Math.sin(u),ax=o.cx-ux*100,ay=o.cy-uy*100,ex=ax+ux*200,ey=ay+uy*200;
            if(!free(ax,ay,P.r+6)||!free(ex,ey,20))continue;
            for(let j=0;j<32;j++){const v=j*TAU/32,bx=ax+Math.cos(v)*330,by=ay+Math.sin(v)*330;
              if(Math.abs(bx-ax)>hw-30||Math.abs(by-ay)>hh-30||!free(bx,by,20)||!clr(ax,ay,bx,by,4))continue;
              const q=pointHit(o.cx,o.cy,2);P.x=ax;P.y=ay;P.vx=P.vy=0;G.cx=ax;G.cy=ay;G.en=[];
              const e1=mkEnemy('mite',ex,ey,{spawn:0,age:0}),e2=mkEnemy('mite',bx,by,{spawn:0,age:0});
              G.tgtT=0;aimUpdate();const a=G.tgt===e2?'découvert':G.tgt===e1?'caché':String(G.tgt);
              G.en=G.en.filter(e=>e!==e2);G.tgtT=0;aimUpdate();const b=G.tgt===e1?'caché':String(G.tgt);
              return JSON.stringify({k,obs:o.wall?'falaise':'rocher R '+Math.round(o.R),solide:!!q&&!q.brk,a,b});}}}}}
    return 'null';})()`);
  if (!r) return { ok: false, detail: 'aucune scène trouvée (massif solide entre la bulle et un ennemi, l’autre à découvert)' };
  return { ok: r.solide && r.a === 'découvert' && r.b === 'caché', detail: 'îlot ' + r.k + ', ' + r.obs + ' : les deux à l’écran, visé ' + r.a + ' ; sans l’ennemi à découvert, visé ' + r.b };
});
check('V6 la cible meurt : la visée passe à l’ennemi suivant dès le pas d’après', () => {
  const H = arene(4267);
  const t0 = H.call(`(()=>{const P=G.p;G.cx=P.x;G.cy=P.y;const a=mkEnemy('mite',P.x+150,P.y,{spawn:0,age:0}),b=mkEnemy('mite',P.x-260,P.y+40,{spawn:0,age:0});a.cd=b.cd=1e9;
    window.__A=a;window.__B=b;G.tgtT=0;aimUpdate();const ok=G.tgt===a;G.tgtT=5;killEnemy(a);G.freeze=0;return ok;})()`);
  H.steps(1);
  const t1 = H.call('G.tgt===window.__B?"l’ennemi vivant":G.tgt===window.__A?"la cible morte":String(G.tgt)');
  return { ok: t0 && t1 === 'l’ennemi vivant', detail: 'avant : ' + (t0 ? 'la plus proche visée' : 'visée inattendue') + ' ; un pas après sa mort : ' + t1 };
});
check('V6 un Tireur hors de l’écran ne tire pas (cd forcé à 0, 240 pas) et revient ≥ 2 × plus vite qu’à l’écran', () => {
  const H = arene(4268);
  /* un couloir dégagé presque horizontal (la vue est plus large que haute) depuis la bulle, au centre de l'îlot */
  const a = J(H, `(()=>{const P=G.p;P.x=P.y=0;G.cx=G.cy=0;for(let i=0;i<40;i++){const a=(i&1?Math.PI:0)+((i>>1)&1?-1:1)*(i>>2)*.06,ux=Math.cos(a),uy=Math.sin(a);let ok=true;
      for(let s=0;s<=780&&ok;s+=8){const x=ux*s,y=uy*s;if(Math.hypot(x,y)>PR-60||pointHit(x,y,40)||wallNear(x,y,40))ok=false;}if(ok)return String(a);}return 'null';})()`);
  if (a == null) return { ok: false, detail: 'aucun couloir dégagé' };
  const pin = 'G.p.x=G.p.y=0;G.p.vx=G.p.vy=0;G.cx=G.cy=0;G.p.inv=1e9;';
  /* 1. tenu à 700 u (hors de l'écran) 240 pas, cd forcé à 0 : aucun tir */
  H.call(`G.en=[];G.eb=[];${pin}window.__T=mkEnemy('spread',Math.cos(${a})*700,Math.sin(${a})*700,{spawn:0,age:0});`);
  for (let i = 0; i < 240; i++) { H.call(`${pin}{const e=window.__T;e.x=Math.cos(${a})*700;e.y=Math.sin(${a})*700;e.vx=e.vy=0;e.cd=0;}`); H.steps(1); }
  const tirs = H.call('G.eb.length');
  /* 2. distance gagnée en 40 pas, au repos au départ : à 440 u (à l'écran) puis à 700 u (hors de l'écran) */
  const appr = d0 => { H.call(`G.en=[];G.eb=[];${pin}window.__T=mkEnemy('spread',Math.cos(${a})*${d0},Math.sin(${a})*${d0},{spawn:0,age:0});`);
    for (let i = 0; i < 40; i++) { H.call(`${pin}window.__T.cd=0;`); H.steps(1); }
    return d0 - H.call('Math.hypot(window.__T.x,window.__T.y)'); };
  const dIn = appr(440), dOut = appr(700);
  return { ok: tirs === 0 && dOut >= 2 * dIn && dIn > 5, detail: 'hors de l’écran : ' + tirs + ' tir(s) ennemi(s) en 240 pas ; en 40 pas, ' + dOut.toFixed(1) + ' u gagnés hors de l’écran contre ' + dIn.toFixed(1) + ' à l’écran (×' + (dOut / dIn).toFixed(2) + ')' };
});
check('V6 un tir de base (r 4,5) ne pousse l’ennemi que de ≤ 0,45 u/pas', () => {
  const H = arene(4269);
  H.call(`G.p.crit=0;{const e=mkEnemy('spread',G.p.x+160,G.p.y,{spawn:0,age:0});e.cd=1e9;e.hp=e.mhp=100;e.d=Object.assign({},e.d,{spd:0});window.__E=e;
    const b=pbul(e.x-e.r-6,e.y,0,{pierce:0,rico:0,split:0,home:0});window.__R=b.r;}`);
  let v = 0; for (let i = 0; i < 4; i++) { H.steps(1); v = Math.max(v, H.call('Math.hypot(window.__E.vx,window.__E.vy)')); }
  const hp = H.call('window.__E.hp'), r = H.call('window.__R');
  return { ok: hp < 100 && r === 4.5 && v <= .45, detail: 'tir r ' + r + ', vie ' + hp.toFixed(1) + '/100 ; vitesse donnée ' + v.toFixed(3) + ' u/pas' };
});

if (LONG) { /* réservé : passe d'équilibrage de COURBE */ }

console.log('test/vivacite.js — ' + (REF ? 'code ' + REF : 'arbre de travail'));
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'VIVACITÉ : TOUT PASSE' : 'VIVACITÉ : ECHEC');
process.exit(all ? 0 : 1);
