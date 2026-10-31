using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A recipe item within a meal — denormalized snapshot of recipe data at the time of addition.
/// </summary>
public class MealRecipe
{
    /// <summary>
    /// Stable identity of this item inside its plan meal; survives edits of the meal. Empty on
    /// documents written before item ids existed.
    /// </summary>
    [BsonElement("itemId")]
    public Guid ItemId { get; set; }

    /// <summary>
    /// Reference to the original recipe's ID.
    /// </summary>
    [BsonElement("recipeId")]
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Snapshot of the recipe name at time of addition.
    /// </summary>
    [BsonElement("recipeName")]
    public string RecipeName { get; set; } = string.Empty;

    /// <summary>
    /// Total nutritional values for one serving of this recipe.
    /// </summary>
    [BsonElement("nutrientValuePerServing")]
    public NutrientValue NutrientValuePerServing { get; set; } = new();

    /// <summary>
    /// Number of servings.
    /// </summary>
    [BsonElement("servings")]
    public decimal Servings { get; set; } = 1;

    /// <summary>
    /// Optional note for this recipe in the plan.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Distinct food categories from the recipe's ingredients (snapshot).
    /// </summary>
    [BsonElement("foodCategories")]
    [BsonIgnoreIfNull]
    public List<string>? FoodCategories { get; set; }
}
