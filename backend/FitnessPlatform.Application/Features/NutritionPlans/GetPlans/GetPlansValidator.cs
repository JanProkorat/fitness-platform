using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlans;

/// <summary>
/// Validates the <see cref="GetPlansRequest"/> pagination parameters.
/// </summary>
public class GetPlansValidator : Validator<GetPlansRequest>
{
    /// <summary>
    /// Initializes validation rules for listing nutrition plans.
    /// </summary>
    public GetPlansValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
