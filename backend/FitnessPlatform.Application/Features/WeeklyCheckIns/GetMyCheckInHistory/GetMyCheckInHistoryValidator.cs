using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;

/// <summary>
/// Validation rules for <see cref="GetMyCheckInHistoryRequest"/>.
/// </summary>
public class GetMyCheckInHistoryValidator : Validator<GetMyCheckInHistoryRequest>
{
    /// <summary>
    /// Initializes the validation rules.
    /// </summary>
    public GetMyCheckInHistoryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode("OUT_OF_RANGE");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithErrorCode("OUT_OF_RANGE");
    }
}
