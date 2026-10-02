using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Validates the <see cref="SearchRecipesRequest"/>.
/// </summary>
public class SearchRecipesValidator : Validator<SearchRecipesRequest>
{
    /// <summary>
    /// The maximum number of tag ids a single search request may filter by.
    /// </summary>
    private const int MaxTags = 20;

    /// <summary>
    /// Initializes validation rules for recipe search.
    /// </summary>
    public SearchRecipesValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(x => x.MealTypes)
            .Must(mealTypes => mealTypes.Count <= Enum.GetValues<RecipeMealType>().Length)
            .WithMessage("Too many meal types supplied.");

        RuleForEach(x => x.MealTypes).IsInEnum();

        RuleFor(x => x.DietaryPreferences)
            .Must(preferences => preferences.Count <= Enum.GetValues<DietaryPreference>().Length)
            .WithMessage("Too many dietary preferences supplied.");

        RuleForEach(x => x.DietaryPreferences).IsInEnum();

        RuleFor(x => x.Owners)
            .Must(owners => owners.Count <= Enum.GetValues<FoodOwnerFilter>().Length)
            .WithMessage("Too many owner values supplied.");

        RuleForEach(x => x.Owners).IsInEnum();

        RuleFor(x => x.TagIds)
            .Must(tagIds => tagIds.Count <= MaxTags)
            .WithMessage($"At most {MaxTags} tag ids may be supplied.");

        RuleForEach(x => x.TagIds)
            .NotEmpty()
            .WithMessage("A filter tag id must not be empty.");

        RuleFor(x => x.SortBy).IsInEnum();

        RuleFor(x => x.SortDir).IsInEnum();
    }
}
