# Review Checklist

Walk every section on every review. Each item names the rule anchor to cite.
The rule files are the source of truth — if an item here disagrees with one,
the rule wins; fix this file.

**[ASPIRATIONAL] items are never findings against existing code.** Several
rules mark a direction for new code that most of the codebase does not follow
yet (`internal sealed`, `TimeProvider`, `DontCatchExceptions()`). Flag them
only on code the diff adds, and at most as a nit.

## 1. Architecture (`rules/architecture.md`)

- [ ] Slice lives in `Features/{Area}/{Action}/`; shared DTOs and error tables in the area's `Shared/` (#vertical-slice-layout)
- [ ] No `{Feature}FeatureConfiguration`, `Commands/`/`Queries/` split or `Errors/` folder (#vertical-slice-layout)
- [ ] Feature logic stays in `HandleAsync` — no per-feature service or handler type (#no-horizontal-layers)
- [ ] No import from another `Features/{Area}` namespace; shared code goes to `Domain/` (#no-horizontal-layers)
- [ ] No AutoMapper/Mapster, MediatR, repository wrappers or `#region` (#banned-patterns)
- [ ] One type per file; file name matches type (`rules/naming.md#files-and-types`)

## 2. API design (`rules/api-design.md`)

- [ ] `Configure()` order: verb + absolute route, `Roles(...)`/`AllowAnonymous()`, optional `DontCatchExceptions()`, `Summary(...)` (#configure-structure)
- [ ] `Summary` has a `Responses[...]` entry for every status the endpoint returns (#configure-structure)
- [ ] `Roles(AppRoles.X, …)` varargs form — never a string literal, never `Policies(...)` (#authorization)
- [ ] Endpoints touching a specific client's data check the live link/capability, not just the role (#authorization)
- [ ] `AllowAnonymous()` only when intentionally public, and `Summary` says why (#authorization)
- [ ] Endpoint class name is unique across the assembly and domain-prefixed (#endpoint-names)
- [ ] No request type with zero properties — use `EndpointWithoutRequest` (#empty-request-dtos-crash-at-boot)
- [ ] Route: leading slash, domain prefix, kebab-case segments, PascalCase parameter matching the request property (#routes)
- [ ] `Send.*Async(ct)` API, followed by `return;` in guard branches; `Send.ForbiddenAsync`, not `ForbidAsync` (#send-pattern)
- [ ] 3+ guards before the real work → extracted `Load{Entity}OrRespondAsync` helper (#extract-guards-when-many)

## 3. Error handling (`rules/error-handling.md`)

- [ ] Expected failures write a response: bare `Send.*Async`, `this.SendProblemAsync(...)`, or `this.ThrowErrorWithCode(...)` (#send-for-expected-errors)
- [ ] No `Send.ErrorsAsync` (0 uses here) (#send-for-expected-errors)
- [ ] No custom or `KeyNotFoundException`-style throws for expected errors (#no-exceptions-for-control-flow)
- [ ] No `try/catch` around infrastructure calls unless the failure is recoverable and logged (#exceptions-for-infrastructure)
- [ ] A client branching on a `SendProblemAsync` code actually reads the top-level `errorCode` (#send-for-expected-errors)

## 4. Validation (`rules/validation.md`)

- [ ] Body or non-trivial params → a validator inheriting FastEndpoints' `Validator<T>`, not `AbstractValidator<T>` (#validator-class)
- [ ] Validator accessibility matches the surrounding slice (#validator-class)
- [ ] Domain-constraint rules carry `.WithErrorCode(ErrorCodes.X)` + `.WithMessage(...)`; plain shape checks need not (#validator-class)
- [ ] Error codes are constants on the flat `ErrorCodes` class with `SCREAMING_SNAKE_CASE` values; existing codes not renamed (#error-codes)
- [ ] Validator checks shape only; existence, ownership and state checks live in the endpoint (#what-goes-where)
- [ ] Enum request properties validated with `IsInEnum()` on new rules (#no-magic-strings)

## 5. Naming (`rules/naming.md`)

- [ ] `{Action}Endpoint`, `{Action}Request`, `{Action}Response`, `{Action}Validator` (#file-naming-patterns)
- [ ] `Shared/` holds `{Name}Dto` and `{Feature}Errors` (#file-naming-patterns)
- [ ] Migration names are present-tense `{Verb}{Target}` (#migrations)
- [ ] Tests named `{Method}_{StateUnderTest}_{ExpectedBehavior}` (#test-naming)
- [ ] Locals have descriptive names — only the listed exceptions (`ct`, `req`, `db`, `mongo`, lambda params…) (#local-variable-naming)

## 6. EF Core (`rules/ef-core.md`)

- [ ] New entity inherits `BaseEntity` / `TimestampableEntity` / `PublicTimestampableEntity`; does not redeclare `Id` (#entities, #primary-keys)
- [ ] New entity registered as a `DbSet` (#dbset-registration)
- [ ] `long Id` never in a response — `PublicId` / `ExternalId` instead (#primary-keys)
- [ ] Read queries use `AsNoTracking()` and prefer `Select` projections (#asnotracking, #projections)
- [ ] No N+1 — no `Find`/`FirstOrDefault` inside a loop (#n-plus-one)
- [ ] New enum columns default to integer; **any global enum conversion or `AlterColumn` on an untouched table is critical** (#enum-storage)
- [ ] Migration `Up()` read and free of unintended destructive operations (#migrations)
- [ ] `DateTime` timestamps are the norm — not a finding (#date-types)

## 7. C# style (`rules/csharp-style.md`)

- [ ] Primary constructors for DI (#primary-constructors)
- [ ] Responses are plain classes with `{ get; set; }` and a `FromDocument`/`FromEntity` factory — not records (#records-for-dtos)
- [ ] New time-dependent endpoint code injects `TimeProvider` — [ASPIRATIONAL], nit on new code only; never in validators (#timeprovider)
- [ ] Braces on every `if`/`else`/loop; guard + early return (#guard-clauses)
- [ ] No bare property alias used ≤2 times (#no-intermediate-variable-aliases)
- [ ] `CancellationToken ct` last and forwarded to every async call (#async-await)
- [ ] XML `/// <summary>` on public/internal members; `<inheritdoc />` on `Configure`/`HandleAsync` (#xml-documentation)
- [ ] No `#region`; comments in English (#no-regions, #comments)

## 8. Testing (`rules/testing.md`)

- [ ] Each behaviour tested once, at the cheapest layer that proves it (#what-each-layer-is-for)
- [ ] Every ownership/link/capability check has a 403 or 404 test (#authorization)
- [ ] **No** new per-endpoint "no auth → 401" or "wrong role → 403" tests (#authorization)
- [ ] Validator rules covered by `TestValidate`, asserting `ErrorCode`/`ErrorMessage`, not `PropertyName`; one 400 test per endpoint (#validation, `rules/validation.md#testing-validators`)
- [ ] Integration classes use `[Collection(TestCollection.Name)]` + `FitnessApiFactory`; no factory or container per test class (#containers-and-isolation)
- [ ] Actors from `TestActors`; only the data the test asserts on; no copied helpers (#test-data-small-builders-not-big-setup)
- [ ] Unique data per test; list/search assertions filtered to the test's own rows; exact-count assertions clear the collection first (#containers-and-isolation)
- [ ] Assertions check the outcome, not just `NotBeNull()` (#assertions)
- [ ] `TestContext.Current.CancellationToken` on async calls
- [ ] Any reported scoped run used `-- --filter-class`, not `--filter` (#running-tests)

## Common false positives

- Existing `public class` endpoints/validators, `DateTime.UtcNow`, missing `DontCatchExceptions()` — inherited debt, not introduced by the diff.
- `Description(b => b.WithName(...))` on the MealTemplates/SessionTemplates slices — redundant but harmless.
- The two lowercase error codes (`social_email_conflict`, `session_locked`) — known drift; renaming them breaks clients.
- Issue numbers in code comments — established practice (`rules/csharp-style.md#comments`).
- `WorkoutTemplate` not implementing `ILibraryDocument` — deliberate (`rules/architecture.md#workouttemplate-is-outside-the-library-contract`).
