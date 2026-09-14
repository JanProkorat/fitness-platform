using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutComplete;

/// <summary>
/// Validator for <see cref="MarkWorkoutCompleteRequest"/>.
/// </summary>
public class MarkWorkoutCompleteValidator : Validator<MarkWorkoutCompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkWorkoutCompleteValidator"/>.
    /// </summary>
    public MarkWorkoutCompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.WorkoutId)
            .NotEmpty();
    }
}
