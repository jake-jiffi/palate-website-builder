#!/usr/bin/env bash
# scripts/ux-lint.sh - the deterministic aesthetic gate.
#
# Parses references/anti-patterns.md and runs each rule's PCRE pattern against
# the project files matching its `Files` glob. This is the aesthetic
# counterpart to verify-is-real-astro.sh (which is structural): a single hard
# gate that mechanically enforces house style, banned fonts / gradients, AI
# tells in copy, and the Vercel-derived code-level rules.
#
# Usage:
#   scripts/ux-lint.sh [project-dir]
#                      [--rules <file>]
#                      [--fail-on Critical|High|Medium|Cosmetic]   (default High)
#                      [--severity Critical|High|Medium|Cosmetic]  (display threshold, default Medium)
#                      [--mode always|variant-time|compose-time|production]
#                      [--disable rule-id,rule-id]
#                      [--ci]
#
# Exit codes:
#   0 - clean (no findings at or above --fail-on)
#   1 - findings at or above --fail-on
#   2 - internal error (bad args, missing rules, missing perl)
#
# Per-line escape: add `ux-lint-disable <rule-id>` as a comment on the same or
# preceding line. `ux-lint-disable-all` skips every rule for that line.
#
# Rule format is documented in references/anti-patterns.md.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_FILE="${SCRIPT_DIR}/../references/anti-patterns.md"
PROJECT_DIR="."
FAIL_ON="High"
SHOW_SEVERITY="Medium"
MODE_FILTER=""
DISABLED=""
CI=0

while [ $# -gt 0 ]; do
  case "$1" in
    --rules)    RULES_FILE="$2"; shift 2 ;;
    --fail-on)  FAIL_ON="$2"; shift 2 ;;
    --severity) SHOW_SEVERITY="$2"; shift 2 ;;
    --mode)     MODE_FILTER="$2"; shift 2 ;;
    --disable)  DISABLED="$2"; shift 2 ;;
    --ci)       CI=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*) echo "ux-lint: unknown flag $1" >&2; exit 2 ;;
    *)  PROJECT_DIR="$1"; shift ;;
  esac
done

[ -f "$RULES_FILE" ]  || { echo "ux-lint: rules not found at $RULES_FILE" >&2; exit 2; }
[ -d "$PROJECT_DIR" ] || { echo "ux-lint: project dir not found at $PROJECT_DIR" >&2; exit 2; }
command -v perl >/dev/null 2>&1 || { echo "ux-lint: perl is required" >&2; exit 2; }

severity_rank() {
  case "$1" in
    Critical) echo 4 ;;
    High)     echo 3 ;;
    Medium)   echo 2 ;;
    Cosmetic) echo 1 ;;
    *)        echo 0 ;;
  esac
}
FAIL_RANK=$(severity_rank "$FAIL_ON")
SHOW_RANK=$(severity_rank "$SHOW_SEVERITY")

# Parse the rules markdown into a TSV stream: id\tseverity\tmode\tfiles\tregex
parse_rules() {
  awk '
    function flush() {
      if (id != "" && sev != "" && files != "" && pat != "") {
        printf "%s\t%s\t%s\t%s\t%s\n", id, sev, mode, files, pat;
      }
      id=""; sev=""; mode=""; files=""; pat="";
    }
    BEGIN { id=""; sev=""; mode="always"; files=""; pat=""; }
    /^### Rule: / {
      flush();
      id = $0; sub(/^### Rule: /, "", id); gsub(/[[:space:]]+$/, "", id);
      mode = "always";
      next;
    }
    /^- Severity:/ { sev   = $0; sub(/^- Severity:[[:space:]]*/, "", sev);   gsub(/[[:space:]]+$/, "", sev);   next; }
    /^- Mode:/     { mode  = $0; sub(/^- Mode:[[:space:]]*/, "", mode);     gsub(/[[:space:]]+$/, "", mode);  next; }
    /^- Files:/    { files = $0; sub(/^- Files:[[:space:]]*/, "", files);   gsub(/[[:space:]]+$/, "", files); next; }
    /^- Pattern: `/ {
      pat = $0;
      sub(/^- Pattern: `/, "", pat);
      sub(/`[[:space:]]*$/, "", pat);
      next;
    }
    END { flush(); }
  ' "$RULES_FILE"
}

# For a comma-separated glob list, return matching project files.
list_files() {
  local globs_csv="$1"
  local proj="$2"
  IFS=',' read -ra globs <<< "$globs_csv"
  for g in "${globs[@]}"; do
    g="$(echo "$g" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "$g" ] && continue
    if [[ "$g" == */* ]]; then
      local fglob="${g//\*\*/*}"
      find "$proj" -path "$proj/$fglob" -type f 2>/dev/null
    else
      find "$proj" -type f -name "$g" 2>/dev/null
    fi
  done | grep -v -E '/(node_modules|\.git|dist|\.astro|\.vercel|\.wrangler|\.output|_explore-archive)/' | sort -u
}

# Run one rule against one file via perl PCRE. Emits TSV: file\tline\tseverity\trule\ttext
run_rule() {
  local file="$1" rule="$2" severity="$3" regex="$4"
  perl -e '
    my ($file, $rule, $severity, $regex) = @ARGV;
    open(my $fh, "<", $file) or exit 0;
    my $rx;
    eval { $rx = qr/$regex/m; };
    if ($@) {
      print STDERR "ux-lint: bad regex in rule $rule: $@\n";
      exit 0;
    }
    my @lines = <$fh>;
    close($fh);
    for (my $i = 0; $i < @lines; $i++) {
      my $line = $lines[$i];
      next if $line =~ /ux-lint-disable\s+\Q$rule\E\b/;
      next if $i > 0 && $lines[$i-1] =~ /ux-lint-disable\s+\Q$rule\E\b/;
      next if $line =~ /ux-lint-disable-all\b/;
      if ($line =~ /$rx/) {
        chomp $line;
        $line =~ s/\t/    /g;
        printf("%s\t%d\t%s\t%s\t%s\n", $file, $i + 1, $severity, $rule, $line);
      }
    }
  ' "$file" "$rule" "$severity" "$regex" 2>&1
}

TMP=$(mktemp)
trap "rm -f $TMP" EXIT

[ "$CI" = "0" ] && printf "ux-lint: rules=%s project=%s fail-on=%s\n" \
  "$(basename "$RULES_FILE")" "$PROJECT_DIR" "$FAIL_ON" >&2

while IFS=$'\t' read -r RULE_ID SEVERITY MODE FILES_GLOB REGEX; do
  [ -z "$RULE_ID" ] && continue
  case ",$DISABLED," in *",$RULE_ID,"*) continue ;; esac
  if [ -n "$MODE_FILTER" ] && [ "$MODE" != "always" ] && [ "$MODE" != "$MODE_FILTER" ]; then
    continue
  fi
  RANK=$(severity_rank "$SEVERITY")
  [ "$RANK" -lt "$SHOW_RANK" ] && continue

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    run_rule "$f" "$RULE_ID" "$SEVERITY" "$REGEX" >> "$TMP"
  done < <(list_files "$FILES_GLOB" "$PROJECT_DIR")
done < <(parse_rules)

VIOLATIONS=$(wc -l < "$TMP" | tr -d ' ')
if [ "$VIOLATIONS" -gt 0 ]; then
  if [ "$CI" = "1" ]; then
    cat "$TMP"
  else
    while IFS=$'\t' read -r fname lineno sev rid text; do
      printf "%s:%s  [%s %s]  %s\n" "$fname" "$lineno" "$sev" "$rid" "$text"
    done < "$TMP"
  fi
fi

HIGHEST=0
while IFS=$'\t' read -r _ _ sev _ _; do
  r=$(severity_rank "$sev")
  [ "$r" -gt "$HIGHEST" ] && HIGHEST="$r"
done < "$TMP"

[ "$CI" = "0" ] && printf "ux-lint: %d finding(s) at severity %s or above\n" \
  "$VIOLATIONS" "$SHOW_SEVERITY" >&2

if [ "$HIGHEST" -ge "$FAIL_RANK" ]; then
  exit 1
fi
exit 0
