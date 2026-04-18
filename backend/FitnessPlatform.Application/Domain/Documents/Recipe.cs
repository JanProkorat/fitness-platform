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
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }
}
