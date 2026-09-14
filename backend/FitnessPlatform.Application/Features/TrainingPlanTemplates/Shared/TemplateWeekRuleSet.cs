using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Validation rules for a single <see cref="TrainingPlanTemplateWeekRequest"/>, including its nested days,
/// sessions, workouts, standalone exercises, and sets. Mirrors <c>UpdateTrainingPlanValidator</c>'s
/// structure — same content tree, same duplicate-<c>Order</c>-across-workouts-and-standalone-exercises
/// hazard (<see cref="ErrorCodes.TrainingDuplicateSessionOrder"/>), and — at all three format-bearing
/// levels (session, workout, exercise) — the same inner <c>WodConfig</c> invariants, all now shared via
/// <see cref="TrainingContentRuleSet"/> (#892) rather than reached cross-namespace into
/// <c>UpdateTrainingPlanValidator</c>.
/// </summary>
internal static class TemplateWeekRuleSet
{
    private static readonly SessionExerciseAccessors<TemplateSessionExerciseRequest, TemplateExerciseSetRequest> ExerciseAccessors = new(
        ExerciseExternalId: e => e.ExerciseExternalId,
        ExerciseName: e => e.ExerciseName,
        Order: e => e.Order,
        RestSeconds: e => e.RestSeconds,
        Format: e => e.Format,
        FormatConfig: e => e.FormatConfig,
        Sets: e => e.Sets,
        SetNumber: s => s.SetNumber,
        Reps: s => s.Reps,
        WeightKg: s => s.WeightKg,
        Rpe: s => s.Rpe);

    /// <summary>
    /// Configures validation rules for a single template week onto an inline child validator.
    /// </summary>
    public static void Configure(InlineValidator<TrainingPlanTemplateWeekRequest> week)
    {
        week.RuleFor(w => w.WeekNumber)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

        week.RuleFor(w => w.Days)
            .Must(days => days.Count <= 7).WithErrorCode(ErrorCodes.OutOfRange)
            .Must(days => days.Select(d => d.DayOfWeek).Distinct().Count() == days.Count)
                .WithErrorCode(ErrorCodes.OutOfRange)
            // Week-level aggregate, mirroring UpdateTrainingPlanValidator's flat
            // `week.Sessions.Count <= 14` cap. The per-day cap this replaced (14 sessions on a
            // single day, up to 7 days) allowed up to 98 sessions in one template week — a
            // template could clone a week the plan's own PUT would then reject as over the
            // 14-per-week limit, locking the coach out of saving further edits. Summing across
            // Days subsumes the old per-day cap (no single day can exceed 14 once the week total
            // is capped at 14), so it isn't kept separately.
            .Must(days => days.Sum(d => d.Sessions.Count) <= 14).WithErrorCode(ErrorCodes.OutOfRange);

        week.RuleForEach(w => w.Days).ChildRules(day =>
        {
            day.RuleFor(d => d.DayOfWeek)
                .InclusiveBetween(1, 7).WithErrorCode(ErrorCodes.OutOfRange);

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
                TrainingContentRuleSet.ApplyCombinedOrderRule(
                    session, s => s.Workouts, w => w.Order, s => s.StandaloneExercises, e => e.Order);

                session.RuleFor(s => s.FormatConfig)
                    .Null()
                    .When(s => s.Format == WorkoutFormat.Standard)
                    .WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleFor(s => s.FormatConfig)
                    .NotNull()
                    .When(s => s.Format.HasValue && s.Format != WorkoutFormat.Standard)
                    .WithErrorCode(ErrorCodes.OutOfRange);

                TrainingContentRuleSet.ApplyFormatConfigRules(session, s => s.Format, s => s.FormatConfig, "Session");

                session.RuleFor(s => s.Workouts)
                    .Must(workouts => workouts.Count <= 14).WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleForEach(s => s.Workouts).ChildRules(workout =>
                    TrainingContentRuleSet.ApplyWorkoutRules(
                        workout, w => w.Name, w => w.Format, w => w.FormatConfig, w => w.Exercises, ExerciseAccessors));

                session.RuleFor(s => s.StandaloneExercises)
                    .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange);

                session.RuleForEach(s => s.StandaloneExercises).ChildRules(exercise =>
                    TrainingContentRuleSet.ApplyExerciseChildRules(exercise, ExerciseAccessors));
            });
        });
    }
}
