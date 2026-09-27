# PERF-2 — fluidité : cuisson du monde bornée et adaptative

Mandat du 27/09/2026. Rien n'est commité : l'autorité git reste à l'opérateur.

## 1. Ce que j'ai compris (lu dans le code, pas re-diagnostiqué)

* `render()` (g3.js:83) appelle `streamWorld(3 ou 5)`. Dans `streamWorld` (gw2.js:318), la liste
  `need` est triée ; un chunk **visible** (dans `VL..VR × VT..VB`, marge de 60 px écran comprise)
  et non cuit est marqué `urgent` et cuit par `bakeChunk(c)` = `while(!bakeStep(c));` : **aucun
  plafond**, et plusieurs chunks urgents peuvent passer dans la même image.
* `prewarm(0,0,1100)` (gw2.js:314, appelé par `newRun`, g2.js:64) cuit 36 chunks d'affilée,
  en synchrone.
* Il existe déjà un sol de secours : si un chunk visible manque (`chunksCover()` faux), `render`
  peint `drawGround()` = la carte basse résolution `WD.map` agrandie. Or la 1re couche de chaque
  chunk cuit est **la même carte** (`mapInto`, gw2.js:184). Un chunk partiellement cuit est donc
  « sol de secours + les couches déjà posées, dans l'ordre d'origine » : jamais moins que ce que le
  jeu sait déjà montrer, toujours plus proche du résultat final.
* L'unité indivisible la plus grosse n'est pas un chunk mais **un groupe de murs** (`wallsStep` →
  `drawWalls(g,c,biome)`) : 9 807 opérations mesurées par `bake-eq.js` (chunk -3,-1). Toutes les
  autres unités font < 300 opérations. Un refactor des murs a déjà été **rejeté**
  (`bulge-verif/gw2-refactor-murs-REJETE.js` : il réécrivait les phases et ré-ouvrait le `clip` à
  chaque lot, donc la séquence brute changeait).

## 2. Mesures AVANT (instruments fournis, arbre = HEAD 93b8cfe)

`blocages.js` (contexte principal V8, canvas simulé, cette machine) :

| partie | pire image | render pire | bakeChunk (appels / pire) | drawWalls pire | bakeStep pire |
|---|---|---|---|---|---|
| bal   | 24,7 ms | 17,29 ms | 36 / 11,06 ms | 5,27 ms | 12,35 ms |
| scout | 10,4 ms | 10,19 ms | 36 / 5,10 ms  | 7,05 ms | 7,06 ms  |

(les 36 `bakeChunk` sont exactement le `prewarm` ; aucune cuisson urgente sur cette machine rapide)

`frames.js` (opérations canvas, indépendant de l'appareil) : bal, **plus longue plage sans
vérification du budget = 144 787 opérations** (le prewarm) ; cuisson hors écran max 19 649 op/image.

`bake-eq.js` (HEAD contre lui-même) : 49/49 identiques, plus gros appel indivisible 9 807 op (murs).

## 3. Ce que je vais changer

1. **Budget adaptatif** (gw2.js + g4.js + g3.js:83). `frame()` mesure son propre travail JS
   (`performance.now()` au début et à la fin) et en retranche la cuisson : `FWK` = coût réel, hors
   cuisson, de l'image précédente. Budget de l'image suivante =
   `P·0,6 − FWK`, borné à `[BMIN, P·0,6]`, où `P = REFDT||16,7` est la période réelle de l'écran
   déjà mesurée par `perf()`. 0,6·P ≈ 10 ms à 60 Hz : c'est la part « JS » du modèle RAIL (10 ms sur
   16,7), le reste étant laissé au navigateur (raster, composition, audio). Si l'intervalle rAF
   précédent a dépassé 1,5·P (image manquée pour une raison que le temps JS ne voit pas : raster,
   GPU), le budget est divisé par deux. Sans mesure (harnais qui appelle `render` directement), on
   garde 3 ms, la valeur actuelle.
2. **Chemin de secours borné.** `bakeChunk` n'est plus appelé en jeu. Les chunks visibles passent
   en tête et sont cuits pas à pas sous budget (avec un plancher réservé aux chunks visibles). Un
   chunk en cours est affiché tel quel (`c.bk.cv`) : c'est le sol de secours plus les couches déjà
   posées. La séquence d'opérations de chaque chunk n'est pas touchée : seul `streamWorld` change
   la *répartition dans le temps*. Règle « ne pas commencer une unité qui ne tient pas » : on
   connaît le coût récent de chaque étape ; si elle déborderait le budget et qu'on a déjà travaillé
   dans cette image, on la laisse à l'image suivante (cuire plus tard, jamais dans un autre ordre).
3. **prewarm différé.** `prewarm` ne cuit plus : il met les chunks en file (`WD.pq`, du centre vers
   l'extérieur) ; `streamWorld` la vide avec le budget restant. Le fondu d'entrée (900 ms) couvre
   les premières images.
4. **(Si le reste est vérifié) murs reprenables sans changer la séquence brute** : `drawWalls`
   devient un générateur ; on ajoute des `yield` entre les phases et tous les N cellules. Le corps,
   l'ordre et les `save/clip/restore` restent textuellement ceux d'origine. Preuve : `bake-eq.js`
   (séquence normalisée) **et** comparaison de la séquence brute. Incrément isolé, retirable seul.
5. **Garde-fou** `test/cuisson.js` (+ appel depuis `test/headless.js`) : horloge virtuelle qui avance
   avec les opérations canvas (modèle « téléphone »), jeu conduit par la vraie `frame()`.
   Critères : (a) aucun appel (`newRun` ou image) ne cuit un chunk entier ; (b) plus long travail
   de cuisson continu par image ≤ plafond chiffré ; (c) le cache ne se vide pas plus souvent
   qu'avant (compte des images où un chunk visible n'est pas terminé). `--ref=HEAD` pour prouver que
   (a) et (b) échouent sur l'ancien code.

## 4. Comment je le prouverai

`bash build.sh` OK (empreinte mise à jour et annoncée) ; `node test/headless.js` TOUT PASSE ;
`regression.js` 12/12 ; `bake-eq.js` 49/49 contre `git show HEAD:gw2.js` ; `test/cuisson.js`
passe sur l'arbre et **échoue** avec `--ref=HEAD` ; `blocages.js` et `frames.js` relancés après.

## 5. Bilan (27/09/2026)

### Ce qui a été fait

| Fichier | Changement |
|---|---|
| `gw2.js` | `prewarm` met en file (`WD.pq`, du centre vers l'extérieur) au lieu de cuire. `bakeBudget()` : budget adaptatif. `streamWorld` : plus de `bakeChunk` ; les chunks visibles ont un plancher `BURG`=4 ms de cuisson compté depuis le début de la cuisson ; puis la file de prewarm. `drawWalls`, `CLIFF_TOP`, `CLIFF_EDGE`, `setPieces` et `SETP.floral` deviennent des générateurs (seuls des `yield` ajoutés) ; `wallsStep` pilote le générateur ; `wallGroups` supprimée. `bakeChunk` n'est plus appelée par le jeu (gardée pour les instruments). |
| `g3.js` | `streamWorld(bakeBudget())` ; un chunk en cours (`c.bk.cv`) est dessiné et compte comme couvert. |
| `g4.js` | `frame()` mesure son travail JS réel (`FWK`, hors cuisson `BKMS`) et son intervalle rAF (`FDT`). |
| `test/cuisson.js` | nouveau garde-fou (horloge virtuelle, vraie boucle `frame()`). |
| `test/art.js` | nouveau : séquence **brute** de 378 chunks sur 3 mondes contre `93b8cfe`. |
| `test/headless.js` | lance les deux ci-dessus comme critères. |
| `.build-sha256`, `bulge.html` | régénérés : **nouvelle empreinte `715790fae6691d4bd50625295212c5e01fd0957b851a0dd2fc5ef111a288eb7c`** (changement légitime). |
| `CLAUDE.md` | les deux nouveaux outils listés. |

Budget adaptatif, formule finale : `b = clamp(0,6·P − FWK, BMIN, 0,6·P)`, divisé par 2 si
`FDT > 1,5·P`, avec `P = REFDT||16,7`, `BMIN = 1,5 ms`. `FWK` est le temps JS réel, mesuré par
`performance.now()`, de l'image précédente moins sa cuisson. Sans mesure (harnais qui appellent
`render` directement), c'est 3 ms en jeu et 5 ms hors jeu, comme avant.

### Preuves (toutes exécutées)

| Vérification | Résultat |
|---|---|
| `bash build.sh` | OK (`715790fa…`, après `--update`) |
| `node test/headless.js` | **TOUT PASSE**, code 0 (avant : TOUT PASSE aussi) |
| `regression.js` | **12/12** |
| `bake-eq.js` (ancien = `git show HEAD:gw2.js` passé sur `/dev/stdin`) | **49/49 identiques** ; plus gros appel indivisible 9 807 → **468 op** |
| `test/art.js` (séquence brute, save/clip/restore compris) | **378/378 identiques**, 1 379 410 opérations ; couvre les murs des 7 biomes et la pièce florale. Sensibilité vérifiée : une mutation `.5`→`.51` dans `SETP.floral` → 376/378, ÉCHEC (puis annulée) |
| `test/trace.js --steps=6000`, arbre vs `--ref=HEAD` | empreinte de simulation **identique** `442c20d37fa75bd9` ; avec `--render` (3000 pas) **identique** `850e4b1d9e300e9b`, aucune exception |
| `test/cuisson.js` sur l'arbre | **TOUT PASSE** |
| `test/cuisson.js --ref=HEAD` (code d'avant) | **ÉCHEC des 3 critères** : 108 chunks entiers hors budget ; bloc continu de 979,8 ms (`newRun`) ; unité de 91,5 ms (18 293 op, murs) |

`test/cuisson.js`, modèle 5 µs/op (≈ 11× le contexte principal de V8 ici) — ce sont des sorties
de **modèle**, pas des mesures de téléphone :

| | avant (HEAD) | après |
|---|---|---|
| `newRun` d'un bloc | 781 à 1 042 ms (36 chunks entiers) | 0,3 ms (+ `genWorld` 42 ms, voir résidus) |
| pire image (3 parties × 2 400 images) | 68,5 / 94,9 / 95,6 ms | 15,8 / 18,8 / 16,7 ms |
| images > 16,7 ms | 99 / 250 / 97 | 0 / 3 / 0 |
| plus grosse unité indivisible | 91,5 ms | 3,4 ms |
| cache vide **après** le fondu d'entrée | 0 | 0 |

Modèle 10 µs/op (téléphone lent), 2 400 images : pire image avant 137 / 186 / 189 ms, après 19 / 25 /
20 ms ; images > 16,7 ms avant 203 / 300 / 100, après 38 / 46 / 4.

`blocages.js` (contexte principal V8, cette machine, 2 passages) : `bakeStep` pire 12,35 → 1,08-1,10 ms
(bal), 7,06 → 1,67-1,78 ms (scout) ; `bakeChunk` 36 appels (110 ms, tous dans `newRun`) → 0 ;
`streamWorld` pire 12,48 → 9,2-9,7 ms. **`render` pire n'a pas baissé** : 17,29 → 18,3-18,7 ms
(bal). Explication probable, **non mesurée image par image** : la pire image est désormais une des
premières de la partie, qui cuit le monde (sprites 3 ms + plancher de 4 ms pour les chunks visibles),
alors qu'avant ce travail était fait dans `newRun` (110 ms d'un bloc, que `blocages.js` ne compte pas
comme une « image »). Sur cette machine rapide, la cuisson urgente ne se déclenchait jamais : le gain
s'y voit sur le démarrage et les unités indivisibles, pas sur les images de jeu.

### Ce qui n'a pas marché / corrigé en route

* Première version du plancher `BURG` compté depuis le début de `streamWorld` : les sprites
  d'obstacles (même budget, passés avant) le consommaient, et les chunks **visibles** ne recevaient
  **aucune** cuisson pendant 4 images au démarrage. Corrigé : le plancher part du début de la cuisson.
* Mon premier compteur « chunk inachevé à l'écran » était faux (une variable `H` du test masquait la
  globale du jeu, d'où un écran vide) : il affichait 0. Corrigé ; les chiffres ci-dessus viennent de
  la version corrigée, vérifiée image par image (`--detail=N`).
* Plancher `BMIN` : j'ai essayé 3 ms (l'ancienne valeur fixe, par prudence). Sur 6 000 images à
  10 µs/op, cela donne **582** images > 16,7 ms contre **126** avec 1,5 ms, et exactement les mêmes
  défauts de cache (démarrage seulement). À 7 µs/op, c'est équivalent. J'ai gardé 1,5 ms.

### Écarts au plan, et pourquoi

* La règle « ne pas commencer une unité qui ne tient pas » (plan §3.2) **n'a pas été faite** : une
  fois les murs et la pièce florale découpés, la plus grosse unité fait 468 op (bake-eq) / 683 op
  (3,4 ms dans le modèle). Le débordement possible est donc déjà petit, et une estimation du coût
  des unités aurait ajouté de l'état pour un gain marginal.
* Critère (a) : la lecture littérale « aucune image ne cuit un chunk entier » contredirait
  l'objectif 1, puisque sur un appareil rapide un chunk léger tient dans le budget d'une image calme.
  Le test l'a montré : un chunk de 7,4 ms a été cuit entier dans une image dont le budget était de
  7,6 ms. Le critère est donc « jamais de chunk entier dans `newRun` (qui n'a pas de budget) ; dans
  une image, seulement si son coût tient dans le budget de cette image ». Il échoue sur l'ancien code
  (108 cas).
* Murs : j'ai fait l'incrément 4, que le plan présentait comme optionnel. Sans lui, l'objectif 2
  restait creux, puisqu'**un seul groupe de murs** coûtait jusqu'à 18 293 op, soit plus qu'un chunk
  moyen (≈ 4 000). Contrairement au refactor rejeté, les corps des fonctions ne changent pas (aucune
  phase réécrite, aucun `clip` ré-ouvert) : on n'ajoute que des `yield`. `test/art.js` compare la
  séquence **brute**, pas seulement la séquence normalisée de bake-eq. L'incrément est isolé dans
  `gw2.js` (générateurs + `wallsStep` + BAKE_STEPS[6]) et peut être retiré seul.

### Ce qu'on voit à l'écran — à juger par l'opérateur

On ne peut pas afficher un chunk inachevé sans que ça se voie. Il y a donc un compromis visuel :

* Un chunk visible en cours de cuisson est dessiné tel quel : le sol de secours (la même carte que
  `drawGround`, déjà utilisée comme repli par le jeu) plus les couches déjà posées, dans l'ordre
  d'origine. Pendant quelques images, on peut donc voir un chunk « se construire » : texture, puis
  décor, puis murs. Le résultat final est identique au pixel près (séquence brute identique).
* Dans le modèle, cela n'arrive **qu'au démarrage**, sous le fondu de 900 ms : pendant 9 à 13
  images (≈ 0,2 s) à 5 µs/op, et jusqu'à 37 images à 10 µs/op, où ce rattrapage déborde de 16 images
  après la fin du fondu. En jeu, dans aucune des 9 parties simulées (jusqu'à 6 000 images, IA et
  course en ligne droite avec dash), un chunk visible n'était pas prêt.
* Autre option, que je n'ai **pas** faite : garder le fondu noir tant que les chunks de l'écran ne
  sont pas prêts. Ce serait plus propre à l'œil, mais cela couple l'interface et la cuisson.

### Refusé / non fait

* Pas touché : `musTick` / l'ordonnanceur audio, les hooks `SIMF`/`__SIM*`, `bulge.html` à la main.
* Pas tenté : diminuer `WY` (6 cellules par pause) ou découper `SETP.sea`, `SETP.sky` (≈ 600-665 op
  chacune). C'est inutile tant que les critères passent avec marge.

### Résidus connus (mesurés, hors mandat)

* **`genWorld` dans `newRun`** (g2.js:55) : dès la 2e partie, un nouveau monde est généré d'un bloc,
  soit ≈ 8 400 opérations (42 ms dans le modèle à 5 µs/op). `frames.js` le montre comme la plus
  longue plage restante sans vérification du budget (8 874 op, contre 144 787 avant). C'est un gel
  au clic sur « Rejouer ».
* L'**affichage** lui-même (700-1 200 op par image, `frames.js`) n'est pas concerné par ce travail.
* `test/unused.js` signale `bakeChunk` : c'est voulu, `frames.js` et `blocages.js` l'enveloppent.
* `frames.js` « plus longue plage » pour scout (12,9 M op) est un artefact de l'instrument : `MARK`
  est remis à 0 sans `OPSTOT`, et le chiffre est identique avant (13,2 M).
* `regression.js` n°3 affiche des choix d'autel différents d'un passage à l'autre, **y compris sur
  le même code** : l'instrument passe le `Math` non graine de Node, et `newRun` s'en sert pour sa
  graine. Le test passe à chaque fois.

### Non vérifié

* **Aucune mesure sur un vrai téléphone ni dans un vrai navigateur** : chromium ne démarre pas ici.
  Le coût réel du raster (GPU), le comportement réel de `performance.now()` et de rAF, et la
  disparition effective du crachotement audio restent à confirmer sur l'appareil. Le modèle de
  `test/cuisson.js` ne compte que les opérations canvas et 1,5 ms par pas de simulation ; il ignore
  le JS hors canvas de la cuisson (`genChunk`, `biomeAt`…).
* Écrans à 120 Hz : la formule utilise `REFDT` (8,3 ms, soit 5 ms de budget maximal), mais aucun
  essai n'a été fait à cette cadence.
* `bake-eq.js` a été lancé avec l'ancien `gw2.js` passé par `/dev/stdin` (`git show HEAD:gw2.js |
  node bake-eq.js /dev/stdin`), car écrire `/tmp/gw2-ancien.js` demandait une autorisation
  indisponible dans cette session. Le contenu est le même.
