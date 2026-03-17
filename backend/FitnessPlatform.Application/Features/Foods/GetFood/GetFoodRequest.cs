namespace FitnessPlatform.Application.Features.Foods.GetFood;

/// <summary>
/// Request model for retrieving a single food by its external ID.
/// </summary>
public class GetFoodRequest
{
    /// <summary>
    /// The food's public identifier.
    /// </summary>
    public Guid FoodId { get; set; }
}
