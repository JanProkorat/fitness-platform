---
description: EF Core rules for entities, DbContext, and queries
---

# EF Core Rules

> Partially reconciled against the codebase in #937 — #entities,
> #primary-keys and #date-types now describe what
> `backend/FitnessPlatform.Application/Domain` actually does (measured on
> `develop` at `dc990021`). The remaining sections have not been audited
> against the code; treat them as guidance, not as verified description.

## Entities

One per file in `Domain/Entities/` (30 files), file name matches type name.
Mark non-nullable scalar fields `required`.

Inherit one of the three base classes in `Domain/Common/` — there is **no**
`AuditableEntity` type in this repo (a rule naming one was removed in #937):

| Base | Adds | Use for |
|---|---|---|
| `BaseEntity` | `long Id` (PK) | internal-only rows (`AuditLog`) |
| `TimestampableEntity` | `+ DateTime DateCreated`, `DateTime? DateUpdated` | rows with no external identity (`RefreshToken`, `InvitationToken`, `DevicePushToken`) |
| `PublicTimestampableEntity` | `+ Guid PublicId` (unique index) | anything addressable from an API route (`ClientProfile`, `Questionnaire`, `Notification`, …) |

ASP.NET Identity types are the exception — `ApplicationUser : IdentityUser<Guid>`,
`ApplicationRole : IdentityRole<Guid>`.

```csharp
public class Notification : PublicTimestampableEntity
{
    public required Guid UserId { get; set; }
    public required string Title { get; set; }
    public ApplicationUser? User { get; set; }
}
```

## Primary keys

The primary key is `long Id`, declared once on `BaseEntity` and inherited —
**do not redeclare `Id` on a derived entity**. Three entities declare their
own (`UserExternalLogin`, `PhotoDiaryReminderLog`, `SocialLoginNonce`); that
is drift, not a second pattern to copy.

`Id` is internal-only and must never appear in an API response. The
public-facing identifier is `PublicTimestampableEntity.PublicId` (`Guid`);
Mongo documents use `ExternalId` (`Guid`). See
`rules/csharp-style.md#entity-identity`.

## Dbset registration

Every new entity MUST be registered on the `DbContext`: `public DbSet<Order> Orders => Set<Order>();`.

## Dbcontext injection

See `rules/architecture.md#no-repository-pattern`.

## N plus one

Use `.Include()` / `.ThenInclude()` or `.Select(...)` for navigations. Never `.Find(...)` / `.FirstOrDefault(...)` inside a `foreach`.

```csharp
var orders = await dbContext.Orders.AsNoTracking()
    .Include(o => o.Customer)
    .Where(o => o.Status == OrderStatus.Pending)
    .ToListAsync(ct);
```

Anti-pattern: `foreach (var o in orders) { o.Customer = await dbContext.Customers.FindAsync(o.CustomerId, ct); }` — N+1.

## Indexes

FK columns always indexed. Columns used for filtering/sorting/search → indexed. Composite indexes for multi-column queries on hot paths.

```csharp
builder.HasIndex(x => x.CustomerId);
builder.HasIndex(x => new { x.Status, x.CreatedAt });
```

## Migrations

Descriptive name (rules/naming.md#migrations). Review generated SQL before committing — check for destructive ops (column drops, renames EF translates as drop+recreate).

## Enums as strings

```csharp
configurationBuilder.Properties<Enum>().HaveConversion<string>(); // globally in ConfigureConventions
```

## Asnotracking

All read-only queries MUST use `AsNoTracking()`. Omit only when updating the entity in the same request.

## Projections

Prefer `.Select(...)` to avoid loading unnecessary columns/navigations:

```csharp
var dto = await dbContext.Customers
    .AsNoTracking()
    .Where(c => c.Id == customerId)
    .Select(c => new CustomerSummaryDto(c.Id, c.Name, c.Email))
    .FirstOrDefaultAsync(ct);
```

Anti-pattern: `FindAsync(customerId)` then mapping — loads all columns.

## Date types

`DateOnly` for calendar dates; `TimeOnly` for time-of-day.

For timestamps, **`DateTime` is the shipped norm, not a violation.**
`TimestampableEntity.DateCreated` / `DateUpdated` are `DateTime`, and every
MongoDB document declares `public DateTime DateCreated`
(`NutritionPlan.cs`, `TrainingPlan.cs`, `Recipe.cs`, `Food.cs`,
`Exercise.cs`, `WorkoutTemplate.cs`, …). `DateTimeOffset` appears 13 times
against 246 `DateTime.UtcNow` reads.

**[ASPIRATIONAL]** prefer `DateTimeOffset` for a genuinely new timestamp
column that is not touched by the base classes or the document layer.
Introducing `DateTimeOffset` into the document layer breaks compilation
across consumers — don't. Never flag existing `DateTime` usage as a finding.

See also `rules/csharp-style.md#timeprovider` for how the value should be
obtained.
