using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionExecutions.AbandonWorkout;

/// <summary>
/// Validator for <see cref="AbandonWorkoutRequest"/>.
/// </summary>
public class AbandonWorkoutValidator : Validator<AbandonWorkoutRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="AbandonWorkoutValidator"/>.
    /// </summary>
    public AbandonWorkoutValidator()
    {
        RuleFor(x => x.LogId).NotEmpty();
    }
}
