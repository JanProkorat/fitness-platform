using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for POST /client/weekly-check-ins/{id}/dismiss.
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class DismissCheckInEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "dismiss") =>
        $"{Guid.NewGuid():N}@{tag}-test.com";

    private async Task<(HttpClient Http, Guid ClientUserId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Dismiss", "Client", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<Guid> SetupTrainerUserIdAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "T", "T", "Trainer");

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
            Profession = Profession.Nutrition,
            WeekStartDate = monday,
            SentAt = DateTime.UtcNow.AddHours(-2),
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };

        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn.Id;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Dismiss_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{Guid.NewGuid()}/dismiss",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Dismiss_ValidCheckIn_Returns200_SetsDismissedAt_NoTrainerNotification()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/dismiss",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify DismissedByClientAt is set.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.WeeklyCheckIns, c => c.Id == checkInId, TestContext.Current.CancellationToken);

        persisted.DismissedByClientAt.Should().NotBeNull();

        // No WeeklyCheckInResponded notification should be created for the trainer.
        var respondedNotifications = await db.Notifications
            .Where(n => n.RecipientUserId == trainerId &&
                        n.Type == FitnessPlatform.Application.Domain.Enums.NotificationType.WeeklyCheckInResponded)
            .ToListAsync(TestContext.Current.CancellationToken);

        respondedNotifications.Should().BeEmpty();

        // weeklycheckinupdated is broadcast (to remove banner on client side).
        var updatedCalls = notifier.Calls.Where(c => c.EventType == "weeklycheckinupdated").ToList();
        updatedCalls.Should().HaveCountGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Dismiss_OtherClientCheckIn_Returns404()
    {
        var (http, _) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();

        // Create check-in for a different client.
        var http2 = factory.CreateClient();
        var email2 = UniqueEmail("other2");
        await TestHelpers.RegisterAsync(http2, email2, "TestPass1!", "Other", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var otherUser = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email2, TestContext.Current.CancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var monday = today.AddDays(-days).AddDays(14); // future week to avoid constraint

        var otherCheckIn = new WeeklyCheckIn
        {
            ClientUserId = otherUser.Id,
            ProfessionalUserId = trainerId,
            Profession = Profession.Nutrition,
            WeekStartDate = monday,
            SentAt = DateTime.UtcNow,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };
        db.WeeklyCheckIns.Add(otherCheckIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{otherCheckIn.Id}/dismiss",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
