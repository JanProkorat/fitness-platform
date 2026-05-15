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
/// Integration tests verifying that <c>GET /training/plans/{planId}</c> backfills
/// legacy flat-exercise documents into a single "Hlavní" section at read time
/// (schema-on-read, trainer endpoint).
/// </summary>
[Collection(TestCollection.Name)]
public class GetTrainingPlanLegacyBackfillTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@integration-test.com";

    /// <summary>
    /// Schema-on-read backfill: a plan stored with only flat LegacyExercises (no Sections)
    /// must be transparently backfilled into a single "Hlavní" section at read time.
    /// </summary>
    [Fact]
    public async Task GetPlan_WithLegacyFlatExercises_BackfillsIntoHlavniSection()
    {
        var httpClient = factory.CreateClient();

        // ── 1. Register + log in the trainer ─────────────────────────────────────
        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, trainerEmail, "TestPass1!", "Legacy", "Trainer", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, trainerEmail, "TestPass1!");

        // ── 2. Resolve trainer's ApplicationUser.Id from Postgres ─────────────────
        // plan.TrainerId stores ApplicationUser.Id (same value put in AppClaims.UserId).
        Guid trainerUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken);
            trainerUserId = user.Id;
        }

        // ── 3. Seed legacy TrainingPlan in Mongo ──────────────────────────────────
        var squatId = Guid.NewGuid();
        var benchId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        // Build a session with only LegacyExercises and an empty Sections list.
        // This simulates a pre-sections document in MongoDB.
        var legacySession = new TrainingSession
        {
            SessionId = sessionId,
            DayOfWeek = 2,
            Name = "Legacy Trainer Day",
            Order = 1,
            Sections = [], // explicitly empty — legacy document
            LegacyExercises =
            [
                new SessionExercise
                {
                    ExerciseExternalId = squatId,
                    ExerciseName = "Squat",
                    Order = 1,
                    Sets =
                    [
                        new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 100 },
                        new ExerciseSet { SetNumber = 2, Type = SetType.Normal, Reps = 5, WeightKg = 100 }
                    ]
                },
                new SessionExercise
                {
                    ExerciseExternalId = benchId,
                    ExerciseName = "Bench Press",
                    Order = 2,
                    Sets =
                    [
                        new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 8, WeightKg = 80 }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = Guid.NewGuid(),
            TrainerId = trainerUserId,
            Name = "Legacy Flat Trainer Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-3),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-2),
                    Sessions = [legacySession]
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── 4. GET /training/plans/{planId} ───────────────────────────────────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        // ── 5. Assert HTTP 200 ────────────────────────────────────────────────────
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<PlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PlanId.Should().Be(planId);

        var session = body.Weeks[0].Sessions[0];

        // ── 6. Assert schema-on-read backfill ─────────────────────────────────────
        session.Sections.Should().HaveCount(1, "legacy exercises must be wrapped in a single default section");

        var hlavni = session.Sections[0];
        hlavni.Name.Should().Be("Hlavní");
        hlavni.Format.Should().BeNull("default backfilled section has no format");
        hlavni.Exercises.Should().HaveCount(2, "both legacy exercises belong in the default section");

        // ── 7. Assert flat backward-compat exercises list ─────────────────────────
        session.Exercises.Should().HaveCount(2, "flat exercises list derives from sections");
        session.Exercises.Select(e => e.ExerciseExternalId)
            .Should().Contain([squatId, benchId]);
    }

    // ── Local response DTOs (per slice rules — not shared across features) ────────

    private record PlanResponse(
        Guid PlanId,
        Guid ClientId,
        Guid TrainerId,
        string Name,
        string? Description,
        string Status,
        int Version,
        DateTime DateCreated,
        DateTime? DateUpdated,
        DateTime? StartDate,
        DateTime? DateCompleted,
        Guid? QuestionnaireResponseId,
        List<WeekResponse> Weeks);

    private record WeekResponse(
        int WeekNumber,
        string Status,
        DateTime? DatePublished,
        List<SessionResponse> Sessions);

    private record SessionResponse(
        Guid SessionId,
        int DayOfWeek,
        string Name,
        int Order,
        string? Notes,
        List<SectionResponse> Sections,
        List<ExerciseResponse> Exercises);

    private record SectionResponse(
        Guid SectionId,
        int Order,
        string Name,
        string? Format,
        List<ExerciseResponse> Exercises);

    private record ExerciseResponse(
        Guid ExerciseExternalId,
        string ExerciseName,
        int Order,
        List<SetResponse> Sets);

    private record SetResponse(
        int SetNumber,
        string Type,
        int? Reps,
        decimal? WeightKg);
}
