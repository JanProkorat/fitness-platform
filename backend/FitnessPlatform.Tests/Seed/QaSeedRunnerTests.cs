using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Seed;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Seed;

// ---------------------------------------------------------------------------
// Factory — mirrors ResetEndpointFactoryBase but replaces FakeBlobStorageService
// with TrackingBlobStorageService so we can assert blob uploads without a real
// MinIO instance.  No MinIO Testcontainer is needed; the seed's Ensure*ImageAsync
// helpers call IBlobStorageService.UploadAsync which writes to the in-memory store.
// ---------------------------------------------------------------------------

/// <summary>
/// Blob storage stub that records uploaded keys so seed idempotency tests can
/// assert that each key was written exactly once per seed run.
/// </summary>
public sealed class TrackingBlobStorageService : IBlobStorageService
{
    private readonly HashSet<string> _objects = new(StringComparer.Ordinal);

    public List<string> UploadCalls { get; } = [];

    public Task<BlobUploadUrl> GenerateUploadUrlAsync(
        string containerPath, string contentType, TimeSpan expiresIn, CancellationToken ct)
    {
        var uploadUrl = $"https://fake-storage/upload/{containerPath}?token=test";
        return Task.FromResult(new BlobUploadUrl(uploadUrl, BuildPublicUrl(containerPath)));
    }

    /// <inheritdoc />
    /// <remarks>Mirrors <see cref="FitnessPlatform.Tests.Infrastructure.FakeBlobStorageService"/> — returns the bare container path (test double, no real host).</remarks>
    public string BuildPublicUrl(string containerPath) => containerPath;

    public Task UploadAsync(string containerPath, byte[] data, string contentType, CancellationToken ct)
    {
        _objects.Add(containerPath);
        UploadCalls.Add(containerPath);
        return Task.CompletedTask;
    }

    public Task<bool> ObjectExistsAsync(string containerPath, CancellationToken ct) =>
        Task.FromResult(_objects.Contains(containerPath));

    public Task DeleteAsync(string containerPath, CancellationToken ct)
    {
        _objects.Remove(containerPath);
        return Task.CompletedTask;
    }
}

/// <summary>
/// WebApplicationFactory that wires up real Postgres + Mongo via Testcontainers
/// and uses <see cref="TrackingBlobStorageService"/> in place of the real MinIO
/// blob service.  The TestingEnabled flag is set so QaSeedRunner's password check
/// is satisfied via the env var set in <see cref="ConfigureWebHost"/>.
/// </summary>
public class QaSeedRunnerFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    public TrackingBlobStorageService BlobStorage { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("MONGO_PASSWORD", "test");
        builder.UseSetting("MINIO_ACCESS_KEY", "test");
        builder.UseSetting("MINIO_SECRET_KEY", "test");
        builder.UseSetting("JWT_SECRET", new string('x', 64));
        builder.UseSetting("RateLimiting:Disabled", "true");
        builder.UseSetting("Testing:Enabled", "true");

        // QaSeedRunner reads this via Environment.GetEnvironmentVariable.
        Environment.SetEnvironmentVariable("QA_SEED_PASSWORD", "TestSeed1!");

        builder.UseSetting("ConnectionStrings:PostgreSQl",
            "Host=localhost;Database=placeholder;Username=postgres");
        builder.UseSetting("ConnectionStrings:MongoDB",
            "mongodb://localhost:27017");

        builder.ConfigureServices(services =>
        {
            // Replace DbContext with Testcontainer-backed Postgres.
            var pgDesc = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (pgDesc is not null) services.Remove(pgDesc);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString())
                    .ConfigureWarnings(w => w.Ignore(
                        Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

            // Replace MongoDB with Testcontainer.
            var mongoDbDesc = services.SingleOrDefault(d => d.ServiceType == typeof(IMongoDatabase));
            if (mongoDbDesc is not null) services.Remove(mongoDbDesc);

            var mongoCtxDesc = services.SingleOrDefault(d => d.ServiceType == typeof(IMongoContext));
            if (mongoCtxDesc is not null) services.Remove(mongoCtxDesc);

            services.AddSingleton<IMongoDatabase>(_ =>
            {
                var client = new MongoClient(_mongo.GetConnectionString());
                return client.GetDatabase("fitness_test");
            });
            services.AddSingleton<IMongoContext, MongoContext>();

            // Replace external services with fakes.
            var emailDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IEmailService));
            if (emailDesc is not null) services.Remove(emailDesc);
            services.AddScoped<FitnessPlatform.Application.Domain.Interfaces.IEmailService, FakeEmailService>();

            var notifierDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IRealtimeNotifier));
            if (notifierDesc is not null) services.Remove(notifierDesc);
            services.AddSingleton<FakeRealtimeNotifier>();
            services.AddSingleton<FitnessPlatform.Application.Domain.Interfaces.IRealtimeNotifier>(
                sp => sp.GetRequiredService<FakeRealtimeNotifier>());

            // Replace blob storage with our tracking stub (shared instance so
            // assertions can inspect it after SeedAsync runs).
            var blobDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(IBlobStorageService));
            if (blobDesc is not null) services.Remove(blobDesc);
            services.AddSingleton<IBlobStorageService>(BlobStorage);

            var pushDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IPushNotificationService));
            if (pushDesc is not null) services.Remove(pushDesc);
            services.AddSingleton<FakePushNotificationService>();
            services.AddSingleton<FitnessPlatform.Application.Domain.Interfaces.IPushNotificationService>(
                sp => sp.GetRequiredService<FakePushNotificationService>());
        });

        builder.UseEnvironment("Development");
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync());

        // Apply migrations + seed roles.
        await ApplicationDbContextSeed.SeedAsync(Services);
    }

    public new async ValueTask DisposeAsync()
    {
        // Skip base.DisposeAsync() to avoid disposing the root IServiceProvider
        // while other tests may be holding a reference (see FitnessApiFactory comment).
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }
}

// ---------------------------------------------------------------------------
// Test class
// ---------------------------------------------------------------------------

/// <summary>
/// Defines a separate collection for QaSeedRunner tests so they run serially
/// and don't contend with the shared Integration collection's Testcontainers.
/// </summary>
[CollectionDefinition("SeedTests")]
public class SeedTestsCollection;

/// <summary>
/// Idempotency integration tests for <see cref="QaSeedRunner.SeedAsync"/>.
/// All helpers must be individually idempotent: re-running over a partially or
/// fully seeded stack must converge without throwing on duplicate keys.
/// </summary>
[Collection("SeedTests")]
public class QaSeedRunnerTests : IAsyncLifetime
{
    private readonly QaSeedRunnerFactory _factory = new();

    public async ValueTask InitializeAsync() => await _factory.InitializeAsync();
    public async ValueTask DisposeAsync()    => await _factory.DisposeAsync();

    /// <summary>
    /// Running SeedAsync twice must be idempotent: all counts stay at 1
    /// and blob upload is not repeated after the first run.
    /// </summary>
    [Fact]
    public async Task SeedAsync_RunTwice_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        // Act — run twice.
        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        // PostgreSQL — exactly one user per role.
        var clientCount = await db.Users.CountAsync(
            u => u.Email == QaSeedRunner.ClientEmail, ct);
        clientCount.Should().Be(1, "QA client user must be created exactly once");

        var trainerCount = await db.Users.CountAsync(
            u => u.Email == QaSeedRunner.TrainerEmail, ct);
        trainerCount.Should().Be(1, "QA trainer user must be created exactly once");

        var nutriCount = await db.Users.CountAsync(
            u => u.Email == QaSeedRunner.NutriEmail, ct);
        nutriCount.Should().Be(1, "QA nutri user must be created exactly once");

        // MongoDB — foods.
        var foodExternalIds = new[]
        {
            QaSeedRunner.QaFood1ExternalId,
            QaSeedRunner.QaFood2ExternalId,
            QaSeedRunner.QaFood3ExternalId,
            QaSeedRunner.QaFood4ExternalId,
            QaSeedRunner.QaFood5ExternalId,
        };

        var foodCount = await mongo.Foods.CountDocumentsAsync(
            Builders<Food>.Filter.In(f => f.ExternalId, foodExternalIds),
            cancellationToken: ct);
        foodCount.Should().Be(5, "all five QA foods must be present with no duplicates");

        // MongoDB — recipes.
        var recipeExternalIds = new[]
        {
            QaSeedRunner.QaRecipe1ExternalId,
            QaSeedRunner.QaRecipe2ExternalId,
            QaSeedRunner.QaRecipe3ExternalId,
        };

        var recipeCount = await mongo.Recipes.CountDocumentsAsync(
            Builders<Recipe>.Filter.In(r => r.ExternalId, recipeExternalIds),
            cancellationToken: ct);
        recipeCount.Should().Be(3, "all three QA recipes must be present with no duplicates");

        // MongoDB — nutrition plan.
        var planCount = await mongo.NutritionPlans.CountDocumentsAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaNutritionPlanExternalId),
            cancellationToken: ct);
        planCount.Should().Be(1, "the QA nutrition plan must be created exactly once");

        // Blobs — the TrackingBlobStorageService records ObjectExistsAsync-aware state.
        // After the first seed run the object is "present"; the second run should skip.
        // Upload count must be exactly 2 (avatar + food image) — not 4 (no re-upload on second run).
        _factory.BlobStorage.UploadCalls.Count(k => k == QaSeedRunner.QaAvatarBlobKey)
            .Should().Be(1, "avatar must be uploaded exactly once — idempotency guard prevents re-upload");
        _factory.BlobStorage.UploadCalls.Count(k => k == QaSeedRunner.QaFoodImageBlobKey)
            .Should().Be(1, "food image must be uploaded exactly once — idempotency guard prevents re-upload");
    }

    /// <summary>
    /// QA_SEED_KIND=minimal must seed users + profiles + trainer↔client link only.
    /// All "rich" fixtures (training plan, foods, recipes, nutrition plan, blobs)
    /// must be absent.
    /// </summary>
    [Fact]
    public async Task SeedAsync_MinimalKind_SkipsRichFixtures()
    {
        var ct = TestContext.Current.CancellationToken;

        // Arrange — switch to minimal mode for this seed run.
        Environment.SetEnvironmentVariable("QA_SEED_KIND", "minimal");
        try
        {
            await QaSeedRunner.SeedAsync(_factory.Services);
        }
        finally
        {
            // Clear so other tests run with the default (rich).
            Environment.SetEnvironmentVariable("QA_SEED_KIND", null);
        }

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        // Users + profiles + link must all exist.
        (await db.Users.CountAsync(u => u.Email == QaSeedRunner.ClientEmail, ct))
            .Should().Be(1);
        (await db.Users.CountAsync(u => u.Email == QaSeedRunner.TrainerEmail, ct))
            .Should().Be(1);
        (await db.Users.CountAsync(u => u.Email == QaSeedRunner.NutriEmail, ct))
            .Should().Be(1);
        // Both trainer↔client links are seeded outside the Rich guard (so both
        // pairs are available for auth in any seed mode). Minimal mode creates
        // both links but no plans/foods/blobs.
        (await db.ClientProfessionalLinks.CountAsync(ct))
            .Should().Be(2, "both trainer↔client links are part of the minimal fixture (#474 adds a second pair)");

        // Rich fixtures must be absent.
        (await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaTrainingPlanExternalId),
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the training plan");
        (await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaPastTrainingPlanExternalId),
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the past training plan (#326)");
        (await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaMultiSectionPlanExternalId),
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the multi-section training plan (#474)");
        (await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Empty,
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips all workout logs");
        (await mongo.Foods.CountDocumentsAsync(
            Builders<Food>.Filter.Empty,
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips all foods");
        (await mongo.Recipes.CountDocumentsAsync(
            Builders<Recipe>.Filter.Empty,
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips all recipes");
        (await mongo.NutritionPlans.CountDocumentsAsync(
            Builders<NutritionPlan>.Filter.Empty,
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the nutrition plan");

        // No blob uploads in minimal mode.
        _factory.BlobStorage.UploadCalls.Should().BeEmpty("minimal seed skips both image blobs");
    }

    /// <summary>
    /// QA_SEED_KIND with a value other than "minimal" or "rich" must throw at
    /// resolve-time — before any database row gets created — so a typo like
    /// `--kind=ritch` doesn't leave behind a half-seeded fixture.
    /// </summary>
    [Fact]
    public async Task SeedAsync_UnknownKind_ThrowsInvalidOperation()
    {
        var ct = TestContext.Current.CancellationToken;

        Environment.SetEnvironmentVariable("QA_SEED_KIND", "ritch");
        try
        {
            var act = async () => await QaSeedRunner.SeedAsync(_factory.Services);
            await act.Should().ThrowAsync<InvalidOperationException>()
                .Where(ex => ex.Message.Contains("QA_SEED_KIND"));
        }
        finally
        {
            Environment.SetEnvironmentVariable("QA_SEED_KIND", null);
        }

        // No users should have been created — ResolveKind runs at the very top of
        // SeedAsync, before MigrateAsync + EnsureUserAsync. The typo's blast
        // radius is zero. (Asserts the contract documented on ResolveKind.)
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userCount = await db.Users.CountAsync(
            u => u.Email == QaSeedRunner.ClientEmail
                 || u.Email == QaSeedRunner.TrainerEmail
                 || u.Email == QaSeedRunner.NutriEmail,
            ct);
        userCount.Should().Be(0, "ResolveKind must run before any database write");
    }

    /// <summary>
    /// The past training plan (#326 fixture) must have:
    ///  - A WorkoutLog for the COMPLETED session with IsCompleted=true.
    ///  - A WorkoutLog for the SKIPPED session with IsCompleted=false.
    ///  - No WorkoutLog for the UNTOUCHED session.
    /// This is the minimal assertion the Playwright spec depends on to distinguish
    /// the three past-session states.
    /// </summary>
    [Fact]
    public async Task SeedAsync_PastTrainingPlan_HasThreeDistinctSessionStates()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        // Plan must exist with StartDate in the past.
        var plan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaPastTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull("the past training plan must be seeded");
        plan!.StartDate.Should().NotBeNull("past plan must have a StartDate");
        plan.StartDate!.Value.Should().BeBefore(DateTime.UtcNow.AddDays(-7),
            "StartDate must be at least one week in the past");
        plan.Weeks.Should().HaveCount(2, "plan has weeks 1 and 2");
        plan.Weeks.Should().AllSatisfy(w =>
            w.Status.Should().Be(FitnessPlatform.Application.Domain.Enums.WeekStatus.Published));
        // TrainerId must be ApplicationUser.Id (not ProfessionalProfile.PublicId) so that
        // GetTrainingPlansEndpoint can scope to the trainer:
        //   filter = filterBuilder.Eq(p => p.TrainerId, Guid.Parse(User.FindFirstValue(AppClaims.UserId)))
        // UserId from AppClaims.UserId is ApplicationUser.Id = TrainerUserId (22222222-...).
        // Using TrainerProfilePublicId (bbbb...) would make this plan invisible to GET /training/plans.
        plan.TrainerId.Should().Be(QaSeedRunner.TrainerUserId,
            "TrainingPlan.TrainerId must be ApplicationUser.Id — GetTrainingPlansEndpoint scopes by " +
            "Guid.Parse(AppClaims.UserId) which is ApplicationUser.Id, not ProfessionalProfile.PublicId");
        // ClientId must stay as ClientProfile.PublicId so that TrainingCompletion.ClientId
        // (written by WorkoutCompletionService as clientProfile.PublicId) matches
        // plan.ClientId used in GetTrainingPlanEndpoint's completions fold-in filter.
        plan.ClientId.Should().Be(QaSeedRunner.ClientProfilePublicId,
            "TrainingPlan.ClientId must be ClientProfile.PublicId — GetTrainingPlanEndpoint queries " +
            "TrainingCompletion by plan.ClientId and WorkoutCompletionService writes " +
            "TrainingCompletion.ClientId = clientProfile.PublicId");

        // COMPLETED session — WorkoutLog with IsCompleted=true.
        var completedLog = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaSeedRunner.QaPastCompletedWorkoutLogId)
            .FirstOrDefaultAsync(ct);

        completedLog.Should().NotBeNull("completed WorkoutLog must be seeded");
        completedLog!.IsCompleted.Should().BeTrue("PAST-COMPLETED log must have IsCompleted=true");
        completedLog.SessionId.Should().Be(QaSeedRunner.QaPastSessionCompletedId);
        completedLog.PlanId.Should().Be(QaSeedRunner.QaPastTrainingPlanExternalId);
        // WorkoutLog.ClientId must be ApplicationUser.Id (not ClientProfile.PublicId) so that
        // CompleteWorkoutEndpoint can filter by it and WorkoutCompletionService can resolve
        // the ClientProfile via cp.UserId == log.ClientId for the TrainingCompletion fan-out.
        completedLog.ClientId.Should().Be(QaSeedRunner.ClientUserId,
            "WorkoutLog.ClientId must be ApplicationUser.Id — CompleteWorkoutEndpoint filters by " +
            "Guid.Parse(AppClaims.UserId) which is ApplicationUser.Id, and WorkoutCompletionService " +
            "resolves the ClientProfile via cp.UserId == log.ClientId");
        completedLog.Sections.Should().HaveCount(1, "log mirrors the single section in the session");
        completedLog.Sections[0].Exercises.Should().HaveCount(2);
        completedLog.Sections[0].Exercises.Should().AllSatisfy(e =>
            e.Sets.Should().NotBeEmpty("completed log has sets on every exercise"));

        // SKIPPED session — WorkoutLog with IsCompleted=false.
        var skippedLog = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaSeedRunner.QaPastSkippedWorkoutLogId)
            .FirstOrDefaultAsync(ct);

        skippedLog.Should().NotBeNull("skipped WorkoutLog must be seeded");
        skippedLog!.IsCompleted.Should().BeFalse("PAST-SKIPPED log must have IsCompleted=false");
        skippedLog.SessionId.Should().Be(QaSeedRunner.QaPastSessionSkippedId);
        skippedLog.PlanId.Should().Be(QaSeedRunner.QaPastTrainingPlanExternalId);
        // Same id-space requirement as the completed log above.
        skippedLog.ClientId.Should().Be(QaSeedRunner.ClientUserId,
            "WorkoutLog.ClientId must be ApplicationUser.Id for the same reason as the completed log");

        // UNTOUCHED session — must have NO WorkoutLog.
        var untouchedLogCount = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, QaSeedRunner.QaPastSessionUntouchedId),
            cancellationToken: ct);

        untouchedLogCount.Should().Be(0,
            "PAST-UNTOUCHED session must have no WorkoutLog so the web classifies it as untouched");
    }

    /// <summary>
    /// The ForTime fixture plan (<see cref="QaSeedRunner.QaTrainingPlanExternalId"/>) must have
    /// TrainerId = TrainerUserId (ApplicationUser.Id = 22222222-...) so that trainer-scoped
    /// endpoints which filter by Guid.Parse(AppClaims.UserId) can see the plan.
    /// Using TrainerProfilePublicId (bbbbbbbb-...) makes the plan invisible to
    /// GET /training/plans and GET /training/plans/{planId}.
    /// </summary>
    [Fact]
    public async Task SeedAsync_ForTimePlan_TrainerIdIsApplicationUserId()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var plan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull("the ForTime fixture plan must be seeded");
        plan!.TrainerId.Should().Be(QaSeedRunner.TrainerUserId,
            "TrainingPlan.TrainerId must be ApplicationUser.Id (22222222-...) — " +
            "GetTrainingPlansEndpoint and GetTrainingPlanEndpoint scope by " +
            "Guid.Parse(AppClaims.UserId) which is ApplicationUser.Id, not ProfessionalProfile.PublicId (bbbbbbbb-...)");
        plan.ClientId.Should().Be(QaSeedRunner.ClientProfilePublicId,
            "TrainingPlan.ClientId must remain ClientProfile.PublicId (aaaaaaaa-...) — " +
            "GetClientPlansEndpoint filters by ClientProfile.PublicId and " +
            "TrainingCompletion.ClientId is also keyed on ClientProfile.PublicId");
    }

    /// <summary>
    /// Seeding twice must not create duplicate past-plan or workout-log documents.
    /// </summary>
    [Fact]
    public async Task SeedAsync_PastTrainingPlan_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var planCount = await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaPastTrainingPlanExternalId),
            cancellationToken: ct);
        planCount.Should().Be(1, "past training plan must not be duplicated on re-seed");

        var completedLogCount = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, QaSeedRunner.QaPastCompletedWorkoutLogId),
            cancellationToken: ct);
        completedLogCount.Should().Be(1, "completed WorkoutLog must not be duplicated on re-seed");

        var skippedLogCount = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, QaSeedRunner.QaPastSkippedWorkoutLogId),
            cancellationToken: ct);
        skippedLogCount.Should().Be(1, "skipped WorkoutLog must not be duplicated on re-seed");
    }

    /// <summary>
    /// The nutrition plan seeded by <see cref="QaSeedRunner"/> must have Status=Active
    /// and exactly one Published week with three meals (Breakfast, Lunch, Dinner).
    /// </summary>
    [Fact]
    public async Task SeedAsync_NutritionPlan_HasCorrectShape()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var plan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaNutritionPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull("QaSeedRunner must create the QA nutrition plan");
        plan!.ClientId.Should().Be(QaSeedRunner.ClientProfilePublicId,
            "NutritionPlan.ClientId must be keyed on ClientProfile.PublicId, not ApplicationUser.Id");
        plan.NutritionistId.Should().Be(QaSeedRunner.NutriUserId,
            "NutritionPlan.NutritionistId must be keyed on ApplicationUser.Id (NutriUserId), not the professional profile PublicId, so nutritionist endpoint filters match AppClaims.UserId");
        plan.Status.Should().Be(FitnessPlatform.Application.Domain.Enums.NutritionPlanStatus.Active);

        plan.Weeks.Should().HaveCount(1);
        plan.Weeks[0].Status.Should().Be(FitnessPlatform.Application.Domain.Enums.WeekStatus.Published);
        plan.Weeks[0].DatePublished.Should().NotBeNull();

        plan.Weeks[0].Days.Should().HaveCount(1);
        var day = plan.Weeks[0].Days[0];
        day.DayOfWeek.Should().Be(1, "Monday is day 1");
        day.Meals.Should().HaveCount(3, "Breakfast, Lunch, Dinner");
    }

    /// <summary>
    /// The main QA training plan (dddddddd-...) Standard section must have prescribed sets
    /// on both exercises so the planned-vs-actual WorkoutLog has concrete prescription values
    /// to compare against.
    /// </summary>
    [Fact]
    public async Task SeedAsync_MainPlan_StandardSectionHasPrescribedSets()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var plan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull("main training plan must be seeded");

        var session = plan!.Weeks[0].Sessions.Single(s => s.SessionId == QaSeedRunner.QaSessionId);
        var standardSection = session.Sections.Single(s => s.SectionId == QaSeedRunner.StandardSectionId);

        standardSection.Exercises.Should().HaveCount(2, "Standard section has two exercises");

        var squat = standardSection.Exercises.Single(e => e.ExerciseExternalId == QaSeedRunner.StandardExercise1Id);
        squat.Sets.Should().HaveCount(2, "QA Squat has 2 prescribed sets");
        squat.Sets.Should().AllSatisfy(s =>
        {
            s.Reps.Should().Be(10, "prescribed 10 reps");
            s.WeightKg.Should().Be(80m, "prescribed 80 kg");
        });

        var deadlift = standardSection.Exercises.Single(e => e.ExerciseExternalId == QaSeedRunner.StandardExercise2Id);
        deadlift.Sets.Should().HaveCount(2, "QA Deadlift has 2 prescribed sets");
        deadlift.Sets.Should().AllSatisfy(s =>
        {
            s.Reps.Should().Be(5, "prescribed 5 reps");
            s.WeightKg.Should().Be(100m, "prescribed 100 kg");
        });
    }

    /// <summary>
    /// The completed WorkoutLog seeded for the main QA plan must exercise all four
    /// planned-vs-actual set cases in a single session:
    ///
    ///   QA Squat  Set 1 — MODIFIED      actual != planned  (IsModified=true)
    ///   QA Squat  Set 2 — AS-PRESCRIBED actual == planned  (IsModified=false)
    ///   QA Deadlift Set 1 — SKIPPED     planned present, actual null
    ///   QA Deadlift Set 2 — EXTRA       no planned snapshot, actual present
    ///
    /// ClientId must be ApplicationUser.Id so the log is visible to CompleteWorkoutEndpoint
    /// and the coach-view planned-vs-actual query.
    /// </summary>
    [Fact]
    public async Task SeedAsync_MainPlanWorkoutLog_ExercisesFourPlannedVsActualCases()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var log = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaSeedRunner.QaMainPlanCompletedWorkoutLogId)
            .FirstOrDefaultAsync(ct);

        log.Should().NotBeNull("main-plan completed WorkoutLog must be seeded");
        log!.IsCompleted.Should().BeTrue("log is marked complete");
        log.PlanId.Should().Be(QaSeedRunner.QaTrainingPlanExternalId);
        log.SessionId.Should().Be(QaSeedRunner.QaSessionId);
        log.ClientId.Should().Be(QaSeedRunner.ClientUserId,
            "WorkoutLog.ClientId must be ApplicationUser.Id (11111111-...) — same contract as past-plan logs");
        log.CompletedDate.Should().NotBeNull("CompletedDate is required for the partial unique index");

        log.Sections.Should().HaveCount(1, "one section mirrors the Standard section");
        var section = log.Sections[0];
        section.Exercises.Should().HaveCount(2);

        // ── Exercise 1: QA Squat ───────────────────────────────────────────────
        var squat = section.Exercises.Single(e => e.ExerciseExternalId == QaSeedRunner.StandardExercise1Id);
        squat.Sets.Should().HaveCount(2);

        var squatSet1 = squat.Sets.Single(s => s.SetNumber == 1);
        squatSet1.Reps.Should().Be(8, "actual reps differ from planned");
        squatSet1.WeightKg.Should().Be(85m, "actual weight differs from planned");
        squatSet1.PlannedReps.Should().Be(10, "snapshot from plan prescription");
        squatSet1.PlannedWeightKg.Should().Be(80m);
        squatSet1.IsModified.Should().BeTrue("actual != planned → MODIFIED");

        var squatSet2 = squat.Sets.Single(s => s.SetNumber == 2);
        squatSet2.Reps.Should().Be(10);
        squatSet2.WeightKg.Should().Be(80m);
        squatSet2.PlannedReps.Should().Be(10);
        squatSet2.PlannedWeightKg.Should().Be(80m);
        squatSet2.IsModified.Should().BeFalse("actual == planned → AS-PRESCRIBED");

        // ── Exercise 2: QA Deadlift ────────────────────────────────────────────
        var deadlift = section.Exercises.Single(e => e.ExerciseExternalId == QaSeedRunner.StandardExercise2Id);
        deadlift.Sets.Should().HaveCount(2);

        var deadliftSet1 = deadlift.Sets.Single(s => s.SetNumber == 1);
        deadliftSet1.PlannedReps.Should().Be(5, "prescription captured");
        deadliftSet1.PlannedWeightKg.Should().Be(100m);
        deadliftSet1.Reps.Should().BeNull("client did not perform the set → SKIPPED");
        deadliftSet1.WeightKg.Should().BeNull();
        deadliftSet1.CompletedAt.Should().BeNull("skipped set has no completion timestamp");

        var deadliftSet2 = deadlift.Sets.Single(s => s.SetNumber == 2);
        deadliftSet2.Reps.Should().Be(6, "client logged an extra set");
        deadliftSet2.WeightKg.Should().Be(90m);
        deadliftSet2.PlannedReps.Should().BeNull("no planned snapshot → EXTRA set");
        deadliftSet2.PlannedWeightKg.Should().BeNull();
    }

    /// <summary>
    /// Seeding twice must not create a duplicate main-plan WorkoutLog.
    /// </summary>
    [Fact]
    public async Task SeedAsync_MainPlanWorkoutLog_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var count = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, QaSeedRunner.QaMainPlanCompletedWorkoutLogId),
            cancellationToken: ct);

        count.Should().Be(1, "main-plan WorkoutLog must not be duplicated on re-seed");
    }

    /// <summary>
    /// The multi-section fixture (#474) must seed:
    ///  - A TrainingPlan for the second QA client/trainer pair with one session
    ///    whose two sections BOTH reference the same shared exercise (SharedExerciseId).
    ///  - A completed WorkoutLog with SectionId set on both sections so the
    ///    section-keying read path works. The Standard section contains edited
    ///    values (Set 1 and Set 3: IsModified=true). The AMRAP section contains
    ///    a plain logged set with no planned snapshot (IsModified=false).
    /// </summary>
    [Fact]
    public async Task SeedAsync_MultiSectionFixture_HasSharedExerciseInBothSectionsWithCorrectValues()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        // Plan must exist and be owned by the second pair.
        var plan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaMultiSectionPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull("multi-section training plan must be seeded");
        plan!.TrainerId.Should().Be(QaSeedRunner.Trainer2UserId,
            "TrainingPlan.TrainerId must be Trainer2UserId (ApplicationUser.Id)");
        plan.ClientId.Should().Be(QaSeedRunner.Client2ProfilePublicId,
            "TrainingPlan.ClientId must be Client2ProfilePublicId (ClientProfile.PublicId)");

        var session = plan.Weeks[0].Sessions.Single(s => s.SessionId == QaSeedRunner.QaMultiSectionSessionId);
        session.Sections.Should().HaveCount(2, "session has Standard + AMRAP sections");

        var standardSection = session.Sections.Single(s => s.SectionId == QaSeedRunner.MultiSectionStandardSectionId);
        standardSection.Format.Should().BeNull("Standard section has null format");
        standardSection.Exercises.Should().HaveCount(1);
        standardSection.Exercises[0].ExerciseExternalId.Should().Be(QaSeedRunner.SharedExerciseId);
        standardSection.Exercises[0].Sets.Should().HaveCount(3, "Standard section has 3 prescribed sets");

        var amrapSection = session.Sections.Single(s => s.SectionId == QaSeedRunner.MultiSectionAmrapSectionId);
        amrapSection.Format.Should().Be(FitnessPlatform.Application.Domain.Enums.WorkoutFormat.AMRAP);
        amrapSection.Exercises.Should().HaveCount(1);
        amrapSection.Exercises[0].ExerciseExternalId.Should().Be(QaSeedRunner.SharedExerciseId,
            "AMRAP section references the SAME exercise as the Standard section");
        amrapSection.Exercises[0].Sets.Should().BeEmpty("AMRAP section carries no prescribed sets");

        // WorkoutLog must exist with SectionId populated on both sections.
        var log = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaSeedRunner.QaMultiSectionWorkoutLogId)
            .FirstOrDefaultAsync(ct);

        log.Should().NotBeNull("multi-section WorkoutLog must be seeded");
        log!.IsCompleted.Should().BeTrue("log is marked complete");
        log.PlanId.Should().Be(QaSeedRunner.QaMultiSectionPlanExternalId);
        log.SessionId.Should().Be(QaSeedRunner.QaMultiSectionSessionId);
        log.ClientId.Should().Be(QaSeedRunner.Client2UserId,
            "WorkoutLog.ClientId must be ApplicationUser.Id (Client2UserId)");
        log.CompletedDate.Should().NotBeNull("CompletedDate is required for the partial unique index");
        log.Sections.Should().HaveCount(2, "log captures both Standard and AMRAP sections");

        // Standard section in the log — SectionId must match the plan section.
        var logStandard = log.Sections.Single(s => s.SectionId == QaSeedRunner.MultiSectionStandardSectionId);
        logStandard.Exercises.Should().HaveCount(1);
        var logStandardExercise = logStandard.Exercises[0];
        logStandardExercise.ExerciseExternalId.Should().Be(QaSeedRunner.SharedExerciseId);
        logStandardExercise.Sets.Should().HaveCount(3);

        // Set 1: MODIFIED (actual Reps=12 != planned 15, actual WeightKg=28 != planned 24).
        var set1 = logStandardExercise.Sets.Single(s => s.SetNumber == 1);
        set1.Reps.Should().Be(12);
        set1.WeightKg.Should().Be(28m);
        set1.PlannedReps.Should().Be(15);
        set1.PlannedWeightKg.Should().Be(24m);
        set1.IsModified.Should().BeTrue("Set 1 actual != planned → MODIFIED (shows 'upraveno' on coach-detail)");

        // Set 2: AS-PRESCRIBED (actual matches planned).
        var set2 = logStandardExercise.Sets.Single(s => s.SetNumber == 2);
        set2.Reps.Should().Be(15);
        set2.WeightKg.Should().Be(24m);
        set2.PlannedReps.Should().Be(15);
        set2.PlannedWeightKg.Should().Be(24m);
        set2.IsModified.Should().BeFalse("Set 2 actual == planned → AS-PRESCRIBED (no 'upraveno' badge)");

        // Set 3: MODIFIED.
        var set3 = logStandardExercise.Sets.Single(s => s.SetNumber == 3);
        set3.Reps.Should().Be(10);
        set3.WeightKg.Should().Be(28m);
        set3.IsModified.Should().BeTrue("Set 3 actual != planned → MODIFIED");

        // AMRAP section in the log — SectionId must match the plan AMRAP section.
        var logAmrap = log.Sections.Single(s => s.SectionId == QaSeedRunner.MultiSectionAmrapSectionId);
        logAmrap.Format.Should().Be(FitnessPlatform.Application.Domain.Enums.WorkoutFormat.AMRAP);
        logAmrap.Exercises.Should().HaveCount(1);
        var logAmrapExercise = logAmrap.Exercises[0];
        logAmrapExercise.ExerciseExternalId.Should().Be(QaSeedRunner.SharedExerciseId,
            "AMRAP section references the SAME exercise but is keyed by a different SectionId");
        logAmrapExercise.Sets.Should().HaveCount(1);

        var amrapSet = logAmrapExercise.Sets[0];
        amrapSet.Reps.Should().Be(15);
        amrapSet.WeightKg.Should().Be(24m);
        amrapSet.PlannedReps.Should().BeNull("AMRAP set has no planned snapshot");
        amrapSet.PlannedWeightKg.Should().BeNull("AMRAP set has no planned snapshot");
        amrapSet.IsModified.Should().BeFalse("AMRAP set without planned snapshot → IsModified=false (no 'upraveno')");
    }

    /// <summary>
    /// Seeding twice must not create duplicate multi-section plan or WorkoutLog documents.
    /// </summary>
    [Fact]
    public async Task SeedAsync_MultiSectionFixture_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var planCount = await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaMultiSectionPlanExternalId),
            cancellationToken: ct);
        planCount.Should().Be(1, "multi-section plan must not be duplicated on re-seed");

        var logCount = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, QaSeedRunner.QaMultiSectionWorkoutLogId),
            cancellationToken: ct);
        logCount.Should().Be(1, "multi-section WorkoutLog must not be duplicated on re-seed");
    }

    /// <summary>
    /// The #715 questionnaire fixture must seed a template with 2 sections and
    /// 6 answerable questions covering every formatAnswerValue branch
    /// (short_text, number, single_choice, scale, multi_select, file_upload),
    /// a SUBMITTED response with a matching answer per question, and that
    /// response's PublicId must be written onto the main training plan's
    /// QuestionnaireResponseId field. The nutrition plan is asserted
    /// separately (#720 links it to the nutritionist-owned response instead —
    /// see <see cref="SeedAsync_NutritionistQuestionnaireFixture_HasTemplateSubmittedResponseAndPlanLink"/>).
    /// </summary>
    [Fact]
    public async Task SeedAsync_QuestionnaireFixture_HasTemplateSubmittedResponseAndTrainingPlanLink()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        // Questionnaire template — 2 sections + 6 answerable questions.
        var questionnaire = await db.Questionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.PublicId == QaSeedRunner.QaQuestionnaireExternalId, ct);

        questionnaire.Should().NotBeNull("the #715 questionnaire template must be seeded");
        questionnaire!.ProfessionalId.Should().Be(QaSeedRunner.TrainerUserId,
            "the questionnaire template is owned by the QA trainer");
        questionnaire.Questions.Should().HaveCount(8, "2 section headers + 6 answerable questions");
        questionnaire.Questions.Count(q => q.Type == "section").Should().Be(2,
            "the template must have at least 2 sections (#715 AC)");

        var answerableTypes = questionnaire.Questions
            .Where(q => q.Type != "section")
            .Select(q => q.Type)
            .ToList();
        answerableTypes.Should().BeEquivalentTo(
            ["short_text", "number", "single_choice", "scale", "multi_select", "file_upload"],
            "every formatAnswerValue branch must be exercised");

        // Submitted response.
        var response = await db.QuestionnaireResponses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r => r.PublicId == QaSeedRunner.QaQuestionnaireResponseExternalId, ct);

        response.Should().NotBeNull("the #715 submitted response must be seeded");
        response!.ClientId.Should().Be(QaSeedRunner.ClientUserId);
        response.ProfessionalId.Should().Be(QaSeedRunner.TrainerUserId);
        response.Status.Should().Be(QuestionnaireResponseStatus.Submitted);
        response.SubmittedAt.Should().NotBeNull("a Submitted response must have a SubmittedAt timestamp");
        response.Answers.Should().HaveCount(6, "one answer per answerable question");

        // Plan link — the training plan must point at this response's PublicId.
        var trainingPlan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);
        trainingPlan.Should().NotBeNull();
        trainingPlan!.QuestionnaireResponseId.Should().Be(QaSeedRunner.QaQuestionnaireResponseExternalId,
            "the main training plan must be linked to the trainer's submitted response so #697's Dotaznik tab renders it");

        // The nutrition plan must NOT be linked to this trainer-owned response
        // — #720 links it to the nutritionist-owned response instead.
        var nutritionPlan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaNutritionPlanExternalId)
            .FirstOrDefaultAsync(ct);
        nutritionPlan.Should().NotBeNull();
        nutritionPlan!.QuestionnaireResponseId.Should().NotBe(QaSeedRunner.QaQuestionnaireResponseExternalId,
            "the nutrition plan must link a nutritionist-owned response (#720), not this trainer-owned one");
    }

    /// <summary>
    /// Seeding twice must not duplicate the questionnaire template, the response,
    /// or its answers, and must not clobber the training plan link on the second pass.
    /// </summary>
    [Fact]
    public async Task SeedAsync_QuestionnaireFixture_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        var questionnaireCount = await db.Questionnaires
            .CountAsync(q => q.PublicId == QaSeedRunner.QaQuestionnaireExternalId, ct);
        questionnaireCount.Should().Be(1, "the questionnaire template must not be duplicated on re-seed");

        var questionCount = await db.QuestionnaireQuestions
            .CountAsync(q => q.Questionnaire.PublicId == QaSeedRunner.QaQuestionnaireExternalId, ct);
        questionCount.Should().Be(8, "the 8 template questions must not be duplicated on re-seed");

        var responseCount = await db.QuestionnaireResponses
            .CountAsync(r => r.PublicId == QaSeedRunner.QaQuestionnaireResponseExternalId, ct);
        responseCount.Should().Be(1, "the submitted response must not be duplicated on re-seed");

        var answerCount = await db.QuestionnaireAnswers
            .CountAsync(a => a.Response.PublicId == QaSeedRunner.QaQuestionnaireResponseExternalId, ct);
        answerCount.Should().Be(6, "the 6 answers must not be duplicated on re-seed");

        var trainingPlan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);
        trainingPlan!.QuestionnaireResponseId.Should().Be(QaSeedRunner.QaQuestionnaireResponseExternalId,
            "the training plan link must remain stable across re-seeds");
        trainingPlan.Version.Should().Be(2, "the link update bumps Version exactly once, not once per seed run");
    }

    /// <summary>
    /// The #720 nutritionist-owned questionnaire fixture must seed a template
    /// with 2 sections and 6 answerable questions covering every
    /// formatAnswerValue branch, a SUBMITTED response owned by the QA
    /// nutritionist, an active nutritionist↔client link so
    /// GetClientResponsesEndpoint can return it, and the response's PublicId
    /// must be written onto the seeded nutrition plan's QuestionnaireResponseId
    /// field — replacing #715's trainer-owned link there.
    /// </summary>
    [Fact]
    public async Task SeedAsync_NutritionistQuestionnaireFixture_HasTemplateSubmittedResponseAndPlanLink()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        // Questionnaire template — owned by the QA nutritionist, 2 sections + 6 answerable questions.
        var questionnaire = await db.Questionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.PublicId == QaSeedRunner.QaNutriQuestionnaireExternalId, ct);

        questionnaire.Should().NotBeNull("the #720 nutritionist questionnaire template must be seeded");
        questionnaire!.ProfessionalId.Should().Be(QaSeedRunner.NutriUserId,
            "the questionnaire template is owned by the QA nutritionist");
        questionnaire.Questions.Should().HaveCount(8, "2 section headers + 6 answerable questions");
        questionnaire.Questions.Count(q => q.Type == "section").Should().Be(2,
            "the template must have at least 2 sections (#720 AC)");

        var answerableTypes = questionnaire.Questions
            .Where(q => q.Type != "section")
            .Select(q => q.Type)
            .ToList();
        answerableTypes.Should().BeEquivalentTo(
            ["short_text", "number", "single_choice", "scale", "multi_select", "file_upload"],
            "every formatAnswerValue branch must be exercised, same spread as #715");

        // Submitted response.
        var response = await db.QuestionnaireResponses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r => r.PublicId == QaSeedRunner.QaNutriQuestionnaireResponseExternalId, ct);

        response.Should().NotBeNull("the #720 submitted response must be seeded");
        response!.ClientId.Should().Be(QaSeedRunner.ClientUserId);
        response.ProfessionalId.Should().Be(QaSeedRunner.NutriUserId,
            "the response must be owned by the QA nutritionist so GetClientResponsesEndpoint returns it to her");
        response.Status.Should().Be(QuestionnaireResponseStatus.Submitted);
        response.SubmittedAt.Should().NotBeNull("a Submitted response must have a SubmittedAt timestamp");
        response.Answers.Should().HaveCount(6, "one answer per answerable question");

        // Nutritionist↔client link must exist and be active — required by
        // GetClientResponsesEndpoint's active-link check.
        var clientProfile = await db.ClientProfiles.FirstAsync(cp => cp.UserId == QaSeedRunner.ClientUserId, ct);
        var nutriProfile = await db.ProfessionalProfiles.FirstAsync(pp => pp.UserId == QaSeedRunner.NutriUserId, ct);
        var nutriLink = await db.ClientProfessionalLinks.FirstOrDefaultAsync(
            l => l.ClientProfileId == clientProfile.Id && l.ProfessionalProfileId == nutriProfile.Id, ct);
        nutriLink.Should().NotBeNull("a nutritionist↔client link must be seeded so the response is queryable by the nutritionist");
        nutriLink!.IsActive.Should().BeTrue();
        response.LinkId.Should().Be(nutriLink.Id, "the response's LinkId must reference the nutritionist↔client link");

        // Plan link — the nutrition plan must point at this response's PublicId,
        // NOT the #715 trainer-owned response.
        var nutritionPlan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaNutritionPlanExternalId)
            .FirstOrDefaultAsync(ct);
        nutritionPlan.Should().NotBeNull();
        nutritionPlan!.QuestionnaireResponseId.Should().Be(QaSeedRunner.QaNutriQuestionnaireResponseExternalId,
            "the nutrition plan must be linked to the nutritionist-owned response so #698's Dotaznik tab renders it for the nutritionist");
    }

    /// <summary>
    /// Seeding twice must not duplicate the nutritionist-owned template,
    /// response, its answers, or the nutritionist↔client link, and must not
    /// clobber the nutrition plan link on the second pass.
    /// </summary>
    [Fact]
    public async Task SeedAsync_NutritionistQuestionnaireFixture_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        await QaSeedRunner.SeedAsync(_factory.Services);
        await QaSeedRunner.SeedAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var sp    = scope.ServiceProvider;
        var db    = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        var questionnaireCount = await db.Questionnaires
            .CountAsync(q => q.PublicId == QaSeedRunner.QaNutriQuestionnaireExternalId, ct);
        questionnaireCount.Should().Be(1, "the nutritionist questionnaire template must not be duplicated on re-seed");

        var questionCount = await db.QuestionnaireQuestions
            .CountAsync(q => q.Questionnaire.PublicId == QaSeedRunner.QaNutriQuestionnaireExternalId, ct);
        questionCount.Should().Be(8, "the 8 template questions must not be duplicated on re-seed");

        var responseCount = await db.QuestionnaireResponses
            .CountAsync(r => r.PublicId == QaSeedRunner.QaNutriQuestionnaireResponseExternalId, ct);
        responseCount.Should().Be(1, "the submitted response must not be duplicated on re-seed");

        var answerCount = await db.QuestionnaireAnswers
            .CountAsync(a => a.Response.PublicId == QaSeedRunner.QaNutriQuestionnaireResponseExternalId, ct);
        answerCount.Should().Be(6, "the 6 answers must not be duplicated on re-seed");

        // Total link count: trainer↔client (#474 has 2 pairs = 2 links) + this
        // nutritionist↔client link = 3 total.
        var linkCount = await db.ClientProfessionalLinks.CountAsync(ct);
        linkCount.Should().Be(3, "2 trainer↔client links (#474) + 1 nutritionist↔client link (#720), no duplicates on re-seed");

        var nutritionPlan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaNutritionPlanExternalId)
            .FirstOrDefaultAsync(ct);
        nutritionPlan!.QuestionnaireResponseId.Should().Be(QaSeedRunner.QaNutriQuestionnaireResponseExternalId,
            "the nutrition plan link must remain stable across re-seeds");
        nutritionPlan.Version.Should().Be(2, "the link update bumps Version exactly once, not once per seed run");
    }
}
