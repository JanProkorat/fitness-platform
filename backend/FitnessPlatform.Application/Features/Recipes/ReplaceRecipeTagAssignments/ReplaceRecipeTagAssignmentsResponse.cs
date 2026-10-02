using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.Recipes.ReplaceRecipeTagAssignments;

/// <summary>
/// The resulting tag set assigned to the recipe, for the calling nutritionist.
/// </summary>
public class ReplaceRecipeTagAssignmentsResponse
{
    /// <summary>
    /// Public identifier of the recipe the tags were assigned to.
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// The tags now assigned, ordered by name.
    /// </summary>
    public List<FoodTagDto> Tags { get; set; } = [];
}
