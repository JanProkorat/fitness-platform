using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Exercises.CreateExercise;

/// <summary>
/// Validates the <see cref="CreateExerciseRequest"/>.
/// </summary>
public class CreateExerciseValidator : Validator<CreateExerciseRequest>
{
    /// <summary>
    /// Initializes validation rules for exercise creation.
    /// </summary>
    public CreateExerciseValidator()
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
