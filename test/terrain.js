'use strict';
/* =========================================================
   LE TERRAIN AGIT (chantier V1, deuxième lot) : courant (sea), glissade (ice), balayage (cyber), relais (core), vent (plains).

   node test/terrain.js              les cinq règles ; code de sortie 0 si tout passe, 1 sinon
   node test/terrain.js --ref=HEAD   mêmes tests sur les modules d'un commit (TÉMOIN : doit échouer en nommant la cause)

   1. Courant   : 120 ticks d'intention dans le sens du courant => distance ≥ 1,2× le témoin en plaines ; à contre-courant => ÉGALE.
   2. Glissade  : dash sur la glace ≥ 1,3× le dash en plaines ; déplacement normal identique ; aucune immunité en plus.
   3. Balayage  : joueur dans la bande, loin d'un mur => alarme (ennemi à 800 px aggro + accéléré) ; collé à un mur => rien.
   4. Relais    : dégâts ×0,45 dans le rayon d'un nœud, ×1 hors du rayon ; la liste exposée nomme le protégé.
   5. Vent      : angle G.vent / objectif < 30° en marchant ; aucune recopie de G.vent dans le code.
   Chaque scène est posée par le vrai biome (G.biome par hystérésis : on attend qu'il bascule), jamais forcée.
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
  window.__SIM_INPUT=function(){G.inX=G.inY=0;G.spawnT=1e9;G.eb=[];G.pb=[];G.p.fireT=1e9;G.banner=null;if(G.gt)G.gt.on=false;if(__T.pin)__T.pin();};}
function __tp(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;for(const e of G.en)e.dead=true;G.en=[];G.arena=null;}
function __steps(n,stop){for(let i=0;i<n;i++){step();if(G.state!=='play')return -1;if(stop&&stop())return i+1;}return n;}
function __settle(b){for(let i=0;i<80&&G.biome!==b;i++)step();return G.biome===b;}
function __calm(x,y){return x*x+y*y<(WR-900)**2&&G.hearts.every(h=>dist2(h.x,h.y,x,y)>1100*1100)&&dist2(WD.core.x,WD.core.y,x,y)>1300*1300;}
function __foe(t,x,y,ag){const e=mkEnemy(t,x,y,{noElite:true,spawn:0,aggro:ag!==false});e.cd=1e9;e.hp=e.mhp=100;e.aff=null;return e;}
/* segment libre : de (x,y) sur L px dans les sens s (1 ou -1) de u, tout dans le site si (ou le biome b) */
function __free(x,y,ux,uy,L,b,si,both){for(let d=both?-L:0;d<=L;d+=8){const px=x+ux*d,py=y+uy*d;if(biomeAt(px,py)!==b||(si!==undefined&&siteAt(px,py)!==WD.sites[si])||pointHit(px,py,30)||wallNear(px,py,30)||!__calm(px,py))return false;}return true;}
function __find(b,ux,uy,L,si,both){const S=WD.sites;for(let k=0;k<S.length;k++){if(S[k].t!==b||(si!==undefined&&k!==si))continue;
  for(let r=0;r<=1400;r+=60)for(let a=0;a<TAU;a+=.35){const x=S[k].x+Math.cos(a)*r,y=S[k].y+Math.sin(a)*r;if(__free(x,y,ux,uy,L,b,si,both))return {x,y,k};}}return null;}
/* 120 ticks d'intention u depuis (x,y) : somme des vitesses projetées sur u, et déplacement réel projeté */
function __walk(x,y,ux,uy,b,n){__tp(x,y);const bi=__settle(b);__tp(x,y);const P=G.p;let vs=0;__T.pin=()=>{G.inX=ux;G.inY=uy;};
  for(let i=0;i<n;i++){step();vs+=P.vx*ux+P.vy*uy;}__T.pin=null;return {bi,vs,dp:(P.x-x)*ux+(P.y-y)*uy};}
`);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); };
const J = e => JSON.parse(call(`JSON.stringify(${e})`));
const run = src => { try { return J(`(()=>{${src}})()`); } catch (e) { return { err: 'exception ' + e.message }; } };
const f = (x, n = 2) => (typeof x === 'number' ? x.toFixed(n) : String(x));
call(`__start()`);

/* ---------- 1. courant porteur du Récif ---------- */
{ const D = run(`const S=WD.sites,L=Math.ceil(G.p.spd*1.3*120)+40;let q=null,u=null;
    for(let k=0;k<S.length&&!q;k++){if(S[k].t!=='sea')continue;const a=hash2(k,0,WD.seed^0x5EA)/4294967296*TAU;u=[Math.cos(a),Math.sin(a)];q=__find('sea',u[0],u[1],L,k,true);}
    if(!q)return {err:'aucun segment libre de '+L+' px en plein Récif'};
    const w=__find('plains',u[0],u[1],L,undefined,true);if(!w)return {err:'aucun segment libre en plaines'};
    const A=__walk(q.x,q.y,u[0],u[1],'sea',120),C=G.courant,B=__walk(q.x,q.y,-u[0],-u[1],'sea',120);
    const T=__walk(w.x,w.y,u[0],u[1],'plains',120),T2=__walk(w.x,w.y,-u[0],-u[1],'plains',120);
    return {si:q.k,u,C:C?[C.x,C.y,C.i]:null,A,B,T,T2,spd:G.p.spd};`);
  const ok = !D.err && D.A.bi && D.T.bi && D.A.vs >= 1.2 * D.T.vs && D.B.vs === D.T2.vs && Math.abs(D.A.dp - D.A.vs) < 1e-6 && Math.abs(D.B.dp - D.B.vs) < 1e-6;
  const why = D.err ? D.err : !D.A.bi ? 'G.biome n’a pas basculé en sea' : !D.T.bi ? 'G.biome n’a pas basculé en plains'
    : Math.abs(D.A.dp - D.A.vs) > 1e-6 || Math.abs(D.B.dp - D.B.vs) > 1e-6 ? 'collision sur le trajet : mesure invalide'
    : D.A.vs < 1.2 * D.T.vs ? 'aucun courant porteur : dans le sens du courant ' + f(D.A.vs / D.T.vs, 3) + '× le témoin (attendu ≥ 1,2)'
    : D.B.vs !== D.T2.vs ? 'le courant freine : à contre-courant ' + D.B.vs + ' px contre ' + D.T2.vs + ' en plaines' : 'ok';
  check('courant : 120 ticks dans le sens du courant ≥ 1,2× le témoin en plaines ; à contre-courant, exactement le témoin', ok,
    why + (D.err ? '' : ' — site ' + D.si + ', direction (' + f(D.u[0], 3) + ',' + f(D.u[1], 3) + '), G.courant=' + JSON.stringify(D.C && [+f(D.C[0], 3), +f(D.C[1], 3), D.C[2]])
      + ' ; sens : ' + f(D.A.vs, 3) + ' px contre ' + f(D.T.vs, 3) + ' (×' + f(D.A.vs / D.T.vs, 4) + ') ; contre : ' + f(D.B.vs, 6) + ' contre ' + f(D.T2.vs, 6) + (D.B.vs === D.T2.vs ? ' (===)' : ' (≠)')));
}

/* ---------- 2. glissade du Glacier ---------- */
{ const D = run(`const L=Math.ceil(G.p.spd*3.6*17)+40,u=[1,0];const q=__find('ice',1,0,L),w=__find('plains',1,0,L);
    if(!q)return {err:'aucun segment libre sur la glace'};if(!w)return {err:'aucun segment libre en plaines'};
    const dash=(x,y,b)=>{__tp(x,y);const bi=__settle(b);__tp(x,y);const P=G.p;P.dashT=0;P.inv=0;__T.pin=()=>{G.inX=0;G.inY=0;};G.p.ang=0;
      const g0=(G.dec&&G.dec.givre||[]).length,t0=G.t;tryDash();const dur=P.dashing;let n=0,imm=0;
      while(P.dashing>0&&n<40){step();n++;}const d=P.x-x;
      for(let i=0;i<40;i++){if(P.inv>0||P.dashing>0)imm++;step();}
      const tail=P.x-x;__T.pin=null;
      return {bi,dur,n,d,tail,imm:imm+n,givre:(G.dec&&G.dec.givre||[]).filter(g=>g.t>t0).length,glisseT:G.dec&&G.dec.glisseT,t0};};
    const I=dash(q.x,q.y,'ice'),Pl=dash(w.x,w.y,'plains');
    const Iw=__walk(q.x,q.y,1,0,'ice',120),Pw=__walk(w.x,w.y,1,0,'plains',120);
    return {I,Pl,Iw,Pw};`);
  const ok = !D.err && D.I.bi && D.Pl.bi && D.I.d >= 1.3 * D.Pl.d && D.Iw.vs === D.Pw.vs && D.I.imm === D.Pl.imm && D.I.givre > 0 && D.Pl.givre === 0;
  const why = D.err ? D.err : !D.I.bi ? 'G.biome n’a pas basculé en ice' : !D.Pl.bi ? 'G.biome n’a pas basculé en plains'
    : D.I.d < 1.3 * D.Pl.d ? 'pas de glissade : dash sur la glace ' + f(D.I.d / D.Pl.d, 3) + '× le dash en plaines (' + D.I.dur + ' ticks contre ' + D.Pl.dur + ', attendu ≥ 1,3×)'
    : D.Iw.vs !== D.Pw.vs ? 'le déplacement normal change sur la glace (' + D.Iw.vs + ' contre ' + D.Pw.vs + ')'
    : D.I.imm !== D.Pl.imm ? 'immunité allongée : ' + D.I.imm + ' ticks sur la glace contre ' + D.Pl.imm
    : !(D.I.givre > 0) ? 'aucun sillage de givre exposé (G.dec.givre)' : D.Pl.givre ? 'du givre en plaines' : 'ok';
  check('glissade : dash sur la glace ≥ 1,3× celui des plaines, déplacement normal identique, pas d’immunité en plus, sillage de givre', ok,
    why + (D.err ? '' : ' — dash glace ' + D.I.dur + ' ticks / ' + f(D.I.d) + ' px (avec l’erre : ' + f(D.I.tail) + '), plaines ' + D.Pl.dur + ' ticks / ' + f(D.Pl.d) + ' px (' + f(D.Pl.tail) + ') => ×' + f(D.I.d / D.Pl.d, 3)
      + ' (erre comprise ×' + f(D.I.tail / D.Pl.tail, 3) + ') ; marche 120 ticks ' + f(D.Iw.vs, 6) + ' contre ' + f(D.Pw.vs, 6) + ' ; immunité ' + D.I.imm + ' contre ' + D.Pl.imm + ' ticks ; givre ' + D.I.givre + ' points'));
}

/* ---------- 3. balayage de la Grille néon ---------- */
{ const D = run(`const S=WD.sites,P=G.p;
    for(let k=0;k<S.length;k++){if(S[k].t!=='cyber'||!__calm(S[k].x,S[k].y))continue;
      __tp(S[k].x,S[k].y);if(!__settle('cyber'))continue;__steps(13);
      const W=G.dec&&G.dec.sw;if(!W)return {err:'aucun balayage exposé en Grille néon (G.dec.sw absent) : la bande n’existe pas'};
      const inSite=(x,y)=>siteAt(x,y)===S[k]&&biomeAt(x,y)==='cyber'&&__calm(x,y)&&Math.abs((x-W.x)*W.dx+(y-W.y)*W.dy)<900;
      const open=(x,y,r)=>!pointHit(x,y,r)&&!wallNear(x,y,r);
      let A=null,B=null;
      for(let r=0;r<=1600&&!(A&&B);r+=40)for(let a=0;a<TAU&&!(A&&B);a+=.2){const x=S[k].x+Math.cos(a)*r,y=S[k].y+Math.sin(a)*r;if(!inSite(x,y))continue;
        if(!A&&open(x,y,160)){for(let b=0;b<TAU;b+=.4){const ex=x+Math.cos(b)*800,ey=y+Math.sin(b)*800,cx=x-Math.cos(b)*1300,cy=y-Math.sin(b)*1300;if(open(ex,ey,30)&&open(cx,cy,30)){A={x,y,ex,ey,cx,cy};break;}}}
        if(!B&&wallNear(x,y,40)&&!wallNear(x,y,24)&&!pointHit(x,y,24)){for(let b=0;b<TAU;b+=.4){const ex=x+Math.cos(b)*800,ey=y+Math.sin(b)*800;if(open(ex,ey,30)){B={x,y,ex,ey};break;}}}}
      if(!A||!B)continue;
      const scene=(Q,ctrl)=>{__tp(Q.x,Q.y);__settle('cyber');__steps(13);
        __T.pin=()=>{P.x=P.px=Q.x;P.y=P.py=Q.y;P.vx=P.vy=0;P.inv=1e9;};const v0=G.dec.vuT,T=Math.ceil(SW_L/SW_V)+20;
        /* on attend la bande (au plus une période), PUIS on pose l'ennemi à 800 px (non alerté) et un témoin à 1300 px (en chasse) */
        let n=__steps(T,()=>swIn(Q.x,Q.y)),inBand=swIn(Q.x,Q.y),seen=false,alarm=false;const e=__foe('mite',Q.ex,Q.ey,false),c=ctrl?__foe('mite',Q.cx,Q.cy,true):null;
        let k2=0;for(;k2<12&&swIn(Q.x,Q.y);k2++){step();if(vu(P))seen=true;if(G.dec.vuT!==v0)alarm=true;}
        const ag=e.aggro,at=e.alarmT||0,d0=Math.round(Math.hypot(e.x-Q.x,e.y-Q.y));let ratio=null;
        if(c){const R=[];for(let i=0;i<90;i++){step();if(i>=30)R.push(Math.hypot(e.vx,e.vy)/Math.hypot(c.vx,c.vy));}R.sort((a,b)=>a-b);ratio=R[R.length>>1];/* médiane : un obstacle croisé fausse un relevé isolé */}__T.pin=null;
        return {n,inBand,seen,alarm,ag,alarmT:at>G.t-60,d0,ratio,wall:wallNear(Q.x,Q.y,SW_ABRI)};};
      return {k,W:[W.x,W.y,W.dx,W.dy],A:scene(A,true),B:scene(B,false),Ap:[A.x,A.y],Bp:[B.x,B.y]};}
    return {err:'aucun site cyber avec un point dégagé ET un point collé à une falaise'};`);
  const ok = !D.err && D.A.inBand && D.A.seen && D.A.alarm && D.A.ag && D.A.alarmT && D.A.ratio > 1.2 && D.B.inBand && !D.B.seen && !D.B.alarm && !D.B.ag;
  const why = D.err ? D.err : !D.A.inBand ? 'la bande n’a jamais atteint le point dégagé' : !D.A.seen || !D.A.alarm ? 'joueur dans la bande, loin d’un mur : pas d’alarme'
    : !D.A.ag || !D.A.alarmT ? 'l’ennemi à ' + D.A.d0 + ' px n’est pas alarmé' : !(D.A.ratio > 1.2) ? 'l’ennemi alarmé n’accélère pas (×' + f(D.A.ratio, 3) + ')'
    : !D.B.inBand ? 'la bande n’a jamais atteint le point abrité' : D.B.seen || D.B.alarm ? 'collé à un pare-feu, le joueur est quand même vu' : D.B.ag ? 'l’ennemi s’est alarmé alors que le joueur était abrité' : 'ok';
  check('balayage : dans la bande et loin d’un mur => alarme (ennemi à ~800 px aggro, accéléré) ; collé à un mur => rien', ok,
    why + (D.err ? '' : ' — site ' + D.k + ' ; dégagé : bande au tick ' + D.A.n + ', vu=' + D.A.seen + ', ennemi à ' + D.A.d0 + ' px aggro=' + D.A.ag + ', vitesse ×' + f(D.A.ratio, 3) + ' vs témoin non alarmé'
      + ' ; abrité (mur à < ' + 60 + ' px : ' + D.B.wall + ') : bande au tick ' + D.B.n + ', dans la bande=' + D.B.inBand + ', vu=' + D.B.seen + ', ennemi aggro=' + D.B.ag));
}

/* ---------- 4. relais du Cœur ---------- */
{ const D = run(`let it=null;const nodes=[];for(let cx=-14;cx<=14;cx++)for(let cy=-14;cy<=14;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.live)if(q.t==='node')nodes.push(q);}
    const far=(x,y)=>nodes.every(n=>Math.hypot(n.x-x,n.y-y)>160);
    for(const q of nodes)if(biomeAt(q.x,q.y)==='core'&&[[100,0],[120,0],[400,0],[250,0]].every(([dx])=>biomeAt(q.x+dx,q.y)==='core'&&!pointHit(q.x+dx,q.y,24))&&far(q.x+400,q.y)&&!G.lair.open){it=q;break;}
    if(!it)return {err:'aucun nœud en plein Cœur'};
    __tp(it.x+250,it.y);const bi=__settle('core');__tp(it.x+250,it.y);G.p.crit=0;
    const hit=(dx)=>{const e=__foe('pop',it.x+dx,it.y);e.hp=e.mhp=1000;const h=e.hp;hurtEnemy(e,10,0,0,true);return {e,d:h-e.hp};};
    const a=hit(100),b=hit(120),c=hit(400),z=hit(60);
    for(const q of [a,b,c,z])q.e.hp=q.e.mhp=1e6;
    __T.pin=()=>{for(const q of [a,b,c,z]){q.e.x=it.x+(q===a?100:q===b?120:q===c?400:60);q.e.y=it.y;q.e.vx=q.e.vy=0;}};__steps(1);__T.pin=null;
    const L=G.dec&&G.dec.relais,E=Array.isArray(L)?L.find(r=>r.it===it):null;
    return {bi,m100:a.d/c.d,m120:b.d/c.d,m60:z.d/c.d,d400:c.d,list:!!L,listed:E?[E.pro.includes(a.e),E.pro.includes(z.e),E.pro.includes(b.e),E.pro.includes(c.e)]:null,
      other:Array.isArray(L)&&L.some(r=>r.pro.includes(c.e)||r.pro.includes(b.e))};`);
  const near = x => Math.abs(x - .45) < 1e-9, one = x => Math.abs(x - 1) < 1e-9;
  const ok = !D.err && D.bi && near(D.m100) && near(D.m60) && one(D.m120) && D.listed && D.listed[0] && D.listed[1] && !D.listed[2] && !D.listed[3] && !D.other;
  const why = D.err ? D.err : !D.bi ? 'G.biome n’a pas basculé en core' : !near(D.m100) || !near(D.m60) ? 'aucune protection : dans le rayon le multiplicateur vaut ' + f(D.m60, 3) + ' (60 px) / ' + f(D.m100, 3) + ' (100 px), attendu 0,45'
    : !one(D.m120) ? 'hors du rayon (120 px) le multiplicateur vaut ' + f(D.m120, 3) : !D.list ? 'aucune liste de protégés exposée (G.dec.relais)'
    : !D.listed || !D.listed[0] || !D.listed[1] ? 'le protégé manque dans G.dec.relais' : D.listed[2] || D.listed[3] || D.other ? 'un ennemi hors du rayon est listé' : 'ok';
  check('relais : dégâts ×0,45 à 60 et 100 px d’un nœud, ×1 à 120 et 400 px ; la liste exposée nomme les protégés', ok,
    why + (D.err ? '' : ' — multiplicateur mesuré (dégâts / dégâts à 400 px) : 60 px ×' + f(D.m60, 4) + ', 100 px ×' + f(D.m100, 4) + ', 120 px ×' + f(D.m120, 4) + ' ; liste ' + JSON.stringify(D.listed)));
}

/* ---------- 5. vent-boussole des Plaines ---------- */
{ const D = run(`const S=WD.sites,M=WD.mainPath,P=G.p,got=new Set();const obj=()=>{for(const i of M)if(!got.has(i))return i;return -1;};
    const walk=()=>{let mx=0,n=0,nul=0;__T.pin=()=>{const V=G.vent;if(V){G.inX=-V.y;G.inY=V.x;}};/* on marche EN TRAVERS du vent : le pire cas pour la dérive entre deux relevés */
      for(let i=0;i<120;i++){step();for(const i of M)if(!got.has(i)&&Math.hypot(S[i].x-P.x,S[i].y-P.y)<500)return {err:'le test est passé près du site '+i};const V=G.vent,o=obj();
        if(!V||typeof V.x!=='number'){nul++;continue;}n++;const a=Math.abs(angDiff(Math.atan2(V.y,V.x),Math.atan2(S[o].y-P.y,S[o].x-P.x)))*180/Math.PI;if(a>mx)mx=a;}
      __T.pin=null;return {mx,n,nul,o:obj()};};
    const spot=(r0)=>{for(let r=r0;r<=700;r+=40)for(let a=0;a<TAU;a+=.3){const x=S[0].x+Math.cos(a)*r,y=S[0].y+Math.sin(a)*r;if(biomeAt(x,y)==='plains'&&!pointHit(x,y,30))return [x,y];}return null;};
    if(S[M[0]]!==S[0])return {err:'mainPath ne part pas de l’origine'};
    got.add(M[0]);const p=spot(0);__tp(p[0],p[1]);const b1=__settle('plains');__steps(13);const w1=walk();
    const m1=obj();__tp(S[m1].x,S[m1].y);for(let r=0;pointHit(P.x,P.y,30)&&r<400;r+=20)__tp(S[m1].x+r,S[m1].y);__settle(S[m1].t);__steps(13);const away=G.vent;got.add(m1);
    for(const i of M)if(Math.hypot(S[i].x-P.x,S[i].y-P.y)<700)got.add(i);
    const q=spot(100);__tp(q[0],q[1]);const b2=__settle('plains');__steps(13);const w2=walk();
    return {b1,b2,w1,w2,m1,m2:w2.o,away:S[m1].t==='plains'?'plaines':away===null?'null':typeof away,t1:S[m1].t};`);
  const src = ORDER.map(read).join('\n');
  const copies = (src.match(/[^=!<>]=\s*G\.vent\b(?!\s*=)|:\s*G\.vent\b|\bG\.vent\s*=[^=]/g) || []);
  const writes = copies.filter(s => /G\.vent\s*=[^=]/.test(s)).length, reads = copies.length - writes;
  const bad = w => !w || w.err || !(w.n > 0) || w.nul || w.mx >= 30;
  const ok = !D.err && D.b1 && D.b2 && !bad(D.w1) && !bad(D.w2) && D.m1 !== D.m2 && reads === 0 && writes <= 2;
  const why = D.err ? D.err : !D.b1 || !D.b2 ? 'G.biome n’a pas basculé en plains' : D.w1.err || D.w2.err || ''
    || (!(D.w1.n > 0) ? 'G.vent absent en plaines : aucun vent-boussole' : D.w1.nul || D.w2.nul ? 'G.vent manquant sur ' + (D.w1.nul + D.w2.nul) + ' ticks'
    : D.w1.mx >= 30 || D.w2.mx >= 30 ? 'angle au-delà de 30° (' + f(Math.max(D.w1.mx, D.w2.mx)) + '°)' : reads ? 'G.vent est recopié ' + reads + ' fois dans le code' : writes > 2 ? 'G.vent écrit en ' + writes + ' endroits' : 'ok');
  check('vent : en plaines, G.vent vise le prochain nœud non atteint de WD.mainPath (angle < 30° en marchant), et rien ne recopie sa valeur', ok,
    why + (D.err ? '' : ' — objectif 1 : site ' + D.m1 + ' (' + D.t1 + '), angle max ' + f(D.w1.mx) + '° sur ' + D.w1.n + ' ticks ; atteint, puis objectif 2 : site ' + D.m2 + ', angle max ' + f(D.w2.mx) + '° sur ' + D.w2.n + ' ticks'
      + ' ; G.vent hors plaines : ' + D.away + ' ; code : ' + writes + ' écriture(s), ' + reads + ' recopie(s)'));
}

console.log('\n---------------- TERRAIN ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  ECHEC ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log(all ? 'TOUT PASSE' : 'ECHEC');
process.exit(all ? 0 : 1);
