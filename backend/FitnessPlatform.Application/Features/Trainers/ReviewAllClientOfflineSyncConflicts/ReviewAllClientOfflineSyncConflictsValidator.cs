using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ReviewAllClientOfflineSyncConflicts;

/// <summary>
/// Validates the <see cref="ReviewAllClientOfflineSyncConflictsRequest"/>.
/// </summary>
public class ReviewAllClientOfflineSyncConflictsValidator : Validator<ReviewAllClientOfflineSyncConflictsRequest>
{
    /// <summary>
    /// Initializes validation rules for the route and body ids.
    /// </summary>
    public ReviewAllClientOfflineSyncConflictsValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.PlanId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);
    }
}
