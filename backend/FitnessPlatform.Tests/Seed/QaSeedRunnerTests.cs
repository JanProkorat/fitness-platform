using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
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
        return Task.FromResult(new BlobUploadUrl(uploadUrl, containerPath));
    }

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
        (await db.ClientProfessionalLinks.CountAsync(ct))
            .Should().Be(1, "trainer↔client link is part of the minimal fixture");

        // Rich fixtures must be absent.
        (await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaTrainingPlanExternalId),
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the training plan");
        (await mongo.TrainingPlans.CountDocumentsAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, QaSeedRunner.QaPastTrainingPlanExternalId),
            cancellationToken: ct))
            .Should().Be(0, "minimal seed skips the past training plan (#326)");
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

        // COMPLETED session — WorkoutLog with IsCompleted=true.
        var completedLog = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaSeedRunner.QaPastCompletedWorkoutLogId)
            .FirstOrDefaultAsync(ct);

        completedLog.Should().NotBeNull("completed WorkoutLog must be seeded");
        completedLog!.IsCompleted.Should().BeTrue("PAST-COMPLETED log must have IsCompleted=true");
        completedLog.SessionId.Should().Be(QaSeedRunner.QaPastSessionCompletedId);
        completedLog.PlanId.Should().Be(QaSeedRunner.QaPastTrainingPlanExternalId);
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

        // UNTOUCHED session — must have NO WorkoutLog.
        var untouchedLogCount = await mongo.WorkoutLogs.CountDocumentsAsync(
            Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, QaSeedRunner.QaPastSessionUntouchedId),
            cancellationToken: ct);

        untouchedLogCount.Should().Be(0,
            "PAST-UNTOUCHED session must have no WorkoutLog so the web classifies it as untouched");
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
        plan.NutritionistId.Should().Be(QaSeedRunner.NutriProfilePublicId);
        plan.Status.Should().Be(FitnessPlatform.Application.Domain.Enums.NutritionPlanStatus.Active);

        plan.Weeks.Should().HaveCount(1);
        plan.Weeks[0].Status.Should().Be(FitnessPlatform.Application.Domain.Enums.WeekStatus.Published);
        plan.Weeks[0].DatePublished.Should().NotBeNull();

        plan.Weeks[0].Days.Should().HaveCount(1);
        var day = plan.Weeks[0].Days[0];
        day.DayOfWeek.Should().Be(1, "Monday is day 1");
        day.Meals.Should().HaveCount(3, "Breakfast, Lunch, Dinner");
    }
}
