using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB root aggregate representing a reusable nutrition plan template a nutritionist can
/// instantiate into a new client's <see cref="NutritionPlan"/>, or share for another
/// nutritionist to copy into their own library (#856 sharing-library model — see
/// <see cref="ILibraryDocument"/> for the shared guard/search contract).
/// </summary>
public class NutritionPlanTemplate : ILibraryDocument
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
    /// The nutritionist who owns this template (matches <c>ApplicationUser.Id</c>).
    /// </summary>
    [BsonElement("ownerId")]
    public Guid OwnerId { get; set; }

    /// <summary>
    /// Display name of the template.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Primary fitness goal this template targets — the "similar problems" search filter.
    /// </summary>
    [BsonElement("goal")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Dietary style this template targets — the "similar limitations" search filter.
    /// Nutrition templates carry this where training templates carry Difficulty: difficulty
    /// is meaningless for a meal plan.
    /// </summary>
    [BsonElement("dietaryStyle")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public DietaryStyle? DietaryStyle { get; set; }

    /// <summary>
    /// Global daily nutrition targets — daily macro targets are core methodology.
    /// </summary>
    [BsonElement("globalSettings")]
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Supplement recommendations carried by this template.
    /// </summary>
    [BsonElement("supplements")]
    public List<Supplement> Supplements { get; set; } = [];

    /// <summary>
    /// Weeks in the template. Slim <see cref="TemplateWeek"/> shape — no per-week publish state.
    /// </summary>
    [BsonElement("weeks")]
    public List<TemplateWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Denormalized week count, server-computed from <see cref="Weeks"/> on every write path
    /// (create, update, from-plan, copy) — never persisted as caller-supplied. Used for the
    /// library column, sort, and search filter.
    /// </summary>
    [BsonElement("weekCount")]
    public int WeekCount { get; set; }

    /// <summary>
    /// Who can read this entry besides its owner. No initializer — a field-absent document
    /// deserializes to <see cref="LibraryVisibility.Private"/>, the CLR default and the safe
    /// fallback.
    /// </summary>
    [BsonElement("visibility")]
    [BsonRepresentation(BsonType.String)]
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// When this template was created. Set from the injected <c>TimeProvider</c>, never
    /// <c>DateTime.UtcNow</c>. Primary sort key for library search (see
    /// <see cref="Services.LibrarySearchHelper"/>).
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this template was last updated. Set from the injected <c>TimeProvider</c>.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
