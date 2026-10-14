using FastEndpoints;

namespace FitnessPlatform.Application.Features.Foods.RemoveFoodGalleryImage;

/// <summary>
/// Request model for removing one gallery image from a food.
/// </summary>
public class RemoveFoodGalleryImageRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// The exact stored gallery URL to remove (query parameter).
    /// </summary>
    [QueryParam]
    public string ImageUrl { get; set; } = string.Empty;
}
