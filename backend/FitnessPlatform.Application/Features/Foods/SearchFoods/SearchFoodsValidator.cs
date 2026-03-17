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

        RuleFor(x => x.Source)
            .Must(s => s is null || s.Equals("system", StringComparison.OrdinalIgnoreCase)
                                 || s.Equals("custom", StringComparison.OrdinalIgnoreCase)
                                 || s.Equals("openfoodfacts", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Source must be 'system', 'custom', or 'openfoodfacts'.");
    }
}
