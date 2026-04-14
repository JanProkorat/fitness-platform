using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// Validator for <see cref="GetClientTimelineRequest"/>.
/// </summary>
public class GetClientTimelineValidator : Validator<GetClientTimelineRequest>
{
    /// <summary>
    /// Initializes validation rules for the client timeline request.
    /// </summary>
    public GetClientTimelineValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithMessage("ClientId is required.");

        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 100)
            .WithMessage("Limit must be between 1 and 100.");
    }
}
