using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;
using FitnessPlatform.Application.Features.WorkoutTemplates.UpdateWorkoutTemplate;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="UpdateWorkoutTemplateValidator"/>, covering the format-config rules it
/// now shares with every other call site via <c>TrainingContentRuleSet.ApplyFormatConfigRules</c>
/// (#1024). Before this issue the validator reached cross-namespace into
/// <c>CreateWorkoutTemplateValidator</c>'s internal static copy of that method, which produced an
/// empty <c>PropertyName</c> on Linux/x64 (#276) — the WOD mutation rows below prove the shared,
/// whole-object form is wired correctly at both the root (prefix "Workout") and per-exercise
/// (prefix "Exercise") call sites.
/// </summary>
public class UpdateWorkoutTemplateValidatorTests
{
    private readonly UpdateWorkoutTemplateValidator _validator = new();

    private static CreateWorkoutTemplateExerciseRequest ValidExercise() => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = "Back Squat",
        Order = 1,
        RestSeconds = 60
    };

    private static UpdateWorkoutTemplateRequest ValidRequest() => new()
    {
        TemplateId = Guid.NewGuid(),
        Name = "Push Day",
        Version = 1,
        DefaultExercises = [ValidExercise()]
    };

    [Fact]
    public void BaselineRequest_IsValid()
    {
        // Anti-100%-rejection guard: proves the fragment doesn't reject everything before the
        // mutation rows below prove it doesn't silently drop a rule either.
        _validator.TestValidate(ValidRequest()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void TemplateId_Empty_FailsValidation()
    {
        var req = ValidRequest();
        req.TemplateId = Guid.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TemplateId);
    }

    [Theory]
    [MemberData(nameof(FormatConfigMutationRows))]
    public void FormatConfig_Mutation_RejectsWithExpectedCode(
        string name, Func<UpdateWorkoutTemplateRequest> buildInvalid, string expectedCode, string? expectedName)
    {
        var result = _validator.TestValidate(buildInvalid());

        result.Errors.Should().Contain(e => e.ErrorCode == expectedCode, $"{name} must reject with {expectedCode}");

        if (expectedName is not null)
        {
            // WithName() pins only the leaf segment; FluentValidation still prefixes it with the
            // enclosing RuleForEach path for exercise-level rows. Assert the pinned suffix.
            result.Errors.Should().Contain(
                e => e.ErrorCode == expectedCode && e.PropertyName.EndsWith(expectedName, StringComparison.OrdinalIgnoreCase),
                $"{name} must pin PropertyName ending in '{expectedName}'");
        }
    }

    public static IEnumerable<object[]> FormatConfigMutationRows()
    {
        object[] Row(string name, Func<UpdateWorkoutTemplateRequest> build, string code, string pinnedName) =>
            [name, build, code, pinnedName];

        // Root level (prefix "Workout") — DefaultFormat / DefaultFormatConfig.
        yield return Row("Root.Emom_IntervalSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.EMOM;
                req.DefaultFormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
                return req;
            }, ErrorCodes.OutOfRange, "IntervalSeconds");

        yield return Row("Root.Emom_TotalRounds_Null",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.EMOM;
                req.DefaultFormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = null };
                return req;
            }, ErrorCodes.OutOfRange, "TotalRounds");

        yield return Row("Root.Amrap_TimeCapSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.AMRAP;
                req.DefaultFormatConfig = new WodConfig { TimeCapSeconds = 0 };
                return req;
            }, ErrorCodes.OutOfRange, "TimeCapSeconds");

        yield return Row("Root.ForTime_TimeCapSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.ForTime;
                req.DefaultFormatConfig = new WodConfig { TimeCapSeconds = 0 };
                return req;
            }, ErrorCodes.OutOfRange, "TimeCapSeconds");

        yield return Row("Root.Tabata_WorkSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.Tabata;
                req.DefaultFormatConfig = new WodConfig { WorkSeconds = 0, RestSeconds = 10, TotalRounds = 8 };
                return req;
            }, ErrorCodes.OutOfRange, "WorkSeconds");

        yield return Row("Root.Tabata_RestSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.Tabata;
                req.DefaultFormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 0, TotalRounds = 8 };
                return req;
            }, ErrorCodes.OutOfRange, "RestSeconds");

        yield return Row("Root.Tabata_TotalRounds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultFormat = WorkoutFormat.Tabata;
                req.DefaultFormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 10, TotalRounds = 0 };
                return req;
            }, ErrorCodes.OutOfRange, "TotalRounds");

        // Per-exercise level (prefix "Exercise") — DefaultExercises[0].Format / .FormatConfig.
        yield return Row("Exercise.Emom_IntervalSeconds_Zero",
            () =>
            {
                var req = ValidRequest();
                req.DefaultExercises[0].Format = WorkoutFormat.EMOM;
                req.DefaultExercises[0].FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
                return req;
            }, ErrorCodes.OutOfRange, "IntervalSeconds");

        yield return Row("Exercise.Tabata_RestSeconds_Zero_KeepsExerciseRestSecondsValid",
            () =>
            {
                // The exercise's own RestSeconds (0..600) and the Tabata WodConfig.RestSeconds both
                // resolve to PropertyName "RestSeconds" — keep the exercise's own RestSeconds at a
                // valid 60 so this row unambiguously fires the WOD rule, not the range rule.
                var req = ValidRequest();
                req.DefaultExercises[0].RestSeconds = 60;
                req.DefaultExercises[0].Format = WorkoutFormat.Tabata;
                req.DefaultExercises[0].FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 0, TotalRounds = 8 };
                return req;
            }, ErrorCodes.OutOfRange, "RestSeconds");
    }
}
