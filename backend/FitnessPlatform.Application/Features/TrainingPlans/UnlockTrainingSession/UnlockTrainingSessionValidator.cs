using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.UnlockTrainingSession;

/// <summary>
/// Validator for <see cref="UnlockTrainingSessionRequest"/>.
/// </summary>
public class UnlockTrainingSessionValidator : Validator<UnlockTrainingSessionRequest>
{
    /// <inheritdoc />
    public UnlockTrainingSessionValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty();
        RuleFor(x => x.SessionId).NotEmpty();
    }
}
