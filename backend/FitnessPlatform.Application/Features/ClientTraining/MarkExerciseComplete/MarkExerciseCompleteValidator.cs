using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;

/// <summary>
/// Validator for <see cref="MarkExerciseCompleteRequest"/>.
/// </summary>
public class MarkExerciseCompleteValidator : Validator<MarkExerciseCompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkExerciseCompleteValidator"/>.
    /// </summary>
    public MarkExerciseCompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.ExerciseExternalId)
            .NotEmpty();
    }
}
