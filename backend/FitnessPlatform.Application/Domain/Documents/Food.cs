using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a food item with nutritional data.
/// </summary>
[BsonIgnoreExtraElements]
public class Food
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
    /// Name of the food item.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Localized food names (en, cs, de) for multi-language support.
    /// Null for system/custom foods that don't come from OpenFoodFacts.
    /// </summary>
    [BsonElement("localizedNames")]
    [BsonIgnoreIfNull]
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// EAN/UPC barcode, if available.
    /// </summary>
    [BsonElement("barcode")]
    [BsonIgnoreIfNull]
    public string? Barcode { get; set; }

    /// <summary>
    /// Nutritional values per 100 grams.
    /// </summary>
    [BsonElement("nutrientValue")]
    public NutrientValue NutrientValue { get; set; } = new();

    /// <summary>
    /// List of allergen identifiers (e.g. "gluten", "milk").
    /// </summary>
    [BsonElement("allergens")]
    public List<string> Allergens { get; set; } = [];

    /// <summary>
    /// Common serving sizes for quick selection.
    /// </summary>
    [BsonElement("commonServings")]
    public List<ServingSize> CommonServings { get; set; } = [];

    /// <summary>
    /// The nutritionist who created this custom food, if applicable.
    /// </summary>
    [BsonElement("nutritionistId")]
    public Guid? NutritionistId { get; set; }

    /// <summary>
    /// Optional user note for this food item.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Soft-delete flag.
    /// </summary>
    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; }

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    public DateTime? DateUpdated { get; set; }
}
