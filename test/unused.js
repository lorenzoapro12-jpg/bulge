'use strict';
/* =========================================================
   Recensement du code mort de BULGE (analyse statique, lecture seule)

   node test/unused.js

   Pour chaque identifiant déclaré (function X, const/let/var X, y compris
   dans une liste « const a=…,b=… »), compte ses occurrences en mot entier dans
   TOUT le code exécuté (12 modules) + le balisage (shell_head.html : onclick,
   id…). Une seule occurrence = la déclaration elle-même = jamais référencé.
   Même chose pour les clés de SFX (appelées SFX.x) et les id du HTML
   (appelés $('x') / getElementById / sélecteur CSS #x).
   Heuristique : un identifiant construit dynamiquement (ex. window['f'+n])
   échapperait au décompte : chaque candidat est revérifié à la main.
   Code de sortie : toujours 0 (c'est un rapport, pas un critère).
   ========================================================= */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ORDER = ['g1.js', 'gw.js', 'gw2.js', 'g2.js', 'gs.js', 'gc.js', 'gi.js', 'gx.js', 'gt.js', 'gv.js', 'g3.js', 'g4.js'];
const src = Object.fromEntries(ORDER.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const html = fs.readFileSync(path.join(ROOT, 'shell_head.html'), 'utf8');
const all = ORDER.map(f => src[f]).join('\n') + '\n' + html;
const count = (w) => (all.match(new RegExp('(?:^|[^\\w$.])' + w.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || []).length;

/* déclarations de premier niveau (colonne 0) : function X / const|let|var X=…,Y=… */
const decl = [];
for (const f of ORDER) {
  src[f].split('\n').forEach((line, i) => {
    let m;
    if ((m = /^(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(line))) decl.push({ f, l: i + 1, n: m[1], k: 'function' });
    else if ((m = /^(const|let|var)\s+(.*)$/.exec(line))) {
      /* découpe la liste au niveau 0 des parenthèses/accolades/crochets */
      let depth = 0, cur = '', parts = [], q = null;
      for (const ch of m[2]) {
        if (q) { cur += ch; if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
        if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
        if (depth === 0 && (ch === ',' || ch === ';')) { parts.push(cur); cur = ''; if (ch === ';') break; continue; }
        cur += ch;
      }
      parts.push(cur);
      for (const p of parts) { const n = /^\s*([\w$]+)\s*=/.exec(p); if (n) decl.push({ f, l: i + 1, n: n[1], k: m[1] }); }
    }
  });
}
/* fonctions déclarées ailleurs qu'en colonne 0 (imbriquées) */
for (const f of ORDER) src[f].split('\n').forEach((line, i) => { for (const m of line.matchAll(/(?:^|[^\w$.])function\s+([\w$]+)\s*\(/g)) if (!decl.some(d => d.n === m[1])) decl.push({ f, l: i + 1, n: m[1], k: 'function (imbriquée)' }); });
const dead = decl.filter(d => count(d.n) <= 1);
console.log('=== identifiants déclarés jamais référencés (' + dead.length + ' / ' + decl.length + ') ===');
for (const d of dead) console.log('  ' + d.f + ':' + d.l + '  ' + d.k + ' ' + d.n);

/* méthodes de SFX jamais appelées */
const sfxBody = /const SFX=\{([\s\S]*?)\n\};/.exec(src['g1.js'])[1];
const sfx = [...sfxBody.matchAll(/^\s*([\w$]+)\(/gm)].map(m => m[1]);
const deadSfx = sfx.filter(k => !new RegExp('SFX\\.' + k + '\\b').test(all));
console.log('=== SFX jamais joués (' + deadSfx.length + ' / ' + sfx.length + ') : ' + deadSfx.join(', '));

/* id du HTML jamais adressés par le JS ni par le CSS */
const ids = [...new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]))];
const js = ORDER.map(f => src[f]).join('\n');
const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || ['', ''])[1];
const deadIds = ids.filter(id => !js.includes("'" + id + "'") && !js.includes('"' + id + '"') && !new RegExp('#' + id + '(?![\\w-])').test(css) && !new RegExp('for="' + id + '"').test(html));
console.log('=== id HTML jamais adressés (' + deadIds.length + ' / ' + ids.length + ') : ' + deadIds.join(', '));

/* classes CSS définies mais jamais utilisées (ni dans le HTML, ni dans le JS) */
const cls = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]))];
const deadCls = cls.filter(c => { const re = new RegExp('(?:^|[^\\w-])' + c + '(?![\\w-])'); return !re.test(html.replace(css, '')) && !re.test(js); });
console.log('=== classes CSS jamais posées (' + deadCls.length + ' / ' + cls.length + ') : ' + deadCls.join(', '));

/* fichiers du dépôt jamais référencés par le jeu publié */
const pub = html + js + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = fs.readdirSync(ROOT).filter(f => /\.(wav|mp3|ogg|png|jpg|svg|json)$/i.test(f));
console.log('=== fichiers média non référencés : ' + (files.filter(f => !pub.includes(f)).map(f => f + ' (' + fs.statSync(path.join(ROOT, f)).size + ' o)').join(', ') || 'aucun'));
