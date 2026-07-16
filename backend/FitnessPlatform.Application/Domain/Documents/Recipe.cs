using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a reusable recipe composed of multiple foods.
/// </summary>
public class Recipe
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
    /// The nutritionist who owns this recipe.
    /// </summary>
    [BsonElement("nutritionistId")]
    public Guid NutritionistId { get; set; }

    /// <summary>
    /// Name of the recipe.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description or preparation instructions.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Estimated preparation/cooking time in minutes.
    /// </summary>
    [BsonElement("prepTimeMinutes")]
    [BsonIgnoreIfNull]
    public int? PrepTimeMinutes { get; set; }

    /// <summary>
    /// Ordered preparation steps.
    /// </summary>
    [BsonElement("steps")]
    [BsonIgnoreIfNull]
    public List<string>? Steps { get; set; }

    /// <summary>
    /// Optional tip or note about the recipe.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// List of food items in this recipe with denormalized nutrient snapshots.
    /// </summary>
    [BsonElement("foods")]
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Computed total macronutrients for the entire recipe.
    /// </summary>
    [BsonElement("totalNutrients")]
    public NutrientTotals TotalNutrients { get; set; } = new();

    /// <summary>
    /// Visibility level controlling who can access this recipe.
    /// Public recipes are visible to all nutritionists; private ones only to their creator.
    /// Only the creator can edit or delete, regardless of visibility.
    /// </summary>
    [BsonElement("visibility")]
    [BsonRepresentation(BsonType.String)]
    public RecipeVisibility Visibility { get; set; } = RecipeVisibility.Public;

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// URL of the recipe's main image in blob storage (e.g. <c>recipes/{recipeId}/main.jpg</c>).
    /// Null until the nutritionist uploads and confirms a main image.
    /// </summary>
    [BsonElement("imageUrl")]
    [BsonIgnoreIfNull]
    public string? ImageUrl { get; set; }

    /// <summary>
    /// URLs of the recipe's gallery images in blob storage.
    /// Each entry looks like <c>recipes/{recipeId}/gallery-{n}.{ext}</c>.
    /// Capped at 6 entries. Append-only via the confirm endpoint.
    /// </summary>
    [BsonElement("galleryImageUrls")]
    public List<string> GalleryImageUrls { get; set; } = [];

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Meal types this recipe is suited for (e.g. "breakfast", "lunch", "dinner", "dessert").
    /// Additive/optional — absent on legacy documents, no backfill needed. No UI consumes this
    /// yet (follow-up issue); Recipe has no <c>Version</c> field so there is no CAS concern.
    /// </summary>
    [BsonElement("mealTypes")]
    [BsonIgnoreIfNull]
    public List<string>? MealTypes { get; set; }
}
