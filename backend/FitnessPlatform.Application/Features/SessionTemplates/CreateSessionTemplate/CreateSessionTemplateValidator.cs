using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;

/// <summary>
/// Validates the <see cref="CreateSessionTemplateRequest"/>. Mirrors the ordering rules in
/// <c>UpdateTrainingPlanValidator</c> exactly (same order bases, same combined-distinct check,
/// same error code) so a template that validates here never 400s when embedded into a plan via
/// <c>UpdateTrainingPlan</c>.
/// </summary>
internal sealed class CreateSessionTemplateValidator : Validator<CreateSessionTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for session template creation.
    /// </summary>
    public CreateSessionTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Difficulty)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.EstimatedDurationMinutes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.EstimatedDurationMinutes.HasValue);

        RuleFor(x => x.Visibility)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        // A template must have at least one workout or standalone exercise — mirrors
        // UpdateTrainingPlanValidator's session-level rule (#857 phase 3a).
        RuleFor(x => x)
            .Must(x => x.Workouts.Count > 0 || x.StandaloneExercises.Count > 0)
            .WithErrorCode(ErrorCodes.WorkoutsRequired)
            .WithName("Workouts");

        // No duplicate Order values within the template's workouts.
        RuleFor(x => x.Workouts)
            .Must(workouts => workouts.Select(w => w.Order).Distinct().Count() == workouts.Count)
            .WithErrorCode(ErrorCodes.WorkoutOrderDuplicate);

        // Standalone exercises and workouts share ONE ordering sequence — a duplicate Order
        // across either list (or both) is rejected with the stable
        // TRAINING_DUPLICATE_SESSION_ORDER code, matching UpdateTrainingPlanValidator:106-115
        // byte-for-byte (workouts are 0-based, standalone exercises are validated >= 1 below —
        // the two order bases are never checked against each other, only for cross-list
        // uniqueness).
        RuleFor(x => x)
            .Must(x =>
            {
                var orders = x.Workouts.Select(w => w.Order)
                    .Concat(x.StandaloneExercises.Select(e => e.Order))
                    .ToList();
                return orders.Distinct().Count() == orders.Count;
            })
            .WithErrorCode(ErrorCodes.TrainingDuplicateSessionOrder)
            .WithName("Order");

        RuleForEach(x => x.Workouts).ChildRules(workout =>
        {
            workout.RuleFor(w => w.Name)
                .NotEmpty().WithErrorCode(ErrorCodes.Required)
                .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

            workout.RuleForEach(w => w.Exercises).ChildRules(exercise =>
            {
                exercise.RuleFor(e => e.ExerciseExternalId)
                    .NotEmpty().WithErrorCode(ErrorCodes.Required);

                exercise.RuleFor(e => e.ExerciseName)
                    .NotEmpty().WithErrorCode(ErrorCodes.Required);

                exercise.RuleFor(e => e.Order)
                    .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);
            });
        });

        // Standalone exercise Order is validated >= 1 — matches UpdateSessionExerciseRequest.Order
        // exactly (TrainingWorkout.Order is documented 0-based; SessionExercise.Order is 1-based).
        RuleForEach(x => x.StandaloneExercises).ChildRules(exercise =>
        {
            exercise.RuleFor(e => e.ExerciseExternalId)
                .NotEmpty().WithErrorCode(ErrorCodes.Required);

            exercise.RuleFor(e => e.ExerciseName)
                .NotEmpty().WithErrorCode(ErrorCodes.Required);

            exercise.RuleFor(e => e.Order)
                .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);
        });
    }
}
