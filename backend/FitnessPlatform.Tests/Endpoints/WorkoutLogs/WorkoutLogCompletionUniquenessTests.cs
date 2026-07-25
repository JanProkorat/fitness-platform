using FluentAssertions;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

// ── Test factory ─────────────────────────────────────────────────────────────

/// <summary>
/// Dedicated factory for WorkoutLog uniqueness tests. Runs in its own Testcontainers
/// to avoid polluting the shared Integration collection's MongoDB instance with
/// the dedup/backfill scenarios that modify existing data.
/// </summary>
public class WorkoutLogUniquenessFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    /// <summary>
    /// The IMongoContext resolved from the running host's DI container.
    /// Available after <see cref="InitializeAsync"/> completes.
    /// </summary>
    public IMongoContext? MongoContext { get; private set; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("MONGO_PASSWORD", "test");
        builder.UseSetting("MINIO_ACCESS_KEY", "test");
        builder.UseSetting("MINIO_SECRET_KEY", "test");
        builder.UseSetting("JWT_SECRET", new string('x', 64));
        builder.UseSetting("RateLimiting:Disabled", "true");

        builder.UseSetting("ConnectionStrings:PostgreSQl",
            "Host=localhost;Database=placeholder;Username=postgres");
        builder.UseSetting("ConnectionStrings:MongoDB",
            "mongodb://localhost:27017");

        builder.ConfigureServices(services =>
        {
            // Replace DbContext with Testcontainer-backed Postgres.
            var pgDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(Microsoft.EntityFrameworkCore.DbContextOptions<Application.Infrastructure.Data.ApplicationDbContext>));
            if (pgDesc is not null) services.Remove(pgDesc);

            services.AddDbContext<Application.Infrastructure.Data.ApplicationDbContext>(options =>
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
                return client.GetDatabase("fitness_uniqueness_test");
            });
            services.AddSingleton<IMongoContext, MongoContext>();

            // Replace external services with fakes.
            var emailDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(Application.Domain.Interfaces.IEmailService));
            if (emailDesc is not null) services.Remove(emailDesc);
            services.AddSingleton<FakeEmailService>();
            services.AddSingleton<Application.Domain.Interfaces.IEmailService>(
                sp => sp.GetRequiredService<FakeEmailService>());

            var notifierDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(Application.Domain.Interfaces.IRealtimeNotifier));
            if (notifierDesc is not null) services.Remove(notifierDesc);
            services.AddSingleton<FakeRealtimeNotifier>();
            services.AddSingleton<Application.Domain.Interfaces.IRealtimeNotifier>(
                sp => sp.GetRequiredService<FakeRealtimeNotifier>());

            var blobDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(Application.Domain.Interfaces.IBlobStorageService));
            if (blobDesc is not null) services.Remove(blobDesc);
            services.AddSingleton<Application.Domain.Interfaces.IBlobStorageService, FakeBlobStorageService>();

            var pushDesc = services.SingleOrDefault(
                d => d.ServiceType == typeof(Application.Domain.Interfaces.IPushNotificationService));
            if (pushDesc is not null) services.Remove(pushDesc);
            services.AddSingleton<FakePushNotificationService>();
            services.AddSingleton<Application.Domain.Interfaces.IPushNotificationService>(
                sp => sp.GetRequiredService<FakePushNotificationService>());

            // #726: prevent the background schedulers/worker from starting in this
            // test host — see TestHostedServiceExtensions for the root cause.
            services.RemoveBackgroundHostedServices();
        });

        builder.UseEnvironment("Development");
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync());

        await Application.Infrastructure.Data.ApplicationDbContextSeed.SeedAsync(Services);

        using var scope = Services.CreateScope();
        MongoContext = scope.ServiceProvider.GetRequiredService<IMongoContext>();
    }

    public new async ValueTask DisposeAsync()
    {
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }
}

// ── Collection definition ─────────────────────────────────────────────────────

[CollectionDefinition("WorkoutLogUniqueness")]
public class WorkoutLogUniquenessCollection;

// ── Tests ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Integration tests for the date-scoped partial unique index on WorkoutLog that
/// closes the TOCTOU race where two concurrent completions of the same session
/// on the same day would create duplicate completed logs.
///
/// Runs in its own collection + factory (separate Testcontainers) to isolate
/// the backfill/dedup scenarios from the shared Integration collection.
/// </summary>
[Collection("WorkoutLogUniqueness")]
public class WorkoutLogCompletionUniquenessTests : IAsyncLifetime
{
    private readonly WorkoutLogUniquenessFactory _factory = new();

    public async ValueTask InitializeAsync() => await _factory.InitializeAsync();
    public async ValueTask DisposeAsync() => await _factory.DisposeAsync();

    private IMongoContext Mongo
    {
        get
        {
            using var scope = _factory.Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<IMongoContext>();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static WorkoutLog BuildLog(
        Guid? planId = null,
        Guid? sessionId = null,
        bool isCompleted = false,
        DateTime? completedAt = null,
        DateTime? completedDate = null)
    {
        var now = DateTime.UtcNow;
        var log = new WorkoutLog
        {
            ExternalId  = Guid.NewGuid(),
            ClientId    = Guid.NewGuid(),
            PlanId      = planId,
            SessionId   = sessionId,
            StartedAt   = now.AddMinutes(-30),
            IsCompleted = isCompleted,
            CompletedAt = completedAt,
            CompletedDate = completedDate,
            Sections    = [],
            DateCreated = now.AddMinutes(-30)
        };
        return log;
    }

    private static DateTime Midnight(DateTime instant) =>
        WorkoutLog.ToCompletionDateUtc(instant);

    /// <summary>
    /// Builds a test <see cref="SessionExecution"/> for the unified-index tests (#841).
    /// </summary>
    private static SessionExecution BuildExecution(
        Guid clientId,
        Guid sessionId,
        bool isCompleted,
        DateTime date,
        DateTime? completedAt = null)
    {
        var now = DateTime.UtcNow;
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            SessionId = sessionId,
            Date = date,
            Status = isCompleted ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = now.AddMinutes(-30),
                CompletedAt = completedAt,
                Sections = []
            },
            DateCreated = now.AddMinutes(-30),
            Version = 1
        };
    }

    // ── (3) Index exists after startup init ───────────────────────────────────

    /// <summary>
    /// The partial unique index must be present in the WorkoutLogs collection
    /// after MongoIndexInitializer.StartAsync() runs on host startup.
    /// </summary>
    [Fact]
    public async Task PartialUniqueIndex_ExistsAfterInit()
    {
        var ct = TestContext.Current.CancellationToken;

        // Program.cs invokes MongoIndexInitializer explicitly (awaited) before
        // app.Run() — not via AddHostedService (see MongoIndexInitializer's class
        // remarks for why). WebApplicationFactory<Program> runs that same
        // top-level statement when this factory boots, so by the time we get a
        // scope here the index is already guaranteed to exist.
        // We just need to verify the index is present.
        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var indexCursor = await mongo.WorkoutLogs.Indexes.ListAsync(cancellationToken: ct);
        var indexes = await indexCursor.ToListAsync(ct);

        var expectedName = "idx_workoutlog_planId_sessionId_completedDate_unique";
        indexes.Should().Contain(
            idx => idx["name"].AsString == expectedName,
            $"the partial unique index '{expectedName}' must be created at startup");
    }

    // ── (1) Same-day concurrent double-complete → 409 ────────────────────────
    //
    // #841: IWorkoutCompletionService.CompleteAsync now takes a SessionExecution, and the
    // uniqueness guard moved to the unified (clientId, sessionId, date) partial index on
    // SessionExecutions — see idx_sessionexecution_clientId_sessionId_date_unique in
    // MongoIndexInitializer.CreateSessionExecutionIndexes. These two tests exercise that
    // unified index directly (superseding the retired WorkoutLog-level assertions).

    /// <summary>
    /// When two concurrent requests both complete the same (ClientId, SessionId) on the
    /// same calendar day, exactly one succeeded execution must exist and the loser must get
    /// <see cref="WorkoutAlreadyCompletedException"/> (surfaced as HTTP 409).
    ///
    /// We simulate the race by inserting a completed execution directly (bypassing the service)
    /// and then calling CompleteAsync on a second execution with the same key.
    /// </summary>
    [Fact]
    public async Task CompleteAsync_SameDaySameSession_SecondCallThrowsWorkoutAlreadyCompletedException()
    {
        var ct = TestContext.Current.CancellationToken;
        var clientId  = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var today     = DateTime.UtcNow;
        var midnightToday = SessionExecution.ToCompletionDateUtc(today);

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        // Insert the "winner" — already completed today.
        var winner = BuildExecution(
            clientId: clientId, sessionId: sessionId,
            isCompleted: true, completedAt: today, date: midnightToday);
        await mongo.SessionExecutions.InsertOneAsync(winner, cancellationToken: ct);

        // The "loser" is in-progress, same key, and will call CompleteAsync.
        var loser = BuildExecution(clientId: clientId, sessionId: sessionId, isCompleted: false, date: midnightToday);
        await mongo.SessionExecutions.InsertOneAsync(loser, cancellationToken: ct);

        var svc = scope.ServiceProvider.GetRequiredService<Application.Domain.Interfaces.IWorkoutCompletionService>();

        // CompleteAsync on the loser must throw WorkoutAlreadyCompletedException because
        // the partial unique index (clientId, sessionId, date) rejects the second completed
        // execution for the same triplet on the same day.
        var act = async () => await svc.CompleteAsync(loser, today, ct);
        await act.Should().ThrowAsync<WorkoutAlreadyCompletedException>();

        // Exactly one completed execution must exist for this session on this day.
        var completedCount = await mongo.SessionExecutions.CountDocumentsAsync(
            Builders<SessionExecution>.Filter.Eq(e => e.Status, SessionExecutionStatus.Completed)
            & Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
            & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionId),
            cancellationToken: ct);
        completedCount.Should().Be(1, "only one completed execution per (clientId, sessionId, day) is allowed");
    }

    // ── (2) Different-day re-completion is ALLOWED ────────────────────────────

    /// <summary>
    /// A different-day re-completion of the same (ClientId, SessionId) MUST succeed.
    /// The unique index is scoped to Date — two distinct midnight-UTC values
    /// for the same (clientId, sessionId) are two distinct index keys.
    /// </summary>
    [Fact]
    public async Task CompleteAsync_DifferentDaySameSession_BothLogsAllowed()
    {
        var ct = TestContext.Current.CancellationToken;
        var clientId  = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var day1      = DateTime.UtcNow.AddDays(-7);
        var day2      = DateTime.UtcNow; // different day

        using var scope = _factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        // Insert day-1 completed execution directly.
        var firstExecution = BuildExecution(
            clientId: clientId, sessionId: sessionId,
            isCompleted: true, completedAt: day1, date: SessionExecution.ToCompletionDateUtc(day1));
        await mongo.SessionExecutions.InsertOneAsync(firstExecution, cancellationToken: ct);

        // Second execution: in-progress, same clientId/sessionId, completed on day2.
        var secondExecution = BuildExecution(
            clientId: clientId, sessionId: sessionId, isCompleted: false,
            date: SessionExecution.ToCompletionDateUtc(day2));
        await mongo.SessionExecutions.InsertOneAsync(secondExecution, cancellationToken: ct);

        var svc = scope.ServiceProvider.GetRequiredService<Application.Domain.Interfaces.IWorkoutCompletionService>();

        // Must NOT throw — different day means a different index key.
        var act = async () => await svc.CompleteAsync(secondExecution, day2, ct);
        await act.Should().NotThrowAsync<WorkoutAlreadyCompletedException>(
            "different-day re-completions of the same session are valid");

        // Both completed executions must coexist.
        var completedCount = await mongo.SessionExecutions.CountDocumentsAsync(
            Builders<SessionExecution>.Filter.Eq(e => e.Status, SessionExecutionStatus.Completed)
            & Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
            & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionId),
            cancellationToken: ct);
        completedCount.Should().Be(2, "one completed execution per distinct day is valid");
    }

    // ── (4) Backfill populates CompletedDate on existing logs ─────────────────

    /// <summary>
    /// When MongoIndexInitializer runs on a collection that already has completed logs
    /// without CompletedDate, the backfill step must set CompletedDate from CompletedAt.
    ///
    /// We seed a legacy-style completed log (no CompletedDate), then restart the
    /// MongoIndexInitializer directly against the same collection and verify the field
    /// was populated.
    /// </summary>
    [Fact]
    public async Task Backfill_SetsCompletedDateOnExistingCompletedLogs()
    {
        var ct = TestContext.Current.CancellationToken;
        var completedAt = DateTime.UtcNow.AddDays(-3);

        // Use a fresh, empty MongoDB collection via a new Mongo Testcontainer.
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var mongoClient = new MongoClient(mongoContainer.GetConnectionString());
        var db = mongoClient.GetDatabase("backfill_test");
        var logsColl = db.GetCollection<WorkoutLog>("workoutLogs");

        // Insert a legacy completed log without CompletedDate.
        var legacyLog = new WorkoutLog
        {
            ExternalId  = Guid.NewGuid(),
            ClientId    = Guid.NewGuid(),
            PlanId      = Guid.NewGuid(),
            SessionId   = Guid.NewGuid(),
            StartedAt   = completedAt.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = completedAt,
            CompletedDate = null, // simulates legacy document
            Sections    = [],
            DateCreated = completedAt.AddMinutes(-30),
            DateUpdated = completedAt
        };
        await logsColl.InsertOneAsync(legacyLog, cancellationToken: ct);

        // Run MongoIndexInitializer directly.
        var mockContext = new BackfillTestMongoContext(db);
        var initializer = new MongoIndexInitializer(
            mockContext, NullLogger<MongoIndexInitializer>.Instance);

        await initializer.StartAsync(ct);

        // Verify backfill set CompletedDate.
        var updated = await logsColl
            .Find(Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, legacyLog.ExternalId))
            .FirstOrDefaultAsync(ct);

        updated.Should().NotBeNull();
        updated!.CompletedDate.Should().NotBeNull("backfill must set CompletedDate from CompletedAt");

        var expectedDate = WorkoutLog.ToCompletionDateUtc(completedAt);
        updated.CompletedDate.Should().Be(expectedDate,
            "backfill must derive CompletedDate via WorkoutLog.ToCompletionDateUtc(CompletedAt)");
    }

    // ── (5) Dedup collapses same-day dupes; index creates on clean data ────────

    /// <summary>
    /// When existing data has duplicate completed logs for the same
    /// (PlanId, SessionId, CompletedDate) triplet, the dedup step must retain only
    /// the most-recent (by CompletedAt) and delete the rest. The subsequent unique
    /// index creation must then succeed.
    /// </summary>
    [Fact]
    public async Task Dedup_CollapsesExistingDuplicates_ThenIndexCreatesSuccessfully()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId    = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var day       = DateTime.UtcNow.AddDays(-2);
        var midnight  = Midnight(day);

        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var mongoClient = new MongoClient(mongoContainer.GetConnectionString());
        var db = mongoClient.GetDatabase("dedup_test");
        var logsColl = db.GetCollection<WorkoutLog>("workoutLogs");

        // Insert two duplicate completed logs (same triplet) — simulates dirty prod data.
        var earlier = new WorkoutLog
        {
            ExternalId    = Guid.NewGuid(),
            ClientId      = Guid.NewGuid(),
            PlanId        = planId,
            SessionId     = sessionId,
            StartedAt     = day.AddMinutes(-60),
            IsCompleted   = true,
            CompletedAt   = day.AddMinutes(-30),
            CompletedDate = midnight,
            Sections      = [],
            DateCreated   = day.AddMinutes(-60)
        };
        var later = new WorkoutLog
        {
            ExternalId    = Guid.NewGuid(),
            ClientId      = Guid.NewGuid(),
            PlanId        = planId,
            SessionId     = sessionId,
            StartedAt     = day.AddMinutes(-45),
            IsCompleted   = true,
            CompletedAt   = day,
            CompletedDate = midnight,
            Sections      = [],
            DateCreated   = day.AddMinutes(-45)
        };
        await logsColl.InsertManyAsync([earlier, later], cancellationToken: ct);

        // Run MongoIndexInitializer — must not throw despite duplicate data.
        var mockContext = new BackfillTestMongoContext(db);
        var initializer = new MongoIndexInitializer(
            mockContext, NullLogger<MongoIndexInitializer>.Instance);

        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync("dedup must remove duplicates before creating the unique index");

        // Only the most-recent (later) log must remain.
        var remaining = await logsColl.Find(
            Builders<WorkoutLog>.Filter.Eq(l => l.PlanId, planId)
            & Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, sessionId)
            & Builders<WorkoutLog>.Filter.Eq(l => l.IsCompleted, true))
            .ToListAsync(ct);

        remaining.Should().HaveCount(1, "dedup must collapse duplicates to the most-recent");
        remaining[0].ExternalId.Should().Be(later.ExternalId,
            "the most-recent (by CompletedAt) log must be kept");
    }

    // ── (6) Logs with null PlanId/SessionId don't trip the index ─────────────

    /// <summary>
    /// WorkoutLogs with null PlanId or SessionId (e.g. ad-hoc free workouts) must
    /// not be affected by the partial unique index. The Exists guards in the partial
    /// filter exclude them from the uniqueness constraint, so index creation and
    /// completion succeed without conflict even for multiple such logs.
    /// </summary>
    [Fact]
    public async Task PartialIndex_NullPlanOrSessionId_DoesNotTripIndex()
    {
        var ct = TestContext.Current.CancellationToken;
        var today = DateTime.UtcNow;

        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var mongoClient = new MongoClient(mongoContainer.GetConnectionString());
        var db = mongoClient.GetDatabase("null_key_test");
        var logsColl = db.GetCollection<WorkoutLog>("workoutLogs");

        // Insert multiple completed logs with null PlanId/SessionId.
        var log1 = BuildLog(planId: null, sessionId: null,
            isCompleted: true, completedAt: today, completedDate: Midnight(today));
        var log2 = BuildLog(planId: null, sessionId: null,
            isCompleted: true, completedAt: today, completedDate: Midnight(today));
        // Also one with only PlanId but no SessionId.
        var log3 = BuildLog(planId: Guid.NewGuid(), sessionId: null,
            isCompleted: true, completedAt: today, completedDate: Midnight(today));

        await logsColl.InsertManyAsync([log1, log2, log3], cancellationToken: ct);

        // Index init must succeed — Exists guards exclude null-key logs.
        var mockContext = new BackfillTestMongoContext(db);
        var initializer = new MongoIndexInitializer(
            mockContext, NullLogger<MongoIndexInitializer>.Instance);

        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync(
            "completed logs with null PlanId/SessionId must not trigger the partial unique index");
    }
}

// ── Minimal IMongoContext for backfill/dedup tests ────────────────────────────

/// <summary>
/// Minimal <see cref="IMongoContext"/> implementation for backfill/dedup tests that
/// only need the WorkoutLogs collection. All other collections return empty mocks.
/// </summary>
internal sealed class BackfillTestMongoContext : IMongoContext
{
    private readonly IMongoDatabase _db;

    public BackfillTestMongoContext(IMongoDatabase db) => _db = db;

    public IMongoCollection<WorkoutLog> WorkoutLogs =>
        _db.GetCollection<WorkoutLog>("workoutLogs");

    // The following collections are required by IMongoContext but unused in these tests.
    // They point at the same DB so index creation on those collections is harmless.
    public IMongoCollection<Food> Foods               => _db.GetCollection<Food>("foods");
    public IMongoCollection<NutritionPlan> NutritionPlans => _db.GetCollection<NutritionPlan>("nutritionPlans");
    public IMongoCollection<MealLog> MealLogs         => _db.GetCollection<MealLog>("mealLogs");
    public IMongoCollection<Exercise> Exercises       => _db.GetCollection<Exercise>("exercises");
    public IMongoCollection<Recipe> Recipes           => _db.GetCollection<Recipe>("recipes");
    public IMongoCollection<TrainingPlan> TrainingPlans => _db.GetCollection<TrainingPlan>("trainingPlans");
    public IMongoCollection<TrainingCompletion> TrainingCompletions => _db.GetCollection<TrainingCompletion>("trainingCompletions");
    public IMongoCollection<SessionExecution> SessionExecutions => _db.GetCollection<SessionExecution>("sessionExecutions");
    public IMongoCollection<PersonalRecord> PersonalRecords => _db.GetCollection<PersonalRecord>("personalRecords");
    public IMongoCollection<DayLog> DayLogs               => _db.GetCollection<DayLog>("dayLogs");
    public IMongoCollection<SectionTemplate> SectionTemplates => _db.GetCollection<SectionTemplate>("sectionTemplates");
    public IMongoCollection<SessionLock> SessionLocks         => _db.GetCollection<SessionLock>("sessionLocks");
    public IMongoCollection<SessionLog> SessionLogs           => _db.GetCollection<SessionLog>("sessionLogs");
    public IMongoCollection<TrainerNote> TrainerNotes         => _db.GetCollection<TrainerNote>("trainer_notes");
    public IMongoCollection<WorkoutTemplate> WorkoutTemplates => _db.GetCollection<WorkoutTemplate>("workoutTemplates");
}
