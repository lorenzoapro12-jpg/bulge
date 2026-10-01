# BULGE — contexte projet

Roguelike d'absorption, Canvas 2D, jeu de navigateur **en français**, desktop + mobile.
Aucune dépendance : pas de framework, pas de bundler, pas de npm. Tout tient dans un
seul fichier HTML autonome qui doit tourner en `file://` comme sur github.io.

## Build — RÈGLE NON NÉGOCIABLE

`bulge.html` est un **artefact généré**. Ne jamais l'éditer à la main.

```bash
bash build.sh          # génère bulge.html depuis les modules + shell
```

L'ordre de concaténation est exact et figé (voir `build.sh`) :

```
g1.js gw.js gw2.js g2.js gs.js gc.js gi.js gx.js gt.js gv.js g3.js g4.js
```

puis `shell_head.html` + `game.js` + `shell_tail.html`.

`build.sh` **vérifie** que le résultat est identique octet pour octet à l'empreinte
attendue et **échoue** sinon. Après toute modification : `bash build.sh` doit passer.
Si une modification change légitimement la sortie, mettre à jour l'empreinte dans
`build.sh` **et** le dire explicitement dans le compte rendu.

## Architecture des modules

| Fichier | Contenu |
|---|---|
| `shell_head.html` | `<head>`, styles, balisage HTML (HUD, menus, écrans) jusqu'à `<script>` |
| `shell_tail.html` | `</script></body></html>` |
| `g1.js` | Utilitaires, sauvegarde, données, audio et musique adaptative |
| `gw.js` | Monde continu : biomes, obstacles, relief, sentiers, falaises, monuments |
| `gw2.js` | Art du monde : décor, sprites d'obstacles, parallaxe, météo |
| `g2.js` | Logique de jeu : joueur, ennemis, cœurs, boss, projectiles, fin de partie |
| `gs.js` | Histoire, éclats, sanctuaire, missions, série |
| `gc.js` | Compétences, ultimes, monde semi-ouvert |
| `gi.js` | Tank, pilote, équipement, butin, hangar |
| `gx.js` | Souvenirs d'Iris (scènes) et duel tactique |
| `gt.js` | Prologue jouable |
| `gv.js` | Décors lointains du rêve |
| `g3.js` | Rendu |
| `g4.js` | Entrées, interface, boucle principale |

Le code est volontairement **dense** (lignes longues, pas d'espaces superflus,
identifiants courts). Conserver ce style : ne pas reformater, ne pas « nettoyer »
un fichier qu'on ne modifie pas fonctionnellement.

## Interdits

- **Ne pas casser les hooks de simulation** : `SIMF()` (`g1.js`), `window.__SIM`,
  `window.__SIM_END`, `window.__SIM_PICK`, `window.__SIM_INPUT` (`g2.js`). Le harnais de
  test headless en dépend — c'est le seul moyen de faire tourner le jeu sur un serveur
  sans navigateur. Toute nouvelle interaction joueur doit avoir sa branche `SIMF()`.
- **Pas de dépendance externe nouvelle.** La seule existante est Google Fonts
  (`shell_head.html`) — elle est tolérée mais toute police doit avoir un repli.
- **Pas de `eval`/`new Function` sur des données sauvegardées.**
- Ne pas supprimer `bulge.html` du suivi git : c'est l'artefact publié.

## Vérification — la règle

Un rapport n'est **pas** une preuve. Toute affirmation de correction doit être adossée à
une exécution réelle :

```bash
bash build.sh              # doit afficher OK
node test/headless.js      # doit afficher TOUT PASSE (code de sortie 0)
```

Si `test/headless.js` n'existe pas ou ne couvre pas ce qu'on vient de modifier,
**l'écrire / l'étendre d'abord**. Un correctif sans test qui échoue avant et passe après
n'est pas un correctif vérifié.

Outils complémentaires :

- `node test/trace.js` — empreintes d'état (simulation, monde, rendu), chronométrage.
  `--ref=HEAD` compare à un commit. Sert à **prouver qu'un changement n'a pas d'effet**
  (élagage, refactorisation) : les empreintes doivent être identiques.
- `node test/cuisson.js` — garde-fou de la cuisson du monde (horloge virtuelle « téléphone »,
  vraie boucle `frame()`) : aucun chunk entier hors budget, travail continu et unité indivisible
  plafonnés. `--ref=` pour l'ancien code, `--k=` pour le coût d'une opération. Appelé par headless.js.
- `node test/art.js` — séquence BRUTE des opérations canvas de 378 chunks comparée à `e3a2c93` (chemin principal ; avant : `93b8cfe`,
  avant PERF-2) : toute modification de l'art du monde échoue. Appelé par headless.js.
- `node test/regule.js` — garde-fou du **régulateur de qualité** (`perf()` : référence `REFDT`, crans,
  plafond manuel). Il compte les **images dégradées**, pas seulement l'état final : c'est ce chiffre qui a
  réfuté une première correction (elle rendait la qualité, au prix de 64 s de jeu dégradé). `--ref=` pour
  l'ancien code. Appelé par headless.js.
- `node test/saut.js` — garde-fou du **filet de budget** (`skipCtl` : `SKP`, `SKW`, `SKIPD`), sur horloge
  virtuelle : un rappel en double (`dt < DTMIN`) ne nourrit plus la période estimée, la cuisson budgétée ne
  bloque plus la remontée de `SKP`, `SKW` se révise des deux côtés. `--ref=` pour l'ancien code. Appelé par
  headless.js. ⚠️ Il **extrait `skipCtl` de `g4.js`** : si ce bloc est renommé ou déplacé, le banc doit
  échouer **en le disant** — ne jamais « réparer » en assouplissant l'extraction.
- `node test/unused.js` — recensement du code mort (identifiants, `SFX`, `id` HTML,
  classes CSS, médias). À lancer avant d'affirmer qu'un symbole est utilisé.
- `node test/compteur.js` — garde-fou du compteur de diagnostic (`meta.fps`) : chaque ligne doit
  TENIR dans la largeur de dessin (`W`, pas la surface du canvas), y compris en police large et
  à 320 px de large ; et l'état de la cuisson doit être affiché (`cuisson worker N` / `sur place`),
  parce que sans worker le jeu retombe silencieusement sur la cuisson sur place — deux mesures
  « avec / sans `?wk=1` » peuvent alors comparer deux fois le même chemin sans que rien ne le dise.
  Vérifié côté navigateur par `bulge-verif/compteur-ecran.py <page> [--wk]`, qui intercepte les
  `fillText` réellement émis et les mesure avec les vraies métriques de la police.

⚠️ **Ne jamais conclure sur la performance depuis le harnais.** `node test/headless.js`
exécute le jeu dans un `vm.createContext` : chaque accès à une globale y passe par un
intercepteur, jusqu'à ~180× plus lent qu'en portée réelle. Mesuré le 27/09/2026 :
`genWorld` semblait prendre 1,9 s sous `vm`, contre ~54 ms en contexte principal. Un
« goulot » vu sous `vm` est très probablement un artefact du banc. Pour chronométrer :
`test/trace.js` (contexte principal). Pour le rendu, un **vrai navigateur** : voir la section
Environnement — `chromium` démarre ici, contrairement à ce que ce fichier affirmait.

## Environnement

- Serveur Linux ARM64, `node` v22 disponible.
- **`chromium` DÉMARRE ici** (vérifié le 27/09/2026 — l'affirmation contraire était fausse et a
  fait produire des chiffres « téléphone » par modèle au lieu d'être mesurés). C'est un snap :
  son `/tmp` est privé, donc `--screenshot=/tmp/x.png` écrit un fichier introuvable depuis le
  serveur. Écrire ailleurs : `--screenshot=/root/shots/x.png`. Exemple de capture :
  `chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=390,780 \
   --virtual-time-budget=40000 --screenshot=/root/shots/jeu.png file:///chemin/page.html`
  Pour MESURER (et non capturer), piloter par CDP. Outils dans `/root/work/bulge-verif/` :
  - `perf-run.js <page.html> <ralentissement> <durée> <label>` — intervalles d'image réels
    et travail JS par image, avec `Emulation.setCPUThrottlingRate` ;
  - `profil.py` + `profil-run.js` — profil **par fonction** (appels, cumul, PIRE appel) ;
  - `verif-raster.js` — coût du premier `drawImage` d'un chunk (rasterisation différée) ;
  - `verif-neufs.js` — **combien de chunks neufs par image**, avec un pilote de voyage.
    ⚠️ Il embarquera son propre pilote : en mode `__SIM` le jeu n'appelle pas `readInput()`,
    il attend `window.__SIM_INPUT` — sans quoi le joueur ne bouge pas et on ne mesure **rien**
    (0 chunk neuf sur 414 images, mesuré le 28/09/2026).
  - `micro-async.js` — mesure si une opération **bloque le fil principal** (images rAF qui
    passent pendant l'opération). C'est le seul verdict qui vaille : une durée murale ne dit
    pas si la boucle a été gelée.
  Le harnais `vm` reste la voie d'exécution déterministe pour les tests.
- Écrire dans ce dépôt uniquement. Ne pas toucher à `/root/.hermes/`, `~/.claude/` ni
  aux autres projets.
