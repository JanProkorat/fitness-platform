---
description: EF Core rules for entities, DbContext, and queries
---

# EF Core Rules

> Partially reconciled against the codebase. #entities, #primary-keys and
> #date-types were measured in #937 (on `develop` at `dc990021`);
> #enum-storage was measured and rewritten in #593, where the previous
> version of that section — which prescribed a global string-enum convention
> this codebase has never had — nearly produced a destructive ~30-table
> migration. Those four describe what
> `backend/FitnessPlatform.Application` actually does. The remaining sections
> have not been audited against the code; treat them as guidance, not as
> verified description.

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

## Enum storage

> **Descriptive.** Measured against `backend/FitnessPlatform.Application` while
> implementing #593. This section previously prescribed a global
> string-conversion convention the codebase has never had; it was reconciled
> after the stale rule nearly produced a destructive migration.

**There is no global enum convention.** `ApplicationDbContext` has no
`ConfigureConventions` override, and `HaveConversion` appears **0** times in
the backend. The rule this section used to give —
`configurationBuilder.Properties<Enum>().HaveConversion<string>()` — was never
in force here.

**Integer is the default, and what you get by omission.** An enum property with
no explicit configuration is stored by EF Core as `integer`, and that is how
the large majority of enum columns in this schema are stored — e.g.
`ProfessionalProfile.ProfessionalRole` and `ClientRequest.Status` both appear
as `b.Property<int>(...)` with `HasColumnType("integer")` in
`ApplicationDbContextModelSnapshot.cs`.

**String is a deliberate per-property opt-in**, used in exactly these places
(all in `Infrastructure/Data/ApplicationDbContext.cs`):

| Property | Line |
|---|---|
| `WeeklyCheckInSetting.Profession` | 190 |
| `WeeklyCheckInClientOverride.Profession` | 202 |
| `WeeklyCheckIn.Profession` | 217 |
| `WeeklyCheckIn.Status` (+ `HasDefaultValue`) | 218 |
| `PlanPhoto.Category` | 253 |
| `PlanPhoto.PlanType` | 254 |

`WeeklyCheckIn.Flags` (:229) is a third form — a custom `ValueConverter`
serialising `List<CheckInFlag>` to a `jsonb` array of flag-name strings.

Two properties pin `integer` explicitly instead of relying on the default:
`PhotoDiaryRequestConfiguration.cs:32` and `:36`. Both forms are fine.

### What to do for a new enum

Default to **integer** — declare the property, add no conversion. Opt into
`HasConversion<string>()` per property only when the column's readability in
raw SQL genuinely matters, and say why.

**Never add a global `Properties<Enum>().HaveConversion<string>()`
convention.** It rewrites every existing integer enum column in a single
migration — a destructive, data-losing `AlterColumn` sweep across roughly 30
entities, and easy to miss inside a migration diff. If one is ever genuinely
wanted, it is its own issue with its own data-migration plan, never a side
effect of adding an entity.

Changing an existing enum column's storage is likewise a destructive
migration, not a style fix.

**Always read the generated `Up()` after `dotnet ef migrations add`.** If it
contains an `AlterColumn` on a table you did not touch, an unintended
convention change has slipped in — stop and fix it before committing.

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
