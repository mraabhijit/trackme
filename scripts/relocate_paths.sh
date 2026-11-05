#!/usr/bin/env bash
# Run once from the project root after unpacking the source bundle:
#   bash scripts/relocate_paths.sh
# The tests were written in a sandbox that used /home/claude/journable; this points them at this checkout.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
grep -rIl "/home/claude" "$ROOT/tests" "$ROOT/scripts" 2>/dev/null | grep -v relocate_paths.sh | while read -r f; do
  sed -i "s#/home/claude/journable#$ROOT#g; s#/home/claude/diet-tracker.html#$ROOT/tests/fixtures/diet-tracker.html#g" "$f"
done
echo "paths now point at $ROOT"
