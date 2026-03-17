namespace FitnessPlatform.Application.Features.Foods.DeleteFood;

/// <summary>
/// Request model for soft-deleting a custom food.
/// </summary>
public class DeleteFoodRequest
{
    /// <summary>
    /// The food's public identifier.
    /// </summary>
    public Guid FoodId { get; set; }
}
