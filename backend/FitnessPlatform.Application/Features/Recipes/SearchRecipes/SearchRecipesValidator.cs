using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Validates the <see cref="SearchRecipesRequest"/>.
/// </summary>
public class SearchRecipesValidator : Validator<SearchRecipesRequest>
{
    /// <summary>
    /// Initializes validation rules for recipe search.
    /// </summary>
    public SearchRecipesValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
