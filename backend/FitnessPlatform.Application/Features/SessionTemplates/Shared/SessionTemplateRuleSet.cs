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
    public static void Configure<TRequest>(
        AbstractValidator<TRequest> validator,
        Func<TRequest, string> name,
        Func<TRequest, string?> description,
        Func<TRequest, ExerciseDifficulty> difficulty,
        Func<TRequest, int?> estimatedDurationMinutes,
        Func<TRequest, LibraryVisibility> visibility,
        Func<TRequest, WorkoutFormat> format,
        Func<TRequest, WodConfig?> formatConfig,
        Func<TRequest, List<TrainingWorkout>> workouts,
        Func<TRequest, List<SessionExercise>> standaloneExercises)
    {
        validator.RuleFor(x => name(x))
            .NotEmpty().WithErrorCode(ErrorCodes.Required).WithName("Name");

        validator.RuleFor(x => name(x))
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange).WithName("Name");

        validator.RuleFor(x => description(x))
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange).WithName("Description");

        validator.RuleFor(x => difficulty(x))
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange).WithName("Difficulty");

        validator.RuleFor(x => estimatedDurationMinutes(x))
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange).WithName("EstimatedDurationMinutes")
            .When(x => estimatedDurationMinutes(x).HasValue);

        validator.RuleFor(x => visibility(x))
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange).WithName("Visibility");

        // A template must have at least one workout or standalone exercise — mirrors
        // UpdateTrainingPlanValidator's session-level rule (#857 phase 3a).
        validator.RuleFor(x => x)
            .Must(x => workouts(x).Count > 0 || standaloneExercises(x).Count > 0)
            .WithErrorCode(ErrorCodes.WorkoutsRequired)
            .WithName("Workouts");

        // No duplicate Order values within the template's workouts.
        validator.RuleFor(x => workouts(x))
            .Must(w => w.Select(wo => wo.Order).Distinct().Count() == w.Count)
            .WithErrorCode(ErrorCodes.WorkoutOrderDuplicate)
            .WithName("Workouts");

        // Standalone exercises and workouts share ONE ordering sequence — a duplicate Order
        // across either list (or both) is rejected with the stable TRAINING_DUPLICATE_SESSION_ORDER
        // code, matching UpdateTrainingPlanValidator (workouts are 0-based, standalone exercises
        // are validated >= 1 via ApplyExerciseChildRules — the two order bases are never checked
        // against each other, only for cross-list uniqueness).
        TrainingContentRuleSet.ApplyCombinedOrderRule(
            validator, workouts, w => w.Order, standaloneExercises, e => e.Order);

        // CreateSessionTemplateRequest.Format and UpdateSessionTemplateRequest.Format are both
        // non-nullable WorkoutFormat defaulting to Standard, unlike the plan path's nullable
        // session-level Format. The widened selector below always has a value, so the
        // "non-Standard" branch fires exactly when format(x) != Standard — identical semantics to
        // the plan path's Format.HasValue && Format != Standard guard.
        validator.RuleFor(x => formatConfig(x))
            .Null().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(x => format(x) == WorkoutFormat.Standard);

        validator.RuleFor(x => formatConfig(x))
            .NotNull().WithErrorCode(ErrorCodes.OutOfRange).WithName("FormatConfig")
            .When(x => format(x) != WorkoutFormat.Standard);

        TrainingContentRuleSet.ApplyFormatConfigRules(
            validator, x => (WorkoutFormat?)format(x), formatConfig, "Session");

        validator.RuleForEach(x => workouts(x))
            .ChildRules(workout => TrainingContentRuleSet.ApplyWorkoutRules(
                workout, w => w.Name, w => w.Format, w => w.FormatConfig, w => w.Exercises, ExerciseAccessors))
            .OverridePropertyName("Workouts");

        validator.RuleFor(x => standaloneExercises(x))
            .Must(exercises => exercises.Count <= 30).WithErrorCode(ErrorCodes.OutOfRange).WithName("StandaloneExercises");

        validator.RuleForEach(x => standaloneExercises(x))
            .ChildRules(exercise => TrainingContentRuleSet.ApplyExerciseChildRules(exercise, ExerciseAccessors))
            .OverridePropertyName("StandaloneExercises");
    }
}
