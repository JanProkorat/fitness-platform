using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a nutritionist's reusable saved meal (foods + recipes),
/// shareable across nutrition plans via the #858 sharing-library contract
/// (<see cref="ILibraryDocument"/>, <c>LibraryAccessGuard</c>, <c>LibrarySearchHelper</c>).
/// </summary>
public class MealTemplate : ILibraryDocument
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <inheritdoc />
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <inheritdoc />
    [BsonElement("ownerId")]
    public Guid OwnerId { get; set; }

    /// <summary>
    /// Display name of the saved meal.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Optional hint for which meal slot this template suits (breakfast, lunch, etc.). Not a
    /// constraint — a saved meal may be dropped into any slot regardless of this value.
    /// </summary>
    [BsonElement("kind")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public MealKind? Kind { get; set; }

    /// <summary>
    /// Foods included in this meal — the existing <see cref="PlanMeal"/> snapshot shape, reused
    /// verbatim so copying in and out of a plan is a straight clone.
    /// </summary>
    [BsonElement("foods")]
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Recipes included in this meal — the existing <see cref="PlanMeal"/> snapshot shape,
    /// reused verbatim so copying in and out of a plan is a straight clone.
    /// </summary>
    [BsonElement("recipes")]
    public List<MealRecipe> Recipes { get; set; } = [];

    /// <summary>
    /// Computed macro totals across <see cref="Foods"/> and <see cref="Recipes"/>. Always
    /// recomputed server-side via <c>IMacroCalculatorService.CalculateMealTotals</c> on create
    /// and update — never trusted from the request.
    /// </summary>
    [BsonElement("totalNutrients")]
    public NutrientTotals TotalNutrients { get; set; } = new();

    /// <inheritdoc />
    /// <remarks>
    /// No initializer — a field-absent legacy document deserializes to
    /// <see cref="LibraryVisibility.Private"/>, the CLR default and the safe fallback.
    /// </remarks>
    [BsonElement("visibility")]
    [BsonRepresentation(BsonType.String)]
    public LibraryVisibility Visibility { get; set; }

    /// <inheritdoc />
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <inheritdoc />
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
