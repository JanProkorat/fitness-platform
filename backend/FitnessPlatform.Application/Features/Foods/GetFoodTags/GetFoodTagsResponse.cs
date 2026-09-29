using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.GetFoodTags;

/// <summary>
/// The food tags owned by the calling nutritionist.
/// </summary>
public class GetFoodTagsResponse
{
    /// <summary>
    /// The caller's food tags, ordered by name.
    /// </summary>
    public List<FoodTagDto> Tags { get; set; } = [];
}
