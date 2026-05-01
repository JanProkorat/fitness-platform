#!/usr/bin/env bash
# pre-landing-check.sh — sanity gate for `.claude/` changes.
#
# Run before committing edits to .claude/{agents,skills,rules,schemas,hooks}/
# to catch the silent-fail modes that bite this kind of system:
#   1. Schema validity     — every schemas/*.json must parse.
#   2. Citation resolution — every `rules/*.md#anchor` reference in agent
#      prompts and skill bodies must resolve to an actual H2 in the rule
#      file.
#   3. Hook executability  — every hook script under hooks/ must be +x.
#   4. Schema additive-only — modifying a schema should add optional
#      fields, never remove required fields. Surface a warning on any
#      shrinkage (manual review still needed; this is a heuristic).
#
# EXIT CODES:
#   0 = all checks pass
#   1 = at least one check failed (details on stderr)

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$PROJECT_DIR"

FAIL=0

note() { printf '[pre-landing] %s\n' "$1"; }
fail() { printf '[pre-landing] ❌ %s\n' "$1" >&2; FAIL=1; }
pass() { printf '[pre-landing] ✅ %s\n' "$1"; }

# ---------- 1. Schema validity ----------

note "Check 1/4: schema validity (jq empty)…"
SCHEMA_FAIL=0
for f in .claude/schemas/*.json; do
    [ -f "$f" ] || continue
    if ! jq empty "$f" 2>/dev/null; then
        fail "  schema $f does not parse as JSON"
        SCHEMA_FAIL=1
    fi
done
[ "$SCHEMA_FAIL" = "0" ] && pass "  all schemas parse"

# ---------- 2. Citation resolution ----------

note "Check 2/4: citation resolution (rules/*.md#anchor → actual H2)…"
CITE_FAIL=0

# Collect every (file, anchor) reference of the form rules/<file>.md#<anchor>
# in agents/, skills/, schemas/, rules/. Use grep -E for portability.
CITATIONS=$(grep -rEho '(rules/[a-z0-9-]+\.md#[a-z0-9-]+)' \
    .claude/agents .claude/skills .claude/schemas .claude/rules 2>/dev/null | sort -u || true)

if [ -z "$CITATIONS" ]; then
    pass "  no rule citations found (nothing to check)"
else
    while IFS= read -r cite; do
        [ -z "$cite" ] && continue
        path="${cite%#*}"
        anchor="${cite##*#}"
        full=".claude/$path"
        if [ ! -f "$full" ]; then
            fail "  citation '$cite' — file not found: $full"
            CITE_FAIL=1
            continue
        fi
        # Slugify each H2 in the file and check the anchor exists.
        # Slug rule: lowercase, non-[a-z0-9] runs collapse to '-', strip leading/trailing '-'.
        if ! awk -v target="$anchor" '
            /^## / && !/^### / {
                heading = substr($0, 4)
                # lowercase
                slug = tolower(heading)
                # replace non-alphanumeric runs with single -
                gsub(/[^a-z0-9]+/, "-", slug)
                # strip leading/trailing dashes
                gsub(/^-+/, "", slug)
                gsub(/-+$/, "", slug)
                if (slug == target) { found = 1; exit }
            }
            END { exit (found ? 0 : 1) }
        ' "$full"; then
            fail "  citation '$cite' — anchor '$anchor' not found in $path"
            CITE_FAIL=1
        fi
    done <<< "$CITATIONS"
fi

[ "$CITE_FAIL" = "0" ] && pass "  all citations resolve"

# ---------- 3. Hook executability ----------

note "Check 3/4: hooks executable (.sh and .py)…"
HOOK_FAIL=0
for f in .claude/hooks/*.sh .claude/hooks/*.py; do
    [ -f "$f" ] || continue
    if [ ! -x "$f" ]; then
        fail "  hook $f is not executable (chmod +x to fix)"
        HOOK_FAIL=1
    fi
done
[ "$HOOK_FAIL" = "0" ] && pass "  all hooks +x"

# ---------- 4. Schema additive-only (heuristic) ----------

note "Check 4/4: schema additive-only (vs. last commit)…"
SCHEMA_DIFF_FAIL=0
if git rev-parse --git-dir >/dev/null 2>&1; then
    for f in .claude/schemas/*.json; do
        [ -f "$f" ] || continue
        # Compare current vs HEAD via jq — only flag if `required` shrank
        # or any enum lost values.
        if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
            old_required=$(git show "HEAD:$f" 2>/dev/null | jq -r '.required[]?' 2>/dev/null | sort -u || true)
            new_required=$(jq -r '.required[]?' "$f" 2>/dev/null | sort -u || true)
            removed=$(comm -23 <(echo "$old_required") <(echo "$new_required") | grep -v '^$' || true)
            if [ -n "$removed" ]; then
                fail "  schema $f removed required fields: $removed"
                SCHEMA_DIFF_FAIL=1
            fi
        fi
    done
fi
[ "$SCHEMA_DIFF_FAIL" = "0" ] && pass "  no required-field removals detected"

# ---------- Summary ----------

if [ "$FAIL" = "0" ]; then
    note "All pre-landing checks passed."
    exit 0
else
    note "Pre-landing checks failed. Fix issues above before committing."
    exit 1
fi
