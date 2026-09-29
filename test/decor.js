'use strict';
/* =========================================================
   LE DÉCOR MORD (chantier E1) : les objets du monde agissent sur les ennemis, jamais sur le joueur.

   node test/decor.js              les trois règles ; code de sortie 0 si tout passe, 1 sinon
   node test/decor.js --ref=HEAD   mêmes tests sur les modules d'un commit (TÉMOIN : doit échouer en nommant la cause)
   node test/decor.js --mesure     recul observé contre un gouffre, par source (justifie SKY_KB, g2.js)

   1. Gueules (floral)  : un ennemi dans le rayon d'une `bloom` à la morsure perd des PV ; le joueur, dans le rayon lui
                          aussi, ne perd rien.
   2. Circulation (urban) : un ennemi sur la trajectoire d'une `car` perd des PV et est projeté ; le joueur sur la même
                          trajectoire ne perd rien et n'est pas déplacé.
   3. Vide (sky)        : un ennemi projeté (Onde de choc, la compétence réelle, gcUse) contre un gouffre tombe et meurt ;
                          le MÊME ennemi, même geste, même géométrie, en plaines, survit.
   Chaque scène est posée par le vrai biome (G.biome par hystérésis : on attend qu'il bascule), jamais forcée.
   Aucune fonction nouvelle du jeu n'est appelée par les tests : sur l'ancien code, ils échouent sans planter.
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), MESURE = !!ARG('mesure');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const read = f => REF ? cp.execFileSync('git', ['show', REF + ':' + f], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(path.join(ROOT, f), 'utf8');

const mkCtx = () => new Proxy({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: s => ({ width: (s || '').length * 7 }) },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
const mkEl = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, closest: () => null,
  querySelector: () => null, querySelectorAll: () => [], appendChild: c => c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 780 }), hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', parentElement: null });
const mkCanvas = (w, h) => { let c = null; return Object.assign(mkEl(), { width: w || 300, height: h || 150, getContext: () => c || (c = mkCtx()) }); };
const stash = new Map();
const doc = { getElementById: id => { if (!stash.has(id)) { const e = (id === 'cv' || id === 'low' || id === 'hgPrev') ? mkCanvas(390, 780) : mkEl(); if (id === 'cv') e.parentElement = mkEl(); stash.set(id, e); } return stash.get(id); },
  createElement: t => (t === 'canvas' ? mkCanvas() : mkEl()), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: mkEl(), hidden: false };
const win = { __SIM: true, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {}, removeEventListener() {} };
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }), addEventListener() {}, removeEventListener() {} });
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch (e) {}
{ let s = 1; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
vm.runInThisContext(ORDER.map(read).join('\n'), { filename: 'game.js' });
const call = e => vm.runInThisContext(e);

/* outils de scène, dans le realm du jeu (uniquement des fonctions qui existaient AVANT le chantier) */
call(`
var __T={pin:null};
function __start(){newRun('bal',false);gsRunStart();gcRunStart();giRunStart();gxRunStart();gtRunStart();gvRunStart();G.help=0;
  window.__SIM_INPUT=function(){G.inX=G.inY=0;G.spawnT=1e9;G.eb=[];if(!__T.fire){G.pb=[];G.p.fireT=1e9;}G.banner=null;if(G.gt)G.gt.on=false;if(__T.pin)__T.pin();};}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;for(const e of G.en)e.dead=true;G.en=[];G.arena=null;}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
/* attend que G.biome bascule (3 relevés espacés de 12 ticks) : jamais forcé */
function __settle(b){for(let i=0;i<80&&G.biome!==b;i++)step();return G.biome===b;}
function __calm(x,y){return x*x+y*y<(WR-900)**2&&G.hearts.every(h=>dist2(h.x,h.y,x,y)>1100*1100)&&dist2(WD.core.x,WD.core.y,x,y)>1300*1300;}
function __foe(t,x,y){const e=mkEnemy(t,x,y,{noElite:true,spawn:0,aggro:true});e.cd=1e9;e.hp=e.mhp=100;return e;}
/* le long d'une ligne de cellules : case libre, libre, gouffre (dx,dy = direction vers le gouffre), loin des obstacles */
function __edge(b){const want=b;for(let j=4;j<NG-4;j++)for(let i=4;i<NG-4;i++){if(!wallAt(i,j))continue;const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;if(x*x+y*y>(WR-400)**2)continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=wallAt(i,j)&&wallAt(i-dy,j+dx)&&wallAt(i+dy,j-dx);for(let k=1;k<=6&&ok;k++)for(let s=-1;s<=1;s++)if(wallAt(i-dx*k+s*dy,j-dy*k+s*dx))ok=false;
    if(!ok)continue;const ex=x-dx*WC*1.5,ey=y-dy*WC*1.5;if(biomeAt(ex,ey)!==want||biomeAt(x,y)!==want||biomeAt(x-dx*WC*5,y-dy*WC*5)!==want)continue;
    if(!__calm(ex,ey)||pointHit(ex,ey,40)||pointHit(x-dx*WC*4,y-dy*WC*4,30))continue;return {x:ex,y:ey,dx,dy,wx:x-dx*WC*.5,wy:y-dy*WC*.5};}}return null;}
`);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));

if (MESURE) {
  /* SEUIL DU VIDE — recul observé = |v| - sp (vitesse au-delà de l'allure propre) au moment où l'ennemi touche un
     gouffre, règle neutralisée (skyFalls journalise et renvoie false). Géométrie : ennemi à 1,5 case du bord. */
  call(`__start();var __L=[];skyFalls=function(e,sp,oh){if(wallNear(e.x,e.y,e.r+2))__L.push(Math.hypot(e.vx,e.vy)-sp);return false;};`);
  const E = J(`__edge('sky')`); if (!E) { console.log('aucun bord de gouffre trouvé'); process.exit(1); }
  const src = {
    'marche seule (poursuite, 900 ticks, 4 types)': `for(const t of ['mite','pop','orbit','spike']){__tp(E.x-E.dx*300,E.y-E.dy*300);__settle('sky');
        const e=__foe(t,E.x,E.y);__T.pin=()=>{G.p.x=G.p.px=E.wx+E.dx*40;G.p.y=G.p.py=E.wy+E.dy*40;G.p.inv=1e9;e.cd=1e9;};__steps(900);__T.pin=null;}`,
    'tir de base (auto-tir réel, 300 ticks)': `for(const d of [60,120,200]){__tp(E.x-E.dx*d-E.dy*7,E.y-E.dy*d+E.dx*7);__settle('sky');const e=__foe('pop',E.x,E.y);e.hp=e.mhp=1e9;
        __T.fire=true;G.p.fireT=0;__T.pin=()=>{G.p.x=G.p.px=E.x-E.dx*d-E.dy*7;G.p.y=G.p.py=E.y-E.dy*d+E.dx*7;G.p.inv=1e9;};__steps(300);__T.fire=false;__T.pin=null;}`,
    'explosion de missile (explode, recul 3)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*300,E.y-E.dy*300);__settle('sky');const e=__foe('pop',E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;explode({x:e.x-E.dx*20-E.dy*3,y:e.y-E.dy*20+E.dx*3,dmg:0,boom:60});__steps(60);}`,
    'ruée (dash réel, dashDmg=1)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);__settle('sky');const e=__foe('pop',E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;G.p.dashDmg=1;G.p.dashT=0;G.inX=E.dx-E.dy*.05;G.inY=E.dy+E.dx*.05;
        const f=window.__SIM_INPUT;window.__SIM_INPUT=function(){f();G.inX=E.dx-E.dy*.05;G.inY=E.dy+E.dx*.05;};tryDash();__steps(60);window.__SIM_INPUT=f;G.p.dashDmg=0;}`,
    'Onde de choc (gcUse, poussée 14)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);__settle('sky');const e=__foe('pop',E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;G.p.sk[0]={id:'shock',l:1,cd:0};gcUse(0);__steps(60);}`,
    'Lance (gcUse, poussée 8)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);__settle('sky');const e=__foe('pop',E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;G.p.sk[0]={id:'lance',l:1,cd:0};G.p.ang=Math.atan2(e.y-G.p.y,e.x-G.p.x);gcUse(0);__steps(60);}`,
    'Onde de choc sur un Porteur (r26, masse .35)': `for(const d of [-40,0,40,90]){__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);__settle('sky');const e=__foe('spawner',E.x-E.dx*d,E.y-E.dy*d);e.hp=e.mhp=1e9;G.p.sk[0]={id:'shock',l:1,cd:0};gcUse(0);__steps(60);}`,
  };
  console.log('bord de gouffre : ' + JSON.stringify(E));
  for (const k in src) { call(`__L=[];(function(){const E=${JSON.stringify(E)};${src[k]}})()`); const L = J('__L');
    console.log('  ' + k.padEnd(48) + ' contacts=' + String(L.length).padStart(4) + '  recul max=' + (L.length ? Math.max(...L).toFixed(2) : '—')); }
  process.exit(0);
}

call(`__start()`);

/* ---------- 1. gueules du Jardin carnivore ---------- */
{ let D;
  try { D = J(`(()=>{let it=null;for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
      for(const q of c.live)if(q.t==='bloom'&&__calm(q.x,q.y)&&biomeAt(q.x,q.y)==='floral'&&biomeAt(q.x+200,q.y)==='floral'&&!wallNear(q.x,q.y,120)){it=q;break;}}
    if(!it)return {err:'aucune bloom en plein Jardin'};
    __tp(it.x+200,it.y);const bi=__settle('floral');__tp(it.x+30,it.y);
    const e=__foe('pop',it.x-20,it.y),P=G.p,b0=P.bub,h0=e.hp;
    __T.pin=()=>{e.x=it.x-20;e.y=it.y;e.vx=e.vy=0;e.cd=1e9;P.x=P.px=it.x+30;P.y=P.py=it.y;P.vx=P.vy=0;};
    let n=__steps(250,()=>e.dead||e.hp<h0);__T.pin=null;
    return {bi:G.biome,bset:bi,n,hp0:h0,hp:+e.hp.toFixed(2),mhp:e.mhp,b0,b:P.bub,inv:P.inv,dist:Math.round(Math.hypot(P.x-it.x,P.y-it.y))};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  const ok = !D.err && D.bset && D.hp < D.hp0 && D.hp0 - D.hp <= .3 * D.mhp + 1e-9 && D.b === D.b0;
  const why = D.err ? D.err : !D.bset ? 'G.biome n’a pas basculé en floral' : D.hp >= D.hp0 ? 'aucune morsure : l’ennemi dans le rayon n’a perdu aucun PV en ' + D.n + ' ticks (≥ un cycle de 4 s)'
    : D.hp0 - D.hp > .3 * D.mhp ? 'dégâts au-delà de 30 % des PV max' : D.b !== D.b0 ? 'le joueur a perdu des bulles (' + D.b0 + '→' + D.b + ')' : 'ok';
  check('gueules : un ennemi dans le rayon à la morsure perd des PV (≤ 30 % PV max), le joueur dans le rayon ne perd rien', ok,
    why + (D.err ? '' : ' — PV ' + D.hp0 + '→' + D.hp + ' en ' + D.n + ' ticks, bulles joueur ' + D.b0 + '→' + D.b + ', joueur à ' + D.dist + ' px de la gueule'));
}

/* ---------- 2. circulation de la Mégapole ---------- */
{ let D;
  try { D = J(`(()=>{const pos=(it,t)=>{const p=((it.ph+t*it.spd)%CH+CH)%CH;return it.vert?[it.x,it.y+p]:[it.x+p,it.y];};let it=null;
    for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
      for(const q of c.live)if(q.t==='car'&&__calm(q.x+(q.vert?0:CH/2),q.y+(q.vert?CH/2:0))&&[0,.25,.5,.75,1].every(f=>{const x=q.vert?q.x:q.x+f*CH,y=q.vert?q.y+f*CH:q.y;return biomeAt(x,y)==='urban';})){it=q;break;}}
    if(!it)return {err:'aucune voiture en pleine Mégapole'};
    const P=G.p;let c0=pos(it,G.t);__tp(c0[0],c0[1]);__T.pin=()=>{const c=pos(it,G.t);P.x=P.px=c[0];P.y=P.py=c[1];P.vx=P.vy=0;};const bi=__settle('urban');
    /* A. le joueur sur la voiture 90 ticks, seul : aucune perte, aucun déplacement imposé (épinglé à la voiture => écart 0) */
    const b0=P.bub;let pd=0,lx=null,ly=null;__T.pin=()=>{if(lx!==null)pd=Math.max(pd,Math.round(Math.hypot(P.x-lx,P.y-ly)));const c=pos(it,G.t);P.x=P.px=lx=c[0];P.y=P.py=ly=c[1];P.vx=P.vy=0;P.inv=0;};
    __steps(90);
    /* B. le joueur à l'écart de la chaussée (140 px), l'ennemi posé sur la voiture jusqu'au choc, puis laissé libre */
    const ox=it.vert?140:0,oy=it.vert?0:140;let c=pos(it,G.t+1);const e=__foe('pop',c[0],c[1]),h0=e.hp;let hit=false;
    __T.pin=()=>{const c=pos(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;if(!hit&&!e.dead){if(e.hp<h0){hit=true;}else{e.x=c[0];e.y=c[1];e.vx=e.vy=0;}}};
    let n=__steps(60,()=>hit);const sp=Math.hypot(e.vx,e.vy);
    __steps(30);__T.pin=null;
    return {bset:bi,n,hp0:h0,hp:+e.hp.toFixed(2),mhp:e.mhp,dead:e.dead,sp:+sp.toFixed(2),b0,b:P.bub,pd};})()`); }
  catch (e) { D = { err: 'exception ' + e.message }; }
  const ok = !D.err && D.bset && D.hp < D.hp0 && D.hp0 - D.hp <= .4 * D.mhp + 1e-9 && D.sp > 3 && D.b === D.b0 && D.pd === 0;
  const why = D.err ? D.err : !D.bset ? 'G.biome n’a pas basculé en urban' : D.hp >= D.hp0 ? 'aucun choc : l’ennemi sur la trajectoire n’a perdu aucun PV en 60 ticks sous la voiture'
    : D.hp0 - D.hp > .4 * D.mhp ? 'dégâts au-delà de 40 % des PV max' : D.sp <= 3 ? 'ennemi non projeté (vitesse ' + D.sp + ')' : D.b !== D.b0 ? 'le joueur a perdu des bulles' : D.pd ? 'le joueur a été déplacé' : 'ok';
  check('circulation : un ennemi sur la trajectoire d’une voiture perd des PV (≤ 40 %) et est projeté, le joueur sur la même trajectoire ne perd rien', ok,
    why + (D.err ? '' : ' — PV ' + D.hp0 + '→' + D.hp + ' au tick ' + D.n + ', vitesse après choc ' + D.sp + ', bulles joueur ' + D.b0 + '→' + D.b + ', écart imposé au joueur ' + D.pd + ' px'));
}

/* ---------- 3. vide de l'Archipel céleste ---------- */
const fall = b => { try { return J(`(()=>{const E=__edge('${b}');if(!E)return {err:'aucun bord de falaise en ${b}'};
    __tp(E.x-E.dx*200,E.y-E.dy*200);const bi=__settle('${b}');const d=0;__tp(E.x-E.dx*(d+120)-E.dy*7,E.y-E.dy*(d+120)+E.dx*7);
    const e=__foe('pop',E.x-E.dx*d,E.y-E.dy*d),P=G.p,b0=P.bub;G.p.sk[0]={id:'shock',l:1,cd:0};
    __T.pin=()=>{P.x=P.px=E.x-E.dx*(d+120)-E.dy*7;P.y=P.py=E.y-E.dy*(d+120)+E.dx*7;P.vx=P.vy=0;};gcUse(0);
    const n=__steps(90,()=>e.dead);__T.pin=null;
    return {bset:bi,bi:G.biome,dead:e.dead,hp:+e.hp.toFixed(2),hp0:e.mhp,n,b0,b:P.bub,dmg:+(e.mhp-e.hp).toFixed(2),kills:G.kills};})()`); } catch (e) { return { err: 'exception ' + e.message }; } };
{ const S = fall('sky'), Pl = fall('plains');
  const ok = !S.err && !Pl.err && S.bset && Pl.bset && S.dead && !Pl.dead && S.b === S.b0;
  const why = S.err || Pl.err || (!S.bset ? 'G.biome n’a pas basculé en sky' : !Pl.bset ? 'G.biome n’a pas basculé en plains' : !S.dead ? 'l’ennemi projeté contre le gouffre n’est pas tombé (vivant, ' + S.hp + '/' + S.hp0 + ' PV, 90 ticks)'
    : Pl.dead ? 'le même ennemi en plaines est mort : la règle ne dépend pas du biome' : S.b !== S.b0 ? 'le joueur a perdu des bulles' : 'ok');
  check('vide : un ennemi projeté (Onde de choc) contre un gouffre tombe et meurt ; le même, même geste, en plaines, survit', ok,
    why + (S.err || Pl.err ? '' : ' — sky : mort=' + S.dead + ' au tick ' + S.n + ' (dégâts de l’onde ' + S.dmg + '/' + S.hp0 + ') ; plaines : mort=' + Pl.dead + ', ' + Pl.hp + '/' + Pl.hp0 + ' PV'));
}

console.log('\n---------------- DÉCOR ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
