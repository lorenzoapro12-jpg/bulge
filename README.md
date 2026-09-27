# BULGE

Roguelike d'absorption en Canvas 2D, jouable sur navigateur (ordinateur et mobile).
Un seul fichier HTML autonome, sans dépendance : il tourne en `file://` comme en ligne.

**Jouer :** https://lorenzoapro12-jpg.github.io/bulge/ (`index.html` redirige vers `bulge.html`)

## Fichiers

| Fichier | Contenu |
|---|---|
| `bulge.html` | Jeu complet, tout-en-un : **artefact généré** par `build.sh`, c'est le fichier publié |
| `index.html` | Page d'entrée GitHub Pages : ouvre `bulge.html` |
| `shell_head.html` | `<head>`, styles, et tout le balisage HTML (HUD, menus, écrans) jusqu'à `<script>` |
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
| `build.sh`, `.build-sha256` | Build vérifié par empreinte SHA-256 |
| `test/` | Harnais headless et outils de mesure (voir plus bas) |

## Build

```bash
bash build.sh            # génère bulge.html et le compare à l'empreinte attendue (.build-sha256)
bash build.sh --update   # accepte un changement légitime de la sortie (à annoncer)
```

L'ordre de concaténation est figé :
`g1.js gw.js gw2.js g2.js gs.js gc.js gi.js gx.js gt.js gv.js g3.js g4.js`, puis
`shell_head.html` + `game.js` + `shell_tail.html`. `game.js` est un intermédiaire non suivi.
Ne jamais éditer `bulge.html` à la main.

## Tests et mesures (Node 22, sans navigateur)

Le jeu a un mode simulation intégré (`window.__SIM`, `SIMF()`) : les tests font tourner la
**vraie** logique de jeu dans un DOM et un canvas stubés.

```bash
node test/headless.js               # parties complètes + scénarios de régression ; code 0 = TOUT PASSE
node test/headless.js --scenarios   # scénarios seulement (rapide)
node test/headless.js --ref=HEAD    # même chose sur les modules d'un commit

node test/trace.js                  # empreinte d'état de 5 parties à graine fixe + µs par pas
node test/trace.js --ref=HEAD       # à comparer : une optimisation « sans effet » doit donner la même empreinte
node test/trace.js --gen            # temps de genWorld + empreinte du monde généré (falaises, cartes…)
node test/trace.js --render --calls # appelle render() ; décompte des appels canvas par image
node test/trace.js --tuto           # déroulé des étapes du prologue

node test/unused.js                 # recensement du code mort (identifiants, SFX, id HTML, classes CSS, médias)
```

`test/trace.js` exécute le jeu dans le contexte principal de V8, comme un navigateur. Sous
`vm.createContext` (le mode de `headless.js`, ou `trace.js --vm`), chaque accès à une globale
passe par un intercepteur : le code y tourne jusqu'à ~180× plus lentement. **Ne pas tirer de
conclusion de performance d'un profil pris sous `vm`.**

## Journal

**27 sept. 2026, passe globale** : voir `PASSE-GLOBALE.md` (élagage, touches du duel affichées,
prologue qui ne bloque plus, victoire en défi du jour couverte, outils de mesure).

**27 sept. 2026** : 15 défauts corrigés, chacun couvert par un scénario de `test/headless.js`
(voir l'historique git).

**Archive (avant la mise sous git)** : duel tactique, l'action « Analyser » sur une escorte
(Drone, Égide) plantait, car les escortes n'ont pas de faiblesse élémentaire (`weak: null`).
Cette entrée mentionnait aussi des vérifications dans Chromium (ordinateur 1280 px et mobile
360 px). Elles ne sont pas reproductibles sur le serveur de build, où Chromium ne démarre pas.
