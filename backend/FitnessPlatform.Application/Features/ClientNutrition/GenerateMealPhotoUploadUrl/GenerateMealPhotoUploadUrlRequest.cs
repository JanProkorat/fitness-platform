namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateMealPhotoUploadUrl;

/// <summary>
/// Request model for generating a pre-signed meal diary photo upload URL.
/// </summary>
public class GenerateMealPhotoUploadUrlRequest
{
    /// <summary>
    /// The unique identifier of the meal the photo will be attached to.
    /// Sourced from the route segment <c>{mealId}</c>.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 10 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
