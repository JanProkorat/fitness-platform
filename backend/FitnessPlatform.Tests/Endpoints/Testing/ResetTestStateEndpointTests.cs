using System.Net;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
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

namespace FitnessPlatform.Tests.Endpoints.Testing;

// ---------------------------------------------------------------------------
// Custom factories — each gate combination needs its own WebApplicationFactory
// because gating depends on per-factory configuration (Testing:Enabled +
// environment). The endpoint is always in the route table; the gate is evaluated
// at request time inside HandleAsync, so each factory supplies different config
// to drive the different gate outcomes.
// ---------------------------------------------------------------------------

/// <summary>
/// Base factory that spins up real Postgres + Mongo via Testcontainers and
/// replaces the non-DB services (email, blob, push) with no-op fakes.
/// Derived classes configure the environment name and Testing:Enabled value.
/// </summary>
public abstract class ResetEndpointFactoryBase : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    /// <summary>
    /// ASPNETCORE_ENVIRONMENT to use for this factory instance.
    /// </summary>
    protected abstract string EnvironmentName { get; }

    /// <summary>
    /// Whether Testing:Enabled should be true for this factory instance.
    /// </summary>
    protected abstract bool TestingEnabled { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("MONGO_PASSWORD", "test");
        builder.UseSetting("MINIO_ACCESS_KEY", "test");
        builder.UseSetting("MINIO_SECRET_KEY", "test");
        builder.UseSetting("JWT_SECRET", new string('x', 64));
        builder.UseSetting("RateLimiting:Disabled", "true");
        builder.UseSetting("Testing:Enabled", TestingEnabled ? "true" : "false");

        // QA_SEED_PASSWORD must be set as a real env var because QaSeedRunner reads
        // it via Environment.GetEnvironmentVariable, not from IConfiguration.
        Environment.SetEnvironmentVariable("QA_SEED_PASSWORD", "TestSeed1!");

        // Placeholder connection strings (overridden below)
        builder.UseSetting("ConnectionStrings:PostgreSQl",
            "Host=localhost;Database=placeholder;Username=postgres");
        builder.UseSetting("ConnectionStrings:MongoDB",
            "mongodb://localhost:27017");

        builder.ConfigureServices(services =>
        {
            // Replace DbContext with Testcontainer-backed Postgres
            var pgDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (pgDescriptor is not null)
                services.Remove(pgDescriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString())
                    .ConfigureWarnings(w => w.Ignore(
                        Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

            // Replace MongoDB
            var mongoDbDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IMongoDatabase));
            if (mongoDbDescriptor is not null)
                services.Remove(mongoDbDescriptor);

            var mongoContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IMongoContext));
            if (mongoContextDescriptor is not null)
                services.Remove(mongoContextDescriptor);

            services.AddSingleton<IMongoDatabase>(_ =>
            {
                var client = new MongoClient(_mongo.GetConnectionString());
                return client.GetDatabase("fitness_test");
            });
            services.AddSingleton<IMongoContext, MongoContext>();

            // No-op fakes for external services
            var emailDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IEmailService));
            if (emailDescriptor is not null)
                services.Remove(emailDescriptor);
            services.AddScoped<FitnessPlatform.Application.Domain.Interfaces.IEmailService, FakeEmailService>();

            var notifierDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IRealtimeNotifier));
            if (notifierDescriptor is not null)
                services.Remove(notifierDescriptor);
            services.AddSingleton<FakeRealtimeNotifier>();
            services.AddSingleton<FitnessPlatform.Application.Domain.Interfaces.IRealtimeNotifier>(
                sp => sp.GetRequiredService<FakeRealtimeNotifier>());

            var blobDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IBlobStorageService));
            if (blobDescriptor is not null)
                services.Remove(blobDescriptor);
            services.AddSingleton<FitnessPlatform.Application.Domain.Interfaces.IBlobStorageService, FakeBlobStorageService>();

            var pushDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(FitnessPlatform.Application.Domain.Interfaces.IPushNotificationService));
            if (pushDescriptor is not null)
                services.Remove(pushDescriptor);
            services.AddSingleton<FakePushNotificationService>();
            services.AddSingleton<FitnessPlatform.Application.Domain.Interfaces.IPushNotificationService>(
                sp => sp.GetRequiredService<FakePushNotificationService>());
        });

        builder.UseEnvironment(EnvironmentName);
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync());

        // Apply migrations + seed roles (not QA users — the reset endpoint handles that)
        await ApplicationDbContextSeed.SeedAsync(Services);
    }

    public new async ValueTask DisposeAsync()
    {
        // Stop hosted services (schedulers, EmailDispatchWorker) gracefully BEFORE tearing
        // down the containers below — see TestHostedServiceShutdown for the full
        // root-cause explanation (#726: zombie schedulers touching disposed Testcontainers,
        // zombie EmailDispatchWorker racing FakeEmailService's shared static state).
        await TestHostedServiceShutdown.StopAllAsync(Services);

        // Dispose the Testcontainers but intentionally skip base.DisposeAsync().
        //
        // base.DisposeAsync() disposes the root IServiceProvider, which clears
        // FastEndpoints' process-global ServiceResolver.Provider. Any Factory.Create<T>()
        // call running concurrently (standalone unit tests without a [Collection] attribute)
        // would then throw ObjectDisposedException. Skipping base.DisposeAsync() keeps the
        // provider alive until the process exits — safe for test code where the process is
        // short-lived. Containers still need explicit cleanup, and (see above) so do the
        // hosted services that would otherwise keep running against those containers.
        //
        // See also: FitnessApiFactory (same pattern, #296).
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }
}

/// <summary>
/// Gate: Testing:Enabled=true + Development environment — the happy path.
/// The reset endpoint MUST be registered and callable.
/// </summary>
public class ResetEndpointEnabledFactory : ResetEndpointFactoryBase
{
    protected override string EnvironmentName => "Development";
    protected override bool TestingEnabled => true;
}

/// <summary>
/// Gate: Testing:Enabled=false (any environment) — endpoint must NOT be registered.
/// </summary>
public class ResetEndpointDisabledFactory : ResetEndpointFactoryBase
{
    protected override string EnvironmentName => "Development";
    protected override bool TestingEnabled => false;
}

/// <summary>
/// Gate: Testing:Enabled=true + non-Development environment.
/// With the single-gate model (Testing:Enabled is the sole gate), the endpoint
/// must succeed (return 204) even when the environment is not "Development".
/// Using "Staging" to simulate a non-Development CI test harness environment.
/// </summary>
public class ResetEndpointProductionFactory : ResetEndpointFactoryBase
{
    protected override string EnvironmentName => "Staging";
    protected override bool TestingEnabled => true;
}

// ---------------------------------------------------------------------------
// Test class — one [Fact] per gate combination + idempotency + round-trip seed
// ---------------------------------------------------------------------------

/// <summary>
/// Defines a test collection for the reset-endpoint tests. Tests are NOT in
/// the shared "Integration" collection because each test needs its own factory
/// with distinct startup configuration. Using a named collection ensures the
/// reset tests run serially with each other, which avoids Testcontainer port
/// exhaustion from multiple MongoDB instances starting simultaneously.
/// </summary>
[CollectionDefinition("ResetTests")]
public class ResetTestsCollection;

/// <summary>
/// Integration tests for <c>POST /test/reset</c>. Tests are NOT in the shared
/// "Integration" collection because each test needs its own factory with a
/// distinct startup configuration (env + Testing:Enabled). Placed in the
/// "ResetTests" collection so they run serially with each other.
/// </summary>
[Collection("ResetTests")]
public class ResetTestStateEndpointTests : IAsyncLifetime
{
    // The enabled factory is reused across multiple tests in this class.
    private readonly ResetEndpointEnabledFactory _enabledFactory = new();

    // Gate-disabled factories are scoped to their single test via local variables.

    public async ValueTask InitializeAsync()
    {
        await _enabledFactory.InitializeAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _enabledFactory.DisposeAsync();
    }

    // ── Happy path ──────────────────────────────────────────────────────────

    /// <summary>
    /// Testing:Enabled=true + Development → POST /test/reset returns 204
    /// and QaSeedRunner users are present with their stable GUIDs.
    /// </summary>
    [Fact]
    public async Task Reset_EnabledInDevelopment_Returns204AndSeedsQaUsers()
    {
        var client = _enabledFactory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.PostAsync("/test/reset", null, ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Assert QA client user exists with the stable GUID from QaSeedRunner
        using var scope = _enabledFactory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var qaClient = await userManager.FindByEmailAsync(QaSeedRunner.ClientEmail);
        qaClient.Should().NotBeNull(because: "QaSeedRunner must create the QA client user");
        qaClient!.Id.Should().Be(QaSeedRunner.ClientUserId,
            because: "QaSeedRunner assigns a stable GUID to the QA client user");

        var qaTrainer = await userManager.FindByEmailAsync(QaSeedRunner.TrainerEmail);
        qaTrainer.Should().NotBeNull(because: "QaSeedRunner must create the QA trainer user");
        qaTrainer!.Id.Should().Be(QaSeedRunner.TrainerUserId);

        var qaNutri = await userManager.FindByEmailAsync(QaSeedRunner.NutriEmail);
        qaNutri.Should().NotBeNull(because: "QaSeedRunner must create the QA nutritionist user");
        qaNutri!.Id.Should().Be(QaSeedRunner.NutriUserId);
    }

    /// <summary>
    /// Idempotency: two consecutive POSTs to /test/reset both return 204.
    /// QaSeedRunner.EnsureUserAsync short-circuits on existing users so the
    /// second call must not throw or double-create.
    /// </summary>
    [Fact]
    public async Task Reset_CalledTwice_BothReturn204AndUsersStillHaveStableGuids()
    {
        var client = _enabledFactory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var first = await client.PostAsync("/test/reset", null, ct);
        first.StatusCode.Should().Be(HttpStatusCode.NoContent, because: "first reset must succeed");

        var second = await client.PostAsync("/test/reset", null, ct);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent, because: "second reset must be idempotent");

        using var scope = _enabledFactory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var qaClient = await userManager.FindByEmailAsync(QaSeedRunner.ClientEmail);
        qaClient.Should().NotBeNull();
        qaClient!.Id.Should().Be(QaSeedRunner.ClientUserId,
            because: "stable GUID must be preserved after re-seed");
    }

    // ── Training plan seed assertions ───────────────────────────────────────

    /// <summary>
    /// POST /test/reset seeds a TrainingPlan with ExternalId = QaTrainingPlanExternalId.
    /// The plan must be keyed on ClientProfilePublicId (not ClientUserId) and
    /// have exactly one Published week with one session containing three sections
    /// in the expected order and format.
    /// </summary>
    [Fact]
    public async Task Reset_SeedsTrainingPlan_WithForTimeSectionAndNonRegressionSections()
    {
        var httpClient = _enabledFactory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await httpClient.PostAsync("/test/reset", null, ct);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _enabledFactory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var plan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaSeedRunner.QaTrainingPlanExternalId)
            .FirstOrDefaultAsync(ct);

        plan.Should().NotBeNull(because: "QaSeedRunner must create the QA training plan");

        // ClientId must be ClientProfilePublicId — GetClientPlansEndpoint filters by
        // ClientProfile.PublicId (not by the user id) so using the wrong value makes
        // the plan invisible to GET /client/plans.
        plan!.ClientId.Should().Be(QaSeedRunner.ClientProfilePublicId,
            because: "TrainingPlan.ClientId must equal ClientProfile.PublicId for the plan to be visible via GET /client/plans");

        // Plan must be Active (not Draft) with at least one Published week.
        plan.Status.Should().Be(TrainingPlanStatus.Active);

        plan.Weeks.Should().HaveCount(1, because: "one week is seeded");

        var week = plan.Weeks[0];

        // GetClientPlansEndpoint:142 applies ElemMatch(w => w.Status == WeekStatus.Published).
        // A Draft week silently excludes the plan from the client response.
        week.Status.Should().Be(WeekStatus.Published,
            because: "week must be Published for GET /client/plans to return the plan");
        week.DatePublished.Should().NotBeNull(because: "published week must have a DatePublished timestamp");

        week.Sessions.Should().HaveCount(1);
        var session = week.Sessions[0];

        session.Sections.Should().HaveCount(4, because: "one ForTime section + one AMRAP section + one Standard section + one Tabata section");

        // Section 1 — ForTime + 0 exercises (the #258 bug shape).
        var section1 = session.Sections[0];
        section1.Format.Should().Be(WorkoutFormat.ForTime,
            because: "Section 1 must be ForTime format");
        section1.FormatConfig.Should().NotBeNull();
        section1.FormatConfig!.TimeCapSeconds.Should().Be(1800,
            because: "ForTime section must have a 30-minute (1800s) time cap");
        section1.Exercises.Should().BeEmpty(
            because: "ForTime section intentionally has 0 exercises to exercise the #258 empty-exercise bug shape");

        // Section 2 — AMRAP + exercises (non-regression: format-with-exercises path).
        var section2 = session.Sections[1];
        section2.Format.Should().Be(WorkoutFormat.AMRAP,
            because: "Section 2 must be AMRAP format");
        section2.Exercises.Should().HaveCountGreaterThanOrEqualTo(1,
            because: "AMRAP section must have at least one exercise for non-regression");

        // Section 3 — Standard (null format) + exercises (non-regression: no-format path).
        var section3 = session.Sections[2];
        section3.Format.Should().BeNull(
            because: "Section 3 must be Standard (null format)");
        section3.Exercises.Should().HaveCountGreaterThanOrEqualTo(1,
            because: "Standard section must have at least one exercise for non-regression");

        // Section 4 — Tabata 20s/10s × 8 + 1 exercise (#327 iOS QA fixture).
        var section4 = session.Sections[3];
        section4.Format.Should().Be(WorkoutFormat.Tabata,
            because: "Section 4 must be Tabata format");
        section4.Order.Should().Be(3,
            because: "Tabata section must be Order=3");
        section4.Name.Should().Be("Tabata test",
            because: "Tabata section must have the seeded name");
        section4.FormatConfig.Should().NotBeNull();
        section4.FormatConfig!.WorkSeconds.Should().Be(20,
            because: "Tabata FormatConfig must have WorkSeconds=20");
        section4.FormatConfig.RestSeconds.Should().Be(10,
            because: "Tabata FormatConfig must have RestSeconds=10");
        section4.FormatConfig.TotalRounds.Should().Be(8,
            because: "Tabata FormatConfig must have TotalRounds=8");
        section4.Exercises.Should().HaveCount(1,
            because: "Tabata section must have exactly one seeded exercise");
    }

    /// <summary>
    /// Idempotency for the training plan: two consecutive POSTs to /test/reset must
    /// not duplicate the TrainingPlan document. Count by ExternalId must stay exactly 1.
    /// </summary>
    [Fact]
    public async Task Reset_CalledTwice_TrainingPlanNotDuplicated()
    {
        var httpClient = _enabledFactory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var first = await httpClient.PostAsync("/test/reset", null, ct);
        first.StatusCode.Should().Be(HttpStatusCode.NoContent, because: "first reset must succeed");

        var second = await httpClient.PostAsync("/test/reset", null, ct);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent, because: "second reset must be idempotent");

        using var scope = _enabledFactory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var count = await mongo.TrainingPlans
            .CountDocumentsAsync(
                Builders<FitnessPlatform.Application.Domain.Documents.TrainingPlan>.Filter
                    .Eq(p => p.ExternalId, QaSeedRunner.QaTrainingPlanExternalId),
                cancellationToken: ct);

        count.Should().Be(1, because: "EnsureTrainingPlanAsync must be idempotent — no duplicate plan documents");
    }

    // ── Gate: Testing:Enabled=false ─────────────────────────────────────────

    /// <summary>
    /// Testing:Enabled=false → request-time gate rejects the call with 404.
    /// The endpoint IS registered in the route table (FastEndpoints 8.x builds
    /// the static route table once per process, so registration-time filters
    /// would poison other factory instances in the same test run). The gate is
    /// enforced per-request inside HandleAsync.
    /// </summary>
    [Fact]
    public async Task Reset_TestingDisabled_GateRejects_Returns404()
    {
        await using var factory = new ResetEndpointDisabledFactory();
        await factory.InitializeAsync();

        var client = factory.CreateClient();
        var response = await client.PostAsync("/test/reset", null, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound,
            because: "request-time gate must reject the call when Testing:Enabled=false");
    }

    // ── Gate: Non-Development environment with Testing:Enabled=true ────────────

    /// <summary>
    /// Testing:Enabled=true + non-Development environment → endpoint succeeds (204).
    /// The environment name is no longer checked — Testing:Enabled is the sole gate.
    /// This verifies CI test harnesses that use non-Development environment names
    /// (e.g. "Testing", "Staging") can call /test/reset as long as the flag is set.
    /// </summary>
    [Fact]
    public async Task Reset_TestingEnabled_NonDevelopment_Succeeds()
    {
        await using var factory = new ResetEndpointProductionFactory();
        await factory.InitializeAsync();

        var client = factory.CreateClient();
        var response = await client.PostAsync("/test/reset", null, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent,
            because: "Testing:Enabled=true is the sole gate; environment name must not block the call");
    }
}
