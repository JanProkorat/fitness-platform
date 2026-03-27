using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Validates the <see cref="SearchFoodsRequest"/>.
/// </summary>
public class SearchFoodsValidator : Validator<SearchFoodsRequest>
{
    /// <summary>
    /// Initializes validation rules for food search.
    /// </summary>
    public SearchFoodsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
