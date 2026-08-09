#!/usr/bin/env bash

set -euo pipefail

readonly FORBIDDEN_LEGACY_PATTERN='@deco/|deco-cli|deco dev|deco deploy|/oauth/start|DECONFIG|DECO_CHAT'
readonly FORBIDDEN_BRANDING_PATTERN='(^|[^[:alnum:]_])deco([^[:alnum:]_]|$)'
readonly CHECK_SCRIPT='scripts/check-no-deco.sh'

cd "$(git rev-parse --show-toplevel)"

should_scan() {
  local path="$1"

  case "$path" in
    .git/*|.specstory/*|.dev.vars|plans/*|docs/superpowers/*|.worktrees/*|"$CHECK_SCRIPT")
      return 1
      ;;
    README.md|*.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.toml|*.yml|*.yaml|*.html|*.css|*.sh)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_user_visible_asset() {
  case "$1" in
    index.html|public/*|view/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

found=0
while IFS= read -r -d '' path; do
  [[ -f "$path" ]] || continue

  if should_scan "$path"; then
    if grep -nHE "$FORBIDDEN_LEGACY_PATTERN" -- "$path"; then
      found=1
    fi

    if is_user_visible_asset "$path" && grep -niHE "$FORBIDDEN_BRANDING_PATTERN" -- "$path"; then
      found=1
    fi
  fi
done < <(git ls-files -co --exclude-standard -z)

if (( found )); then
  echo "Forbidden deco references found in production files or dependency manifests." >&2
  exit 1
fi

echo "No forbidden deco references found in production files or dependency manifests."
