using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Domain.Services;

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
        // the field name appears in the error message on every platform. This whole-object
        // form has no real property to bind PropertyName to in the first place — pinning it here
        // is not the #892-review defect (that was root-level scalar rules losing an expression
        // tree they COULD have kept; see ApplyExerciseChildRules/ApplyWorkoutRules below).

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
    /// </summary>
    public static void ApplyExerciseChildRules<TExercise, TSet>(
        AbstractValidator<TExercise> exercise,
        SessionExerciseAccessors<TExercise, TSet> accessors)
    {
        var formatFunc = accessors.Format.Compile();
        var formatConfigFunc = accessors.FormatConfig.Compile();
        var restSecondsFunc = accessors.RestSeconds.Compile();

        exercise.RuleFor(accessors.ExerciseExternalId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .WithMessage("ExerciseExternalId must not be empty.");

        exercise.RuleFor(accessors.ExerciseName)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .WithMessage("ExerciseName must not be empty.");

        exercise.RuleFor(accessors.Order)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Exercise Order must be >= 1.");

        exercise.RuleFor(accessors.RestSeconds)
            .InclusiveBetween(0, 600).WithErrorCode(ErrorCodes.OutOfRange)
            .When(e => restSecondsFunc(e).HasValue)
            .WithMessage("RestSeconds must be between 0 and 600.");

        exercise.RuleFor(accessors.FormatConfig)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .When(e => formatFunc(e) == WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig must be null for Standard format.");

        exercise.RuleFor(accessors.FormatConfig)
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange)
            .When(e => formatFunc(e).HasValue && formatFunc(e) != WorkoutFormat.Standard)
            .WithMessage("Exercise FormatConfig is required for non-Standard formats.");

        ApplyFormatConfigRules(exercise, formatFunc, formatConfigFunc, "Exercise");

        // Sets stays a compiled delegate wrapped in a fresh lambda: RuleForEach requires an
        // IEnumerable<TElement>-shaped expression, and a pre-built
        // Expression<Func<TExercise,List<TSet>>> member has no variance to satisfy that without a
        // fresh lambda at the call site — OverridePropertyName keeps the resolved name correct
        // despite the resulting delegate-invoke wrapper.
        exercise.RuleFor(e => accessors.Sets(e))
            .Must(sets => sets.Count <= 20).WithErrorCode(ErrorCodes.OutOfRange).WithName("Sets")
            .WithMessage("An exercise may not have more than 20 sets.");

        exercise.RuleForEach(e => accessors.Sets(e)).ChildRules(set =>
        {
            var repsFunc = accessors.Reps.Compile();
            var weightKgFunc = accessors.WeightKg.Compile();
            var rpeFunc = accessors.Rpe.Compile();

            set.RuleFor(accessors.SetNumber)
                .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange)
                .WithMessage("SetNumber must be >= 1.");

            set.RuleFor(accessors.Reps)
                .InclusiveBetween(1, 1000).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => repsFunc(s).HasValue)
                .WithMessage("Reps must be between 1 and 1000.");

            set.RuleFor(accessors.WeightKg)
                .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => weightKgFunc(s).HasValue)
                .WithMessage("WeightKg must be >= 0.");

            set.RuleFor(accessors.Rpe)
                .InclusiveBetween(1, 10).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => rpeFunc(s).HasValue)
                .WithMessage("RPE must be between 1 and 10.");
        }).OverridePropertyName("Sets");
    }

    /// <summary>
    /// Validation rules for a single workout: name, the max-30-exercises-per-workout cap,
    /// workout-level <see cref="WodConfig"/> null-ness, and its nested exercises via
    /// <see cref="ApplyExerciseChildRules{TExercise,TSet}"/>. Generic over the workout type so the
    /// plan write path's <c>UpdateTrainingWorkoutRequest</c>, the training-plan-template's
    /// <c>TemplateWorkoutRequest</c>, and the session-template libraries' verbatim
    /// <see cref="TrainingWorkout"/> snapshot can all share it. <paramref name="nameSelector"/>,
    /// <paramref name="formatSelector"/> and <paramref name="configSelector"/> are
    /// <see cref="Expression{TDelegate}"/> so <c>RuleFor</c> resolves <c>PropertyName</c> from the
    /// caller's real member access; <paramref name="exercisesSelector"/> stays a compiled delegate
    /// for the same <c>RuleForEach</c> variance reason documented on <see cref="SessionExerciseAccessors{TExercise,TSet}.Sets"/>.
    /// </summary>
    public static void ApplyWorkoutRules<TWorkout, TExercise, TSet>(
        AbstractValidator<TWorkout> workout,
        Expression<Func<TWorkout, string>> nameSelector,
        Expression<Func<TWorkout, WorkoutFormat?>> formatSelector,
        Expression<Func<TWorkout, WodConfig?>> configSelector,
        Func<TWorkout, List<TExercise>> exercisesSelector,
        SessionExerciseAccessors<TExercise, TSet> exerciseAccessors)
    {
        var formatFunc = formatSelector.Compile();
        var configFunc = configSelector.Compile();

        workout.RuleFor(nameSelector)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .WithMessage("Workout Name must not be empty.");

        workout.RuleFor(nameSelector)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        workout.RuleFor(w => exercisesSelector(w))
            .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange).WithName("Exercises")
            .WithMessage("A workout may not have more than 30 exercises.");

        workout.RuleFor(configSelector)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .When(w => formatFunc(w) == WorkoutFormat.Standard)
            .WithMessage("Workout FormatConfig must be null for Standard format.");

        workout.RuleFor(configSelector)
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange)
            .When(w => formatFunc(w).HasValue && formatFunc(w) != WorkoutFormat.Standard)
            .WithMessage("Workout FormatConfig is required for non-Standard formats.");

        ApplyFormatConfigRules(workout, formatFunc, configFunc, "Workout");

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
    /// for cross-list uniqueness. Whole-object rule — there is no single real property to bind
    /// PropertyName to, so the pinned <c>WithName("Order")</c> is genuinely required, not a
    /// workaround for a lost expression tree.
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
