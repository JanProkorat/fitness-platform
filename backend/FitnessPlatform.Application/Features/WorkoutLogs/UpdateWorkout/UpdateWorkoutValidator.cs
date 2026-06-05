using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;

/// <summary>
/// Validates the <see cref="UpdateWorkoutRequest"/>.
/// </summary>
public class UpdateWorkoutValidator : Validator<UpdateWorkoutRequest>
{
    /// <summary>
    /// Initializes validation rules for workout update.
    /// </summary>
    public UpdateWorkoutValidator()
    {
        RuleFor(x => x.Mood)
            .InclusiveBetween(1, 5)
            .When(x => x.Mood.HasValue);

        RuleFor(x => x.Notes)
            .MaximumLength(2000)
            .When(x => x.Notes is not null);

        RuleForEach(x => x.Exercises).ChildRules(exercise =>
        {
            exercise.RuleFor(e => e.ExerciseExternalId)
                .NotEmpty();

            exercise.RuleFor(e => e.ExerciseName)
                .NotEmpty();

            exercise.RuleForEach(e => e.Sets).ChildRules(set =>
            {
                set.RuleFor(s => s.SetNumber)
                    .GreaterThanOrEqualTo(1);

                set.RuleFor(s => s.Reps)
                    .InclusiveBetween(1, 1000)
                    .When(s => s.Reps.HasValue);

                set.RuleFor(s => s.WeightKg)
                    .GreaterThanOrEqualTo(0)
                    .When(s => s.WeightKg.HasValue);

                set.RuleFor(s => s.Rpe)
                    .InclusiveBetween(1, 10)
                    .When(s => s.Rpe.HasValue);

                // ── Snapshot-planned bounds — mirror actual-value rules ─────────
                set.RuleFor(s => s.PlannedReps)
                    .InclusiveBetween(1, 1000)
                    .When(s => s.PlannedReps.HasValue);

                set.RuleFor(s => s.PlannedWeightKg)
                    .GreaterThanOrEqualTo(0)
                    .When(s => s.PlannedWeightKg.HasValue);

                set.RuleFor(s => s.PlannedRpe)
                    .InclusiveBetween(1, 10)
                    .When(s => s.PlannedRpe.HasValue);
            });
        });
    }
}
