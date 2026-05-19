using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Custom WebApplicationFactory that uses Testcontainers for real PostgreSQL and MongoDB instances.
/// Replaces the email service with a no-op fake and disables rate limiting for tests.
/// </summary>
public class FitnessApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .Build();

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Provide required secrets (test values only, not real credentials)
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("MONGO_PASSWORD", "test");
        builder.UseSetting("MINIO_ACCESS_KEY", "test");
        builder.UseSetting("MINIO_SECRET_KEY", "test");
        builder.UseSetting("JWT_SECRET", new string('x', 64));
        builder.UseSetting("RateLimiting:Disabled", "true");

        // Provide placeholder connection strings so Program.cs ConnectionStringFactory
        // does not throw during host startup.  The real DB contexts are replaced below
        // with Testcontainer-backed instances, so these values are never actually used.
        builder.UseSetting("ConnectionStrings:PostgreSQl",
            "Host=localhost;Database=placeholder;Username=postgres");
        builder.UseSetting("ConnectionStrings:MongoDB",
            "mongodb://localhost:27017");

        builder.ConfigureServices(services =>
        {
            // Replace DbContext to use testcontainer PostgreSQL
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString())
                    .ConfigureWarnings(w => w.Ignore(
                        Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

            // Replace MongoDB to use testcontainer
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

            // Replace email service with fake
            var emailDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IEmailService));
            if (emailDescriptor is not null)
                services.Remove(emailDescriptor);

            services.AddScoped<IEmailService, FakeEmailService>();

            // Replace realtime notifier with in-memory fake so tests can assert broadcasts
            var notifierDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IRealtimeNotifier));
            if (notifierDescriptor is not null)
                services.Remove(notifierDescriptor);

            services.AddSingleton<FakeRealtimeNotifier>();
            services.AddSingleton<IRealtimeNotifier>(sp => sp.GetRequiredService<FakeRealtimeNotifier>());

            // Replace blob storage with a no-op fake so integration tests never
            // require a running MinIO instance.  IImageUploadService (the layer
            // above) is left as-is so its content-type / size validation still runs.
            var blobDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IBlobStorageService));
            if (blobDescriptor is not null)
                services.Remove(blobDescriptor);

            services.AddSingleton<IBlobStorageService, FakeBlobStorageService>();

            // Replace push notification service with in-memory fake so integration tests
            // can assert on sent pushes without a real Expo endpoint.
            var pushDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IPushNotificationService));
            if (pushDescriptor is not null)
                services.Remove(pushDescriptor);

            services.AddSingleton<FakePushNotificationService>();
            services.AddSingleton<IPushNotificationService>(
                sp => sp.GetRequiredService<FakePushNotificationService>());

            // Candidate A — test isolation: remove all IHostedService registrations for
            // PhotoDiaryReminderScheduler so it does not run autonomously during tests and
            // cannot race with the real-time clock at the :00 boundary on Linux CI.
            //
            // Three descriptor shapes are matched defensively because the production
            // registration in Program.cs uses the factory overload:
            //
            //   builder.Services.AddSingleton<PhotoDiaryReminderScheduler>();          // line 199
            //   builder.Services.AddHostedService(sp =>                                // line 200
            //       sp.GetRequiredService<PhotoDiaryReminderScheduler>());
            //
            // The second call produces a ServiceDescriptor whose ImplementationType is null
            // (factory-registered) and whose ImplementationFactory is a Func<IServiceProvider, object>
            // whose MethodInfo.ReturnType is PhotoDiaryReminderScheduler (covariant delegate
            // conversion).  Matching only ImplementationType == typeof(...) is a no-op against
            // this shape — the ImplementationType check is always false for factory descriptors.
            //
            // All three variants are checked so the removal is robust against future
            // registration-style changes without requiring another test-isolation fixup.
            //
            // The scheduler remains resolvable as a singleton via
            //   factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>()
            // so existing tests that drive TickAsync directly are unaffected.
            var toRemove = services
                .Where(d => d.ServiceType == typeof(IHostedService))
                .Where(d =>
                    d.ImplementationType == typeof(PhotoDiaryReminderScheduler) ||
                    d.ImplementationInstance is PhotoDiaryReminderScheduler ||
                    (d.ImplementationFactory is not null &&
                     d.ImplementationFactory.Method.ReturnType == typeof(PhotoDiaryReminderScheduler)))
                .ToList();

            foreach (var d in toRemove)
                services.Remove(d);
        });

        builder.UseEnvironment("Development");
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync());

        // Apply migrations and seed
        await ApplicationDbContextSeed.SeedAsync(Services);
    }

    public new async ValueTask DisposeAsync()
    {
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
        await base.DisposeAsync();
    }
}
