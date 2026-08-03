using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Validates <see cref="UpdateTrainingPlanRequest"/> including all nested weeks, sessions, workouts, exercises, and sets.
/// </summary>
public class UpdateTrainingPlanValidator : Validator<UpdateTrainingPlanRequest>
{
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
                    .Must(s => s.Workouts.Count > 0 || s.Exercises.Count > 0)
                    .WithName("Workouts")
                    .WithMessage("A session must have at least one workout or standalone exercise.");

                // No duplicate Order values within a session's workouts
                session.RuleFor(s => s.Workouts)
                    .Must(workouts => workouts.Select(w => w.Order).Distinct().Count() == workouts.Count)
                    .WithMessage("Duplicate Order values are not allowed within a session's workouts.");

                // #857 phase 3a: standalone exercises and workouts share ONE ordering
                // sequence within a session — a duplicate Order across either list (or both) is
                // rejected with the stable TRAINING_DUPLICATE_SESSION_ORDER code.
                session.RuleFor(s => s)
                    .Must(s =>
                    {
                        var orders = s.Workouts.Select(w => w.Order)
                            .Concat(s.Exercises.Select(ex => ex.Order))
                            .ToList();
                        return orders.Distinct().Count() == orders.Count;
                    })
                    .WithErrorCode(ErrorCodes.TrainingDuplicateSessionOrder)
                    .WithName("Order")
                    .WithMessage("Duplicate Order values are not allowed across a session's standalone exercises and workouts.");

                // Session-level format config invariants (optional, nullable)
                session.RuleFor(s => s.FormatConfig)
                    .Null()
                    .When(s => s.Format == WorkoutFormat.Standard)
                    .WithMessage("Session FormatConfig must be null for Standard format.");

                session.RuleFor(s => s.FormatConfig)
                    .NotNull()
                    .When(s => s.Format.HasValue && s.Format != WorkoutFormat.Standard)
                    .WithMessage("Session FormatConfig is required for non-Standard formats.");

                ApplyFormatConfigRules(session, s => s.Format, s => s.FormatConfig, "Session");

                session.RuleForEach(s => s.Workouts).ChildRules(workout =>
                {
                    workout.RuleFor(w => w.Name)
                        .NotEmpty().WithMessage("Workout Name must not be empty.")
                        .MaximumLength(200);

                    workout.RuleFor(w => w.Exercises)
                        .Must(exercises => exercises.Count <= 30).WithMessage("A workout may not have more than 30 exercises.");

                    // Workout-level format config invariants
                    workout.RuleFor(w => w.FormatConfig)
                        .Null()
                        .When(w => w.Format == WorkoutFormat.Standard)
                        .WithMessage("Workout FormatConfig must be null for Standard format.");

                    workout.RuleFor(w => w.FormatConfig)
                        .NotNull()
                        .When(w => w.Format.HasValue && w.Format != WorkoutFormat.Standard)
                        .WithMessage("Workout FormatConfig is required for non-Standard formats.");

                    ApplyFormatConfigRules(workout, w => w.Format, w => w.FormatConfig, "Workout");

                    workout.RuleForEach(w => w.Exercises).ChildRules(ApplyExerciseChildRules);
                });

                // #857 phase 3a: standalone exercises directly on the session — same shape and
                // limits as a section's nested exercises, extracted into ApplyExerciseChildRules
                // to avoid duplicating the whole exercise+set rule tree.
                session.RuleFor(s => s.Exercises)
                    .Must(exercises => exercises.Count <= 30).WithMessage("A session may not have more than 30 standalone exercises.");

                session.RuleForEach(s => s.Exercises).ChildRules(ApplyExerciseChildRules);
            });
        });
    }

    /// <summary>
    /// Validation rules shared by a section's nested exercises and a session's standalone
    /// exercises (#857 phase 3a) — both are <see cref="UpdateSessionExerciseRequest"/> lists with
    /// identical invariants.
    /// </summary>
    private static void ApplyExerciseChildRules(InlineValidator<UpdateSessionExerciseRequest> exercise)
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

        // Per-exercise format config invariants
        exercise.RuleFor(e => e.FormatConfig)
            .Null()
            .When(e => e.Format == WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig must be null for Standard format.");

        exercise.RuleFor(e => e.FormatConfig)
            .NotNull()
            .When(e => e.Format.HasValue && e.Format != WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig is required for non-Standard formats.");

        ApplyFormatConfigRules(exercise, e => e.Format, e => e.FormatConfig, "Exercise");

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
    }

    private static void ApplyFormatConfigRules<T>(
        AbstractValidator<T> validator,
        Func<T, WorkoutFormat?> formatSelector,
        Func<T, WodConfig?> configSelector,
        string prefix)
    {
        // Use Must() on the root object so FluentValidation does not need to resolve
        // PropertyName from a delegate-chained expression such as
        // `x => configSelector(x)!.IntervalSeconds`. Expression-visitor-based name
        // resolution of that pattern is JIT-dependent and produces an empty string
        // on Linux/x64 while resolving correctly on macOS/ARM64 (issue #276).
        // WithName() pins the property name explicitly and WithMessage() ensures
        // the field name appears in the error message on every platform.

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.IntervalSeconds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.EMOM && configSelector(x) != null)
            .WithName("IntervalSeconds")
            .WithMessage($"{prefix} EMOM requires IntervalSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TotalRounds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.EMOM && configSelector(x) != null)
            .WithName("TotalRounds")
            .WithMessage($"{prefix} EMOM requires TotalRounds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TimeCapSeconds is > 0)
            .When(x => (formatSelector(x) == WorkoutFormat.AMRAP || formatSelector(x) == WorkoutFormat.ForTime) && configSelector(x) != null)
            .WithName("TimeCapSeconds")
            .WithMessage($"{prefix} AMRAP and ForTime require TimeCapSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.WorkSeconds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithName("WorkSeconds")
            .WithMessage($"{prefix} Tabata requires WorkSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.RestSeconds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithName("RestSeconds")
            .WithMessage($"{prefix} Tabata requires RestSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TotalRounds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithName("TotalRounds")
            .WithMessage($"{prefix} Tabata requires TotalRounds > 0.");
    }
}
