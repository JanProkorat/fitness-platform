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

namespace FitnessPlatform.Tests.Endpoints.Client.Training;

/// <summary>
/// Integration tests for <c>GET /client/training/plans/{planId}</c>.
/// Uses Testcontainers (real PostgreSQL + MongoDB) so the ownership filter,
/// exercise muscle-group enrichment, and workout-log completion state are all
/// verified against a real stack.
/// </summary>
[Collection(TestCollection.Name)]
public class GetFullTrainingPlanIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@integration-test.com";

    /// <summary>
    /// Happy-path: client owns the plan.
    /// Verifies plan metadata, week dates, session counts, muscle-group enrichment,
    /// and per-set completion state derived from a partial workout log.
    /// </summary>
    [Fact]
    public async Task GetFullPlan_WithValidPlanAndPartialLog_Returns200_WithCorrectCompletionState()
    {
        var httpClient = factory.CreateClient();

        // ── 1. Register + log in the client ──────────────────────────────────────
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        // ── 2. Resolve client's PublicId and ApplicationUser.Id from Postgres ───────
        Guid clientPublicId;
        Guid clientUserId; // ApplicationUser.Id — used as WorkoutLog.ClientId
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
            clientUserId = user.Id;
        }

        // ── 3. Seed Exercise docs ─────────────────────────────────────────────────
        var squatId = Guid.NewGuid();
        var benchId = Guid.NewGuid();

        var squatExercise = new Exercise
        {
            ExternalId = squatId,
            Name = "Squat",
            MuscleGroups = [MuscleGroup.Quadriceps, MuscleGroup.Glutes],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var benchExercise = new Exercise
        {
            ExternalId = benchId,
            Name = "Bench Press",
            MuscleGroups = [MuscleGroup.Chest, MuscleGroup.Triceps],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        // ── 4. Seed TrainingPlan ──────────────────────────────────────────────────
        var planId = Guid.NewGuid();
        var sessionAId = Guid.NewGuid();
        var sessionBId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Hypertrophy Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-10),
            StartDate = DateTime.UtcNow.AddDays(-7), // Week 1 started 7 days ago
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-8),
                    Sessions =
                    [
                        // Session A: Squat, 3 sets — Monday
                        new TrainingSession
                        {
                            SessionId = sessionAId,
                            DayOfWeek = 1,
                            Name = "Leg Day",
                            Order = 1,
                            Notes = "Focus on depth",
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = squatId,
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            RestSeconds = 120,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 8, WeightKg = 100 },
                                                new ExerciseSet { SetNumber = 2, Type = SetType.Normal, Reps = 8, WeightKg = 100 },
                                                new ExerciseSet { SetNumber = 3, Type = SetType.Normal, Reps = 8, WeightKg = 100 }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        // Session B: Bench Press, 3 sets — also Monday (order 2)
                        new TrainingSession
                        {
                            SessionId = sessionBId,
                            DayOfWeek = 1,
                            Name = "Push Day",
                            Order = 2,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = benchId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            RestSeconds = 90,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 10, WeightKg = 80 },
                                                new ExerciseSet { SetNumber = 2, Type = SetType.Normal, Reps = 10, WeightKg = 80 },
                                                new ExerciseSet { SetNumber = 3, Type = SetType.Normal, Reps = 10, WeightKg = 80 }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // ── 5. Seed partial WorkoutLog for Session A (2 of 3 sets completed) ──────
        // WorkoutLog.ClientId stores the ApplicationUser.Id (not ClientProfile.PublicId).
        // The endpoint filters by ApplicationUser.Id derived from the JWT claim.
        var workoutLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = planId,
            SessionId = sessionAId,
            StartedAt = DateTime.UtcNow.AddDays(-6),
            IsCompleted = false,
            DateCreated = DateTime.UtcNow.AddDays(-6),
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = squatId,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, Reps = 8, WeightKg = 100, CompletedAt = DateTime.UtcNow.AddDays(-6).AddMinutes(5) },
                                new WorkoutSet { SetNumber = 2, Reps = 8, WeightKg = 100, CompletedAt = DateTime.UtcNow.AddDays(-6).AddMinutes(8) },
                                // Set 3 not completed
                                new WorkoutSet { SetNumber = 3, Reps = 0, WeightKg = 100, CompletedAt = null }
                            ]
                        }
                    ]
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.Exercises.InsertOneAsync(squatExercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.Exercises.InsertOneAsync(benchExercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.WorkoutLogs.InsertOneAsync(workoutLog, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── 6. GET /client/training/plans/{planId} ────────────────────────────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        // ── 7. Assert top-level ───────────────────────────────────────────────────
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // The API serializes enums as strings (JsonStringEnumConverter globally),
        // so use matching options when deserializing the test response.
        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PlanId.Should().Be(planId);
        body.PlanName.Should().Be("Test Hypertrophy Plan");
        body.Status.Should().Be("Active");
        body.TotalWeeks.Should().Be(1);
        body.PublishedWeekCount.Should().Be(1);
        body.Weeks.Should().HaveCount(1);

        // ── 8. Assert week ────────────────────────────────────────────────────────
        var week = body.Weeks[0];
        week.WeekNumber.Should().Be(1);
        week.Status.Should().Be("Published");
        week.Sessions.Should().HaveCount(2);

        // Week start/end should be derived from StartDate
        week.WeekStartDate.Should().NotBeNull();
        week.WeekEndDate.Should().NotBeNull();

        // ── 9. Assert Session A (Leg Day — partial completion) ────────────────────
        var sessionA = week.Sessions.First(s => s.SessionId == sessionAId);
        sessionA.TotalExerciseCount.Should().Be(1);
        sessionA.CompletedExerciseCount.Should().Be(0,
            "only 2 of 3 sets are logged, so the exercise is not fully complete");

        sessionA.Exercises.Should().HaveCount(1);
        var squatDto = sessionA.Exercises[0];
        squatDto.ExerciseExternalId.Should().Be(squatId);
        squatDto.IsCompleted.Should().BeFalse("only 2 of 3 sets are done");
        squatDto.MuscleGroups.Should().Contain(MuscleGroup.Quadriceps);
        squatDto.MuscleGroups.Should().Contain(MuscleGroup.Glutes);
        squatDto.Sets.Should().HaveCount(3);

        var completedSets = squatDto.Sets.Where(s => s.CompletedAt is not null).ToList();
        completedSets.Should().HaveCount(2, "sets 1 and 2 were logged as completed");

        var pendingSet = squatDto.Sets.First(s => s.SetNumber == 3);
        pendingSet.CompletedAt.Should().BeNull("set 3 was not completed");

        // ── 10. Assert Session B (Push Day — no log, no completion) ──────────────
        var sessionB = week.Sessions.First(s => s.SessionId == sessionBId);
        sessionB.TotalExerciseCount.Should().Be(1);
        sessionB.CompletedExerciseCount.Should().Be(0);

        sessionB.Exercises.Should().HaveCount(1);
        var benchDto = sessionB.Exercises[0];
        benchDto.ExerciseExternalId.Should().Be(benchId);
        benchDto.IsCompleted.Should().BeFalse();
        benchDto.MuscleGroups.Should().Contain(MuscleGroup.Chest);
        benchDto.MuscleGroups.Should().Contain(MuscleGroup.Triceps);
        benchDto.Sets.Should().HaveCount(3);
        benchDto.Sets.Should().AllSatisfy(s => s.CompletedAt.Should().BeNull());
    }

    /// <summary>
    /// Ownership guard: a second client calling with the first client's plan ID receives 404,
    /// not 403 — existence is not leaked.
    /// </summary>
    [Fact]
    public async Task GetFullPlan_ByNonOwner_Returns404()
    {
        var httpClient = factory.CreateClient();

        // ── Register + log in first client (plan owner) ───────────────────────────
        var ownerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, ownerEmail, "TestPass1!", "Owner", "Client", "Client");

        Guid ownerPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == ownerEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            ownerPublicId = profile.PublicId;
        }

        // Seed a plan for the owner
        var ownerPlanId = Guid.NewGuid();
        var ownerPlan = new TrainingPlan
        {
            ExternalId = ownerPlanId,
            ClientId = ownerPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Owner's Secret Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-1),
                    Sessions = []
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(ownerPlan, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── Register + log in second client (the attacker) ───────────────────────
        var attackerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, attackerEmail, "TestPass1!", "Attacker", "Client", "Client");
        var (attackerToken, _) = await TestHelpers.LoginAsync(httpClient, attackerEmail, "TestPass1!");

        // ── Call with attacker's token against the owner's plan ──────────────────
        TestHelpers.SetBearerToken(httpClient, attackerToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{ownerPlanId}",
            TestContext.Current.CancellationToken);

        // ── Expect 404 — not 403 — to avoid leaking existence ────────────────────
        response.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "non-owner must receive 404 so plan existence is not revealed");
    }

    /// <summary>
    /// Section round-trip: a plan with explicit sections must return those sections in the response,
    /// preserving order, name, format, and per-section exercises.
    /// The backward-compat flat Exercises list must equal the concatenation across sections in order.
    /// </summary>
    [Fact]
    public async Task GetFullPlan_WithExplicitSections_ReturnsSectionsAndFlatExercises()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Section", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var squatId = Guid.NewGuid();
        var benchId = Guid.NewGuid();

        var squatExercise = new Exercise
        {
            ExternalId = squatId,
            Name = "Squat",
            MuscleGroups = [MuscleGroup.Quadriceps],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var benchExercise = new Exercise
        {
            ExternalId = benchId,
            Name = "Bench Press",
            MuscleGroups = [MuscleGroup.Chest],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var warmUpSectionId = Guid.NewGuid();
        var mainSectionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Sections Round-trip Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-5),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-4),
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 2,
                            Name = "Full Body",
                            Order = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = warmUpSectionId,
                                    Order = 0,
                                    Name = "Warm-up",
                                    Format = null,
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = squatId,
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Warmup, Reps = 10 }]
                                        }
                                    ]
                                },
                                new TrainingSection
                                {
                                    SectionId = mainSectionId,
                                    Order = 1,
                                    Name = "Hlavní",
                                    Format = Application.Domain.Enums.WorkoutFormat.AMRAP,
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = benchId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 8, WeightKg = 80 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.Exercises.InsertOneAsync(squatExercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.Exercises.InsertOneAsync(benchExercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();

        var session = body!.Weeks[0].Sessions[0];

        // ── Sections round-trip ───────────────────────────────────────────────────
        session.Sections.Should().HaveCount(2, "two sections were persisted");

        var warmUp = session.Sections.First(s => s.SectionId == warmUpSectionId);
        warmUp.Order.Should().Be(0);
        warmUp.Name.Should().Be("Warm-up");
        warmUp.Format.Should().BeNull("Warm-up has no format");
        warmUp.Exercises.Should().HaveCount(1);
        warmUp.Exercises[0].ExerciseExternalId.Should().Be(squatId);

        var main = session.Sections.First(s => s.SectionId == mainSectionId);
        main.Order.Should().Be(1);
        main.Name.Should().Be("Hlavní");
        main.Format.Should().Be("AMRAP");
        main.Exercises.Should().HaveCount(1);
        main.Exercises[0].ExerciseExternalId.Should().Be(benchId);

        // ── Backward-compat flat list equals sections concatenated in order ────────
        session.Exercises.Should().HaveCount(2, "total exercises across both sections");
        session.Exercises[0].ExerciseExternalId.Should().Be(squatId, "Warm-up exercise comes first (Order=0)");
        session.Exercises[1].ExerciseExternalId.Should().Be(benchId, "Hlavní exercise comes second (Order=1)");
    }

    /// <summary>
    /// Schema-on-read backfill: a plan stored with only flat LegacyExercises (no Sections)
    /// must be transparently backfilled into a single "Hlavní" section at read time.
    /// </summary>
    [Fact]
    public async Task GetFullPlan_WithLegacyFlatExercises_BackfillsIntoHlavniSection()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Legacy", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var squatId = Guid.NewGuid();
        var squatExercise = new Exercise
        {
            ExternalId = squatId,
            Name = "Squat",
            MuscleGroups = [MuscleGroup.Quadriceps],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        // Build a plan whose session has only LegacyExercises and an empty Sections list.
        // This simulates a pre-sections document in MongoDB.
        var legacySession = new TrainingSession
        {
            SessionId = sessionId,
            DayOfWeek = 3,
            Name = "Legacy Day",
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
                        new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 80 },
                        new ExerciseSet { SetNumber = 2, Type = SetType.Normal, Reps = 5, WeightKg = 80 }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Legacy Flat Plan",
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
            await mongo.Exercises.InsertOneAsync(squatExercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();

        var session = body!.Weeks[0].Sessions[0];

        // ── Schema-on-read: one section backfilled as "Hlavní" ───────────────────
        session.Sections.Should().HaveCount(1, "legacy exercises must be wrapped in a single default section");
        var hlavni = session.Sections[0];
        hlavni.Name.Should().Be("Hlavní");
        hlavni.Format.Should().BeNull();
        hlavni.Exercises.Should().HaveCount(1);
        hlavni.Exercises[0].ExerciseExternalId.Should().Be(squatId);
        hlavni.Exercises[0].Sets.Should().HaveCount(2);

        // ── Backward-compat flat list also populated ─────────────────────────────
        session.Exercises.Should().HaveCount(1);
        session.Exercises[0].ExerciseExternalId.Should().Be(squatId);

        // ── Muscle-group enrichment works for backfilled exercises ────────────────
        session.Exercises[0].MuscleGroups.Should().Contain(MuscleGroup.Quadriceps);
    }

    // ── SectionDto.IsCompleted tests ─────────────────────────────────────────────

    /// <summary>
    /// Empty-exercise section where MarkWholeDayComplete wrote a CompletedSectionIds entry
    /// must return IsCompleted = true.
    /// </summary>
    [Fact]
    public async Task Returns_IsCompleted_True_For_Empty_Section_With_Completion_Row()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Empty", "Section", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var emptySectionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Empty Section Plan",
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
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Running",
                            Order = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = emptySectionId,
                                    Order = 0,
                                    Name = "Running",
                                    Exercises = []
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientPublicId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [],
            CompletedSectionIds = [emptySectionId],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var section = body!.Weeks[0].Sessions[0].Sections[0];
        section.SectionId.Should().Be(emptySectionId);
        section.Exercises.Should().BeEmpty();
        section.IsCompleted.Should().BeTrue(
            "empty section was added to CompletedSectionIds by MarkWholeDayComplete");
    }

    /// <summary>
    /// Non-empty section where all exercises are completed via TrainingCompletion
    /// must return IsCompleted = true.
    /// </summary>
    [Fact]
    public async Task Returns_IsCompleted_True_For_NonEmpty_Section_With_All_Exercises_Done()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Nonempty", "Done", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();
        var ex1Id = Guid.NewGuid();
        var ex2Id = Guid.NewGuid();

        var ex1 = new Exercise
        {
            ExternalId = ex1Id,
            Name = "Squat",
            MuscleGroups = [MuscleGroup.Quadriceps],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var ex2 = new Exercise
        {
            ExternalId = ex2Id,
            Name = "Deadlift",
            MuscleGroups = [MuscleGroup.Hamstrings],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "All Done Plan",
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
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Leg Day",
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
                                            ExerciseExternalId = ex1Id,
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 100 }]
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = ex2Id,
                                            ExerciseName = "Deadlift",
                                            Order = 2,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 120 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Mark both exercises complete via TrainingCompletion
        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientPublicId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [ex1Id, ex2Id],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.Exercises.InsertOneAsync(ex1, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.Exercises.InsertOneAsync(ex2, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var section = body!.Weeks[0].Sessions[0].Sections[0];
        section.Exercises.Should().HaveCount(2);
        section.IsCompleted.Should().BeTrue("both exercises are marked complete via TrainingCompletion");
    }

    /// <summary>
    /// Non-empty section where only one of two exercises is done must return IsCompleted = false.
    /// </summary>
    [Fact]
    public async Task Returns_IsCompleted_False_For_Partially_Completed_NonEmpty_Section()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Partial", "Section", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();
        var ex1Id = Guid.NewGuid();
        var ex2Id = Guid.NewGuid();

        var ex1 = new Exercise
        {
            ExternalId = ex1Id,
            Name = "Pull-up",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Bodyweight,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var ex2 = new Exercise
        {
            ExternalId = ex2Id,
            Name = "Row",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "Partial Section Plan",
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
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 2,
                            Name = "Pull Day",
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
                                            ExerciseExternalId = ex1Id,
                                            ExerciseName = "Pull-up",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 8 }]
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = ex2Id,
                                            ExerciseName = "Row",
                                            Order = 2,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 10 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Only ex1 is marked complete (not ex2)
        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientPublicId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [ex1Id],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.Exercises.InsertOneAsync(ex1, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.Exercises.InsertOneAsync(ex2, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var section = body!.Weeks[0].Sessions[0].Sections[0];
        section.Exercises.Should().HaveCount(2);
        section.IsCompleted.Should().BeFalse("only one of two exercises is done — partial completion");
    }

    /// <summary>
    /// When no TrainingCompletion row exists at all, IsCompleted must be false
    /// for both empty and non-empty sections.
    /// </summary>
    [Fact]
    public async Task Returns_IsCompleted_False_When_No_TrainingCompletion_Exists()
    {
        var httpClient = factory.CreateClient();

        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "No", "Completion", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientPublicId = profile.PublicId;
        }

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var emptySectionId = Guid.NewGuid();
        var nonEmptySectionId = Guid.NewGuid();
        var exId = Guid.NewGuid();

        var exercise = new Exercise
        {
            ExternalId = exId,
            Name = "Lunge",
            MuscleGroups = [MuscleGroup.Quadriceps],
            Equipment = ExerciseEquipment.Bodyweight,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Beginner,
            IsActive = true,
            Source = "system",
            DateCreated = DateTime.UtcNow
        };

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = Guid.NewGuid(),
            Name = "No Completion Plan",
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
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 3,
                            Name = "Mixed Day",
                            Order = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = emptySectionId,
                                    Order = 0,
                                    Name = "Running",
                                    Exercises = []
                                },
                                new TrainingSection
                                {
                                    SectionId = nonEmptySectionId,
                                    Order = 1,
                                    Name = "Strength",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exId,
                                            ExerciseName = "Lunge",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 12 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // No TrainingCompletion inserted at all
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.Exercises.InsertOneAsync(exercise, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            $"/client/training/plans/{planId}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
        var body = await response.Content.ReadFromJsonAsync<FullPlanResponse>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var sections = body!.Weeks[0].Sessions[0].Sections;
        sections.Should().HaveCount(2);

        var emptySection = sections.First(s => s.SectionId == emptySectionId);
        emptySection.IsCompleted.Should().BeFalse("no TrainingCompletion exists — empty section must be false");

        var nonEmptySection = sections.First(s => s.SectionId == nonEmptySectionId);
        nonEmptySection.IsCompleted.Should().BeFalse("no TrainingCompletion exists — non-empty section must be false");
    }

    // ── Local response DTOs (per slice rules — not shared across features) ────────

    private record FullPlanResponse(
        Guid PlanId,
        string PlanName,
        string Status,
        DateTime? StartDate,
        int? CurrentWeek,
        int TotalWeeks,
        int PublishedWeekCount,
        Guid? QuestionnaireResponseId,
        DateTime? DateCompleted,
        List<WeekResponse> Weeks);

    private record WeekResponse(
        int WeekNumber,
        string Status,
        DateTime? DatePublished,
        DateTime? WeekStartDate,
        DateTime? WeekEndDate,
        Dictionary<int, string> DayNotes,
        List<SessionResponse> Sessions);

    private record SessionResponse(
        Guid SessionId,
        int DayOfWeek,
        string Name,
        int Order,
        string? Notes,
        int CompletedExerciseCount,
        int TotalExerciseCount,
        int? EstimatedDurationMinutes,
        List<SectionResponse> Sections,
        List<ExerciseResponse> Exercises);

    private record SectionResponse(
        Guid SectionId,
        int Order,
        string Name,
        string? Format,
        WodConfigResponse? FormatConfig,
        string? Notes,
        bool IsCompleted,
        List<ExerciseResponse> Exercises);

    private record WodConfigResponse(
        int? TimeCapSeconds,
        int? IntervalSeconds,
        int? TotalRounds,
        int? WorkSeconds,
        int? RestSeconds);

    private record ExerciseResponse(
        Guid ExerciseExternalId,
        string ExerciseName,
        int Order,
        string? Notes,
        int? RestSeconds,
        List<MuscleGroup> MuscleGroups,
        bool IsCompleted,
        List<SetResponse> Sets);

    private record SetResponse(
        int SetNumber,
        string Type,
        int? Reps,
        decimal? WeightKg,
        int? DurationSeconds,
        int? RestSeconds,
        DateTime? CompletedAt);
}
