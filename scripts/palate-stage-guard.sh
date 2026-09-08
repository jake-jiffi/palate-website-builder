#!/usr/bin/env bash
# scripts/palate-stage-guard.sh - refuse to commit a working directory into a client's repo.
#
# ============================== WHY THIS EXISTS ==============================
#
# Ignores are the first defence and they only ever cover paths somebody thought of. An
# adoption run staged 874 MB of screenshots from a directory that had no rule yet, and
# nothing else stood between it and the client's repository. This is the second defence and
# it works on SIZE alone, so a directory nobody predicted is still caught.
#
# TWO LIMITS, deliberately different. One enormous file is usually a mistaken asset (a raw
# video, an unoptimised export) and 5 MB is generous for anything a site should carry. A
# DIRECTORY over 50 MB is the leak this exists for: 249 screenshots, none of them individually
# remarkable, which no per-file limit would ever catch.
#
# It reads the STAGED tree, not the working tree, because that is what the next commit will
# contain. A deletion has no size and is skipped; a file staged and then removed from disk
# cannot be measured and is NAMED rather than passed over, because a guard that silently
# skips what it cannot read is the failure mode this repo has paid for repeatedly.
#
# Exit codes: 0 clean, 1 refused (with the offenders named), 2 skipped with a printed reason.
#
# Usage: palate-stage-guard.sh [repo-dir]     (default: cwd)
set -uo pipefail

DIR="${1:-.}"
FILE_MB="${PALATE_MAX_STAGED_FILE_MB:-5}"
DIR_MB="${PALATE_MAX_STAGED_DIR_MB:-50}"

root="$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$root" ]; then
  echo "palate-stage-guard: $DIR is not a git repository, so there is no staged tree to inspect. NOT a pass." >&2
  exit 2
fi

# --diff-filter=ACMR: added, copied, modified, renamed. A deletion stages no content.
staged="$(git -C "$root" diff --cached --name-only --diff-filter=ACMR 2>/dev/null)"
if [ -z "$staged" ]; then
  echo "palate-stage-guard: nothing is staged (no added or modified files), so nothing was inspected. NOT a pass." >&2
  exit 2
fi

# The size of the CONTENT that will be committed. `git cat-file -s :path` reads the staged
# blob, so a file edited after `git add` is still measured as what the commit will hold.
report="$(
  cd "$root" || exit 2
  printf '%s\n' "$staged" | while IFS= read -r f; do
    [ -n "$f" ] || continue
    if size="$(git cat-file -s ":$f" 2>/dev/null)"; then
      printf '%s\t%s\n' "$size" "$f"
    else
      printf 'UNREADABLE\t%s\n' "$f"
    fi
  done | awk -F'\t' -v file_mb="$FILE_MB" -v dir_mb="$DIR_MB" '
    BEGIN { mb = 1048576; file_max = file_mb * mb; dir_max = dir_mb * mb }
    $1 == "UNREADABLE" { unreadable[++u] = $2; next }
    {
      n++; total += $1
      if ($1 > file_max) big_file[$2] = $1
      # Charge the bytes to EVERY ancestor directory. A leak shows up as one directory that
      # has quietly grown, and which level of the tree it sits at is not knowable in advance.
      p = $2
      while (1) {
        cut = 0
        for (k = length(p); k >= 1; k--) if (substr(p, k, 1) == "/") { cut = k; break }
        if (cut == 0) break
        p = substr(p, 1, cut - 1)
        dir_total[p] += $1
      }
    }
    END {
      printf "INSPECTED\t%d\t%d\n", n, total
      for (f in big_file) printf "FILE\t%s\t%d\n", f, big_file[f]
      for (d in dir_total) if (dir_total[d] > dir_max) printf "DIR\t%s\t%d\n", d, dir_total[d]
      for (i = 1; i <= u; i++) printf "UNREADABLE\t%s\t0\n", unreadable[i]
    }
  '
)"

human() { awk -v b="$1" 'BEGIN { printf "%.1f MB", b / 1048576 }'; }

count="$(printf '%s\n' "$report" | awk -F'\t' '$1=="INSPECTED"{print $2}')"
bytes="$(printf '%s\n' "$report" | awk -F'\t' '$1=="INSPECTED"{print $3}')"
offenders="$(printf '%s\n' "$report" | awk -F'\t' '$1=="FILE" || $1=="DIR" || $1=="UNREADABLE"')"

if [ -z "$offenders" ]; then
  echo "palate-stage-guard: $count staged file(s), $(human "${bytes:-0}") in total. Under the ${FILE_MB} MB per-file and ${DIR_MB} MB per-directory limits."
  exit 0
fi

echo "palate-stage-guard: REFUSED. $count staged file(s), $(human "${bytes:-0}") in total." >&2
printf '%s\n' "$offenders" | sort -t"$(printf '\t')" -k3,3nr | while IFS="$(printf '\t')" read -r kind path size; do
  case "$kind" in
    FILE) echo "  file  $path is $(human "$size"), over the ${FILE_MB} MB limit." >&2 ;;
    DIR)  echo "  dir   $path holds $(human "$size") of staged content, over the ${DIR_MB} MB limit." >&2 ;;
    UNREADABLE) echo "  ????  $path is staged but its blob could not be read, so it was NOT measured." >&2 ;;
  esac
done
echo "Unstage it (git restore --staged <path>), add the rule to .gitignore, and run scripts/palate-gitignore.sh so the next build is covered too. PALATE_MAX_STAGED_FILE_MB / PALATE_MAX_STAGED_DIR_MB raise the limits when a large file genuinely belongs in the repo." >&2
exit 1
