using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// #892's mutation matrix: proves <see cref="TrainingContentRuleSet"/>'s rules are
/// applied identically by the plan write path (<see cref="UpdateTrainingPlanValidator"/>) and both
/// session-template validators (<see cref="CreateSessionTemplateValidator"/>,
/// <see cref="UpdateSessionTemplateValidator"/>) — the AC that actually matters ("no rule the plan
/// write path currently enforces may be weakened"), which a green test suite alone does not prove.
/// </summary>
/// <remarks>
/// <para>
/// <b>Anti-100%-rejection guard.</b> The <c>Baseline*_IsValid</c> facts assert the shared valid
/// baseline passes with ZERO errors on every validator. Combined with the per-row assertions below
/// (each mutating exactly ONE field away from that same baseline), this proves the fragment neither
/// rejects everything (baseline would fail) nor silently drops a rule (the targeted mutation would
/// stop producing its expected code).
/// </para>
/// <para>
/// <b>PropertyName.</b> Asserted ONLY on the WOD inner-field rows, where <c>WithName(...)</c> pins
/// an explicit override on a whole-object <c>Must()</c> rule that has no real property to derive a
/// name from (see <see cref="TrainingContentRuleSet.ApplyFormatConfigRules{T}"/>'s
/// remarks, issue #276). Everywhere else this anchors on <c>ErrorCode</c>/<c>ErrorMessage</c> only,
/// per <c>rules/validation.md#testing-validators</c> — the global camelCasing
/// <c>PropertyNameResolver</c> only engages once the full app host boots, so any other
/// <c>PropertyName</c> assertion here would pass in isolation and flake under the full suite.
/// </para>
/// <para>
/// <b>Scope.</b> Covers every rule <see cref="TrainingContentRuleSet"/> owns. The
/// three plan-path session-level rules with no session-template counterpart (<c>DayOfWeek</c>,
/// session <c>Order</c>, <c>SessionId</c>) are NOT part of the shared fragment and are out of scope
/// here — they are exercised by <see cref="UpdateTrainingPlanValidatorTests"/>.
/// </para>
/// </remarks>
public class TrainingContentRuleSetMutationMatrixTests
{
    // ───────────────────────── Plan write path (UpdateTrainingPlanValidator) ─────────────────────────

    private static UpdateExerciseSetRequest ValidSet() => new()
    {
        SetNumber = 1,
        Reps = 10,
        WeightKg = 20,
        Rpe = 5
    };

    private static UpdateSessionExerciseRequest ValidExercise() => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = "Back Squat",
        Order = 1,
        RestSeconds = 60,
        Sets = [ValidSet()]
    };

    private static UpdateTrainingWorkoutRequest ValidWorkout() => new()
    {
        WorkoutId = Guid.NewGuid(),
        Order = 0,
        Name = "Main",
        Exercises = [ValidExercise()]
    };

    private static UpdateTrainingPlanRequest BuildPlanRequest(
        Action<UpdateSessionExerciseRequest>? exercise = null,
        Action<UpdateTrainingWorkoutRequest>? workout = null,
        Action<UpdateSessionRequest>? session = null)
    {
        var ex = ValidExercise();
        exercise?.Invoke(ex);

        var wo = ValidWorkout();
        wo.Exercises = [ex];
        workout?.Invoke(wo);

        var se = new UpdateSessionRequest
        {
            SessionId = Guid.NewGuid(),
            DayOfWeek = 1,
            Name = "Push Day",
            Order = 1,
            Workouts = [wo],
            StandaloneExercises = []
        };
        session?.Invoke(se);

        return new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [se] }]
        };
    }

    [Fact]
    public void BaselinePlanRequest_IsValid()
    {
        new UpdateTrainingPlanValidator().TestValidate(BuildPlanRequest()).IsValid.Should().BeTrue();
    }

    [Theory]
    [MemberData(nameof(PlanMutationRows))]
    public void PlanValidator_Mutation_RejectsWithExpectedCode(
        string name, Func<UpdateTrainingPlanRequest> buildInvalid, string expectedCode, string? expectedName)
    {
        var result = new UpdateTrainingPlanValidator().TestValidate(buildInvalid());

        result.Errors.Should().Contain(e => e.ErrorCode == expectedCode, $"{name} must reject with {expectedCode}");

        if (expectedName is not null)
        {
            // The pinned WithName("IntervalSeconds") override only fixes the LEAF segment of the
            // resolved PropertyName — FluentValidation still prefixes it with the full indexed path
            // built up by the enclosing RuleForEach frames (e.g. "Weeks[0].Sessions[0].Workouts[0][0].IntervalSeconds"),
            // which differs by nesting depth across the plan/Create/Update call sites. Assert the
            // pinned suffix, not exact equality.
            result.Errors.Should().Contain(
                e => e.ErrorCode == expectedCode && e.PropertyName.EndsWith(expectedName, StringComparison.Ordinal),
                $"{name} must pin PropertyName ending in '{expectedName}' via the #276 WithName override");
        }
    }

    public static IEnumerable<object[]> PlanMutationRows()
    {
        object[] Row(string name, Func<UpdateTrainingPlanRequest> build, string code, string? pinnedName = null) =>
            [name, build, code, pinnedName!];

        yield return Row("Exercise.ExerciseExternalId_Empty",
            () => BuildPlanRequest(exercise: e => e.ExerciseExternalId = Guid.Empty), ErrorCodes.Required);
        yield return Row("Exercise.ExerciseName_Empty",
            () => BuildPlanRequest(exercise: e => e.ExerciseName = ""), ErrorCodes.Required);
        yield return Row("Exercise.Order_BelowOne",
            () => BuildPlanRequest(exercise: e => e.Order = 0), ErrorCodes.OutOfRange);
        yield return Row("Exercise.RestSeconds_AboveSixHundred",
            () => BuildPlanRequest(exercise: e => e.RestSeconds = 601), ErrorCodes.OutOfRange);
        yield return Row("Exercise.RestSeconds_BelowZero",
            () => BuildPlanRequest(exercise: e => e.RestSeconds = -1), ErrorCodes.OutOfRange);
        yield return Row("Exercise.FormatConfig_NotNull_WhenStandard",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.Standard;
                e.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }), ErrorCodes.OutOfRange);
        yield return Row("Exercise.FormatConfig_Null_WhenNonStandard",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = null;
            }), ErrorCodes.OutOfRange);
        yield return Row("Exercise.Sets_AboveTwenty",
            () => BuildPlanRequest(exercise: e => e.Sets = Enumerable.Range(1, 21).Select(n => new UpdateExerciseSetRequest { SetNumber = n }).ToList()),
            ErrorCodes.OutOfRange);
        yield return Row("Set.SetNumber_BelowOne",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 0 }]), ErrorCodes.OutOfRange);
        yield return Row("Set.Reps_AboveThousand",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 1, Reps = 1001 }]), ErrorCodes.OutOfRange);
        yield return Row("Set.Reps_BelowOne",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 1, Reps = 0 }]), ErrorCodes.OutOfRange);
        yield return Row("Set.WeightKg_Negative",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 1, WeightKg = -1 }]), ErrorCodes.OutOfRange);
        yield return Row("Set.Rpe_AboveTen",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 1, Rpe = 11 }]), ErrorCodes.OutOfRange);
        yield return Row("Set.Rpe_BelowOne",
            () => BuildPlanRequest(exercise: e => e.Sets = [new UpdateExerciseSetRequest { SetNumber = 1, Rpe = 0 }]), ErrorCodes.OutOfRange);

        yield return Row("Workout.Name_Empty",
            () => BuildPlanRequest(workout: w => w.Name = ""), ErrorCodes.Required);
        yield return Row("Workout.Exercises_AboveThirty",
            () => BuildPlanRequest(workout: w => w.Exercises = Enumerable.Range(1, 31)
                .Select(n => new UpdateSessionExerciseRequest { ExerciseExternalId = Guid.NewGuid(), ExerciseName = $"Ex{n}", Order = n }).ToList()),
            ErrorCodes.OutOfRange);
        yield return Row("Workout.FormatConfig_NotNull_WhenStandard",
            () => BuildPlanRequest(workout: w =>
            {
                w.Format = WorkoutFormat.Standard;
                w.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }), ErrorCodes.OutOfRange);
        yield return Row("Workout.FormatConfig_Null_WhenNonStandard",
            () => BuildPlanRequest(workout: w =>
            {
                w.Format = WorkoutFormat.EMOM;
                w.FormatConfig = null;
            }), ErrorCodes.OutOfRange);

        yield return Row("Session.CombinedOrder_DuplicateAcrossWorkoutAndStandalone",
            () => BuildPlanRequest(session: se =>
            {
                se.Workouts[0].Order = 1;
                se.StandaloneExercises = [new UpdateSessionExerciseRequest { ExerciseExternalId = Guid.NewGuid(), ExerciseName = "Plank", Order = 1 }];
            }), ErrorCodes.TrainingDuplicateSessionOrder, "Order");

        // WOD inner-field bounds — exercised at exercise level, pinned WithName asserted per #276.
        yield return Row("Exercise.Wod.Emom_IntervalSeconds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }), ErrorCodes.OutOfRange, "IntervalSeconds");
        yield return Row("Exercise.Wod.Emom_TotalRounds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 0 };
            }), ErrorCodes.OutOfRange, "TotalRounds");
        yield return Row("Exercise.Wod.ForTime_TimeCapSeconds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.ForTime;
                e.FormatConfig = new WodConfig { TimeCapSeconds = 0 };
            }), ErrorCodes.OutOfRange, "TimeCapSeconds");
        yield return Row("Exercise.Wod.Tabata_WorkSeconds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 0, RestSeconds = 10, TotalRounds = 8 };
            }), ErrorCodes.OutOfRange, "WorkSeconds");
        yield return Row("Exercise.Wod.Tabata_RestSeconds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 0, TotalRounds = 8 };
            }), ErrorCodes.OutOfRange, "RestSeconds");
        yield return Row("Exercise.Wod.Tabata_TotalRounds_Zero",
            () => BuildPlanRequest(exercise: e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 10, TotalRounds = 0 };
            }), ErrorCodes.OutOfRange, "TotalRounds");

        // Spot-check the fragment threads through the workout and session recursion levels too —
        // not a full re-run of all six WOD formats there, just proof ApplyFormatConfigRules is
        // actually reached at every level it's called from.
        yield return Row("Workout.Wod.Emom_IntervalSeconds_Zero",
            () => BuildPlanRequest(workout: w =>
            {
                w.Format = WorkoutFormat.EMOM;
                w.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }), ErrorCodes.OutOfRange, "IntervalSeconds");
        yield return Row("Session.Wod.Emom_IntervalSeconds_Zero",
            () => BuildPlanRequest(session: se =>
            {
                se.Format = WorkoutFormat.EMOM;
                se.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }), ErrorCodes.OutOfRange, "IntervalSeconds");
    }

    // ───────────────────────── Session templates (Create / Update) ─────────────────────────
    //
    // Was-accepted-now-rejected coverage: before #892 neither session-template validator enforced
    // ANY of the rows below (RestSeconds bounds, the 30-exercise/30-standalone caps, FormatConfig
    // null-ness, WOD inner-field bounds, the 20-set cap, or per-set bounds) — every failing
    // assertion below is therefore also proof of a 2xx-to-400 behaviour change on two shipped
    // routes, not merely new coverage of an existing rule.

    private static ExerciseSet ValidDocSet() => new()
    {
        SetNumber = 1,
        Reps = 10,
        WeightKg = 20,
        Rpe = 5
    };

    private static SessionExercise ValidDocExercise() => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = "Back Squat",
        Order = 1,
        RestSeconds = 60,
        Sets = [ValidDocSet()]
    };

    private static TrainingWorkout ValidDocWorkout() => new()
    {
        WorkoutId = Guid.NewGuid(),
        Order = 0,
        Name = "Main",
        Exercises = [ValidDocExercise()]
    };

    private static CreateSessionTemplateRequest BuildCreateRequest(
        Action<SessionExercise>? exercise = null,
        Action<TrainingWorkout>? workout = null,
        Action<CreateSessionTemplateRequest>? session = null)
    {
        var ex = ValidDocExercise();
        exercise?.Invoke(ex);

        var wo = ValidDocWorkout();
        wo.Exercises = [ex];
        workout?.Invoke(wo);

        var req = new CreateSessionTemplateRequest
        {
            Name = "Push Day",
            Difficulty = ExerciseDifficulty.Beginner,
            Workouts = [wo],
            StandaloneExercises = []
        };
        session?.Invoke(req);

        return req;
    }

    private static UpdateSessionTemplateRequest BuildUpdateRequest(
        Action<SessionExercise>? exercise = null,
        Action<TrainingWorkout>? workout = null,
        Action<UpdateSessionTemplateRequest>? session = null)
    {
        var ex = ValidDocExercise();
        exercise?.Invoke(ex);

        var wo = ValidDocWorkout();
        wo.Exercises = [ex];
        workout?.Invoke(wo);

        var req = new UpdateSessionTemplateRequest
        {
            TemplateId = Guid.NewGuid(),
            Name = "Push Day",
            Difficulty = ExerciseDifficulty.Beginner,
            Workouts = [wo],
            StandaloneExercises = [],
            Version = 1
        };
        session?.Invoke(req);

        return req;
    }

    [Fact]
    public void BaselineCreateSessionTemplateRequest_IsValid()
    {
        new CreateSessionTemplateValidator().TestValidate(BuildCreateRequest()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void BaselineUpdateSessionTemplateRequest_IsValid()
    {
        new UpdateSessionTemplateValidator().TestValidate(BuildUpdateRequest()).IsValid.Should().BeTrue();
    }

    [Theory]
    [MemberData(nameof(SessionTemplateMutationRows))]
    public void CreateSessionTemplateValidator_Mutation_RejectsWithExpectedCode(
        string name,
        Action<SessionExercise>? exercise, Action<TrainingWorkout>? workout, Action<CreateSessionTemplateRequest>? session,
        string expectedCode, string? expectedName)
    {
        var request = BuildCreateRequest(exercise, workout, session);
        var result = new CreateSessionTemplateValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == expectedCode, $"{name} must reject with {expectedCode} on Create");

        if (expectedName is not null)
        {
            result.Errors.Should().Contain(
                e => e.ErrorCode == expectedCode && e.PropertyName.EndsWith(expectedName, StringComparison.Ordinal),
                $"{name} must pin PropertyName ending in '{expectedName}' via the #276 WithName override on Create");
        }
    }

    [Theory]
    [MemberData(nameof(SessionTemplateMutationRowsForUpdate))]
    public void UpdateSessionTemplateValidator_Mutation_RejectsWithExpectedCode(
        string name,
        Action<SessionExercise>? exercise, Action<TrainingWorkout>? workout, Action<UpdateSessionTemplateRequest>? session,
        string expectedCode, string? expectedName)
    {
        var request = BuildUpdateRequest(exercise, workout, session);
        var result = new UpdateSessionTemplateValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == expectedCode, $"{name} must reject with {expectedCode} on Update");

        if (expectedName is not null)
        {
            result.Errors.Should().Contain(
                e => e.ErrorCode == expectedCode && e.PropertyName.EndsWith(expectedName, StringComparison.Ordinal),
                $"{name} must pin PropertyName ending in '{expectedName}' via the #276 WithName override on Update");
        }
    }

    /// <summary>
    /// Shared (exercise/workout mutations, error code, pinned name) tuples — identical across
    /// Create and Update since both validators route through the same
    /// <see cref="Domain.Services.TrainingContentRuleSet"/> calls. Session-level mutations are
    /// typed per-request below since <see cref="CreateSessionTemplateRequest"/> and
    /// <see cref="UpdateSessionTemplateRequest"/> are distinct types.
    /// </summary>
    public static IEnumerable<object[]> SessionTemplateMutationRows()
    {
        foreach (var row in SharedRows())
        {
            yield return [row.Name, row.Exercise!, row.Workout!, null!, row.Code, row.Name2!];
        }

        object[] SessionRow(string name, Action<CreateSessionTemplateRequest> session, string code, string? pinnedName = null) =>
            [name, null!, null!, session, code, pinnedName!];

        yield return SessionRow("Session.Wod.Emom_IntervalSeconds_Zero",
            r =>
            {
                r.Format = WorkoutFormat.EMOM;
                r.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }, ErrorCodes.OutOfRange, "IntervalSeconds");
        yield return SessionRow("Session.FormatConfig_NotNull_WhenStandard",
            r =>
            {
                r.Format = WorkoutFormat.Standard;
                r.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }, ErrorCodes.OutOfRange);
        yield return SessionRow("Session.FormatConfig_Null_WhenNonStandard",
            r =>
            {
                r.Format = WorkoutFormat.EMOM;
                r.FormatConfig = null;
            }, ErrorCodes.OutOfRange);
        yield return SessionRow("Session.CombinedOrder_DuplicateAcrossWorkoutAndStandalone",
            r =>
            {
                r.Workouts[0].Order = 1;
                r.StandaloneExercises = [new SessionExercise { ExerciseExternalId = Guid.NewGuid(), ExerciseName = "Plank", Order = 1 }];
            }, ErrorCodes.TrainingDuplicateSessionOrder, "Order");
        yield return SessionRow("StandaloneExercises_AboveThirty",
            r => r.StandaloneExercises = Enumerable.Range(1, 31)
                .Select(n => new SessionExercise { ExerciseExternalId = Guid.NewGuid(), ExerciseName = $"Ex{n}", Order = n }).ToList(),
            ErrorCodes.OutOfRange);
    }

    /// <summary>Same shape as <see cref="SessionTemplateMutationRows"/>, typed for Update.</summary>
    public static IEnumerable<object[]> SessionTemplateMutationRowsForUpdate()
    {
        foreach (var row in SharedRows())
        {
            yield return [row.Name, row.Exercise!, row.Workout!, null!, row.Code, row.Name2!];
        }

        object[] SessionRow(string name, Action<UpdateSessionTemplateRequest> session, string code, string? pinnedName = null) =>
            [name, null!, null!, session, code, pinnedName!];

        yield return SessionRow("Session.Wod.Emom_IntervalSeconds_Zero",
            r =>
            {
                r.Format = WorkoutFormat.EMOM;
                r.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }, ErrorCodes.OutOfRange, "IntervalSeconds");
        yield return SessionRow("Session.FormatConfig_NotNull_WhenStandard",
            r =>
            {
                r.Format = WorkoutFormat.Standard;
                r.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }, ErrorCodes.OutOfRange);
        yield return SessionRow("Session.FormatConfig_Null_WhenNonStandard",
            r =>
            {
                r.Format = WorkoutFormat.EMOM;
                r.FormatConfig = null;
            }, ErrorCodes.OutOfRange);
        yield return SessionRow("Session.CombinedOrder_DuplicateAcrossWorkoutAndStandalone",
            r =>
            {
                r.Workouts[0].Order = 1;
                r.StandaloneExercises = [new SessionExercise { ExerciseExternalId = Guid.NewGuid(), ExerciseName = "Plank", Order = 1 }];
            }, ErrorCodes.TrainingDuplicateSessionOrder, "Order");
        yield return SessionRow("StandaloneExercises_AboveThirty",
            r => r.StandaloneExercises = Enumerable.Range(1, 31)
                .Select(n => new SessionExercise { ExerciseExternalId = Guid.NewGuid(), ExerciseName = $"Ex{n}", Order = n }).ToList(),
            ErrorCodes.OutOfRange);
    }

    private static IEnumerable<(string Name, Action<SessionExercise>? Exercise, Action<TrainingWorkout>? Workout, string Code, string? Name2)> SharedRows()
    {
        yield return ("Exercise.ExerciseExternalId_Empty", e => e.ExerciseExternalId = Guid.Empty, null, ErrorCodes.Required, null);
        yield return ("Exercise.ExerciseName_Empty", e => e.ExerciseName = "", null, ErrorCodes.Required, null);
        yield return ("Exercise.Order_BelowOne", e => e.Order = 0, null, ErrorCodes.OutOfRange, null);
        yield return ("Exercise.RestSeconds_AboveSixHundred", e => e.RestSeconds = 601, null, ErrorCodes.OutOfRange, null);
        yield return ("Exercise.RestSeconds_BelowZero", e => e.RestSeconds = -1, null, ErrorCodes.OutOfRange, null);
        yield return ("Exercise.FormatConfig_NotNull_WhenStandard",
            e =>
            {
                e.Format = WorkoutFormat.Standard;
                e.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }, null, ErrorCodes.OutOfRange, null);
        yield return ("Exercise.FormatConfig_Null_WhenNonStandard",
            e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = null;
            }, null, ErrorCodes.OutOfRange, null);
        yield return ("Exercise.Sets_AboveTwenty",
            e => e.Sets = Enumerable.Range(1, 21).Select(n => new ExerciseSet { SetNumber = n }).ToList(), null, ErrorCodes.OutOfRange, null);
        yield return ("Set.SetNumber_BelowOne", e => e.Sets = [new ExerciseSet { SetNumber = 0 }], null, ErrorCodes.OutOfRange, null);
        yield return ("Set.Reps_AboveThousand", e => e.Sets = [new ExerciseSet { SetNumber = 1, Reps = 1001 }], null, ErrorCodes.OutOfRange, null);
        yield return ("Set.Reps_BelowOne", e => e.Sets = [new ExerciseSet { SetNumber = 1, Reps = 0 }], null, ErrorCodes.OutOfRange, null);
        yield return ("Set.WeightKg_Negative", e => e.Sets = [new ExerciseSet { SetNumber = 1, WeightKg = -1 }], null, ErrorCodes.OutOfRange, null);
        yield return ("Set.Rpe_AboveTen", e => e.Sets = [new ExerciseSet { SetNumber = 1, Rpe = 11 }], null, ErrorCodes.OutOfRange, null);
        yield return ("Set.Rpe_BelowOne", e => e.Sets = [new ExerciseSet { SetNumber = 1, Rpe = 0 }], null, ErrorCodes.OutOfRange, null);

        yield return ("Exercise.Wod.Emom_IntervalSeconds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = new WodConfig { IntervalSeconds = 0, TotalRounds = 5 };
            }, null, ErrorCodes.OutOfRange, "IntervalSeconds");
        yield return ("Exercise.Wod.Emom_TotalRounds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.EMOM;
                e.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 0 };
            }, null, ErrorCodes.OutOfRange, "TotalRounds");
        yield return ("Exercise.Wod.ForTime_TimeCapSeconds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.ForTime;
                e.FormatConfig = new WodConfig { TimeCapSeconds = 0 };
            }, null, ErrorCodes.OutOfRange, "TimeCapSeconds");
        yield return ("Exercise.Wod.Tabata_WorkSeconds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 0, RestSeconds = 10, TotalRounds = 8 };
            }, null, ErrorCodes.OutOfRange, "WorkSeconds");
        yield return ("Exercise.Wod.Tabata_RestSeconds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 0, TotalRounds = 8 };
            }, null, ErrorCodes.OutOfRange, "RestSeconds");
        yield return ("Exercise.Wod.Tabata_TotalRounds_Zero",
            e =>
            {
                e.Format = WorkoutFormat.Tabata;
                e.FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 10, TotalRounds = 0 };
            }, null, ErrorCodes.OutOfRange, "TotalRounds");

        yield return ("Workout.Name_Empty", null, w => w.Name = "", ErrorCodes.Required, null);
        yield return ("Workout.Exercises_AboveThirty",
            null,
            w => w.Exercises = Enumerable.Range(1, 31)
                .Select(n => new SessionExercise { ExerciseExternalId = Guid.NewGuid(), ExerciseName = $"Ex{n}", Order = n }).ToList(),
            ErrorCodes.OutOfRange, null);
        yield return ("Workout.FormatConfig_NotNull_WhenStandard",
            null,
            w =>
            {
                w.Format = WorkoutFormat.Standard;
                w.FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 5 };
            }, ErrorCodes.OutOfRange, null);
        yield return ("Workout.FormatConfig_Null_WhenNonStandard",
            null,
            w =>
            {
                w.Format = WorkoutFormat.EMOM;
                w.FormatConfig = null;
            }, ErrorCodes.OutOfRange, null);
    }
}
