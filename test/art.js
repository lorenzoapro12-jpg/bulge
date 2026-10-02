'use strict';
/* =========================================================
   Art du monde : GARDE DE PÉRIMÈTRE. La carte d'un îlot, la cuisson d'un chunk et le sprite d'un obstacle
   produisent-ils EXACTEMENT la même séquence d'opérations canvas qu'à la référence — hors des îlots
   qu'on a explicitement le droit de retoucher ?

   node test/art.js                  arbre de travail contre la référence 2f4ce87 (îlots, relique en miniature)
   node test/art.js --ref=<commit>   autre référence (de l'ère des îlots : genIslet)
   node test/art.js --cible=<commit> compare ce commit au lieu de l'arbre de travail
   node test/art.js --perim=a,b      autre périmètre ; --perim= (vide) : tout doit être identique
   BULGE_ROOT=<copie> node test/art.js   juge une copie du dépôt (test/lib.js), pour la prouver sensible

   PÉRIMÈTRE (GRAPHISMES.md) : les biomes dont l'art a été VOULU différent de la référence. Un îlot = un biome
   (gw.js ISL) : un chunk, une carte, un sprite sont « dans le périmètre » si le biome de LEUR îlot en fait partie.
   Plus de marge : le décor d'un biome ne déborde plus chez un voisin, il n'y a plus de voisin. Attention, le
   liseré de la relique de l'îlot k+1 porte la couleur de l'îlot k (relicInto, BIO[relicB].a) : retoucher la
   couleur d'un biome touche aussi l'îlot suivant, à mettre alors dans le périmètre. TOUT LE RESTE doit être
   identique octet pour octet. Quand le travail est commité, avancer --ref sur ce commit et vider le périmètre.

   Séquence BRUTE, sans normalisation : chaque appel (méthode + arguments en pleine précision), chaque
   affectation de style, save/restore/clip compris ; un canevas passé en argument est noté par sa taille, une
   ImageData (putImageData de la carte) par l'empreinte de TOUS ses octets. Deux versions chargées côte à côte
   dans deux contextes vm (test/lib.js, modules et ordre de build.sh lus À CHAQUE commit : L.ordre) ; chaque
   chunk cuit un bakeStep à la fois, dans le même ordre des deux côtés.
   Couverture : 2 parties (graines) × les 8 îlots (genIslet(graine,k), k = 1..8), plus 7 îlots d'autres parties choisis
   pour leur pièce de décor (PIECES), ×
     - la carte de l'îlot (buildMaps : sol, relique posée dans la carte, miniature qui sera la relique suivante) ;
     - TOUS les chunks de la grille de l'îlot (NC×NC = 81 : centre et relique, falaises de bord, vide au-delà) ;
     - le sprite (obsSprite) de chaque obstacle propre à ces chunks (falaises exclues : elles sont dans la cuisson).
   La relique est la MINIATURE calculée (WD.mini de l'îlot k-1) : la copie d'écran du passage (RELSNAP, g3.js
   trSnap) n'existe pas sous vm ; sa voie (worker = sur place, au pixel) est jugée par test/worker.js.

   HISTORIQUE DE LA RÉFÉRENCE
   - 93b8cfe (avant PERF-2) : la première référence, monde continu genWorld.
   - e3a2c93 (29/09/2026, chantier A, colonne vertébrale) : changeait VOLONTAIREMENT l'art de 66 chunks sur 378
     contre 0837805 (30 par les cœurs ancrés sur le chemin principal, qui déplacent obstacles et monuments ; 36 par
     le fil de braise de drawPaths) ; 0837805 passait contre 93b8cfe hors urban+sky. Périmètre vidé.
   - 2f4ce87 (02/10/2026, refonte en îlots) : le monde continu (genWorld, sentiers, monuments, lisières, cœurs)
     n'existe plus ; un îlot rond par niveau, un biome par îlot, la relique (l'îlot quitté en miniature) au
     centre. TOUT l'art du monde a changé par construction : il n'y a plus rien de commun à comparer avec
     e3a2c93 (pas de genIslet). 2f4ce87 est le premier commit qui porte l'art final des îlots, miniature de la
     relique comprise : il devient l'état figé, périmètre vide.
   Critères abandonnés avec le monde continu : la marge de 160 px (débordement d'un biome chez son voisin),
   les monuments (WD.lms est vide, o.b==='lm' n'existe plus), les « 7×7 chunks du centre + une grille d'un sur
   trois » d'un monde de ±13 chunks (un îlot tient en 9×9 : on les prend tous).
   ========================================================= */
const crypto = require('crypto');
const L = require('./lib');
const ARG = L.ARG;
const REF = ARG('ref') || '2f4ce87';
/* Biomes (= îlots) dont l'art a été VOULU différent de la référence dans cette passe (GRAPHISMES.md).
   Doit lister EXACTEMENT ce qui a été retouché : trop large, la garde ne protège plus rien ; trop étroit, elle
   signale un faux débordement. Vide depuis 2f4ce87 : tout est figé. */
const PERIM_DEF = [];
const PERIM = ARG('perim') === null ? PERIM_DEF : (ARG('perim') === true ? [] : String(ARG('perim')).split(',').filter(Boolean));
const CIBLE = ARG('cible');  /* --cible=<commit> : compare ce commit plutôt que l'arbre de travail (headless.js --ref) */
/* deux parties entières (les 8 îlots), puis des îlots choisis parce qu'une PIÈCE DE DÉCOR (setPieces, SETP) y est posée :
   elles sont rares (anneau étroit entre la relique et le bord, sans falaise : 26 sur 80 parties × 8 îlots, recensement
   du 02/10/2026), aucune dans les deux parties entières. Le Cœur n'en a eu AUCUNE en 80 parties (massifs trop denses). */
const GRAINES = [20260927, 7];
const PIECES = [[87109, 1], [340517, 2], [79190, 3], [395950, 4], [55433, 5], [395950, 6], [87109, 7]];
const ILOTS = GRAINES.flatMap(s => [1, 2, 3, 4, 5, 6, 7, 8].map(k => [s, k])).concat(PIECES);

const fnv = d => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
function build(ref) {
  let LOG = null, GID = 0;
  const ser = v => { const t = typeof v; if (t === 'number' || t === 'boolean' || v == null) return String(v); if (t === 'string') return JSON.stringify(v); if (v.__g) return v.__g;
    if (v.tagName === 'CANVAS') return 'cv' + v.width + 'x' + v.height;
    if (v.data && v.data.length !== undefined && typeof v.width === 'number') return 'img' + v.width + 'x' + v.height + '#' + fnv(v.data);
    return 'OBJ'; };
  const rec = (n, a) => { if (LOG) LOG.push(n + '(' + a.map(ser).join(',') + ')'); };
  const mkGrad = () => ({ __g: 'g' + (++GID), addColorStop(...a) { rec(this.__g + '.addColorStop', a); } });
  /* un contexte par canevas (test/lib.js appelle mkCtx à chaque getContext) */
  const ctxs = new WeakMap();
  function mkCtx(el) {
    if (el && ctxs.has(el)) return ctxs.get(el);
    const base = { canvas: el, createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }), getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
      createRadialGradient: (...a) => { rec('createRadialGradient', a); return mkGrad(); }, createLinearGradient: (...a) => { rec('createLinearGradient', a); return mkGrad(); },
      createPattern: () => { rec('createPattern', []); return { __g: 'p' + (++GID) }; }, measureText: s => ({ width: (s || '').length * 7 }) };
    const c = new Proxy(base, { get: (t, p) => (p in t ? t[p] : (...a) => rec(String(p), a)), set: (t, p, v) => { if (LOG) LOG.push(String(p) + '=' + ser(v)); t[p] = v; return true; } });
    if (el) ctxs.set(el, c);
    return c;
  }
  const H = L.mkGame({ ref, mkCtx, w: 390, h: 780 });
  const call = H.call;
  const logged = f => { const log = []; GID = 0; LOG = log; try { f(); } finally { LOG = null; } return log; };
  return {
    order: H.order,
    /* l'îlot k de la partie `seed` ; renvoie la séquence de genIslet (carte, relique dans la carte, miniature) */
    islet: (seed, k) => logged(() => call(`genIslet(${seed},${k})`)),
    grille: () => JSON.parse(call('JSON.stringify([NC,COFF,WD.sites[0].t,!!WD.relic])')),
    chunk(cx, cy) {
      if (!call(`(function(){var c=getChunk(${cx},${cy});return !!(c&&!c.bake&&!c.bk);})()`)) return null;
      const log = []; GID = 0; let n = 0;
      for (;;) { LOG = log; let fini; try { fini = call(`bakeStep(getChunk(${cx},${cy}))`); } finally { LOG = null; } n++; if (fini) break; if (n > 20000) throw new Error('cuisson sans fin ' + cx + ',' + cy); }
      const info = call(`(function(){var c=getChunk(${cx},${cy}),w=0,i0=Math.round((c.x0-G0)/WC),j0=Math.round((c.y0-G0)/WC);for(var j=j0;j<j0+8;j++)for(var i=i0;i<i0+8;i++)w+=wallAt(i,j);
        return JSON.stringify({w:w,sp:!!c.sp,rel:!!(WD.relic&&!(c.x0>RELR+20||c.x0+CH<-RELR-20||c.y0>RELR+20||c.y0+CH<-RELR-20))});})()`);
      return { log, n, info: JSON.parse(info) };
    },
    /* sprite de chaque obstacle propre au chunk (falaises exclues : elles sont dans la cuisson) */
    sprites(cx, cy) {
      const nb = call(`(function(){var c=getChunk(${cx},${cy});return c?c.obs.length:0;})()`), out = [];
      for (let i = 0; i < nb; i++) {
        const b = call(`(function(){var o=getChunk(${cx},${cy}).obs[${i}];return o.wall||o.home!==getChunk(${cx},${cy})?'':o.b;})()`);
        if (!b) continue;
        out.push({ b, log: logged(() => call(`obsSprite(getChunk(${cx},${cy}).obs[${i}])`)) });
      }
      return out;
    },
  };
}
const HS = l => crypto.createHash('sha256').update(l.join('\n')).digest('hex');
const t0 = Date.now();
const A = build(REF), B = build(CIBLE || null);
let n = 0, ko = 0, ops = 0, appA = 0, appB = 0, montres = 0;
const hors = { n: 0, ko: 0 }, dans = { n: 0, diff: 0 }, parB = {}, sHors = { n: 0, ko: 0 }, sDans = { n: 0, diff: 0 }, sParB = {}, cHors = { n: 0, ko: 0 }, cDans = { n: 0, diff: 0 };
const cov = {};  /* par biome d'îlot : chunks, à falaises, avec pièce de décor, sous la relique, sprites */
const note = (T, b, diff) => { const o = T[b] || (T[b] = { n: 0, diff: 0 }); o.n++; if (diff) o.diff++; };
const montre = (quoi, la, lb) => { if (montres++ >= 4) return; let i = 0; while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
  console.log(`  HORS PÉRIMÈTRE, DIFFÉRENT : ${quoi} : opération n°${i} sur ${la.length}/${lb.length}\n     réf.  ${String(la[i]).slice(0, 110)}\n     arbre ${String(lb[i]).slice(0, 110)}`); };
for (const [seed, k] of ILOTS) {
  {
    const ma = A.islet(seed, k), mb = B.islet(seed, k), [NC, COFF, bio, rel] = B.grille(), inP = PERIM.includes(bio), cv = cov[k + ' ' + bio] || (cov[k + ' ' + bio] = { ch: 0, murs: 0, sp: 0, rel: 0, spr: 0 });
    /* la carte de l'îlot (sol, relique, miniature) */
    const same = HS(ma) === HS(mb);
    if (inP) { cDans.n++; if (!same) cDans.diff++; } else { cHors.n++; if (!same) { cHors.ko++; montre(`partie ${seed} îlot ${k} (${bio}) : carte (genIslet)`, ma, mb); } }
    for (let cx = -COFF; cx < NC - COFF; cx++) for (let cy = -COFF; cy < NC - COFF; cy++) {
      const a = A.chunk(cx, cy), b = B.chunk(cx, cy);
      if (!a && !b) continue;
      n++;
      const same = !!(a && b && HS(a.log) === HS(b.log));
      if (!same) ko++;
      if (inP) { dans.n++; if (!same) dans.diff++; note(parB, bio, !same); }
      else { hors.n++; if (!same) { hors.ko++; montre(`partie ${seed} îlot ${k} (${bio}) chunk ${cx},${cy}`, a ? a.log : [], b ? b.log : []); } }
      if (!a || !b) continue;
      ops += b.log.length; appA += a.n; appB += b.n; cv.ch++; if (b.info.w) cv.murs++; if (b.info.sp) cv.sp++; if (b.info.rel) cv.rel++;
      /* sprites d'obstacles : la génération des obstacles n'a pas le droit de changer (même liste) */
      const sa = A.sprites(cx, cy), sb = B.sprites(cx, cy);
      if (sa.length !== sb.length || sa.some((s, i) => s.b !== sb[i].b)) { sHors.n++; sHors.ko++; montre(`partie ${seed} îlot ${k} chunk ${cx},${cy} : liste d'obstacles changée (${sa.length} -> ${sb.length})`, [], []); continue; }
      for (let i = 0; i < sb.length; i++) {
        const d = HS(sa[i].log) !== HS(sb[i].log); cv.spr++;
        if (PERIM.includes(sb[i].b)) { sDans.n++; if (d) sDans.diff++; note(sParB, sb[i].b, d); }
        else { sHors.n++; if (d) { sHors.ko++; montre(`partie ${seed} îlot ${k} chunk ${cx},${cy} sprite n°${i} (${sb[i].b})`, sa[i].log, sb[i].log); } }
      }
    }
  }
}
const fmt = T => Object.keys(T).sort().map(b => `${b} ${T[b].diff}/${T[b].n}`).join(', ') || '—';
console.log(`# art : ${CIBLE ? 'git ' + CIBLE : 'arbre de travail'} contre ${REF} — ${GRAINES.length} parties × 8 îlots + ${PIECES.length} îlots à pièce de décor, ${n} chunks, séquence brute (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`  modules : réf. ${A.order.join(' ')} ; ${CIBLE || 'arbre'} ${B.order.join(' ')}`);
console.log(`  périmètre autorisé à changer : ${PERIM.length ? PERIM.join(', ') : 'aucun'}`);
console.log(`  HORS périmètre identiques : cartes d'îlot ${cHors.n - cHors.ko}/${cHors.n} ; chunks ${hors.n - hors.ko}/${hors.n} ; sprites d'obstacles ${sHors.n - sHors.ko}/${sHors.n}`);
console.log(`  dans le périmètre, changés (voulu) : cartes ${cDans.diff}/${cDans.n} ; chunks ${dans.diff}/${dans.n} [${fmt(parB)}] ; sprites ${sDans.diff}/${sDans.n} [${fmt(sParB)}]`);
for (const b of PERIM) if (!(parB[b] && parB[b].diff) && !(sParB[b] && sParB[b].diff)) console.log(`  note : « ${b} » est dans le périmètre mais rien n'y a changé — périmètre plus large que nécessaire ?`);
console.log(`  toutes catégories : chunks identiques ${n - ko}/${n} (${ops} opérations) ; appels à bakeStep : réf. ${appA} -> arbre ${appB}`);
console.log('  couverture par îlot (chunks · à falaises · pièce de décor · sous la relique · sprites) : ' + Object.keys(cov).map(k => `${k} ${cov[k].ch}·${cov[k].murs}·${cov[k].sp}·${cov[k].rel}·${cov[k].spr}`).join(' ; '));
const vide = Object.keys(cov).filter(k => !cov[k].ch || (!k.startsWith('1 ') && !cov[k].rel) || (!k.endsWith(' core') && !cov[k].sp));
if (vide.length) console.log('  COUVERTURE INSUFFISANTE : ' + vide.join(', ') + ' (aucun chunk, aucun chunk sous la relique, ou aucune pièce de décor hors Cœur)');
const ok = n > 0 && !vide.length && hors.ko === 0 && sHors.ko === 0 && cHors.ko === 0;
console.log(ok ? (ko || sDans.diff || cDans.diff ? 'ART : HORS PÉRIMÈTRE IDENTIQUE' : 'ART : IDENTIQUE') : 'ART : DÉBORDEMENT HORS PÉRIMÈTRE');
process.exit(ok ? 0 : 1);
