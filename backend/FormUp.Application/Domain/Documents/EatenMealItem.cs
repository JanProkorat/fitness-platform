using FormUp.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FormUp.Application.Domain.Documents;

/// <summary>
/// One food or recipe of a meal as it stood when the client first ate from it, kept on a
/// <see cref="MealLog"/>. Nutrients are the item's total contribution (amount already applied).
/// </summary>
public class EatenMealItem
{
    /// <summary>Plan item id (<c>MealFood.ItemId</c> / <c>MealRecipe.ItemId</c>).</summary>
    [BsonElement("itemId")]
    public Guid ItemId { get; set; }

    /// <summary>Whether the item is a food or a recipe.</summary>
    [BsonElement("kind")]
    [BsonRepresentation(BsonType.String)]
    public SeenMealItemKind Kind { get; set; }

    /// <summary>Id of the food or recipe the item referred to.</summary>
    [BsonElement("refId")]
    public Guid RefId { get; set; }

    /// <summary>Display name.</summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Grams for a food, servings for a recipe.</summary>
    [BsonElement("amount")]
    public decimal Amount { get; set; }

    /// <summary>Energy in kcal.</summary>
    [BsonElement("kcal")]
    public decimal Kcal { get; set; }

    /// <summary>Protein in grams.</summary>
    [BsonElement("protein")]
    public decimal Protein { get; set; }

    /// <summary>Carbohydrates in grams.</summary>
    [BsonElement("carbs")]
    public decimal Carbs { get; set; }

    /// <summary>Fat in grams.</summary>
    [BsonElement("fat")]
    public decimal Fat { get; set; }

    /// <summary>Dietary fibre in grams.</summary>
    [BsonElement("fibre")]
    public decimal Fibre { get; set; }
}
