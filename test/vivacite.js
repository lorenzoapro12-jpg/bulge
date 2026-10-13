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
     V7. FLUX : la vague s'ouvre sur deux groupes en tenaille ; le groupe suivant vient 12 pas après le précédent quand il reste
         ≤ 3 ennemis (vivants + annoncés) ; plafond 8 vivants à l'îlot 1 ; 6-7 Mites, 3-4 Épines par groupe ; un groupe paraît
         à l'écran ; pilote invulnérable, graines 1 à 6 : visée sans cible ≤ 22 % du temps de vague à l'îlot 1 (~31 % avant),
         ≥ 4 ennemis hostiles à l'écran à l'îlot 3 (~3 avant) ;
     V8. MÊLÉE : une Mite à 200 u touche la bulle qui file droit à angle droit (elle s'annonce ≥ 10 pas à l'arrêt, puis bondit
         ≥ 190 u) ; l'Épine verrouille sa visée les 10 derniers pas et charge ≥ 320 u ; contre un rocher, elle reste sonnée
         (≥ 50 pas), sans danger au contact, et prend ×2 ; sonnée au bord, elle reste dans l'îlot ; le dessin annonce tout cela
         (trait blanc, trait plein, points dorés).
     V9. TIREURS : à l'îlot 3, le Tireur se plante ≥ 20 pas puis tire un éventail de 5, dans sa couleur, plus vite que la bulle ;
         il ne tire pas dans un rocher massif (il se décale ≥ 80 u) ; le Tireur d'élite verrouille sa visée les 12 derniers pas et
         tire une aiguille ≥ 13 u/pas ; un critique pendant l'annonce l'annule ; dessin : bouches blanches, visée blanche, aiguilles,
         orbes du Pulsar cerclés de blanc dans leur sprite (aucun trait par image) ;
     V10. LOURDS : un tir de la bulle détruit un orbe de Pulsar et s'arrête ; la Gatling se plante ≥ 25 pas avant sa rafale ; le
         Pulsar ne pulse qu'à ≤ 380 u, ≤ 10 orbes après une inspiration, tournés vers la bulle (brèche derrière lui), les quatre de
         devant se refermant en pince sur elle ; un critique ne coupe pas l'annonce d'un lourd ; Gatling et Pulsar attaquent dans la
         seconde qui suit leur éclosion (Tireur d'élite : recharge ≤ 30) ; l'Orbiteur tire deux coups courbes à 8 pas d'écart.
     V11. MORTS : une Épine abattue projette 4 piquants (tirs cyan de la bulle) qui touchent ses voisines, une Gatling 6 éclats ;
         un Pulsar abattu meurt dans une onde de 120 u (tirs ennemis effacés, voisin blessé) ; un Porteur se fend en 3 Mites avec
         parent ; Mite, Tireur, Tireur d'élite, Orbiteur : rien.
     V12. ABSORB : un ennemi à bout (< 20 %, < 40 % avec Appétit) et plus petit s'avale au contact sans coûter de segment, et
         clignote ; gonflée, la bulle aspire une Mite à 200 u (pas un plus gros) et file ×1,15 ; frôler un tir remplit la jauge
         de ,006 × gGain, une fois, et jamais pour un tir qui touche ; une proie ne fuit qu'à < 220 u, à ≤ ,55 × la vitesse de la bulle, s'avale à +10 ; ,35 × n
         proies par vague ; Digestion : un segment toutes les 20 absorptions.
     V13. SÉRIE : dix kills à 120 pas d'écart font une série de 10 (fenêtre 2,5 s) ; une esquive parfaite ou un obstacle cassé la
         prolongent sans compter ; à 15 en vague, un power-up d'arme (rien en combat de boss), sur un sol libre, même au plafond de
         8 power-ups ; à 40, jauge +20 % ; Emballement :
         une série de 12 donne ≥ 1,2 × la cadence, des traînées plus longues, des canons blancs ; la série s'affiche sous la bulle ;
     V14. CŒUR : le boss d'un îlot 1 à 7 laisse un cœur qui vole vers la bulle (avalé en ≤ 100 pas) : la dernière carte bonus
         monte d'un niveau (G.picks inchangé), ou la jauge se remplit ; vague sans une égratignure : jauge + ,15 ; les textes
         « jauge + » disent le vrai gain (rien gonflée, ×gGain, plafond) ; le bonus
         d'îlot nettoyé s'affiche ; dessin du cœur : 2 sprites.
     V15. ÉLITES : un modificateur (vive, blindée, volatile ; ≥ 20 % chacun) au lieu de ×3,2 PV, son nom à l'éclosion ; vive : ×1,5
         plus rapide, recharge ×1,6 ; blindée : ,2 × un tir de face, 1,5 × de dos, pas « à découvert » pour la visée ; volatile :
         sa mort arme une explosion de 110 u, 36 pas plus tard (bulle, ennemis voisins ; dash au travers : esquive parfaite) ;
         conseils justes (la vive « attaque » plus vite, la Contre-attaque dure « un instant ») ;
     V16. COURBE : le type d'âge 1 naît à FODA de sa vie, se tue en ≤ ,7 × ses tirs de base d'avant (1,1 ×) ; l'ennemi touché
         dégonfle ; allure (pilote invulnérable, premier bonus, graines 1 à 3) : îlot 1 en ≤ 50 s, îlot 4 en ≤ 120 s, ≥ 1,2 kill
         par seconde de vague à l'îlot 4, ≥ 50 % des kills à ×2 et un power-up actif ≥ 25 % du temps sur chaque îlot 1 à 6.
         --long : la passe d'équilibrage (pilote naturel, 40 min au plus par partie), jugée sur DEUX jeux de 48 graines (1-48, et
         49-96, jamais utilisé pour régler) : ≤ 50 % de victoires sur chacun, aucune mort aux îlots 1-2 dans ≥ 83 % des graines de
         chacun, ≥ 2 touches par minute de vague aux îlots 3-4, les îlots 7-8 coûtent au moins autant de touches que les îlots 3-4 aux
         parties qui les atteignent, ≥ 50 % des Gatlings de l'îlot 6 et des Pulsars de l'îlot 7 tirent avant de mourir ; et la graine
         12345 (la partie « naturelle » de headless.js) perdue. Revue du 13/10/2026 : l'ancien jeu de 12 graines (1-11 et 12345) avait
         servi à régler la difficulté ; il passait à 4 sur 12 quand les autres graines gagnaient à ~55 %.

   node test/vivacite.js                arbre de travail
   node test/vivacite.js --ref=<commit> code d'un commit (379e0fb : tous les critères ECHOUENT, sauf « V12 un tir de face qui
                                        TOUCHE… », un défaut né sur la branche : il échoue sur ccfa15b)
   node test/vivacite.js --long         en plus, la passe d'équilibrage de COURBE (97 parties, en parallèle sur les cœurs ; ~5 à
                                        10 min ; hors GARDES de headless.js)
   node test/vivacite.js --partie=<g>   une seule partie naturelle (graine g), en une ligne « PARTIE {json} » : ce que --long lance
   node test/vivacite.js --seul=V9      mise au point : seuls les critères dont le nom commence ainsi
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref'), LONG = !!L.ARG('long');

const checks = [], SEUL = L.ARG('seul');
const check = (name, fn) => { if (SEUL && !name.startsWith(SEUL)) return; let r; try { r = fn(); } catch (e) { r = { ok: false, detail: 'exception : ' + String(e && e.message || e).slice(0, 160) }; } checks.push({ name, ok: !!r.ok, detail: r.detail }); };
/* une arène vide et sans vague (le motif calme() de headless.js), bulle intouchable qui ne tire pas */
const calme = H => H.call('G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph="pause";G.phT=-1e9;');
function arene(seed, opts) {
  const H = L.mkGame(Object.assign({ ref: REF, seed: seed || 4242 }, opts || {})); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(30); calme(H);
  H.call('G.p.inv=1e9;G.p.fireT=1e9;G.p.vx=G.p.vy=0;G.freeze=0;G.trauma=0;G.fx=[];window.__SIM_INPUT=function(){G.inX=G.inY=0;G.aimMan=false;};');
  return H;
}
const J = (H, e) => JSON.parse(H.call(e));

/* ---------- une partie NATURELLE (--partie=<graine>) : le pilote sans aide, bonus au hasard (comme la partie « naturelle » de
   headless.js, que la graine 12345 rejoue à l'identique), 40 min de jeu au plus. hu : touches en vague par îlot ; ht : touches
   (tout l'îlot, boss compris) ; w : pas de vague par îlot ; lr : lourds à leur îlot (Gatling 6, Pulsar 7, Tireur d'élite 4), [morts,
   morts après avoir tiré]. Une touche : un coup qui porte (segment ou bouclier perdu). ---------- */
function partie(seed) {
  const H = L.mkGame({ ref: REF, seed }); let fin = null;
  H.win.__SIM_PICK = c => c[Math.floor(H.call('Math.random()') * c.length)]; H.win.__SIM_END = w => { fin = w; };
  H.ai(false); H.start();
  H.call(`window.__HU={};window.__HT={};window.__LR={};(function(){const _h=hurtPlayer;hurtPlayer=function(x,y){const P=G.p;if(G.state==='play'&&!P.dead&&!(P.inv>0)&&!(P.dashing>0)&&!(P.gon>0)&&!(P.pu.inv>0)){const k=G.isl;window.__HT[k]=(window.__HT[k]||0)+1;if(G.ph==='wave')window.__HU[k]=(window.__HU[k]||0)+1;}return _h(x,y);};
    if(typeof ebulE==='function'){const _b=ebulE;ebulE=function(e){e.__f=1;return _b.apply(this,arguments);};}
    const lr=(e)=>{if(e.dead||e.prey||e.age!==0)return;const k=e.t==='gatling'&&G.isl===6?'g6':e.t==='ring'&&G.isl===7?'r7':e.t==='sniper'&&G.isl===4?'s4':null;if(!k)return;const a=window.__LR[k]||(window.__LR[k]=[0,0]);a[0]++;if(e.__f)a[1]++;};
    const _k=killEnemy;killEnemy=function(e){lr(e);return _k.apply(this,arguments);};if(typeof absorb==='function'){const _a=absorb;absorb=function(e){lr(e);return _a.apply(this,arguments);};}})();`);
  const W = {}, wv = H.call("(function(){return G.state==='play'&&G.ph==='wave'?G.isl:0;})"); let n = 0;
  for (; n < 60 * 60 * 40 && fin === null; n++) { H.STEP(); H.advance(1000 / 60); const k = wv(); if (k) W[k] = (W[k] || 0) + 1; }
  return { seed, fin, isl: H.call('G.isl'), min: n / 3600, hu: J(H, 'JSON.stringify(window.__HU)'), ht: J(H, 'JSON.stringify(window.__HT)'), w: W, lr: J(H, 'JSON.stringify(window.__LR)'), picks: H.call('G.picks.join(",")') };
}
if (L.ARG('partie')) { console.log('PARTIE ' + JSON.stringify(partie(+L.ARG('partie')))); process.exit(0); }

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
  /* 2. distance gagnée en 40 pas, au repos au départ : à 440 u (à l'écran) puis à 700 u (hors de l'écran). Depuis TIREURS, un Tireur
     prêt à tirer à l'écran SE PLANTE 22 pas : à l'écran on mesure donc son allure de marche (cd 1e9) ; hors de l'écran, cd forcé à
     0 comme au 1. (il ne doit ni tirer ni se planter) */
  const appr = (d0, cd) => { H.call(`G.en=[];G.eb=[];${pin}window.__T=mkEnemy('spread',Math.cos(${a})*${d0},Math.sin(${a})*${d0},{spawn:0,age:0});`);
    for (let i = 0; i < 40; i++) { H.call(`${pin}window.__T.cd=${cd};`); H.steps(1); }
    return d0 - H.call('Math.hypot(window.__T.x,window.__T.y)'); };
  const dIn = appr(440, 1e9), dOut = appr(700, 0);
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

/* ================= V7 : FLUX =================
   pas d'écran vide : la vague s'ouvre sur deux groupes en tenaille, le groupe suivant vient avant que l'arène se vide, on
   paraît à l'écran, les groupes sont plus gros, le plafond de vivants plus haut. */
/* ailleurs : la bulle à moins de 500 u du centre (plus près du bord, le côté extérieur tombe hors de l'îlot : le groupe paraît alors
   ailleurs dans la vue, c'est voulu) */
check('V7 la vague s’ouvre sur deux groupes en tenaille (graine 4242, îlot 1 : deux marques à ≥ 2 rad l’une de l’autre vues de la bulle) ; idem ailleurs (îlots 1 à 8, bulle à < 500 u du centre) dans ≥ 85 % des cas', () => {
  const H = L.mkGame({ ref: REF, seed: 4242 }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(600, () => H.call("G.ph==='wave'&&G.phT===1"));
  const r = J(H, `(()=>{const P=G.p,M=G.marks.map(m=>Math.atan2(m.y-P.y,m.x-P.x));const d=M.length===2?Math.abs(angDiff(M[0],M[1])):0;
    let n=0,ok=0;for(let k=1;k<=8;k++){genIslet(G.seed,k);G.isl=k;islStart();G.pickIsl=k;
      for(let i=0;i<40;i++){P.x=(R()-.5)*1000;P.y=(R()-.5)*1000;if(Math.hypot(P.x,P.y)>500||pointHit(P.x,P.y,30)||wallNear(P.x,P.y,30))continue;G.cx=P.x;G.cy=P.y;G.en=[];G.marks=[];waveStart(1);
        if(G.marks.length<2)continue;n++;const a=Math.atan2(G.marks[0].y-P.y,G.marks[0].x-P.x),b=Math.atan2(G.marks[1].y-P.y,G.marks[1].x-P.x);if(Math.abs(angDiff(a,b))>=2)ok++;}}
    return JSON.stringify({ph:G.ph,m:M.length,d,n,ok});})()`);
  return { ok: r.m === 2 && r.d >= 2 && r.n >= 100 && r.ok >= .85 * r.n, detail: 'graine 4242, pas 1 de la vague : ' + r.m + ' marque(s), écart ' + r.d.toFixed(2) + ' rad ; îlots 1 à 8 : ' + r.ok + ' / ' + r.n + ' ouvertures en tenaille' };
});
check('V7 le groupe suivant vient avant que l’arène se vide (≤ 3 vivants + annoncés : 12 pas après le précédent), plafond 8 vivants à l’îlot 1 ; groupes de 6 ou 7 Mites, 3 ou 4 Épines', () => {
  const H = arene(4274);
  const r = J(H, `(()=>{const k0=G.isl,o={};G.isl=1;G.ph='wave';G.wave=1;const Q=()=>({left:9,n:9,el:99,eld:true,prey:0,nextT:1e9,th:0,gi:2,lastS:88,hit:0});
    G.wq=Q();G.marks=[];G.en=[];G.phT=95;waveTick();o.tot=G.marks.length;G.phT=100;waveTick();o.vide=G.marks.length;
    const viv=n=>{G.en=[];for(let i=0;i<n;i++)mkEnemy('mite',G.p.x+400,G.p.y,{spawn:0,cd:1e9});};
    G.wq=Q();G.wq.nextT=0;G.marks=[];viv(7);G.phT=100;waveTick();o.c7=G.marks.length;G.wq=Q();G.wq.nextT=0;G.marks=[];viv(8);waveTick();o.c8=G.marks.length;G.en=[];
    const tail=(k,t)=>{G.isl=k;let mn=99,mx=0;for(let i=0;i<300;i++){G.wq={left:99,n:99,el:999,eld:true,prey:0,nextT:0};G.marks=[];spawnGroup();const m=G.marks[0];if(m&&m.t2===t){mn=Math.min(mn,m.n);mx=Math.max(mx,m.n);}}return mn+'-'+mx;};
    o.mite=tail(1,'mite');o.spike=tail(2,'spike');G.isl=k0;G.marks=[];G.ph='pause';G.phT=-1e9;G.wq=null;return JSON.stringify(o);})()`);
  return { ok: r.tot === 0 && r.vide === 1 && r.c7 === 1 && r.c8 === 0 && r.mite === '6-7' && r.spike === '3-4',
    detail: 'arène vide, 7 pas après le dernier groupe : ' + r.tot + ' groupe, 12 pas après : ' + r.vide + ' ; 7 vivants : ' + r.c7 + ', 8 vivants : ' + r.c8 + ' ; Mites par groupe ' + r.mite + ', Épines ' + r.spike };
});
check('V7 un groupe paraît à l’écran (vue rétrécie de 40) dans ≥ 90 % des cas, jamais à moins de 300 u de la bulle (îlots 1 à 8)', () => {
  const H = arene(4275);
  const r = J(H, `(()=>{const P=G.p,o={n:0,vue:0,proche:0};for(let k=1;k<=8;k++){genIslet(G.seed,k);G.isl=k;islStart();G.pickIsl=k;G.en=[];G.eb=[];G.ph='pause';G.phT=-1e9;
    for(let i=0;i<60;i++){P.x=(R()-.5)*1100;P.y=(R()-.5)*1100;if(Math.hypot(P.x,P.y)>PR-150||pointHit(P.x,P.y,30)||wallNear(P.x,P.y,30))continue;G.cx=P.x;G.cy=P.y;
      const hw=W/2/G.zoom-40,hh=H/2/G.zoom-40;G.marks=[];G.wq={left:9,n:9,el:99,eld:true,prey:0,nextT:0};if(i&1){G.wq.th=R()*TAU;G.wq.gi=0;}spawnGroup();
      for(const m of G.marks){o.n++;if(Math.abs(m.x-G.cx)<=hw&&Math.abs(m.y-G.cy)<=hh)o.vue++;if(Math.hypot(m.x-P.x,m.y-P.y)<300)o.proche++;}}}
    G.marks=[];G.wq=null;return JSON.stringify(o);})()`);
  return { ok: r.n >= 200 && r.vue >= .9 * r.n && !r.proche, detail: r.vue + ' / ' + r.n + ' groupes à l’écran, ' + r.proche + ' à moins de 300 u' };
});
/* parties au pilote invulnérable (sans aide aux dégâts), graines 1 à 6, jusqu'à l'îlot 3 : visée sans cible (îlot 1) et
   ennemis hostiles éclos à l'écran (îlot 3), sur les pas de vague. Six graines et non trois : d'une graine à l'autre, l'îlot 3
   va de 3,3 à 6 ennemis à l'écran (le pilote court après les proies) ; sur trois, la moyenne bouge de ± 0,5. */
let FLUX = null;
/* COURBE (V16) : les graines 1 à 3 vont jusqu'au bout de l'îlot 6 ; par îlot, pas de jeu (play), pas sous un power-up chronométré
   (pu ; le bouclier attend un coup, il ne compte pas), kills en vague (wk), et par kill le multiplicateur de série (comboUp enveloppé :
   M[îlot] = {n, x2}). Le relevé ne tire aucun nombre : les îlots 1 à 3 sont les mêmes parties que pour V7. */
const flux = () => FLUX || (FLUX = [1, 2, 3, 4, 5, 6].map(seed => {
  const H = L.mkGame({ ref: REF, seed }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.ai(true); H.start(); const S = {}, KM = seed <= 3 ? 6 : 3;
  H.call(`window.__M={};(function(){const _c=comboUp;comboUp=function(e){const m=_c(e),q=window.__M[G.isl]||(window.__M[G.isl]={n:0,x2:0});q.n++;if(m>=2)q.x2++;return m;};})();`);
  H.steps(60 * 60 * 30, () => {
    const s = H.call(`(()=>{if(G.state!=='play')return '';let pu=0;for(const k in G.p.pu)if(G.p.pu[k]>0&&k!=='shield')pu=1;const w=G.ph==='wave';let n=0;
      if(w){const hw=W/2/G.zoom,hh=H/2/G.zoom;for(const e of G.en)if(!e.dead&&!e.prey&&e.spawn<=0&&!(e.egg>0)&&Math.abs(e.x-G.cx)<=hw&&Math.abs(e.y-G.cy)<=hh)n++;}
      return [G.isl,w?1:0,G.tgt?1:0,n,G.kills,pu].join(':');})()`);
    if (s) { const [k, w, t, n, ki, pu] = s.split(':').map(Number); const q = S[k] || (S[k] = { w: 0, nul: 0, on: 0, play: 0, pu: 0, wk: 0, lk: ki });
      q.play++; if (pu) q.pu++; if (w) { q.w++; if (!t) q.nul++; q.on += n; q.wk += ki - q.lk; } q.lk = ki; }
    return H.call(`G.isl>${KM}||G.state==='end'`);
  });
  S.M = J(H, 'JSON.stringify(window.__M)');
  return S;
}));
check('V7 îlot 1, pilote invulnérable, graines 1 à 6 : la visée reste sans cible ≤ 22 % du temps de vague', () => {
  const S = flux(), w = S.reduce((s, q) => s + (q[1] ? q[1].w : 0), 0), n = S.reduce((s, q) => s + (q[1] ? q[1].nul : 0), 0);
  return { ok: w > 0 && n / w <= .22, detail: 'sans cible ' + (100 * n / w).toFixed(1) + ' % de ' + (w / 60).toFixed(0) + ' s de vague (' + S.map(q => q[1] ? (100 * q[1].nul / q[1].w).toFixed(0) + ' %' : '-').join(', ') + ')' };
});
check('V7 îlot 3, graines 1 à 6 : en moyenne ≥ 4 ennemis hostiles à l’écran pendant les vagues', () => {
  const S = flux(), w = S.reduce((s, q) => s + (q[3] ? q[3].w : 0), 0), n = S.reduce((s, q) => s + (q[3] ? q[3].on : 0), 0);
  return { ok: w > 0 && n / w >= 4, detail: (n / w).toFixed(2) + ' en moyenne sur ' + (w / 60).toFixed(0) + ' s de vague (' + S.map(q => q[3] ? (q[3].on / q[3].w).toFixed(2) : '-').join(', ') + ')' };
});

/* ================= V8 : MÊLÉE =================
   un corps à corps qui touche : la Mite s'arrête et s'annonce, puis bondit là où tu VAS ; l'Épine vise en anticipant,
   verrouille, charge plus loin, et reste sonnée contre un rocher. */
/* un rectangle libre de w × h (aucun obstacle ni falaise à 26 u près, dans l'îlot) : son coin haut-gauche */
const zone = (H, w, h) => J(H, `(()=>{const ok=(x,y)=>Math.hypot(x,y)<PR-80&&!pointHit(x,y,26)&&!wallNear(x,y,26);
  for(let gy=-PR;gy<=PR-${h};gy+=60)for(let gx=-PR;gx<=PR-${w};gx+=60){if(!ok(gx,gy)||!ok(gx+${w},gy)||!ok(gx,gy+${h})||!ok(gx+${w},gy+${h}))continue;let f=true;
    for(let y=gy;y<=gy+${h}&&f;y+=16)for(let x=gx;x<=gx+${w};x+=16)if(!ok(x,y)){f=false;break;}if(f)return JSON.stringify([gx,gy]);}return 'null';})()`);
check('V8 une Mite à 200 u bondit sur la bulle qui file droit à pleine vitesse, à angle droit : touchée en ≤ 60 pas', () => {
  const H = arene(4270), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(`(()=>{const P=G.p;P.x=${gx + 60};P.y=${gy + 60};P.vx=P.spd;P.vy=0;P.inv=0;P.dashing=0;G.cx=P.x;G.cy=P.y;window.__s0=P.seg;
    window.__M=mkEnemy('mite',${gx + 60},${gy + 260},{spawn:0,age:0,cd:0});window.__SIM_INPUT=function(){G.inX=1;G.inY=0;G.aimMan=false;};})()`);
  let n = 0, st = '';
  for (; n < 60 && H.call('G.p.seg===window.__s0'); n++) { H.steps(1); st += H.call('window.__M.dead?"x":String(window.__M.st)'); }
  const hit = H.call('G.p.seg<window.__s0');
  return { ok: hit && n <= 60, detail: (hit ? 'touchée après ' + n + ' pas' : 'jamais touchée en 60 pas') + ' ; états de la Mite : ' + st.replace(/(.)\1*/g, m => m[0] + '×' + m.length + ' ') };
});
check('V8 une Mite à 180 u s’arrête et s’annonce (st 3, |v| < ,5) ≥ 10 pas, puis bondit de ≥ 190 u', () => {
  const H = arene(4271), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(`(()=>{const P=G.p;P.x=${gx + 80};P.y=${gy + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;window.__M=mkEnemy('mite',${gx + 260},${gy + 210},{spawn:0,age:0,cd:0});})()`);
  let arret = 0, l0 = null, l1 = null, vu1 = false;
  for (let i = 0; i < 90; i++) {
    H.steps(1);
    const m = J(H, 'JSON.stringify({st:window.__M.st,v:Math.hypot(window.__M.vx,window.__M.vy),x:window.__M.x,y:window.__M.y,d:window.__M.dead})');
    if (m.d) break;
    if (!vu1 && m.st === 3 && m.v < .5) arret++;
    if (!vu1 && m.st === 1) { vu1 = true; l0 = m; H.call(`G.p.x=${gx + 500};G.p.y=${gy + 400};G.p.vx=G.p.vy=0;`); }
    else if (vu1 && m.st !== 1) { l1 = m; break; }
  }
  const saut = l0 && l1 ? Math.hypot(l1.x - l0.x, l1.y - l0.y) : 0;
  return { ok: arret >= 10 && saut >= 190, detail: 'à l’arrêt et annoncée ' + arret + ' pas ; bond de ' + saut.toFixed(0) + ' u' };
});
check('V8 une Épine vise en anticipant, verrouille sa visée les 10 derniers pas (la bulle bouge), puis charge ≥ 320 u', () => {
  const H = arene(4272), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(`(()=>{const P=G.p;P.x=${gx + 460};P.y=${gy + 60};P.vx=0;P.vy=P.spd;G.cx=P.x;G.cy=P.y;window.__S=mkEnemy('spike',${gx + 160},${gy + 60},{spawn:0,age:0,cd:0});
    window.__SIM_INPUT=function(){G.inX=0;G.inY=1;G.aimMan=false;};})()`);
  const vise = [], verrou = []; let c0 = null, c1 = null;
  for (let i = 0; i < 160; i++) {
    H.steps(1);
    const s = J(H, 'JSON.stringify({st:window.__S.st,st2:window.__S.st2,ca:window.__S.ca,x:window.__S.x,y:window.__S.y})');
    if (s.st === 1) { vise.push(s.ca); if (s.st2 <= 10) verrou.push(s.ca); }
    if (s.st === 2 && !c0) c0 = s;
    if (c0 && s.st !== 2) { c1 = s; break; }
  }
  const fixe = verrou.length >= 10 && verrou.every(a => a === verrou[0]), suit = vise.length > 12 && vise[0] !== vise[vise.length - 11];
  const ch = c0 && c1 ? Math.hypot(c1.x - c0.x, c1.y - c0.y) : 0;
  return { ok: fixe && suit && ch >= 320, detail: 'visée ' + vise.length + ' pas, ' + (suit ? 'suit la bulle' : 'ne bouge pas') + ', puis ' + (fixe ? 'verrouillée ' + verrou.length + ' pas' : 'pas verrouillée (' + verrou.length + ' pas, ' + new Set(verrou).size + ' angles)') + ' ; charge de ' + ch.toFixed(0) + ' u' };
});
check('V8 une Épine qui charge dans un rocher massif reste sonnée (≥ 50 pas) : la toucher ne coûte rien, le même coup fait ×2', () => {
  const H = arene(4273);
  const r = J(H, `(()=>{const P=G.p;for(let k=1;k<=8;k++){if(k>1){genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph='pause';G.phT=-1e9;}
      for(let cx=-3;cx<=3;cx++)for(let cy=-3;cy<=3;cy++){const c=getChunk(cx,cy);if(!c)continue;
        for(const o of c.obs){if(o.brk||o.gone||o.wall)continue;
          for(let i=0;i<16;i++){const u=i*TAU/16,ux=Math.cos(u),uy=Math.sin(u),ax=o.cx+ux*(o.R+170),ay=o.cy+uy*(o.R+170),bx=ax+ux*300,by=ay+uy*300;
            if(Math.hypot(ax,ay)>PR-80||Math.hypot(bx,by)>PR-60||pointHit(ax,ay,24)||wallNear(ax,ay,24)||pointHit(bx,by,30))continue;
            let q=null;for(let s=0;s<=200&&!q;s+=6)q=pointHit(ax-ux*s,ay-uy*s,16);if(q!==o)continue;
            P.x=bx;P.y=by;P.vx=P.vy=0;G.cx=ax;G.cy=ay;G.p.crit=0;
            window.__S=mkEnemy('spike',ax,ay,{spawn:0,age:0,cd:1e9});Object.assign(window.__S,{st:2,st2:40,ca:Math.atan2(-uy,-ux)});window.__U=[ux,uy];
            return JSON.stringify({k,R:Math.round(o.R)});}}}}
    return 'null';})()`);
  if (!r) return { ok: false, detail: 'aucun rocher massif dégagé trouvé' };
  let n = 0; for (; n < 60 && !H.call('window.__S.stun>0') && H.call('window.__S.st===2'); n++) H.steps(1);
  H.steps(1);
  const stun = H.call('window.__S.stun|0');
  H.call('(()=>{const e=window.__S,P=G.p,u=window.__U;P.inv=0;P.dashing=0;P.x=e.x+u[0]*(e.r+P.r*.5);P.y=e.y+u[1]*(e.r+P.r*.5);P.vx=P.vy=0;window.__s0=P.seg;})()');
  H.steps(3);
  const perte = H.call('window.__s0-G.p.seg');
  const d = J(H, 'JSON.stringify((()=>{const e=window.__S;e.hp=e.mhp=100;let h=e.hp;hurtEnemy(e,1,0,0,true,false);const dS=h-e.hp;e.stun=0;h=e.hp;hurtEnemy(e,1,0,0,true,false);return{dS,dN:h-e.hp};})())');
  return { ok: stun >= 50 && perte === 0 && d.dN > 0 && d.dS === 2 * d.dN, detail: 'îlot ' + r.k + ', rocher R ' + r.R + ' atteint en ' + n + ' pas : sonnée ' + stun + ' pas ; contact sonnée : ' + perte + ' segment(s) perdu(s) ; coup ' + d.dS + ' sonnée contre ' + d.dN + ' sinon' };
});
check('V8 une Épine dont la charge finit dans le bord reste dans l’îlot pendant qu’elle est sonnée (≤ 1 u au-delà de PR − r), sur ≥ 3 caps dégagés', () => {
  /* revue du 13/10/2026 : sonnée, elle gardait son élan de 8,5 u/pas sans confine ni collideCircle et sortait de ~48 u */
  const H = arene(4277), R = [];
  for (let i = 0; i < 24 && R.length < 6; i++) {
    const ok = H.call(`(()=>{const u=${i}*TAU/24,ux=Math.cos(u),uy=Math.sin(u);for(let s=PR-260;s<=PR;s+=12)if(pointHit(ux*s,uy*s,24)||wallNear(ux*s,uy*s,24))return false;
      G.en=[];G.eb=[];const P=G.p;P.x=-ux*200;P.y=-uy*200;P.vx=P.vy=0;G.cx=ux*(PR-200);G.cy=uy*(PR-200);
      window.__S=mkEnemy('spike',ux*(PR-230),uy*(PR-230),{spawn:0,age:0,cd:1e9});Object.assign(window.__S,{st:2,st2:40,ca:u});return true;})()`);
    if (!ok) continue;
    let n = 0; for (; n < 45 && !H.call('window.__S.stun>0'); n++) H.steps(1);
    if (!H.call('window.__S.stun>0')) { R.push({ i, stun: false }); continue; }
    let mx = -1e9, k = 0; for (; k < 70 && H.call('window.__S.stun>0'); k++) { H.steps(1); mx = Math.max(mx, H.call('Math.hypot(window.__S.x,window.__S.y)-(PR-window.__S.r)')); }
    R.push({ i, stun: true, mx, k });
  }
  const S = R.filter(r => r.stun);
  return { ok: S.length >= 3 && S.every(r => r.mx <= 1), detail: S.length + ' cap(s) sonné(s) au bord sur ' + R.length + ' : dépassement max ' + (S.length ? Math.max(...S.map(r => r.mx)).toFixed(1) : '-') + ' u (' + S.map(r => r.mx.toFixed(1)).join(', ') + ')' };
});

{
  /* contexte 2D qui journalise stroke (couleur/épaisseur), fillRect (couleur) et setLineDash pendant drawEnemy */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && (p === 'stroke' || p === 'fillRect' || p === 'setLineDash') ? (...a) => { LOG.push(p === 'stroke' ? 's ' + base.strokeStyle + '/' + base.lineWidth : p === 'fillRect' ? 'f ' + base.fillStyle : 'd ' + JSON.stringify(a[0])); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V8 dessin : la Mite qui s’annonce tire un trait blanc ; l’Épine pointillée puis verrouillée en trait blanc plein ; l’Épine sonnée a trois points dorés', () => {
    const H = arene(4276, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const d = (o) => { H.call(`window.__D=mkEnemy(${JSON.stringify(o.t)},G.p.x+150,G.p.y,{spawn:0,age:0,cd:1e9});Object.assign(window.__D,${JSON.stringify(o.s)});`); LOG = []; H.call('drawEnemy(window.__D)'); const l = LOG; LOG = null; return l; };
    const m = d({ t: 'mite', s: { st: 3, st2: 6, ca: 1 } }), v = d({ t: 'spike', s: { st: 1, st2: 22, ca: 1 } }), k = d({ t: 'spike', s: { st: 1, st2: 6, ca: 1 } }), z = d({ t: 'spike', s: { stun: 30 } });
    const gd = H.call('COL.gd'), dash = l => l.some(x => /^d \[\d/.test(x));
    const ok = m.includes('s #ffffff/2') && dash(v) && !v.includes('s #ffffff/3') && !dash(k) && k.includes('s #ffffff/3') && z.filter(x => x === 'f ' + gd).length === 3;
    return { ok, detail: 'Mite st 3 : ' + m.filter(x => x[0] === 's').join(' ') + ' | Épine qui vise : ' + (dash(v) ? 'pointillée' : 'pleine') + ' | verrouillée : ' + (dash(k) ? 'pointillée' : 'pleine') + ', ' + k.filter(x => x[0] === 's').join(' ') + ' | sonnée : ' + z.filter(x => x === 'f ' + gd).length + ' point(s) doré(s)' };
  });
}

/* ================= V9 : TIREURS =================
   des tireurs qui se plantent et tirent : le Tireur s'arrête, s'annonce, puis tire un éventail de 5 plus vite que la bulle ;
   il ne tire pas dans un rocher (il se décale) ; le Tireur d'élite verrouille sa visée les 12 derniers pas et tire une aiguille
   ≥ 13 u/pas ; un critique pendant l'annonce l'interrompt. Chaque type tire dans sa couleur. */
/* nouveaux tirs ennemis depuis le dernier appel (marqués), et la ligne de l'ennemi E à la bulle coupée par un solide
   (échantillon tous les 10 u : le juge est le test, pas lineClear du jeu) */
const NEUFS = 'window.__neufs=()=>{const n=[];for(const b of G.eb)if(!b.__m){b.__m=1;n.push(b);}return n;};window.__coupe=(e)=>{const P=G.p,d=Math.hypot(P.x-e.x,P.y-e.y),n=Math.ceil(d/10);for(let k=1;k<n;k++){const t=k/n,o=pointHit(e.x+(P.x-e.x)*t,e.y+(P.y-e.y)*t,0);if(o&&!o.brk)return true;}return false;};';
check('V9 îlot 3 : un Tireur à 250 u (cd 0) se plante ≥ 20 pas (|v| < ,2), puis tire un éventail de 5, dans sa couleur, plus vite que la bulle', () => {
  const H = arene(4280), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(NEUFS + `(()=>{G.isl=3;const P=G.p;P.x=${gx + 60};P.y=${gy + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;window.__T=mkEnemy('spread',${gx + 310},${gy + 210},{spawn:0,age:0,cd:0});})()`);
  let fixe = 0, n = 0, b = null;
  for (; n < 90; n++) {
    H.steps(1);
    const s = J(H, 'JSON.stringify({v:Math.hypot(window.__T.vx,window.__T.vy),b:window.__neufs().map(b=>[b.col,Math.hypot(b.vx,b.vy)])})');
    if (s.b.length) { b = s.b; break; }
    if (s.v < .2) fixe++; else fixe = 0;
  }
  const col = H.call('ET.spread.col'), spd = H.call('G.p.spd');
  const ok = !!b && fixe >= 20 && b.length === 5 && b.every(x => x[0] === col && x[1] > spd);
  return { ok, detail: b ? 'planté ' + fixe + ' pas, puis ' + b.length + ' tir(s) au pas ' + (n + 1) + ', couleur(s) ' + [...new Set(b.map(x => x[0]))].join(' ') + ' (Tireur ' + col + '), vitesse ' + b[0][1].toFixed(2) + ' u/pas (bulle ' + spd + ')' : 'aucun tir en 90 pas' };
});
check('V9 un Tireur dont la ligne passe par un rocher massif ne tire pas dedans (200 pas, bulle immobile) : il se décale (≥ 80 u)', () => {
  const H = arene(4281);
  const r = J(H, NEUFS + `(()=>{const P=G.p;for(let k=1;k<=8;k++){if(k>1){genIslet(G.seed,k);G.isl=k;G.pickIsl=k;islStart();G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph='pause';G.phT=-1e9;}
      for(let cx=-3;cx<=3;cx++)for(let cy=-3;cy<=3;cy++){const c=getChunk(cx,cy);if(!c)continue;
        for(const o of c.obs){if(o.brk||o.gone||o.wall||o.R<35||o.R>110)continue;
          for(let i=0;i<16;i++){const u=i*TAU/16,ux=Math.cos(u),uy=Math.sin(u),px=o.cx-ux*(o.R+60),py=o.cy-uy*(o.R+60),tx=o.cx+ux*(o.R+40),ty=o.cy+uy*(o.R+40);
            if(Math.hypot(px,py)>PR-150||Math.hypot(tx,ty)>PR-150||pointHit(px,py,P.r+6)||wallNear(px,py,P.r+6)||pointHit(tx,ty,24)||wallNear(tx,ty,24))continue;
            P.x=px;P.y=py;P.vx=P.vy=0;G.cx=px;G.cy=py;const e=mkEnemy('spread',tx,ty,{spawn:0,age:0});if(!window.__coupe(e)){G.en=[];continue;}
            window.__T=e;return JSON.stringify({k,R:Math.round(o.R),x:tx,y:ty,d:Math.round(Math.hypot(tx-px,ty-py))});}}}}
    return 'null';})()`);
  if (!r) return { ok: false, detail: 'aucun rocher massif dégagé trouvé' };
  let tirs = 0, dedans = 0, d = 0;
  for (let i = 0; i < 200; i++) {
    H.steps(1);
    const s = J(H, `JSON.stringify({n:window.__neufs().length,c:window.__coupe(window.__T),x:window.__T.x,y:window.__T.y,m:window.__T.dead})`);
    if (s.m) break;
    tirs += s.n; if (s.c) dedans += s.n; d = Math.max(d, Math.hypot(s.x - r.x, s.y - r.y));
  }
  return { ok: dedans === 0 && d >= 80, detail: 'îlot ' + r.k + ', rocher R ' + r.R + ', Tireur à ' + r.d + ' u : ' + dedans + ' tir(s) dans le rocher (' + tirs + ' en tout) ; il s’est décalé de ' + d.toFixed(0) + ' u' };
});
check('V9 le Tireur d’élite vise en anticipant, VERROUILLE sa visée les 12 derniers pas (la bulle file), puis tire une aiguille ≥ 13 u/pas', () => {
  const H = arene(4282), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(NEUFS + `(()=>{const P=G.p;P.x=${gx + 60};P.y=${gy + 60};P.vx=P.spd;P.vy=0;G.cx=P.x;G.cy=P.y;window.__S=mkEnemy('sniper',${gx + 160},${gy + 340},{spawn:0,age:0,cd:0});
    window.__SIM_INPUT=function(){G.inX=1;G.inY=0;G.aimMan=false;};})()`);
  const vise = [], verrou = []; let v = 0, ndl = false;
  for (let i = 0; i < 120; i++) {
    H.steps(1);
    const s = J(H, 'JSON.stringify({tl:window.__S.tele,ta:window.__S.ta,b:window.__neufs().map(b=>[Math.hypot(b.vx,b.vy),!!b.ndl])})');
    if (s.tl > 0) { vise.push(s.ta); if (s.tl <= 12) verrou.push(s.ta); }
    if (s.b.length) { v = s.b[0][0]; ndl = s.b[0][1]; break; }
  }
  const fixe = verrou.length >= 12 && verrou.every(a => a === verrou[0]), suit = vise.length > 14 && vise[0] !== vise[vise.length - 13];
  return { ok: fixe && suit && v >= 13, detail: 'visée ' + vise.length + ' pas, ' + (suit ? 'suit la bulle' : 'ne bouge pas') + ', ' + (fixe ? 'verrouillée ' + verrou.length + ' pas' : 'pas verrouillée (' + verrou.length + ' pas, ' + new Set(verrou).size + ' angles)') + ' ; tir à ' + v.toFixed(2) + ' u/pas' + (ndl ? ' (aiguille)' : '') };
});
check('V9 un critique pendant l’annonce du Tireur annule sa salve (0 tir) ; un petit coup sans critique ne l’annule pas', () => {
  const H = arene(4283), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(NEUFS + `(()=>{G.isl=3;const P=G.p;P.crit=0;P.x=${gx + 60};P.y=${gy + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;window.__T=mkEnemy('spread',${gx + 310},${gy + 210},{spawn:0,age:0,cd:0});window.__T.hp=window.__T.mhp=100;})()`);
  const salve = cr => {
    H.call('window.__T.cd=0;window.__T.st=0;window.__neufs();');
    let k = 0; for (; k < 6 && !H.call('window.__T.st>0'); k++) H.steps(1);
    if (!H.call('window.__T.st>0')) return null;
    H.call(`hurtEnemy(window.__T,1,0,0,true,${cr})`);
    const st = H.call('window.__T.st'); let n = 0;
    for (let i = 0; i < 40; i++) { H.steps(1); n += H.call('window.__neufs().length'); }
    return { st, n };
  };
  const a = salve(false), b = salve(true);
  if (!a || !b) return { ok: false, detail: 'le Tireur ne s’annonce jamais (st reste 0) : il tire sans prévenir' };
  return { ok: a.n === 5 && b.st === 0 && b.n === 0, detail: 'petit coup pendant l’annonce : ' + a.n + ' tir(s) ; critique pendant l’annonce : annonce ' + (b.st === 0 ? 'coupée' : 'continue') + ', ' + b.n + ' tir(s)' };
});

/* ================= V10 : LOURDS =================
   les lourds ont une voix : l'Orbiteur tire deux coups courbes, la Gatling monte en régime (plantée, muette) avant sa rafale,
   le Pulsar n'inspire qu'à portée (380 u) et souffle au plus 10 orbes qu'un tir de la bulle détruit, le Porteur vient à toi. */
check('V10 un tir de la bulle qui touche un orbe de Pulsar le détruit (G.eb − 1) et s’arrête (perforation 0) ; perforant, il continue', () => {
  const H = arene(4284), z = zone(H, 300, 120);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  const essai = pierce => J(H, `(()=>{G.eb=[];G.pb=[];const ox=${gx + 220},oy=${gy + 60},q=ebul(ox,oy,0,0,8,ET.ring.col);q.vx=q.vy=0;q.r=8;q.sh=1;
    const b=pbul(ox-24,oy,0,{pierce:${pierce},rico:0,split:0,home:0});window.__B=b;return JSON.stringify(G.eb.length);})()`);
  const n0 = essai(0); H.steps(3); const a = J(H, 'JSON.stringify({eb:G.eb.length,pb:G.pb.length})');
  const n1 = essai(1); H.steps(3); const b = J(H, 'JSON.stringify({eb:G.eb.length,pb:G.pb.length,pr:window.__B.pierce})');
  return { ok: n0 === 1 && a.eb === 0 && a.pb === 0 && n1 === 1 && b.eb === 0 && b.pb === 1 && b.pr === 0,
    detail: 'perforation 0 : orbes ' + n0 + ' → ' + a.eb + ', tirs restants ' + a.pb + ' ; perforation 1 : orbes ' + n1 + ' → ' + b.eb + ', tirs restants ' + b.pb + ' (perforation ' + b.pr + ')' };
});
check('V10 une Gatling (cd 0) à 250 u se plante ≥ 25 pas (montée en régime) avant sa première balle', () => {
  const H = arene(4286), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(NEUFS + `(()=>{const P=G.p;P.x=${gx + 60};P.y=${gy + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;window.__T=mkEnemy('gatling',${gx + 310},${gy + 210},{spawn:0,age:0,cd:0});})()`);
  let fixe = 0, n = 0, b = 0;
  for (; n < 90; n++) { H.steps(1); const s = J(H, 'JSON.stringify({v:Math.hypot(window.__T.vx,window.__T.vy),b:window.__neufs().length})'); if (s.b) { b = s.b; break; } if (s.v < .2) fixe++; else fixe = 0; }
  return { ok: b > 0 && fixe >= 25, detail: b ? 'plantée ' + fixe + ' pas, première balle au pas ' + (n + 1) : 'aucune balle en 90 pas' };
});
check('V10 un lourd attaque tôt : une Gatling ou un Pulsar naît avec une recharge ≤ 20 (montée ou inspiration dans la seconde qui suit l’éclosion), un Tireur d’élite ≤ 30 ; les autres gardent 30-80', () => {
  /* revue du 13/10/2026 : avec cd 30-80 (plus l'éclosion et l'annonce), 60 % des Gatlings de l'îlot 6, 67 % des Pulsars de l'îlot 7
     et 47 % des Tireurs d'élite de l'îlot 4 mouraient sans avoir tiré : leur attaque, celle qui les distingue, ne se voyait pas */
  const H = arene(4329);
  const r = J(H, `(()=>{const o={};for(const t of ['gatling','ring','sniper','spread','orbit']){let m=0,n=1e9;for(let i=0;i<40;i++){const e=mkEnemy(t,G.p.x+300,G.p.y,{age:0});m=Math.max(m,e.cd);n=Math.min(n,e.cd);}o[t]=[+n.toFixed(1),+m.toFixed(1)];}G.en=[];return JSON.stringify(o);})()`);
  const ok = r.gatling[1] <= 20 && r.ring[1] <= 20 && r.sniper[1] <= 30 && r.spread[0] >= 30 && r.orbit[0] >= 30;
  return { ok, detail: Object.keys(r).map(t => t + ' ' + r[t][0] + '-' + r[t][1]).join(', ') };
});
check('V10 un Pulsar à 500 u (à l’écran) ne pulse pas en 300 pas ; à 300 u, il inspire ≥ 18 pas puis souffle au plus 10 orbes (r 8, destructibles)', () => {
  /* en biais (,88 ; ,475) : à 500 u, il tient dans la vue du banc (480 × 360 u de demi-largeur × demi-hauteur) */
  const H = arene(4285);
  H.call(NEUFS + 'window.__T=mkEnemy("ring",0,0,{spawn:0,age:0,cd:0});window.__sx=G.p.x>0?-1:1;');
  const pin = d => `{const P=G.p,e=window.__T;P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;e.x=P.x+window.__sx*.88*${d};e.y=P.y+.475*${d};e.vx=e.vy=0;}`;
  const vue = H.call(`${pin(500)}(()=>{const e=window.__T;return Math.abs(e.x-G.cx)<=W/2/G.zoom-e.r&&Math.abs(e.y-G.cy)<=H/2/G.zoom-e.r;})()`);
  let loin = 0; for (let i = 0; i < 300; i++) { H.call(pin(500)); H.steps(1); if (H.call('window.__neufs().length')) loin++; }
  const P = []; let insp = 0;
  for (let i = 0; i < 300; i++) {
    H.call(pin(300)); H.steps(1);
    const s = J(H, 'JSON.stringify({st:window.__T.st,b:window.__neufs().map(b=>[b.r,!!b.sh])})');
    if (s.b.length) { P.push({ n: s.b.length, insp, ok: s.b.every(x => x[0] === 8 && x[1]) }); insp = 0; } else if (s.st > 0) insp++; else insp = 0;
  }
  const ok = vue && loin === 0 && P.length >= 1 && P.every(p => p.n <= 10 && p.insp >= 18 && p.ok);
  return { ok, detail: 'à 500 u (' + (vue ? 'à l’écran' : 'HORS de l’écran') + ') : ' + loin + ' pulsation(s) ; à 300 u : ' + P.length + ' pulsation(s), ' + P.map(p => p.n + ' orbes après ' + p.insp + ' pas d’inspiration' + (p.ok ? '' : ' (pas des orbes r 8)')).join(', ') };
});
check('V10 le Pulsar souffle VERS la bulle : brèche derrière lui, les quatre orbes de devant (deux de chaque côté) se referment en pince sur sa position (≤ 12 u de la zone de touche), puis filent droit ; un critique ne coupe plus l’inspiration d’un lourd', () => {
  /* revue du 13/10/2026 : l'anneau partait au hasard, l'orbe qui venait vers la bulle descendait sa ligne de tir et crevait ; aux
     îlots 7-8, aucun des ~540 orbes mesurés n'approchait la bulle à moins de 40 u : l'îlot 7 était devenu le plus facile du jeu.
     Ici, la bulle s'écarte de 220 u dès le souffle : les orbes visent sa position d'alors, s'y referment, puis vont droit. */
  const H = arene(4291), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z, X = gx + 40, Y = gy + 210, pin = `{const e=window.__T;e.x=${gx + 340};e.y=${Y};e.vx=e.vy=0;G.p.vx=G.p.vy=0;}`;
  H.call(NEUFS + `(()=>{const P=G.p;P.orbs=0;P.x=${X};P.y=${Y};P.vx=P.vy=0;G.cx=P.x+150;G.cy=P.y;window.__T=mkEnemy('ring',${gx + 340},${Y},{spawn:0,age:0,cd:0});})()`);
  let O = null, n = 0;
  for (; n < 60 && !O; n++) { H.call(pin); H.steps(1); const b = J(H, 'JSON.stringify(window.__neufs().map(b=>{b.__i=window.__c=(window.__c||0)+1;return[Math.atan2(b.vy,b.vx),b.rot||0,b.__i];}))'); if (b.length) O = b; }
  if (!O) return { ok: false, detail: 'aucun souffle en 60 pas' };
  H.call(`G.p.y=${Y}-220;`);
  const dev = a => Math.abs(((a - Math.PI) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI), dos = O.filter(o => dev(o[0]) > Math.PI - .5).length, cv = O.filter(o => o[1]);
  const ids = JSON.stringify(cv.map(o => o[2])), md = {}, dr = {};
  for (let k = 0; k < 70; k++) { H.call(pin); H.steps(1);
    for (const [i, d, r] of J(H, `JSON.stringify(G.eb.filter(b=>${ids}.includes(b.__i)).map(b=>[b.__i,Math.hypot(b.x-(${X}),b.y-(${Y}))-(G.p.r*.72+b.r),b.rot]))`)) { md[i] = Math.min(md[i] == null ? 1e9 : md[i], d); if (!r && dr[i] == null) dr[i] = k; } }
  const pres = cv.map(o => md[o[2]]), droit = cv.every(o => dr[o[2]] != null);
  const cr = J(H, `(()=>{const e=mkEnemy('ring',G.p.x+300,G.p.y,{spawn:0,age:0});e.st=12;e.hp=e.mhp=1000;hurtEnemy(e,1,0,0,true,true);const g=mkEnemy('gatling',G.p.x+300,G.p.y,{spawn:0,age:0});g.st=-12;g.hp=g.mhp=1000;hurtEnemy(g,1,0,0,true,true);const o=[e.st,g.st];G.en=[];return JSON.stringify(o);})()`);
  const ok = O.length <= 10 && dos === 0 && cv.length === 4 && cv.filter(o => o[1] > 0).length === 2 && pres.every(d => d != null && d <= 12) && droit && cr[0] > 0 && cr[1] < 0;
  return { ok, detail: O.length + ' orbes au pas ' + n + ', ' + dos + ' dans la brèche (dos), ' + cv.length + ' qui se referment (rot ' + cv.map(o => o[1].toFixed(4)).join(' / ') + '), au plus près de la zone de touche (position du souffle) : ' + pres.map(d => d == null ? 'perdu' : d.toFixed(1) + ' u').join(', ') + ' ; droits ensuite : ' + cv.map(o => dr[o[2]] == null ? 'NON' : 'au pas ' + dr[o[2]]).join(', ') + ' ; critique pendant l’inspiration : Pulsar st ' + cr[0] + ', Gatling st ' + cr[1] };
});
check('V10 l’Orbiteur (cd 0) tire deux coups courbes (rot ± ,009, même sens) à 8 pas d’écart', () => {
  const H = arene(4287), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const [gx, gy] = z;
  H.call(NEUFS + `(()=>{const P=G.p;P.x=${gx + 60};P.y=${gy + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;window.__T=mkEnemy('orbit',${gx + 310},${gy + 210},{spawn:0,age:0,cd:0});})()`);
  const t = [];
  for (let n = 0; n < 40; n++) { H.steps(1); for (const r of J(H, 'JSON.stringify(window.__neufs().map(b=>b.rot))')) t.push([n, r]); }
  const ok = t.length === 2 && t[1][0] - t[0][0] === 8 && t.every(x => Math.abs(Math.abs(x[1]) - .009) < 1e-9) && t[0][1] === t[1][1];
  return { ok, detail: t.length + ' tir(s) en 40 pas : ' + t.map(x => 'pas ' + (x[0] + 1) + ' rot ' + x[1]).join(', ') };
});

{
  /* contexte 2D qui journalise le chemin (beginPath, arc), fill (couleur), stroke (couleur/épaisseur/opacité) et drawImage */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && (p === 'beginPath' || p === 'arc' || p === 'fill' || p === 'stroke' || p === 'drawImage') ? () => { LOG.push(p === 'beginPath' ? 'b' : p === 'arc' ? 'a' : p === 'fill' ? 'f ' + base.fillStyle : p === 'stroke' ? 's ' + base.strokeStyle + '/' + base.lineWidth + '/' + base.globalAlpha : 'i'); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  /* nombre d'arcs du chemin rempli de la couleur col, pour chaque fill */
  const arcs = (l, col) => { const r = []; let n = 0; for (const x of l) { if (x === 'b') n = 0; else if (x === 'a') n++; else if (x === 'f ' + col) r.push(n); } return r; };
  check('V9-V10 dessin : Tireur qui s’annonce = 5 bouches blanches (7 élite) ; visée verrouillée du Tireur d’élite blanche ; aiguilles en deux traits groupés ; orbes cerclés de blanc DANS leur sprite (orbSpr : aucun trait par image) ; Gatling en montée = canons blancs', () => {
    const H = arene(4288, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const d = (t, o) => { H.call(`window.__D=mkEnemy(${JSON.stringify(t)},G.p.x+150,G.p.y,{spawn:0,age:0,cd:1e9});Object.assign(window.__D,${JSON.stringify(o)});`); LOG = []; H.call('drawEnemy(window.__D)'); const l = LOG; LOG = null; return l; };
    const w = '#ffffff', sp = arcs(d('spread', { st: 10, ca: 1 }), w), se = arcs(d('spread', { st: 10, ca: 1, elite: 1 }), w), sn = d('sniper', { tele: 8, ta: 1 }), sv = d('sniper', { tele: 30, ta: 1 }), ga = arcs(d('gatling', { st: -12, ca: 1 }), w);
    const col = H.call('ET.sniper.col');
    H.call(`G.eb=[];for(let i=0;i<3;i++){const b=ebul(G.p.x+60+i*30,G.p.y+20,0,13,4.5,ET.sniper.col);b.ndl=1;}for(let i=0;i<3;i++){const b=ebul(G.p.x+60+i*30,G.p.y-40,0,3,8,ET.ring.col);b.sh=1;}`);
    /* revue du 13/10/2026 : le cercle blanc des orbes, tracé à chaque image (un stroke groupé), coûtait ~17 µs par orbe en canevas
       logiciel (3 à 4 × le sprite) : il est cuit une fois dans le sprite de l'orbe (orbSpr), posé comme les autres tirs ennemis */
    LOG = []; const osp = H.call('typeof orbSpr==="function"&&!!orbSpr(ET.ring.col)'), cuit = LOG; LOG = null;
    H.call('window.__no=0;if(typeof orbSpr==="function"){const __os=orbSpr;orbSpr=function(){window.__no++;return __os.apply(this,arguments);};}drawBullets();');
    LOG = []; H.call('drawBullets()'); const bl = LOG; LOG = null; const no = H.call('window.__no');
    const ndl = bl.filter(x => x === 's ' + col + '/3/1' || x === 's #ffffff/1.2/1').length, img = bl.filter(x => x === 'i').length, orb = bl.filter(x => /^s #ffffff\/1\.5\//.test(x)).length;
    const ring = cuit.includes('a') && cuit.some(x => /^s #ffffff\/[\d.]+\/0\.7$/.test(x));
    const ok = sp.includes(5) && se.includes(7) && sn.includes('s #ffffff/3.5/0.9') && !sv.includes('s #ffffff/3.5/0.9') && ndl === 2 && img === 3 && orb === 0 && osp && ring && no === 6 && ga.includes(3);
    return { ok, detail: 'bouches blanches : ' + (sp.filter(n => n > 1).join('/') || '0') + ' (élite ' + (se.filter(n => n > 1).join('/') || '0') + ') ; visée verrouillée : ' + (sn.filter(x => x[0] === 's').join(' ') || 'aucun trait') + ' ; 3 aiguilles + 3 orbes : ' + ndl + ' trait(s) d’aiguille, ' + img + ' sprite(s), ' + orb + ' trait(s) de cercle par image ; sprite d’orbe ' + (osp ? (ring ? 'cerclé de blanc' : 'SANS cercle blanc') : 'absent') + ', ' + no + ' appel(s) sur deux images ; Gatling en montée : canons blancs ' + (ga.filter(n => n > 1).join('/') || '0') };
  });
}

/* ================= V11 : MORTS =================
   des morts qui comptent : l'Épine abattue projette 4 piquants, la Gatling 6 éclats (des tirs de la BULLE, cyan : ils se lisent
   comme les tiens) ; le Pulsar meurt dans une onde (120 u : pousse, blesse, efface les tirs ennemis) ; le Porteur se fend en
   3 Mites (parent posé : l'observateur de headless.js les reconnaît). Mite, Tireur, Tireur d'élite, Orbiteur : rien. */
check('V11 une Épine abattue projette 4 piquants cyan : deux Épines à 60 u (dans l’axe) sont touchées en ≤ 10 pas ; un conseil la première fois', () => {
  const H = arene(4290), z = zone(H, 300, 300);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const cx = z[0] + 150, cy = z[1] + 150;
  const r0 = J(H, `(()=>{const P=G.p;P.x=${z[0] + 30};P.y=${z[1] + 30};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;G.toasts=[];G.pb=[];
    const o={spawn:0,age:0,cd:1e9},a=mkEnemy('spike',${cx + 60},${cy},o),b=mkEnemy('spike',${cx},${cy + 60},o);a.hp=a.mhp=b.hp=b.mhp=100;window.__N=[a,b];
    const e=mkEnemy('spike',${cx},${cy},{spawn:0,age:0,cd:1e9,wob:0});killEnemy(e);
    return JSON.stringify({n:G.pb.filter(q=>q.shard).length,c:[...new Set(G.pb.map(q=>q.col))],cy:COL.cy});})()`);
  let n = 0; for (; n < 10 && !H.call('window.__N.every(q=>q.hp<100)'); n++) H.steps(1);
  const hp = J(H, 'JSON.stringify(window.__N.map(q=>+q.hp.toFixed(2)))'), conseil = H.call('G.toasts.some(t=>/Épine abattue/.test(t.s))');
  return { ok: r0.n === 4 && r0.c.length === 1 && r0.c[0] === r0.cy && hp.every(v => v < 100) && conseil,
    detail: r0.n + ' piquant(s) (' + r0.c.join(' ') + ') ; voisines : PV ' + hp.join(' / ') + ' sur 100 après ' + n + ' pas ; conseil ' + (conseil ? 'affiché' : 'absent') };
});
check('V11 une Gatling abattue lance 6 éclats cyan (dégâts 1,5 ×) ; Mite, Tireur, Tireur d’élite, Orbiteur : rien', () => {
  const H = arene(4291);
  const r = J(H, `(()=>{const P=G.p,o={spawn:0,age:0,cd:1e9},out={};
    for(const t of ['gatling','mite','spread','sniper','orbit']){G.pb=[];const n0=G.en.filter(q=>!q.dead).length;killEnemy(mkEnemy(t,P.x+200,P.y,o));
      out[t]={n:G.pb.length,sh:G.pb.filter(q=>q.shard&&q.col===COL.cy&&Math.abs(q.dmg-1.5*P.dmg)<1e-9).length,en:G.en.filter(q=>!q.dead).length-n0};}
    return JSON.stringify(out);})()`);
  const rien = ['mite', 'spread', 'sniper', 'orbit'].every(t => r[t].n === 0 && r[t].en === 0);
  return { ok: r.gatling.n === 6 && r.gatling.sh === 6 && rien, detail: Object.keys(r).map(t => t + ' : ' + r[t].n + ' tir(s)' + (t === 'gatling' ? ' (' + r[t].sh + ' éclats cyan à 1,5 ×)' : '') + (r[t].en ? ', +' + r[t].en + ' ennemi(s)' : '')).join(' ; ') };
});
check('V11 un Pulsar abattu : onde de 120 u, tous les tirs ennemis à < 120 u effacés (ceux à 160 u restent), un voisin à 80 u blessé', () => {
  const H = arene(4292), z = zone(H, 400, 400);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const cx = z[0] + 200, cy = z[1] + 200;
  const r = J(H, `(()=>{const P=G.p,cx=${cx},cy=${cy};P.x=${z[0] + 20};P.y=${z[1] + 20};G.eb=[];
    for(let i=0;i<8;i++){const a=i*TAU/8,d=40+i*10;ebul(cx+Math.cos(a)*d,cy+Math.sin(a)*d,a,0,4.5);}
    for(let i=0;i<4;i++){const a=i*TAU/4+.4;ebul(cx+Math.cos(a)*160,cy+Math.sin(a)*160,a,0,4.5);}
    const v=mkEnemy('spike',cx+80,cy,{spawn:0,age:0,cd:1e9});v.hp=v.mhp=100;
    killEnemy(mkEnemy('ring',cx,cy,{spawn:0,age:0,cd:1e9}));
    let pres=0,loin=0;for(const b of G.eb){if(Math.hypot(b.x-cx,b.y-cy)<120)pres++;else loin++;}
    return JSON.stringify({pres,loin,hp:+v.hp.toFixed(2),vx:+v.vx.toFixed(2)});})()`);
  return { ok: r.pres === 0 && r.loin === 4 && r.hp < 100, detail: 'tirs à < 120 u restants : ' + r.pres + ' (sur 8), à 160 u : ' + r.loin + ' (sur 4) ; voisin à 80 u : PV ' + r.hp + '/100, poussé à ' + r.vx + ' u/pas' };
});
check('V11 un Porteur abattu à l’îlot 8 se fend en exactement 3 Mites, chacune avec son parent (pas des proies)', () => {
  const H = arene(4293);
  const r = J(H, `(()=>{G.isl=8;const P=G.p,e=mkEnemy('spawner',P.x+250,P.y,{spawn:0,age:0,cd:1e9});const m0=G.en.filter(q=>!q.dead&&q.t==='mite').length;
    killEnemy(e);const m=G.en.filter(q=>!q.dead&&q.t==='mite');
    return JSON.stringify({n:m.length-m0,par:m.filter(q=>q.parent===e).length,proie:m.filter(q=>q.prey).length,spawn:[...new Set(m.map(q=>q.spawn))]});})()`);
  return { ok: r.n === 3 && r.par === 3 && r.proie === 0, detail: '+' + r.n + ' Mite(s), ' + r.par + ' avec parent, ' + r.proie + ' proie(s), éclosion ' + r.spawn.join('/') + ' pas' };
});

/* ================= V12 : ABSORB =================
   avaler en plein combat : un ennemi à bout (≤ 20 % de vie, 40 % avec Appétit) et plus petit que toi s'avale au contact ; gonflé,
   tu aspires ce qui est plus petit que toi (240 u) et tu files ×1,15 ; frôler un tir remplit la jauge ; une proie ne fuit qu'à
   moins de 220 u, moins vite (,55 × ta vitesse), et s'avale de plus loin (+10). Digestion : un segment toutes les 20 absorptions. */
check('V12 un Tireur à 15 % de vie au contact de la bulle (sans Appétit) est avalé (G.eats + 1, aucun segment perdu) ; un conseil la première fois', () => {
  const H = arene(4294);
  const r = J(H, `(()=>{const P=G.p;P.appetit=0;G.toasts=[];const e=mkEnemy('spread',P.x+20,P.y,{spawn:0,age:0,cd:1e9});hurtEnemy(e,e.mhp*.85,0,0,true,false);
    const t=G.toasts.some(q=>/à bout/.test(q.s));window.__E=e;window.__e0=G.eats;window.__s0=P.seg;P.inv=0;return JSON.stringify({t,hp:+(e.hp/e.mhp).toFixed(3)});})()`);
  H.steps(1);
  const s = J(H, 'JSON.stringify({m:window.__E.dead,e:G.eats-window.__e0,s:window.__s0-G.p.seg})');
  return { ok: s.m && s.e === 1 && s.s === 0 && r.t, detail: 'vie ' + Math.round(r.hp * 100) + ' % : ' + (s.m ? 'avalé' : 'vivant') + ', G.eats +' + s.e + ', segments perdus ' + s.s + ' ; conseil ' + (r.t ? 'affiché' : 'absent') };
});
check('V12 à 30 % de vie, un Tireur au contact ne s’avale qu’avec Appétit (texte de la carte : « 40 % »)', () => {
  const H = arene(4295);
  const essai = ap => { H.call(`(()=>{const P=G.p;P.appetit=${ap};G.en=[];const e=mkEnemy('spread',P.x+20,P.y,{spawn:0,age:0,cd:1e9});e.hp=e.mhp*.3;window.__E=e;window.__e0=G.eats;})()`); H.steps(1); return J(H, 'JSON.stringify({m:window.__E.dead,e:G.eats-window.__e0})'); };
  const a = essai(0), b = essai(1), txt = H.call('CARDS.appetit.u.d');
  return { ok: !a.m && a.e === 0 && b.m && b.e === 1 && /40\s%/.test(txt), detail: 'sans Appétit : ' + (a.m ? 'avalé' : 'pas avalé') + ' ; avec : ' + (b.m ? 'avalé' : 'pas avalé') + ' ; carte : « ' + txt + ' »' };
});
check('V12 gonflée (sans Trou noir), la bulle aspire une Mite à 200 u (≥ 40 u en 30 pas), pas un ennemi plus gros qu’elle ; elle file ×1,15', () => {
  const H = arene(4296), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  /* ennemis sonnés (stun) : ils ne marchent pas d'eux-mêmes, seule l'aspiration les déplace */
  const r = J(H, `(()=>{const P=G.p;P.hole=false;P.x=${z[0] + 280};P.y=${z[1] + 210};P.vx=P.vy=0;G.cx=P.x;G.cy=P.y;P.gauge=1;tryGonfle();
    const o={spawn:0,age:0,cd:1e9,stun:1e9};window.__M=mkEnemy('mite',P.x+200,P.y,o);window.__B=mkEnemy('spawner',P.x-200,P.y,Object.assign({},o,{age:-1}));
    window.__d=q=>Math.hypot(q.x-G.p.x,q.y-G.p.y);return JSON.stringify({m:window.__d(window.__M),b:window.__d(window.__B),rb:+window.__B.r.toFixed(1)});})()`);
  H.steps(30);
  const s = J(H, 'JSON.stringify({m:window.__d(window.__M),b:window.__d(window.__B),r:+G.p.r.toFixed(1)})');
  /* vitesse : 40 pas à droite à plat, puis 40 pas gonflée */
  const H2 = arene(4297), z2 = zone(H2, 560, 420);
  H2.call(`(()=>{const P=G.p;P.x=${z2[0] + 40};P.y=${z2[1] + 210};P.vx=P.vy=0;window.__SIM_INPUT=function(){G.inX=1;G.inY=0;G.aimMan=false;};})()`);
  H2.steps(40); const v0 = H2.call('G.p.vx'); H2.call('G.p.gauge=1;tryGonfle()'); H2.steps(40); const v1 = H2.call('G.p.vx');
  const k = v1 / v0;
  return { ok: r.m - s.m >= 40 && s.b >= r.b - .5 && k > 1.14 && k < 1.16,
    detail: 'Mite : ' + r.m.toFixed(0) + ' → ' + s.m.toFixed(0) + ' u ; Porteur (r ' + r.rb + ', bulle r ' + s.r + ') : ' + r.b.toFixed(0) + ' → ' + s.b.toFixed(0) + ' u ; vitesse ' + v0.toFixed(2) + ' → ' + v1.toFixed(2) + ' u/pas (×' + k.toFixed(3) + ')' };
});
check('V12 un tir qui frôle la bulle (10 u de son bord) remplit la jauge d’exactement ,006 × gGain, une seule fois', () => {
  const H = arene(4298), z = zone(H, 300, 120);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const r = J(H, `(()=>{const P=G.p;P.x=${z[0] + 150};P.y=${z[1] + 60};P.vx=P.vy=0;P.gauge=0;P.gGain=1.25;G.eb=[];window.__sc=G.score;
    window.__b=ebul(${z[0] + 10},P.y+P.r+10,0,4,4.5);return JSON.stringify({rs:P.r*.72+4.5,d:P.r+10});})()`);
  let g = []; for (let i = 0; i < 70; i++) { H.steps(1); g.push(H.call('G.p.gauge')); }
  const fin = g[g.length - 1], pas = new Set(g).size - (g[0] === 0 ? 1 : 0), att = .006 * 1.25, sc = H.call('G.score-window.__sc');
  return { ok: Math.abs(fin - att) < 1e-12 && pas === 1 && H.call('G.eb.length') === 1, detail: 'tir à ' + r.d + ' u du centre (touche sous ' + r.rs.toFixed(1) + ') : jauge 0 → ' + fin + ' (attendu ' + att + '), ' + pas + ' palier(s) ; score +' + sc };
});
check('V12 un tir de face qui TOUCHE la bulle ne paie pas le frôlement (ni jauge, ni son, ni conseil), à 3, 5, 8 et 11 u/pas', () => {
  /* revue du 13/10/2026 : le tir traversait l'anneau des 16 u un pas avant de toucher, chaque touche jouait le son du frôlement */
  const H = arene(4320), z = zone(H, 300, 120);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  H.call('window.__gz=0;const __sg=SFX.graze;SFX.graze=function(){window.__gz++;return __sg.apply(this,arguments);};');
  const R = [3, 5, 8, 11].map(v => {
    J(H, `(()=>{const P=G.p;P.x=${z[0] + 40};P.y=${z[1] + 60};P.vx=P.vy=0;P.inv=0;P.dashing=0;P.gon=0;P.pu={};P.seg=P.segMax;P.gauge=0;P.gGain=1;G.tut.gz=0;G.eb=[];window.__gz=0;window.__h0=G.hits;
      ebul(P.x+220,P.y,Math.PI,${v},5);return '1';})()`);
    let n = 0; for (; n < 120 && H.call('G.hits===window.__h0'); n++) H.steps(1);
    return Object.assign({ v }, J(H, 'JSON.stringify({h:G.hits-window.__h0,g:G.p.gauge,gz:window.__gz,tut:!!G.tut.gz})'));
  });
  return { ok: R.every(r => r.h === 1 && r.g === 0 && r.gz === 0 && !r.tut), detail: R.map(r => r.v + ' u/pas : ' + r.h + ' touche, jauge ' + r.g + ', ' + r.gz + ' son(s) de frôlement' + (r.tut ? ', conseil' : '')).join(' ; ') };
});
check('V12 proies : une proie à 300 u ne fuit pas ; à 150 u elle fuit à ≤ ,55 × la vitesse de la bulle ; elle s’avale à +10 ; ,35 × n proies par vague', () => {
  const H = arene(4299), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const fuite = d => { H.call(`(()=>{const P=G.p;G.en=[];P.x=${z[0] + 60};P.y=${z[1] + 210};P.vx=P.vy=0;window.__Q=mkEnemy('mite',P.x+${d},P.y,{spawn:0,age:2});window.__v=0;})()`);
    const d0 = H.call('Math.hypot(window.__Q.x-G.p.x,window.__Q.y-G.p.y)'); for (let i = 0; i < 30; i++) { H.steps(1); H.call('window.__v=Math.max(window.__v,Math.hypot(window.__Q.vx,window.__Q.vy))'); }
    return { dd: H.call('Math.hypot(window.__Q.x-G.p.x,window.__Q.y-G.p.y)') - d0, v: H.call('window.__v') }; };
  const loin = fuite(300), pres = fuite(150), spd = H.call('G.p.spd');
  /* avalée de plus loin : au bord + 8 (après son premier pas de fuite, ≤ ,3 u) */
  const av = J(H, `(()=>{const P=G.p;G.en=[];const q=mkEnemy('mite',0,0,{spawn:0,age:2});q.x=P.x+P.r+q.r+8;q.y=P.y;const e0=G.eats;step();return JSON.stringify({m:q.dead,e:G.eats-e0});})()`);
  const np = J(H, `(()=>{G.isl=3;G.marks=[];G.en=[];waveStart(1);const n=G.wq.n,p=G.wq.prey+G.marks.filter(m=>m.prey).reduce((s,m)=>s+m.n,0);G.marks=[];G.en=[];G.wq=null;G.ph='pause';G.phT=-1e9;return JSON.stringify({n,p});})()`);
  const ok = loin.dd < 30 && pres.dd > 30 && pres.v <= .55 * spd + 1e-9 && av.m && np.p === Math.round(np.n * .35);
  return { ok, detail: 'à 300 u : ' + loin.dd.toFixed(1) + ' u en 30 pas ; à 150 u : ' + pres.dd.toFixed(1) + ' u, vitesse max ' + pres.v.toFixed(2) + ' (,55 × ' + spd + ' = ' + (.55 * spd).toFixed(2) + ') ; au bord + 8 : ' + (av.m ? 'avalée' : 'pas avalée') + ' ; îlot 3, vague 1 : ' + np.p + ' proies pour ' + np.n + ' ennemis' };
});
check('V12 Digestion : un segment revient à la 20e absorption, pas avant (texte de la carte : « 20 absorptions »)', () => {
  const H = arene(4300);
  const r = J(H, `(()=>{const P=G.p;P.digest=1;P.digN=0;P.seg=P.segMax-2;const s0=P.seg,s=[];for(let i=1;i<=20;i++){absorb(mkEnemy('mite',P.x+300,P.y,{spawn:0,age:2}));s.push(P.seg-s0);}
    return JSON.stringify({s19:s[18],s20:s[19],prem:s.indexOf(1)+1,txt:CARDS.digest.u.d});})()`);
  return { ok: r.s19 === 0 && r.s20 === 1 && /20 absorptions/.test(r.txt), detail: 'premier segment rendu à l’absorption ' + r.prem + ' ; carte : « ' + r.txt + ' »' };
});
{
  /* contexte 2D qui journalise les fill (couleur) pendant drawEnemy */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && p === 'fill' ? () => { LOG.push(base.fillStyle); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V12 dessin : un ennemi à bout clignote (corps pâle une image sur deux tranches de 8) ; un ennemi en pleine forme non', () => {
    const H = arene(4301, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const d = (f, fr) => { H.call(`window.__D=mkEnemy('spread',G.p.x+150,G.p.y,{spawn:0,age:0,cd:1e9});window.__D.hp=window.__D.mhp*${f};FRAME=${fr};`); LOG = []; H.call('drawEnemy(window.__D)'); const l = LOG; LOG = null; return l; };
    const col = H.call('ET.spread.col'), pl = H.call('pale(ET.spread.col)');
    const a = d(.15, 8), b = d(.15, 16), c = d(1, 8);
    const ok = a.includes(pl) && !a.includes(col) && b.includes(col) && !b.includes(pl) && c.includes(col) && !c.includes(pl);
    return { ok, detail: 'à 15 %, FRAME 8 : ' + (a.includes(pl) ? 'pâle' : 'plein') + ' ; FRAME 16 : ' + (b.includes(pl) ? 'pâle' : 'plein') + ' ; pleine vie, FRAME 8 : ' + (c.includes(pl) ? 'pâle' : 'plein') };
  });
}

/* ================= V13 : SÉRIE =================
   une série qui paie : fenêtre de 2,5 s (1,5 s avant : plus courte que le temps d'abattre un ennemi) ; une esquive parfaite ou
   un obstacle cassé la prolongent sans compter ; à 15 en vague, un cadeau (power-up d'arme ou onde), à 40, jauge +20 % (pas en
   combat de boss) ; EMBALLEMENT : le tir accélère avec la série (+2 % par kill, ≤ 25 %), traînées plus longues, canons blancs ;
   le multiplicateur s'affiche sous la bulle (plus dans le coin) ; un power-up vit 12 s (9 avant). */
check('V13 série : dix kills à 120 pas d’écart font une série de 10 (fenêtre 2,5 s ; 1,5 s avant) ; 151 pas sans rien la rompent', () => {
  const H = arene(4302), k = () => H.call("killEnemy(mkEnemy('mite',G.p.x+250,G.p.y,{spawn:0}));G.combo");
  const c = []; for (let i = 0; i < 10; i++) { c.push(k()); if (i < 9) H.steps(120); }
  H.steps(151); const apres = k();
  return { ok: c[9] === 10 && apres === 1, detail: 'série : ' + c.join(' ') + ' ; après 151 pas : ' + apres };
});
check('V13 cadeau : 15 en vague → un power-up (Tir rapide, Tir triple, Perforant ou Onde) qui vit 720 pas ; en combat de boss, rien ; 40 en vague → jauge +20 %', () => {
  const H = arene(4303);
  const r = J(H, `(()=>{const P=G.p,k=(ph,c)=>{G.ph=ph;G.pus=[];G.tx=[];G.combo=c;G.comboT=G.t;P.gauge=0;P.gGain=1;killEnemy(mkEnemy('mite',P.x+250,P.y,{spawn:0}));
      const o={q:G.pus.map(q=>[q.k,q.life]),g:+P.gauge.toFixed(6),c:G.combo,t:G.tx.map(t=>t.s)};G.ph='pause';G.phT=-1e9;return o;};
    return JSON.stringify({w:k('wave',14),b:k('boss',14),w40:k('wave',39),b40:k('boss',39)});})()`);
  const arme = ['rapid', 'triple', 'pierce', 'wave'];
  const ok = r.w.c === 15 && r.w.q.length === 1 && arme.includes(r.w.q[0][0]) && r.w.q[0][1] === 720 && r.w.t.some(s => /cadeau/.test(s)) && r.b.q.length === 0
    && Math.abs(r.w40.g - .25) < 1e-9 && Math.abs(r.b40.g - .05) < 1e-9 && r.w40.t.some(s => /jauge/.test(s));
  return { ok, detail: 'vague, 15 : ' + JSON.stringify(r.w.q) + ' « ' + r.w.t.join(' | ') + ' » ; boss, 15 : ' + r.b.q.length + ' power-up ; jauge après le 40ᵉ kill : vague ' + r.w40.g + ', boss ' + r.b40.g + ' (un kill seul : ,05)' };
});
check('V13 cadeau contre un rocher (la bulle le regarde) : le power-up tombe sur un sol libre, jamais dans l’obstacle ; avec 8 power-ups au sol, le cadeau annoncé existe quand même', () => {
  /* revue du 13/10/2026 : posé à 70 u devant la bulle sans regarder, il pouvait tomber dans un rocher ou une falaise (impossible à
     ramasser pendant ses 12 s) ; et au plafond de 8, « cadeau ! » s'affichait sans power-up */
  const H = arene(4321);
  const r = J(H, `(()=>{const P=G.p,arme=['rapid','triple','pierce','wave'],out=[];
    const k=()=>{G.ph='wave';G.tx=[];G.combo=14;G.comboT=G.t;killEnemy(mkEnemy('mite',P.x+250,P.y,{spawn:0}));G.ph='pause';G.phT=-1e9;};
    for(let isl=1;isl<=8&&out.length<6;isl++){if(isl>1){genIslet(G.seed,isl);G.isl=isl;G.pickIsl=isl;islStart();G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph='pause';G.phT=-1e9;}
      for(let cx=-3;cx<=3&&out.length<6;cx++)for(let cy=-3;cy<=3&&out.length<6;cy++){const c=getChunk(cx,cy);if(!c)continue;
        for(const o of c.obs){if(o.brk||o.gone||o.k!==0||o.r<40)continue;const u=Math.atan2(-o.y,-o.x),ux=Math.cos(u),uy=Math.sin(u),x=o.x+ux*(o.r+P.r+1),y=o.y+uy*(o.r+P.r+1);
          if(Math.hypot(x,y)>PR-80||pointHit(x,y,P.r))continue;
          P.x=x;P.y=y;P.vx=P.vy=0;P.ang=u+Math.PI;G.pus=[];k();const q=G.pus[0];out.push({isl,r:Math.round(o.r),n:G.pus.length,dans:q?!!pointHit(q.x,q.y,8):null,kind:q&&q.k});if(out.length>=6)break;}}}
    G.pus=[];for(let i=0;i<8;i++)G.pus.push({x:P.x+40,y:P.y,vx:0,vy:0,k:'repair',life:500,ph:0});k();
    const cap={n:G.pus.length,g:G.pus.filter(q=>arme.includes(q.k)&&q.life===720).length,t:G.tx.map(t=>t.s).filter(s=>/cadeau/.test(s)).length};
    return JSON.stringify({out,cap});})()`);
  const ok = r.out.length >= 3 && r.out.every(o => o.n === 1 && o.dans === false) && r.cap.g === 1 && r.cap.n === 8 && r.cap.t === 1;
  return { ok, detail: r.out.length + ' rocher(s) : ' + r.out.map(o => 'îlot ' + o.isl + ' r ' + o.r + (o.n ? (o.dans ? ' DANS le rocher' : ' sol libre') : ' aucun power-up')).join(', ') + ' ; 8 au sol : ' + r.cap.g + ' cadeau (' + r.cap.n + ' au sol, ' + r.cap.t + ' texte)' };
});
check('V13 Emballement : une série de 12 entretenue → cadence ≥ 1,2 × sur une cible tenue, traînées ≥ 1,4 × plus longues, un conseil la première fois', () => {
  const H = cible(4304), per = () => { const t = J(H, 'JSON.stringify(window.__B.map(b=>b.__t))'); return t.length > 1 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 1e9; };
  H.call('const __pb3=pbul;pbul=function(){const b=__pb3.apply(this,arguments);b.__t=G.t;return b;};G.toasts=[];');
  H.call('G.p.ctr=0;G.combo=0;G.comboT=-999;'); H.tenir(30); H.call('window.__B=[];'); H.tenir(180); const p0 = per(), n0 = H.call('window.__B.length'), t0 = H.call('window.__B[0].tl||2.2');
  H.call('window.__B=[];'); for (let i = 0; i < 180; i++) { H.call('G.combo=12;G.comboT=G.t;'); H.tenir(1); }
  const p1 = per(), n1 = H.call('window.__B.length'), t1 = H.call('Math.min(...window.__B.map(b=>b.tl||2.2))'), toast = H.call('G.toasts.map(t=>t.s).join(" | ")');
  return { ok: n0 > 1 && n1 > 1 && p0 >= 1.2 * p1 && t1 >= 1.4 * t0 && /Emballement/.test(toast),
    detail: 'sans série : ' + n0 + ' tirs, un toutes les ' + p0.toFixed(2) + ' pas ; série de 12 : ' + n1 + ' tirs, un toutes les ' + p1.toFixed(2) + ' pas (×' + (p0 / p1).toFixed(2) + ') ; traînée ' + t0 + ' → ' + (+t1).toFixed(3) + ' ; conseil : ' + (toast || 'aucun') };
});
check('V13 une esquive parfaite (140 pas après le dernier kill), puis un obstacle cassé (140 pas plus tard) prolongent la série sans la compter', () => {
  const H = arene(4305), k = () => H.call("killEnemy(mkEnemy('mite',G.p.x+250,G.p.y,{spawn:0}));G.combo");
  for (let i = 0; i < 5; i++) k();
  H.steps(140); const c1 = H.call('G.p.perf=0;perfect(G.p.x,G.p.y);G.combo');
  H.steps(140); const o = J(H, `(()=>{let o=null;for(let cx=-COFF;cx<COFF&&!o;cx++)for(let cy=-COFF;cy<COFF&&!o;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.obs)if(q.brk&&!q.gone){o=q;break;}}
    if(!o)return 'null';breakObs(o);return JSON.stringify({c:G.combo});})()`);
  H.steps(140); const c3 = k();
  return { ok: c1 === 5 && o && o.c === 5 && c3 === 6, detail: 'série 5 ; esquive parfaite à +140 : ' + c1 + ' ; obstacle cassé à +280 : ' + (o ? o.c : 'aucun cassable') + ' ; kill à +420 : ' + c3 };
});
{
  /* contexte 2D qui journalise fillText (texte, x, y), fillRect et stroke (couleur) */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && (p === 'fillText' || p === 'fillRect' || p === 'stroke') ? (...a) => { LOG.push(p === 'fillText' ? ['t', a[0], a[1], a[2]] : p === 'fillRect' ? ['r', base.fillStyle].concat(a) : ['s', base.strokeStyle]); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V13 dessin : la série s’affiche sous la bulle (« ×2 · 12 », une barre qui se vide), plus dans le coin ; à 4, rien ; canons blancs pendant l’Emballement', () => {
    const H = arene(4306, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const vue = c => { H.call(`G.combo=${c};G.comboT=G.t;G.tx=[];`); LOG = []; H.call('render(1,16.7)'); const l = LOG; LOG = null; return l; };
    const a = vue(12), s = J(H, 'JSON.stringify(w2s(G.p.x,G.p.y))'), b = vue(4), z = vue(0);
    const tx = a.filter(x => x[0] === 't'), m = tx.find(x => x[1] === '×2 · 12'), coin = tx.concat(b.filter(x => x[0] === 't')).filter(x => /série|×1 · 4|· 4$/.test(x[1]));
    const barre = m && a.some(x => x[0] === 'r' && Math.abs(x[2] - (m[2] - 14)) < .01 && Math.abs(x[3] - (m[3] + 9)) < .01);
    const can = l => { for (let i = 0; i + 1 < l.length; i++) if (l[i][0] === 's' && l[i][1] === '#0b1c26' && l[i + 1][0] === 's') return l[i + 1][1]; return null; };
    const ok = !!m && Math.abs(m[2] - s[0]) < 1 && m[3] > s[1] + 30 && barre && coin.length === 0 && can(a) === '#ffffff' && can(z) !== '#ffffff';
    return { ok, detail: (m ? '« ' + m[1] + ' » à (' + m[2].toFixed(0) + ', ' + m[3].toFixed(0) + '), bulle à (' + s[0].toFixed(0) + ', ' + s[1].toFixed(0) + '), barre ' + (barre ? 'oui' : 'non') : 'pas de « ×2 · 12 » (textes : ' + tx.map(x => x[1]).join(' | ') + ')') + ' ; dans le coin : ' + (coin.map(x => x[1]).join(' | ') || 'rien') + ' ; canons : série 12 ' + can(a) + ', sans série ' + can(z) };
  });
}

/* ================= V14 : CŒUR =================
   le gardien abattu laisse son cœur (îlots 1 à 7) : il vole vers la bulle, s'avale au contact (ou de force à 70 pas) et fait monter
   d'un niveau ta DERNIÈRE carte bonus qui n'est pas au maximum (sans tirage : G.picks reste à 16 par partie) ; sinon, jauge pleine.
   Une vague sans une égratignure : jauge +15 %. Le bonus d'îlot nettoyé s'affiche. */
/* une partie à l'îlot 1, le boss en place (le motif du V4 boss) */
function gardien(seed) {
  const H = L.mkGame({ ref: REF, seed }); H.win.__SIM_PICK = c => c[0]; H.win.__SIM_END = () => {};
  H.start(); H.steps(30); H.call("G.en=[];G.marks=[];G.wave=3;G.ph='preboss';G.phT=99;G.pickMid=G.isl;G.p.inv=1e9;");
  H.steps(200, () => H.call('!!G.boss&&G.boss.spawn<=0'));
  /* la bulle à 250 u du boss (il naît au centre, sur elle) : le cœur doit voler jusqu'à elle */
  H.call('(()=>{const P=G.p,B=G.boss;for(let a=0;a<TAU;a+=.3){const x=B.x+Math.cos(a)*250,y=B.y+Math.sin(a)*250;if(!pointHit(x,y,30)&&!wallNear(x,y,30)){P.x=x;P.y=y;P.vx=P.vy=0;break;}}})()');
  return H;
}
const somme = 'Object.values(G.p.cards).reduce((a,b)=>a+b,0)';
check('V14 le boss de l’îlot 1 abattu laisse un cœur : avalé en ≤ 100 pas, ta dernière carte bonus monte d’un niveau (Σ cartes + 1, effet appliqué), G.picks inchangé', () => {
  const H = gardien(4310);
  const r = J(H, `(()=>{const P=G.p;applyCard({k:'b',u:CARDS.rapid.u});window.__s0=${somme};window.__n0=G.picks.length;window.__r0=P.cards.rapid;window.__f0=P.fireI;
    const bc=bossCol(G.boss);bossDie();G.tx=[];return JSON.stringify({h:!!G.heart,col:G.heart?G.heart.col===bc:false,ph:G.ph,d:G.heart?Math.hypot(G.heart.x-P.x,G.heart.y-P.y):0});})()`);
  const n = H.steps(100, () => H.call('!G.heart'));
  const s = J(H, `JSON.stringify({h:!!G.heart,ds:${somme}-window.__s0,dn:G.picks.length-window.__n0,r0:window.__r0,r1:G.p.cards.rapid,f:G.p.fireI<window.__f0,t:G.tx.map(t=>t.s).filter(s=>/Cœur/.test(s)),ph:G.ph,phT:G.phT})`);
  const ok = r.h && r.col && r.d >= 200 && !s.h && s.ds === 1 && s.dn === 0 && s.r1 === s.r0 + 1 && s.f && s.t.length === 1;
  return { ok, detail: 'cœur ' + (r.h ? 'posé à ' + Math.round(r.d) + ' u de la bulle' : 'absent') + (r.col ? ' (couleur du boss)' : '') + ' ; ' + (s.h ? 'toujours là' : 'avalé') + ' après ' + n + ' pas (' + s.ph + ' ' + s.phT + ') ; Σ cartes +' + s.ds + ', G.picks +' + s.dn + ', Surcadence ' + s.r0 + ' → ' + s.r1 + ', cadence ' + (s.f ? 'accrue' : 'inchangée') + ' ; « ' + s.t.join(' | ') + ' »' };
});
check('V14 toutes tes cartes bonus au maximum : le cœur remplit la jauge (P.gauge = 1), aucune carte ne bouge ; le dernier gardien (îlot 8) n’en laisse pas', () => {
  const H = gardien(4311);
  H.call(`(()=>{const P=G.p;G.picks=[];P.cards={};applyCard({k:'b',u:CARDS.mirror.u});P.gauge=0;window.__s0=${somme};bossDie();G.tx=[];})()`);
  const n = H.steps(100, () => H.call('!G.heart'));
  const s = J(H, `JSON.stringify({h:!!G.heart,g:G.p.gauge,ds:${somme}-window.__s0,t:G.tx.map(t=>t.s).filter(s=>/Cœur/.test(s))})`);
  const H2 = gardien(4312), h8 = H2.call('G.boss.k=NISL;bossDie();G.heart==null');
  return { ok: !s.h && s.g === 1 && s.ds === 0 && s.t.length === 1 && /jauge/.test(s.t[0]) && h8, detail: (s.h ? 'cœur toujours là' : 'cœur avalé') + ' après ' + n + ' pas ; jauge ' + s.g + ', Σ cartes +' + s.ds + ' ; « ' + s.t.join(' | ') + ' » ; boss de l’îlot 8 : ' + (h8 ? 'pas de cœur' : 'un cœur') };
});
check('V14 vague sans une égratignure : jauge + ,15 et un texte ; un coup encaissé pendant la vague (hurtPlayer) l’annule', () => {
  const H = arene(4313);
  const v = coup => J(H, `(()=>{const P=G.p;G.en=[];G.marks=[];P.gauge=0;P.gGain=1;G.wave=1;G.ph='wave';G.phT=0;G.tx=[];
    G.wq={left:0,n:8,el:5,eld:true,prey:0,nextT:1e9,th:0,gi:2,lastS:0,hit:0};
    if(${coup}){P.inv=0;P.dashing=0;hurtPlayer(P.x+30,P.y);P.inv=1e9;}const hit=G.wq.hit;waveTick();
    const o={g:+P.gauge.toFixed(6),hit,ph:G.ph,t:G.tx.map(t=>t.s).filter(s=>/égratignure/.test(s))};G.wq=null;G.ph='pause';G.phT=-1e9;return JSON.stringify(o);})()`);
  const a = v(0), b = v(1);
  return { ok: Math.abs(a.g - .15) < 1e-9 && a.t.length === 1 && a.ph === 'pause' && b.hit === 1 && b.g === 0 && b.t.length === 0,
    detail: 'sans coup : jauge ' + a.g + ' « ' + a.t.join('') + ' » (' + a.ph + ') ; avec un coup : marque ' + b.hit + ', jauge ' + b.g };
});
check('V14 les textes « jauge + » disent le vrai gain : rien gonflée (la jauge ne bouge pas), « +21 % » avec Gonflement rapide (×1,4), « +10 % » à 90 % ; idem pour la série de 40', () => {
  /* revue du 13/10/2026 : le texte promettait +15 % / +20 % quoi qu'il arrive (gonflée : rien ; ×1,4 : 21 %) */
  const H = arene(4322);
  const v = (gon, gg, g0, ser) => J(H, `(()=>{const P=G.p;G.en=[];G.marks=[];P.gauge=${g0};P.gGain=${gg};P.gon=${gon};G.wave=1;G.ph='wave';G.phT=0;G.tx=[];
    if(${ser}){G.combo=39;G.comboT=G.t;comboUp(null);}else{G.wq={left:0,n:8,el:5,eld:true,prey:0,nextT:1e9,th:0,gi:2,lastS:0,hit:0};waveTick();}
    const o={g:+(P.gauge-${g0}).toFixed(6),t:G.tx.map(t=>t.s).filter(s=>/jauge/.test(s))};P.gon=0;G.wq=null;G.ph='pause';G.phT=-1e9;return JSON.stringify(o);})()`);
  const R = [[120, 1, .3, 0], [0, 1.4, .3, 0], [0, 1, .9, 0], [120, 1, .3, 1], [0, 1.4, .3, 1], [0, 1, .9, 1]].map(a => v(...a));
  const tx = (o, s) => o.t.length === 1 && o.t[0].endsWith(s);
  const ok = R[0].g === 0 && R[0].t.length === 0 && Math.abs(R[1].g - .21) < 1e-9 && tx(R[1], '+21 %') && Math.abs(R[2].g - .1) < 1e-9 && tx(R[2], '+10 %')
    && R[3].g === 0 && R[3].t.length === 0 && Math.abs(R[4].g - .28) < 1e-9 && tx(R[4], '+28 %') && Math.abs(R[5].g - .1) < 1e-9 && tx(R[5], '+10 %');
  return { ok, detail: ['vague gonflée', 'vague ×1,4', 'vague à 90 %', 'série gonflée', 'série ×1,4', 'série à 90 %'].map((n, i) => n + ' : +' + R[i].g + ' « ' + R[i].t.join(' | ') + ' »').join(' ; ') };
});
check('V14 îlot nettoyé : le bonus s’affiche au 40ᵉ pas (« +1 500 » à l’îlot 1 sans une égratignure, « +500 » sinon)', () => {
  const H = arene(4314);
  const v = hit => { H.call(`G.islHit=${hit};G.boss=null;G.tx=[];islClear();`); H.steps(40); const r = J(H, 'JSON.stringify(G.tx.map(t=>t.s))'); H.call('G.ph="pause";G.phT=-1e9;'); return r; };
  const a = v(false), b = v(true), f = J(H, 'JSON.stringify(["+"+fmt(1500),"+"+fmt(500)])');
  return { ok: a.includes(f[0]) && b.includes(f[1]) && !b.includes(f[0]), detail: 'sans égratignure : ' + a.join(' | ') + ' ; touchée : ' + b.join(' | ') };
});
{
  let CNT = null;
  const cpt = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (CNT && p === 'drawImage' ? () => { CNT.n++; } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V14 dessin : le cœur, un halo et une sphère (2 drawImage) ; interpolé entre deux pas ; render() sans exception', () => {
    const H = arene(4315, { mkCtx: cpt });
    H.call('render(1,16.7);G.heart={x:G.p.x+60,y:G.p.y,col:ET.mite.col};');
    CNT = { n: 0 }; H.call('drawHeart()'); const n = CNT.n; CNT = null;
    H.steps(1); const px = H.call('G.heart.px'); H.call('G.heart.x+=10;render(.5,16.7)'); const x = H.call('G.heart.x-G.heart.px');
    return { ok: n === 2 && px != null && Math.abs(x - 10) < 1e-9, detail: n + ' drawImage ; px ' + px + ' ; position rendue à l’état après render : +' + x };
  });
}


/* ================= V15 : ÉLITES =================
   une élite n'est plus une éponge (×3,2 PV, même comportement) : elle porte un modificateur, annoncé à l'éclosion.
   VIVE (×2 PV) : ×1,5 plus rapide, sa recharge fond ×1,6, une traînée ; BLINDÉE (×2,4) : un bouclier qui se tourne lentement vers
   toi (,2 × les tirs de face, 1,5 × de dos ; le tir automatique ne la compte pas « à découvert ») ; VOLATILE (×2,4) : sa mort arme
   une explosion de 110 u qui part 36 pas plus tard (elle blesse la bulle et les ennemis, ,6 × leur vie). Abattue : jauge + ,12 et
   un power-up, comme avant. */
const MODS = { vif: 'Élite vive', blinde: 'Élite blindée', volatil: 'Élite volatile' };
check('V15 sur 300 élites, chaque modificateur (vive, blindée, volatile) ≥ 20 % ; vive ×2 PV, blindée et volatile ×2,4, rayon ×1,3 ; son nom s’affiche à l’éclosion ; abattue : jauge + ,12 et un power-up', () => {
  const H = arene(4320);
  const r = J(H, `(()=>{const P=G.p,o={vif:0,blinde:0,volatil:0,autre:0,hp:{},r:0};const b=mkEnemy('spread',P.x+200,P.y,{spawn:0,age:0,cd:1e9}),hp0=b.hp,r0=b.r;G.en=[];
    for(let i=0;i<300;i++){const e=mkEnemy('spread',P.x+200,P.y,{spawn:0,age:0,cd:1e9,elite:1});if(e.mod in o)o[e.mod]++;else o.autre++;o.hp[e.mod]=+(e.hp/hp0).toFixed(3);o.r=+(e.r/r0).toFixed(3);}G.en=[];
    G.tx=[];G.marks=[{x:P.x+200,y:P.y,t:29,max:30,t2:'spread',n:2,prey:false,el:1,col:ET.spread.col}];updMarks();const el=G.en.find(e=>e.elite);o.mod=el?el.mod:null;o.tx=G.tx.map(t=>t.s);G.en=[];
    G.pus=[];P.gauge=0;P.gGain=1;killEnemy(mkEnemy('spread',P.x+200,P.y,{spawn:0,age:0,cd:1e9,elite:1}));o.g=+P.gauge.toFixed(6);o.pu=G.pus.length;G.pus=[];G.vol=[];G.freeze=0;
    return JSON.stringify(o);})()`);
  const lab = r.mod && r.tx.includes(MODS[r.mod]);
  const ok = r.vif >= 60 && r.blinde >= 60 && r.volatil >= 60 && !r.autre && r.hp.vif === 2 && r.hp.blinde === 2.4 && r.hp.volatil === 2.4 && r.r === 1.3 && lab && r.g === .12 && r.pu >= 1;
  return { ok, detail: 'vive ' + r.vif + ', blindée ' + r.blinde + ', volatile ' + r.volatil + ', sans modificateur ' + r.autre + ' ; PV ×' + JSON.stringify(r.hp) + ', rayon ×' + r.r + ' ; éclosion (' + r.mod + ') : « ' + r.tx.join(' | ') + ' » ; abattue : jauge ' + r.g + ', ' + r.pu + ' power-up' };
});
/* une Blindée (un Tireur élite, cd gelé) à 200 u à l'est de la bulle, bouclier vers elle ; un tir de base (1 dégât, sans critique) posé
   juste devant elle, côté bulle (de face) ou côté opposé (de dos) */
function blindee(seed, dos) {
  const H = arene(seed), z = zone(H, 560, 420);
  if (!z) return null;
  H.call(`(()=>{const P=G.p;P.x=${z[0] + 120};P.y=${z[1] + 210};G.cx=P.x;G.cy=P.y;const e=mkEnemy('spread',P.x+200,P.y,{spawn:0,age:0,cd:1e9,elite:1});e.mod='blinde';e.sa=Math.PI;e.hp=e.mhp=100;
    G.fx=[];pbul(e.x${dos ? '+' : '-'}(e.r+8),e.y,${dos ? 'Math.PI' : '0'},{dmg:1,crit:false,pierce:0,split:0,rico:0,home:0});window.__E=e;})()`);
  H.steps(2);
  return J(H, `JSON.stringify({d:+(100-window.__E.hp).toFixed(4),bl:G.fx.filter(f=>f.ty===7&&f.col==='#ffffff').length,pb:G.pb.length})`);
}
check('V15 Élite blindée : un tir de face (bouclier tourné vers la bulle) fait ×0,2 et lance des étincelles blanches ; un tir dans le dos ×1,5', () => {
  const a = blindee(4321, false), b = blindee(4322, true);
  if (!a || !b) return { ok: false, detail: 'aucune zone libre' };
  return { ok: Math.abs(a.d - .2) < 1e-9 && a.bl >= 3 && Math.abs(b.d - 1.5) < 1e-9 && b.bl === 0, detail: 'de face : ' + a.d + ' dégât (étincelles blanches ' + a.bl + ') ; de dos : ' + b.d + ' (étincelles blanches ' + b.bl + ')' };
});
check('V15 visée : une Blindée bouclier face à la bulle (150 u) n’est pas « à découvert » : le tir automatique lui préfère un Tireur à 300 u ; seule, elle reste visée', () => {
  const H = arene(4323), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const r = J(H, `(()=>{const P=G.p;P.x=${z[0] + 310};P.y=${z[1] + 210};G.cx=P.x;G.cy=P.y;const b=mkEnemy('spread',P.x+150,P.y,{spawn:0,age:0,cd:1e9,elite:1});b.mod='blinde';b.sa=Math.PI;
    const t=mkEnemy('spread',P.x-300,P.y,{spawn:0,age:0,cd:1e9});const a=findTarget(P.x,P.y,700,true);G.en=[b];const s=findTarget(P.x,P.y,700,true);b.sa=0;G.en=[b,t];const d=findTarget(P.x,P.y,700,true);G.en=[];
    return JSON.stringify({a:a===t?'Tireur':a===b?'Blindée':'rien',s:s===b?'Blindée':'rien',d:d===b?'Blindée':d===t?'Tireur':'rien'});})()`);
  return { ok: r.a === 'Tireur' && r.s === 'Blindée' && r.d === 'Blindée', detail: 'avec le Tireur : ' + r.a + ' ; seule : ' + r.s + ' ; bouclier tourné ailleurs : ' + r.d };
});
check('V15 Élite volatile : sa mort arme une explosion (110 u) qui blesse la bulle à 80 u au 36ᵉ pas, pas avant, et un voisin (,6 × sa vie) ; à 200 u, rien ; un dash au bon moment : esquive parfaite', () => {
  const pose = (seed, d) => { const H = arene(seed); H.call(`(()=>{const P=G.p;P.inv=0;P.dashing=0;const e=mkEnemy('spread',P.x+${d},P.y,{spawn:0,age:0,cd:1e9,elite:1});e.mod='volatil';
    window.__F=mkEnemy('spread',P.x+${d},P.y+60,{spawn:0,age:0,cd:1e9,stun:1e9});window.__s0=P.seg;G.perfs=0;killEnemy(e);G.freeze=0;G.pus=[];})()`); return H; };
  const etat = H => J(H, 'JSON.stringify({s:window.__s0-G.p.seg,v:(G.vol||[]).length,f:+(window.__F.hp/window.__F.mhp).toFixed(3),p:G.perfs||0})');
  const H = pose(4324, 80); H.steps(35); const a = etat(H); H.steps(1); const b = etat(H);
  const H2 = pose(4325, 200); H2.steps(40); const c = etat(H2);
  const H3 = pose(4326, 80); H3.steps(35); H3.call('G.p.perf=0;G.p.dashing=5;G.p.dvx=G.p.dvy=0;'); H3.steps(1); const d = etat(H3);
  const ok = a.s === 0 && a.v === 1 && a.f === 1 && b.s === 1 && b.v === 0 && Math.abs(b.f - .4) < .001 && c.s === 0 && c.v === 0 && d.s === 0 && d.p === 1;
  return { ok, detail: 'à 80 u : pas 35 ' + a.s + ' segment perdu (' + a.v + ' explosion armée), pas 36 ' + b.s + ' (voisin à ' + b.f + ' de sa vie) ; à 200 u : ' + c.s + ' ; dash au pas 36 : ' + d.s + ' segment, ' + d.p + ' esquive parfaite' };
});
check('V15 Élite vive : ×1,5 plus rapide, sa recharge fond ×1,6, une traînée (FX ty 3)', () => {
  const H = arene(4327), z = zone(H, 560, 420);
  if (!z) return { ok: false, detail: 'aucune zone libre' };
  const r = J(H, `(()=>{const P=G.p;P.x=${z[0] + 280};P.y=${z[1] + 210};G.cx=P.x;G.cy=P.y;G.fx=[];const v=mkEnemy('spread',P.x+250,P.y,{spawn:0,age:0,cd:1e9,elite:1});v.mod='vif';const n=mkEnemy('spread',P.x-250,P.y,{spawn:0,age:0,cd:1e9});
    for(let i=0;i<60;i++){G.t++;updEnemy(v);updEnemy(n);}const sv=Math.hypot(v.vx,v.vy),sn=Math.hypot(n.vx,n.vy);v.cd=n.cd=1000;v.st=n.st=0;
    for(let i=0;i<10;i++){updEnemy(v);updEnemy(n);}const o={k:+(sv/sn).toFixed(3),dv:+(1000-v.cd).toFixed(3),dn:+(1000-n.cd).toFixed(3),tr:G.fx.filter(f=>f.ty===3&&f.col===v.col).length};G.en=[];return JSON.stringify(o);})()`);
  return { ok: r.k >= 1.4 && r.k <= 1.6 && Math.abs(r.dv / r.dn - 1.6) < 1e-6 && r.tr >= 10, detail: 'vitesse ×' + r.k + ' ; recharge en 10 pas : ' + r.dv + ' contre ' + r.dn + ' ; traînée ' + r.tr + ' FX' };
});
check('V15 conseils justes : l’Élite vive « attaque » plus vite (aux îlots 1-2 ce sont des Mites et des Épines, qui ne tirent pas) ; la Contre-attaque dure « un instant » (75 pas)', () => {
  /* revue du 13/10/2026 : « elle court et tire plus vite » sur une Mite ; « tous tes tirs sont critiques » lu comme permanent */
  const H = arene(4328);
  const r = J(H, `(()=>{const P=G.p;G.toasts=[];G.tut={};const T=[],_t=toast;toast=function(s){T.push(s);return _t.apply(this,arguments);};
    eliteIn(Object.assign(mkEnemy('mite',P.x+200,P.y,{spawn:0,age:0}),{mod:'vif'}));P.dashing=0;P.perf=0;perfect(P.x+20,P.y);toast=_t;G.en=[];return JSON.stringify(T);})()`);
  const v = r.find(s => /Élite vive/.test(s)) || '', c = r.find(s => /Contre-attaque/.test(s)) || '';
  return { ok: /attaque plus vite/.test(v) && !/tire/.test(v) && /un instant/.test(c) && c.length <= 80, detail: '« ' + v + ' » ; « ' + c + ' » (' + c.length + ' caractères)' };
});
{
  /* contexte 2D qui journalise stroke (couleur/épaisseur), arc (rayon) et fill */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && (p === 'stroke' || p === 'arc' || p === 'fill') ? (...a) => { LOG.push(p === 'stroke' ? 's ' + base.strokeStyle + '/' + base.lineWidth : p === 'arc' ? 'a ' + Math.round(a[2]) : 'f'); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V15 dessin : la Blindée porte un arc blanc (épaisseur 4) ; la Volatile est cernée de rouge et de blanc en alternance (8 images) ; l’explosion annoncée : deux arcs rouges, jamais remplie', () => {
    const H = arene(4328, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const d = (mod, fr) => { H.call(`window.__D=mkEnemy('spread',G.p.x+150,G.p.y,{spawn:0,age:0,cd:1e9,elite:1});window.__D.mod='${mod}';FRAME=${fr};`); LOG = []; H.call('drawEnemy(window.__D)'); const l = LOG; LOG = null; return l; };
    const rd = H.call('COL.rd'), bl = d('blinde', 16), vi = d('vif', 16), v8 = d('volatil', 8), v16 = d('volatil', 16);
    const bouclier = l => l.includes('s #ffffff/4'), rouge = l => l.some(x => x.startsWith('s ' + rd + '/'));
    H.call('G.vol=[{x:G.p.x+100,y:G.p.y,t:20,r:110}];'); LOG = []; H.call('drawVol()'); const vo = LOG; LOG = null;
    const ok = bouclier(bl) && !bouclier(vi) && rouge(v8) && !rouge(v16) && vo.filter(x => x[0] === 'a').length === 2 && vo.filter(x => x[0] === 's').length === 2 && vo.every(x => x[0] !== 's' || x.startsWith('s ' + rd)) && !vo.includes('f');
    return { ok, detail: 'Blindée : ' + (bouclier(bl) ? 'bouclier' : 'pas de bouclier') + ', Vive : ' + (bouclier(vi) ? 'bouclier' : 'rien') + ' ; Volatile image 8 : ' + (rouge(v8) ? 'rouge' : 'blanche') + ', image 16 : ' + (rouge(v16) ? 'rouge' : 'blanche') + ' ; explosion : ' + vo.join(' ') };
  });
}

/* ================= V16 : COURBE =================
   tu dépasses tes ennemis : le type de l'îlot d'avant (âge 1, encore hostile) naît à FODA de sa vie (il demandait ~10 % de tirs EN
   PLUS qu'à ses débuts) ; lourds allégés (Gatling 7, Pulsar 7,5, Porteur 12) ; un ennemi touché dégonfle à vue (sa zone de touche
   reste e.r). La pente de vie (+8 %/îlot) et celle des boss (+10 %) que proposait COURBE sont devenues +12 % et +18 % avec la passe
   d'équilibrage (voir g2.js, PRAD). Allure intégrée : pilote invulnérable, premier bonus, graines 1 à 3 (les parties de V7, menées
   jusqu'au bout de l'îlot 6). */
check('V16 îlot 4 : un type d’âge 1 naît à FODA (≤ ,7) de la vie de base (d.hp × HPM), le type de l’îlot à 1', () => {
  const H = arene(4330);
  const r = J(H, `(()=>{const k0=G.isl;G.isl=4;const a=mkEnemy(ETL[2],0,0,{spawn:0}),b=mkEnemy(ETL[3],0,0,{spawn:0});
    const o={a:a.hp/(a.d.hp*HPM()),b:b.hp/(b.d.hp*HPM()),age:[a.age,b.age],f:typeof FODA==='number'?FODA:null};G.en=[];G.isl=k0;return JSON.stringify(o);})()`);
  return { ok: r.f != null && r.f <= .7 && Math.abs(r.a - r.f) <= .01 && Math.abs(r.b - 1) < 1e-9, detail: 'FODA ' + r.f + ' ; Tireur (âge ' + r.age[0] + ') ' + r.a.toFixed(3) + ', Tireur d’élite (âge ' + r.age[1] + ') ' + r.b.toFixed(3) };
});
check('V16 chaque type, un îlot plus tard (âge 1), se tue en ≤ ,7 × les tirs de base qu’il demandait à son îlot (1,1 × avant)', () => {
  const H = arene(4331);
  const r = J(H, `(()=>{const k0=G.isl,o=[];for(let i=0;i<7;i++){const t=ETL[i],k=ET[t].isl,s=kk=>{G.isl=kk;const e=mkEnemy(t,0,0,{spawn:0});G.en=[];return e.hp/Math.pow(GROWD,kk-1);};
    const a=s(k),b=s(k+1);o.push([ET[t].n,+a.toFixed(1),+b.toFixed(1),+(b/a).toFixed(3)]);}G.isl=k0;return JSON.stringify(o);})()`);
  return { ok: r.every(x => x[3] <= .7), detail: r.map(x => x[0] + ' ' + x[1] + ' → ' + x[2] + ' (×' + x[3] + ')').join(', ') + ' tirs de base' };
});
/* allure : moyenne des graines 1 à 3, par îlot */
const allure = () => { const S = flux().slice(0, 3), A = {};
  for (let k = 1; k <= 6; k++) { const a = A[k] = { n: 0, play: 0, w: 0, wk: 0, pu: 0, m: 0, x2: 0 };
    for (const q of S) { if (!q[k]) continue; a.n++; a.play += q[k].play; a.w += q[k].w; a.wk += q[k].wk; a.pu += q[k].pu; if (q.M && q.M[k]) { a.m += q.M[k].n; a.x2 += q.M[k].x2; } } }
  return A; };
check('V16 allure (pilote invulnérable, premier bonus, graines 1 à 3) : îlot 1 en ≤ 50 s de jeu (~57 avant), îlot 4 en ≤ 120 s (~158)', () => {
  const A = allure(), t = k => A[k].n === 3 ? A[k].play / 60 / 3 : Infinity;
  return { ok: t(1) <= 50 && t(4) <= 120, detail: [1, 2, 3, 4, 5, 6].map(k => 'îlot ' + k + ' : ' + (A[k].n === 3 ? t(k).toFixed(1) + ' s' : A[k].n + ' / 3 partie(s)')).join(', ') };
});
check('V16 îlot 4 : ≥ 1,2 kill par seconde de vague (~,46 avant)', () => {
  const A = allure(), v = k => A[k].w ? A[k].wk / (A[k].w / 60) : 0;
  return { ok: A[4].n === 3 && v(4) >= 1.2, detail: [1, 2, 3, 4, 5, 6].map(k => 'îlot ' + k + ' : ' + v(k).toFixed(2) + '/s').join(', ') };
});
check('V16 îlots 1 à 6 : ≥ 50 % des kills à ×2 ou plus (série de 10 et plus ; 2 à 20 % avant), sur chaque îlot', () => {
  const A = allure(), p = k => A[k].m ? A[k].x2 / A[k].m : 0;
  return { ok: [1, 2, 3, 4, 5, 6].every(k => A[k].n === 3 && p(k) >= .5), detail: [1, 2, 3, 4, 5, 6].map(k => 'îlot ' + k + ' : ' + (100 * p(k)).toFixed(0) + ' % de ' + A[k].m).join(', ') };
});
check('V16 îlots 1 à 6 : un power-up chronométré actif ≥ 25 % du temps de jeu, sur chaque îlot', () => {
  const A = allure(), p = k => A[k].play ? A[k].pu / A[k].play : 0;
  return { ok: [1, 2, 3, 4, 5, 6].every(k => A[k].n === 3 && p(k) >= .25), detail: [1, 2, 3, 4, 5, 6].map(k => 'îlot ' + k + ' : ' + (100 * p(k)).toFixed(0) + ' %').join(', ') };
});
{
  /* contexte 2D qui journalise le demi-grand axe des ellipse (le Porteur se trace en ellipse) */
  let LOG = null;
  const jrn = () => { const base = L.mkCtx(); return new Proxy({}, { get: (t, p) => (LOG && p === 'ellipse' ? (...a) => { LOG.push(a[2]); } : base[p]), set: (t, p, v) => { base[p] = v; return true; } }); };
  check('V16 dessin : touché, un ennemi dégonfle (à 10 % de vie, tracé × ,865 ; sa zone de touche reste e.r) ; une proie non', () => {
    const H = arene(4332, { mkCtx: jrn });
    H.call('render(1,16.7)');
    const d = (age, f) => { H.call(`window.__D=mkEnemy('spawner',G.p.x+200,G.p.y,{spawn:0,age:${age},cd:1e9,wob:0});window.__D.hp=window.__D.mhp*${f};RT=0;`); LOG = []; H.call('drawEnemy(window.__D)'); const l = LOG[0]; LOG = null; return { rx: l, r: H.call('window.__D.r') }; };
    const a = d(0, 1), b = d(0, .1), c = d(2, 1), e = d(2, .1), k = b.rx / a.rx;
    return { ok: Math.abs(k - .865) < .002 && b.r === a.r && c.rx === e.rx, detail: 'Porteur à 10 % : tracé ×' + k.toFixed(3) + ' (rayon de touche ' + a.r + ' → ' + b.r + ') ; proie : ' + c.rx.toFixed(2) + ' → ' + e.rx.toFixed(2) };
  });
}

/* PASSE D'ÉQUILIBRAGE (COURBE, la plus risquée : tout le plan s'y juge) : le pilote NATUREL (partie(), ci-dessus), 40 min de jeu au
   plus par partie, chacune dans son processus (--partie=), autant à la fois que de cœurs. Deux jeux de 48 graines : 1-48 (celui
   sur lequel on règle) et 49-96 (TENU À L'ÉCART : on ne règle pas dessus) ; chacun doit tenir le seuil. Revue du 13/10/2026 : les
   12 graines d'avant (1-11 et 12345) avaient servi à régler EBK, ECD, WV3, HPM et la pente des boss jusqu'à passer (4 sur 12), quand
   les graines 12 à 103 gagnaient à 55-58 % ; la graine 12345 n'est qu'UN tirage (une défaite à ~45 % de chances avec ce réglage-là) :
   ne jamais régler une constante du jeu pour la seule faire basculer. */
async function longue() {
  const os = require('os'), cp = require('child_process'), A = [...Array(48)].map((_, i) => i + 1), B = A.map(g => g + 48), S = A.concat(B, [12345]);
  const une = seed => new Promise(ok => { let o = '';
    const c = cp.spawn(process.execPath, [__filename, '--partie=' + seed].concat(REF ? ['--ref=' + REF] : []), { stdio: ['ignore', 'pipe', 'inherit'] });
    c.stdout.on('data', d => { o += d; }); c.on('close', () => { const l = o.split('\n').find(x => x.startsWith('PARTIE ')); ok(l ? JSON.parse(l.slice(7)) : { seed, fin: null, isl: 0, min: 0, hu: {}, ht: {}, w: {}, lr: {}, err: 1 }); }); });
  const R = {}; let q = 0;
  await Promise.all([...Array(Math.max(1, os.cpus().length))].map(async () => { while (q < S.length) { const seed = S[q++]; const r = R[seed] = await une(seed);
    console.log('  graine ' + String(seed).padStart(5) + ' : ' + (r.fin === true ? 'VICTOIRE' : r.fin === false ? 'défaite à l’îlot ' + r.isl : 'coupée (40 min) à l’îlot ' + r.isl) + ', ' + r.min.toFixed(1) + ' min ; touches (vague/îlot) ' +
      [1, 2, 3, 4, 5, 6, 7, 8].map(k => (r.hu[k] || 0) + '/' + (r.ht[k] || 0)).join(' ')); } }));
  const jeu = (G, nom) => { const L2 = G.map(g => R[g]), win = L2.filter(r => r.fin === true).length, ok12 = L2.filter(r => !(r.fin === false && r.isl <= 2)).length;
    check('V16 équilibre (--long, pilote naturel, graines ' + nom + ') : ≤ 50 % de victoires', () => ({ ok: win <= G.length / 2, detail: win + ' / ' + G.length + ' (' + Math.round(100 * win / G.length) + ' %)' }));
    check('V16 équilibre (graines ' + nom + ') : aucune mort aux îlots 1 et 2 dans ≥ 83 % des graines', () => ({ ok: ok12 >= .83 * G.length, detail: ok12 + ' / ' + G.length + ' (morts aux îlots 1-2 : ' + (L2.filter(r => r.fin === false && r.isl <= 2).map(r => r.seed + ' à l’îlot ' + r.isl).join(', ') || 'aucune') + ')' })); };
  jeu(A, '1 à 48'); jeu(B, '49 à 96, tenues à l’écart');
  const T = A.concat(B).map(g => R[g]), tot = R[12345];
  check('V16 équilibre : la graine 12345 (la partie « naturelle » de headless.js) est perdue — un tirage, pas une garantie', () => ({ ok: tot.fin === false, detail: tot.fin === false ? 'défaite à l’îlot ' + tot.isl : tot.fin ? 'VICTOIRE' : 'coupée à 40 min' }));
  const h34 = T.reduce((s, r) => s + (r.hu[3] || 0) + (r.hu[4] || 0), 0), w34 = T.reduce((s, r) => s + (r.w[3] || 0) + (r.w[4] || 0), 0) / 3600;
  check('V16 équilibre : ≥ 2 touches par minute de vague aux îlots 3 et 4', () => ({ ok: w34 > 0 && h34 / w34 >= 2, detail: h34 + ' touches en ' + w34.toFixed(1) + ' min de vague : ' + (w34 ? (h34 / w34).toFixed(2) : '-') + '/min' }));
  /* revue du 13/10/2026 : l'îlot 7 (Pulsar) était devenu le plus facile du jeu (,30 touche par partie, contre 1,15 à 1,67 aux îlots
     3 à 5) et 45 des 46 parties qui l'atteignaient gagnaient : la fin de la courbe doit rester une montée */
  const T7 = T.filter(r => r.isl >= 7), m = (L2, ks) => L2.length ? L2.reduce((s, r) => s + ks.reduce((t, k) => t + (r.ht[k] || 0), 0), 0) / L2.length : 0, a78 = m(T7, [7, 8]), a34 = m(T7, [3, 4]);
  check('V16 équilibre : les parties qui atteignent l’îlot 7 y prennent, aux îlots 7-8, au moins autant de touches qu’aux îlots 3-4', () => ({ ok: T7.length >= 10 && a78 >= a34, detail: T7.length + ' parties : ' + a78.toFixed(2) + ' touches par partie aux îlots 7-8, ' + a34.toFixed(2) + ' aux îlots 3-4 (par îlot : ' + [3, 4, 5, 6, 7, 8].map(k => k + ' ' + m(T7, [k]).toFixed(2)).join(', ') + ')' }));
  /* revue du 13/10/2026 : 60 % des Gatlings de l'îlot 6 et 67 % des Pulsars de l'îlot 7 mouraient sans avoir tiré */
  const lr = k => T.reduce((s, r) => { const a = r.lr[k] || [0, 0]; return [s[0] + a[0], s[1] + a[1]]; }, [0, 0]), g6 = lr('g6'), r7 = lr('r7'), s4 = lr('s4'), pc = a => a[0] ? Math.round(100 * a[1] / a[0]) + ' %' : '-';
  check('V16 équilibre : ≥ 50 % des Gatlings (îlot 6) et des Pulsars (îlot 7) tirent avant de mourir', () => ({ ok: g6[0] >= 20 && r7[0] >= 20 && g6[1] >= g6[0] / 2 && r7[1] >= r7[0] / 2, detail: 'Gatlings ' + g6[1] + ' / ' + g6[0] + ' (' + pc(g6) + '), Pulsars ' + r7[1] + ' / ' + r7[0] + ' (' + pc(r7) + ') ; Tireurs d’élite (îlot 4) ' + s4[1] + ' / ' + s4[0] + ' (' + pc(s4) + ')' }));
}

(async () => {
if (LONG && (!SEUL || 'V16 équilibre'.startsWith(SEUL.slice(0, 14)))) await longue();
console.log('test/vivacite.js — ' + (REF ? 'code ' + REF : 'arbre de travail') + (SEUL ? ' — SEULS les critères « ' + SEUL + '… »' : ''));
for (const c of checks) console.log((c.ok ? '  OK    ' : '  ECHEC ') + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'VIVACITÉ : TOUT PASSE' : 'VIVACITÉ : ECHEC');
process.exit(all ? 0 : 1);
})();
