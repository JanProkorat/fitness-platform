using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Bundles the field accessors <see cref="TrainingContentRuleSet.ApplyExerciseChildRules{TExercise,TSet}"/>
/// needs to validate an exercise-and-its-sets subtree, regardless of the concrete DTO/document
/// shape carrying that data. An interface was considered and rejected here: the three call sites'
/// exercise/set types disagree on nullability (<c>CreateSessionTemplateRequest.Format</c> is
/// non-nullable <see cref="WorkoutFormat"/>; the plan write path's is <c>WorkoutFormat?</c>) and on
/// set element type (<see cref="Documents.ExerciseSet"/> vs the plan path's
/// <c>UpdateExerciseSetRequest</c>) — a shared interface would force edits to three request DTOs
/// and two Mongo documents just to satisfy a validator. A bundle of <see cref="Func{T,TResult}"/>
/// members composes over the existing shapes with zero DTO/document changes. In-repo precedent for
/// a <c>readonly record struct</c> carrying a bundle of related values: <see cref="CoachEntitlements"/>.
/// </summary>
public readonly record struct SessionExerciseAccessors<TExercise, TSet>(
    Func<TExercise, Guid> ExerciseExternalId,
    Func<TExercise, string> ExerciseName,
    Func<TExercise, int> Order,
    Func<TExercise, int?> RestSeconds,
    Func<TExercise, WorkoutFormat?> Format,
    Func<TExercise, WodConfig?> FormatConfig,
    Func<TExercise, List<TSet>> Sets,
    Func<TSet, int> SetNumber,
    Func<TSet, int?> Reps,
    Func<TSet, decimal?> WeightKg,
    Func<TSet, decimal?> Rpe);

/// <summary>
/// The training-content validation rules shared by the plan write path
/// (<c>UpdateTrainingPlanValidator</c>), the training-plan-template week validator
/// (<c>TemplateWeekRuleSet</c>), and the session-template validators
/// (<c>SessionTemplateRuleSet</c>) — three feature areas, so this lives in <c>Domain/Services</c>
/// per <c>rules/architecture.md#no-horizontal-layers</c> rather than in any one feature's
/// <c>Shared/</c> folder. Before this type existed, <c>TemplateWeekRuleSet</c> reached
/// cross-namespace into <c>UpdateTrainingPlanValidator.ApplyFormatConfigRules</c> — exactly the
/// smell this consolidation removes.
/// <para>
/// A session template root has no <c>DayOfWeek</c>, no session-level <c>Order</c>, and no
/// <c>SessionId</c> — three plan-path session-level rules that simply have no template
/// counterpart. Their absence from <c>SessionTemplateRuleSet</c> is a structural fact about that
/// document, not a weakened invariant.
/// </para>
/// </summary>
public static class TrainingContentRuleSet
{
    /// <summary>
    /// Validates the inner <see cref="WodConfig"/> fields required by a non-Standard
    /// <see cref="WorkoutFormat"/> (EMOM's <c>IntervalSeconds</c>/<c>TotalRounds</c>, AMRAP/ForTime's
    /// <c>TimeCapSeconds</c>, Tabata's <c>WorkSeconds</c>/<c>RestSeconds</c>/<c>TotalRounds</c>).
    /// Moved verbatim from <c>UpdateTrainingPlanValidator</c> (#892) — the whole-object
    /// <c>RuleFor(x =&gt; x).Must(...)</c> form and its pinned <c>WithName(...)</c> are load-bearing,
    /// see the remarks below, and must not be "simplified" into property chaining.
    /// </summary>
    public static void ApplyFormatConfigRules<T>(
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
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("IntervalSeconds")
            .WithMessage($"{prefix} EMOM requires IntervalSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TotalRounds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.EMOM && configSelector(x) != null)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("TotalRounds")
            .WithMessage($"{prefix} EMOM requires TotalRounds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TimeCapSeconds is > 0)
            .When(x => (formatSelector(x) == WorkoutFormat.AMRAP || formatSelector(x) == WorkoutFormat.ForTime) && configSelector(x) != null)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("TimeCapSeconds")
            .WithMessage($"{prefix} AMRAP and ForTime require TimeCapSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.WorkSeconds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("WorkSeconds")
            .WithMessage($"{prefix} Tabata requires WorkSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.RestSeconds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("RestSeconds")
            .WithMessage($"{prefix} Tabata requires RestSeconds > 0.");

        validator.RuleFor(x => x)
            .Must(x => configSelector(x)?.TotalRounds is > 0)
            .When(x => formatSelector(x) == WorkoutFormat.Tabata && configSelector(x) != null)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithName("TotalRounds")
            .WithMessage($"{prefix} Tabata requires TotalRounds > 0.");
    }

    /// <summary>
    /// Validation rules shared by a workout's nested exercises and a session's standalone
    /// exercises, over <paramref name="accessors"/> rather than a concrete type — the plan write
    /// path, the training-plan-template week, and both session-template validators each feed this
    /// their own exercise/set DTO. Every rule here emits both a code and a message (#892 A1b) —
    /// additive on the plan write path, which previously emitted only the message.
    /// <para>
    /// Every <c>RuleFor</c> below reads through a delegate (<c>accessors.Field(e)</c>), not a
    /// direct member expression, so each rule pins its own <c>WithName(...)</c> explicitly rather
    /// than relying on FluentValidation's expression-based name inference — the same defensive
    /// reasoning as <see cref="ApplyFormatConfigRules{T}"/>'s pinned names (issue #276).
    /// </para>
    /// </summary>
    public static void ApplyExerciseChildRules<TExercise, TSet>(
        AbstractValidator<TExercise> exercise,
        SessionExerciseAccessors<TExercise, TSet> accessors)
    {
        exercise.RuleFor(e => accessors.ExerciseExternalId(e))
            .NotEmpty().WithErrorCode(ErrorCodes.Required).WithName("ExerciseExternalId")
            .WithMessage("ExerciseExternalId must not be empty.");

        exercise.RuleFor(e => accessors.ExerciseName(e))
            .NotEmpty().WithErrorCode(ErrorCodes.Required).WithName("ExerciseName")
            .WithMessage("ExerciseName must not be empty.");

        exercise.RuleFor(e => accessors.Order(e))
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange).WithName("Order")
            .WithMessage("Exercise Order must be >= 1.");

        exercise.RuleFor(e => accessors.RestSeconds(e))
            .InclusiveBetween(0, 600).WithErrorCode(ErrorCodes.OutOfRange).WithName("RestSeconds")
            .When(e => accessors.RestSeconds(e).HasValue)
            .WithMessage("RestSeconds must be between 0 and 600.");

        exercise.RuleFor(e => accessors.FormatConfig(e))
            .Null().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(e => accessors.Format(e) == WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig must be null for Standard format.");

        exercise.RuleFor(e => accessors.FormatConfig(e))
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(e => accessors.Format(e).HasValue && accessors.Format(e) != WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig is required for non-Standard formats.");

        ApplyFormatConfigRules(exercise, accessors.Format, accessors.FormatConfig, "Exercise");

        exercise.RuleFor(e => accessors.Sets(e))
            .Must(sets => sets.Count <= 20).WithErrorCode(ErrorCodes.OutOfRange).WithName("Sets")
            .WithMessage("An exercise may not have more than 20 sets.");

        exercise.RuleForEach(e => accessors.Sets(e)).ChildRules(set =>
        {
            set.RuleFor(s => accessors.SetNumber(s))
                .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange).WithName("SetNumber")
                .WithMessage("SetNumber must be >= 1.");

            set.RuleFor(s => accessors.Reps(s))
                .InclusiveBetween(1, 1000).WithErrorCode(ErrorCodes.OutOfRange).WithName("Reps")
                .When(s => accessors.Reps(s).HasValue)
                .WithMessage("Reps must be between 1 and 1000.");

            set.RuleFor(s => accessors.WeightKg(s))
                .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.OutOfRange).WithName("WeightKg")
                .When(s => accessors.WeightKg(s).HasValue)
                .WithMessage("WeightKg must be >= 0.");

            set.RuleFor(s => accessors.Rpe(s))
                .InclusiveBetween(1, 10).WithErrorCode(ErrorCodes.OutOfRange).WithName("Rpe")
                .When(s => accessors.Rpe(s).HasValue)
                .WithMessage("RPE must be between 1 and 10.");
        }).OverridePropertyName("Sets");
    }

    /// <summary>
    /// Validation rules for a single workout: name, the max-30-exercises-per-workout cap,
    /// workout-level <see cref="WodConfig"/> null-ness, and its nested exercises via
    /// <see cref="ApplyExerciseChildRules{TExercise,TSet}"/>. Generic over the workout type so the
    /// plan write path's <c>UpdateTrainingWorkoutRequest</c>, the training-plan-template's
    /// <c>TemplateWorkoutRequest</c>, and the session-template libraries' verbatim
    /// <see cref="TrainingWorkout"/> snapshot can all share it.
    /// </summary>
    public static void ApplyWorkoutRules<TWorkout, TExercise, TSet>(
        AbstractValidator<TWorkout> workout,
        Func<TWorkout, string> nameSelector,
        Func<TWorkout, WorkoutFormat?> formatSelector,
        Func<TWorkout, WodConfig?> configSelector,
        Func<TWorkout, List<TExercise>> exercisesSelector,
        SessionExerciseAccessors<TExercise, TSet> exerciseAccessors)
    {
        workout.RuleFor(w => nameSelector(w))
            .NotEmpty().WithErrorCode(ErrorCodes.Required).WithName("Name")
            .WithMessage("Workout Name must not be empty.");

        workout.RuleFor(w => nameSelector(w))
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange).WithName("Name");

        workout.RuleFor(w => exercisesSelector(w))
            .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange).WithName("Exercises")
            .WithMessage("A workout may not have more than 30 exercises.");

        workout.RuleFor(w => configSelector(w))
            .Null().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(w => formatSelector(w) == WorkoutFormat.Standard)
            .WithMessage("Workout FormatConfig must be null for Standard format.");

        workout.RuleFor(w => configSelector(w))
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(w => formatSelector(w).HasValue && formatSelector(w) != WorkoutFormat.Standard)
            .WithMessage("Workout FormatConfig is required for non-Standard formats.");

        ApplyFormatConfigRules(workout, formatSelector, configSelector, "Workout");

        workout.RuleForEach(w => exercisesSelector(w))
            .ChildRules(exercise => ApplyExerciseChildRules(exercise, exerciseAccessors))
            .OverridePropertyName("Exercises");
    }

    /// <summary>
    /// The session-wide distinct-<c>Order</c> check across a session's workouts UNION its
    /// standalone exercises — #857 phase 3a: the two lists share ONE ordering sequence, so a
    /// duplicate <c>Order</c> across either list (or both) is rejected with the stable
    /// <see cref="ErrorCodes.TrainingDuplicateSessionOrder"/> code. Preserves the cross-base
    /// coupling exactly as the plan write path defined it: the workout order selector is
    /// documented 0-based and carries no minimum-value rule of its own, the exercise order
    /// selector is validated <c>&gt;= 1</c> elsewhere (via <see cref="ApplyExerciseChildRules{TExercise,TSet}"/>),
    /// and the two bases are never normalised or offset against each other here — only checked
    /// for cross-list uniqueness.
    /// </summary>
    public static void ApplyCombinedOrderRule<TSession, TWorkout, TExercise>(
        AbstractValidator<TSession> session,
        Func<TSession, List<TWorkout>> workoutsSelector,
        Func<TWorkout, int> workoutOrderSelector,
        Func<TSession, List<TExercise>> standaloneExercisesSelector,
        Func<TExercise, int> exerciseOrderSelector)
    {
        session.RuleFor(s => s)
            .Must(s =>
            {
                var orders = workoutsSelector(s).Select(workoutOrderSelector)
                    .Concat(standaloneExercisesSelector(s).Select(exerciseOrderSelector))
                    .ToList();
                return orders.Distinct().Count() == orders.Count;
            })
            .WithErrorCode(ErrorCodes.TrainingDuplicateSessionOrder)
            .WithName("Order")
            .WithMessage("Duplicate Order values are not allowed across a session's standalone exercises and workouts.");
    }
}
