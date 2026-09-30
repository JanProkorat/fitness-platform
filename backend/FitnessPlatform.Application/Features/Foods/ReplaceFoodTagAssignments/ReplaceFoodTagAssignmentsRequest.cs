namespace FitnessPlatform.Application.Features.Foods.ReplaceFoodTagAssignments;

/// <summary>
/// Request body for replacing the full set of tags assigned to a food. <c>FoodId</c> is bound
/// from the route.
/// </summary>
public class ReplaceFoodTagAssignmentsRequest
{
    /// <summary>
    /// Public identifier of the food, from the route.
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// Public identifiers of the tags to assign. An empty list clears every assignment the
    /// caller holds for this food.
    /// </summary>
    public List<Guid> TagIds { get; set; } = [];
}
