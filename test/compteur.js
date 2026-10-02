'use strict';
/* =========================================================
   Garde-fou du COMPTEUR DE DIAGNOSTIC (le bloc du bas, quand `meta.fps` est vrai).

   Ce que ce test defend, dans cet ordre :
     1. **Le compteur tient dans l'ecran.** Constat du 29/09/2026 sur Galaxy S22 : canvas de
        617 px de large pour 411 px de largeur de DESSIN (PS 1.50) — les lignes « PS … marge
        audio » et « ou : … » debordaient des DEUX cotes et etaient illisibles. Le compteur est
        l'instrument avec lequel le joueur mesure : s'il est coupe, il ne sert a rien.
     2. **L'etat de la cuisson est affiche.** Sans worker, le jeu retombe SILENCIEUSEMENT sur la
        cuisson sur place ; sans ce mot a l'ecran, une comparaison « avec / sans ?wk=1 » peut
        comparer deux fois le meme chemin sans que personne ne s'en apercoive.
     4. **Le compteur ne chevauche AUCUN bouton** (S7). Constat du 30/09/2026 sur capture : avec 5
        lignes, « worker 558 », « marge audio » et « soft » passaient PAR-DESSUS le bouton AUTEL.
        L'ancre d'avant (H-132) ne connaissait que le bouton de dash ; les emplacements de
        competence de gcSlots() (gc.js) montaient jusqu'a H-207. Le critere est geometrique et
        independant du code teste : rectangle de chaque ligne (et du bandeau) contre le DISQUE de
        toucher de chaque bouton (rayon + 10, touchBtnAt de g4.js), positions lues dans les VRAIES
        dashBtn() et gonBtn() ; sur poste fixe (aucun bouton), contre le rectangle du rappel « E ou
        clic droit : gonfler » tel que drawHUD l'ECRIT. Et rien ne doit avoir disparu pour y arriver.
     5. **L'etat de la regulation est affiche** (S8) : « régul auto » ou « régul plafond <reglage> »,
        avec QL et RES reels, et « ↓ » quand la qualite est descendue SOUS son plafond. Un reglage qui
        n'adapte plus doit se LIRE — c'est le defaut que ce mot corrige (voir la note du S8).
     6. **La pire image dit ce qui s'y est passe** (S9, chantier J0) : son intervalle, SON JS (la meme
        image, pas deux maxima independants) et quatre compteurs d'evenements — genChunk, sprites
        d'obstacles crees, chunks recus du worker, cuissons collees pour la premiere fois. Verifie
        sur de VRAIES images avec un pic force et deux leurres.
     3. **La lisibilite ne coute pas la mesure** : la ligne « ou : » garde TOUJOURS ses postes
        les plus couteux (le tri est decroissant, on retire par la fin).

   On execute la VRAIE `drawHUD()` : modules charges dans un DOM stube (test/lib.js), on appelle drawHUD(),
   et on controle ce qui a REELLEMENT ete ecrit. Aucune copie du code du jeu.

   Refonte en ilots (02/10/2026) — memes criteres, sujets equivalents :
     - les boutons tactiles sont dashBtn() et gonBtn() (g3.js) : les emplacements de competence et l'AUTEL (gcSlots,
       gc.js) ont disparu. Les zones evitees par le bloc (ZB de drawHUD) sont les disques de ces deux boutons ;
     - le texte « Dash pret (Espace) » du poste fixe a disparu ; a sa place, en bas et au centre, le rappel « E ou clic
       droit : gonfler » quand la jauge est pleine. S4 et S7 (poste fixe) le gardent : le bloc reste au-dessus de y = H-pad
       ET ne coupe pas le rectangle du rappel reellement ecrit (jauge pleine pendant ces situations) ;
     - S9 : l'ilot n'a que 9×9 chunks, tous dans la fenetre que streamWorld habille de sprites ; il n'y a plus
       d'obstacle sans sprite « loin de la camera ». Les deux sprites du pic sont donc ceux de COPIES de deux vrais
       obstacles (o.spr vide), hors de tout chunk : ni le rendu ni le streaming ne les touchent avant ou apres.
     - « saut » (filet de budget, SKIPD) fait desormais partie de ce qui ne doit pas disparaitre (S7).
     Aucun critere retire.

   Le stub de canvas mesure le texte proportionnellement a la taille de police (le stub des
   autres tests ignore la police, ce qui rendrait ce garde-fou aveugle) et on fait tourner
   chaque situation avec une police etroite (0,50 em par caractere) ET large (0,68 em), pour
   que l'invariant ne depende pas des metriques de la police.

   node test/compteur.js                arbre de travail
   node test/compteur.js --ref=<commit> un autre commit, de la refonte en ilots ou plus recent (modules et debut de
                                        partie : test/lib.js). Avant la refonte les emplacements gcSlots() comptent
                                        comme boutons, mais le poste fixe echoue : pas de rappel « gonfler », et le
                                        texte « Dash pret (Espace) », pose en x=pad, est pris pour une ligne du bloc.
   Code de sortie : 0 si tout passe, 1 sinon.
   ========================================================= */
const L = require('./lib');
const REF = L.ARG('ref');

/* horloge de performance.now() propre a ce test (S9, S10 la reglent : __tick, __horloge) */
let CLOCK = 0;
/* avance moyenne d'un caractere, en em. 0,50 : police etroite ; 0,68 : police large. */
let EM = 0.50;
const FILLS = [];
const RECTS = [];

const pxOf = f => { const m = /(\d+(?:\.\d+)?)px/.exec(String(f || '')); return m ? parseFloat(m[1]) : 12; };
function mkCtx(el) {
  if (el.__ctx) return el.__ctx;
  const grad = { addColorStop() {} };
  const base = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => ({}),
    font: '12px x', textAlign: 'left', textBaseline: 'top', globalAlpha: 1, fillStyle: '#000',
    measureText: s => ({ width: String(s || '').length * EM * pxOf(base.font) }),
    fillText: (s, x, y) => { const t = String(s); FILLS.push({ s: t, x, y, w: t.length * EM * pxOf(base.font), px: pxOf(base.font), bl: base.textBaseline, al: base.textAlign }); },
    strokeText: (s, x, y) => { const t = String(s); FILLS.push({ s: t, x, y, w: t.length * EM * pxOf(base.font) }); },
    fillRect: (x, y, w, h) => { RECTS.push({ x, y, w, h, fill: String(base.fillStyle) }); },
  };
  const c = new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => (t[p] = v, true) });
  el.__ctx = c;
  return c;
}
const H = L.mkGame({ ref: REF, mkCtx, sandbox: { performance: { now: () => CLOCK } } });
const sandbox = H.ctx;
const call = H.call;

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); };
const PAD = 14;   /* `pad` de drawHUD, g3.js */

H.start();
call(`G.state='play';meta.fps=true;inp.touch=true;`);

/* Joue le compteur dans une situation donnee et rend TOUTES les lignes ecrites par le bloc.
   Le bloc dessine a x=pad, en bas a gauche ; c'est le seul texte du HUD pose en x=pad avec la ligne de
   base « bottom » (ilots, vagues, boss, rappel « gonfler », bandeaux : centres ; score : a droite).
   o.jauge : jauge pleine (sur poste fixe, le rappel « E ou clic droit : gonfler » est alors ecrit, en bas). */
function drawBlock(o) {
  /* W/H sont les unites de DESSIN de l'interface (screenTf, g3.js : setTransform(PS,0,0,PS,0,0)) ;
     cv.width/height sont la surface reelle, PS fois plus grande. On reproduit exactement le S22 :
     617x1351 de surface pour 411x900 de dessin, donc PS 1.50. */
  call(`W=${o.W};H=${o.H};PS=${o.PS == null ? 1 : o.PS};cv.width=${o.cw || o.W};cv.height=${o.ch || o.H};`);
  call(`JSPROFTOP=${JSON.stringify(o.top || [])};FPSV=${o.ips == null ? 53 : o.ips};DIAG_DT=${o.dt == null ? 18.6 : o.dt};DIAG_JS=${o.js == null ? 6.6 : o.js};DIAG_PEAK=${o.peak == null ? 34 : o.peak};DIAG_MARGIN=${o.margin == null ? 0.89 : o.margin};`);
  /* la pire image (S9) est PRESENTE par defaut dans toutes les situations : c'est la mise en page la
     plus haute, donc celle que les criteres de largeur et de chevauchement (S1-S8) doivent defendre.
     `worst: null` = rien de publie. Sur un commit d'avant J0 cette affectation cree une globale que rien ne lit. */
  call(`DIAG_WORST=${JSON.stringify(o.worst === undefined ? WORST : o.worst)};`);
  call(`inp.touch=${o.deskt ? 'false' : 'true'};G.p.gauge=${o.jauge ? 1 : 0};G.p.gon=0;`);
  call(o.wk ? `WK={w:1};WKN=${o.wkn == null ? 37 : o.wkn};` : `WK=false;WKN=0;`);
  if (o.noWk) call(`WK=null;WKN=0;`);
  const before = FILLS.length;
  const rbefore = RECTS.length;
  call('drawHUD()');
  const lines = FILLS.slice(before).filter(f => f.x === PAD && f.bl === 'bottom');
  lines.rects = RECTS.slice(rbefore);
  /* le rappel « gonfler » du poste fixe, tel qu'il a ete ECRIT (centre, ligne de base « bottom ») */
  lines.rappel = FILLS.slice(before).filter(f => /gonfler/.test(f.s) && f.al === 'center').map(f => ({ s: f.s, x0: f.x - f.w / 2, x1: f.x + f.w / 2, y0: f.y - f.px, y1: f.y }));
  return lines;
}
const fits = (l, o) => l.x + l.w <= o.W - PAD + 0.5;
/* [intervalle, JS, genChunk, sprites, recus du worker, colles] — voir DIAG_W, g4.js */
const WORST =[34, 21.3, 2, 14, 1, 2];
const WKSTATE = 'worker 37';
/* Zone interdite du bouton de dash (dashBtn, g3.js) : centre (W-62, H-92), rayon 34. */
const dansDash = (l, o) => (l.x + l.w > o.W - 96) && (l.y > o.H - 126);
const fond = (L, o) => L.rects.find(r => /rgba\(8,5,18/.test(r.fill) && r.w >= Math.max(...L.map(l => l.w)) - 1 && r.y < Math.min(...L.map(l => l.y)));

/* La ligne « ou : » du joueur : 6 postes, celui du haut est le plus couteux. */
const TOP = [['render', 6.06, 12], ['glow', 1.28, 4], ['drawHUD', 1.09, 5], ['drawWeather', 1.04, 8], ['drawDistant', 0.92, 3], ['drawLabels', 0.71, 2]];

/* ================= S1 — le telephone du joueur (Galaxy S22) ================= */
{
  call(`WK={w:1};WKN=37;`);
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  EM = 0.50;
  const L = drawBlock(o);
  check('S22 : le bloc de diagnostic est ecrit', L.length >= 2, L.length + ' ligne(s) : ' + JSON.stringify(L.map(f => f.s.slice(0, 40))));
  check('S22 : AUCUNE ligne ne depasse la largeur de dessin', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('S22 : le compteur affiche la surface REELLE (617×1351 pour 411×900 de dessin)',
    L.some(f => f.s.indexOf('canvas 617×1351') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  check('S22 : la ligne des ips, de l\'image et du pire est presente', L.some(f => /ips · image .* · pire .* ms/.test(f.s)), L.map(f => f.s).find(s => s.indexOf('pire') > 0) || 'absente');
  check('S22 : la ligne JS / hors-JS est presente', L.some(f => f.s.indexOf('hors-JS') > 0), L.map(f => f.s).find(s => s.indexOf('hors-JS') > 0) || 'absente');
  check('S22 : l\'etat de la cuisson est affiche et nomme le worker', L.some(f => f.s.indexOf('cuisson ' + WKSTATE) >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  const ou = L.find(f => f.s.startsWith('où : '));
  check('S22 : la ligne « où » garde le poste le plus couteux', !!ou && ou.s.indexOf('render 6.06/12') >= 0, ou ? ou.s : 'absente');
  check('S22 : aucune ligne ne passe SOUS le bouton de dash (centre W-62, H-92, rayon 34)',
    L.every(l => !dansDash(l, o)), 'y max ' + Math.max(...L.map(l => l.y)) + ' / limite ' + (o.H - 132) + ' · droite max ' + Math.max(...L.map(l => l.x + l.w)) + ' / limite ' + (o.W - 96));
  check('S22 : le bloc a un fond sombre (lisible sur un terrain clair)', !!fond(L, o),
    L.rects.filter(r => /rgba\(8,5,18/.test(r.fill)).map(r => `${Math.round(r.w)}×${Math.round(r.h)} en ${Math.round(r.x)},${Math.round(r.y)}`).join(' ') || 'aucun');
}

/* ================= S2 — meme telephone, police LARGE (0,68 em) ================= */
{
  EM = 0.68;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  const L = drawBlock(o);
  check('S22, police large : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('S22, police large : la mesure reste complete (ips + hors-JS + cuisson)',
    L.some(f => f.s.indexOf('pire') > 0) && L.some(f => f.s.indexOf('hors-JS') > 0) && L.some(f => f.s.indexOf('cuisson ') >= 0),
    L.map(f => f.s).join(' | ').slice(0, 90));
}

/* ================= S3 — telephone etroit (320 px) ================= */
{
  EM = 0.50;
  const o = { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true };
  const L = drawBlock(o);
  check('320 px : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('320 px : l\'etat de la cuisson est toujours lisible', L.some(f => f.s.indexOf('cuisson ') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
}

/* ================= S4 — PC large : rien ne doit avoir ete casse ================= */
{
  const o = { W: 1536, H: 864, DPR: 1, COARSE: false, top: TOP, wk: true, jauge: true };
  o.deskt = true;
  const L = drawBlock(o);
  check('PC 1536 px : aucune ligne ne depasse', L.every(l => fits(l, o)),
    L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  check('PC 1536 px : le bloc reste compact (au plus 4 lignes)', L.length <= 4, L.length + ' lignes');
  check('PC 1536 px : la ligne « où » garde ses 6 postes', L.some(f => f.s.indexOf('drawLabels 0.71/2') > 0), L.map(f => f.s).find(s => s.startsWith('où : ')) || 'absente');
  check('PC 1536 px : le bloc reste au-dessus de la ligne du rappel « gonfler » (y = H-pad)',
    L.every(l => l.y <= o.H - PAD - 19.5), 'y max ' + Math.max(...L.map(l => l.y)) + ' / limite ' + (o.H - PAD - 20));
  const rp = L.rappel[0], bd = L.rects.filter(r => /rgba\(8,5,18/.test(r.fill));
  const coupeR = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const pb = rp ? L.map(l => ({ s: l.s, x0: l.x, x1: l.x + l.w, y0: l.y - l.px, y1: l.y })).concat(bd.map(r => ({ s: 'bandeau', x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }))).filter(r => coupeR(r, rp)) : [];
  check('PC 1536 px, jauge pleine : le bloc (et son bandeau) ne coupe pas le rappel « E ou clic droit : gonfler » ecrit en bas',
    !!rp && pb.length === 0, !rp ? 'rappel non ecrit' : pb.length ? pb.length + ' chevauchement(s) : ' + pb.map(r => '« ' + r.s.slice(0, 20) + ' »').join(', ') : '« ' + rp.s + ' » en y ' + rp.y0 + '..' + rp.y1 + ' ; bloc jusqu\'a y ' + Math.max(...L.map(l => l.y), ...bd.map(r => r.y + r.h)).toFixed(0));
}

/* ================= S5 — la cuisson sur place est dite, et non pas supposee ================= */
{
  EM = 0.50;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: false };
  const L = drawBlock(o);
  check('repli : le compteur dit « cuisson sur place »', L.some(f => f.s.indexOf('cuisson sur place') >= 0), L.map(f => f.s).join(' | ').slice(0, 90));
  const o2 = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, noWk: true };
  const L2 = drawBlock(o2);
  check('avant la premiere image : le compteur ne ment pas (cuisson ?)', L2.some(f => f.s.indexOf('cuisson ?') >= 0), L2.map(f => f.s).join(' | ').slice(0, 90));
}

/* ============ S6 — les nombres du compteur decrivent le JEU, et se correspondent ============
   Deux defauts corriges le 29/09/2026, gardes ici pour qu'ils ne reviennent pas :
   - les ips venaient d'un compteur de 500 ms qui avancait sur TOUTES les images ; les images de
     menu, de pause et d'ecran de fin (bien moins cheres) entraient donc dans la fenetre. Mesure sur
     l'appareil : 84 ips affiches pour un jeu qui en tenait 34 ;
   - « image : N ms » et « N ips » venaient de deux cumuls DIFFERENTS : les deux nombres de la meme
     ligne pouvaient ne pas se correspondre, et rien ne le disait.
   On appelle ici de VRAIES images (frame(ts)) avec une horloge controlee. */
{
  EM = 0.50;
  /* UNE seule horloge continue : frame() plafonne a 100 ms tout saut d'horloge, donc deux blocs
     separes avec des temps eloignes injecteraient une image a 100 ms dans la moyenne et fausseraient
     la mesure — c'est ce qui a fait echouer la premiere version de ce test, a juste titre. */
  const r = JSON.parse(call(`(()=>{const o={};
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;FPSV=0;DIAG_DT=0;
    last=0;let t=1e6;G.state='pause';frame(t);          /* cette image saute de 1e6 ms : plafonnee a 100, et NON cumulee */
    for(let i=0;i<40;i++){t+=2;frame(t);}                /* 40 images de menu a 2 ms */
    o.pause={n:DIAG_N,ips:FPSV,dt:DIAG_DT};
    G.state='play';for(let i=0;i<60;i++){t+=29;frame(t);}   /* 60 images de jeu a 29 ms */
    o.mix={ips:FPSV,dt:+DIAG_DT.toFixed(2)};
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;FPSV=0;DIAG_DT=0;
    for(let i=0;i<70;i++){t+=16.7;frame(t);}             /* 70 images de jeu a 16,7 ms */
    o.reg={ips:FPSV,dt:+DIAG_DT.toFixed(2)};
    return JSON.stringify(o);})()`));
  check('80 images de menu seules : rien n\'est mesure (ni ips, ni temps par image)',
    r.pause.n === 0 && r.pause.ips === 0 && r.pause.dt === 0,
    'images cumulees=' + r.pause.n + ' · ips=' + r.pause.ips + ' · image=' + r.pause.dt + ' ms');
  check('apres 40 images de menu, 60 images de jeu a 29 ms : les ips sont ceux du JEU, et 1000/ips = ms',
    r.mix.ips >= 33 && r.mix.ips <= 35 && Math.abs(1000 / r.mix.ips - r.mix.dt) <= 1,
    'ips=' + r.mix.ips + ' (attendu ~34) · image=' + r.mix.dt + ' ms · 1000/ips=' + (1000 / r.mix.ips).toFixed(2) + ' ms');
  check('la mesure reste juste : 70 images a 16,7 ms donnent ~60 ips et 1000/ips = ms',
    r.reg.ips >= 58 && r.reg.ips <= 62 && Math.abs(1000 / r.reg.ips - r.reg.dt) <= 1,
    'ips=' + r.reg.ips + ' (attendu ~60) · image=' + r.reg.dt + ' ms · 1000/ips=' + (1000 / r.reg.ips).toFixed(2) + ' ms');
}

/* ================= S7 — le bloc ne chevauche AUCUN bouton =================
   Boutons tactiles : dash et gonfler — lus dans le jeu (dashBtn, gonBtn ; avant la refonte, les emplacements de
   gcSlots). Sur poste fixe il n'y a pas de bouton : la zone a eviter est le rappel « gonfler » (jauge pleine),
   rectangle lu dans ce que drawHUD a ecrit. Une ligne occupe [x, x+w] × [y-px, y] (ligne de base « bottom ») ;
   le bandeau est son rectangle. */
{
  const boutons = (o, L) => { call(`W=${o.W};H=${o.H};inp.touch=${o.deskt ? 'false' : 'true'};`);
    if (o.deskt) return L.rappel.map(r => ({ rect: r, n: 'rappel « ' + r.s + ' » (y=H-' + Math.round(o.H - r.y0) + '..H-' + Math.round(o.H - r.y1) + ')' }));
    const S = JSON.parse(call(`JSON.stringify({d:dashBtn(),g:typeof gonBtn==='function'?[gonBtn()]:[],s:typeof gcSlots==='function'?gcSlots():[]})`));
    const nom = (b, n) => n + ' (W-' + Math.round(o.W - b.x) + ',H-' + Math.round(o.H - b.y) + ' r' + b.r + ')';
    const B = S.s.map((b, i) => ({ x: b.x, y: b.y, r: b.r + 10, n: nom(b, i === 2 ? 'ULTIME' : 'AUTEL/competence ' + (i + 1)) }));
    for (const g of S.g) B.push({ x: g.x, y: g.y, r: g.r + 10, n: nom(g, 'gonfler') });
    B.push({ x: S.d.x, y: S.d.y, r: S.d.r + 10, n: nom(S.d, 'dash') });
    return B; };
  const coupe = (r, b) => { if (b.rect) return r.x0 < b.rect.x1 && r.x1 > b.rect.x0 && r.y0 < b.rect.y1 && r.y1 > b.rect.y0;
    const dx = Math.max(r.x0 - b.x, 0, b.x - r.x1), dy = Math.max(r.y0 - b.y, 0, b.y - r.y1); return dx * dx + dy * dy < b.r * b.r; };
  const haut = b => b.rect ? b.rect.y0 : b.y - b.r;
  const SIT = [
    ['S22 tactile 411×900', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true, wkn: 558 }],
    ['S22 tactile, sans ligne « où » ni marge audio', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: [], wk: true, margin: -1 }],
    ['tactile 320×640', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }],
    ['tactile couche 780×360', { W: 780, H: 360, PS: 1.5, cw: 1170, ch: 540, top: TOP, wk: true }],
    ['tactile couche 568×320', { W: 568, H: 320, PS: 1.5, cw: 852, ch: 480, top: TOP, wk: true }],
    ['poste fixe 1536×864, jauge pleine', { W: 1536, H: 864, top: TOP, wk: true, deskt: true, jauge: true }],
    ['poste fixe 800×600, jauge pleine', { W: 800, H: 600, top: TOP, wk: true, deskt: true, jauge: true }],
  ];
  const MORC = ['ips', 'image ', 'pire ', 'JS ', 'hors-JS ', 'effets ', 'resol ', 'PS ', 'canvas ', 'DPR ', 'ref ', 'saut ', 'cuisson '];
  for (const [nom, o] of SIT) for (const em of [0.50, 0.68]) {
    EM = em;
    const L = drawBlock(o), B = boutons(o, L), pb = [];
    for (const l of L) for (const b of B) if (coupe({ x0: l.x, x1: l.x + l.w, y0: l.y - l.px, y1: l.y }, b)) pb.push('« ' + l.s.slice(-22) + ' » (y=H-' + Math.round(o.H - l.y) + ') sur ' + b.n);
    const bd = L.rects.filter(r => /rgba\(8,5,18/.test(r.fill));
    for (const r of bd) for (const b of B) if (coupe({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }, b)) pb.push('bandeau sur ' + b.n);
    const tag = nom + ', police ' + em.toFixed(2) + ' em, ' + L.length + ' lignes';
    check(tag + ' : le bloc ne chevauche AUCUN bouton', L.length >= 3 && B.length >= (o.deskt ? 1 : 2) && pb.length === 0,
      B.length < (o.deskt ? 1 : 2) ? 'zones a eviter introuvables (' + B.length + ')' : pb.length ? pb.length + ' chevauchement(s) — cause : ancre fixe sous le haut des boutons — ' + pb.slice(0, 3).join(' ; ') : 'bloc de y=H-' + Math.round(o.H - Math.min(...L.map(l => l.y - l.px))) + ' a H-' + Math.round(o.H - Math.max(...L.map(l => l.y))) + ', zone la plus haute H-' + Math.round(o.H - Math.min(...B.map(haut))) + ' (' + B.length + ' zone(s))');
    const tout = L.map(l => l.s).join(' | '), manq = MORC.concat(o.margin === -1 ? [] : ['marge audio ']).filter(m => tout.indexOf(m) < 0);
    check(tag + ' : rien n\'a disparu, tout tient dans la largeur et dans l\'ecran',
      manq.length === 0 && L.every(l => fits(l, o) && l.y - l.px >= 0 && l.y <= o.H), manq.length ? 'manque : ' + manq.join(', ') : L.map(l => (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' '));
  }
}

/* ================= S8 — l'etat REEL de la regulation est affiche (ligne 3) ================= */
{
  EM = 0.68;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  const l3 = L => (L[2] ? L[2].s : 'absente');
  call(`meta.q='auto';QL=3;RES=1;`);
  let L = drawBlock(o);
  check('regulation : « auto » est dit, avec QL et RES reels, en tete de la ligne 3', /^régul auto 3\/3 ×1\.00/.test(l3(L)) && L.every(l => fits(l, o)), l3(L));
  call(`meta.q='auto';QL=1;RES=.8;`);
  L = drawBlock(o);
  check('regulation : apres une baisse automatique, la ligne 3 suit QL et RES', /^régul auto 1\/3 ×0\.80/.test(l3(L)), l3(L));
  /* ⚠️ Ce critere disait « régul FIGÉE high » et invoquait « perf() n'adapte plus ». C'etait vrai le
     30/09/2026 au matin (g4.js sortait de perf() des que meta.q n'etait pas 'auto'), et c'est devenu
     FAUX le meme jour : le chantier P2 a fait d'un mode manuel un PLAFOND — la descente reste possible,
     la remontee s'arrete au cran choisi. Garder « FIGÉE » aurait fait du compteur un menteur, soit
     exactement le defaut que ce bloc existe pour empecher. Ce qui n'a PAS bouge : un reglage manuel
     doit se lire, et la ligne doit suivre les QL/RES reels. On le verifie donc en deux temps, et plus
     precisement qu'avant : au cran plein, puis DESCENDUE sous son plafond (le marqueur « ↓ »). */
  call(`meta.q='high';applyQuality();`);
  L = drawBlock(o);
  check('regulation : un prereglage manuel se LIT, au cran plein — « plafond high », sans marqueur', /^régul plafond high 3\/3 ×1\.00/.test(l3(L)) && L.every(l => fits(l, o)), l3(L));
  call(`meta.q='high';QL=1;RES=.8;`);
  L = drawBlock(o);
  check('regulation : descendue SOUS son plafond, la ligne le dit — « plafond high ↓ »', /^régul plafond high ↓ 1\/3 ×0\.80/.test(l3(L)), l3(L));
  call(`meta.q='auto';QL=3;RES=1;`);
}

/* ================= S9 — la PIRE IMAGE : ce qui s'y est passe (chantier J0) =================
   Le compteur disait des cumuls (« où : render 6.72/31 ») et un « pire 25 ms » nu : on ne savait pas
   CE QUI avait coute ces 25 ms. Il doit dire, pour l'image dont l'intervalle est le plus long de la
   seconde : son intervalle, SON JS, et quatre compteurs d'evenements (genChunk, sprites d'obstacles
   crees, chunks recus du worker, cuissons collees pour la premiere fois).
   a) mise en page : le detail est ecrit EN ENTIER (jamais coupe par « … ») et tient, police large et
      320 px compris ; sur poste fixe il complete la ligne des ips (aucune ligne de plus) ;
   b) verite : de VRAIES images (frame(ts)), un pic FORCE, et deux leurres qui piegent les deux
      facons de se tromper — prendre le plus long JS de la fenetre (maximum independant), ou prendre
      le rappel qui CONSTATE le long intervalle au lieu de celui qui s'est execute pendant. */
{
  const GROS = [100, 98.7, 12, 140, 2, 12];
  const det = w => ['pire ' + w[0] + ' ms : JS ' + w[1].toFixed(1) + ' ms', 'gen ' + w[2], 'spr ' + w[3], 'reçus ' + w[4], 'collés ' + w[5]];
  for (const [nom, o, em] of [
    ['S22 411 px', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.50],
    ['S22 411 px, police large', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.68],
    ['320 px', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.50],
    ['320 px, police large', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.68],
    ['couche 568×320, police large', { W: 568, H: 320, PS: 1.5, cw: 852, ch: 480, top: TOP, wk: true }, 0.68],
  ]) for (const w of [WORST, GROS]) {
    EM = em; o.worst = w;
    const L = drawBlock(o), tout = L.map(l => l.s).join(' | '), manq = det(w).filter(m => tout.indexOf(m) < 0);
    const lw = L.filter(l => det(w).some(m => l.s.indexOf(m) >= 0));
    check('pire image, ' + nom + ' (' + w.join('/') + ') : le detail est emis EN ENTIER et tient dans la largeur',
      manq.length === 0 && lw.length >= 1 && lw.every(l => fits(l, o) && l.s.indexOf('…') < 0) && L.every(l => fits(l, o)),
      manq.length ? 'manque : ' + manq.join(', ') + ' — ' + tout.slice(0, 80) : lw.map(l => '« ' + l.s + ' » ' + (l.x + l.w).toFixed(0) + '/' + (o.W - PAD) + ' en ' + l.px + ' px').join(' + '));
  }
  {
    EM = 0.50;
    const o = { W: 1536, H: 864, top: TOP, wk: true, deskt: true, worst: WORST };
    const L = drawBlock(o), l1 = L[0] ? L[0].s : 'absente';
    check('pire image, PC 1536 px : le detail COMPLETE la ligne des ips — aucune ligne de plus (4 au total)',
      L.length === 4 && /ips · image .* · pire 34 ms : JS 21\.3 ms · gen 2 · spr 14 · reçus 1 · collés 2( · |$)/.test(l1), L.length + ' lignes — ' + l1);
    o.worst = [50, -1, 0, 0, 0, 0];
    const L2 = drawBlock(o);
    check('pire image : apres une reprise (rien de mesure avant), le compteur dit « JS ? » et n\'invente pas un nombre',
      /pire 50 ms : JS \? · gen 0/.test(L2[0] ? L2[0].s : ''), L2[0] ? L2[0].s : 'absente');
    o.worst = null;
    const L3 = drawBlock(o), t3 = L3.map(l => l.s).join(' | ');
    check('pire image : rien de publie -> aucun detail (ni « gen », ni « collés »), et « pire » reste sur la ligne des ips',
      !/gen |collés |reçus /.test(t3) && /ips · image .* · pire 34 ms$/.test(L3[0] ? L3[0].s : ''), L3[0] ? L3[0].s : 'absente');
  }
  /* ---- b) le pic force ----
     Horloge : `ts` (l'horodatage rAF) et `performance.now()` (CLOCK) sont deux choses. Le JS d'un rappel
     est ce que CLOCK avance PENDANT frame() ; on l'avance depuis l'interieur de render(), enveloppee ici.
     Les evenements sont de VRAIS appels : genChunk() et obsSprite() du jeu (donc a travers les enveloppes
     de jsProfStart), et une cuisson neuve posee sur le chunk du centre de l'ecran, que la vraie
     drawChunks() colle. Les genChunk du pic sont hors de l'ilot (rien n'est enregistre dans WD.chunks) ; les deux
     sprites sont ceux de COPIES de deux vrais obstacles, sans sprite et hors de tout chunk (refonte en ilots :
     l'ilot entier tient dans la fenetre de streamWorld, qui habille tous ses obstacles des la mise en regime). L'arrivee du worker est simulee par ce que fait wkRecv (gw2.js:413) : c.bake=…, WKN++
     — ENTRE deux rappels, comme une tache de message.
       rappel A (leurre 1) : 3 genChunk, 15 ms de JS, intervalle suivant NORMAL (16,7 ms) ;
       rappel B (le pic)   : 1 genChunk + 2 sprites + 1 cuisson collee, 9 ms de JS ; puis 1 chunk recu du
                             worker, et l'image suivante arrive 50 ms plus tard ;
       rappel C (leurre 2) : celui qui constate les 50 ms ; 2 genChunk, 10 ms de JS, et il colle le chunk recu.
     Attendu : pire = 50 ms · JS 9.0 · gen 1 · spr 2 · reçus 1 · collés 1. */
  sandbox.__tick = ms => { CLOCK += ms; };
  const r = JSON.parse(call(`(()=>{
    meta.fps=true;meta.q='auto';jsProfStart();WK=false;WKN=0;   /* drawBlock laisse un faux worker ({w:1}) : ici, de vraies images */
    const rd0=render;let hook=null;render=function(){if(hook){const h=hook;hook=null;h();}return rd0.apply(this,arguments);};
    const centre=()=>getChunk(Math.floor(CAM.x/CH),Math.floor(CAM.y/CH));
    const neuve=()=>{centre().bake=document.createElement('canvas');};
    /* obstacles sans sprite : copies de vrais obstacles de l'ilot (o.spr vide), hors de tout chunk — ni drawObstacles
       ni streamWorld ne les voient, seul le rappel B les habille */
    const libres=[];
    for(const c of WD.chunks)if(c)for(const o of c.obs)if(!o.wall&&libres.length<2)libres.push(Object.assign({},o,{spr:null,home:null}));
    let t=last+16.7,far=0;const img=d=>{frame(t);t+=d;};
    G.state='play';for(let i=0;i<8;i++)img(16.7);       /* mise en regime : tout ce qui est visible est cuit et colle */
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;DIAG_MX=0;DIAG_WORST=null;if(typeof DIAG_W!=='undefined')DIAG_W[0]=0;
    const etat=[];
    for(let i=0;i<12;i++)img(16.7);
    hook=()=>{for(let k=0;k<3;k++){__tick(5);genChunk(-60-(far++),-60);}};img(16.7);                       /* A */
    for(let i=0;i<6;i++)img(16.7);
    neuve();hook=()=>{__tick(7);genChunk(-60-(far++),-60);for(const o of libres){__tick(1);obsSprite(o);}};frame(t);   /* B */
    neuve();WKN++;t+=50;                                                                                  /* recu du worker, puis 50 ms */
    hook=()=>{for(let k=0;k<2;k++){__tick(5);genChunk(-60-(far++),-60);}};img(16.7);                       /* C */
    let n=0;while(DIAG_T>0&&n++<80){etat.push(G.state);img(16.7);}
    render=rd0;
    return JSON.stringify({w:typeof DIAG_WORST==='undefined'?null:DIAG_WORST,pk:DIAG_PEAK,js:+DIAG_JS.toFixed(2),n:n,libres:libres.length,st:G.state});})()`));
  const w = r.w || [];
  check('pic force : la pire image est celle de l\'intervalle de 50 ms, et c\'est le MEME nombre que « pire »',
    w[0] === 50 && r.pk === 50, 'pire image=' + JSON.stringify(r.w) + ' · pire=' + r.pk + ' ms · etat ' + r.st + ' · ' + r.n + ' images de fin de fenetre');
  check('pic force : SON JS (9 ms) — ni le plus long JS de la fenetre (15 ms, leurre A), ni celui du rappel qui constate (10 ms, leurre C)',
    Math.abs(w[1] - 9) < 1e-6, 'JS de la pire image=' + (w[1] == null ? 'absent' : w[1].toFixed(1)) + ' ms · JS moyen de la fenetre=' + r.js + ' ms');
  check('pic force : SES evenements — gen 1 (pas 3 ni 2), spr 2, reçus 1, collés 1 (le chunk recu, colle par le rappel suivant, n\'est pas compte)',
    w[2] === 1 && w[3] === 2 && w[4] === 1 && w[5] === 1 && r.libres === 2, 'gen ' + w[2] + ' · spr ' + w[3] + ' · reçus ' + w[4] + ' · collés ' + w[5]);
  EM = 0.50;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true, worst: r.w };
  const L = drawBlock(o), lp = L.find(l => /^pire .* :/.test(l.s));
  /* depuis A4 la ligne se poursuit (retard, wkRecv, longtask : S10) : on exige ce debut-la, a l'identique */
  check('pic force : la ligne ecrite sur le S22 dit exactement cela', !!lp && /^pire 50 ms : JS 9\.0 ms · gen 1 · spr 2 · reçus 1 · collés 1( · |$)/.test(lp.s) && fits(lp, o), lp ? '« ' + lp.s + ' »' : 'absente — ' + L.map(l => l.s.slice(0, 24)).join(' | '));
}

/* ================= S10 — le « hors JS » ATTRIBUE (chantier A4) =================
   Capture du S22 le 30/09/2026 : « pire 75 ms : JS 3.0 ms · gen 0 · spr 0 · reçus 2 · collés 0 » — 72 ms que
   rien ne nommait. Trois temoins de plus dans le detail de la pire image :
     retard  = performance.now() a l'entree du rappel N-1 moins son ts : le temps qu'il a ATTENDU ;
     wkRecv  = cumul/pire appel de la reception des chunks du worker ENTRE les deux rappels ;
     longtask = la pire tâche longue de la seconde selon le navigateur (PerformanceObserver), et son attribution ;
     réel    = l'intervalle BRUT quand [0] a ete plafonne a 100 ms.
   a) mise en page : emis EN ENTIER, tiennent a 411 et 320 px, police large comprise, sans « … » ;
   b) VERITE DES ABSENCES (le defaut du 30/09 : « ref 0.0 » muet puis « ref 0.4 » faux) : API longtask absente ->
      « longtask absent », jamais « 0 » ; observateur actif sans tâche -> « aucune » ; retard/wkRecv non mesures,
      ou tableau ancien a 6 champs -> « ? » ;
   c) de VRAIES images, horloges concordantes (ts et performance.now() sur la meme base, comme dans un navigateur) :
      le rappel B attend 12 ms, puis deux wkRecv REELS (enveloppe de jsProfStart) de 3 et 1 ms, puis l'image suivante
      arrive 130 ms plus tard. Leurres : un rappel qui attend 8 ms et un wkRecv de 5 ms, dans des intervalles
      NORMAUX. Attendu : pire 100 ms · retard 12.0 ms · wkRecv 4.00/3.00 ms · réel 130 ms. */
{
  const PLEIN = [75, 3.0, 0, 0, 2, 0, 71.8, 0.42, 0.31, 75];
  const exige = ['retard 71.8 ms', 'wkRecv 0.42/0.31 ms', 'longtask 72 ms (self, unknown)'];
  call(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];`);
  for (const [nom, o, em] of [
    ['S22 411 px', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.50],
    ['S22 411 px, police large', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.68],
    ['320 px', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.50],
    ['320 px, police large', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.68],
    ['couche 568×320, police large', { W: 568, H: 320, PS: 1.5, cw: 852, ch: 480, top: TOP, wk: true }, 0.68],
  ]) {
    EM = em; o.worst = PLEIN;
    const L = drawBlock(o), tout = L.map(l => l.s).join(' | '), manq = exige.filter(m => tout.indexOf(m) < 0);
    const lw = L.filter(l => exige.some(m => l.s.indexOf(m) >= 0));
    check('hors JS attribue, ' + nom + ' : retard, wkRecv et longtask emis EN ENTIER, dans la largeur',
      manq.length === 0 && lw.every(l => fits(l, o) && l.s.indexOf('…') < 0) && L.every(l => fits(l, o) && l.y - l.px >= 0),
      manq.length ? 'manque : ' + manq.join(', ') + ' — ' + tout.slice(0, 120) : lw.map(l => '« ' + l.s + ' » ' + (l.x + l.w).toFixed(0) + '/' + (o.W - PAD)).join(' + '));
    check('hors JS attribue, ' + nom + ' : « réel » n\'apparait PAS quand l\'intervalle n\'a pas ete plafonne', tout.indexOf('réel ') < 0, tout.slice(0, 60));
  }
  EM = 0.50;
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true };
  const txt = w => { o.worst = w; return drawBlock(o).map(l => l.s).join(' | '); };
  call(`LT_ST=-1;DIAG_LTP=null;`);
  let t = txt(PLEIN);
  check('longtask : API ABSENTE -> « longtask absent », et aucun nombre a la place', /longtask absent/.test(t) && !/longtask \d|longtask aucune/.test(t), (t.match(/longtask[^|·]*/) || ['aucun champ longtask'])[0]);
  call(`LT_ST=1;DIAG_LTP=[0,'',''];`);
  t = txt(PLEIN);
  check('longtask : observe, aucune tâche longue dans la seconde -> « longtask aucune » (pas « 0 ms »)', /longtask aucune/.test(t) && !/longtask 0/.test(t), (t.match(/longtask[^|·]*/) || ['aucun champ longtask'])[0]);
  call(`LT_ST=1;DIAG_LTP=null;`);
  t = txt(PLEIN);
  check('longtask : observe mais rien de publie -> « longtask ? »', /longtask \?/.test(t), (t.match(/longtask[^|·]*/) || ['aucun champ longtask'])[0]);
  call(`LT_ST=-2;DIAG_LTP=null;`);
  t = txt(PLEIN);
  check('longtask : observe() a echoue -> « longtask ? », pas « absent » ni zero', /longtask \?/.test(t), (t.match(/longtask[^|·]*/) || ['aucun champ longtask'])[0]);
  call(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];`);
  t = txt([75, 3.0, 0, 0, 2, 0, -1, -1, 0, 75]);
  check('retard / wkRecv non mesures -> « retard ? » et « wkRecv ? », jamais « 0.0 ms »', /retard \?/.test(t) && /wkRecv \?/.test(t) && !/retard \d|wkRecv \d/.test(t), t.slice(t.indexOf('collés'), t.indexOf('collés') + 60));
  t = txt([123, -1, 7, 8, 9, 10]);
  check('tableau a 6 champs (sentinelle de test/pire-navigateur.js) -> « ? », pas de nombre invente', /retard \?/.test(t) && /wkRecv \?/.test(t) && /collés 10/.test(t), t.slice(t.indexOf('collés'), t.indexOf('collés') + 60));
  t = txt([100, 3.0, 0, 0, 2, 0, 12, 4, 3, 217]);
  check('intervalle plafonne : « pire 100 ms » dit en plus « réel 217 ms »', /pire 100 ms :/.test(t) && /réel 217 ms/.test(t), t.slice(t.indexOf('pire'), t.indexOf('pire') + 150));

  /* ---- c) de vraies images, horloges concordantes ---- */
  sandbox.__horloge = v => { CLOCK = v; };
  sandbox.__tick = ms => { CLOCK += ms; };
  let LTCB = null;
  sandbox.PerformanceObserver = class { constructor(cb) { LTCB = cb; } observe(o) { this.o = o; } };
  sandbox.PerformanceObserver.supportedEntryTypes = ['longtask', 'paint'];
  sandbox.__lt = (d, n, a) => LTCB && LTCB({ getEntries: () => [{ duration: d, name: n, attribution: [{ name: a }] }] });
  const r = JSON.parse(call(`(()=>{
    meta.fps=true;meta.q='auto';jsProfStart();WK=false;WKN=0;
    LT_ST=0;if(typeof ltStart==='function')ltStart();   /* commit d'avant A4 : pas de ltStart, les criteres echouent en le nommant */
    const recoit=ms=>wkRecv({data:{get t(){__tick(ms);return 'autre';}}});   /* le VRAI wkRecv, par la globale, comme w.onmessage */
    let t=last+16.7;const img=(d,ret)=>{__horloge(t+(ret||0));frame(t);t+=d;};
    G.state='play';for(let i=0;i<8;i++)img(16.7,1);
    DIAG_T=0;DIAG_N=0;DIAG_CDT=0;DIAG_CJS=0;DIAG_MX=0;DIAG_WORST=null;DIAG_W[0]=0;
    for(let i=0;i<10;i++)img(16.7,1);
    img(16.7,8);                                  /* leurre : attend 8 ms, intervalle suivant normal */
    for(let i=0;i<3;i++)img(16.7,1);
    __horloge(t-8);recoit(5);                      /* leurre : wkRecv de 5 ms dans un intervalle normal */
    for(let i=0;i<3;i++)img(16.7,1);
    __lt(64,'self','unknown');__lt(88,'self','unknown');
    img(130,12);                                  /* B : attend 12 ms ; l'image suivante 130 ms plus tard */
    __horloge(t-100);recoit(3);recoit(1);
    img(16.7,1);                                  /* C : constate l'intervalle */
    let n=0;while(DIAG_T>0&&n++<80)img(16.7,1);
    const lp=()=>typeof DIAG_LTP==='undefined'?'DIAG_LTP absent du code':DIAG_LTP;
    const w1=DIAG_WORST,lt1=lp();
    n=0;img(16.7,1);while(DIAG_T>0&&n++<80)img(16.7,1);
    return JSON.stringify({w:w1,lt:lt1,lt2:lp(),st:LT_ST});})()`));
  const w = r.w || [];
  check('vraies images : la pire image est l\'intervalle de 130 ms, plafonne a 100, BRUT 130', w[0] === 100 && Math.abs(w[9] - 130) < 1e-6, JSON.stringify(w));
  check('vraies images : retard = 12 ms (celui du rappel B, pas le leurre de 8 ms ni celui du rappel C)', Math.abs(w[6] - 12) < 1e-6, 'retard=' + w[6]);
  check('vraies images : wkRecv = 4 ms cumules, pire appel 3 ms (les 5 ms du leurre ne fuient pas)', Math.abs(w[7] - 4) < 1e-6 && Math.abs(w[8] - 3) < 1e-6, 'wkRecv=' + w[7] + '/' + w[8]);
  check('vraies images : l\'API longtask detectee au lancement, et la pire tâche longue de la seconde gardee (88 ms)', r.st === 1 && r.lt && r.lt[0] === 88 && r.lt[1] === 'self' && r.lt[2] === 'unknown', 'LT_ST=' + r.st + ' · ' + JSON.stringify(r.lt));
  check('vraies images : la seconde suivante, sans tâche longue, publie 0 — affiche « aucune »', r.lt2 && r.lt2[0] === 0, JSON.stringify(r.lt2));
  o.worst = r.w; call(`DIAG_LTP=${JSON.stringify(r.lt)};LT_ST=1;`);
  const L = drawBlock(o), tout = L.map(l => l.s).join(' · ');
  check('vraies images : ce que le S22 ECRIT', /pire 100 ms : JS [\d.]+ ms · gen \d+ · spr \d+ · reçus 0 · collés \d+ · retard 12\.0 ms · wkRecv 4\.00\/3\.00 ms · réel 130 ms · longtask 88 ms \(self, unknown\)/.test(tout) && L.every(l => fits(l, o)),
    '« ' + tout.slice(tout.indexOf('pire 100 ms :')).split(' · où :')[0] + ' »');
  delete sandbox.PerformanceObserver;
}

/* ================= S11 — LoAF : ce que CONTIENT l'image longue (chantier A6) =================
   A4 nommait la tâche longue, mais Chromium l'attribue a (self, unknown) MEME pour une boucle de script pure.
   Les Long Animation Frames la DECOUPENT : DIAG_LFP (g4.js) = [duree, blockingDuration, script, style/layout,
   nom du plus long script ('' = scripts[] VIDE), sa duree]. Le compteur ecrit, apres longtask :
     « loaf D ms : <phase dominante> · « <nom> » N ms | aucun script · style N ms [· bloq N ms] ».
   a) VERITE DES ABSENCES : API absente -> « loaf absent » ; observe() echoue, pas lance, rien publie -> « loaf ? » ;
      observe sans image longue -> « loaf aucune » — jamais « loaf 0 » ;
   b) le detail : phase dominante juste (script / style/layout / ni script ni style), nom TRONQUE a 14 signes
      (« … »), « aucun script » quand la liste est vide, « bloq » seulement s'il est nettement plus court ;
   c) largeur : detail EN ENTIER a 411/320 px, police large, couche ; chaque ligne tient ;
   d) PAS DE LIGNE PERMANENTE DE PLUS : en regime calme (longtask et loaf sans rien), un seul mot « LT/LoAF aucune »
      remplace « longtask aucune » A LA MEME PLACE et n'est pas plus long : le pavage glouton ne coupe qu'au vu des
      largeurs, il coupe donc comme avant (on verifie la longueur ET la place : juste apres wkRecv, dernier morceau). */
{
  const PLEIN = [75, 3.0, 0, 0, 2, 0, 71.8, 0.42, 0.31, 75];
  const FMT = [
    ['S22 411 px', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.50],
    ['S22 411 px, police large', { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true }, 0.68],
    ['320 px', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.50],
    ['320 px, police large', { W: 320, H: 640, PS: 1.5, cw: 480, ch: 960, top: TOP, wk: true }, 0.68],
    ['couche 568×320, police large', { W: 568, H: 320, PS: 1.5, cw: 852, ch: 480, top: TOP, wk: true }, 0.68],
  ];
  const o = { W: 411, H: 900, PS: 1.5, cw: 617, ch: 1351, top: TOP, wk: true, worst: PLEIN };
  const txt = st => { EM = 0.50; call(st); return drawBlock(o).map(l => l.s).join(' | '); };
  const champ = t => (t.match(/(loaf|LT\/LoAF)[^|·]*/) || ['aucun champ loaf'])[0];
  let t = txt(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];LF_ST=-1;DIAG_LFP=null;`);
  check('loaf : API ABSENTE -> « loaf absent », aucun nombre a la place', /loaf absent/.test(t) && !/loaf \d|loaf aucune/.test(t), champ(t));
  for (const [st, qui] of [[`LF_ST=0;DIAG_LFP=null;`, 'pas lance'], [`LF_ST=-2;DIAG_LFP=null;`, 'observe() a echoue'], [`LF_ST=1;DIAG_LFP=null;`, 'observe, rien de publie']]) {
    t = txt(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];` + st);
    check('loaf : ' + qui + ' -> « loaf ? », ni « absent » ni zero', /loaf \?/.test(t) && !/loaf absent|loaf \d|loaf aucune/.test(t), champ(t));
  }
  t = txt(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];LF_ST=1;DIAG_LFP=[0,0,0,0,'',0];`);
  check('loaf : observe, aucune image longue (mais une tâche longue) -> « loaf aucune », pas « loaf 0 »', /loaf aucune/.test(t) && !/loaf 0/.test(t) && /longtask 72 ms/.test(t), champ(t));
  t = txt(`LT_ST=1;DIAG_LTP=[0,'',''];LF_ST=1;DIAG_LFP=[0,0,0,0,'',0];`);
  check('loaf : calme (ni tâche ni image longue) -> un seul mot « LT/LoAF aucune »', /LT\/LoAF aucune/.test(t) && !/longtask aucune|loaf aucune|loaf 0/.test(t), champ(t));

  /* b) le detail — les trois cas releves dans le vrai Chromium (test/navigateur.js) + un « bloq » non significatif */
  const DET = [
    ['script force (setTimeout qui boucle)', `[222,104,150,4,'TimerHandler:setTimeout',150]`, ['loaf 222 ms : script', '« TimerHandler:… » 150 ms', 'style 4 ms', 'bloq 104 ms']],
    ['image longue SANS script', `[55,0,0,0.2,'',0]`, ['loaf 55 ms : ni script ni style', 'aucun script', 'style 0 ms', 'bloq 0 ms']],
    ['reflow force', `[335,281,71.1,259.8,'forceLayout',330.6]`, ['loaf 335 ms : style/layout', '« forceLayout » 331 ms', 'style 260 ms']],
    ['bloq proche de la duree', `[100,90,80,5,'frame',80]`, ['loaf 100 ms : script', '« frame » 80 ms', 'style 5 ms']],
  ];
  for (const [nom, lf, exige] of DET) {
    t = txt(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];LF_ST=1;DIAG_LFP=${lf};`);
    const tout = t.split(' | ').join(' · '), manq = exige.filter(m => tout.indexOf(m) < 0);
    const extra = /bloq proche|reflow/.test(nom) ? /bloq/.test(t) : false, tronc = nom.startsWith('script') ? /setTimeout/.test(t) : false;
    check('loaf, ' + nom + ' : ' + exige.join(' · ') + (extra ? ' (et PAS de bloq)' : ''), !manq.length && !extra && !tronc,
      manq.length ? 'manque : ' + manq.join(', ') + ' — ' + tout.slice(tout.indexOf('loaf'), tout.indexOf('loaf') + 110) : tronc ? 'nom NON tronque' : extra ? 'bloq affiche' : tout.slice(tout.indexOf('loaf')).split(' · où :')[0]);
  }

  /* c) largeur — le detail le plus long (script tronque + bloq), et d) le calme, dans tous les formats */
  const DLONG = ['loaf 222 ms : script', '« TimerHandler:… » 150 ms', 'style 4 ms', 'bloq 104 ms'];
  for (const [nom, o, em] of FMT) {
    EM = em; o.worst = PLEIN; call(`LT_ST=1;DIAG_LTP=[72.4,'self','unknown'];LF_ST=1;DIAG_LFP=[222,104,150,4,'TimerHandler:setTimeout',150];`);
    let L = drawBlock(o), tout = L.map(l => l.s).join(' | ');
    const manq = DLONG.filter(m => tout.indexOf(m) < 0), lw = L.filter(l => DLONG.some(m => l.s.indexOf(m) >= 0));
    check('loaf, ' + nom + ' : detail emis EN ENTIER, chaque ligne dans la largeur',
      !manq.length && lw.every(l => !/ …$/.test(l.s)) && L.every(l => fits(l, o) && l.y - l.px >= 0),
      manq.length ? 'manque : ' + manq.join(', ') : lw.map(l => '« ' + l.s + ' » ' + (l.x + l.w).toFixed(0) + '/' + (o.W - PAD) + ' en ' + l.px + ' px').join(' + '));
    call(`LT_ST=1;DIAG_LTP=[0,'',''];LF_ST=1;DIAG_LFP=[0,0,0,0,'',0];`);
    L = drawBlock(o);
    const l = L.find(x => /LT\/LoAF aucune/.test(x.s)), tc = L.map(x => x.s).join(' | ');
    check('loaf, ' + nom + ' : calme -> pas de ligne de plus (« LT/LoAF aucune » <= « longtask aucune », a sa place, apres wkRecv)',
      !!l && 'LT/LoAF aucune'.length <= 'longtask aucune'.length && /wkRecv [\d.\/]+ ms( · | \| )LT\/LoAF aucune( \| où|$)/.test(tc) && L.every(x => fits(x, o)),
      l ? L.length + ' lignes ; « ' + l.s + ' » ' + (l.x + l.w).toFixed(0) + '/' + (o.W - PAD) : 'absent — ' + L.map(x => x.s).join(' | ').slice(-120));
  }
  EM = 0.50;
}

/* ================= verdict ================= */
let all = true;
for (const c of checks) { if (!c.ok) all = false; console.log((c.ok ? '  OK  ' : ' ECHEC') + ' ' + c.name + (c.detail ? '  — ' + c.detail : '')); }
console.log(all ? '\nCOMPTEUR : TOUT PASSE' : '\nCOMPTEUR : ECHEC');
process.exit(all ? 0 : 1);
