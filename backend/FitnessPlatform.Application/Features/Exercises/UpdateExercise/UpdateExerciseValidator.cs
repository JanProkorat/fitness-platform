using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Exercises.UpdateExercise;

/// <summary>
/// Validates the <see cref="UpdateExerciseRequest"/>.
/// </summary>
public class UpdateExerciseValidator : Validator<UpdateExerciseRequest>
{
    /// <summary>
    /// Initializes validation rules for exercise update.
    /// </summary>
    public UpdateExerciseValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.MuscleGroups)
            .NotEmpty()
            .WithMessage("At least one muscle group is required.");

        RuleFor(x => x.Description)
            .MaximumLength(2000)
            .When(x => x.Description is not null);

        RuleFor(x => x.TechniqueNotes)
            .MaximumLength(5000)
            .When(x => x.TechniqueNotes is not null);
    }
}
