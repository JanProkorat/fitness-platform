namespace FitnessPlatform.Application.Features.Foods.GetFoodTags;

/// <summary>
/// Response model for the distinct food tags listing.
/// </summary>
public class GetFoodTagsResponse
{
    /// <summary>
    /// Distinct tags across every food visible to the caller, sorted alphabetically.
    /// </summary>
    public List<string> Tags { get; set; } = [];
}
