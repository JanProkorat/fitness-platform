using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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
