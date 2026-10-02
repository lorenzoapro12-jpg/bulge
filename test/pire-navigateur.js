'use strict';
/* =========================================================
   LA LIGNE « PIRE IMAGE » DANS UN VRAI NAVIGATEUR (chantier A3, 30/09/2026)

   node test/pire-navigateur.js       code de sortie 0 tout passe · 1 un echec
   BRANCHEMENT : par test/navigateur.js (liste TESTS), jamais par headless.js (raison en tete de navigateur.js).

   Le banc `vm` n'a ni rAF reel ni canvas : le chemin qui ECRIT « pire N ms : JS N ms · gen N · spr N · reçus N ·
   collés N » (g3.js, segW) n'y a jamais ete exerce avec un vrai measureText. Ici, aucun stub : on intercepte les
   fillText reellement emis sur MAINCTX par le bloc de diagnostic (police #8f89b3, x = pad = 14), image par image
   (FRAME), et on relit ce qui est ecrit.
   Pour chaque format d'ecran :
     A. diagnostic ETEINT (meta.fps=false), partie en cours : AUCUNE ligne du compteur n'est ecrite — alors que
        le HUD, lui, ecrit bien du texte (temoin : sans lui, « 0 ligne » ne prouverait rien) ;
     B. diagnostic ALLUME : dans la derniere image complete, les lignes du bloc, jointes, contiennent la pire image
        avec ses SIX champs, et ces champs sont EXACTEMENT DIAG_WORST tel qu'il etait au moment du fillText ;
        chaque ligne tient dans W - pad (vraies metriques de la police) ;
     C. DISCRIMINATION : DIAG_WORST remplace par une sentinelle [123,-1,7,8,9,10] => l'ecran doit dire
        « pire 123 ms : JS ? · gen 7 · spr 8 · reçus 9 · collés 10 » (branche « JS ? » comprise) ; par null =>
        « pire N ms » seul, SANS les champs (le lecteur ne voit donc pas des champs qui n'y sont pas).
   ========================================================= */
const path = require('path');
const { launch, START } = require('./worker.js');
const HTML = 'file://' + path.resolve(process.env.BULGE_ROOT || path.resolve(__dirname, '..'), 'bulge.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true;
const check = (label, cond, info) => { if (!cond) ok = false; console.log((cond ? '  OK    ' : '  ECHEC ') + label + (info ? '  — ' + info : '')); };
const CAS = [['S22 standard 360x780 DPR 2.625 tactile', 360, 780, 2.625, true], ['petit ecran 320x640 DPR 2 tactile', 320, 640, 2, true], ['bureau 1280x800 DPR 1', 1280, 800, 1, false]];
/* le crochet : chaque fillText du bloc (couleur du compteur, x = 14) note l'image, le texte, sa largeur REELLE,
   et l'objet DIAG_WORST vu a cet instant (copie, et identite avec la sentinelle) */
const HOOK = `(()=>{window.__L=[];window.__N=0;const mc=MAINCTX,of=mc.fillText;
  mc.fillText=function(t,x,y){window.__N++;if(x===14&&String(mc.fillStyle).toLowerCase()==='#8f89b3')window.__L.push({f:FRAME,t:String(t),w:mc.measureText(String(t)).width,W:W,
    dw:DIAG_WORST?DIAG_WORST.slice():null,sent:DIAG_WORST!==null&&DIAG_WORST===window.__S});return of.apply(this,arguments);};return true;})()`;
/* derniere image COMPLETE (pas celle en cours d'ecriture) parmi celles qui ont ecrit le bloc */
const LAST = `(()=>{const L=window.__L,fs=[...new Set(L.map(l=>l.f))];const f=fs.length>1?fs[fs.length-2]:-1;return {f,lignes:L.filter(l=>l.f===f),n:window.__N,etat:G&&G.state,W,H};})()`;
const RX = /pire (\d+) ms :\s*(?:·\s*)?JS (\?|\d+\.\d ms) · gen (\d+) · spr (\d+) · reçus (\d+) · collés (\d+)/;
const lit = lignes => { const s = lignes.map(l => l.t).join(' · '), m = s.match(RX); return { s, m }; };
const attendu = w => ['pire ' + w[0].toFixed(0) + ' ms', 'JS ' + (w[1] < 0 ? '?' : w[1].toFixed(1) + ' ms'), 'gen ' + w[2], 'spr ' + w[3], 'reçus ' + w[4], 'collés ' + w[5]];
const vu = m => ['pire ' + m[1] + ' ms', 'JS ' + m[2], 'gen ' + m[3], 'spr ' + m[4], 'reçus ' + m[5], 'collés ' + m[6]];
(async () => {
  for (const [nom, w, h, dpr, tact] of CAS) {
    console.log('\n=== ' + nom + ' ===');
    const B = await launch();
    try {
      await B.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: tact });
      if (tact) await B.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await B.nav(HTML);
      for (let i = 0; i < 80; i++) { await sleep(250); try { if (await B.ev("typeof startGame==='function'&&typeof MAINCTX!=='undefined'&&document.readyState==='complete'")) break; } catch (e) { } }
      /* meme amorce que navigateur.js (START, test/worker.js) : startGame, choix d'arrivee pris (sinon l'ecran est fige
         en etat « pick » et le compteur n'ecrit rien), bulle invulnerable (la partie ne finit pas pendant la mesure) */
      for (let i = 0; i < 60; i++) { if (await B.ev(START('meta.fps=false;'))) break; await sleep(250); }
      await sleep(1500); await B.ev(HOOK);
      /* A. eteint */
      await sleep(2500);
      let r = await B.ev(`(()=>{const L=window.__L;return {n:window.__N,d:L.length,ex:L.slice(0,3).map(l=>l.t),etat:G&&G.state,fps:meta.fps};})()`);
      check('A. diagnostic eteint : aucune ligne du compteur', r.etat === 'play' && r.n > 0 && r.d === 0, 'etat ' + r.etat + ', ' + r.n + ' fillText du HUD (temoin), ' + r.d + ' ligne(s) du compteur' + (r.d ? ' : ' + JSON.stringify(r.ex) : ''));
      /* B. allume : on attend une publication (au moins 1 s de jeu) */
      await B.ev('(()=>{meta.fps=true;window.__L=[];return 1;})()');
      await sleep(2800);
      r = await B.ev(LAST);
      const { s, m } = lit(r.lignes), dw = r.lignes.length ? r.lignes[r.lignes.length - 1].dw : null;
      console.log('        image ' + r.f + ', ' + r.lignes.length + ' ligne(s), W=' + r.W + ' :');
      for (const l of r.lignes) console.log('          ' + (14 + l.w).toFixed(1).padStart(7) + ' px | ' + l.t);
      check('B. ligne « pire » ecrite avec ses six champs', !!m, m ? vu(m).join(' · ') : 'introuvable dans « ' + s + ' »');
      check('B. les six champs sont DIAG_WORST de cette image', !!(m && dw && attendu(dw).join('|') === vu(m).join('|')), 'DIAG_WORST=' + JSON.stringify(dw && dw.map(x => +x.toFixed(2))));
      const trop = r.lignes.filter(l => 14 + l.w > r.W - 14 + .5);
      check('B. chaque ligne tient dans W - pad (' + (r.W - 14) + ' px)', r.lignes.length > 0 && !trop.length, trop.length ? 'deborde : ' + trop.map(l => (14 + l.w).toFixed(1) + ' px').join(', ') : 'plus large ' + Math.max(...r.lignes.map(l => 14 + l.w)).toFixed(1) + ' px');
      /* C. sentinelles */
      let got = null;
      for (let k = 0; k < 5 && !got; k++) {
        await B.ev('(()=>{window.__S=[123,-1,7,8,9,10];DIAG_WORST=window.__S;window.__L=[];return 1;})()'); await sleep(120);
        r = await B.ev(LAST); if (r.lignes.length && r.lignes.every(l => l.sent)) got = r; }
      const c1 = got && lit(got.lignes);
      check('C. sentinelle [123,-1,7,8,9,10] relue a l\'ecran', !!(c1 && c1.m && vu(c1.m).join(' · ') === 'pire 123 ms · JS ? · gen 7 · spr 8 · reçus 9 · collés 10'), c1 ? (c1.m ? vu(c1.m).join(' · ') : '« ' + c1.s + ' »') : 'sentinelle ecrasee 5 fois de suite');
      got = null;
      for (let k = 0; k < 5 && !got; k++) {
        await B.ev('(()=>{DIAG_WORST=null;window.__L=[];return 1;})()'); await sleep(120);
        r = await B.ev(LAST); if (r.lignes.length && r.lignes.every(l => l.dw === null)) got = r; }
      const c2 = got && lit(got.lignes);
      check('C. DIAG_WORST=null : « pire N ms » seul, aucun champ lu', !!(c2 && !c2.m && /pire \d+ ms/.test(c2.s) && !/gen \d/.test(c2.s)), c2 ? '« ' + c2.s + ' »' : 'null ecrase 5 fois de suite');
    } catch (e) { check('execution', false, e.message); } finally { B.close(); }
  }
  console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHEC'));
  process.exit(ok ? 0 : 1);
})();
