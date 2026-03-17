using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.GetCustomFoods;

/// <summary>
/// Validates the <see cref="GetCustomFoodsRequest"/>.
/// </summary>
public class GetCustomFoodsValidator : Validator<GetCustomFoodsRequest>
{
    /// <summary>
    /// Initializes validation rules for custom foods listing.
    /// </summary>
    public GetCustomFoodsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
