namespace FitnessPlatform.Application.Features.Recipes.DeleteRecipeImage;

/// <summary>
/// Request model for removing a recipe's main image.
/// </summary>
public class DeleteRecipeImageRequest
{
    /// <summary>
    /// The recipe's public identifier (from route).
    /// </summary>
    public Guid RecipeId { get; set; }
}
