using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.GetClientOfflineSyncConflicts;

/// <summary>
/// Validates the <see cref="GetClientOfflineSyncConflictsRequest"/>.
/// </summary>
public class GetClientOfflineSyncConflictsValidator : Validator<GetClientOfflineSyncConflictsRequest>
{
    /// <summary>
    /// Initializes validation rules for the paging parameters.
    /// </summary>
    public GetClientOfflineSyncConflictsValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }
}
