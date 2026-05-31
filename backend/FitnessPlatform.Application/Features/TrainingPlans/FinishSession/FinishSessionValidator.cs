using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.FinishSession;

/// <summary>
/// Validator for <see cref="FinishSessionRequest"/>.
/// </summary>
public class FinishSessionValidator : Validator<FinishSessionRequest>
{
    public FinishSessionValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty();

        RuleFor(x => x.SessionId)
            .NotEmpty();

        // CompletedAt is optional; when supplied it must not be in the future.
        // The "before plan start" check requires plan data and is done in HandleAsync.
        RuleFor(x => x.CompletedAt)
            .Must(d => d == null || d.Value <= DateTime.UtcNow)
            .WithErrorCode(ErrorCodes.CompletedAtInFuture)
            .WithMessage("completedAt must not be in the future")
            .When(x => x.CompletedAt.HasValue);
    }
}
