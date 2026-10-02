'use strict';
/* =========================================================
   Garde-fou des ÉCRANS D'INTERFACE (menus, pause, choix d'un bonus, fin) — fluidité complète, 01/10/2026.

   Le défaut : derrière chaque écran d'interface, la boucle redessinait le canevas (menu principal : le monde ENTIER une
   image sur deux, caméra en dérive ; pause : une recopie plein écran une image sur quatre ; évolution, duel, fin : le
   monde figé, redessiné quand même). Par-dessus, `.ov` floutait le fond (`backdrop-filter:blur(4px)`) : chaque retouche
   du canevas obligeait le navigateur à refaire le flou plein écran. Mesuré (Chromium, canevas et composition logiciels,
   1920x1080, comme le Firefox du propriétaire) : menu principal 15 à 18 ips, pause 28, évolution 16 ; sans flou ET
   fond figé : 60 partout.

   Ce que ce test défend :
     M1. menu principal : après une mise en place bornée, plus AUCUNE opération sur le canevas principal ni génération
         de chunk à chaque image (le fond est figé) ;
     M2. pause, choix d'un bonus, fin, entrées depuis le jeu : aucune opération dès la première image (la dernière image
         reste) ;
     M3. un applyRes() (redimensionnement, qualité) vide le canevas : exactement UN rendu, puis plus rien ;
     M4. retour au jeu : le canevas est de nouveau dessiné à chaque image ;
     M5. après une mort, revenir au menu ne laisse pas le canevas assombri (classe `dying`) ;
     M6. CSS : aucun `backdrop-filter`, aucun `filter` dans une animation (@keyframes), `#cv.dying` sans `filter`.
     M7. redimensionnement sur le menu figé : le fond n'est refigé qu'une fois les chunks devenus visibles cuits ;
     M8. menu figé en ville : pas de façade de tour manquante sur l'image figée (textures absentes du fil principal
         quand le worker a cuit les chunks : drawTowers n'en prépare qu'une par image).

   Refonte en îlots (02/10/2026) — mêmes critères, situations équivalentes :
     - M2 : les états figés sont désormais 'pause', 'pick' (choix d'un bonus, l'ancien 'evo') et 'end' (render, g3.js) ;
       'duel' a disparu avec le duel tactique (gx.js). On y ENTRE par les vraies fonctions (togglePause, openPick hors
       simulation, et pour la fin une vraie mort jouée jusqu'à endRun), au lieu d'écrire G.state ;
     - M5/M8 : le menu montre l'îlot 1 (Plaines) au lancement, plus de ville ; mais après une mort, « Menu » garde l'îlot
       où l'on est mort (bMenu ne régénère pas le monde). On meurt donc dans la Mégapole (îlot 6) : le menu figé montre
       la ville, et M7/M8 se jouent sur ce menu-là. La caméra du menu dérive autour de la relique (RELR) : on cherche une
       place où des tours sont à l'écran.

   node test/menus.js                arbre de travail
   node test/menus.js --ref=<commit> un commit de la refonte en îlots ou plus récent (états 'pick', genIslet) ; le témoin
                                     d'avant le correctif reste l'ancienne version : git show 6717bb4:test/menus.js
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');
let VW = 1920, VH = 1080;

/* ---------- contexte 2D : compte les opérations sur le canevas principal ---------- */
const OPS = { n: 0, main: null };
function mkCtx(el) {
  if (el.__ctx) return el.__ctx;
  const grad = { addColorStop() {} };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: (s || '').length * 7 }),
  };
  const c = new Proxy(base, { get: (t, p) => (p in st ? st[p] : p in t ? t[p] : function () { if (this && this.__cv === OPS.main) OPS.n++; }), set: (t, p, v) => ((p in st ? st : t)[p] = v, true) });
  c.__cv = el; el.__ctx = c;
  return c;
}
const H = L.mkGame({ ref: REF, w: VW, h: VH, mkCtx });
const call = H.call;
if (call("typeof genIslet") !== 'function') { console.log(`test/menus.js — ${REF}\n  ECHEC ce commit précède la refonte en îlots (pas de genIslet) : voir git show 6717bb4:test/menus.js`); process.exit(1); }
/* la taille de la fenêtre suit VW/VH (redimensionnement du M7) */
H.doc.getElementById('cv').parentElement.getBoundingClientRect = () => ({ left: 0, top: 0, right: VW, bottom: VH, width: VW, height: VH, x: 0, y: 0 });

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
H.boot();
OPS.main = call('MAINCTX').__cv;
call(`(function(){const g=genChunk;globalThis.__GEN=0;genChunk=function(){__GEN++;return g.apply(this,arguments);};})()`);
/* une image de la vraie boucle : frame(ts), 16,7 ms plus tard (horloge de test/lib.js : ts = performance.now()) ;
   renvoie le nombre d'opérations sur le canevas principal */
const img = () => { OPS.n = 0; call('__GEN=0'); H.advance(16.7); call(`frame(${H.clock()})`); return { n: OPS.n, gen: call('__GEN') }; };
const imgs = k => { let n = 0, gen = 0; for (let i = 0; i < k; i++) { const r = img(); n += r.n; gen += r.gen; } return { n, gen }; };
call(`DPR=1;QL=3;RES=1;resize();applyRes();perf=function(){};`);

/* ---------- M1. menu principal ---------- */
{
  call(`G=null;show('ov-menu');`);
  const mise = imgs(400), apres = imgs(120);
  check('M1. menu principal : fond figé après une mise en place bornée (aucune opération, aucun chunk généré)', apres.n === 0 && apres.gen === 0,
    `îlot ${call('WD.isl')} (${call('WD.sites[0].t')}) ; mise en place (400 images) : ${mise.n} opérations ; ensuite (120 images) : ${apres.n} opérations, ${apres.gen} chunks générés`);
}
/* ---------- M2. écrans entrés depuis le jeu ---------- */
H.start();
call(`show(null);G.state='play';`);
{
  const jeu = imgs(30);
  const res = [];
  /* pause : la vraie bascule (Échap) */
  imgs(4); call('togglePause();'); { const st = call('G.state'), r = imgs(40); res.push(st + ' ' + r.n); } call('togglePause();');
  /* choix d'un bonus : le vrai openPick (hors simulation il ouvre l'écran au lieu de choisir), puis une vraie carte */
  imgs(4); H.noSim('openPick()'); { const st = call('G.state'), r = imgs(40); res.push(st + ' ' + r.n); } H.noSim('pickCard(0)');
  check('M2. pause, choix d\'un bonus : aucune opération sur le canevas dès la première image', res.length === 2 && res[0].startsWith('pause ') && res[1].startsWith('pick ') && res.every(s => / 0$/.test(s)) && jeu.n > 0,
    `en jeu (30 images) : ${jeu.n} opérations ; puis ${res.join(', ')} ; retour : ${call('G.state')}`);
  /* ---------- M3. applyRes en pause ---------- */
  imgs(4); call('togglePause();'); imgs(8);
  call('applyRes();'); const r1 = imgs(4), r2 = imgs(40);
  check('M3. applyRes() en pause : le canevas vidé est redessiné une fois, puis plus rien', call('G.state') === 'pause' && r1.n > 0 && r2.n === 0, `4 images après applyRes : ${r1.n} opérations ; 40 suivantes : ${r2.n}`);
  /* ---------- M4. retour au jeu ---------- */
  call('togglePause();'); let zero = 0; for (let i = 0; i < 20; i++) if (img().n === 0) zero++;
  check('M4. retour au jeu : le canevas est redessiné à chaque image', call('G.state') === 'play' && zero === 0, `${zero}/20 images sans opération`);
}
/* ---------- M2 (fin) et M5. une vraie mort dans la Mégapole, jusqu'à l'écran de fin, puis « Menu » ---------- */
{
  call(`G.isl=6;genIslet(G.seed,6);islStart();G.state='play';`); imgs(30);
  call('die();'); const avant = call(`cv.classList.contains('dying')`);
  /* la mort se joue (updDying, ralentie) jusqu'à endRun : l'image où l'état bascule compte déjà */
  let bascule = null, k = 0;
  for (; k < 600 && bascule === null; k++) { const r = img(); if (call('G.state') === 'end') bascule = r.n; }
  const fin = imgs(40);
  check('M2. fin (vraie mort jouée jusqu\'à endRun) : aucune opération sur le canevas dès l\'image de la bascule', bascule === 0 && fin.n === 0,
    `bascule en 'end' après ${k} images (${bascule === null ? 'jamais' : bascule + ' opération(s) sur cette image'}) ; 40 suivantes : ${fin.n}`);
  call(`document.getElementById('bMenu').onclick&&document.getElementById('bMenu').onclick();`);
  const reste = call(`cv.classList.contains('dying')`);
  check('M5. mort puis « Menu » : le canevas n\'est plus assombri', avant && !reste && call('G') === null, `classe dying : à la mort ${avant}, au menu ${reste} ; G ${call('G===null?"nul (menu)":G.state')}`);
}
/* ---------- M6. CSS ---------- */
{
  const sh = L.readModule('shell_head.html', REF), bad = [];
  if (/backdrop-filter/.test(sh)) bad.push('backdrop-filter');
  for (const m of sh.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) if (/filter\s*:/.test(m[2])) bad.push('@keyframes ' + m[1] + ' anime filter');
  const dy = sh.match(/#cv\.dying\s*\{([^}]*)\}/); if (dy && /filter\s*:/.test(dy[1])) bad.push('#cv.dying : filter');
  check('M6. CSS : ni backdrop-filter, ni filter animé, ni filtre sur le canevas à la mort', bad.length === 0, bad.join(' ; ') || 'aucun');
}

/* ---------- M7. redimensionnement sur le menu figé ---------- */
/* `img()` puis `bgPret()` : l'état du monde que montre la dernière image dessinée. Une fenêtre plus basse dézoome le menu :
   des chunks neufs entrent à l'écran. Le fond ne doit pas se refiger sur la première image redessinée s'ils ne sont pas prêts. */
/* figé = 8 images de suite sans opération (le menu ne redessine qu'une image sur deux) ; k = images redessinées avant */
const figeA = () => { let pret = null, k = 0, z = 0; for (let i = 0; i < 400 && z < 8; i++) { if (img().n === 0) z++; else { z = 0; k++; pret = call('bgPret()'); } } return { pret, k }; };
{
  imgs(400);
  VW = 1920; VH = 560; call('resize();');
  const r = figeA();
  check('M7. redimensionnement sur le menu figé (la Mégapole) : le fond n\'est refigé qu\'une fois le monde visible prêt', r.pret === true && r.k < 400,
    `${r.k} image(s) redessinée(s) avant de refiger ; monde prêt sur la dernière : ${r.pret}`);
  VW = 1920; VH = 1080; call('resize();'); imgs(400);
}
/* ---------- M8. façades de la ville sur le menu figé ---------- */
/* Avec le worker, les chunks de la ville sont cuits ailleurs : les textures de façade (FACS) n'existent pas encore sur le fil
   principal, et drawTowers en prépare une par image. Ici, monde cuit sur place puis FACS vidé = la situation du worker.
   La caméra du menu (render, g3.js) dérive autour de la relique : on prend le premier instant MRT où au moins trois tours
   sont à l'écran. */
{
  const rt = call(`(function(){const z=Math.min(W,H)/760,hw=W/2/z,hh=H/2/z;for(let r=0;r<2e5;r+=25){const x=Math.cos(r*.0007)*RELR*1.6,y=Math.sin(r*.00091)*RELR*1.3;let n=0;
    for(let cx=Math.floor((x-hw)/CH);cx<=Math.floor((x+hw)/CH);cx++)for(let cy=Math.floor((y-hh)/CH);cy<=Math.floor((y+hh)/CH);cy++){const c=getChunk(cx,cy);if(c)for(const o of c.obs)if(o.b==='urban'&&Math.abs(o.cx-x)<hw&&Math.abs(o.cy-y)<hh)n++;}
    if(n>=3)return r;}return -1;})()`);
  call(`(function(){const d=drawTowers;globalThis.__TW=0;drawTowers=function(){__TW=Math.max(__TW,TWL.length);return d.apply(this,arguments);};})()`);
  call(`MRT=${rt};CVOK=false;BGK='';BGN=0;`); imgs(400);
  call(`FACS.length=0;CVOK=false;BGK='';BGN=0;`); const r = figeA();
  const tours = call('__TW'), n0 = call('FACS.filter(Boolean).length'), bio = call('WD.sites[0].t');
  for (let i = 0; i < 20; i++) { call('CVOK=false;'); img(); }
  const n1 = call('FACS.filter(Boolean).length');
  check('M8. menu figé sur la ville : aucune façade encore manquante sur l\'image figée', bio === 'urban' && rt >= 0 && tours > 0 && n0 > 0 && n1 === n0,
    `menu sur l'îlot ${bio}, caméra avec des tours : ${rt >= 0} ; ${tours} tour(s) à l'écran ; figé après ${r.k} image(s) avec ${n0} façade(s) prête(s), 20 rendus forcés ensuite en préparent ${n1 - n0} de plus`);
}

console.log(`test/menus.js — ${REF ? 'code ' + REF : 'arbre de travail'}`);
for (const c of checks) console.log((c.ok ? '  OK   ' : '  ECHEC') + ' ' + c.name + '\n         ' + c.detail);
const all = checks.every(c => c.ok);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
