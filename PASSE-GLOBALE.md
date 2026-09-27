# Passe globale — cure, optimisation, élagage (27/09/2026)

Document de travail, écrit **avant** d'exécuter (§1–3), puis complété à la fin (§4–8).

## 0. Point de départ mesuré

| Contrôle | Résultat de référence |
|---|---|
| `bash build.sh` | `build: OK — bulge.html identique (a561608275fbfca3…)` |
| `node test/headless.js` | `TOUT PASSE`, code 0, 28 critères (~3 min) |
| `node /root/work/bulge-verif/regression.js` | `12/12 tests passent` |

## 1. Reconnaissance : ce que j'ai appris et qui oriente le plan

### 1.1 Un banc de mesure honnête : le piège du contexte `vm`
Le harnais fait tourner le jeu dans un `vm.createContext`. J'ai profilé : `genWorld` y prenait
**~1,9 s** par monde, dont 52 % dans `hash2` (3 `Math.imul`). Avant de « l'optimiser », je l'ai
isolé. **Dans un contexte `vm`, chaque accès à une globale passe par un intercepteur** : le même
code de bruit y tourne en 4 245 ms, contre 23 ms en portée globale normale (×180). Le profil
était donc un artefact du banc. Dans un navigateur, les globales sont rapides.

J'ai donc écrit `test/trace.js`, qui exécute le jeu **dans le contexte principal de V8**
(globales réelles, comme un navigateur) et, en option `--vm`, comme le harnais. Il produit :
- une **empreinte d'état** de 5 parties à graine fixe (conduites par la même IA que `headless.js`,
  reprise textuellement). Elle est identique dans les deux modes, ce qui prouve la même sémantique ;
- `--gen` : temps de `genWorld` + empreinte de tout le monde généré, y compris les pixels des cartes ;
- `--render` : appelle `render()` à chaque pas (le rendu reçoit sa propre source d'aléa, pour que
  l'empreinte de la simulation reste comparable) ; `--calls` compte les appels canvas par type ;
- `--ref=HEAD` : même chose sur les modules d'un commit.

**Mesures de référence (mode natif, serveur ARM64) :**

| Mesure | Valeur |
|---|---|
| `genWorld` | **~54 ms** en moyenne sur 8 graines (et non 1,9 s) |
| simulation, IA de test comprise | **50–114 µs par pas**, soit < 1 % d'une image à 60 Hz |
| rendu, côté JS (canvas stubé) | 200–640 µs par image |
| appels canvas par image | 570–1 750 ; 2 à 18 `createRadialGradient` ; pas de `shadowBlur` ni de `filter` dans le top 24 |
| empreinte simulation | `d97db03a39feaf91` (arbre de travail = `HEAD`) |
| empreinte monde | `aefacc873b6650ac` (arbre de travail = `HEAD`) |

**Conclusion :** il n'y a **pas de goulot JS prouvable**, ni dans la simulation ni dans la
génération. Le coût réel d'une image est le dessin Canvas, que je ne peux ni chronométrer ni
**voir** sans navigateur.

### 1.2 Code mort : recensement mécanique
J'ai écrit `test/unused.js` : il compte les références de chaque identifiant déclaré (premier
niveau et imbriqué), des méthodes de `SFX`, des `id` HTML, des classes CSS et des fichiers média.
Chaque candidat a ensuite été revérifié à la main : aucun `window[…]` ni `SFX[…]` dynamique.

- `g1.js` `function pan` · `g2.js` `const BOSS_ROOM` · `gc.js` `function gcTouch` (le tactile passe
  par `touchBtnAt` dans `g4.js`) · `gt.js` `function tutOn` · `g4.js` `let fastT`
- `SFX.warp`, `SFX.clear`, `SFX.spawn` : jamais joués
- `'warp'` dans `IN_GAME` (`g4.js`) : aucun état `'warp'` n'existe
- `BIO[…].mus` et `BIO[…].wave` (`gw.js`) : jamais lus (`AU.mus` est un nœud audio distinct)
- `g4.js` : l'écouteur `contextmenu` est enregistré **deux fois** sur le canvas
- `g4.js` `RM` : doublon exact de `REDUCED` (`g1.js`), même `matchMedia`
- 4 `.wav` (8,5 Mo) : référencés nulle part (ni JS, ni HTML, ni `index.html`)
- id HTML et classes CSS : **aucun** orphelin détecté

### 1.3 Les pistes
- **Duel, touches 1–5 invisibles** : confirmé. `renderDuel` (`gx.js:266`) n'affiche aucun numéro,
  alors que les cartes d'évolution en affichent (`<span class="key">`). « Entrée = fin du tour »
  n'est affiché nulle part non plus.
- **Prologue bloquant** : confirmé par lecture. L'étape `skill` (`gt.js:20`) ne se valide que par
  `G.p.sk[0].cd>0`. Un joueur qui ne lance jamais sa compétence reste indéfiniment sur « 6/9 » :
  cadre d'objectif affiché en permanence, étapes suivantes jamais vues, récompense du prologue
  (60 éclats et un objet rare) jamais versée. Et ça **d'une partie à l'autre**, puisque
  `meta.tuto` reprend à cette étape. Même mécanique pour `dash`, `echo` et `altar`.
- **run3 (défi du jour)** : le critère ne couvre que « actif + kills>0 ». La victoire en mode
  quotidien, et ses règles propres (pas de reliques, `meta.runs` inchangé, record du jour,
  succès « Rituel »), n'est vérifiée nulle part.
- **Documentation** : `README.md` pointe encore vers l'artefact claude.ai. Il décrit un build
  `cat` sans vérification d'empreinte, ne mentionne ni `build.sh`, ni les tests, ni l'URL
  GitHub Pages. Il affirme aussi des vérifications « Chromium » impossibles sur ce serveur.

## 2. Plan — dans cet ordre, un incrément vérifié à la fois

Protocole après **chaque** incrément : `bash build.sh` (avec `--update` si la sortie change
légitimement, annoncé ici), `node test/headless.js` à code 0, `regression.js` à 12/12. Pour tout
ce qui se veut « sans effet de comportement » : empreintes `trace.js` **identiques** à la référence.

0. **Outillage** (aucun changement du jeu) : `test/trace.js`, `test/unused.js`.
1. **Élagage des 4 `.wav`** (8,5 Mo de poids mort sur un site public).
2. **Élagage du code mort** listé au §1.2. Preuve : empreintes de simulation et de monde
   identiques octet pour octet, `unused.js` vide, harnais vert.
3. **Duel : afficher les touches.** Numéro 1…n sur chaque action et « Entrée » sur « Fin du
   tour », **au clavier seulement** (rien sur tactile, comme les touches A/E/R du HUD,
   `gc.js:230`). L'ordre de `DU.keys` reste inchangé : `regression.js` n°12 le fige.
   Test d'abord : doit échouer avant et passer après.
4. **Prologue : patience au lieu du blocage.** Les étapes d'action (`dash`, `skill`) et
   d'exploration (`echo`, `altar`) reçoivent un délai. Passé ce délai, l'écho d'Iris le dit et passe à
   la suite. L'aide de l'étape reste consultable dans le Guide. Faire l'action avant le délai
   valide l'étape comme aujourd'hui. `move`, `shoot`, `absorb` et `level` se valident d'eux-mêmes
   en jouant ; `heart` est l'objectif même de la partie : pas de délai. Test d'abord : un joueur
   qui n'utilise jamais sa compétence doit finir le prologue ; un joueur qui l'utilise doit valider
   l'étape tout de suite, comme avant.
5. **Défi du jour : couverture de la victoire.** Nouvelle partie `run6` (défi du jour, assistée
   jusqu'à l'Hypernoyau) et critères : victoire, pas de reliques, `meta.runs` inchangé, record du
   jour enregistré, succès `daily`. Si ça révèle un défaut : test rouge, puis correctif.
6. **README** remis à jour : URL publiée, `build.sh`, tests, outils. `CLAUDE.md` n'est pas
   touché (interdit), mais ses écarts éventuels sont signalés ici.

## 3. Ce que j'écarte délibérément

- **Toute optimisation du rendu.** Aucun goulot JS prouvé, et je ne peux ni voir les pixels ni
  mesurer le GPU. Modifier le dessin, c'est risquer une régression visuelle invérifiable sur un
  jeu publié, pour un gain hypothétique.
- **Les micro-optimisations de la simulation** (`G.en.filter` à chaque pas, tableaux de `BIGS()`,
  `[nx,ny]` de `collideCircle`…). Réelles mais minuscules : < 1 % du budget d'une image est déjà
  mesuré. Elles toucheraient au code le plus couvert pour un gain non mesurable.
- **L'optimisation de `genWorld`.** 54 ms, une fois par partie. Elle n'était « lente » que sous `vm`.
- **Accélérer `test/headless.js`** en le sortant du contexte `vm` (il gagnerait probablement
  un ordre de grandeur). C'est la colonne vertébrale de vérification de Lorenzo : j'y **ajoute**
  des critères, je ne change pas sa manière d'exécuter. Recommandé pour une prochaine passe.
- **Reformater ou « nettoyer »** un fichier que je ne modifie pas fonctionnellement.
- **Rééquilibrer le jeu** (dégâts, spawns…) : hors mandat, et invérifiable sans joueurs.

---

# Bilan (rédigé après exécution)

## 4. Ce que j'ai changé, et pourquoi — incrément par incrément

| # | Incrément | Preuve | Build | `headless.js` | `regression.js` |
|---|---|---|---|---|---|
| 0 | Outils `test/trace.js`, `test/unused.js` | aucun module du jeu touché | inchangé (`a5616082…`) | — | — |
| 1 | Suppression des 4 `.wav` | `unused.js` : référencés nulle part ; `bulge.html` identique à l'octet | OK, inchangé | 28 OK, TOUT PASSE, code 0 | — |
| 2 | Code mort (§1.2) | empreintes **identiques** : simulation `d97db03a39feaf91`, monde `aefacc873b6650ac`, rendu `442c20d37fa75bd9` ; `unused.js` vide | `--update` → `575d6d38…` | 28 OK, TOUT PASSE, code 0 | 12/12 |
| 3 | Duel : touches affichées | nouveau critère **rouge avant** (`touches affichées [-,-,-,-,-]`), vert après ; simulation et rendu inchangés | `--update` → `3b7f5fe2…` | 29 OK, TOUT PASSE, code 0 | 12/12 |
| 4 | Prologue : patience | nouveau critère **rouge avant** (`étape 4→4 en 40000 pas`), vert après | `--update` → `1f28c044…` | 30 OK, TOUT PASSE, code 0 | 12/12 |
| 5 | Défi du jour : victoire couverte | 2 nouveaux critères, verts ; **aucun défaut révélé** | inchangé | 32 OK, TOUT PASSE, code 0 | — |
| 6 | README | documentation seulement | inchangé | — | — |

**État final, sur l'arbre définitif** : `build: OK — bulge.html identique (1f28c04483821991…)` ·
`node test/headless.js` : 32 OK, `TOUT PASSE`, code 0 · `regression.js` : `12/12 tests passent` ·
`unused.js` : 0 identifiant, 0 SFX, 0 id, 0 classe, 0 média orphelin · empreinte monde
`aefacc873b6650ac` inchangée depuis le départ.

**Empreinte finale du build : `1f28c044838219919bc640d8d133502eeff9383c5e250a2c228a7d30279956e3`**,
mise à jour 3 fois avec `bash build.sh --update` (incréments 2, 3, 4), chaque fois pour un
changement voulu de la sortie. `bulge.html` : 341 977 → 341 657 octets.

### 4.1 Élagage (incréments 1–2)
- **4 `.wav` supprimés : 8 490 440 octets.** Ils ne sont référencés par aucun fichier.
  Lorenzo en garde une copie.
- `pan()`, `BOSS_ROOM`, `gcTouch()`, `tutOn()`, `fastT`, `SFX.warp/clear/spawn` : supprimés.
- `'warp'` retiré de `IN_GAME` (aucun état de ce nom).
- 2ᵉ `addEventListener('contextmenu')` sur le canvas : supprimé (doublon exact).
- `RM` (`g4.js`) remplacé par `REDUCED` (`g1.js`) : même requête `matchMedia`, 3 usages.
- `mus` et `wave` retirés des 8 biomes de `BIO` (jamais lus).
- **Preuve de non-effet** : les empreintes de simulation (5 parties), de monde (8 graines,
  pixels des cartes compris) et de rendu sont identiques octet pour octet avant et après.

### 4.2 Duel : touches visibles (incrément 3, `gx.js` + `shell_head.html`)
Au clavier, chaque action du duel porte le chiffre qui la déclenche, `<kbd>1</kbd>` …
`<kbd>5</kbd>`, dans l'ordre de `DU.keys` (celui qu'utilise `onKey`). « Fin du tour » porte
`<kbd>Entrée</kbd>`. Sur tactile, rien ne change : pas de libellés, comme les touches A/E/R du
HUD. L'ordre des boutons est inchangé (`regression.js` n°12 le vérifie). Le critère ajouté vérifie :
libellés = `1..n` dans l'ordre des `data-a`, qui est aussi l'ordre de `DU.keys`, « Entrée »
présente, et aucun `<kbd>` sur tactile.

### 4.3 Prologue : il ne bloque plus (incrément 4, `gt.js`)
Les étapes `dash` et `skill` reçoivent un délai de 45 s de jeu, `echo` et `altar` 150 s. Seul le
temps en état `play` compte (`gtTick` ne tourne qu'en jeu, donc ni pause ni duel). Passé ce délai,
l'écho d'Iris dit « Pas grave, tu y reviendras : c'est noté dans le Guide » et enchaîne. L'aide de
l'étape reste consultable dans le Guide du rêve (`gtGuideHTML` l'affiche dès que `meta.tuto` la
dépasse). Faire l'action avant le délai valide l'étape comme avant, en 1 pas (témoin du critère).
`heart` n'a pas de délai : c'est l'objectif de la partie.

**Découverte en vérifiant** (`trace.js --tuto`, sur `HEAD`) : le blocage ne touchait pas que le
joueur qui ignore sa compétence. **L'IA de test elle-même** restait coincée à l'étape `echo`
pendant les 20 000 pas de la partie `naturel`, puis à `altar` jusqu'à 14 404 pas dans la partie
`colosse`. Après correctif, le prologue se termine dans la même partie, à 19 038 pas.
**Effet de bord assumé** : c'est un changement de comportement voulu, donc les empreintes des
parties qui traversent le prologue changent (`naturel` `45c2…` → `d12f…`, `colosse` `746e…` →
`612a…`, empreinte globale `d97db03a…` → `dd84e79e…`). Les 3 autres parties sont identiques.
Dans `headless.js`, les trajectoires de run1, run2 et run5 changent aussi (run1 termine son
prologue, et `meta` en hérite). **Tous les critères existants restent verts.**

### 4.4 Défi du jour : la victoire est couverte (incrément 5, `test/headless.js`)
Nouvelle partie `run6` (défi du jour, assistée) et 2 critères : victoire (3 cœurs, reliques
inactives) ; aucune relique proposée, `meta.runs` et `meta.wins` inchangés, 0 XP de pilote,
record du jour = score, succès « Rituel », entrée de classement marquée « jour ». Tout était
déjà correct dans le jeu.

**Piège évité** : la graine du défi dépend de la **date**. `trace.js --daily-days=10` :
l'IA gagne 9 dates sur 10. Au 04/10/2026, elle reste coincée loin du 1ᵉʳ cœur. J'ai prouvé que
le terrain est praticable ce jour-là : remplissage à 12 px avec la vraie collision `pointHit`,
rayon 30 et 37 px (vaisseau niveau 14, avec Titan) ; les 3 cœurs et le noyau sont atteignables
sur les 10 dates, et atteignables sur la grille des falaises pour 60 jours. C'est une limite de
l'IA de test, pas un défaut du jeu. Pour que le critère ne dépende pas du jour d'exécution, `run6`
**fige la date au 27/09/2026** (surcharge de `Date` dans le contexte, restaurée dans un `finally`).
J'ai vérifié que la surcharge change bien la clé et la graine du défi, puis se restaure.

### 4.5 Documentation (incrément 6)
`README.md` réécrit : URL publiée, `build.sh --update`, tests et outils, avertissement sur les
profils sous `vm`. L'ancienne entrée « vérifié dans Chromium » est conservée comme archive, avec
la mention qu'elle n'est pas reproductible ici. `CLAUDE.md` n'est pas modifié. En le relisant, je
n'y ai trouvé **aucune affirmation devenue fausse**. Il ne mentionne simplement ni `index.html`,
ni `test/trace.js`, ni `test/unused.js`.

## 5. Critères du harnais : 28 → 32, aucun supprimé ni assoupli
Ajoutés : `duel : chaque action affiche sa touche…`, `prologue : … n est pas bloqué…`,
`run6 : VICTOIRE en défi du jour…`, `run6 : règles du défi à la victoire…`.
Aucune graine existante, aucun seuil, aucun critère existant n'a été modifié. Aucun critère
n'est devenu obsolète. Le harnais prend ~40 s de plus (partie run6).

## 6. Ce que j'ai laissé, et pourquoi
- **Rendu, simulation, `genWorld`** : pas de goulot JS prouvé (voir §1.1). Rien d'optimisé
  « au jugé ». La seule « lenteur » spectaculaire (`genWorld` à 1,9 s) était un artefact du banc `vm`.
- **run3** garde son critère faible et sa dépendance à la date : ne pas modifier les critères
  existants. La victoire quotidienne est désormais couverte par run6.
- **Cartes d'évolution** : elles affichent leur numéro même sur tactile, alors que le duel ne
  le fait plus. Petite incohérence, sans gêne, laissée pour ne pas toucher un écran qui marche.
- **Sélection de la cible au clavier** en duel (aujourd'hui au clic seulement) : pas demandé,
  laissé pour une prochaine passe.

## 7. Recommandations pour la prochaine passe
1. **Accélérer `test/headless.js`** en l'exécutant dans le contexte principal
   (`runInThisContext`, comme `trace.js`) : probablement ~×3 sur les parties (mesuré sur la trace :
   ~100 µs contre ~300 µs par pas). Les empreintes de `trace.js` prouvent déjà que les deux modes
   ont la même sémantique. À décider par Lorenzo, puisque c'est sa colonne vertébrale.
2. **IA de test** : elle se coince parfois contre le décor (04/10/2026). Une détection de blocage
   (pas de progrès en N pas → recalcul du chemin sans l'obstacle touché) rendrait les parties
   quotidiennes robustes d'une date à l'autre.
3. **Mesurer le rendu dans un vrai navigateur**, sur un poste où Chromium démarre : un profil
   Performance sur mobile permettrait enfin de trancher les pistes §3 (dégradés par image, nombre
   de `beginPath`/`fill`, précuisson des chunks).
4. Ajouter à `CLAUDE.md` (c'est à Lorenzo de le faire, je n'y ai pas touché) : l'avertissement
   « pas de conclusion de performance sous `vm` » et l'existence de `trace.js` / `unused.js`.

## 8. Ce que je n'ai PAS pu vérifier
- **L'apparence** des libellés `<kbd>` du duel (taille, alignement, retour à la ligne sur
  écran étroit) : aucun navigateur ici. Seul le HTML produit est vérifié. Le CSS ajouté est court
  et limité à `.dvact kbd`.
- **Le ressenti** des délais du prologue (45 s / 150 s) : valeurs de jugement, à ajuster sur
  retour de joueurs.
- **Les performances réelles** (images par seconde, GPU, mobile) : rien n'est mesurable ici.
  Seuls le coût JS et le nombre d'appels canvas le sont (§1.1).
- **Le son** : les 3 SFX supprimés n'étaient jamais joués. Le reste de l'audio n'est pas exécuté
  sous le harnais (pas d'`AudioContext` dans le stub).
- **Safari/iOS** : la seule syntaxe nouvelle est `<kbd>` et des paramètres de fonction classiques.
  Pas de nouvelle API, mais non exécuté sur Safari.
- **La victoire quotidienne sur d'autres dates que celles testées** : 9 sur 10 avec l'IA de test ;
  terrain praticable prouvé sur 10 dates (collisions fines), et sur 60 (grille des falaises).
