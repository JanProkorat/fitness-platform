using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FluentValidation;

namespace FormUp.Application.Features.Messaging.GetClientMessageStats;

/// <summary>
/// Validates the <see cref="GetClientMessageStatsRequest"/>.
/// </summary>
public class GetClientMessageStatsValidator : Validator<GetClientMessageStatsRequest>
{
    /// <summary>
    /// Initializes validation rules for retrieving a client's weekly message stats.
    /// </summary>
    public GetClientMessageStatsValidator()
    {
        RuleFor(x => x.Weeks)
            .InclusiveBetween(1, 26)
            .WithErrorCode(ErrorCodes.MessageStatsWeeksOutOfRange)
            .WithMessage("weeks must be between 1 and 26.");
    }
}
