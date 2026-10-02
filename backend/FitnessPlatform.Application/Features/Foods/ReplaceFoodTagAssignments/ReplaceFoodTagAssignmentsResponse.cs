using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.Foods.ReplaceFoodTagAssignments;

/// <summary>
/// The resulting tag set assigned to the food, for the calling nutritionist.
/// </summary>
public class ReplaceFoodTagAssignmentsResponse
{
    /// <summary>
    /// Public identifier of the food the tags were assigned to.
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// The tags now assigned, ordered by name.
    /// </summary>
    public List<FoodTagDto> Tags { get; set; } = [];
}
