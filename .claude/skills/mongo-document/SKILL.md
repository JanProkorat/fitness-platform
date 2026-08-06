---
name: mongo-document
description: Scaffold a new MongoDB root aggregate under Domain/Documents/ with Id, ExternalId, optimistic-concurrency Version, audit timestamps. Invoke for new denormalized collections. Not for embedded sub-documents.
argument-hint: "<DocumentName> <collection-name>"
---

# mongo-document — scaffold a Mongo aggregate

Use this when a feature needs a new **root** document in Mongo. Embedded
sub-documents (like `PlanWeek`, `MealFood`) don't need this treatment — scaffold
them as plain POCOs next to their parent.

## Decide first

1. **Is this a root aggregate?** Will reads/writes target it by its own id, or
   is it always loaded as part of a parent? Only root aggregates go here.
2. **Name** — singular noun, PascalCase (e.g. `WorkoutLog`, `ProgressSnapshot`).
3. **Mongo collection** — plural camelCase, registered in
   `Infrastructure/Data/MongoContext.cs` (see neighbour registrations).
4. **External id** — every document exposes a stable `Guid ExternalId` for API
   use. The Mongo `ObjectId` never leaves the backend.
5. **Owner field(s)** — who owns this document? (`ClientId`,
   `NutritionistId`, `TrainerId`). Used for authorization.

## File to create

`backend/FitnessPlatform.Application/Domain/Documents/<Name>.cs`:

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a ... [one-line description of the aggregate].
/// </summary>
public class WorkoutLog
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// Public-facing identifier used in API requests and responses.
    /// </summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// The client this log belongs to (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    // --- feature-specific fields go here ---
    //
    // Use [BsonElement("camelCase")] on every persisted field — Mongo stores
    // the element name, EF's snake_case convention does NOT apply.
    //
    // Enums: serialize as strings for readability.
    //   [BsonRepresentation(BsonType.String)]
    //   public WorkoutStatus Status { get; set; } = WorkoutStatus.Draft;
    //
    // Embedded collections: plain POCOs in sibling files, no ObjectId.
    //   [BsonElement("sets")]
    //   public List<ExerciseSet> Sets { get; set; } = [];

    /// <summary>
    /// UTC timestamp when the document was created.
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp when the document was last updated.
    /// </summary>
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
```

## Register the collection

Add a property to `Infrastructure/Data/MongoContext.cs` (and its interface in
`Domain/Interfaces/IMongoContext.cs` if one exists). Follow the pattern of the
neighbouring collections — same plural camelCase as the on-disk name.

```csharp
public IMongoCollection<WorkoutLog> WorkoutLogs => _db.GetCollection<WorkoutLog>("workoutLogs");
```

If you add indexes (recommended on `ExternalId`, `ClientId`, and any field used
in range queries), do it in the same file's initializer alongside existing
indexes.

## Writing to the document

The slice endpoint owns persistence. The pattern to follow in `HandleAsync`:

```csharp
// 1. Load
var doc = await mongo.WorkoutLogs
    .Find(x => x.ExternalId == req.LogId)
    .FirstOrDefaultAsync(ct);

if (doc is null)
{
    this.ThrowErrorWithCode(ErrorCodes.NotFound, "Workout log not found.");
    return;
}

// 2. Authorize
if (doc.ClientId != callerUserId)
{
    this.ThrowErrorWithCode(ErrorCodes.Forbidden, "Not your log.");
    return;
}

// 3. Mutate in memory
doc.Status = WorkoutStatus.Completed;
doc.UpdatedAt = DateTime.UtcNow;

// 4. Persist with optimistic concurrency
var result = await mongo.WorkoutLogs.ReplaceOneAsync(
    x => x.ExternalId == doc.ExternalId && x.Version == doc.Version,
    new WorkoutLog { /* ...doc with Version = doc.Version + 1... */ },
    cancellationToken: ct);

if (result.MatchedCount == 0)
{
    this.ThrowErrorWithCode(ErrorCodes.Conflict, "Log was modified by another request.");
    return;
}
```

The exact helper names may differ — match the idiom used by the closest
neighbour in `Features/NutritionPlans/` or `Features/TrainingPlans/`.

## Related skills to chain

- If this document is a new aggregate boundary (not just a log/snapshot),
  write a short ADR capturing why it's a root document, what owns it, and its
  concurrency model. Mongo schema decisions are load-bearing and hard to
  reverse. No architecture skill is installed — do this inline, and read the
  existing ADRs in Notion for the house style.
- Deciding between extending an existing document vs. introducing a new one
  (denormalization trade-offs, read/write fan-out) is likewise a judgement call
  to reason through, not a skill to invoke.
- **`claude-security`** — run once the first endpoint writes to the document.
  Mongo is schema-less; IDOR via document id substitution is the most
  common failure mode.

## Checklist

- [ ] Document class lives in `Domain/Documents/<Name>.cs`
- [ ] Has `[BsonId] ObjectId Id`, `Guid ExternalId`, owner id(s),
      `CreatedAt`, `UpdatedAt`, `Version` fields
- [ ] Every persisted field has a `[BsonElement("camelCase")]`
- [ ] Enums use `[BsonRepresentation(BsonType.String)]`
- [ ] Collection registered in `MongoContext` with plural camelCase name
- [ ] Indexes on `ExternalId` + any common query field
- [ ] First endpoint that writes to it compares `Version` on save
- [ ] `dotnet build` passes
