using FastEndpoints;

namespace FitnessPlatform.Application.Features.Recipes.UploadImageUrl;

/// <summary>
/// Request model for generating a pre-signed upload URL for a recipe image.
/// </summary>
public class UploadRecipeImageUrlRequest
{
    /// <summary>
    /// The recipe's public identifier (from route).
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Image slot: <c>main</c> (overwrites) or <c>gallery</c> (appends, max 6).
    /// Provided as a query parameter: <c>?slot=main</c> or <c>?slot=gallery</c>.
    /// </summary>
    [QueryParam]
    public string Slot { get; set; } = string.Empty;

    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
