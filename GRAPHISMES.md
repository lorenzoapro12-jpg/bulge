# GRAPHISMES — donner une âme à chaque biome

Mandat du 27/09/2026. Travail visuel uniquement ; aucun commit (l'opérateur décide).

## 0. Ce que j'ai vu AVANT de toucher quoi que ce soit

Captures « avant » (graine fixe 20260927, joueur épinglé, 390×780) : `/root/shots/avant-*.png`.
Le pilote `peek.py` ne vise que le centre d'un site, c'est-à-dire le monument : on n'y voit
jamais le biome lui-même. J'ai ajouté (hors dépôt) `bulge-verif/peek2.js` — même pilote, plus une
graine fixe, le site le plus proche du centre du monde et un décalage `#urban,500,300` — et
`bulge-verif/shoot.js` pour capturer plusieurs vues en parallèle.

**Rectification du constat, captures à l'appui.** La Mégapole n'est pas vide : elle a une
génération propre (`gw.js`, îlots de 256 px et bâtiments-obstacles `b:'urban'`, qui remplacent
`OBS_SPEC`), un quadrillage de rues avec marquage et passages piétons (`drawRoads`), un monument
central (fontaine + parvis : `LMS.urban` a `n:0` anneaux mais un centre `c:52`), des voitures.
Ce qui est vrai : **tout est à plat.** Vus de dessus, les bâtiments sont des carrés gris de la
même valeur que la chaussée, sans hauteur, sans fenêtres, sans lumière ; une brume de projecteurs
délave l'ensemble (`avant-urban_500_300.png`, `avant-urban_700_-600.png`). On lit un plan
cadastral, pas une mégapole la nuit sous la pluie.

Les autres biomes, jugés sur capture : récif, glacier, jardin, grille néon et Cœur ont une matière
et des volumes lisibles. **Le ciel est le plus faible après la ville** : un sol bleu-gris bruité
qui ressemble à une moquette, peu d'îles, rien qui bouge (`avant-sky_500_-450.png`). Les plaines
sont jolies mais immobiles (seules des lucioles lointaines, dans la couche de parallaxe).

## 1. Ce que je vais construire

### Mégapole (priorité 1)
- **Volume** — les bâtiments deviennent des tours extrudées **en perspective** : le toit est
  décalé du pied proportionnellement à la distance à la caméra, et les façades visibles
  (parallélogrammes = image affine d'un rectangle) reçoivent une texture de fenêtres allumées.
  En se déplaçant, les tours « penchent » : c'est la signature de la ville, aucun autre biome ne
  l'a. La collision reste l'emprise au sol, inchangée.
  *Pourquoi pas `WALLD.urban>0` :* le système de murs dessine des falaises organiques sur une
  grille de 64 px, indépendante des rues ; il couperait les avenues en biais, et il change la
  génération (`addObs` refuse les bâtiments près d'un mur) donc le terrain de jeu. Je le refuse ;
  voir §4.
- **Sol** — trottoirs dallés autour des îlots, bitume mouillé, flaques qui reflètent les néons,
  conservation du marquage et des passages piétons existants.
- **Lumière** — lampadaires au sodium le long des rues (flaques de lumière chaude), néons de
  façade ; la lumière vient d'en bas (la rue), pas du ciel.
- **Monument** — un phare qui se voit de loin : le faisceau d'un projecteur part du monument de
  la ville le plus proche, même hors écran, et balaie le ciel (couche lointaine).
- **Vie** — feux d'obstacle rouges qui clignotent au sommet des tours, enseignes qui grésillent
  (sans nouvelle entité, dessinés avec les tours).

### Archipel céleste (priorité 2)
- **Sol** — une vraie mer de nuages : moutonnements éclairés en haut à gauche, ombrés en bas à
  droite, à la place du bruit gris.
- **Vie** — vols d'oiseaux qui traversent le monde, au-dessus des îles, avec leur ombre portée.

### Plaines de Lumen (priorité 2)
- **Vie** — essaims de phalènes lumineuses au ras de l'herbe, qui s'écartent quand le joueur
  passe puis reviennent.

Le reste selon ce que les captures montreront ensuite.

## 2. Contraintes que je m'impose

- Ordre de cuisson d'origine conservé : la nouvelle matière urbaine s'ajoute *dans* les couches
  propres à la ville (routes, décor urbain), aucune couche existante n'est déplacée.
- Aucune nouvelle consommation du générateur du monde (`genWorld`) ni de celui de `genChunk` :
  sinon les caches, autels, failles… de TOUS les biomes bougeraient (et le défi du jour avec).
  La vie ambiante nouvelle utilise son propre générateur, dérivé de la graine du chunk.
- Toute nouvelle boucle de cuisson : générateur avec `yield`, unité indivisible sous 4 ms au
  modèle de `test/cuisson.js`.
- Le dessin par image (tours, oiseaux, phalènes) est mesuré dans un vrai Chromium à CPU ralenti
  (`perf-run.js`), dans la ville même, avant/après.
- Aucune valeur de gameplay touchée.

## 3. Comment je le prouverai

- `test/art.js` devient une **garde de périmètre** : liste explicite des biomes autorisés à
  changer ; un chunk qui ne touche aucun de ces biomes (échantillonné avec une marge qui couvre le
  débord du décor) doit rester identique octet pour octet à la référence. Il vérifie aussi les
  sprites d'obstacles (qui n'étaient pas couverts) avec la même règle.
- Captures avant/après par biome modifié, jugement écrit.
- `bash build.sh`, `node test/headless.js`, `node test/cuisson.js`, `node test/art.js`,
  `regression.js` 12/12.

## 4. Bilan

(à compléter en fin de mandat)
