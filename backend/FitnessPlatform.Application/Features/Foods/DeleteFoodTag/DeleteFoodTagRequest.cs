namespace FitnessPlatform.Application.Features.Foods.DeleteFoodTag;

/// <summary>
/// Request for deleting a food tag. Bodyless — <c>TagId</c> is bound from the route.
/// </summary>
public class DeleteFoodTagRequest
{
    /// <summary>
    /// Public identifier of the tag to delete, from the route.
    /// </summary>
    public Guid TagId { get; set; }
}
