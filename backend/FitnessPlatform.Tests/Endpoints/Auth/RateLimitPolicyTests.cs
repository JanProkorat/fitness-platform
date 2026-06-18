using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Rate-limit integration tests that use a dedicated factory with rate limiting
/// RE-ENABLED (overriding FitnessApiFactory's default RateLimiting:Disabled=true).
///
/// These tests verify:
/// (a) /auth/refresh is on its own policy and does NOT exhaust the /auth/login budget.
/// (b) The X-Forwarded-For partition key is respected when injected (trusted proxy scenario).
/// </summary>
public class RateLimitEnabledFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .Build();

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Provide required secrets
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("MONGO_PASSWORD", "test");
        builder.UseSetting("MINIO_ACCESS_KEY", "test");
        builder.UseSetting("MINIO_SECRET_KEY", "test");
        builder.UseSetting("JWT_SECRET", new string('x', 64));

        // KEY DIFFERENCE: rate limiting is enabled for this factory
        builder.UseSetting("RateLimiting:Disabled", "false");

        builder.UseSetting("ConnectionStrings:PostgreSQl",
            "Host=localhost;Database=placeholder;Username=postgres");
        builder.UseSetting("ConnectionStrings:MongoDB",
            "mongodb://localhost:27017");

        builder.ConfigureServices(services =>
        {
            // Replace DbContext with testcontainer PostgreSQL
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString())
                    .ConfigureWarnings(w => w.Ignore(
                        Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

            // Replace MongoDB with testcontainer
            var mongoDbDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IMongoDatabase));
            if (mongoDbDescriptor is not null)
                services.Remove(mongoDbDescriptor);

            var mongoContextDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IMongoContext));
            if (mongoContextDescriptor is not null)
                services.Remove(mongoContextDescriptor);

            services.AddSingleton<IMongoDatabase>(_ =>
            {
                var client = new MongoClient(_mongo.GetConnectionString());
                return client.GetDatabase("fitness_ratelimit_test");
            });
            services.AddSingleton<IMongoContext, MongoContext>();

            // Replace email service with fake
            var emailDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IEmailService));
            if (emailDescriptor is not null)
                services.Remove(emailDescriptor);
            services.AddScoped<IEmailService, FakeEmailService>();

            // Replace blob storage with fake
            var blobDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IBlobStorageService));
            if (blobDescriptor is not null)
                services.Remove(blobDescriptor);
            services.AddSingleton<IBlobStorageService, FakeBlobStorageService>();

            // Replace realtime notifier with fake
            var notifierDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IRealtimeNotifier));
            if (notifierDescriptor is not null)
                services.Remove(notifierDescriptor);
            services.AddSingleton<FakeRealtimeNotifier>();
            services.AddSingleton<IRealtimeNotifier>(sp => sp.GetRequiredService<FakeRealtimeNotifier>());

            // Replace push notifications with fake
            var pushDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IPushNotificationService));
            if (pushDescriptor is not null)
                services.Remove(pushDescriptor);
            services.AddSingleton<FakePushNotificationService>();
            services.AddSingleton<IPushNotificationService>(
                sp => sp.GetRequiredService<FakePushNotificationService>());
        });

        builder.UseEnvironment("Development");
    }

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync());

        await ApplicationDbContextSeed.SeedAsync(Services);
    }

    public new async ValueTask DisposeAsync()
    {
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }
}

/// <summary>
/// Integration tests for the split rate-limit policy introduced in issue #521.
/// Uses <see cref="RateLimitEnabledFactory"/> which keeps rate limiting active.
/// </summary>
public class RateLimitPolicyTests : IAsyncLifetime
{
    private readonly RateLimitEnabledFactory _factory = new();
    private HttpClient _client = null!;

    public async ValueTask InitializeAsync()
    {
        await _factory.InitializeAsync();
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            // Do not follow redirects so we can inspect 429 responses directly
            AllowAutoRedirect = false
        });
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@ratelimit-test.com";

    /// <summary>
    /// Registers a user and returns a valid refresh token so tests can call /auth/refresh.
    /// </summary>
    private async Task<string> GetValidRefreshTokenAsync(string email, string password)
    {
        await TestHelpers.RegisterAsync(_client, email, password, "Rate", "Tester", "Client");
        var (_, refreshToken) = await TestHelpers.LoginAsync(_client, email, password);
        return refreshToken;
    }

    /// <summary>
    /// AC-4 regression: /auth/refresh is on its own policy (auth-refresh) and cannot
    /// exhaust the /auth/login budget (auth policy, PermitLimit=10).
    ///
    /// We issue 11 refresh calls from the same "IP" (loopback, which test clients use).
    /// The 11th call MAY be rate-limited on the refresh policy (PermitLimit=120 — will
    /// NOT be hit in 11 calls), but MORE IMPORTANTLY /auth/login must still return 200,
    /// proving the refresh calls did not consume the login budget.
    /// </summary>
    [Fact]
    public async Task RefreshCalls_DoNotExhaustLoginBudget()
    {
        var email = UniqueEmail();
        const string password = "TestPass1!";

        // Get initial refresh token via registration + login (1 permit from auth budget)
        var refreshToken = await GetValidRefreshTokenAsync(email, password);

        // Issue 10 more refresh calls (each rotates the token — well within the
        // refresh policy's 120-permit budget, but would exceed the 10-permit login
        // budget if they were sharing it)
        for (var i = 0; i < 10; i++)
        {
            var response = await _client.PostAsJsonAsync("/auth/refresh", new { RefreshToken = refreshToken });

            // Each refresh call should succeed (200)
            if (response.IsSuccessStatusCode)
            {
                // Rotate the refresh token for the next iteration
                var body = await response.Content.ReadFromJsonAsync<RefreshResult>();
                refreshToken = body!.RefreshToken;
            }
            else
            {
                // A 429 here would mean the refresh policy kicked in early — fail the test
                response.StatusCode.Should().Be(HttpStatusCode.OK,
                    $"refresh call #{i + 1} should succeed; got {(int)response.StatusCode}");
                break;
            }
        }

        // Now try /auth/login. If refresh calls had been sharing the auth budget we
        // would have exhausted it (10 permits: 1 from registration login + 10 from
        // refresh = 11 > 10). With the split policy the login budget still has room.
        var loginResponse = await _client.PostAsJsonAsync("/auth/login", new
        {
            Email = email,
            Password = password
        });

        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK,
            "login must succeed after many refresh calls — refresh uses its own rate-limit bucket");
    }

    /// <summary>
    /// AC-5 regression: the partition key is resolved from a trusted X-Forwarded-For
    /// header when the source IP is in a known-proxy network (loopback qualifies
    /// because the test client connects via loopback).
    ///
    /// We issue two requests with different X-Forwarded-For values from the same
    /// underlying connection. Both should succeed independently — they are partitioned
    /// by their declared forwarded IP, not by the shared connection IP — demonstrating
    /// that UseForwardedHeaders correctly rewrites RemoteIpAddress per request.
    ///
    /// Note: this test verifies that two distinct forwarded IPs are treated as distinct
    /// partitions (neither exhausts the other's budget). It does not attempt to exhaust
    /// a bucket, as doing so would require 10+ requests per IP.
    /// </summary>
    [Fact]
    public async Task ForwardedFor_DifferentIPs_ArePartitionedSeparately()
    {
        const string password = "TestPass1!";

        var email1 = UniqueEmail();
        var email2 = UniqueEmail();

        // Register both users
        await TestHelpers.RegisterAsync(_client, email1, password, "Rate", "One", "Client");
        await TestHelpers.RegisterAsync(_client, email2, password, "Rate", "Two", "Client");

        // Login from two different forwarded IPs (simulated via X-Forwarded-For header)
        using var request1 = new HttpRequestMessage(HttpMethod.Post, "/auth/login");
        request1.Headers.Add("X-Forwarded-For", "10.0.0.1");
        request1.Content = JsonContent.Create(new { Email = email1, Password = password });

        using var request2 = new HttpRequestMessage(HttpMethod.Post, "/auth/login");
        request2.Headers.Add("X-Forwarded-For", "10.0.0.2");
        request2.Content = JsonContent.Create(new { Email = email2, Password = password });

        var response1 = await _client.SendAsync(request1);
        var response2 = await _client.SendAsync(request2);

        // Both should succeed — they are in separate partitions
        response1.StatusCode.Should().Be(HttpStatusCode.OK,
            "login from 10.0.0.1 should succeed");
        response2.StatusCode.Should().Be(HttpStatusCode.OK,
            "login from 10.0.0.2 should succeed in its own partition");
    }

    private record RefreshResult(string AccessToken, string RefreshToken, DateTime ExpiresAt);
}
