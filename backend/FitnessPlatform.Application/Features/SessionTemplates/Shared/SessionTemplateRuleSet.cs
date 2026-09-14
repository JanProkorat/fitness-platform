using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionTemplates.Shared;

/// <summary>
/// Shared validation rules for <c>CreateSessionTemplateRequest</c> and
/// <c>UpdateSessionTemplateRequest</c> — the two request DTOs carry an identical session-template
/// content tree (<see cref="TrainingWorkout"/> workouts plus standalone <see cref="SessionExercise"/>
/// entries), so this fragment collapses what was 81 lines of byte-identical duplication between
/// the two validators and, via <see cref="TrainingContentRuleSet"/> (#892), additionally applies
/// seven rule families the plan write path enforces that neither session-template validator
/// previously enforced: the 30-exercise-per-workout and 30-standalone-exercise caps, the
/// FormatConfig null/not-null-per-format invariant (at session, workout and exercise level), the
/// WOD inner-field bounds, RestSeconds 0..600, the 20-set cap, and per-set bounds.
/// <para>
/// A session template root has no <c>DayOfWeek</c>, no session-level <c>Order</c>, and no
/// <c>SessionId</c> — three plan-path session-level rules that simply have no counterpart here.
/// Their absence is a structural fact about this document, not a weakened invariant.
/// </para>
/// </summary>
internal static class SessionTemplateRuleSet
{
    private static readonly SessionExerciseAccessors<SessionExercise, ExerciseSet> ExerciseAccessors = new(
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
    /// Configures the full session-template content tree on <paramref name="validator"/>.
    /// </summary>
    /// <remarks>
    /// Every root-level field with a genuine 1:1 property on <typeparamref name="TRequest"/> is
    /// accepted as <see cref="Expression{TDelegate}"/>, not a pre-compiled <see cref="Func{T,TResult}"/>
    /// — the call site's own <c>x =&gt; x.Name</c> literal then reaches <c>RuleFor</c> with its real
    /// member-access expression tree intact, so FluentValidation resolves <c>PropertyName</c> from
    /// actual reflection metadata (and the global camelCasing <c>PropertyNameResolver</c>, active
    /// once the app host boots, applies normally). Wrapping a <c>Func&lt;&gt;</c> parameter in a
    /// *new* lambda (<c>x =&gt; name(x)</c>) before calling <c>RuleFor</c> — the shape this method
    /// used before #892's regression fix — erases that real expression tree, forcing a
    /// <c>WithName("Name")</c> override whose literal value bypasses the resolver entirely: a
    /// PascalCase-under-full-suite value the global resolver never gets a chance to camelCase.
    /// <paramref name="format"/> stays a plain <c>Func&lt;&gt;</c> — it never gets its own
    /// <c>RuleFor</c>, only read inside <c>When()</c> predicates, so no PropertyName is ever
    /// resolved for it. <paramref name="workouts"/>/<paramref name="standaloneExercises"/> still
    /// need a compiled delegate for their <c>RuleForEach</c> calls: <c>RuleForEach</c> requires an
    /// <c>IEnumerable&lt;TElement&gt;</c>-shaped expression, and a pre-built
    /// <c>Expression&lt;Func&lt;T,List&lt;TItem&gt;&gt;&gt;</c> parameter has no variance to satisfy
    /// that without a fresh lambda at the call site — <c>OverridePropertyName</c> keeps those two
    /// resolved names correct despite the resulting delegate-invoke wrapper.
    /// </remarks>
    public static void Configure<TRequest>(
        AbstractValidator<TRequest> validator,
        Expression<Func<TRequest, string>> name,
        Expression<Func<TRequest, string?>> description,
        Expression<Func<TRequest, ExerciseDifficulty>> difficulty,
        Expression<Func<TRequest, int?>> estimatedDurationMinutes,
        Expression<Func<TRequest, LibraryVisibility>> visibility,
        Func<TRequest, WorkoutFormat> format,
        Expression<Func<TRequest, WodConfig?>> formatConfig,
        Expression<Func<TRequest, List<TrainingWorkout>>> workouts,
        Expression<Func<TRequest, List<SessionExercise>>> standaloneExercises)
    {
        var estimatedDurationMinutesFunc = estimatedDurationMinutes.Compile();
        var formatConfigFunc = formatConfig.Compile();
        var workoutsFunc = workouts.Compile();
        var standaloneExercisesFunc = standaloneExercises.Compile();

        validator.RuleFor(name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        validator.RuleFor(name)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        validator.RuleFor(description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange);

        validator.RuleFor(difficulty)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        validator.RuleFor(estimatedDurationMinutes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => estimatedDurationMinutesFunc(x).HasValue);

        validator.RuleFor(visibility)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        // A template must have at least one workout or standalone exercise — mirrors
        // UpdateTrainingPlanValidator's session-level rule (#857 phase 3a). Whole-object rule —
        // there is no single real property to bind PropertyName to here, so WithName is genuinely
        // required (matching UpdateTrainingPlanValidator's identical pattern), not a workaround
        // for a lost expression tree.
        validator.RuleFor(x => x)
            .Must(x => workoutsFunc(x).Count > 0 || standaloneExercisesFunc(x).Count > 0)
            .WithErrorCode(ErrorCodes.WorkoutsRequired)
            .WithName("Workouts");

        // No duplicate Order values within the template's workouts.
        validator.RuleFor(workouts)
            .Must(w => w.Select(wo => wo.Order).Distinct().Count() == w.Count)
            .WithErrorCode(ErrorCodes.WorkoutOrderDuplicate);

        // Standalone exercises and workouts share ONE ordering sequence — a duplicate Order
        // across either list (or both) is rejected with the stable TRAINING_DUPLICATE_SESSION_ORDER
        // code, matching UpdateTrainingPlanValidator (workouts are 0-based, standalone exercises
        // are validated >= 1 via ApplyExerciseChildRules — the two order bases are never checked
        // against each other, only for cross-list uniqueness).
        TrainingContentRuleSet.ApplyCombinedOrderRule(
            validator, workoutsFunc, w => w.Order, standaloneExercisesFunc, e => e.Order);

        // CreateSessionTemplateRequest.Format and UpdateSessionTemplateRequest.Format are both
        // non-nullable WorkoutFormat defaulting to Standard, unlike the plan path's nullable
        // session-level Format. The widened selector below always has a value, so the
        // "non-Standard" branch fires exactly when format(x) != Standard — identical semantics to
        // the plan path's Format.HasValue && Format != Standard guard.
        validator.RuleFor(formatConfig)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => format(x) == WorkoutFormat.Standard);

        validator.RuleFor(formatConfig)
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => format(x) != WorkoutFormat.Standard);

        TrainingContentRuleSet.ApplyFormatConfigRules(
            validator, x => (WorkoutFormat?)format(x), formatConfigFunc, "Session");

        validator.RuleForEach(x => workoutsFunc(x))
            .ChildRules(workout => TrainingContentRuleSet.ApplyWorkoutRules(
                workout, w => w.Name, w => w.Format, w => w.FormatConfig, w => w.Exercises, ExerciseAccessors))
            .OverridePropertyName("Workouts");

        validator.RuleFor(standaloneExercises)
            .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange);

        validator.RuleForEach(x => standaloneExercisesFunc(x))
            .ChildRules(exercise => TrainingContentRuleSet.ApplyExerciseChildRules(exercise, ExerciseAccessors))
            .OverridePropertyName("StandaloneExercises");
    }
}
