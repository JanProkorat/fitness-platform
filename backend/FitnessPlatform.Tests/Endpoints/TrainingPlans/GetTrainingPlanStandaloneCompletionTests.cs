using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="GetTrainingPlanEndpoint"/>'s per-instance completion projection
/// (<see cref="TrainingPlanCompletionDto.CompletedExerciseInstanceIds"/>, #884).
///
/// Before this change, standalone-exercise completions reached the wire only via the deprecated
/// flat <see cref="TrainingPlanCompletionDto.CompletedExerciseIds"/> field, and
/// <see cref="TrainingPlanCompletionDto.CompletedExerciseIdsByWorkout"/> was always-initialised
/// (serialising as <c>{}</c>) regardless of whether any standalone exercise had ever been
/// completed — so the web lock-derivation fallback that was supposed to walk
/// <c>standaloneExercises</c> had nothing instance-level to walk against. This file covers the
/// new additive field end to end, including the deliberate over-report residual documented on
/// <see cref="SessionExecution_SameCatalogExerciseTwoPlacementsFullyLoggedViaPerformance_BothInstanceIdsReported"/>.
/// </summary>
public class GetTrainingPlanStandaloneCompletionTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly DateTime _now = DateTime.UtcNow;

    private async Task<GetTrainingPlanResponse?> ExecuteAsync(
        TrainingPlan plan,
        WorkoutLog[]? workoutLogs = null,
        TrainingCompletion[]? completions = null)
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongoWithLogs(
            plans: [plan],
            workoutLogs: workoutLogs ?? [],
            trainingCompletions: completions ?? []);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            TrainingPlanTestHelpers.CreateNoOpLockService(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        if (ep.HttpContext.Response.StatusCode != 200)
        {
            return null;
        }

        return ep.Response;
    }

    private TrainingCompletion BuildCompletion(Guid sessionId, DateTime date, params Guid[] completedInstanceIds)
    {
        return new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            Date = date,
            CompletedExerciseInstanceIds = completedInstanceIds.ToList(),
            DateCreated = _now,
            Version = 1
        };
    }

    private WorkoutLog BuildFullyLoggedWorkoutLog(Guid sessionId, DateTime date, params Guid[] catalogExerciseExternalIds)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            PlanId = _planId,
            SessionId = sessionId,
            StartedAt = date.AddMinutes(-30),
            CompletedDate = date,
            IsCompleted = true,
            CompletedAt = date,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Live",
                    Exercises = catalogExerciseExternalIds.Select(externalId => new WorkoutExercise
                    {
                        ExerciseExternalId = externalId,
                        ExerciseName = "Logged exercise",
                        Sets =
                        [
                            new WorkoutSet
                            {
                                SetNumber = 1,
                                Reps = 10,
                                WeightKg = 50m,
                                CompletedAt = date.AddMinutes(-10)
                            }
                        ]
                    }).ToList()
                }
            ],
            DateCreated = _now
        };
    }

    // ── 1-3: exactness ──────────────────────────────────────────────────────────

    /// <summary>
    /// A standalone exercise marked complete via the Today-card checkbox surfaces its instance id
    /// in the new additive DTO field — before #884 this reached the wire only via the deprecated
    /// flat <see cref="TrainingPlanCompletionDto.CompletedExerciseIds"/> list.
    /// </summary>
    [Fact]
    public async Task SessionExecution_StandaloneExerciseCompletedByCheckbox_InstanceIdSurfacesInCompletionDto()
    {
        var standaloneInstanceId = Guid.NewGuid();
        var catalogId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Standalone-only session",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneInstanceId,
                    ExerciseExternalId = catalogId,
                    ExerciseName = "Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var completion = BuildCompletion(_sessionId, _now.Date, standaloneInstanceId);

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        response!.Completions.Should().ContainSingle();
        response.Completions.Single().CompletedExerciseInstanceIds.Should().ContainSingle()
            .Which.Should().Be(standaloneInstanceId);
    }

    /// <summary>
    /// The same catalog exercise is placed both standalone and nested in a workout. Only the
    /// nested instance was completed. The zero-false-positive case that justified the
    /// cross-package route — the catalog-keyed fields could never express this distinction.
    /// </summary>
    [Fact]
    public async Task SessionExecution_SameCatalogExerciseStandaloneAndNestedOnlyNestedCompleted_OnlyNestedInstanceIdEmitted()
    {
        var catalogId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogId, standaloneInstanceId, nestedInstanceId);
        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var completion = BuildCompletion(_sessionId, _now.Date, nestedInstanceId);

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();
        dto.CompletedExerciseInstanceIds.Should().ContainSingle().Which.Should().Be(nestedInstanceId);
        dto.CompletedExerciseInstanceIds.Should().NotContain(standaloneInstanceId);
    }

    /// <summary>
    /// Mirror direction of the previous test — only the standalone placement was completed.
    /// The catalog-keyed shape cannot express this at all (both placements share one external id).
    /// </summary>
    [Fact]
    public async Task SessionExecution_SameCatalogExerciseStandaloneAndNestedOnlyStandaloneCompleted_OnlyStandaloneInstanceIdEmitted()
    {
        var catalogId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogId, standaloneInstanceId, nestedInstanceId);
        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var completion = BuildCompletion(_sessionId, _now.Date, standaloneInstanceId);

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();
        dto.CompletedExerciseInstanceIds.Should().ContainSingle().Which.Should().Be(standaloneInstanceId);
        dto.CompletedExerciseInstanceIds.Should().NotContain(nestedInstanceId);
    }

    // ── 4: THE RESIDUAL — this test IS the documentation ─────────────────────────

    /// <summary>
    /// <b>Deliberate residual, not a bug.</b> One catalog exercise is placed BOTH standalone and
    /// nested in the same session. The client fully logs it via the live-training assistant
    /// (Performance) only — no checkbox signal at all. BOTH instance ids come back complete.
    /// <para>
    /// This mirrors #877's <c>GetTodaySessionResponse.CompletedExerciseInstanceIdsBySession</c>
    /// (see its remarks at <c>GetTodaySessionResponse.cs:161-198</c>): the live-training-assistant
    /// write path (<see cref="WorkoutExercise"/>) carries only
    /// <see cref="WorkoutExercise.ExerciseExternalId"/> — never an instance id — so a fully-logged
    /// catalog exercise cannot be attributed to the one placement the client actually performed.
    /// </para>
    /// <para>
    /// Rather than silently omitting it (which would render a session finished entirely through
    /// the live-training assistant with NO locks at all — the exact failure mode #877 rejected,
    /// see <see cref="SessionExecution_StandaloneExerciseFullyLoggedViaPerformanceOnly_InstanceIdReported"/>),
    /// the projection reports BOTH placements complete. Over-reporting is chosen over
    /// under-reporting because over-locking is the fail-safe direction for a trainer editor: a
    /// trainer seeing an extra field locked can still investigate, whereas a trainer editing a
    /// field the client already trained through has already lost the point of locking it.
    /// </para>
    /// </summary>
    [Fact]
    public async Task SessionExecution_SameCatalogExerciseTwoPlacementsFullyLoggedViaPerformance_BothInstanceIdsReported()
    {
        var catalogId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogId, standaloneInstanceId, nestedInstanceId);
        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var log = BuildFullyLoggedWorkoutLog(_sessionId, _now.Date, catalogId);

        var response = await ExecuteAsync(plan, workoutLogs: [log]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();
        dto.CompletedExerciseInstanceIds.Should().BeEquivalentTo([standaloneInstanceId, nestedInstanceId]);
    }

    // ── 5-7: Performance path + union ──────────────────────────────────────────

    /// <summary>
    /// A standalone-only session finished purely through the live-training assistant still
    /// reports its exercise instance as complete — guards the no-locks-at-all failure mode #877
    /// explicitly rejected.
    /// </summary>
    [Fact]
    public async Task SessionExecution_StandaloneExerciseFullyLoggedViaPerformanceOnly_InstanceIdReported()
    {
        var catalogId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Standalone-only session",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneInstanceId,
                    ExerciseExternalId = catalogId,
                    ExerciseName = "Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var log = BuildFullyLoggedWorkoutLog(_sessionId, _now.Date, catalogId);

        var response = await ExecuteAsync(plan, workoutLogs: [log]);

        response.Should().NotBeNull();
        response!.Completions.Single().CompletedExerciseInstanceIds.Should().ContainSingle()
            .Which.Should().Be(standaloneInstanceId);
    }

    /// <summary>
    /// The checkbox signal marks one instance complete; the live-training assistant independently
    /// fully logs the same instance's catalog exercise. The two sources must UNION, not append —
    /// the instance id appears exactly once in the result.
    /// </summary>
    [Fact]
    public async Task SessionExecution_CheckboxAndPerformanceBothPresent_InstanceIdsUnionedWithoutDuplicates()
    {
        var catalogId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Standalone-only session",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneInstanceId,
                    ExerciseExternalId = catalogId,
                    ExerciseName = "Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);

        // Both signals agree on the SAME instance — the checkbox flag directly, the live-training
        // assistant indirectly (fan-out from the fully-logged catalog exercise).
        var date = _now.Date;
        var completion = BuildCompletion(_sessionId, date, standaloneInstanceId);
        var log = BuildFullyLoggedWorkoutLog(_sessionId, date, catalogId);

        var response = await ExecuteAsync(plan, workoutLogs: [log], completions: [completion]);

        response.Should().NotBeNull();
        response!.Completions.Should().ContainSingle();
        response.Completions.Single().CompletedExerciseInstanceIds.Should().ContainSingle()
            .Which.Should().Be(standaloneInstanceId);
    }

    /// <summary>
    /// No exercise has been completed for this session/date — the new field is an empty list,
    /// never null, matching the always-initialised style of the sibling completion collections.
    /// </summary>
    [Fact]
    public async Task SessionExecution_NoCompletedExercises_CompletionDtoInstanceListEmpty()
    {
        var catalogId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Standalone-only session",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = Guid.NewGuid(),
                    ExerciseExternalId = catalogId,
                    ExerciseName = "Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        // Completion doc exists (so a Completions entry is projected) but marks nothing complete.
        var completion = BuildCompletion(_sessionId, _now.Date);

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();
        dto.CompletedExerciseInstanceIds.Should().NotBeNull();
        dto.CompletedExerciseInstanceIds.Should().BeEmpty();
    }

    // ── 8-10: guards + regression ────────────────────────────────────────────────

    /// <summary>
    /// A completion whose SessionId is not part of the plan (the <c>sessionLookup.TryGetValue</c>
    /// miss at <c>GetTrainingPlanEndpoint.cs:127</c>) must project cleanly without throwing. The
    /// raw instance ids still surface (Source 1 needs no session context to resolve); the
    /// catalog-keyed fields stay empty exactly as before this change.
    /// </summary>
    [Fact]
    public async Task SessionExecution_CompletionForSessionNotInPlan_ProjectionSkipsWithoutError()
    {
        var foreignSessionId = Guid.NewGuid();
        var foreignInstanceId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session in plan",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = Guid.NewGuid(),
                    ExerciseExternalId = Guid.NewGuid(),
                    ExerciseName = "Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        // Completion references a session the plan does not contain.
        var completion = BuildCompletion(foreignSessionId, _now.Date, foreignInstanceId);

        var act = async () => await ExecuteAsync(plan, completions: [completion]);
        await act.Should().NotThrowAsync();

        var response = await ExecuteAsync(plan, completions: [completion]);
        response.Should().NotBeNull();

        var dto = response!.Completions.Single(c => c.SessionId == foreignSessionId);
        dto.CompletedExerciseIds.Should().BeEmpty();
        dto.CompletedExerciseIdsByWorkout.Should().BeEmpty();
        dto.CompletedExerciseInstanceIds.Should().ContainSingle().Which.Should().Be(foreignInstanceId);
    }

    /// <summary>
    /// A nested-only plan (no standalone exercises at all) keeps the existing
    /// <see cref="TrainingPlanCompletionDto.CompletedExerciseIds"/> and
    /// <see cref="TrainingPlanCompletionDto.CompletedExerciseIdsByWorkout"/> semantics
    /// byte-for-byte unchanged — proving the new field is purely additive. Deliberately does NOT
    /// modify <c>GetTrainingPlanWorkoutKeyingTests.cs</c> (which stays green unmodified as the
    /// regression signal for the pre-existing catalog-keyed behaviour) — this test covers the
    /// same guarantee from the new file so #884's diff carries its own regression evidence.
    /// </summary>
    [Fact]
    public async Task SessionExecution_NestedOnlyPlan_CatalogKeyedFieldsUnchanged()
    {
        var catalogId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Nested-only session",
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutId,
                    Name = "Main",
                    Order = 0,
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = nestedInstanceId,
                            ExerciseExternalId = catalogId,
                            ExerciseName = "Squat",
                            Order = 1,
                            Sets = [new ExerciseSet { SetNumber = 1 }]
                        }
                    ]
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);
        var completion = BuildCompletion(_sessionId, _now.Date, nestedInstanceId);

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();

        dto.CompletedExerciseIds.Should().ContainSingle().Which.Should().Be(catalogId);
        dto.CompletedExerciseIdsByWorkout.Should().ContainKey(workoutId);
        dto.CompletedExerciseIdsByWorkout[workoutId].Should().ContainSingle().Which.Should().Be(catalogId);

        // Additive: the new field is populated alongside, not instead of, the catalog-keyed ones.
        dto.CompletedExerciseInstanceIds.Should().ContainSingle().Which.Should().Be(nestedInstanceId);
    }

    /// <summary>
    /// A legacy completion document predating <c>CompletedExerciseInstanceIds</c> deserialises the
    /// field to the C# initializer (empty list, not null) rather than throwing or leaving it
    /// unset. Proves the empty-list path explicitly rather than assuming it, and confirms the
    /// pre-existing <see cref="TrainingPlanCompletionDto.CompletedWorkoutIds"/> field is
    /// unaffected.
    /// </summary>
    [Fact]
    public async Task SessionExecution_LegacyCompletionWithoutInstanceIds_InstanceListEmptyAndCatalogFieldsStillPopulated()
    {
        var workoutId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Legacy session",
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutId,
                    Name = "Running",
                    Order = 0,
                    Exercises = []
                }
            ]
        };

        var plan = TrainingPlanTestHelpers.CreatePlanWithSession(session, _planId, _clientId, _trainerId);

        // Legacy-shaped completion: CompletedExerciseInstanceIds left at its default (empty list,
        // as it would deserialize from a field-absent Mongo document); only the workout-level
        // completion flag is set (the ForTime "Running" workout with no exercises).
        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = _sessionId,
            Date = _now.Date,
            CompletedWorkoutIds = [workoutId],
            DateCreated = _now,
            Version = 1
        };

        var response = await ExecuteAsync(plan, completions: [completion]);

        response.Should().NotBeNull();
        var dto = response!.Completions.Single();

        dto.CompletedExerciseInstanceIds.Should().NotBeNull();
        dto.CompletedExerciseInstanceIds.Should().BeEmpty();
        dto.CompletedWorkoutIds.Should().ContainSingle().Which.Should().Be(workoutId);
    }

    // ── shared fixture builder ───────────────────────────────────────────────────

    private TrainingSession BuildDualPlacementSession(Guid catalogId, Guid standaloneInstanceId, Guid nestedInstanceId)
    {
        return new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Dual-placement session",
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneInstanceId,
                    ExerciseExternalId = catalogId,
                    ExerciseName = "Squat",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1 }]
                }
            ],
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Name = "Main",
                    Order = 0,
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = nestedInstanceId,
                            ExerciseExternalId = catalogId,
                            ExerciseName = "Squat",
                            Order = 1,
                            Sets = [new ExerciseSet { SetNumber = 1 }]
                        }
                    ]
                }
            ]
        };
    }
}
