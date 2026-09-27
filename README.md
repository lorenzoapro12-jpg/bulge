# BULGE

Roguelike d'absorption en Canvas 2D, jouable sur navigateur (ordinateur et mobile).
Artefact : https://claude.ai/artifact/XfqhuvsbynC8nXiAuwqJhe

## Fichiers

| Fichier | Contenu |
|---|---|
| `bulge.html` | Jeu complet, tout-en-un (c'est le fichier publié dans l'artefact) |
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

## Build

```bash
cat g1.js gw.js gw2.js g2.js gs.js gc.js gi.js gx.js gt.js gv.js g3.js g4.js > game.js
cat shell_head.html game.js shell_tail.html > bulge.html
```

Le build reproduit `bulge.html` à l'octet près.

## Journal — 27 sept. 2026

**Correctif** : duel tactique, l'action « Analyser » sur une escorte (Drone, Égide) plantait :
les escortes n'ont pas de faiblesse élémentaire (`weak: null`). L'énergie était dépensée
sans effet et l'écran du duel ne se mettait plus à jour. L'analyse indique maintenant
« aucune faiblesse élémentaire » et accorde bien le coup critique suivant (gx.js).

**Vérifié sans autre erreur** (Chromium, ordinateur 1280 px et mobile 360 px) :
parties complètes jusqu'à la victoire sur l'Hypernoyau avec les 3 vaisseaux et en mode
quotidien, 12 duels menés à terme, les 3 types de Souvenirs d'Iris, prologue, évolutions
et relance, pause, écrans de fin, hangar, sanctuaire, codex, reliques, classement.
Accessibilité du terrain : sur 20 mondes générés, les 3 cœurs et le noyau sont
atteignables même avec le plus gros vaisseau possible (Colosse niv. 14 + Titan).
