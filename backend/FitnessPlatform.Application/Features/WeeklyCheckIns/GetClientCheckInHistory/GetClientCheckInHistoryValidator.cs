using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

/// <summary>
/// Validates <see cref="GetClientCheckInHistoryRequest"/>.
/// </summary>
public class GetClientCheckInHistoryValidator : Validator<GetClientCheckInHistoryRequest>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public GetClientCheckInHistoryValidator()
    {
        RuleFor(x => x.Weeks)
            .InclusiveBetween(1, 26)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Weeks must be between 1 and 26.");
    }
}
