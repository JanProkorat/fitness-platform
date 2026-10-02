namespace FitnessPlatform.Application.Features.Recipes.PromoteRecipeGalleryImage;

/// <summary>
/// Request model for promoting a gallery image to the recipe's main image.
/// </summary>
public class PromoteRecipeGalleryImageRequest
{
    /// <summary>
    /// The recipe's public identifier (from route).
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// The exact stored gallery URL to promote.
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;
}
