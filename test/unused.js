'use strict';
/* =========================================================
   Recensement du code mort de BULGE (analyse statique, lecture seule)

   node test/unused.js              l'arbre de travail
   node test/unused.js --ref=HEAD   les fichiers d'un commit git

   Pour chaque identifiant déclaré (function X, const/let/var X, y compris
   dans une liste « const a=…,b=… »), compte ses occurrences en mot entier dans
   TOUT le code exécuté : les modules de la page (ORDER de build.sh, lu par
   L.ordre) + l'entrée du worker de cuisson (gk.js, qui n'est pas dans ORDER)
   + le balisage (shell_head.html, shell_tail.html : onclick, id…). Une seule
   occurrence = la déclaration elle-même = jamais référencé.
   Même chose pour les clés de SFX (appelées SFX.x) et les id du HTML
   (appelés $('x') / getElementById / sélecteur CSS #x).
   Heuristique : un identifiant construit dynamiquement (ex. window['f'+n])
   échapperait au décompte : chaque candidat est revérifié à la main.
   Code de sortie : 0 (c'est un rapport, pas un critère) ; 1 seulement si le
   recensement lui-même est impossible (bloc SFX introuvable).
   ========================================================= */
const fs = require('fs'), path = require('path'), L = require('./lib');
const REF = L.ARG('ref'), ROOT = L.ROOT;
const ORDER = L.ordre(REF).order, FILES = ORDER.concat(ORDER.includes('gk.js') ? [] : ['gk.js']);
const lire = f => { try { return L.readModule(f, REF); } catch (e) { return null; } };
const src = {}; for (const f of FILES) { const s = lire(f); if (s != null) src[f] = s; }
const MODS = FILES.filter(f => f in src);
const html = ['shell_head.html', 'shell_tail.html'].map(lire).filter(s => s != null).join('\n');
const all = MODS.map(f => src[f]).join('\n') + '\n' + html;
const count = (w) => (all.match(new RegExp('(?:^|[^\\w$.])' + w.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || []).length;
console.log('# code mort — ' + (REF ? 'git ' + REF : 'arbre de travail') + ' : ' + MODS.join(' ') + ' + ' + ['shell_head.html', 'shell_tail.html'].join(' '));

/* déclarations de premier niveau (colonne 0) : function X / const|let|var X=…,Y=… */
const decl = [];
for (const f of MODS) {
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
for (const f of MODS) src[f].split('\n').forEach((line, i) => { for (const m of line.matchAll(/(?:^|[^\w$.])function\s+([\w$]+)\s*\(/g)) if (!decl.some(d => d.n === m[1])) decl.push({ f, l: i + 1, n: m[1], k: 'function (imbriquée)' }); });
const dead = decl.filter(d => count(d.n) <= 1);
console.log('=== identifiants déclarés jamais référencés (' + dead.length + ' / ' + decl.length + ') ===');
for (const d of dead) console.log('  ' + d.f + ':' + d.l + '  ' + d.k + ' ' + d.n);

/* méthodes de SFX jamais appelées */
const sfxM = /const SFX=\{([\s\S]*?)\n\};/.exec(src['g1.js'] || '');
if (!sfxM) { console.log('=== SFX : bloc « const SFX={…\\n};» introuvable dans g1.js — recensement impossible'); process.exit(1); }
const sfxL = (src['g1.js'].slice(0, sfxM.index).match(/\n/g) || []).length + 1;
const sfx = [...sfxM[1].matchAll(/^\s*([\w$]+)\(/gm)].map(m => ({ k: m[1], l: sfxL + (sfxM[1].slice(0, m.index).match(/\n/g) || []).length }));
const deadSfx = sfx.filter(s => !new RegExp('SFX\\.' + s.k + '\\b').test(all));
console.log('=== SFX jamais joués (' + deadSfx.length + ' / ' + sfx.length + ') : ' + deadSfx.map(s => s.k + ' (g1.js:' + s.l + ')').join(', '));

/* id du HTML jamais adressés par le JS ni par le CSS */
const ids = [...new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]))];
const js = MODS.map(f => src[f]).join('\n');
const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || ['', ''])[1];
const ligneH = re => { const i = html.search(re); return i < 0 ? '?' : 'shell_head.html:' + ((html.slice(0, i).match(/\n/g) || []).length + 1); };
const deadIds = ids.filter(id => !js.includes("'" + id + "'") && !js.includes('"' + id + '"') && !new RegExp('#' + id + '(?![\\w-])').test(css) && !new RegExp('for="' + id + '"').test(html));
console.log('=== id HTML jamais adressés (' + deadIds.length + ' / ' + ids.length + ') : ' + deadIds.map(id => id + ' (' + ligneH(new RegExp('id="' + id + '"')) + ')').join(', '));

/* classes CSS définies mais jamais utilisées (ni dans le HTML, ni dans le JS) */
const cls = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]))];
const deadCls = cls.filter(c => { const re = new RegExp('(?:^|[^\\w-])' + c + '(?![\\w-])'); return !re.test(html.replace(css, '')) && !re.test(js); });
console.log('=== classes CSS jamais posées (' + deadCls.length + ' / ' + cls.length + ') : ' + deadCls.map(c => c + ' (' + ligneH(new RegExp('\\.' + c + '(?![\\w-])')) + ')').join(', '));

/* fichiers du dépôt jamais référencés par le jeu publié */
const pub = html + js + (lire('index.html') || '');
const files = fs.readdirSync(ROOT).filter(f => /\.(wav|mp3|ogg|png|jpg|svg|json)$/i.test(f));
console.log('=== fichiers média non référencés : ' + (files.filter(f => !pub.includes(f)).map(f => f + ' (' + fs.statSync(path.join(ROOT, f)).size + ' o)').join(', ') || 'aucun'));
