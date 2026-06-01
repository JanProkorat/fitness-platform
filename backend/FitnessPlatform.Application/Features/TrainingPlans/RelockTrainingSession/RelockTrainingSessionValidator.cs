using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.RelockTrainingSession;

/// <summary>
/// Validator for <see cref="RelockTrainingSessionRequest"/>.
/// </summary>
public class RelockTrainingSessionValidator : Validator<RelockTrainingSessionRequest>
{
    /// <inheritdoc />
    public RelockTrainingSessionValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty();
        RuleFor(x => x.SessionId).NotEmpty();
    }
}
