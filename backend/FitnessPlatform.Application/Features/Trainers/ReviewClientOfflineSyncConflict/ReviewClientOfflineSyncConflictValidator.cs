using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ReviewClientOfflineSyncConflict;

/// <summary>
/// Validates the <see cref="ReviewClientOfflineSyncConflictRequest"/>.
/// </summary>
public class ReviewClientOfflineSyncConflictValidator : Validator<ReviewClientOfflineSyncConflictRequest>
{
    /// <summary>
    /// Initializes validation rules for the route ids.
    /// </summary>
    public ReviewClientOfflineSyncConflictValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.ConflictId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);
    }
}
