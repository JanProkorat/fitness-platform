using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for POST /trainer/weekly-check-ins/{id}/mark-reviewed.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI.
/// </summary>
[Collection(TestCollection.Name)]
public class MarkCheckInReviewedEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "mark-reviewed") =>
        $"{Guid.NewGuid():N}@{tag}-test.com";

    private async Task<(HttpClient Http, Guid TrainerId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Trainer", "Mark", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<Guid> SetupClientUserIdAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "C", "C", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return user.Id;
    }

    private async Task<Guid> InsertCheckInAsync(Guid clientUserId, Guid professionalUserId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var monday = today.AddDays(-days);

        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = Profession.Training,
            WeekStartDate = monday,
            SentAt = DateTime.UtcNow.AddHours(-2),
            RespondedAt = DateTime.UtcNow.AddHours(-1),
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };

        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn.Id;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkReviewed_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            $"/trainer/weekly-check-ins/{Guid.NewGuid()}/mark-reviewed",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task MarkReviewed_ClientRole_Returns403()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client-role");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "C", "C", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        var response = await http.PostAsJsonAsync(
            $"/trainer/weekly-check-ins/{Guid.NewGuid()}/mark-reviewed",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkReviewed_OwnCheckIn_Returns200_SetsReviewedAt_Broadcasts()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientId, trainerId);

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var response = await http.PostAsJsonAsync(
            $"/trainer/weekly-check-ins/{checkInId}/mark-reviewed",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify DB.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.WeeklyCheckIns, c => c.Id == checkInId, TestContext.Current.CancellationToken);

        persisted.ReviewedByTrainerAt.Should().NotBeNull();

        // Both trainer and client should receive weeklycheckinupdated.
        var updatedCalls = notifier.Calls.Where(c => c.EventType == "weeklycheckinupdated").ToList();
        updatedCalls.Should().HaveCountGreaterThanOrEqualTo(2);
        updatedCalls.Should().Contain(c => c.UserId == trainerId);
        updatedCalls.Should().Contain(c => c.UserId == clientId);
    }

    [Fact]
    public async Task MarkReviewed_CrossTrainerAccess_Returns403()
    {
        var (_, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientId, trainerId);

        // Set up a second trainer and try to mark the first trainer's check-in.
        var (http2, _) = await SetupTrainerAsync();

        var response = await http2.PostAsJsonAsync(
            $"/trainer/weekly-check-ins/{checkInId}/mark-reviewed",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task MarkReviewed_NotFound_Returns404()
    {
        var (http, _) = await SetupTrainerAsync();

        var response = await http.PostAsJsonAsync(
            $"/trainer/weekly-check-ins/{Guid.NewGuid()}/mark-reviewed",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
