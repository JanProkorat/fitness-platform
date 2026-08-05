using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="CreateSessionTemplateValidator"/> — in particular the order-base
/// asymmetry pinned by issue #860's design review: <see cref="TrainingWorkout.Order"/> is
/// 0-based, standalone <see cref="SessionExercise.Order"/> is validated &gt;= 1, and both share
/// ONE combined-distinct check keyed to <see cref="ErrorCodes.TrainingDuplicateSessionOrder"/> —
/// mirroring <c>UpdateTrainingPlanValidator</c> exactly.
/// </summary>
public class CreateSessionTemplateValidatorTests
{
    private readonly CreateSessionTemplateValidator _validator = new();

    private static SessionExercise MakeExercise(int order = 1) => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = "Back Squat",
        Order = order
    };

    private static TrainingWorkout MakeWorkout(int order = 0, List<SessionExercise>? exercises = null) => new()
    {
        WorkoutId = Guid.NewGuid(),
        Order = order,
        Name = "Main",
        Exercises = exercises ?? [MakeExercise()]
    };

    private static CreateSessionTemplateRequest ValidRequest() => new()
    {
        Name = "Push Day",
        Difficulty = ExerciseDifficulty.Beginner,
        Workouts = [MakeWorkout()]
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Name_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.Name = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Difficulty_OutOfEnum_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Difficulty = (ExerciseDifficulty)99;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Difficulty).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Visibility_OutOfEnum_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Visibility = (LibraryVisibility)99;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Visibility).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void NoWorkoutsAndNoStandaloneExercises_FailsWithWorkoutsRequiredCode()
    {
        var req = ValidRequest();
        req.Workouts = [];
        req.StandaloneExercises = [];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.WorkoutsRequired);
    }

    [Fact]
    public void OnlyStandaloneExercises_NoWorkouts_PassesValidation()
    {
        // #857 phase 3a parity: a lone standalone exercise is a complete, valid template.
        var req = ValidRequest();
        req.Workouts = [];
        req.StandaloneExercises = [MakeExercise(order: 1)];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void DuplicateOrder_WithinWorkouts_FailsWithWorkoutOrderDuplicateCode()
    {
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(order: 0), MakeWorkout(order: 0)];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.WorkoutOrderDuplicate);
    }

    [Fact]
    public void DuplicateOrder_AcrossWorkoutAndStandaloneExercise_FailsWithTrainingDuplicateSessionOrderCode()
    {
        // The property this test pins: a workout's 0-based Order and a standalone exercise's
        // 1-based Order share ONE ordering sequence. Workout Order=0 colliding with a
        // standalone exercise's Order... note SessionExercise.Order is validated >= 1, so the
        // realistic collision is a workout at Order=1 vs a standalone exercise at Order=1.
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(order: 1)];
        req.StandaloneExercises = [MakeExercise(order: 1)];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.TrainingDuplicateSessionOrder);
    }

    [Fact]
    public void StandaloneExerciseOrderZero_FailsWithOutOfRangeCode()
    {
        // Standalone exercise Order is validated >= 1 — matches UpdateSessionExerciseRequest.Order.
        var req = ValidRequest();
        req.StandaloneExercises = [MakeExercise(order: 0)];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void WorkoutOrderZero_IsLegal_0Based()
    {
        // TrainingWorkout.Order is documented 0-based — no minimum-value rule applies to it,
        // matching UpdateTrainingPlanValidator (which also has no min-value rule on workout Order).
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(order: 0)];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void WorkoutName_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.Workouts = [new TrainingWorkout { WorkoutId = Guid.NewGuid(), Order = 0, Name = "", Exercises = [MakeExercise()] }];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.Required);
    }

    [Fact]
    public void NestedExercise_MissingExerciseExternalId_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(exercises: [new SessionExercise { ExerciseExternalId = Guid.Empty, ExerciseName = "X", Order = 1 }])];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.Required);
    }
}
