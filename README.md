# BULGE

Roguelike d'absorption en Canvas 2D, jouable sur navigateur (ordinateur et mobile).
Un seul fichier HTML autonome, sans dépendance : il tourne en `file://` comme en ligne.

**Jouer :** https://lorenzoapro12-jpg.github.io/bulge/ (`index.html` redirige vers `bulge.html`)

## Le jeu

Tu es une bulle. Huit îlots, huit niveaux : sur chacun, trois vagues puis un boss. Chaque îlot apporte
son ennemi ; les anciens restent un temps, mais tu grandis : d'îlot en îlot ils rapetissent, deviennent
des **proies** (pâles, inoffensives : avale-les), puis disparaissent. Au centre de chaque îlot, la
relique est l'îlot que tu viens de quitter, en miniature.

- **Vie** : une membrane de 5 segments ; un coup = un segment ; un segment revient à chaque îlot nettoyé.
- **Bonus** : à l'arrivée sur chaque îlot, puis avant la vague finale, une carte parmi trois (35 bonus, 8 fusions dorées quand on
  possède leurs deux ingrédients, 4 pactes rouges à partir de l'îlot 3 : un pouvoir contre un prix).
- **Série** : des kills (ou des proies avalées) à moins de 1,5 s d'écart forment une série ; à partir de 5, le
  score est multiplié (jusqu'à ×3).
- **Power-ups** (losanges vert-jaune, quelques secondes) : invincibilité 6 s, tir rapide, tir triple,
  perforant, ralenti, bouclier, onde, réparation.
- **Commandes** : ZQSD ou flèches pour bouger (codes physiques, AZERTY comme QWERTY), le tir vise seul
  ce qui est à l'écran (la souris reprend la main), Espace ou Maj : dash, E ou clic droit : gonfler
  quand la jauge est pleine (tu avales ce qui est plus petit), Échap : pause. Sur mobile : pouce
  gauche pour bouger, boutons ⚡ (dash) et ◉ (gonfler).
- Rien ne se garde d'une partie à l'autre, sauf les records.

## Fichiers

| Fichier | Contenu |
|---|---|
| `bulge.html` | Jeu complet, tout-en-un : **artefact généré** par `build.sh`, c'est le fichier publié |
| `index.html` | Page d'entrée GitHub Pages : ouvre `bulge.html` |
| `shell_head.html` | `<head>`, styles, et tout le balisage HTML (HUD, menus, écrans) jusqu'à `<script>` |
| `shell_tail.html` | `</script></body></html>` |
| `g1.js` | Utilitaires, sauvegarde (`bulge3_*`), types d'ennemis, audio et musique adaptative |
| `gw.js` | Îlots : `genIslet(graine, k)`, biome de l'îlot, falaises, obstacles (dont cassables), relique |
| `gw2.js` | Art du monde : cuisson des chunks (sur place ou dans un worker), décor, sprites, météo |
| `g2.js` | Partie : déroulé d'un îlot (vagues, boss, passage), bulle, ennemis, tirs, terrain, fin |
| `gp.js` | Pouvoirs : power-ups, bonus permanents, fusions, pactes, écran de choix |
| `gb.js` | Les 8 boss et leurs attaques annoncées |
| `g3.js` | Rendu (monde, entités, HUD) et cinématique de passage d'îlot |
| `g4.js` | Entrées, interface, boucle principale, régulation de qualité |
| `gk.js` | Entrée du worker de cuisson (placé par `build.sh` dans la page, bloc `wk-src`) |
| `build.sh`, `.build-sha256` | Build vérifié par empreinte SHA-256 |
| `test/` | Harnais headless et outils de mesure (voir plus bas) |

## Build

```bash
bash build.sh            # génère bulge.html et le compare à l'empreinte attendue (.build-sha256)
bash build.sh --update   # accepte un changement légitime de la sortie (à annoncer)
```

L'ordre de concaténation est figé :
`g1.js gw.js gw2.js g2.js gp.js gb.js g3.js g4.js`, puis
`shell_head.html` + `game.js` + `shell_tail.html`. `game.js` est un intermédiaire non suivi.
Ne jamais éditer `bulge.html` à la main.

## Tests et mesures (Node 22, sans navigateur)

Le jeu a un mode simulation intégré (`window.__SIM`, `SIMF()`) : les tests font tourner la
**vraie** logique de jeu dans un DOM et un canvas stubés.

```bash
node test/headless.js               # parties complètes + scénarios + gardes ; code 0 = TOUT PASSE
node test/headless.js --scenarios   # sans les parties complètes
node test/headless.js --sans-gardes # sans les gardes en sous-processus (mise au point)
node test/headless.js --ref=HEAD    # même chose sur les modules d'un commit

node test/trace.js                  # empreinte d'état de 2 parties à graine fixe (naturelle, assistée) + µs par pas
node test/trace.js --ref=HEAD       # à comparer : une optimisation « sans effet » doit donner la même empreinte
node test/trace.js --gen            # temps de genIslet + empreinte des îlots générés (8 graines × 8 îlots)
node test/trace.js --render --calls # appelle render() ; décompte des appels canvas par image

node test/unused.js                 # recensement du code mort (identifiants, SFX, id HTML, classes CSS, médias)
```

`test/trace.js` exécute le jeu dans le contexte principal de V8, comme un navigateur. Sous
`vm.createContext` (le mode de `headless.js`, ou `trace.js --vm`), chaque accès à une globale
passe par un intercepteur : le code y tourne jusqu'à ~180× plus lentement. **Ne pas tirer de
conclusion de performance d'un profil pris sous `vm`.**

`test/lib.js` est le socle commun : il charge les modules d'un commit (ordre lu dans son `build.sh`),
avec une horloge virtuelle, un `Math.random` à graine et une IA de test.

## Journal

**2 oct. 2026, refonte en îlots** : le monde ouvert, l'XP, les classes, le hangar, le duel, le
prologue, l'histoire et le défi du jour sont retirés (`gs gc gi gx gt gv`). Le jeu devient une suite
de huit îlots-arènes (voir « Le jeu »). `test/headless.js` est réécrit : parties complètes jusqu'à la
victoire avec des invariants vérifiés à chaque image, et un scénario par règle du jeu.

**27 sept. 2026, passe globale** : voir `PASSE-GLOBALE.md` (élagage, touches du duel affichées,
prologue qui ne bloque plus, victoire en défi du jour couverte, outils de mesure).

**27 sept. 2026** : 15 défauts corrigés, chacun couvert par un scénario de `test/headless.js`
(voir l'historique git).

**Archive (avant la mise sous git)** : duel tactique, l'action « Analyser » sur une escorte
(Drone, Égide) plantait, car les escortes n'ont pas de faiblesse élémentaire (`weak: null`).
Cette entrée mentionnait aussi des vérifications dans Chromium (ordinateur 1280 px et mobile
360 px). Elles ne sont pas reproductibles sur le serveur de build, où Chromium ne démarre pas.
