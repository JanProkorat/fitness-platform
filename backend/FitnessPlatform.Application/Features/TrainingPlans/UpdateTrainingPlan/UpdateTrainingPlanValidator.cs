using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Validates <see cref="UpdateTrainingPlanRequest"/> including all nested weeks, sessions, workouts, exercises, and sets.
/// </summary>
public class UpdateTrainingPlanValidator : Validator<UpdateTrainingPlanRequest>
{
    private static readonly SessionExerciseAccessors<UpdateSessionExerciseRequest, UpdateExerciseSetRequest> ExerciseAccessors = new(
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
    /// Initializes validation rules for a full-state training plan update.
    /// </summary>
    public UpdateTrainingPlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.Description)
            .MaximumLength(2000)
            .When(x => x.Description is not null);

        RuleFor(x => x.TargetWeightKg)
            .GreaterThan(0)
            .WithMessage("TargetWeightKg must be greater than zero.")
            .When(x => x.TargetWeightKg.HasValue);

        RuleFor(x => x.Goal)
            .IsInEnum()
            .WithMessage("Goal must be a valid PrimaryGoal value.")
            .When(x => x.Goal.HasValue);

        RuleFor(x => x.Weeks)
            .NotEmpty().WithMessage("At least one week is required.")
            .Must(weeks => weeks.Count <= 52).WithMessage("A plan may not exceed 52 weeks.")
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithMessage("Duplicate WeekNumber values are not allowed.")
            .Must(weeks =>
            {
                // Duplicate SessionId values across ALL sessions in ALL weeks are forbidden.
                // A duplicate SessionId on published-week sessions causes an unhandled
                // ToDictionary crash (M2 fix). We validate globally (not just per-week) to
                // catch cross-week duplicates too.
                var allSessionIds = weeks
                    .SelectMany(w => w.Sessions)
                    .Where(s => s.SessionId.HasValue)
                    .Select(s => s.SessionId!.Value)
                    .ToList();
                return allSessionIds.Distinct().Count() == allSessionIds.Count;
            })
                .WithMessage("Duplicate SessionId values are not allowed across sessions.");

        RuleForEach(x => x.Weeks).ChildRules(week =>
        {
            week.RuleFor(w => w.WeekNumber)
                .GreaterThanOrEqualTo(1).WithMessage("WeekNumber must be >= 1.");

            week.RuleFor(w => w.Sessions)
                .Must(sessions => sessions.Count <= 14).WithMessage("A week may not have more than 14 sessions.");

            week.RuleFor(w => w.Sessions)
                .Must(sessions =>
                {
                    var withId = sessions.Where(s => s.SessionId.HasValue).Select(s => s.SessionId!.Value).ToList();
                    return withId.Distinct().Count() == withId.Count;
                }).WithMessage("Duplicate SessionId values are not allowed within a week.");

            week.RuleForEach(w => w.Sessions).ChildRules(session =>
            {
                session.RuleFor(s => s.DayOfWeek)
                    .InclusiveBetween(1, 7).WithMessage("DayOfWeek must be between 1 and 7.");

                session.RuleFor(s => s.Name)
                    .NotEmpty()
                    .MaximumLength(200);

                session.RuleFor(s => s.Order)
                    .GreaterThanOrEqualTo(1).WithMessage("Session Order must be >= 1.");

                // Session must have at least one workout or standalone exercise (#857 phase 3a:
                // a session no longer strictly needs a workout — a lone finisher exercise
                // programmed directly on the session is now a valid, complete session).
                session.RuleFor(s => s)
                    .Must(s => s.Workouts.Count > 0 || s.StandaloneExercises.Count > 0)
                    .WithErrorCode(ErrorCodes.WorkoutsRequired)
                    .WithName("Workouts")
                    .WithMessage("A session must have at least one workout or standalone exercise.");

                // No duplicate Order values within a session's workouts
                session.RuleFor(s => s.Workouts)
                    .Must(workouts => workouts.Select(w => w.Order).Distinct().Count() == workouts.Count)
                    .WithErrorCode(ErrorCodes.WorkoutOrderDuplicate)
                    .WithMessage("Duplicate Order values are not allowed within a session's workouts.");

                // #857 phase 3a: standalone exercises and workouts share ONE ordering
                // sequence within a session — a duplicate Order across either list (or both) is
                // rejected with the stable TRAINING_DUPLICATE_SESSION_ORDER code. Shared with the
                // template validators via TrainingContentRuleSet (#892).
                TrainingContentRuleSet.ApplyCombinedOrderRule(
                    session, s => s.Workouts, w => w.Order, s => s.StandaloneExercises, e => e.Order);

                // Session-level format config invariants (optional, nullable)
                session.RuleFor(s => s.FormatConfig)
                    .Null()
                    .When(s => s.Format == WorkoutFormat.Standard)
                    .WithMessage("Session FormatConfig must be null for Standard format.");

                session.RuleFor(s => s.FormatConfig)
                    .NotNull()
                    .When(s => s.Format.HasValue && s.Format != WorkoutFormat.Standard)
                    .WithMessage("Session FormatConfig is required for non-Standard formats.");

                TrainingContentRuleSet.ApplyFormatConfigRules(session, s => s.Format, s => s.FormatConfig, "Session");

                session.RuleForEach(s => s.Workouts).ChildRules(workout =>
                    TrainingContentRuleSet.ApplyWorkoutRules(
                        workout, w => w.Name, w => w.Format, w => w.FormatConfig, w => w.Exercises, ExerciseAccessors));

                // #857 phase 3a: standalone exercises directly on the session — same shape and
                // limits as a section's nested exercises, shared via TrainingContentRuleSet (#892)
                // to avoid duplicating the whole exercise+set rule tree.
                session.RuleFor(s => s.StandaloneExercises)
                    .Must(exercises => exercises.Count <= 30).WithMessage("A session may not have more than 30 standalone exercises.");

                session.RuleForEach(s => s.StandaloneExercises).ChildRules(exercise =>
                    TrainingContentRuleSet.ApplyExerciseChildRules(exercise, ExerciseAccessors));
            });
        });
    }
}
