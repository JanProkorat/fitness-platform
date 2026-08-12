---
description: C# language and style rules for the FitnessPlatform backend
---

# C# Style Rules

> **Descriptive unless marked otherwise.** Counts below were measured against
> `backend/FitnessPlatform.Application` on `develop` at `dc990021` (issue
> #937). **[ASPIRATIONAL]** marks a direction for new code that most existing
> code does not follow — never a description of the codebase, and never a
> finding against existing code.

## Language version

.NET 10 / C# 14. `FitnessPlatform.Application.csproj` sets
`<TargetFramework>net10.0</TargetFramework>`, `<Nullable>enable</Nullable>`,
`<ImplicitUsings>enable</ImplicitUsings>`, `<GenerateDocumentationFile>true</GenerateDocumentationFile>`
and `<NoWarn>$(NoWarn);1591</NoWarn>`. There is no `Directory.Build.props`
and no `.editorconfig` — everything below is convention, not
analyzer-enforced.

Use modern features freely: primary constructors, collection expressions,
pattern matching, records, raw string literals, target-typed `new(...)`.

## Primary constructors

The default for dependency injection — **all 233 endpoints** use one. Also
the norm for services and validators.

NO for validation, conditional setup, multiple ctors, or >2 statements of
initialisation. A primary constructor cannot declare instance fields; put
any non-parameter field on the class body.

```csharp
public class GetPlanEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper)
    : Endpoint<GetPlanRequest, GetPlanResponse>
```

## Records for dtos

Records are used for **fixed-shape value data**, not for API responses:

- `public readonly record struct` for small value objects —
  `LinkCapabilities(bool CanViewNutritionPlans, bool CanViewTrainingPlans)`,
  `LibraryDenial(...)`.
- `public record` for seed-data entries under
  `Infrastructure/Data/MongoDb/*SeedData.cs`.

**Endpoint responses are plain classes**, not records — 159 `public class
*Response` in `Features/**` versus 0 `public record` there. A response type
carries mutable `{ get; set; }` properties (the Swagger generator and the
clients' generated types read them) plus a static factory that maps from the
document or entity:

```csharp
public class GetPlanResponse
{
    public Guid PlanId { get; set; }
    public List<MealEatenStatusDto> MealLogs { get; set; } = [];

    public static GetPlanResponse FromDocument(NutritionPlan plan, Guid clientPublicId) => new()
    {
        PlanId = plan.ExternalId,
        // ...
    };
}
```

Don't convert existing responses to records, and don't introduce one for a
new response — the `FromDocument` / `FromEntity` factory is the established
mapping seam (there is no mapping library; see
`rules/architecture.md#banned-patterns`).

## Class accessibility

For endpoints see `rules/api-design.md#class-accessibility` — `public class`
is the shipped norm (219 of 233), `internal sealed` is preferred for new
code.

Elsewhere: validators are `public class` in 107 of 113 cases; services and
helpers are `public`. **[ASPIRATIONAL]** prefer `internal sealed` for a type
that is not part of a contract another assembly consumes. Do not open a
sweep to change existing ones.

## Timeprovider

**[ASPIRATIONAL].** Current state: `DateTime.UtcNow` / `.Now` / `.Today`
appears **246 times across 138 files**; `TimeProvider` appears in **25**
places. Both are live. `TimeProvider.System` is registered as a singleton in
`Program.cs:215`, so it is injectable anywhere.

- **New time-dependent code should inject `TimeProvider`** and call
  `timeProvider.GetUtcNow()`. Shipped precedent: the `SessionTemplates`,
  `MealTemplates` and `TrainingPlanTemplates` slices all take
  `TimeProvider timeProvider` in the endpoint's primary constructor.
- **`DateTime.UtcNow` in existing code is not a finding.** Neither is it a
  finding in a **FluentValidation validator** — validators are not
  constructed through DI with a `TimeProvider`, so a "not in the past" check
  reads the clock directly (precedent: `CreateTrainingPlanValidator.cs:37`).
- Tests pass `TimeProvider.System` explicitly into the endpoint under test.
  There is **no** `AdjustableTimeProvider` and no `FakeTimeProvider` package
  in this repo — a rule citing them was removed in #937. If you need
  controllable time in a test, add a fake and document it; don't cite one
  that doesn't exist.

## Entity identity

EF entities do **not** have a `Guid Id`. See `rules/ef-core.md#primary-keys`
— the internal key is `long Id` on `BaseEntity`, and the externally-visible
identifier is `PublicTimestampableEntity.PublicId` (`Guid`). Mongo documents
use `ExternalId` (`Guid`). Never surface a `long Id` in an API response.

## Target typed new

`new()` when the type is on the LHS:

```csharp
List<OrderDo> orders = new();
var orders = new List<OrderDo>();  // OK — var with new Type()
```

Anti-pattern: `List<OrderDo> orders = new List<OrderDo>();` — redundant type.

## Expression bodied

`=>` for single-expression members. NO for multi-statement bodies.

```csharp
private static bool IsActive(OrderDo o) => o.Status == OrderStatus.Pending;
public string FullName => $"{FirstName} {LastName}";
```

## Guard clauses

Guard + early return. No deep nesting, no long `else` chains.

**Formatting (mandatory):**

- A multi-statement `if` body (2+ statements) **must** span multiple lines
  with braces on their own lines.
- One-line `if (cond) { stmt; stmt; }` is forbidden.
- An `if` without braces is forbidden **always**, even for a single
  statement. Same for `else`, `for`, `while`, `foreach`, `using`.

```csharp
// YES
if (order is null)
{
    await Send.NotFoundAsync(ct);
    return;
}

await Send.OkAsync(ToResponse(order), ct);

// NO — two statements on one line
if (order is null) { await Send.NotFoundAsync(ct); return; }

// NO — no braces, even for a single statement
if (cache is MemoryCache mc)
    mc.Compact(1.0);
```

## No intermediate variable aliases

A local `var` MUST NOT be a bare alias of a property or field read (e.g.
`var x = req.X`) when it is used **2 or fewer times**. Use the source
expression directly.

- A property/field alias used **3+ times** is OK.
- Applies only to **direct property/field reads**. Any non-trivial
  right-hand side is always fine to capture regardless of usage count:
  method results, `await` calls, parsing, computations, LINQ chains.

```csharp
// NO — property alias used <= 2
var scope = req.Scope;
if (scope == PeriodScope.Week)
{ /* ... */ }

// YES
if (req.Scope == PeriodScope.Week)
{ /* ... */ }

// YES — non-alias right-hand side
await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
```

## Nullable reference types

NRT enabled. `?` for intentionally nullable references:

```csharp
public string? Note { get; set; }                     // optional
public string Email { get; set; } = string.Empty;     // non-nullable
var name = user?.FullName ?? "Unknown";
```

## Async await

`CancellationToken ct` as the last parameter on async methods; forward `ct`
to every async call.

**Known exception:** C# requires optional parameters last, so a signature
carrying both takes `ct` before them. Shipped precedent:
`IEmailVerificationTokenService.IssueAsync(..., CancellationToken ct, bool countTowardLifetimeCap = true)`.
This is accepted, not a finding.

## Pattern matching

```csharp
if (entity is OrderDo orderDo)
{
    Process(orderDo);
}

return status switch
{
    OrderStatus.Pending => "Pending approval",
    OrderStatus.Approved => "Ready to ship",
    _ => "Unknown"
};
```

## Xml documentation

`/// <summary>` on public and internal members — the convention holds
broadly (2 756 `<summary>` blocks in `Features/**` alone). `Configure()` and
`HandleAsync()` overrides carry `/// <inheritdoc />`; a primary
constructor's parameters are documented with `/// <param name="...">` on the
class.

Note the compiler does **not** enforce this: `GenerateDocumentationFile` is
on but `NoWarn` includes `1591`, so a missing doc comment produces no
warning. Treat it as a review convention.

**Multi-line is the preferred form** for any non-trivial member. When
touching a file that already uses single-line `<summary>`, leave it as-is.

```csharp
/// <summary>
/// Retrieves a single nutrition plan with full detail.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetPlanEndpoint(IMongoContext mongo) : Endpoint<GetPlanRequest, GetPlanResponse>
```

## Method ordering

Inside a class, group by accessibility: `public`, then `internal`, then
`private`. Within a group, order top-down (`Configure` before `HandleAsync`;
entry-point before helpers).

## No regions

Never `#region` / `#endregion` — currently **0** occurrences, keep it that
way. Organise through well-named methods and small classes; one type per
file (`rules/architecture.md#one-type-per-file`) keeps files small.

## Comments

Code comments are **English only**. Referencing an issue number in a comment
(`// #840`, `/// per #877`) is established repo practice and is **not** a
finding — dozens of pre-existing occurrences on `develop`.
