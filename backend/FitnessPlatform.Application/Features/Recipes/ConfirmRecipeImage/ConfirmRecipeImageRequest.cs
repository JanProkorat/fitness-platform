using FastEndpoints;

namespace FitnessPlatform.Application.Features.Recipes.ConfirmRecipeImage;

/// <summary>
/// Request model for confirming the uploaded recipe image blob URL.
/// </summary>
public class ConfirmRecipeImageRequest
{
    /// <summary>
    /// The recipe's public identifier (from route).
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Image slot: <c>main</c> (overwrites <c>ImageUrl</c>) or <c>gallery</c> (appends to <c>GalleryImageUrls</c>).
    /// Provided as a query parameter: <c>?slot=main</c> or <c>?slot=gallery</c>.
    /// </summary>
    [QueryParam]
    public string Slot { get; set; } = string.Empty;

    /// <summary>
    /// The permanent blob URL returned by <c>POST /recipes/{id}/image/upload-url</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
