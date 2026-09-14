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
/// Integration tests for POST /client/weekly-check-ins/{id}/respond.
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class RespondToCheckInEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "respond") =>
        $"{Guid.NewGuid():N}@{tag}-test.com";

    private async Task<(HttpClient Http, Guid ClientUserId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Client", "Client");
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

    private async Task<Guid> InsertCheckInAsync(
        Guid clientUserId,
        Guid professionalUserId,
        DateTime? reviewedAt = null)
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
            SentAt = DateTime.UtcNow.AddHours(-1),
            ReviewedByTrainerAt = reviewedAt,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };

        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn.Id;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Respond_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{Guid.NewGuid()}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Respond_TrainerRole_Returns403()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer-role");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "T", "T", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{Guid.NewGuid()}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Respond_ValidRequest_Returns200_AndPersistsFlags()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new
            {
                flags = new[] { "Traveling", "SickOrLowEnergy" },
                note = "I'll be in Berlin for 3 days."
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify persisted state in DB.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.WeeklyCheckIns, c => c.Id == checkInId, TestContext.Current.CancellationToken);

        persisted.RespondedAt.Should().NotBeNull();
        persisted.Flags.Should().Contain(CheckInFlag.Traveling);
        persisted.Flags.Should().Contain(CheckInFlag.SickOrLowEnergy);
        persisted.Note.Should().Be("I'll be in Berlin for 3 days.");
    }

    [Fact]
    public async Task Respond_AfterReviewed_Returns409WithCheckInAlreadyReviewed()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId,
            reviewedAt: DateTime.UtcNow.AddMinutes(-5));

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("CHECK_IN_ALREADY_REVIEWED");
    }

    [Fact]
    public async Task Respond_OtherClientCheckIn_Returns404()
    {
        var (http, _) = await SetupClientAsync();
        var otherClientId = Guid.NewGuid(); // doesn't exist
        var trainerId = await SetupTrainerUserIdAsync();

        // Insert a check-in for a different (fake) client.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // We need to create a real client to satisfy FK constraints.
        var otherEmail = UniqueEmail("other-client");
        var http2 = factory.CreateClient();
        await TestHelpers.RegisterAsync(http2, otherEmail, "TestPass1!", "Other", "Client", "Client");
        var otherUser = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == otherEmail, TestContext.Current.CancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var monday = today.AddDays(-days);

        var otherCheckIn = new WeeklyCheckIn
        {
            ClientUserId = otherUser.Id,
            ProfessionalUserId = trainerId,
            Profession = Profession.Training,
            WeekStartDate = monday.AddDays(7), // different week to avoid unique constraint
            SentAt = DateTime.UtcNow,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };
        db.WeeklyCheckIns.Add(otherCheckIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Authenticated as the first client, try to respond to the other client's check-in.
        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{otherCheckIn.Id}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Respond_NoteTooLong_Returns400()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new
            {
                flags = Array.Empty<string>(),
                note = new string('x', 501)
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Notification localization (#788) ─────────────────────────────────────

    /// <summary>
    /// The professional's stored <see cref="ApplicationUser.Language"/> localizes the
    /// "client responded" notification — this endpoint has no Accept-Language of its
    /// own to go on (the request is made by the CLIENT, not the professional), so it
    /// must read the professional's persisted Language column directly.
    /// </summary>
    [Fact]
    public async Task Respond_ProfessionalLanguageCs_PersistsCzechNotification()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var trainer = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                .FirstAsync(db.Users, u => u.Id == trainerId, TestContext.Current.CancellationToken);
            trainer.Language = "cs";
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notification = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(verifyDb.Notifications,
                n => n.RecipientUserId == trainerId && n.Type == NotificationType.WeeklyCheckInResponded,
                TestContext.Current.CancellationToken);

        notification.Title.Should().Be("Klient odpověděl na check-in");
        notification.Body.Should().Be("Klient odpověděl na týdenní připomenutí check-inu.");
    }

    /// <summary>
    /// No stored Language on the professional (null) falls back to English, per #788.
    /// </summary>
    [Fact]
    public async Task Respond_ProfessionalLanguageNull_FallsBackToEnglishNotification()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        var response = await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notification = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(verifyDb.Notifications,
                n => n.RecipientUserId == trainerId && n.Type == NotificationType.WeeklyCheckInResponded,
                TestContext.Current.CancellationToken);

        notification.Title.Should().Be("Client responded to check-in");
        notification.Body.Should().Be("A client has responded to their weekly check-in reminder.");
    }

    // ── SignalR broadcast ─────────────────────────────────────────────────────

    [Fact]
    public async Task Respond_HappyPath_BroadcastsWeeklyCheckInUpdated()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerUserIdAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerId);

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        await http.PostAsJsonAsync(
            $"/client/weekly-check-ins/{checkInId}/respond",
            new { flags = Array.Empty<string>() },
            TestContext.Current.CancellationToken);

        var wciUpdatedCalls = notifier.Calls
            .Where(c => c.EventType == "weeklycheckinupdated")
            .ToList();

        wciUpdatedCalls.Should().HaveCountGreaterThanOrEqualTo(1);
    }
}
