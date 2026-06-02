using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the diff-gate in
/// <c>PUT /training/plans/{planId}</c>. Covers two gaps found in the fresh-eyes
/// review of issue #381:
/// <list type="bullet">
///   <item>
///     <term>Legacy-doc no false-positive (gap #5a)</term>
///     <description>
///       A plan stored with legacy flat-exercise layout (no Sections, non-empty
///       LegacyExercises) paired with a section-shaped incoming request that
///       represents the SAME content after backfill must NOT produce a 409 —
///       the backfill no-diff path must be clean.
///     </description>
///   </item>
///   <item>
///     <term>Removed/replaced published session without lock → 409 (gap #5b)</term>
///     <description>
///       Dropping a published session from the request (i.e. the stored published
///       SessionId does not appear in the incoming map) must be rejected with 409
///       <c>session_locked</c> unless the trainer holds an Editing lock for that
///       session.
///     </description>
///   </item>
/// </list>
/// </summary>
[Collection(TestCollection.Name)]
public class UpdateTrainingPlanDiffGateIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@diff-gate-test.com";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    // ── shared plan-building helpers ─────────────────────────────────────────────

    /// <summary>
    /// Seeds a published plan in Mongo whose single session uses the LEGACY flat-exercise
    /// layout (empty Sections list, LegacyExercises populated). Returns the plan + the
    /// legacy exercise IDs so the caller can build a matching section-shaped request.
    /// </summary>
    private async Task<(TrainingPlan Plan, Guid SessionId, Guid ExerciseId)>
        SeedLegacyPublishedPlanAsync(Guid trainerUserId)
    {
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = sessionId,
            DayOfWeek = 1,
            Name = "Legacy Day",
            Order = 1,
            Sections = [],          // legacy — no sections
            LegacyExercises =
            [
                new SessionExercise
                {
                    ExerciseExternalId = exId,
                    ExerciseName = "Squat",
                    Order = 1,
                    MovementType = MovementType.Reps,
                    Sets =
                    [
                        new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 100 }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = Guid.NewGuid(),
            TrainerId = trainerUserId,
            Name = "Legacy Diff-Gate Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = TrainingPlanTestHelpers.LastMonday(),
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-14),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-7),
                    Sessions = [session]
                }
            ]
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);

        return (plan, sessionId, exId);
    }

    /// <summary>
    /// Seeds a published plan in Mongo whose single session uses the CURRENT
    /// sections-based layout (Sections populated, LegacyExercises empty).
    /// </summary>
    private async Task<(TrainingPlan Plan, Guid SessionId, Guid SectionId, Guid ExerciseId)>
        SeedSectionPublishedPlanAsync(Guid trainerUserId)
    {
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();
        var exId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = sessionId,
            DayOfWeek = 1,
            Name = "Modern Day",
            Order = 1,
            Sections =
            [
                new TrainingSection
                {
                    SectionId = sectionId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = exId,
                            ExerciseName = "Bench Press",
                            Order = 1,
                            MovementType = MovementType.Reps,
                            Sets =
                            [
                                new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 10, WeightKg = 80 }
                            ]
                        }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = Guid.NewGuid(),
            TrainerId = trainerUserId,
            Name = "Section Diff-Gate Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = TrainingPlanTestHelpers.LastMonday(),
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-14),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-7),
                    Sessions = [session]
                }
            ]
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);

        return (plan, sessionId, sectionId, exId);
    }

    // ── gap #5a: legacy-doc backfill no false-positive ───────────────────────────

    /// <summary>
    /// A plan whose session is stored in legacy flat-exercise format (Sections=[],
    /// LegacyExercises=[…]) must NOT produce a 409 when the incoming request for
    /// the same session is shaped as a single "Hlavní" section with exactly the same
    /// exercise content — the <see cref="TrainingSession.WithBackfilledSections"/>
    /// backfill equalises the views and HasContentChanged must return false.
    /// </summary>
    [Fact]
    public async Task UpdatePlan_LegacyFlatDoc_SameContentAsSectionRequest_Returns200_NoFalsePositive()
    {
        // ── 1. Register + login trainer ───────────────────────────────────────────
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Legacy", "DiffGate", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid trainerUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            trainerUserId = user.Id;
        }

        // ── 2. Seed a legacy-format published plan ────────────────────────────────
        var (plan, sessionId, exerciseId) = await SeedLegacyPublishedPlanAsync(trainerUserId);

        // ── 3. Build an UPDATE request with section-shaped content ─────────────────
        // The content is identical to the legacy doc after backfill: one "Hlavní"
        // section with one exercise (same ExerciseExternalId / ExerciseName / Order /
        // MovementType / Sets). HasContentChanged must NOT flag this as changed.
        var body = new
        {
            Name = plan.Name,
            Version = plan.Version,
            StartDate = plan.StartDate,
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Sessions = new[]
                    {
                        new
                        {
                            SessionId = sessionId.ToString(),
                            DayOfWeek = 1,
                            Name = "Legacy Day",
                            Order = 1,
                            Sections = new[]
                            {
                                new
                                {
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises = new[]
                                    {
                                        new
                                        {
                                            ExerciseExternalId = exerciseId.ToString(),
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            MovementType = "Reps",
                                            Sets = new[]
                                            {
                                                new { SetNumber = 1, Type = "Normal", Reps = 5, WeightKg = 100.0 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        // ── 4. PUT /training/plans/{planId} ───────────────────────────────────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.PutAsJsonAsync(
            $"/training/plans/{plan.ExternalId}",
            body,
            TestContext.Current.CancellationToken);

        // ── 5. Assert no false-positive 409 ───────────────────────────────────────
        // The diff-gate must NOT fire — the incoming content is identical to the
        // stored legacy doc after backfill. No Editing lock is held, so a 409 would
        // be wrong. Expect 200.
        var body200 = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(
            HttpStatusCode.OK,
            $"legacy flat-exercise doc with unchanged section-shaped request must not trigger the diff-gate. Body: {body200}");
    }

    // ── gap #5b: removed/replaced published session without lock → 409 ───────────

    /// <summary>
    /// Dropping a stored published session from the incoming request (its SessionId
    /// is absent from the request) must be rejected with HTTP 409. The plan is stored
    /// with sections-layout; no Editing lock is held by the trainer for that session.
    /// </summary>
    [Fact]
    public async Task UpdatePlan_RemovedPublishedSession_WithoutEditingLock_Returns409()
    {
        // ── 1. Register + login trainer ───────────────────────────────────────────
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Remove", "DiffGate", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid trainerUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            trainerUserId = user.Id;
        }

        // ── 2. Seed a published plan with a session ───────────────────────────────
        var (plan, sessionId, _, exerciseId) = await SeedSectionPublishedPlanAsync(trainerUserId);

        // ── 3. Build an UPDATE request that OMITS the published session ────────────
        // Sending week 1 with an EMPTY sessions list effectively removes the published
        // session. No SessionId mismatch is needed — pure absence is enough. No lock.
        var body = new
        {
            Name = plan.Name,
            Version = plan.Version,
            StartDate = plan.StartDate,
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Sessions = Array.Empty<object>() // session removed
                }
            }
        };

        // ── 4. PUT /training/plans/{planId} ───────────────────────────────────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.PutAsJsonAsync(
            $"/training/plans/{plan.ExternalId}",
            body,
            TestContext.Current.CancellationToken);

        // ── 5. Assert 409 with session_locked error code ───────────────────────────
        var responseBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(
            HttpStatusCode.Conflict,
            $"removing a published session without an Editing lock must be rejected 409. Body: {responseBody}");
        responseBody.Should().Contain(
            "session_locked",
            "the RFC 7807 error_code must be 'session_locked'");
    }
}
