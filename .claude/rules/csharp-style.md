---
description: C# style rules for .NET 10 / C# 14 backend code
---

# C# Style Rules

## Language version

.NET 10 / C# 14. In each `csproj` (or `Directory.Build.props`): `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`, `<LangVersion>latest</LangVersion>`.

Use modern features freely: primary constructors, collection expressions, `field` keyword, pattern matching, records, raw string literals, target-typed `new(...)`.

## Primary constructors

YES for DI and simple init. NO for validation, conditional setup, multiple ctors, or >2 statements. Cannot declare instance fields — non-parameter fields go on the class body (see rules/api-design.md#feature-configuration-field).

```csharp
internal sealed class CreateOrderEndpoint(
    AppDbContext dbContext) : Endpoint<CreateOrderRequest, CreateOrderResponse>
{
    private static readonly OrdersFeatureConfiguration FeatureConfiguration = new();
}
```

## Records for dtos

`record` for immutable response/shared DTOs:
`readonly record struct` for small value objects: `internal readonly record struct OrderId(Guid Value);`.

## Sealed internal

Endpoints, validators, feature configurations, and most concrete classes are `internal sealed`. Prefer `internal` over `public` unless the type is part of an API contract.

## Timeprovider

Always use the injected `TimeProvider`. Anti-patterns: `DateTime.UtcNow` / `DateTime.Now` / `DateTime.Today`; custom `IDateTimeProvider`.

In tests: register `AdjustableTimeProvider` (project-local, in `Tests.Integration/Infrastructure/`) pinned to a fixed date. It supports both `Advance(TimeSpan)` and `SetUtcNow(DateTimeOffset)` including backward jumps — use it instead of `FakeTimeProvider` from `Microsoft.Extensions.TimeProvider.Testing`.

## Guid primary keys

See `rules/ef-core.md#primary-keys`.

## Target typed new

`new()` when type is on the LHS:

```csharp
List<OrderDo> orders = new();
Dictionary<Guid, string> map = new();
var orders = new List<OrderDo>();  // OK — var with new Type()
```

Anti-pattern: `List<OrderDo> orders = new List<OrderDo>();` — redundant type.

## Expression bodied

`=>` for single-expression members. NO for multi-statement bodies.

```csharp
public static Error NotFound(Guid id) =>
    Error.NotFound(ErrorCodes.OrderNotFound, $"Order {id} not found.");

private static bool IsActive(OrderDo o) => o.Status == OrderStatus.Pending;
public string FullName => $"{FirstName} {LastName}";
```

## Guard clauses

Guard + early return. No deep nesting, no long `else` chains.

**Formatting (mandatory):**

- A multi-statement `if` body (2+ statements) **must** span multiple lines with braces on their own lines.
- One-line `if (cond) { stmt; stmt; }` is forbidden.
- An `if` without braces is forbidden **always**, even for a single statement. Same rule for `else`, `for`, `while`, `foreach`, `using`.

```csharp
// YES
if (order is null)
{
    await Send.NotFoundAsync(ct);
    return;
}

await Send.OkAsync(ToResponse(order), ct);

// YES — single-statement body still uses braces
if (cache is MemoryCache memoryCache)
{
    memoryCache.Compact(1.0);
}

// NO — two statements on one line
if (order is null) { await Send.NotFoundAsync(ct); return; }

// NO — no braces, even for a single statement
if (cache is MemoryCache mc)
    mc.Compact(1.0);
```

## No intermediate variable aliases

A local `var` MUST NOT be a bare alias of a property or field read (e.g. `var x = req.X`) when it is used **2 or fewer times**. Use the source expression directly.

- A property/field alias used **3+ times** is OK
- This rule applies only to **direct property/field reads**. Any non-trivial right-hand side is always OK to capture, regardless of usage count: method results (`var year = ParseYear(...)`), async calls (`await using var transaction = await dbContext.Database.BeginTransactionAsync(ct)`), parsing, computations, or LINQ chains.

```csharp
// NO — property or boolean alias used <=2
var scope = req.Scope;
if (scope == PeriodScope.Week) 
{ /* ... */ }
var isWeekly = scope == PeriodScope.Week;
Week? week = isWeekly ? GetWeek() : null;

// YES — used directly
if (req.Scope == PeriodScope.Week) 
{ /* ... */ }

Week? week = req.Scope == PeriodScope.Week ? GetWeek() : null;

// YES — non-alias right-hand side (method call, async, parse)
await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
```

## Nullable reference types

NRT enabled. `?` for intentionally nullable references:

```csharp
public string? Note { get; set; }                     // optional
public string Email { get; set; } = string.Empty;     // non-nullable
var name = user?.FullName ?? "Unknown";
```

## Xml documentation

`/// <summary>` on ALL `public` and `internal` members in ALL projects. Omit for trivial accessors.

**Multi-line is the preferred form** for any non-trivial member: `/// <summary>`, content, `/// </summary>` on separate lines.

```csharp
/// <summary>
/// Email recipient options loaded from configuration.
/// </summary>
private EmailRecipientsOptions EmailRecipientsOptions { get; } = options.Value;
```

When touching a file that already uses single-line `<summary>` for a member, leave it as-is.

## Async await

- `CancellationToken ct` as last parameter on async methods; forward `ct` to every async call.

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

## Method ordering

Inside a class, methods are grouped by accessibility in this order:

1. `public`
2. `internal`
3. `private`

Within a group, order top-down (e.g. `Configure` before `HandleAsync`; entry-point before helpers).

## No regions

Never `#region` / `#endregion`. Organize through well-named methods and small classes; one type per file (rules/architecture.md#one-type-per-file) keeps files small.
