using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.CreateTemplate;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Unit tests for <see cref="CreateTemplateValidator"/> (training plan templates, #862 review
/// MAJOR): a caller-supplied week tree must reject an invalid inner <c>WodConfig</c> at
/// template-create time, with the same rigor <c>UpdateTrainingPlanValidator</c> applies on the
/// plan write path — otherwise <c>instantiate</c> clones the bad config verbatim into a real
/// <see cref="Domain.Documents.TrainingPlan"/> that its own PUT would reject with 400.
/// </summary>
/// <remarks>
/// Asserts on <c>ErrorCode</c>, never on <c>PropertyName</c> — this repo's global camelCasing
/// <c>PropertyNameResolver</c> only takes effect once the full app host has booted, so a bare
/// validator-only test run sees the raw FluentValidation default instead, and a
/// <c>PropertyName</c> assertion that happens to pass in isolation can flake under the full suite.
/// </remarks>
public class CreateTrainingPlanTemplateValidatorTests
{
    private readonly CreateTemplateValidator _validator = new();

    /// <summary>
    /// Builds an otherwise-valid week with a single session carrying one workout with one
    /// exercise, so <c>Format</c>/<c>FormatConfig</c> at each of the three levels can be varied
    /// independently by the caller.
    /// </summary>
    private static TemplateWeekRequest BuildValidWeek() => new()
    {
        WeekNumber = 1,
        Days =
        [
            new TemplateDayRequest
            {
                DayOfWeek = 1,
                Sessions =
                [
                    new TemplateSessionRequest
                    {
                        Name = "Push Day",
                        Order = 1,
                        Workouts =
                        [
                            new TemplateWorkoutRequest
                            {
                                Order = 0,
                                Name = "Main",
                                Exercises =
                                [
                                    new TemplateSessionExerciseRequest
                                    {
                                        ExerciseExternalId = Guid.NewGuid(),
                                        ExerciseName = "Bench Press",
                                        Order = 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    private static CreateTemplateRequest BuildRequest(TemplateWeekRequest week) => new()
    {
        Name = "Test Template",
        Weeks = [week]
    };

    [Fact]
    public void Validate_SessionEmomWithValidWodConfig_Passes()
    {
        var week = BuildValidWeek();
        var session = week.Days[0].Sessions[0];
        session.Format = WorkoutFormat.EMOM;
        session.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 };

        var result = _validator.TestValidate(BuildRequest(week));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_SessionEmomWithEmptyWodConfig_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        var session = week.Days[0].Sessions[0];
        session.Format = WorkoutFormat.EMOM;
        session.FormatConfig = new WodConfig(); // IntervalSeconds/TotalRounds missing

        var result = _validator.TestValidate(BuildRequest(week));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_WorkoutTabataWithEmptyWodConfig_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        var workout = week.Days[0].Sessions[0].Workouts[0];
        workout.Format = WorkoutFormat.Tabata;
        workout.FormatConfig = new WodConfig(); // WorkSeconds/RestSeconds/TotalRounds missing

        var result = _validator.TestValidate(BuildRequest(week));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_ExerciseAmrapWithEmptyWodConfig_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        var exercise = week.Days[0].Sessions[0].Workouts[0].Exercises[0];
        exercise.Format = WorkoutFormat.AMRAP;
        exercise.FormatConfig = new WodConfig(); // TimeCapSeconds missing

        var result = _validator.TestValidate(BuildRequest(week));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_WeekCountAndWeeksBothSupplied_FailsWithMutuallyExclusiveFieldsCode()
    {
        var request = BuildRequest(BuildValidWeek());
        request.WeekCount = 4;

        var result = _validator.TestValidate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.MutuallyExclusiveFields);
    }
}
