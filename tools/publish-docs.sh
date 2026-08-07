#!/usr/bin/env bash
# Publie le manuel sur la branche gh-pages.
#
# Le travail se fait dans un clone temporaire, jamais dans le répertoire de travail.
# La version précédente créait une branche orpheline sur place et faisait `git add -A` :
# faute de .gitignore sur cette branche, node_modules s'est retrouvé publié, puis effacé
# du disque au retour sur main. Un clone jetable rend cette classe d'erreur impossible.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="$(git -C "$ROOT" remote get-url origin)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q --depth 1 "$REMOTE" "$TMP/repo"
cd "$TMP/repo"
git checkout -q --orphan gh-pages
git rm -rq --cached . >/dev/null
find . -maxdepth 1 -mindepth 1 ! -name '.git' -exec rm -rf {} +

cp -r "$ROOT/site/." .
mkdir -p screenshots && cp "$ROOT"/docs/screenshots/*.png screenshots/
touch .nojekyll
printf 'node_modules/\n' > .gitignore   # garde-fou, même si rien ne devrait l'exiger ici

git add -A
echo "--- publication ---"
git diff --cached --name-only | sed 's/^/  /' | head -12
echo "  ... $(git diff --cached --name-only | wc -l) fichiers"
if git diff --cached --name-only | grep -q '^node_modules/'; then
  echo "ARRÊT : node_modules détecté dans la publication." >&2
  exit 1
fi

git commit -q -m "Manuel en ligne de Sanguine"
git push -qf origin gh-pages
echo "gh-pages publiée depuis un clone temporaire."
