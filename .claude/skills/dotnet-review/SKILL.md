---
name: dotnet-review
description: Review .NET backend code against conventions — architecture, API design, error handling, validation, naming, EF Core, C# style, tests. Use before commit, PR, or on "convention check"/"am I doing this right?".
---

# Code Review

Review recently-changed or user-specified C# backend code against every convention. Report: violation → rule broken → corrected code → offer to apply.

## When to use
- Before commit or PR.
- User asks for review, convention check, or "am I doing this right?" in a .NET context.

## When not to use
- Writing new code → `/dotnet-feature` or `/dotnet-tdd`.
- Debugging a known bug → `/dotnet-debug`.

## Required rules

Load every rule file at invocation — findings without a cited rule are opinions. Nothing under `rules/` loads itself, enumerate explicitly:

- `rules/architecture.md` — vertical slice, banned patterns, horizontal layers.
- `rules/api-design.md` — FastEndpoints REPR, `Configure()`, `Send.*`.
- `rules/error-handling.md` — `Send.*Async(ct)` for expected errors; no exceptions for control flow.
- `rules/validation.md` — FluentValidation rules, `.WithErrorCode(...)`.
- `rules/naming.md` — files, types, endpoints, routes, error codes, tests.
- `rules/ef-core.md` — `DbContext` injection, `AsNoTracking`, `N+1`, indexes.
- `rules/csharp-style.md` — XML docs, primary constructors, response classes, `TimeProvider`.
- `rules/testing.md` — test layers, authorization tests, isolation, scoped runs.
- `skills/dotnet-tdd/references/testing-conventions.md` — the concrete test types.

Many rules carry **[ASPIRATIONAL]** sections: a direction for new code, never a
finding against existing code. Read the label before filing.

## Scope

Unless user specifies otherwise:
1. `git diff HEAD` — staged + unstaged.
2. Any file the user names.

Small diffs: full pass. Large diffs: prioritise by severity (critical architecture/security first, then style).

## How to review

Walk every section of `references/review-checklist.md`. For each finding capture:

- **File + line**
- **Rule broken** — which rule file + section
- **Found** (code snippet)
- **Fix** (code snippet)
- **Severity** — critical / warning / nit

| Severity | Examples |
|----------|----------|
| Critical | Missing `Roles(...)`, role check without a link/ownership check, `long Id` in a response, duplicate endpoint class name, empty request DTO, destructive or unintended migration, exception for control flow |
| Warning | Missing `AsNoTracking()` on read, `Summary` missing a returned status, missing `.WithErrorCode()` on a domain rule, missing 403/404 test for an ownership check, missing XML docs |
| Nit | Cosmetic, or an [ASPIRATIONAL] item on new code (`internal sealed`, `TimeProvider`, `DontCatchExceptions()`) |

## Report format

```
# Code Review

## Summary
- Files reviewed: N
- Findings: N critical, N warnings, N nits

---

## Warnings

### 1. [ef-core.md#asnotracking] Missing AsNoTracking on read query
**File:** Features/ClientMeasurements/{Action}/{Action}Endpoint.cs:<line>  (format example, not a real finding)
**Found:**
    var measurement = await db.BodyMeasurements.FirstOrDefaultAsync(m => m.ClientProfileId == profileId, ct);
**Fix:**
    var measurement = await db.BodyMeasurements.AsNoTracking().FirstOrDefaultAsync(m => m.ClientProfileId == profileId, ct);

---

## Passing
- Architecture: slice under Features/{Area}/{Action}/, logic in HandleAsync
- Naming: conventions followed throughout
- Validation: shape in the validator, ownership and state in the endpoint
```

After report, ask whether to apply critical fixes. Do not apply silently.

## Source of truth

Every finding cites a rule file and anchor (`architecture.md`, `api-design.md`, `error-handling.md`, `validation.md`, `naming.md`, `ef-core.md`, `csharp-style.md`, `testing.md`). If you can't name the rule, it's opinion — say so.

## Escalation to user

- **Ambiguous cases** (e.g., a helper in the slice vs `Domain/Services/`) → ask.
- **Pre-existing violations** in untouched code → list as "observed, not introduced by this change".
- **Rule conflicts** → surface both interpretations, let user pick.

## Don't

- Don't invent a rule — cite one.
- Don't apply critical fixes silently.
- Don't mix pre-existing violations with diff-introduced findings.

## Done when

- [ ] Every section of `references/review-checklist.md` walked.
- [ ] Report produced in the format above (summary + findings + passing).
- [ ] Each finding cites a rule file + section.
- [ ] User asked whether to apply critical fixes.
