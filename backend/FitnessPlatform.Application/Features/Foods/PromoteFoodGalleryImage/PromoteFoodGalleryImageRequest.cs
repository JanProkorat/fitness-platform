namespace FitnessPlatform.Application.Features.Foods.PromoteFoodGalleryImage;

/// <summary>
/// Request model for promoting a gallery image to the food's main image.
/// </summary>
public class PromoteFoodGalleryImageRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// The exact stored gallery URL to promote.
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;
}
