namespace FitnessPlatform.Application.Features.Foods.DeleteFoodImage;

/// <summary>
/// Request model for removing a food's main image.
/// </summary>
public class DeleteFoodImageRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }
}
