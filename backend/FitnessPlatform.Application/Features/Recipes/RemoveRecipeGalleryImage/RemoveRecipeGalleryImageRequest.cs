using FastEndpoints;

namespace FitnessPlatform.Application.Features.Recipes.RemoveRecipeGalleryImage;

/// <summary>
/// Request model for removing one gallery image from a recipe.
/// </summary>
public class RemoveRecipeGalleryImageRequest
{
    /// <summary>
    /// The recipe's public identifier (from route).
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// The exact stored gallery URL to remove (query parameter).
    /// </summary>
    [QueryParam]
    public string ImageUrl { get; set; } = string.Empty;
}
