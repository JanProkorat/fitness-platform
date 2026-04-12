namespace FitnessPlatform.Application.Features.ClientNutrition.GetRecipeDetail;

/// <summary>
/// Request model for retrieving a recipe detail as a client.
/// </summary>
public class GetRecipeDetailRequest
{
    /// <summary>
    /// Public identifier of the recipe.
    /// </summary>
    public Guid RecipeId { get; set; }
}
