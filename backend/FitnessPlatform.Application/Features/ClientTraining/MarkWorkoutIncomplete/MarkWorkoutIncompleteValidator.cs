using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutIncomplete;

/// <summary>
/// Validator for <see cref="MarkWorkoutIncompleteRequest"/>.
/// </summary>
public class MarkWorkoutIncompleteValidator : Validator<MarkWorkoutIncompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkWorkoutIncompleteValidator"/>.
    /// </summary>
    public MarkWorkoutIncompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.WorkoutId)
            .NotEmpty();
    }
}
