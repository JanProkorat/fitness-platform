---
description: Guidelines for authoring JSON Schemas under .claude/schemas/
---

# Schema Review Guideline

Applies to `.claude/schemas/*.json`. A bad schema can let malicious payloads through or crash `validate.py`.

## Regex safety — ReDoS prevention

`validate.py` uses Python `re` (no timeout). For every `pattern`:

- **No nested quantifiers** on growable spans — `(a+)+`, `(.*)*`, `(a|a)*` cause catastrophic backtracking.
- **Anchor** with `^` and `$` whenever the field matches the whole string. `re.search` otherwise scans — adversary prepends a long non-matching run, run time explodes.
- **Bound repetition** — `{1,200}` over `*`/`+` for user-controlled text. Per-field `maxLength` beats relying on the global `MAX_PATTERN_INPUT_LEN` cap (10 000).
- **Prefer character classes** over alternation for single characters: `[A-Za-z0-9]` beats `(A|B|C|...)`.

## Length caps

`maxLength` on every free-text field — uncapped `notes` bloats pipeline.json and logs. Default: 2 000 for narrative, 200 for identifiers.

## Enum vs. pattern

Finite value set → `enum`, not `pattern`. O(1) compares, cannot ReDoS, self-documenting.

## Structured over stringly-typed

Fields substituted into shell commands, file paths, or URLs → model as objects with typed fields (e.g. `{ "tool": "dotnet-test", "filter": "..." }`), not free strings. Consumer builds the final string from a template — eliminates the "string from attacker → shell" path.

## additionalProperties

Every object schema → `"additionalProperties": false` unless forward-compat requires otherwise. Catches typos (`depedns_on`) and prevents drift between conductor writes and what the schema permits.

## Format strings

`validate.py` allowlists `format` validators (currently `date-time`). Unknown formats pass silently — verify your format is in `FORMAT_VALIDATORS` and add it there first if missing.

## Checklist

- [ ] All patterns anchored (`^...$`) when matching the whole value.
- [ ] No nested/unbounded quantifiers.
- [ ] `maxLength` on every free-text field.
- [ ] `additionalProperties: false` on every object (or documented reason).
- [ ] Enum used wherever the value set is finite.
- [ ] No free string that will be shell-executed, URL-fetched, or file-pathed — use a structured object + template.
- [ ] Examples validate against the schema itself (`validate.py` exercises this when `$schema` points to the file).
