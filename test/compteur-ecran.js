'use strict';
/* =========================================================
   LE COMPTEUR DE DIAGNOSTIC DANS UN VRAI NAVIGATEUR — chevauche-t-il un bouton ?
   test/compteur.js tranche dans un DOM stube (largeur du texte = modele). Ici : vrai Chromium par
   CDP, ecran de telephone (411×900 tactile par defaut), vraie partie, vraies metriques de police.
   On intercepte les fillText REELLEMENT emis par drawHUD() pour le bloc (x = 14, ligne de base
   « bottom »), on les mesure avec measureText, et on les confronte au disque de toucher (rayon + 10)
   des VRAIES dashBtn() et gcSlots(). Une capture est ecrite dans /root/shots/.

   node test/compteur-ecran.js [--ref=HEAD] [--fixe] [--l=411 --h=900]
   Code de sortie : 0 si aucun chevauchement, 1 sinon.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { launch } = require('./worker.js');

const ROOT = path.resolve(__dirname, '..');
const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] || true) : null; };
const REF = ARG('ref'), FIXE = !!ARG('fixe'), LW = +(ARG('l') || (FIXE ? 1280 : 411)), LH = +(ARG('h') || (FIXE ? 720 : 900));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const py = fs.readFileSync('/root/work/bulge-verif/perf.py', 'utf8');
const DRIVER = py.slice(py.indexOf('DRIVER = r"""') + 13, py.indexOf('"""', py.indexOf('DRIVER = r"""') + 13));
const EXTRA = `
<script>
/* ===== releve du compteur : ne fait pas partie du jeu ===== */
window.__ce={l:[],b:[],n:0};
(function(){const R=window.__ce;let dans=false,cur=null;
  const ft=MAINCTX.fillText.bind(MAINCTX);
  MAINCTX.fillText=function(s,x,y){if(dans&&x===14&&MAINCTX.textBaseline==='bottom'&&!/^Dash /.test(String(s))){const m=MAINCTX.measureText(String(s)),px=parseFloat((/(\\d+(\\.\\d+)?)px/.exec(MAINCTX.font)||[0,12])[1]);
      cur.push({s:String(s),x:x,y:y,w:m.width,px:px,W:W,H:H});}return ft.apply(null,arguments);};
  const od=drawHUD;drawHUD=function(){meta.fps=true;inp.touch=${FIXE ? 'false' : 'true'};dans=true;cur=[];try{return od.apply(this,arguments);}finally{dans=false;
    if(cur.length){R.l=cur;R.n++;const d=dashBtn(),S=gcSlots();R.b=S.map((b,i)=>({x:b.x,y:b.y,r:b.r+10,n:i===2?'ULTIME':'AUTEL/competence '+(i+1)}));if(inp.touch)R.b.push({x:d.x,y:d.y,r:d.r+10,n:'dash'});}}};
})();
</script>`;

(async () => {
  const html = REF ? cp.execFileSync('git', ['show', REF + ':bulge.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }) : fs.readFileSync(path.join(ROOT, 'bulge.html'), 'utf8');
  fs.mkdirSync('/root/shots', { recursive: true });
  const tag = (REF ? 'ref' : 'arbre') + (FIXE ? '-fixe' : '-tactile'), file = '/root/shots/ce-' + tag + '.html', i = html.lastIndexOf('</body>');
  fs.writeFileSync(file, html.slice(0, i) + DRIVER + EXTRA + html.slice(i));
  const B = await launch();
  let ok = false;
  try {
    await B.cdp('Emulation.setDeviceMetricsOverride', { width: LW, height: LH, deviceScaleFactor: FIXE ? 1 : 2.625, mobile: !FIXE });
    await B.nav('file://' + file + '?wk=1#plains');
    await sleep(9000);
    const P = await B.ev('({l:__ce.l,b:__ce.b,n:__ce.n,W:W,H:H,st:G&&G.state,touch:inp.touch,font:MAINCTX.font})');
    const shot = await B.cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/root/shots/ce-' + tag + '.png', Buffer.from(shot.data, 'base64'));
    const coupe = (r, b) => { const dx = Math.max(r.x0 - b.x, 0, b.x - r.x1), dy = Math.max(r.y0 - b.y, 0, b.y - r.y1); return dx * dx + dy * dy < b.r * b.r; };
    console.log(`COMPTEUR A L'ECRAN — ${REF ? 'ref ' + REF : 'arbre de travail'}, ${FIXE ? 'poste fixe' : 'tactile'}, dessin ${P.W}×${P.H}, etat ${P.st}, ${P.n} images relevees`);
    const pb = [];
    for (const l of P.l) {
      const hit = P.b.filter(b => coupe({ x0: l.x, x1: l.x + l.w, y0: l.y - l.px, y1: l.y }, b));
      console.log(`  y=H-${Math.round(P.H - l.y)}  ${l.px}px  droite ${(l.x + l.w).toFixed(0)}/${P.W - 14}  « ${l.s} »${hit.length ? '   <-- SUR ' + hit.map(b => b.n).join(', ') : ''}${l.x + l.w > P.W - 14 + .5 ? '   <-- DEPASSE' : ''}`);
      for (const b of hit) pb.push(b.n);
    }
    console.log('  boutons (disque de toucher) : ' + P.b.map(b => `${b.n} centre (W-${Math.round(P.W - b.x)},H-${Math.round(P.H - b.y)}) r${b.r}`).join(' · '));
    ok = P.l.length >= 3 && pb.length === 0 && P.l.every(l => l.x + l.w <= P.W - 14 + .5);
    console.log(`  capture : /root/shots/ce-${tag}.png`);
    console.log(ok ? `AUCUN CHEVAUCHEMENT (${P.l.length} lignes)` : (P.l.length < 3 ? 'ECHEC : bloc non releve' : `ECHEC : ${pb.length} chevauchement(s) — ${[...new Set(pb)].join(', ')}`));
  } finally { B.close(); }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
