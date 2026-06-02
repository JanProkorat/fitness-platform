using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GoLive;

/// <summary>
/// Validator for <see cref="GoLiveRequest"/>.
/// </summary>
public class GoLiveValidator : Validator<GoLiveRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="GoLiveValidator"/>.
    /// </summary>
    public GoLiveValidator()
    {
        RuleFor(x => x.LogId).NotEmpty();
    }
}
