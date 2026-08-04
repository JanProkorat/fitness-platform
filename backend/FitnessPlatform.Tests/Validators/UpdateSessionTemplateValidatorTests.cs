using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="UpdateSessionTemplateValidator"/> — mirrors
/// <see cref="CreateSessionTemplateValidatorTests"/>'s ordering-rule coverage; the two validators
/// intentionally duplicate the same small rule set rather than sharing a generic helper (below
/// the project's rule-of-three threshold for extraction).
/// </summary>
public class UpdateSessionTemplateValidatorTests
{
    private readonly UpdateSessionTemplateValidator _validator = new();

    private static SessionExercise MakeExercise(int order = 1) => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = "Back Squat",
        Order = order
    };

    private static TrainingWorkout MakeWorkout(int order = 0) => new()
    {
        WorkoutId = Guid.NewGuid(),
        Order = order,
        Name = "Main",
        Exercises = [MakeExercise()]
    };

    private static UpdateSessionTemplateRequest ValidRequest() => new()
    {
        TemplateId = Guid.NewGuid(),
        Name = "Push Day",
        Difficulty = ExerciseDifficulty.Beginner,
        Workouts = [MakeWorkout()],
        Version = 1
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
    public void DuplicateOrder_AcrossWorkoutAndStandaloneExercise_FailsWithTrainingDuplicateSessionOrderCode()
    {
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(order: 1)];
        req.StandaloneExercises = [MakeExercise(order: 1)];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.TrainingDuplicateSessionOrder);
    }

    [Fact]
    public void StandaloneExerciseOrderZero_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.StandaloneExercises = [MakeExercise(order: 0)];

        var result = _validator.TestValidate(req);
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void WorkoutOrderZero_IsLegal_0Based()
    {
        var req = ValidRequest();
        req.Workouts = [MakeWorkout(order: 0)];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
