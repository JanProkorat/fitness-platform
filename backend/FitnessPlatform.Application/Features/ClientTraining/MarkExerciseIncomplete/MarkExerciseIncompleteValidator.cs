using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;

/// <summary>
/// Validator for <see cref="MarkExerciseIncompleteRequest"/>.
/// </summary>
public class MarkExerciseIncompleteValidator : Validator<MarkExerciseIncompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkExerciseIncompleteValidator"/>.
    /// </summary>
    public MarkExerciseIncompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.ExerciseId)
            .NotEmpty();
    }
}
