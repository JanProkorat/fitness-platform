using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.SearchClientRecipes;

/// <summary>
/// Validates the <see cref="SearchClientRecipesRequest"/>.
/// </summary>
public class SearchClientRecipesValidator : Validator<SearchClientRecipesRequest>
{
    /// <summary>
    /// Initializes validation rules for the client recipe list.
    /// </summary>
    public SearchClientRecipesValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode("OUT_OF_RANGE");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithErrorCode("OUT_OF_RANGE");

        RuleFor(x => x.MealType)
            .IsInEnum()
            .When(x => x.MealType.HasValue);
    }
}
