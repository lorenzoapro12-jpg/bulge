'use strict';
/* =========================================================
   Test headless de BULGE — exécute la VRAIE logique de jeu
   Utilise le mode simulation intégré au jeu (window.__SIM) : les modules sont chargés tels quels dans un DOM
   stubé (test/lib.js), avec une horloge virtuelle et un Math.random à graine. Aucune copie du code du jeu.

   node test/headless.js                  parties complètes + scénarios + gardes (sous-processus)
   node test/headless.js --scenarios      scénarios et gardes seulement (sans les parties complètes)
   node test/headless.js --sans-gardes    sans les gardes en sous-processus (mise au point)
   node test/headless.js --ref=HEAD       charge les modules depuis git (ex. état d'origine), sans rien écrire
   Code de sortie : 0 si tout passe, 1 sinon.

   Refonte en îlots (01/10/2026) : huit îlots = huit niveaux (trois vagues puis un boss chacun), un bonus à
   choisir à l'arrivée sur chaque îlot, des power-ups à ramasser, une membrane en segments pour vie. Les
   scénarios de l'ancienne version (duel, autel, hangar, prologue, défi du jour, cœurs, monde ouvert) sont
   partis avec leurs systèmes ; ceux qui gardaient une propriété toujours vraie (aucun lookbehind de regex,
   Espace capturé sur l'écran de choix, pointercancel qui relâche un bouton tactile, indépendance à l'algorithme
   de tri, hooks du harnais) sont repris sur le nouveau jeu.
   ========================================================= */
const path = require('path');
const cp = require('child_process');
const L = require('./lib');

const REF = L.ARG('ref'), ONLY_SCN = !!L.ARG('scenarios'), NO_SUB = !!L.ARG('sans-gardes');
const ROOT = L.ROOT;
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail: detail || '' }); };

const H0 = L.mkGame({ ref: REF });
console.log('[ok] jeu chargé : ' + H0.order.length + ' modules' + (REF ? ' (git ' + REF + ')' : '') + ', ' + H0.code.length + ' octets de JS exécutés sans exception');
console.log('[ok] SIMF() = ' + H0.call('SIMF()'));

/* ---------- observateur, écrit DANS le realm du jeu (appelé à chaque pas, coût minimal) ----------
   Ce qu'une partie complète doit respecter, vérifié à chaque image et non à la fin :
   - le boss d'un îlot n'arrive qu'après ses NWAVE vagues, et une seule fois ;
   - un type d'ennemi n'est jamais présent au-delà de GONEA îlots d'écart ; à PREYA il est une proie
     (sauf les petits que pond un Porteur : ils ont l'âge de leur parent) ;
   - la bulle et les ennemis restent dans l'îlot (rayon jouable PR, plus une marge de rebond). */
const OBS = `window.__OB={err:[],boss:{},waves:{},kills:{},ph:[],types:{},maxR:0,maxER:0};
window.__OBS=function(){const O=window.__OB;if(!G||!G.p)return;const k=G.isl;
  if(O.ph.length===0||O.ph[O.ph.length-1]!==k+':'+G.ph)O.ph.push(k+':'+G.ph);
  if(G.ph==='wave')O.waves[k]=Math.max(O.waves[k]||0,G.wave);
  if(G.boss&&!O.boss[k]){O.boss[k]=1;if((O.waves[k]||0)!==NWAVE)O.err.push('îlot '+k+' : boss après '+(O.waves[k]||0)+' vague(s)');}
  if(G.boss&&G.boss.dead)O.kills[k]=1;
  const P=G.p;if(G.state==='play'){const r=Math.hypot(P.x,P.y);if(r>O.maxR)O.maxR=r;}
  for(const e of G.en){if(e.dead)continue;const age=k-e.d.isl;(O.types[k]||(O.types[k]={}))[e.t]=1;
    if(!e.parent&&age>=GONEA&&O.err.length<20)O.err.push('îlot '+k+' : '+e.t+' encore là à '+age+' îlots d écart');
    if(!e.parent&&e.prey!==(age>=PREYA)&&O.err.length<20)O.err.push('îlot '+k+' : '+e.t+' proie='+e.prey+' à '+age+' îlots d écart');
    const r=Math.hypot(e.x,e.y);if(e.spawn<=0&&r>O.maxER)O.maxER=r;}};`;
const ETL = ['mite', 'spike', 'spread', 'sniper', 'orbit', 'gatling', 'ring', 'spawner'], K8 = [1, 2, 3, 4, 5, 6, 7, 8];

/* =========================================================
   PARTIES COMPLÈTES
   ========================================================= */
function playRun(name, seed, maxSteps, o = {}) {
  const H = L.mkGame({ ref: REF, seed });
  const res = { run: name, seed, ended: 0, win: null, steps: 0, error: null, choix: [] };
  H.win.__SIM_PICK = (c) => { res.choix.push(c.map(x => x.u.id)); return c[Math.floor(H.call('Math.random()') * c.length)]; };
  H.win.__SIM_END = (w) => { res.ended++; res.win = w; };
  H.ai(o.god); if (o.boost) H.call('window.__SIM_BOOST=' + o.boost);
  H.call(OBS); const OB = H.call('window.__OBS');
  const t0 = Date.now(); let n = 0;
  try { H.start(); for (; n < maxSteps && !res.ended; n++) { H.STEP(); OB(); H.advance(1000 / 60); }
    /* après la fin : quelques pas encore, rien ne doit relancer __SIM_END ni lever */
    for (let i = 0; i < 120; i++) { H.STEP(); H.advance(1000 / 60); } }
  catch (e) { res.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  const G = JSON.parse(H.call('JSON.stringify({isl:G.isl,state:G.state,score:G.score,kills:G.kills,eats:G.eats,picks:G.picks,maxIsl:G.maxIsl,t:G.t,seg:G.p.seg})'));
  Object.assign(res, G, { steps: n, ms: Date.now() - t0, ob: JSON.parse(H.call('JSON.stringify(window.__OB)')) });
  console.log(JSON.stringify({ run: res.run, seed, steps: n, ms: res.ms, fin: res.ended, victoire: res.win, ilot: res.isl, score: res.score, kills: res.kills, eats: res.eats, bonus: res.picks.join(','), erreurs: res.ob.err.length, err: res.error }));
  return res;
}
if (!ONLY_SCN) {
  console.log('\n=== PARTIES COMPLÈTES ===');
  /* naturelle : l'IA de test joue pour de vrai (elle finit par éclater, ou la partie est coupée à 40 min de jeu) */
  const r1 = playRun('naturelle', 12345, 60 * 60 * 40);
  /* assistées : membrane entretenue et dégâts ×4 — couvrent le déroulé COMPLET des 8 îlots jusqu'à la victoire */
  const r2 = playRun('assistee', 999, 60 * 60 * 60, { god: true, boost: 4 });
  const r3 = playRun('assistee-2', 31337, 60 * 60 * 60, { god: true, boost: 4 });
  const rs = [r1, r2, r3];
  check('parties : aucune exception', rs.every(r => !r.error), rs.filter(r => r.error).map(r => r.run + ': ' + r.error).join(' ; '));
  check('parties : invariants tenus à chaque image (boss après les 3 vagues, proies et disparitions selon l’âge)', rs.every(r => !r.ob.err.length), rs.map(r => r.ob.err.slice(0, 3).join(' ; ')).filter(Boolean).join(' | '));
  check('parties : la bulle et les ennemis restent dans l’îlot', rs.every(r => r.ob.maxR < 900 + 30 && r.ob.maxER < 900 + 60), rs.map(r => r.run + ' bulle ' + Math.round(r.ob.maxR) + ' ennemis ' + Math.round(r.ob.maxER)).join(', ') + ' (PR 900)');
  check('naturelle : elle joue (absorptions, éclatés, îlot 1 fini)', r1.kills > 0 && r1.maxIsl >= 2, 'kills=' + r1.kills + ' eats=' + r1.eats + ' îlot max=' + r1.maxIsl);
  check('naturelle : si elle finit, c’est une défaite signalée UNE fois', !r1.ended || (r1.ended === 1 && r1.win === false && r1.state === 'end'), 'fin=' + r1.ended + ' victoire=' + r1.win + ' état=' + r1.state);
  for (const r of [r2, r3]) {
    check(r.run + ' : VICTOIRE après les 8 îlots (__SIM_END(true) une seule fois)', r.ended === 1 && r.win === true && r.isl === 8 && r.state === 'end', 'fin=' + r.ended + ' victoire=' + r.win + ' îlot=' + r.isl + ' pas=' + r.steps);
    check(r.run + ' : 8 boss, chacun abattu', K8.every(k => r.ob.boss[k] && r.ob.kills[k]), 'boss=' + Object.keys(r.ob.boss).join(',') + ' abattus=' + Object.keys(r.ob.kills).join(','));
    check(r.run + ' : un bonus choisi à l’arrivée sur chaque îlot, parmi 3 cartes distinctes', r.picks.length === 8 && r.choix.length === 8 && r.choix.every(c => c.length === 3 && new Set(c).size === 3), 'bonus=' + r.picks.length + ' tirages=' + r.choix.map(c => c.length).join(''));
    const ty = r.ob.types, permis = k => Object.keys(ty[k] || {}).every(t => { const a = k - ETL.indexOf(t) - 1; return a >= 0 && (a < 4 || t === 'mite'); });
    check(r.run + ' : chaque îlot apporte son ennemi (le type de l’îlot k est là à l’îlot k), et rien d’autre que ses aînés', K8.every(k => ty[k] && ty[k][ETL[k - 1]]) && K8.every(permis),
      K8.map(k => k + ':' + Object.keys(ty[k] || {}).join('+')).join(' '));
  }
  /* même graine, même partie : deux instances neuves, 20 000 pas, empreinte identique */
  const dig = () => { const H = L.mkGame({ ref: REF, seed: 4242 }); H.win.__SIM_PICK = c => c[1]; H.ai(true); H.start(); H.steps(20000);
    return H.call('[G.isl,G.ph,G.wave,G.score,G.kills,G.eats,G.picks.join(),G.p.x.toFixed(3),G.p.y.toFixed(3),G.en.length,G.eb.length,WD.seed].join("|")'); };
  const d1 = dig(), d2 = dig();
  check('déterminisme : même graine, même partie (20 000 pas, deux instances)', d1 === d2, d1 === d2 ? d1 : d1 + ' ≠ ' + d2);
}

/* =========================================================
   SCÉNARIOS : chacun sur une instance neuve, graine 4242, premier bonus choisi
   ========================================================= */
function scenario(name, fn) {
  let r;
  try { const H = L.mkGame({ ref: REF, seed: 4242 }); H.win.__SIM_PICK = (c) => c[0]; r = fn(H); }
  catch (e) { r = { ok: false, detail: 'exception : ' + String(e && e.message || e) }; }
  check(name, r.ok, r.detail);
}
/* place la partie sur l'îlot k, sans le choix de bonus, à la phase voulue */
const onIslet = (H, k, ph) => H.call(`G.state='play';G.tr=null;genIslet(G.seed,${k});G.isl=${k};islStart();G.pickIsl=${k};` + (ph ? `G.ph='${ph}';G.phT=0;` : ''));
/* une arène vide et sans vague : pour poser soi-même ce qu'on mesure */
const calme = H => H.call('G.en=[];G.eb=[];G.marks=[];G.wq=null;G.ph="pause";G.phT=-1e9;');
console.log('\n=== SCÉNARIOS ===');

scenario('hooks : SIMF / __SIM / __SIM_INPUT / __SIM_PICK / __SIM_END utilisés par le jeu', H => ({
  ok: H.call('typeof SIMF') === 'function' && ['__SIM_END', '__SIM_PICK', '__SIM_INPUT'].every(h => H.code.includes('window.' + h)) && H.code.includes('window.__SIM'),
}));
scenario('vieux navigateurs : aucun lookbehind ni groupe nommé de regex « (?< » dans les modules', H => {
  const bad = H.order.filter(f => L.readModule(f, REF).includes('(?<'));
  return { ok: bad.length === 0, detail: bad.join(', ') };
});
scenario('choix d’un bonus : à l’arrivée sur l’îlot 1, 3 cartes distinctes, celle choisie appliquée', H => {
  let got = null; H.win.__SIM_PICK = c => (got = c.map(x => x.u.id), c[2]);
  H.start(); H.steps(60);
  const p = H.call('G.picks.join()'), own = JSON.parse(H.call('JSON.stringify(G.p.cards)'));
  return { ok: got && got.length === 3 && new Set(got).size === 3 && p === got[2] && own[got[2]] === 1, detail: 'tirage=' + got + ' pris=' + p };
});
scenario('tirage : 3 cartes distinctes, pas de pacte avant l’îlot 3, fusion offerte avec ses ingrédients, pas de carte au maximum', H => {
  H.start(); H.steps(30);
  const r = JSON.parse(H.call(`(()=>{const P=G.p,o={bad:0,pact1:0,pact3:0,fus:0,max:0};P.cards={};
    for(let i=0;i<400;i++){G.isl=1+(i%2);const c=rollCards();if(c.length!==3||new Set(c.map(x=>x.u.id)).size!==3)o.bad++;if(c.some(x=>x.k==='p'))o.pact1++;}
    for(let i=0;i<400;i++){G.isl=3+(i%6);if(rollCards().some(x=>x.k==='p'))o.pact3++;}
    G.isl=4;P.cards={twin:1,rapid:1};for(let i=0;i<200;i++)if(rollCards().some(x=>x.u.id==='hydra'))o.fus++;
    P.cards={};for(const u of BON)P.cards[u.id]=u.max;P.cards.twin=0;for(let i=0;i<50;i++)for(const x of rollCards())if(x.k==='b'&&x.u.id!=='twin')o.max++;
    return JSON.stringify(o);})()`));
  return { ok: !r.bad && !r.pact1 && r.pact3 > 40 && r.fus > 60 && !r.max, detail: JSON.stringify(r) };
});
scenario('bonus : chaque bonus, fusion et pacte change vraiment la bulle', H => {
  H.start(); H.steps(30);
  const sans = JSON.parse(H.call(`(()=>{const out=[];for(const id in CARDS){const P=mkPlayer(),a=JSON.stringify(P);CARDS[id].u.f(P);if(JSON.stringify(P)===a)out.push(id);}return JSON.stringify(out);})()`));
  const n = H.call('Object.keys(CARDS).length');
  return { ok: n >= 40 && sans.length === 0, detail: n + ' cartes' + (sans.length ? ', sans effet : ' + sans.join(',') : '') };
});
scenario('power-ups : invincibilité 6 s au plus, les chronométrés expirent, réparation, bouclier, onde', H => {
  H.start(); H.steps(30); calme(H);
  const r = JSON.parse(H.call(`(()=>{const P=G.p,o={};o.invD=PU.inv.d;takePU({k:'inv'});o.inv=P.pu.inv;
    takePU({k:'rapid'});const d=P.pu.rapid;for(let i=0;i<d+1;i++)updPUs();o.rapidFin=P.pu.rapid===undefined;
    P.seg=P.segMax-1;takePU({k:'repair'});o.rep=P.seg===P.segMax;
    P.inv=0;delete P.pu.inv;takePU({k:'shield'});const s0=P.seg;hurtPlayer(P.x+50,P.y);o.shield=P.seg===s0&&!P.pu.shield;
    const e=mkEnemy('mite',P.x+120,P.y,{spawn:0});G.en.push(e);const h0=e.hp;takePU({k:'wave'});o.wave=e.hp<h0||e.dead;
    return JSON.stringify(o);})()`));
  return { ok: r.invD <= 360 && r.inv === r.invD && r.rapidFin && r.rep && r.shield && r.wave, detail: JSON.stringify(r) };
});
scenario('membrane : un coup = un segment, puis invulnérable ; au dernier, éclatement et __SIM_END(false) une fois', H => {
  const fin = []; H.win.__SIM_END = w => fin.push(w);
  H.start(); H.steps(30); calme(H);
  const a = JSON.parse(H.call('(()=>{const P=G.p;P.inv=0;const s=P.seg;hurtPlayer(P.x+40,P.y);return JSON.stringify({d:s-P.seg,inv:P.inv});})()'));
  H.call('G.p.seg=1;G.p.inv=0;G.p.second=0;hurtPlayer(G.p.x+40,G.p.y);');
  const st = H.call('G.state'); H.steps(200);
  return { ok: a.d === 1 && a.inv > 0 && st === 'dying' && fin.length === 1 && fin[0] === false && H.call('G.state') === 'end', detail: JSON.stringify(a) + ' état=' + st + ' fins=' + JSON.stringify(fin) };
});
scenario('second souffle : un coup fatal laisse à 1 segment, une fois par îlot', H => {
  H.start(); H.steps(30); calme(H);
  const r = H.call(`(()=>{const P=G.p;P.second=1;P.seg=1;P.inv=0;hurtPlayer(P.x+40,P.y);const a=P.seg===1&&G.state==='play'&&P.secUsed;
    P.inv=0;hurtPlayer(P.x+40,P.y);const b=G.state==='dying';return a+','+b;})()`);
  return { ok: r === 'true,true', detail: r };
});
scenario('échelle : un type rapetisse de ×1,4 par îlot d’écart, devient proie à 2, quitte le tirage à 4', H => {
  H.start(); H.steps(30);
  const r = JSON.parse(H.call(`(()=>{const bad=[];for(let k=1;k<=8;k++){G.isl=k;for(const t of ETL){const d=ET[t];if(d.isl>k)continue;const e=mkEnemy(t,0,0),a=k-d.isl;
      if(Math.abs(e.r-d.r*Math.pow(1.4,-a))>1e-6||e.prey!==(a>=2))bad.push(k+':'+t);}}
    const gone=[];for(let k=5;k<=8;k++){G.isl=k;G.wq={left:40,n:40,el:99,eld:true,prey:40,nextT:0};for(let i=0;i<300;i++){G.marks=[];spawnGroup();for(const m of G.marks)if(k-ET[m.t2].isl>=4)gone.push(k+':'+m.t2);}}
    return JSON.stringify({bad,gone:gone.slice(0,5),GROW,PREYA,GONEA});})()`));
  return { ok: !r.bad.length && !r.gone.length && r.GROW === 1.4 && r.PREYA === 2 && r.GONEA === 4, detail: JSON.stringify(r) };
});
scenario('lisibilité : le tir automatique ne vise que ce qui est à l’écran', H => {
  H.start(); H.steps(30); calme(H);
  const r = H.call(`(()=>{const P=G.p,hw=W/2/G.zoom,hh=H/2/G.zoom;const far=mkEnemy('mite',G.cx,G.cy+hh+60,{spawn:0});G.en=[far];
    const a=findTarget(P.x,P.y,700)===null;const near=mkEnemy('mite',G.cx+hw*.5,G.cy,{spawn:0});G.en.push(near);const b=findTarget(P.x,P.y,700)===near;
    return a+','+b+','+Math.round(Math.hypot(far.x-P.x,far.y-P.y));})()`);
  return { ok: r.startsWith('true,true'), detail: 'hors écran ignoré, à l’écran visé ; distance du témoin hors écran ' + r.split(',')[2] };
});
scenario('apparitions : chaque groupe est annoncé au sol, à vue mais pas collé, dans l’îlot', H => {
  H.start(); H.steps(30);
  const r = JSON.parse(H.call(`(()=>{const P=G.p,o={n:0,proche:0,dehors:0,mur:0,court:0};for(let k=1;k<=8;k++){genIslet(G.seed,k);G.isl=k;islStart();G.pickIsl=k;
    for(let i=0;i<60;i++){P.x=(R()-.5)*900;P.y=(R()-.5)*900;if(pointHit(P.x,P.y,30)||wallNear(P.x,P.y,30))continue;G.marks=[];G.wq={left:9,n:9,el:99,eld:true,prey:0,nextT:0};spawnGroup();
      for(const m of G.marks){o.n++;const d=Math.hypot(m.x-P.x,m.y-P.y);if(d<290)o.proche++;if(Math.hypot(m.x,m.y)>PR-60)o.dehors++;if(wallNear(m.x,m.y,40))o.mur++;if(m.max<30)o.court++;}}}
    return JSON.stringify(o);})()`));
  return { ok: r.n > 300 && !r.proche && !r.dehors && !r.mur && !r.court, detail: JSON.stringify(r) };
});
scenario('déroulé : arrivée, 3 vagues séparées par des pauses, le boss, l’îlot nettoyé, puis le passage', H => {
  H.ai(true); H.call('window.__SIM_BOOST=6'); H.call(OBS); const OB = H.call('window.__OBS');
  H.start(); for (let i = 0; i < 60 * 60 * 6 && H.call('G.isl') < 2; i++) { H.STEP(); OB(); H.advance(1000 / 60); }
  const ph = H.call('window.__OB.ph.join(" ")'), want = '1:arrive 1:wave 1:pause 1:wave 1:pause 1:wave 1:preboss 1:boss 1:clear';
  return { ok: ph.startsWith(want) && H.call('G.isl') === 2, detail: ph.slice(0, 160) };
});
scenario('îlot nettoyé : un segment de membrane revient', H => {
  H.start(); H.steps(30); H.call('G.p.inv=1e9;G.p.seg=G.p.segMax-2;G.en=[];G.eb=[];G.boss=null;islClear();');
  const s0 = H.call('G.p.seg'); H.steps(150);
  return { ok: H.call('G.p.seg') === s0 + 1, detail: s0 + ' → ' + H.call('G.p.seg') + ' / ' + H.call('G.p.segMax') };
});
scenario('passage d’îlot : îlot suivant généré, relique au centre, ennemis effacés, la bulle plus forte (×GROWD)', H => {
  H.start(); H.steps(30); H.call('G.p.inv=1e9;G.en=[];G.eb=[];G.boss=null;islClear();');
  const d0 = H.call('G.p.dmg'); H.steps(400, () => H.call('G.state') === 'trans');
  const mid = H.call('G.state'); H.steps(300, () => H.call('G.state') === 'play' && H.call('G.isl') === 2);
  const r = JSON.parse(H.call('JSON.stringify({isl:G.isl,wd:WD.isl,st:G.state,rel:!!WD.relic,en:G.en.length,eb:G.eb.length,pus:G.pus.length,dmg:G.p.dmg,biome:G.biome})'));
  return { ok: mid === 'trans' && r.isl === 2 && r.wd === 2 && r.st === 'play' && r.rel && !r.en && !r.eb && Math.abs(r.dmg / d0 - 1.2) < 1e-9 && r.biome === 'floral', detail: 'pendant=' + mid + ' ' + JSON.stringify(r) };
});
scenario('îlots : genIslet est déterministe et ne dépend ni de Math.random ni de l’algorithme de tri', H => {
  const dg = `(k=>{genIslet(777,k);const h=[WD.seed,WD.wall.join('')];for(let cx=-COFF;cx<COFF;cx++)for(let cy=-COFF;cy<COFF;cy++){const c=getChunk(cx,cy);if(!c)continue;for(const o of c.obs)h.push([o.k,Math.round(o.x),Math.round(o.y),Math.round(o.r||o.w),o.brk||0,o.pu?1:0].join(','));h.push(c.live.length);}
    let s=0;const t=h.join(';');for(let i=0;i<t.length;i++)s=(Math.imul(s,31)+t.charCodeAt(i))|0;return s;})`;
  const a = [], b = [], c = [];
  for (const k of K8) a.push(H.call(dg + '(' + k + ')'));
  H.call('for(let i=0;i<1000;i++)Math.random();');
  for (const k of K8) b.push(H.call(dg + '(' + k + ')'));
  /* un autre algorithme de tri (correct, mais pas celui de V8) ne doit rien changer */
  H.call(`Array.prototype.__s=Array.prototype.sort;Array.prototype.sort=function(f){const a=this.slice().reverse();f=f||((x,y)=>String(x)<String(y)?-1:String(x)>String(y)?1:0);
    for(let i=1;i<a.length;i++){const v=a[i];let j=i-1;while(j>=0&&f(a[j],v)>0){a[j+1]=a[j];j--;}a[j+1]=v;}for(let i=0;i<a.length;i++)this[i]=a[i];return this;};ISLM.clear();ISLS=-1;`);
  try { for (const k of K8) c.push(H.call(dg + '(' + k + ')')); } finally { H.call('Array.prototype.sort=Array.prototype.__s;'); }
  return { ok: a.join() === b.join() && a.join() === c.join() && new Set(a).size === 8, detail: a.join(',') };
});
scenario('gonfler : jauge pleine, la bulle grossit et avale l’ennemi plus petit au contact', H => {
  H.start(); H.steps(30); calme(H);
  const r = JSON.parse(H.call(`(()=>{const P=G.p,r0=P.r;P.gauge=1;tryGonfle();const on=P.gon>0;G.en=[mkEnemy('spike',P.x+P.r*2.2,P.y,{spawn:0})];const e0=G.eats;
    for(let i=0;i<30;i++)step();return JSON.stringify({on,r0,r:P.r,eats:G.eats-e0});})()`));
  return { ok: r.on && r.r > r.r0 * 1.5 && r.eats >= 1, detail: JSON.stringify(r) };
});
scenario('décor cassable : il cède sous les tirs, et celui qui porte un power-up le lâche', H => {
  H.start(); H.steps(30);
  const r = JSON.parse(H.call(`(()=>{let o=null;for(let cx=-COFF;cx<COFF&&!o;cx++)for(let cy=-COFF;cy<COFF&&!o;cy++){const c=getChunk(cx,cy);if(c)for(const q of c.obs)if(q.brk&&q.pu){o=q;break;}}
    if(!o)return JSON.stringify({o:0});const n0=G.pus.length;let i=0;while(!o.gone&&i++<500)hitObs(o,1);return JSON.stringify({o:1,coups:i,parti:!!o.gone,pu:G.pus.length-n0,reste:pointHit(o.cx,o.cy,1)===o});})()`));
  return { ok: r.o && r.parti && r.pu === 1 && !r.reste, detail: JSON.stringify(r) };
});
scenario('boss : tout coup qui n’est pas un tir (charge, rayon, rafale, couronne) est annoncé, et assez tôt', H => {
  H.start(); H.steps(30);
  /* chaque télégraphe est noté à sa création ; une charge (B.st 1 → 2) doit suivre une bande 'path' */
  H.call(`window.__TL=[];const __t=tele;tele=function(o){window.__TL.push({ty:o.ty,w:o.warn,k:G.boss&&G.boss.k,ph:G.boss&&G.boss.phase});return __t(o);};`);
  const out = [], bad = [];
  for (const k of K8) {
    onIslet(H, k, 'preboss'); H.call('G.phT=99;G.p.inv=1e9;window.__TL=[];window.__CH=0;window.__PA=0;');
    let st0 = 0;
    for (let n = 1; n < 60 * 50; n++) { H.STEP(); H.advance(1000 / 60);
      if (n === 60 * 25) H.call('if(G.boss)G.boss.hp=G.boss.mhp*.45'); if (n === 60 * 40 && k === 8) H.call('if(G.boss)G.boss.hp=G.boss.mhp*.3');
      const st = H.call('G.boss?G.boss.st:0'); if (st === 2 && st0 !== 2 && H.call('!!(G.boss&&G.boss.k<=2)')) H.call('window.__CH++'); st0 = st; }
    const tl = JSON.parse(H.call('JSON.stringify(window.__TL)')), path = tl.filter(t => t.ty === 'path').length, ch = H.call('window.__CH');
    for (const t of tl) if (t.w < 18) bad.push(k + ':' + t.ty + ' ' + t.w + ' pas');
    if (ch > path) bad.push(k + ': ' + ch + ' charges pour ' + path + ' bandes');
    out.push(k + ':' + tl.length + (ch ? '/' + ch + 'ch' : ''));
  }
  /* les boss à coups spéciaux (pas seulement des tirs) les annoncent : 1 et 2 chargent, 4 et 8 tirent des rayons, 5 couronne, 6 rafales */
  const avec = out.filter(s => +s.split(':')[1].split('/')[0] > 0).map(s => +s.split(':')[0]);
  return { ok: !bad.length && [1, 2, 4, 5, 6, 8].every(k => avec.includes(k)), detail: 'télégraphes par boss ' + out.join(' ') + (bad.length ? ' ; ' + bad.slice(0, 4).join(', ') : '') };
});

/* ---------- interface réelle (hors mode simulation) ---------- */
scenario('écran de choix : 1 à 3 choisissent, R relance, Espace capturé à l’appui ET au relâché', H => {
  H.boot(); H.start(); H.steps(30);
  H.noSim('G.choices=rollCards();G.state="pick";G.rerolls=1;renderPick();show("ov-evo");');
  const html = H.doc.getElementById('evoCards').innerHTML, nb = (html.match(/data-i=/g) || []).length;
  H.key('KeyR'); const rr = H.call('G.rerolls') === 0 && H.call('G.choices.length') === 3;
  const pdDown = H.key('Space'); let pdUp = 0; H.win._fire('keyup', { code: 'Space', preventDefault() { pdUp++; } });
  const n0 = H.call('G.picks.length'), id = H.call('G.choices[1].u.id'); H.noSim('onKey({code:"Digit2",repeat:false,preventDefault(){}})');
  const ok = nb === 3 && !/undefined|NaN/.test(html) && rr && pdDown >= 1 && pdUp >= 1 && H.call('G.state') === 'play' && H.call('G.picks.length') === n0 + 1 && H.call('G.picks[G.picks.length-1]') === id;
  return { ok, detail: 'cartes=' + nb + ' relance=' + rr + ' Espace appui/relâché=' + pdDown + '/' + pdUp + ' état=' + H.call('G.state') };
});
scenario('pause : Échap fige la partie et dit où l’on en est ; Échap la reprend', H => {
  H.boot(); H.start(); H.steps(30); H.call('G.state="play"');
  H.key('Escape'); const st = H.call('G.state'), info = H.doc.getElementById('pauseInfo').textContent, fige = 'G.time+","+G.p.x+","+G.en.map(e=>e.x).join()';
  const t = H.call(fige); H.steps(30); const t2 = H.call(fige);
  H.key('Escape');
  return { ok: st === 'pause' && /Îlot 1 sur 8/.test(info) && t === t2 && H.call('G.state') === 'play', detail: st + ' « ' + info + ' »' };
});
scenario('fin de partie : l’écran de fin, les records et le menu se remplissent sans « undefined » ni « NaN »', H => {
  H.boot(); H.start(); H.steps(300);
  H.noSim('endRun(false)'); H.advance(1000);
  const end = H.doc.getElementById('endT').textContent + ' ' + H.doc.getElementById('endS').textContent + ' ' + H.doc.getElementById('endStats').innerHTML + H.doc.getElementById('endBuild').innerHTML;
  H.noSim('renderLB();renderMenu()');
  const lb = H.doc.getElementById('lbBody').innerHTML, mn = H.doc.getElementById('mStats').innerHTML;
  const ok = /Éclaté/.test(end) && !/undefined|NaN/.test(end + lb + mn) && /Îlot 1 \/ 8/.test(lb) && /partie/.test(mn);
  return { ok, detail: end.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140) };
});
scenario('sauvegarde abîmée : le menu s’affiche et une partie se joue', () => {
  const H = L.mkGame({ ref: REF, seed: 4242, storage: { bulge3_meta: JSON.stringify({ lb: [null, { s: 'x' }, { s: 120, i: 2, w: 0, d: 600 }], runs: 'x', best: {}, mute: 1 }) } });
  H.win.__SIM_PICK = c => c[0];
  H.boot(); H.noSim('renderMenu();renderLB()'); const lb = H.doc.getElementById('lbBody').innerHTML, mn = H.doc.getElementById('mStats').innerHTML;
  H.start(); H.ai(false); H.steps(600);
  return { ok: H.call('G.t') >= 600 && !/undefined|NaN/.test(lb + mn) && /120/.test(lb), detail: 'meta=' + H.call('JSON.stringify(meta)').slice(0, 120) };
});
scenario('tactile : pointercancel sur le bouton de dash le relâche sans dasher', H => {
  H.boot(); H.start(); H.steps(30); H.call('inp.touch=true;G.state="play";G.p.dashT=0;');
  const b = JSON.parse(H.call('JSON.stringify(hudHit(0,0,()=>{const b=dashBtn();return{x:b.x+SAFE.l,y:b.y+SAFE.t};}))'));
  const cv = H.doc.getElementById('cv'), ev = (t) => cv._fire(t, { pointerType: 'touch', pointerId: 7, clientX: b.x, clientY: b.y, preventDefault() {} });
  ev('pointerdown'); const pris = H.call('!!inp.B'); ev('pointercancel');
  return { ok: pris && H.call('inp.B') === null && H.call('G.p.dashT') === 0, detail: 'pris=' + pris + ' relâché=' + (H.call('inp.B') === null) + ' dashT=' + H.call('G.p.dashT') };
});
scenario('rendu : render() sans exception dans chaque état (menu, jeu, choix, pause, boss, passage, éclatement, fin), compteur allumé', H => {
  H.boot(); const done = [];
  const R = (n) => { H.call('render()'); done.push(n); };
  R('menu'); H.start(); H.call('meta.fps=true'); H.steps(200); R('jeu');
  H.call('G.choices=rollCards();G.state="pick"'); R('choix'); H.call('G.state="pause"'); R('pause'); H.call('G.state="play"');
  onIslet(H, 8, 'preboss'); H.call('G.phT=99;G.p.inv=1e9'); H.steps(200); R('boss');
  H.call('G.boss=null;G.en=[];islClear();'); H.steps(400, () => H.call('G.state==="trans"&&G.tr.t>TR_SNAP+20')); R('passage');
  H.steps(200, () => H.call('G.state==="play"'));
  H.call('G.p.inv=0;G.p.seg=1;G.p.second=0;G.p.pu={};hurtPlayer(G.p.x+30,G.p.y)'); H.steps(20); R('éclatement'); H.steps(200); R('fin');
  return { ok: done.length === 8 && H.call('G.state') === 'end', detail: done.join(', ') };
});

/* =========================================================
   GARDES : chacune dans son propre processus
   ========================================================= */
const sub = (f, args) => { const r = cp.spawnSync(process.execPath, [path.join(__dirname, f), ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }); const out = (r.stdout || '') + (r.stderr || ''); return { ok: r.status === 0, out }; };
const okLines = out => out.split('\n').filter(l => /^\s+OK/.test(l)).length + ' critères OK';
const koLines = (out, n) => (out.match(/[ÉE]CHEC [^\n]*/g) || []).slice(0, n || 3).map(s => s.trim().slice(0, 220)).join(' | ');
const GARDES = [
  ['cuisson.js', 'cuisson : aucun chunk entier hors budget, travail continu et unité indivisible plafonnés'],
  ['art.js', 'art : séquence brute des opérations de chaque chunk et de chaque sprite identique à la référence', '--cible='],
  ['qualite.js', 'qualité : le contrôleur peut remonter, la référence est celle du jeu, applyRes suit chaque cran'],
  ['regule.js', 'régulateur : un mode manuel est un plafond — descente sous saccade, remontée bornée au cran choisi, Auto inchangé'],
  ['saut.js', 'saut : un rappel en double ne nourrit plus la période estimée, la cuisson délibérée ne bloque plus la remontée de SKP, SKW se révise des deux côtés'],
  ['degradation.js', 'dégradation : les postes décoratifs cèdent sous budget, jamais le monde ni le joueur'],
  ['compteur.js', 'compteur : lisible sur téléphone et il dit qui cuit le monde, worker ou sur place'],
  ['halos.js', 'halos : dessinés directement dans le canevas principal, plus aucun calque composé en plein écran'],
  ['menus.js', 'écrans d’interface : fond figé (menu, pause, choix, fin), plus de flou CSS ni de filtre animé'],
  ['ambiance.js', 'ambiance : surfaces posées par les effets d’environnement bornées sur chaque îlot'],
  ['defaut.js', 'cuisson déléguée : worker pris PAR DÉFAUT, ?wk=0 = témoin sur place, repli propre si worker absent, en panne ou muet'],
  ['decor.js', 'décor : la gueule mord l’ennemi, la voiture le percute, le vide l’avale ; jamais le joueur'],
  ['decor-vue.js', 'décor, ce qui se voit : la gueule s’ouvre et claque, le choc laisse un sillage, l’ennemi qui tombe reste visible'],
  ['terrain.js', 'terrain : le courant porte, la glace prolonge le dash, le balayage alarme hors abri'],
];
console.log('\n=== GARDES ===');
for (const [f, name, refArg] of NO_SUB ? [] : GARDES) {
  const t0 = Date.now(), r = sub(f, REF ? [(refArg || '--ref=') + REF] : []);
  console.log((r.ok ? '[ok] ' : '[KO] ') + f + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  check(name + ' (test/' + f + ')', r.ok, koLines(r.out) || (r.ok ? okLines(r.out) : r.out.slice(-300)));
}

const NAV = 'NON EXERCÉ ICI (vrai Chromium requis) : node test/navigateur.js — test/worker.js, test/sol.js, test/pire-navigateur.js dans un vrai navigateur';

/* ---------- verdict ---------- */
console.log('\n---------------- VERDICT ----------------');
let all = true;
for (const c of checks) { console.log((c.ok ? '  OK  ' : '  KO  ') + c.name + (c.detail ? '  — ' + c.detail : '')); if (!c.ok) all = false; }
console.log('-----------------------------------------');
console.log(NAV);
console.log(all ? 'TOUT PASSE' : 'ECHEC PARTIEL');
process.exit(all ? 0 : 1);
