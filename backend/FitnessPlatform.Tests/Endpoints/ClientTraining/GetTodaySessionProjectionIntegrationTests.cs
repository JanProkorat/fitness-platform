using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #838 two-phase projected read in
/// <c>GET /client/training/plan/today</c>. The mocked-<c>IMongoContext</c> unit tests in
/// <see cref="GetTodaySessionEndpointTests"/> prove the C# week-selection logic, but a real
/// Mongo instance is the only way to prove the actual projection queries — a malformed
/// phase-1 metadata projection or a wrong phase-2 <c>weeks.$</c> positional projection would
/// pass every mocked test (NSubstitute ignores the <c>Projection</c> option entirely) and
/// silently break in production.
/// </summary>
[Collection(TestCollection.Name)]
public class GetTodaySessionProjectionIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@today-session-projection-test.com";

    /// <summary>
    /// Computes today's ISO day-of-week (1 = Monday, 7 = Sunday).
    /// </summary>
    private static int TodayDow()
    {
        var dow = (int)DateTime.UtcNow.DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    /// <summary>
    /// Returns the Monday of the current week (UTC).
    /// </summary>
    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    /// <summary>
    /// Builds a published <see cref="TrainingWeek"/> with a single session scheduled on
    /// <paramref name="dayOfWeek"/>, named distinctly so tests can tell which week's content
    /// a query actually returned.
    /// </summary>
    private static TrainingWeek BuildWeek(int weekNumber, Guid sessionId, string sessionName, int dayOfWeek, Guid exerciseId, DateTime datePublished)
    {
        return new TrainingWeek
        {
            WeekNumber = weekNumber,
            Status = WeekStatus.Published,
            DatePublished = datePublished,
            Days = TrainingPlanTestHelpers.MaterializeDays((dayOfWeek, new TrainingSession
            {
                SessionId = sessionId,
                Name = sessionName,
                Order = 1,
                Workouts =
                [
                    new TrainingWorkout
                    {
                        WorkoutId = Guid.NewGuid(),
                        Order = 0,
                        Name = "Hlavní",
                        Exercises =
                        [
                            new SessionExercise
                            {
                                ExerciseExternalId = exerciseId,
                                ExerciseName = $"Exercise for {sessionName}",
                                Order = 1,
                                Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 100 }]
                            }
                        ]
                    }
                ]
            }))
        };
    }

    /// <summary>
    /// Regression guard for #838. Seeds a 3-week Active plan whose window places today in
    /// WEEK 3 (a non-index-0 week — an off-by-one in the positional <c>weeks.$</c> filter would
    /// only surface here, since a bug that always returns element 0 would pass silently for a
    /// week-1 scenario). Each week carries a distinctly-named session so the test can prove
    /// exactly which week's content came back.
    /// <list type="number">
    /// <item>Direct-queries the real Mongo instance with the endpoint's actual (now
    /// <c>internal</c>) phase-1 <see cref="GetTodaySessionEndpoint.LightPlanProjection"/> and
    /// asserts every week's metadata (weekNumber/status/datePublished) is retained while
    /// <c>sessions</c> content is excluded for ALL weeks — not just the resolved one.</item>
    /// <item>Calls the real HTTP endpoint and asserts the response resolves week 3 and returns
    /// EXACTLY week 3's session (not week 1's or week 2's, not empty) — proving the real
    /// phase-2 positional projection matched the correct non-zero array index.</item>
    /// <item>Asserts byte-equivalence of the hydrated content (session id, name, exercise,
    /// muscle-group-eligible exercise id) against what a naive full-fetch of the seed would
    /// produce — guarding the no-wire-contract-change AC through real BSON serialization.</item>
    /// </list>
    /// </summary>
    [Fact]
    public async Task GetTodaySession_MultiWeekPlan_TodayInNonFirstWeek_HydratesExactWeekContent_RealMongoProjection()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Proj", "Session", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            // GetTodaySessionEndpoint resolves the caller's ClientProfile by UserId and filters
            // TrainingPlan.ClientId on ClientProfile.UserId (#840) — seed the plan with UserId,
            // not PublicId, or the endpoint's own-plan lookup matches nothing.
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        // Plan started 2 full weeks ago (Monday) — today resolves to week 3.
        var startDate = StartOfCurrentWeek().AddDays(-14);

        var week1SessionId = Guid.NewGuid();
        var week2SessionId = Guid.NewGuid();
        var week3SessionId = Guid.NewGuid();
        var week1ExerciseId = Guid.NewGuid();
        var week2ExerciseId = Guid.NewGuid();
        var week3ExerciseId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            TrainerId = Guid.NewGuid(),
            Name = "Projection Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Version = 1,
            DateCreated = startDate,
            Weeks =
            [
                BuildWeek(1, week1SessionId, "Week 1 Session (must never appear)", todayDow, week1ExerciseId, startDate),
                BuildWeek(2, week2SessionId, "Week 2 Session (must never appear)", todayDow, week2ExerciseId, startDate),
                BuildWeek(3, week3SessionId, "Week 3 Session (target)", todayDow, week3ExerciseId, startDate)
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── 1. Direct assertion on the REAL phase-1 projection against real Mongo ──────────
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId);
            using var cursor = await mongo.TrainingPlans.FindAsync(
                filter,
                new FindOptions<TrainingPlan, TrainingPlan> { Projection = GetTodaySessionEndpoint.LightPlanProjection },
                TestContext.Current.CancellationToken);
            var projected = (await cursor.ToListAsync(TestContext.Current.CancellationToken)).Single();

            projected.Weeks.Should().HaveCount(3,
                "the weeks array itself must be RETAINED by the projection — only its content is excluded");
            projected.Weeks.Select(w => w.WeekNumber).Should().BeEquivalentTo(new[] { 1, 2, 3 });
            projected.Weeks.Should().AllSatisfy(w => w.Status.Should().Be(WeekStatus.Published));
            projected.Weeks.Should().AllSatisfy(w => w.DatePublished.Should().Be(startDate));
            projected.Weeks.Should().AllSatisfy(w => w.Days.Should().BeEmpty(
                "the real phase-1 projection must exclude weeks[].days content for EVERY week"));
        }

        // ── 1b. Direct assertion on the REAL phase-2 positional projection against real Mongo ──
        // Regression guard: an inclusion-only "weeks.$" projection returns ONLY `_id` and
        // `weeks` — every other field (including `externalId`) is excluded and deserializes to
        // its C# default (Guid.Empty) unless explicitly re-included in the projection. This
        // exact bug made FetchHydratedWeekAsync silently return null on every real call (the
        // defensive ExternalId-match guard always failed against a Guid.Empty), invisible to
        // the mocked unit tests since NSubstitute ignores the Projection option entirely.
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var weekFilter = Builders<TrainingPlan>.Filter.And(
                Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
                Builders<TrainingPlan>.Filter.Eq("weeks.weekNumber", 3));
            var weekProjection = Builders<TrainingPlan>.Projection.Combine(
                Builders<TrainingPlan>.Projection.Include(p => p.ExternalId),
                Builders<TrainingPlan>.Projection.Include("weeks.$"));
            using var cursor = await mongo.TrainingPlans.FindAsync(
                weekFilter,
                new FindOptions<TrainingPlan, TrainingPlan> { Projection = weekProjection },
                TestContext.Current.CancellationToken);
            var hydratedPlans = await cursor.ToListAsync(TestContext.Current.CancellationToken);

            hydratedPlans.Should().ContainSingle();
            hydratedPlans[0].ExternalId.Should().Be(planId,
                "the phase-2 projection must explicitly re-include ExternalId — otherwise it deserializes to Guid.Empty " +
                "and the endpoint's defensive ExternalId match silently fails on every real request");
            var hydratedWeek = hydratedPlans[0].Weeks.Should().ContainSingle().Subject;
            hydratedWeek.WeekNumber.Should().Be(3, "the positional $ operator must match the correct non-zero-index array element");
        }

        // ── 2. Real HTTP round-trip: phase-2 must hydrate EXACTLY week 3's content ─────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");
        body!.PlanId.Should().Be(planId, $"raw response was: {rawBody}");
        body.TotalWeeks.Should().Be(3, $"phase-1 metadata must retain the full week count. raw: {rawBody}");
        body.CurrentWeek.Should().Be(3, $"today's date must resolve to week 3, not week 1 (proves phase-1 metadata drove real window/week resolution). raw: {rawBody}");
        body.HasSession.Should().BeTrue();
        body.Sessions.Should().ContainSingle();

        var hydratedSession = body.Sessions[0];
        hydratedSession.SessionId.Should().Be(week3SessionId,
            "phase-2 hydration must fetch week 3's session — a wrong/off-by-one positional $ match would return week 1's or week 2's instead");
        hydratedSession.Name.Should().Be("Week 3 Session (target)");
        hydratedSession.AllExercises.Should().ContainSingle(e => e.ExerciseExternalId == week3ExerciseId);
        hydratedSession.AllExercises.Should().NotContain(e => e.ExerciseExternalId == week1ExerciseId || e.ExerciseExternalId == week2ExerciseId,
            "sibling weeks' exercise content must never leak into the hydrated response");

        // ── 3. Byte-equivalence: matches exactly what a naive full-fetch of the seed would produce ──
        // DayOfWeek is no longer serialized per session (the parent TrainingDay owns it, #857
        // phase 2) — "today" already implies the day, so the wire contract dropped the field.
        hydratedSession.Order.Should().Be(1);
        hydratedSession.AllExercises[0].ExerciseName.Should().Be("Exercise for Week 3 Session (target)");
    }

    /// <summary>
    /// Regression guard for the #857 phase 3a wire-contract break (renamed on the wire by #874).
    /// <see cref="TrainingSession.AllExercises"/> must remain a union of the standalone exercise
    /// list and every workout's nested exercises — not just the standalone list. Seeds a single
    /// session carrying one standalone exercise AND one workout-nested exercise, then asserts the
    /// real HTTP response's <c>allExercises</c> field contains BOTH. This case is only
    /// constructible now that phase 3a introduced standalone exercises; before that, every real
    /// document only ever had the nested shape (covered by the sibling test above).
    /// </summary>
    [Fact]
    public async Task GetTodaySession_SessionWithStandaloneAndWorkoutExercises_ReturnsUnionInAllExercises()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Union", "Session", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var standaloneExerciseId = Guid.NewGuid();
        var workoutExerciseId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = sessionId,
            Name = "Union Session",
            Order = 1,
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseExternalId = standaloneExerciseId,
                    ExerciseName = "Standalone Finisher",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 10 }]
                }
            ],
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = workoutExerciseId,
                            ExerciseName = "Workout Exercise",
                            Order = 1,
                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 100 }]
                        }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            TrainerId = Guid.NewGuid(),
            Name = "Union Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Version = 1,
            DateCreated = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Days = TrainingPlanTestHelpers.MaterializeDays((todayDow, session))
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");
        body!.Sessions.Should().ContainSingle();

        var hydratedSession = body.Sessions[0];
        hydratedSession.AllExercises.Should().HaveCount(2,
            $"the wire `allExercises` field must union the standalone list with every workout's nested " +
            $"exercises, not just the standalone list. raw: {rawBody}");
        hydratedSession.AllExercises.Should().Contain(e => e.ExerciseExternalId == standaloneExerciseId,
            "the standalone exercise must appear in the wire `allExercises` field");
        hydratedSession.AllExercises.Should().Contain(e => e.ExerciseExternalId == workoutExerciseId,
            "the workout-nested exercise must still appear in the wire `allExercises` field");
    }

    /// <summary>
    /// Builds a plan with a single today-scheduled session holding one catalog exercise placed
    /// BOTH standalone (<paramref name="standaloneInstanceId"/>) and nested inside a workout
    /// (<paramref name="nestedInstanceId"/>) — the shape #877's per-instance completion field
    /// exists to disambiguate. Each placement carries exactly one planned set.
    /// </summary>
    private static (TrainingPlan Plan, Guid SessionId, Guid WorkoutId) BuildDualPlacementPlan(
        Guid clientUserId, Guid catalogExerciseId, Guid standaloneInstanceId, Guid nestedInstanceId, int todayDow, DateTime startDate)
    {
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            TrainerId = Guid.NewGuid(),
            Name = "Dual Placement Today Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Version = 1,
            DateCreated = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Days = TrainingPlanTestHelpers.MaterializeDays((todayDow, new TrainingSession
                    {
                        SessionId = sessionId,
                        Name = "Dual Placement Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = workoutId,
                                Order = 2,
                                Name = "Hlavní",
                                Exercises =
                                [
                                    new SessionExercise
                                    {
                                        ExerciseId = nestedInstanceId,
                                        ExerciseExternalId = catalogExerciseId,
                                        ExerciseName = "Wall Ball",
                                        Order = 1,
                                        Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 20 }]
                                    }
                                ]
                            }
                        ],
                        StandaloneExercises =
                        [
                            new SessionExercise
                            {
                                ExerciseId = standaloneInstanceId,
                                ExerciseExternalId = catalogExerciseId,
                                ExerciseName = "Wall Ball",
                                Order = 1,
                                Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 15 }]
                            }
                        ]
                    }))
                }
            ]
        };

        return (plan, sessionId, workoutId);
    }

    /// <summary>
    /// #877 AC5 (checkbox source): a session holds one catalog exercise BOTH standalone and
    /// nested in a workout. Only the standalone instance is checkbox-completed
    /// (<see cref="SessionExecution.CompletedExerciseInstanceIds"/> holds only that one id).
    /// The new per-instance field must report ONLY the standalone instance as complete — the
    /// nested instance must stay incomplete despite sharing the same catalog id.
    /// </summary>
    [Fact]
    public async Task GetTodaySession_DualPlacementSession_OnlyStandaloneCompleted_PerInstanceFieldExcludesNested()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dual", "Today", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var (plan, sessionId, _) = BuildDualPlacementPlan(
            clientUserId, catalogExerciseId, standaloneInstanceId, nestedInstanceId, todayDow, startDate);

        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow),
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseInstanceIds = [standaloneInstanceId],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");
        body!.CompletedExerciseInstanceIdsBySession.Should().ContainKey(sessionId, $"raw response was: {rawBody}");
        body.CompletedExerciseInstanceIdsBySession[sessionId].Should().BeEquivalentTo([standaloneInstanceId],
            "only the standalone instance was checkbox-completed — the nested instance sharing the same catalog id must stay incomplete");

        // Non-breaking guarantee (#877): the pre-existing catalog-keyed field still collapses both
        // instances onto the one catalog id, unchanged from its current behaviour.
        body.CompletedExerciseIdsBySession.Should().ContainKey(sessionId);
        body.CompletedExerciseIdsBySession[sessionId].Should().BeEquivalentTo([catalogExerciseId]);
    }

    /// <summary>
    /// #877 AC5 (checkbox source): same dual-placement session as above, but BOTH instances are
    /// checkbox-completed. The per-instance field must report both.
    /// </summary>
    [Fact]
    public async Task GetTodaySession_DualPlacementSession_BothInstancesCompleted_PerInstanceFieldContainsBoth()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dual", "Today", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var (plan, sessionId, _) = BuildDualPlacementPlan(
            clientUserId, catalogExerciseId, standaloneInstanceId, nestedInstanceId, todayDow, startDate);

        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow),
            Status = SessionExecutionStatus.Completed,
            CompletedExerciseInstanceIds = [standaloneInstanceId, nestedInstanceId],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");
        body!.CompletedExerciseInstanceIdsBySession.Should().ContainKey(sessionId, $"raw response was: {rawBody}");
        body.CompletedExerciseInstanceIdsBySession[sessionId].Should().BeEquivalentTo(
            [standaloneInstanceId, nestedInstanceId],
            "both placements were checkbox-completed independently — both must be reported");
    }

    /// <summary>
    /// #877 AC5 (performance-derived source): the client fully logs the catalog exercise via the
    /// live-training assistant — <see cref="WorkoutExercise"/> carries only
    /// <see cref="WorkoutExercise.ExerciseExternalId"/>, no instance id, so the write path cannot
    /// attribute completion to one specific placement. Per the documented fan-out rule, BOTH
    /// sibling instances sharing that catalog id must appear in the per-instance field — omitting
    /// either would regress vs. the catalog-keyed field this one supersedes.
    /// </summary>
    [Fact]
    public async Task GetTodaySession_DualPlacementSession_PerformanceCompletesCatalogExercise_FansOutToBothInstances()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dual", "Perf", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var (plan, sessionId, workoutId) = BuildDualPlacementPlan(
            clientUserId, catalogExerciseId, standaloneInstanceId, nestedInstanceId, todayDow, startDate);

        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow),
            Status = SessionExecutionStatus.Completed,
            CompletedExerciseInstanceIds = [],
            DateCreated = DateTime.UtcNow,
            Version = 1,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = DateTime.UtcNow.AddMinutes(-30),
                CompletedAt = DateTime.UtcNow,
                Workouts =
                [
                    new LoggedWorkout
                    {
                        WorkoutId = workoutId,
                        Order = 0,
                        Name = "Hlavní",
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = catalogExerciseId,
                                ExerciseName = "Wall Ball",
                                Sets = [new WorkoutSet { SetNumber = 1, Reps = 20, CompletedAt = DateTime.UtcNow }]
                            }
                        ]
                    }
                ]
            }
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");
        body!.CompletedExerciseInstanceIdsBySession.Should().ContainKey(sessionId, $"raw response was: {rawBody}");
        body.CompletedExerciseInstanceIdsBySession[sessionId].Should().BeEquivalentTo(
            [standaloneInstanceId, nestedInstanceId],
            "Performance carries no instance id, so a fully-logged catalog exercise must fan out to every sibling instance sharing that catalog id");
    }

    /// <summary>
    /// #885 (live-training-assistant path): the dual-placement session's NESTED placement fully
    /// logs its set via the live-training assistant — <see cref="SessionExecution.Performance"/>
    /// carries the containing <see cref="LoggedWorkout.WorkoutId"/> matching the REAL nested
    /// <see cref="TrainingWorkout.WorkoutId"/>, exactly the shape <c>UpdateWorkoutEndpoint</c>
    /// persists. The new per-instance-keyed <c>completedSetsByExerciseInstanceBySession</c> /
    /// <c>loggedSetsByExerciseInstanceBySession</c> fields must attribute the logged set ONLY to
    /// the nested instance — the standalone instance sharing the same catalog id must have no
    /// entry. Before the #885 fix, the (only) catalog-keyed fields could not represent this
    /// distinction at all.
    /// </summary>
    [Fact]
    public async Task GetTodaySession_DualPlacementPerformance_NestedCompletedViaLiveLog_InstanceFieldAttributesOnlyNested()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dual", "LiveLog", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var (plan, sessionId, workoutId) = BuildDualPlacementPlan(
            clientUserId, catalogExerciseId, standaloneInstanceId, nestedInstanceId, todayDow, startDate);

        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow),
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseInstanceIds = [],
            DateCreated = DateTime.UtcNow,
            Version = 1,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = DateTime.UtcNow.AddMinutes(-10),
                Workouts =
                [
                    new LoggedWorkout
                    {
                        WorkoutId = workoutId, // matches the REAL nested TrainingWorkout.WorkoutId
                        Order = 0,
                        Name = "Hlavní",
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = catalogExerciseId,
                                ExerciseName = "Wall Ball",
                                Sets = [new WorkoutSet { SetNumber = 1, Reps = 20, CompletedAt = DateTime.UtcNow }]
                            }
                        ]
                    }
                ]
            }
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");

        body!.CompletedSetsByExerciseInstanceBySession.Should().ContainKey(sessionId, $"raw response was: {rawBody}");
        var completedByInstance = body.CompletedSetsByExerciseInstanceBySession[sessionId];
        completedByInstance.Should().ContainKey(nestedInstanceId,
            $"the nested placement's set was actually logged via the live-training assistant. raw: {rawBody}");
        completedByInstance[nestedInstanceId].Should().BeEquivalentTo([1]);
        completedByInstance.Should().NotContainKey(standaloneInstanceId,
            $"the standalone placement was never logged — the per-instance field must not leak the " +
            $"nested placement's completion onto it. raw: {rawBody}");

        body.LoggedSetsByExerciseInstanceBySession.Should().ContainKey(sessionId);
        body.LoggedSetsByExerciseInstanceBySession[sessionId].Should().ContainKey(nestedInstanceId);
        body.LoggedSetsByExerciseInstanceBySession[sessionId].Should().NotContainKey(standaloneInstanceId);

        // Non-breaking guarantee (#885): the pre-existing catalog-keyed field is unchanged —
        // it still reports the catalog exercise complete regardless of which placement logged it.
        body.CompletedSetsBySessionExercise.Should().ContainKey(sessionId);
        body.CompletedSetsBySessionExercise[sessionId].Should().ContainKey(catalogExerciseId);
    }

    /// <summary>
    /// #885 symmetric case: the STANDALONE placement's set is logged via the live-training
    /// assistant. The <see cref="LoggedWorkout.WorkoutId"/> here does NOT match any nested
    /// <see cref="TrainingWorkout.WorkoutId"/> in the session — exactly the shape
    /// <c>UpdateWorkoutEndpoint</c>'s legacy single-workout fallback path assigns when logging a
    /// standalone exercise (which has no WorkoutId of its own to send). The per-instance field
    /// must attribute the logged set ONLY to the standalone instance.
    /// </summary>
    [Fact]
    public async Task GetTodaySession_DualPlacementPerformance_StandaloneCompletedViaLiveLog_InstanceFieldAttributesOnlyStandalone()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dual", "LiveLog2", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var todayDow = TodayDow();
        var startDate = StartOfCurrentWeek();
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();

        var (plan, sessionId, _) = BuildDualPlacementPlan(
            clientUserId, catalogExerciseId, standaloneInstanceId, nestedInstanceId, todayDow, startDate);

        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow),
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseInstanceIds = [],
            DateCreated = DateTime.UtcNow,
            Version = 1,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = DateTime.UtcNow.AddMinutes(-10),
                Workouts =
                [
                    new LoggedWorkout
                    {
                        // Fallback WorkoutId matching NEITHER of the session's nested
                        // TrainingWorkout ids — the shape UpdateWorkoutEndpoint's legacy
                        // single-workout path assigns when logging a standalone exercise.
                        WorkoutId = Guid.NewGuid(),
                        Order = 0,
                        Name = "Hlavní",
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = catalogExerciseId,
                                ExerciseName = "Wall Ball",
                                Sets = [new WorkoutSet { SetNumber = 1, Reps = 15, CompletedAt = DateTime.UtcNow }]
                            }
                        ]
                    }
                ]
            }
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/training/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var rawBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonSerializer.Deserialize<TodaySessionResponseDto>(rawBody, jsonOptions);

        body.Should().NotBeNull($"raw response was: {rawBody}");

        body!.CompletedSetsByExerciseInstanceBySession.Should().ContainKey(sessionId, $"raw response was: {rawBody}");
        var completedByInstance = body.CompletedSetsByExerciseInstanceBySession[sessionId];
        completedByInstance.Should().ContainKey(standaloneInstanceId,
            $"the standalone placement's set was actually logged via the live-training assistant. raw: {rawBody}");
        completedByInstance[standaloneInstanceId].Should().BeEquivalentTo([1]);
        completedByInstance.Should().NotContainKey(nestedInstanceId,
            $"the nested placement was never logged — the per-instance field must not leak the " +
            $"standalone placement's completion onto it. raw: {rawBody}");
    }

    // ── Local response DTOs (per slice rules — not shared across features) ────────

    private record TodaySessionResponseDto(
        bool HasSession,
        Guid? PlanId,
        string? PlanName,
        int? TotalWeeks,
        int? CurrentWeek,
        string? Status,
        List<SessionResponseDto> Sessions,
        Dictionary<Guid, List<Guid>> CompletedExerciseIdsBySession,
        Dictionary<Guid, List<Guid>> CompletedExerciseInstanceIdsBySession,
        Dictionary<Guid, Dictionary<Guid, List<int>>> CompletedSetsBySessionExercise,
        Dictionary<Guid, Dictionary<Guid, List<int>>> CompletedSetsByExerciseInstanceBySession,
        Dictionary<Guid, Dictionary<Guid, List<LoggedSetResponseDto>>> LoggedSetsByExerciseInstanceBySession);

    private record SessionResponseDto(
        Guid SessionId,
        string Name,
        int Order,
        List<ExerciseResponseDto> AllExercises);

    private record ExerciseResponseDto(
        Guid ExerciseExternalId,
        string ExerciseName);

    private record LoggedSetResponseDto(
        int SetNumber,
        int? ActualReps);
}
