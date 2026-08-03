using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Unit tests for <see cref="UpdateTrainingPlanValidator"/>'s duplicate-order rule (#857
/// AC bullet 5): standalone exercises and workouts share ONE ordering sequence within a
/// session, so a duplicate <c>Order</c> across the two lists must be rejected with the stable
/// <see cref="ErrorCodes.TrainingDuplicateSessionOrder"/> code.
/// </summary>
/// <remarks>
/// Asserts on <c>ErrorCode</c>/<c>ErrorMessage</c>, never on <c>PropertyName</c> — the rule is
/// declared via <c>session.RuleFor(s => s).Must(...).WithName("Order")</c> (a whole-object rule
/// with an explicit name override, not a direct property selector), and this repo's app-booting
/// tests install a global camelCasing <c>PropertyNameResolver</c> that only takes effect once
/// the full test host has spun up — a bare validator-only test run (as here) sees the raw
/// FluentValidation default instead, so a <c>PropertyName</c> assertion that happens to pass in
/// isolation can flake under the full suite. <c>ErrorCode</c>/<c>ErrorMessage</c> are stable
/// regardless of which resolver is active.
/// </remarks>
public class UpdateTrainingPlanValidatorTests
{
    private readonly UpdateTrainingPlanValidator _validator = new();

    /// <summary>
    /// Builds an otherwise-valid request with a single session carrying one workout (holding one
    /// nested exercise) and one standalone exercise, so the two <c>Order</c> values under test
    /// can be varied independently.
    /// </summary>
    private static UpdateTrainingPlanRequest BuildRequest(int workoutOrder, int standaloneExerciseOrder) => new()
    {
        PlanId = Guid.NewGuid(),
        Name = "Test Plan",
        Version = 1,
        Weeks =
        [
            new UpdateTrainingWeekRequest
            {
                WeekNumber = 1,
                Sessions =
                [
                    new UpdateSessionRequest
                    {
                        SessionId = Guid.NewGuid(),
                        DayOfWeek = 1,
                        Name = "Push Day",
                        Order = 1,
                        Workouts =
                        [
                            new UpdateWorkoutRequest
                            {
                                WorkoutId = Guid.NewGuid(),
                                Order = workoutOrder,
                                Name = "Main",
                                Exercises =
                                [
                                    new UpdateSessionExerciseRequest
                                    {
                                        ExerciseId = Guid.NewGuid(),
                                        ExerciseExternalId = Guid.NewGuid(),
                                        ExerciseName = "Push-up",
                                        Order = 1
                                    }
                                ]
                            }
                        ],
                        Exercises =
                        [
                            new UpdateSessionExerciseRequest
                            {
                                ExerciseId = Guid.NewGuid(),
                                ExerciseExternalId = Guid.NewGuid(),
                                ExerciseName = "Plank",
                                Order = standaloneExerciseOrder
                            }
                        ]
                    }
                ]
            }
        ]
    };

    [Fact]
    public void Validate_DuplicateOrderAcrossStandaloneExerciseAndWorkout_FailsWithDuplicateSessionOrderCode()
    {
        // The workout (Order = 1) and the standalone exercise (Order = 1) collide — they share
        // one ordering sequence within the session (#857 phase 3a).
        var result = _validator.TestValidate(BuildRequest(workoutOrder: 1, standaloneExerciseOrder: 1));

        result.Errors.Should().Contain(error =>
            error.ErrorCode == ErrorCodes.TrainingDuplicateSessionOrder &&
            error.ErrorMessage ==
                "Duplicate Order values are not allowed across a session's standalone exercises and workouts.");
    }

    [Fact]
    public void Validate_DistinctOrderAcrossStandaloneExerciseAndWorkout_Passes()
    {
        var result = _validator.TestValidate(BuildRequest(workoutOrder: 0, standaloneExerciseOrder: 1));

        result.Errors.Should().NotContain(error => error.ErrorCode == ErrorCodes.TrainingDuplicateSessionOrder);
        result.IsValid.Should().BeTrue();
    }
}
