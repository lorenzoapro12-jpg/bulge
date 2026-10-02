'use strict';
/* Mesure REELLE (Chromium, CDP, telephone tactile) du panneau de CHOIX D'UN BONUS sur telephone : tient-il sans defiler ?
   Avant la refonte en ilots, ce script mesurait le panneau de l'autel (gc.js openAltar, pages de 6 a 8 competences) ; l'autel
   n'existe plus, mais son successeur occupe le meme ecran (#ov-evo, memes cartes .card) : le choix d'arrivee sur chaque ilot
   (gp.js openPick -> g4.js renderPick, 3 cartes, bouton Relancer). Le critere est garde : toutes les cartes et le bouton
   Relancer visibles sans defiler, a la taille demandee (par defaut 411x787 : 700 px visibles d'un S22 en headless).
   Le panneau est celui de la VRAIE page (bulge.html, startGame, choix ouvert par la boucle du jeu), rempli par le vrai
   rollCards (8 tirages) puis par le PIRE cas : les trois cartes aux textes les plus longs (fusion, pacte avec son prix).
   node test/choix-ecran.js [--w=411] [--h=787]      (outil de verification, pas appele par headless.js ni par
   navigateur.js : il exige chromium — test/worker.js chromeBin : $BULGE_CHROMIUM, chromium, ou celui de Playwright) */
const path = require('path');
const { launch } = require('./worker.js');
const ARG = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const W = +(ARG('w') || 411), H = +(ARG('h') || 787);
const HTML = 'file://' + path.resolve(process.env.BULGE_ROOT || path.resolve(__dirname, '..'), 'bulge.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* mesure du panneau tel qu'il est affiche : debordement de #ov-evo, bas de chaque carte et du bouton Relancer */
const MES = `(()=>{renderPick();const ov=document.getElementById('ov-evo'),rb=document.getElementById('bReroll'),cs=[...document.querySelectorAll('#evoCards .card')];
  return {ids:G.choices.map(c=>c.u.id),sh:ov.scrollHeight,ch:ov.clientHeight,vis:getComputedStyle(ov).display!=='none'&&ov.classList.contains('on'),
    bas:cs.map(c=>Math.round(c.getBoundingClientRect().bottom)),rb:rb.hidden?null:Math.round(rb.getBoundingClientRect().bottom),ih:innerHeight};})()`;
(async () => {
  const B = await launch(); let ok = true;
  try {
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2.625, mobile: true });
    await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await B.nav(HTML);
    for (let i = 0; i < 80; i++) { await sleep(250); try { if (await B.ev("typeof startGame==='function'&&document.readyState==='complete'")) break; } catch (e) { } }
    await B.ev('(()=>{meta.mute=true;startGame();return 1;})()');
    let st = null; for (let i = 0; i < 60 && st !== 'pick'; i++) { await sleep(250); st = await B.ev('G&&G.state'); }
    if (st !== 'pick') throw new Error('le choix ne s\'est pas ouvert (etat ' + st + ')');
    const cas = [];
    for (let k = 0; k < 8; k++) cas.push(['tirage ' + (k + 1), await B.ev((k ? 'G.choices=rollCards();' : '') + MES)]);
    /* pire cas : les trois cartes aux textes les plus longs, toutes categories (une fusion affiche « Fusion : A + B ») */
    cas.push(['pire cas', await B.ev(`(()=>{const L=ch=>{const u=ch.u;return (ch.k==='f'?'Fusion : '+CARDS[u.a].u.n+' + '+CARDS[u.b].u.n:ch.k==='p'?'Pacte':u.c||'').length+u.n.length+u.d.length+(ch.k==='p'?u.cost.length+8:0);};
      const all=BON.map(u=>({k:'b',u})).concat(FUS.map(u=>({k:'f',u})),PAC.map(u=>({k:'p',u})));all.sort((a,b)=>L(b)-L(a));G.choices=all.slice(0,3);return 1;})()`) && await B.ev(MES)]);
    for (const [nom, m] of cas) {
      const bas = Math.max(...m.bas, m.rb || 0), tient = m.vis && m.sh <= m.ch && bas <= m.ih;
      if (!tient) ok = false;
      console.log((tient ? 'TIENT   ' : 'DEBORDE ') + nom.padEnd(10) + ' : ' + m.ids.join(', ') + ' — hauteur ' + m.sh + ' px pour ' + m.ch + ' visibles, bas des cartes ' + m.bas.join('/') + (m.rb ? ', Relancer ' + m.rb : '') + ' (ecran ' + m.ih + ')');
    }
  } catch (e) { ok = false; console.log('ECHEC execution : ' + e.message); } finally { B.close(); }
  console.log(ok ? 'OK : le choix tient sans defiler a ' + W + 'x' + H : 'ECHEC : au moins un choix deborde a ' + W + 'x' + H);
  process.exit(ok ? 0 : 1);
})();
