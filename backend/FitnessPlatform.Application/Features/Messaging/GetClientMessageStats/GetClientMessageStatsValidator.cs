using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Messaging.GetClientMessageStats;

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
            .WithMessage("weeks must be between 1 and 26.");
    }
}
