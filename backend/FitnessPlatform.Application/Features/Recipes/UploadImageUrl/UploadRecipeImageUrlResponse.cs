namespace FitnessPlatform.Application.Features.Recipes.UploadImageUrl;

/// <summary>
/// Response model containing the pre-signed upload URL and the permanent blob URL.
/// </summary>
public class UploadRecipeImageUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client should PUT the image file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// Permanent blob URL at which the recipe image will be accessible after a successful upload.
    /// Main slot: <c>recipes/{recipeId}/main.{ext}</c>.
    /// Gallery slot: <c>recipes/{recipeId}/gallery-{n}.{ext}</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
