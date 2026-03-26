using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlans;

/// <summary>
/// Validates the <see cref="GetTrainingPlansRequest"/>.
/// </summary>
public class GetTrainingPlansValidator : Validator<GetTrainingPlansRequest>
{
    /// <summary>
    /// Initializes validation rules for listing training plans.
    /// </summary>
    public GetTrainingPlansValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
