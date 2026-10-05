---
name: dotnet-tdd
description: Test-first flow for this backend's FastEndpoints endpoints — failing integration test, minimal implementation, then one test per failure path at the cheapest layer, refactor, review. Use on "TDD", "red-green-refactor", test-first, or regression-then-fix.
argument-hint: "<Area> <endpoint description>"
---

# TDD Workflow

**Iron law:** the failing test is written *before* the code it tests.

Red → Green → Refactor: one failing test, minimum code to pass, cleanup while
green. `rules/testing.md` decides which layer each case belongs to; this
skill only gives the order of work. Where they disagree, the rule wins.

## When to use

- Adding an endpoint test-first.
- Reproducing a bug with a failing test, then fixing it.
- User says "TDD", "red-green-refactor", "test-first".

## When not to use

- Scaffolding without test-first → `dotnet-feature`.
- Pure convention check → `dotnet-review`.

## Required rules

Read before writing — nothing under `rules/` loads itself:

- `rules/testing.md` — all of it: layers, authorization, validation, builders, isolation, running tests.
- `skills/dotnet-tdd/references/testing-conventions.md` — the concrete test types (`TestActors`, `FitnessApiFactory`, `MockDbBuilder`, `EndpointTestHelpers`).
- `rules/validation.md#testing-validators` — `TestValidate`, assert on `ErrorCode`/`ErrorMessage`.
- `rules/naming.md#test-naming` — `{Method}_{StateUnderTest}_{ExpectedBehavior}`.
- `rules/api-design.md` — the endpoint shape under test.
- `rules/error-handling.md#send-for-expected-errors` — which status/code each failure returns.

## Cycle

```
RED → GREEN → REFACTOR → REVIEW
```

One test case per tick — not the whole endpoint.

## Running tests

Always scope a run to the class you are working on:

```bash
dotnet test backend/FitnessPlatform.Tests/FitnessPlatform.Tests.csproj -- --filter-class "FitnessPlatform.Tests.Endpoints.{Area}.{Action}EndpointTests"
```

Plain `dotnet test --filter …` is silently ignored and runs the whole suite
(`rules/testing.md#running-tests`). Check the reported count matches the
class — a count in the thousands means the filter did nothing.

## Step 1 — RED

- Pick the simplest success case (create: 201; read: 200 with the expected body).
- Write it as an **integration** test: `[Collection(TestCollection.Name)]`,
  `FitnessApiFactory`, actors from `TestActors` (shape in
  `references/testing-conventions.md#collection-attribute`).
- Run the scoped command. It must fail — compile error or 404/405. **Do not implement until RED.**

## Step 2 — GREEN

Hand off to `dotnet-feature` for the slice. Implement only what this test needs:

1. `{Action}Request.cs`
2. `{Action}Response.cs` (if the endpoint returns a body)
3. New EF entity → `dotnet-migrate` (generate and read `Up()`, never apply); new Mongo root document → `mongo-document`
4. `{Action}Endpoint.cs`

Rerun the scoped test until GREEN.

## Step 3 — failure cases, one at a time

Add each at the cheapest layer that proves it (`rules/testing.md#what-each-layer-is-for`):

1. **Validator rules** — one `TestValidate` test per rule and boundary, in `{Action}ValidatorTests`.
2. **Validation is wired** — exactly one 400 test on the endpoint (`rules/testing.md#validation`).
3. **Ownership / link / capability** — a 404 or 403 test for every check the endpoint makes itself (`rules/testing.md#authorization`).
4. **Not found** — 404 for a missing entity.
5. **Business state** — 409 (or the coded error) per rule.
6. **Persisted state** — integration test asserting what was stored, not just the status.

Do **not** write "no auth → 401" or "wrong role → 403" tests. The
architecture test covers every endpoint's `Roles(...)` declaration.

Each case: RED → GREEN. A new test that is green on first run is not
exercising the code you think — fix the test first.

## Step 4 — REFACTOR

Clean up without changing behaviour:

- Extract private methods once `HandleAsync` passes ~50 lines (`rules/api-design.md#endpoint-pattern`).
- Three or more guards → a `Load{Entity}OrRespondAsync` helper (`rules/api-design.md#extract-guards-when-many`).
- `AsNoTracking()` on EF reads; XML `/// <summary>` docs; remove scaffolding comments.

Rerun the scoped class after each change. Red → revert, take a smaller step.

## Step 5 — REVIEW

Run `dotnet-review` on the diff. Apply its critical fixes, rerun the scoped class.

## Step 6 — final verification

Run `dotnet-verify`. If you are a dev sub-agent, report your scoped runs and
leave the full suite to the main thread, which owns that gate.

## Don't

- Don't write the endpoint first and the test second — you lose the proof the test can fail.
- Don't write every test up front — you lose the per-case RED/GREEN signal.
- Don't mock the database in an integration test; that is what the containers are for.
- Don't rely on a Mongo mock for filter behaviour — `MockMongoBuilder` ignores filters.
- Don't assert only `NotBeNull()` — assert the outcome (`rules/testing.md#assertions`).
- Don't test private methods — go through the endpoint.

## Done when

- [ ] The scoped class is green, run with `-- --filter-class`, and its count matches the class.
- [ ] Every ownership/link/state check has a failing-path test; validator rules are covered by `TestValidate`; one 400 test proves validation is wired.
- [ ] No per-endpoint 401/403-by-role tests were added.
- [ ] `dotnet-verify` passed (or the full suite is handed to the main thread).
- [ ] `dotnet-review` run; critical findings resolved.
