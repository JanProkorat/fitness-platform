namespace FitnessPlatform.Application.Features.Foods.ConfirmFoodImage;

/// <summary>
/// Request model for confirming the uploaded food image blob URL.
/// </summary>
public class ConfirmFoodImageRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// The permanent blob URL returned by <c>POST /foods/{id}/image/upload-url</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
