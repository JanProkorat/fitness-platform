using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.UpdateWorkoutTemplate;

/// <summary>
/// Validates <see cref="UpdateWorkoutTemplateRequest"/>.
/// </summary>
public class UpdateWorkoutTemplateValidator : Validator<UpdateWorkoutTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for a workout template update.
    /// </summary>
    public UpdateWorkoutTemplateValidator()
    {
        RuleFor(x => x.TemplateId).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Notes)
            .MaximumLength(2000)
            .When(x => !string.IsNullOrEmpty(x.Notes));

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.DefaultFormatConfig)
            .Null()
            .When(x => x.DefaultFormat == WorkoutFormat.Standard)
            .WithMessage("DefaultFormatConfig must be null for Standard format.");

        RuleFor(x => x.DefaultFormatConfig)
            .NotNull()
            .When(x => x.DefaultFormat.HasValue && x.DefaultFormat != WorkoutFormat.Standard)
            .WithMessage("DefaultFormatConfig is required for non-Standard formats.");

        CreateWorkoutTemplateValidator.ApplyFormatConfigRules(this, x => x.DefaultFormat, x => x.DefaultFormatConfig);

        RuleFor(x => x.DefaultExercises)
            .Must(exercises => exercises.Count <= 30).WithMessage("A template may not have more than 30 exercises.");

        RuleForEach(x => x.DefaultExercises).ChildRules(exercise =>
        {
            exercise.RuleFor(e => e.ExerciseExternalId)
                .NotEmpty().WithMessage("ExerciseExternalId must not be empty.");

            exercise.RuleFor(e => e.ExerciseName)
                .NotEmpty().WithMessage("ExerciseName must not be empty.");

            exercise.RuleFor(e => e.Order)
                .GreaterThanOrEqualTo(1).WithMessage("Exercise Order must be >= 1.");

            exercise.RuleFor(e => e.RestSeconds)
                .InclusiveBetween(0, 600).When(e => e.RestSeconds.HasValue)
                .WithMessage("RestSeconds must be between 0 and 600.");

            exercise.RuleFor(e => e.FormatConfig)
                .Null()
                .When(e => e.Format == WorkoutFormat.Standard)
                .WithMessage("Exercise FormatConfig must be null for Standard format.");

            exercise.RuleFor(e => e.FormatConfig)
                .NotNull()
                .When(e => e.Format.HasValue && e.Format != WorkoutFormat.Standard)
                .WithMessage("Exercise FormatConfig is required for non-Standard formats.");

            CreateWorkoutTemplateValidator.ApplyFormatConfigRules(exercise, e => e.Format, e => e.FormatConfig);

            exercise.RuleFor(e => e.Sets)
                .Must(sets => sets.Count <= 20).WithMessage("An exercise may not have more than 20 sets.");

            exercise.RuleForEach(e => e.Sets).ChildRules(set =>
            {
                set.RuleFor(s => s.SetNumber)
                    .GreaterThanOrEqualTo(1).WithMessage("SetNumber must be >= 1.");

                set.RuleFor(s => s.Reps)
                    .InclusiveBetween(1, 1000).When(s => s.Reps.HasValue)
                    .WithMessage("Reps must be between 1 and 1000.");

                set.RuleFor(s => s.WeightKg)
                    .GreaterThanOrEqualTo(0).When(s => s.WeightKg.HasValue)
                    .WithMessage("WeightKg must be >= 0.");

                set.RuleFor(s => s.Rpe)
                    .InclusiveBetween(1, 10).When(s => s.Rpe.HasValue)
                    .WithMessage("RPE must be between 1 and 10.");
            });
        });
    }
}
