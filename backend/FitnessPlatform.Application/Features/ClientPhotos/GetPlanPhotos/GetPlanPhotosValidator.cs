using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPlans.GetPlanPhotos;

/// <summary>
/// Validator for <see cref="GetPlanPhotosRequest"/>.
/// </summary>
public class GetPlanPhotosValidator : Validator<GetPlanPhotosRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="GetPlanPhotosValidator"/>.
    /// </summary>
    public GetPlanPhotosValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(x => x.Category)
            .IsInEnum()
            .When(x => x.Category.HasValue);
    }
}
