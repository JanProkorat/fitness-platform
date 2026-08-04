using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Validation rules for a single <see cref="TemplateWeekRequest"/>, including its nested days,
/// sessions, workouts, standalone exercises, and sets. Mirrors
/// <c>UpdateTrainingPlanValidator</c>'s structure — same content tree, same
/// duplicate-<c>Order</c>-across-workouts-and-standalone-exercises hazard
/// (<see cref="ErrorCodes.TrainingDuplicateSessionOrder"/>), and — at all three format-bearing
/// levels (session, workout, exercise) — the same inner <c>WodConfig</c> invariants via
/// <see cref="UpdateTrainingPlanValidator.ApplyFormatConfigRules{T}"/>. A template that skipped
/// these would let <c>instantiate</c> clone an invalid <c>WodConfig</c> verbatim into a real
/// plan the plan's own write path would otherwise reject.
/// </summary>
internal static class TemplateWeekRuleSet
{
    /// <summary>
    /// Configures validation rules for a single template week onto an inline child validator.
    /// </summary>
    public static void Configure(InlineValidator<TemplateWeekRequest> week)
    {
        week.RuleFor(w => w.WeekNumber)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

        week.RuleFor(w => w.Days)
            .Must(days => days.Count <= 7).WithErrorCode(ErrorCodes.OutOfRange)
            .Must(days => days.Select(d => d.DayOfWeek).Distinct().Count() == days.Count)
                .WithErrorCode(ErrorCodes.OutOfRange);

        week.RuleForEach(w => w.Days).ChildRules(day =>
        {
            day.RuleFor(d => d.DayOfWeek)
                .InclusiveBetween(1, 7).WithErrorCode(ErrorCodes.OutOfRange);

            day.RuleFor(d => d.Sessions)
                .Must(sessions => sessions.Count <= 14).WithErrorCode(ErrorCodes.OutOfRange);

            day.RuleForEach(d => d.Sessions).ChildRules(session =>
            {
                session.RuleFor(s => s.Name)
                    .NotEmpty().WithErrorCode(ErrorCodes.Required)
                    .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleFor(s => s.Order)
                    .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

                // A session must have at least one workout or standalone exercise (#857 phase 3a
                // parity: a lone finisher exercise programmed directly on the session is a valid,
                // complete session).
                session.RuleFor(s => s)
                    .Must(s => s.Workouts.Count > 0 || s.StandaloneExercises.Count > 0)
                    .WithErrorCode(ErrorCodes.WorkoutsRequired)
                    .WithName("Workouts");

                // Standalone exercises and workouts share ONE ordering sequence within a session —
                // a duplicate Order across either list (or both) is rejected with the stable
                // TRAINING_DUPLICATE_SESSION_ORDER code.
                session.RuleFor(s => s)
                    .Must(s =>
                    {
                        var orders = s.Workouts.Select(w => w.Order)
                            .Concat(s.StandaloneExercises.Select(ex => ex.Order))
                            .ToList();
                        return orders.Distinct().Count() == orders.Count;
                    })
                    .WithErrorCode(ErrorCodes.TrainingDuplicateSessionOrder)
                    .WithName("Order");

                session.RuleFor(s => s.FormatConfig)
                    .Null()
                    .When(s => s.Format == WorkoutFormat.Standard)
                    .WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleFor(s => s.FormatConfig)
                    .NotNull()
                    .When(s => s.Format.HasValue && s.Format != WorkoutFormat.Standard)
                    .WithErrorCode(ErrorCodes.OutOfRange);

                UpdateTrainingPlanValidator.ApplyFormatConfigRules(session, s => s.Format, s => s.FormatConfig, "Session");

                session.RuleFor(s => s.Workouts)
                    .Must(workouts => workouts.Count <= 14).WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleForEach(s => s.Workouts).ChildRules(workout =>
                {
                    workout.RuleFor(w => w.Name)
                        .NotEmpty().WithErrorCode(ErrorCodes.Required)
                        .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

                    workout.RuleFor(w => w.Exercises)
                        .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange);

                    workout.RuleFor(w => w.FormatConfig)
                        .Null()
                        .When(w => w.Format == WorkoutFormat.Standard)
                        .WithErrorCode(ErrorCodes.OutOfRange);

                    workout.RuleFor(w => w.FormatConfig)
                        .NotNull()
                        .When(w => w.Format.HasValue && w.Format != WorkoutFormat.Standard)
                        .WithErrorCode(ErrorCodes.OutOfRange);

                    UpdateTrainingPlanValidator.ApplyFormatConfigRules(workout, w => w.Format, w => w.FormatConfig, "Workout");

                    workout.RuleForEach(w => w.Exercises).ChildRules(ApplyExerciseChildRules);
                });

                session.RuleFor(s => s.StandaloneExercises)
                    .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleForEach(s => s.StandaloneExercises).ChildRules(ApplyExerciseChildRules);
            });
        });
    }

    /// <summary>
    /// Validation rules shared by a workout's nested exercises and a session's standalone
    /// exercises — both are <see cref="TemplateSessionExerciseRequest"/> lists with identical
    /// invariants.
    /// </summary>
    private static void ApplyExerciseChildRules(InlineValidator<TemplateSessionExerciseRequest> exercise)
    {
        exercise.RuleFor(e => e.ExerciseExternalId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        exercise.RuleFor(e => e.ExerciseName)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        exercise.RuleFor(e => e.Order)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

        exercise.RuleFor(e => e.RestSeconds)
            .InclusiveBetween(0, 600).WithErrorCode(ErrorCodes.OutOfRange)
            .When(e => e.RestSeconds.HasValue);

        exercise.RuleFor(e => e.FormatConfig)
            .Null()
            .When(e => e.Format == WorkoutFormat.Standard)
            .WithErrorCode(ErrorCodes.OutOfRange);

        exercise.RuleFor(e => e.FormatConfig)
            .NotNull()
            .When(e => e.Format.HasValue && e.Format != WorkoutFormat.Standard)
            .WithErrorCode(ErrorCodes.OutOfRange);

        UpdateTrainingPlanValidator.ApplyFormatConfigRules(exercise, e => e.Format, e => e.FormatConfig, "Exercise");

        exercise.RuleFor(e => e.Sets)
            .Must(sets => sets.Count <= 20).WithErrorCode(ErrorCodes.OutOfRange);

        exercise.RuleForEach(e => e.Sets).ChildRules(set =>
        {
            set.RuleFor(s => s.SetNumber)
                .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

            set.RuleFor(s => s.Reps)
                .InclusiveBetween(1, 1000).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Reps.HasValue);

            set.RuleFor(s => s.WeightKg)
                .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.WeightKg.HasValue);

            set.RuleFor(s => s.Rpe)
                .InclusiveBetween(1, 10).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Rpe.HasValue);
        });
    }
}
