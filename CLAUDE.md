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

## Environnement

- Serveur Linux ARM64, `node` v22 disponible. **`chromium` ne démarre pas ici** :
  le test headless par `vm` + DOM/canvas stubés est la seule voie d'exécution.
- Écrire dans ce dépôt uniquement. Ne pas toucher à `/root/.hermes/`, `~/.claude/` ni
  aux autres projets.
