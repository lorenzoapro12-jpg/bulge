#!/usr/bin/env bash
# Build BULGE : concatène les modules puis le shell, et VÉRIFIE le résultat.
#
#   bash build.sh          -> génère bulge.html et compare à l'empreinte attendue
#   bash build.sh --print  -> affiche l'empreinte produite sans la comparer
#   bash build.sh --update -> accepte un changement légitime : enregistre la
#                             nouvelle empreinte (à annoncer dans le compte rendu)
#
# L'ordre ci-dessous est figé : il définit le contenu de bulge.html.
set -euo pipefail
cd "$(dirname "$0")"

ORDER=(g1.js gw.js gw2.js g2.js gp.js gb.js g3.js g4.js)
EXPECTED_FILE=".build-sha256"

# Worker de cuisson (socle, gk.js) : texte d'un second bloc <script type="text/js-worker" id="wk-src">,
# place apres le script principal (shell_tail.html commence par </script>). Les modules du monde, les
# trois sprites de g3.js que la cuisson dessine (g3.js ne se charge pas sans DOM), puis l'entree gk.js.
WORKER=(g1.js gw.js gw2.js)
G3_SPR='^(const SPR=\{\};|function (spr|softSpr|shadowSpr)\()'
if [[ $(grep -cE "$G3_SPR" g3.js) != 4 ]]; then echo "build: g3.js — SPR/spr/softSpr/shadowSpr introuvables pour le worker" >&2; exit 1; fi

cat "${ORDER[@]}" > game.js
{ cat "${WORKER[@]}"; grep -E "$G3_SPR" g3.js; cat gk.js; } > worker.js
{ cat shell_head.html game.js; printf '</script>\n<script type="text/js-worker" id="wk-src">\n'; cat worker.js shell_tail.html; } > bulge.html

ACTUAL=$(sha256sum bulge.html | cut -d' ' -f1)

if [[ "${1:-}" == "--print" ]]; then
  echo "$ACTUAL  bulge.html"
  exit 0
fi

if [[ "${1:-}" == "--update" ]]; then
  echo "$ACTUAL  bulge.html" > "$EXPECTED_FILE"
  echo "build: empreinte mise à jour -> $ACTUAL"
  exit 0
fi

if [[ ! -f "$EXPECTED_FILE" ]]; then
  echo "$ACTUAL  bulge.html" > "$EXPECTED_FILE"
  echo "build: empreinte initialisée -> $ACTUAL"
  exit 0
fi

EXPECTED=$(cut -d' ' -f1 < "$EXPECTED_FILE")
if [[ "$ACTUAL" == "$EXPECTED" ]]; then
  echo "build: OK — bulge.html identique (${ACTUAL:0:16}…)"
else
  echo "build: DIVERGENT" >&2
  echo "  attendu : $EXPECTED" >&2
  echo "  obtenu  : $ACTUAL" >&2
  exit 1
fi
