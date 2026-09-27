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

ORDER=(g1.js gw.js gw2.js g2.js gs.js gc.js gi.js gx.js gt.js gv.js g3.js g4.js)
EXPECTED_FILE=".build-sha256"

cat "${ORDER[@]}" > game.js
cat shell_head.html game.js shell_tail.html > bulge.html

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
