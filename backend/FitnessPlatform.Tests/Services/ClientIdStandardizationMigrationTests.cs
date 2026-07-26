using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real PostgreSQL + MongoDB, via the shared
/// <see cref="FitnessApiFactory"/>) for the #840 clientId-standardisation boot migration:
/// <see cref="MongoIndexInitializer.MigrateClientIdsAsync"/>.
///
/// Unlike the #837 schema-on-read migration tests
/// (<see cref="FitnessPlatform.Tests.Services.PlanSchemaOnReadMigrationTests"/>), this migration
/// reads ClientProfile rows from PostgreSQL to build the PublicId→UserId map, so it needs a real
/// relational database in addition to MongoDB — hence the shared <see cref="FitnessApiFactory"/>
/// fixture instead of an ad-hoc Mongo-only container.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientIdStandardizationMigrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@clientid-migration-{tag}.com";

    /// <summary>
    /// Registers a real client through the API (so PostgreSQL has a genuine ClientProfile
    /// row with independent, random PublicId/UserId values) and returns both identifiers.
    /// </summary>
    private async Task<(Guid PublicId, Guid UserId)> CreateClientAsync(string tag)
    {
        var http = factory.CreateClient();
        var email = UniqueEmail(tag);

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (profile.PublicId, profile.UserId);
    }

    /// <summary>
    /// Runs <see cref="MongoIndexInitializer.MigrateClientIdsAsync"/> once, in a fresh DI scope
    /// (mirroring how Program.cs resolves it in the pre-<c>app.Run()</c> migration scope).
    /// </summary>
    private async Task RunMigrationAsync()
    {
        using var scope = factory.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await initializer.MigrateClientIdsAsync(db, TestContext.Current.CancellationToken);
    }

    // ── (1) All seven collections rewritten; WorkoutLog untouched ────────────────

    [Fact]
    public async Task MigrateClientIdsAsync_DocsSeededOnPublicId_RewrittenToUserId_WorkoutLogUntouched()
    {
        var (publicId, userId) = await CreateClientAsync("multi");

        var nutritionExternalId = Guid.NewGuid();
        var trainingExternalId = Guid.NewGuid();
        var completionExternalId = Guid.NewGuid();
        var dayLogExternalId = Guid.NewGuid();
        var mealLogPlanId = Guid.NewGuid();
        var sessionLogPlanId = Guid.NewGuid();
        var sessionLockSessionId = Guid.NewGuid();
        var workoutLogExternalId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var ct = TestContext.Current.CancellationToken;

            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = nutritionExternalId,
                ClientId = publicId,   // pre-migration (stale) key
                NutritionistId = Guid.NewGuid(),
                Name = "Migration Nutrition Plan",
                Status = NutritionPlanStatus.Active,
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);

            await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = trainingExternalId,
                ClientId = publicId,
                TrainerId = Guid.NewGuid(),
                Name = "Migration Training Plan",
                Status = TrainingPlanStatus.Active,
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);

            await mongo.TrainingCompletions.InsertOneAsync(new TrainingCompletion
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = completionExternalId,
                ClientId = publicId,
                Date = DateTime.UtcNow.Date,
                SessionId = Guid.NewGuid(),
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);

            await mongo.DayLogs.InsertOneAsync(new DayLog
            {
                Id = ObjectId.GenerateNewId().ToString(),
                ExternalId = dayLogExternalId,
                ClientId = publicId,
                PlanId = Guid.NewGuid(),
                LogDate = DateTime.UtcNow.Date,
                Version = 1,
            }, cancellationToken: ct);

            await mongo.MealLogs.InsertOneAsync(new MealLog
            {
                Id = ObjectId.GenerateNewId(),
                ClientId = publicId,
                PlanId = mealLogPlanId,
                MealId = Guid.NewGuid(),
                LogDate = DateTime.UtcNow.Date,
                EatenAt = DateTime.UtcNow,
                FoodsEaten = [],
            }, cancellationToken: ct);

            await mongo.SessionLogs.InsertOneAsync(new SessionLog
            {
                Id = ObjectId.GenerateNewId(),
                ClientId = publicId,
                PlanId = sessionLogPlanId,
                SessionId = Guid.NewGuid(),
                LogDate = DateTime.UtcNow.Date,
            }, cancellationToken: ct);

            await mongo.SessionLocks.InsertOneAsync(new SessionLock
            {
                Id = ObjectId.GenerateNewId(),
                SessionId = sessionLockSessionId,
                PlanId = Guid.NewGuid(),
                ClientId = publicId,
                TrainerId = Guid.NewGuid(),
                Holder = LockHolder.Coach,
                Type = LockType.Editing,
                AcquiredAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(30),
            }, cancellationToken: ct);

            // WorkoutLog already keyed on ApplicationUser.Id — untouched by #840.
            await mongo.WorkoutLogs.InsertOneAsync(new WorkoutLog
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = workoutLogExternalId,
                ClientId = userId,
                StartedAt = DateTime.UtcNow.AddMinutes(-30),
                IsCompleted = false,
                Sections = [],
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);
        }

        await RunMigrationAsync();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var ct = TestContext.Current.CancellationToken;

            var nutritionPlan = await mongo.NutritionPlans
                .Find(p => p.ExternalId == nutritionExternalId).FirstOrDefaultAsync(ct);
            nutritionPlan!.ClientId.Should().Be(userId,
                "NutritionPlan.ClientId must be rewritten to ApplicationUser.Id");

            var trainingPlan = await mongo.TrainingPlans
                .Find(p => p.ExternalId == trainingExternalId).FirstOrDefaultAsync(ct);
            trainingPlan!.ClientId.Should().Be(userId,
                "TrainingPlan.ClientId must be rewritten to ApplicationUser.Id");

            var completion = await mongo.TrainingCompletions
                .Find(c => c.ExternalId == completionExternalId).FirstOrDefaultAsync(ct);
            completion!.ClientId.Should().Be(userId,
                "TrainingCompletion.ClientId must be rewritten to ApplicationUser.Id");

            var dayLog = await mongo.DayLogs
                .Find(d => d.ExternalId == dayLogExternalId).FirstOrDefaultAsync(ct);
            dayLog!.ClientId.Should().Be(userId,
                "DayLog.ClientId must be rewritten to ApplicationUser.Id");

            var mealLog = await mongo.MealLogs
                .Find(m => m.PlanId == mealLogPlanId).FirstOrDefaultAsync(ct);
            mealLog!.ClientId.Should().Be(userId,
                "MealLog.ClientId must be rewritten to ApplicationUser.Id");

            var sessionLog = await mongo.SessionLogs
                .Find(s => s.PlanId == sessionLogPlanId).FirstOrDefaultAsync(ct);
            sessionLog!.ClientId.Should().Be(userId,
                "SessionLog.ClientId must be rewritten to ApplicationUser.Id");

            var sessionLock = await mongo.SessionLocks
                .Find(l => l.SessionId == sessionLockSessionId).FirstOrDefaultAsync(ct);
            sessionLock!.ClientId.Should().Be(userId,
                "SessionLock.ClientId must be rewritten to ApplicationUser.Id");

            var workoutLog = await mongo.WorkoutLogs
                .Find(w => w.ExternalId == workoutLogExternalId).FirstOrDefaultAsync(ct);
            workoutLog!.ClientId.Should().Be(userId,
                "WorkoutLog was already keyed on ApplicationUser.Id and must remain untouched");
        }
    }

    // ── (2) Idempotency — a second run mutates 0 documents ───────────────────────

    [Fact]
    public async Task MigrateClientIdsAsync_SecondRun_MutatesZeroDocuments()
    {
        var (publicId, userId) = await CreateClientAsync("idempotent");
        var planExternalId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = planExternalId,
                ClientId = publicId,
                NutritionistId = Guid.NewGuid(),
                Name = "Idempotency Plan",
                Status = NutritionPlanStatus.Active,
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: TestContext.Current.CancellationToken);
        }

        // First run: migrates the seeded document.
        await RunMigrationAsync();

        NutritionPlan afterFirstRun;
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            afterFirstRun = (await mongo.NutritionPlans
                .Find(p => p.ExternalId == planExternalId)
                .FirstOrDefaultAsync(TestContext.Current.CancellationToken))!;
        }

        afterFirstRun.ClientId.Should().Be(userId, "the first run must rewrite PublicId to UserId");

        // Second run: must be a safe no-op — no document changes at all.
        var act = RunMigrationAsync;
        await act.Should().NotThrowAsync("re-running the migration on already-migrated data must be safe");

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var afterSecondRun = await mongo.NutritionPlans
                .Find(p => p.ExternalId == planExternalId)
                .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

            afterSecondRun!.ClientId.Should().Be(userId,
                "the already-migrated document must remain keyed on UserId");
            afterSecondRun.Should().BeEquivalentTo(afterFirstRun,
                "a second run must mutate 0 documents — the already-migrated document is untouched");
        }
    }

    // ── (3) Partial-interruption resume — remainder completes, already-migrated untouched ─

    [Fact]
    public async Task MigrateClientIdsAsync_PartialInterruptionResume_MigratesRemainderWithoutTouchingAlreadyMigrated()
    {
        // Simulates a crash mid-batch: clientA's documents were already rewritten to UserId
        // before the interruption; clientB's documents are still on the stale PublicId key.
        var (_, clientAUserId) = await CreateClientAsync("partial-a");
        var (clientBPublicId, clientBUserId) = await CreateClientAsync("partial-b");

        var planAExternalId = Guid.NewGuid();
        var planBExternalId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var ct = TestContext.Current.CancellationToken;

            // Client A: already migrated (simulates the pre-interruption progress).
            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = planAExternalId,
                ClientId = clientAUserId,
                NutritionistId = Guid.NewGuid(),
                Name = "Already Migrated Plan (Client A)",
                Status = NutritionPlanStatus.Active,
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);

            // Client B: not yet migrated — still on the stale PublicId key.
            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = planBExternalId,
                ClientId = clientBPublicId,
                NutritionistId = Guid.NewGuid(),
                Name = "Not Yet Migrated Plan (Client B)",
                Status = NutritionPlanStatus.Active,
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: ct);
        }

        NutritionPlan clientADocBeforeResume;
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            clientADocBeforeResume = (await mongo.NutritionPlans
                .Find(p => p.ExternalId == planAExternalId)
                .FirstOrDefaultAsync(TestContext.Current.CancellationToken))!;
        }

        // Resume the migration (simulating the retry after a mid-batch crash).
        await RunMigrationAsync();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var ct = TestContext.Current.CancellationToken;

            var clientADocAfterResume = await mongo.NutritionPlans
                .Find(p => p.ExternalId == planAExternalId).FirstOrDefaultAsync(ct);
            var clientBDocAfterResume = await mongo.NutritionPlans
                .Find(p => p.ExternalId == planBExternalId).FirstOrDefaultAsync(ct);

            clientBDocAfterResume!.ClientId.Should().Be(clientBUserId,
                "the remainder (client B, still on PublicId) must be completed by the resumed run");

            clientADocAfterResume!.ClientId.Should().Be(clientAUserId,
                "the already-migrated client A document must not be touched by the resumed run");
            clientADocAfterResume.Should().BeEquivalentTo(clientADocBeforeResume,
                "the resumed run must mutate 0 of the already-migrated documents");
        }
    }

    // ── (4) Plan↔actuals read resolves non-empty for a migrated client ───────────

    [Fact]
    public async Task MigrateClientIdsAsync_PlanAndMealLogSeededOnPublicId_ComplianceResolvesNonEmptyAfterMigration()
    {
        var (publicId, userId) = await CreateClientAsync("compliance");

        var today = DateTime.UtcNow.Date;
        var dow = (int)today.DayOfWeek;
        dow = dow == 0 ? 7 : dow;
        var mondayThisWeek = today.AddDays(-(dow - 1));

        var plan = PlanTestHelpers.CreatePlan(
            clientId: publicId,   // pre-migration (stale) key
            status: NutritionPlanStatus.Active,
            weekCount: 1,
            name: "Compliance Read Plan");
        plan.Id = ObjectId.GenerateNewId();
        plan.DatePublished = mondayThisWeek;
        plan.StartDate = mondayThisWeek;
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = mondayThisWeek;
        plan.Weeks[0].Days[dow - 1].Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var ct = TestContext.Current.CancellationToken;

            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

            // MealLog also seeded on the stale PublicId key — matches the plan pre-migration.
            await mongo.MealLogs.InsertOneAsync(new MealLog
            {
                Id = ObjectId.GenerateNewId(),
                ClientId = publicId,
                PlanId = plan.ExternalId,
                MealId = plan.Weeks[0].Days[dow - 1].Meals[0].MealId,
                LogDate = today,
                EatenAt = DateTime.UtcNow,
                FoodsEaten = [],
            }, cancellationToken: ct);
        }

        // Before migration: a read keyed on UserId (the canonical, post-#840 key every
        // endpoint now uses) finds nothing — the documents are still stale-keyed on PublicId.
        using (var scope = factory.Services.CreateScope())
        {
            var complianceService = scope.ServiceProvider.GetRequiredService<IComplianceService>();
            var preMigrationResult = await complianceService.CalculateComplianceAsync(
                userId, today, today, TestContext.Current.CancellationToken);

            preMigrationResult.NutritionCompliancePercent.Should().Be(0m,
                "before migration, the plan/log are still keyed on the stale PublicId — a UserId-keyed read must find nothing");
        }

        await RunMigrationAsync();

        // After migration: the same UserId-keyed read now resolves the plan and the logged
        // meal — proving the plan↔actuals join is non-empty once the documents are rewritten.
        using (var scope = factory.Services.CreateScope())
        {
            var complianceService = scope.ServiceProvider.GetRequiredService<IComplianceService>();
            var postMigrationResult = await complianceService.CalculateComplianceAsync(
                userId, today, today, TestContext.Current.CancellationToken);

            postMigrationResult.NutritionCompliancePercent.Should().NotBe(0m,
                "after migration, the UserId-keyed read must resolve the published plan and the logged meal");
        }
    }
}
