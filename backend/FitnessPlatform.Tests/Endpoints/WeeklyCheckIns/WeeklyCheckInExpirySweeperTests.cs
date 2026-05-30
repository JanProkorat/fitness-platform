using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for the weekly check-in deadline / expiry feature (#331).
/// Covers:
///   - DueAt is stamped correctly at check-in creation with default and custom offsets.
///   - SweepExpiredAsync transitions Pending+past-due rows to Expired.
///   - SweepExpiredAsync skips terminal states (Responded, Dismissed, Reviewed, Expired).
///   - SweepExpiredAsync is idempotent.
///   - GET /client/weekly-check-ins/current excludes Expired rows.
///   - POST /client/weekly-check-ins/{id}/respond returns 409 for Expired rows.
///   - POST /client/weekly-check-ins/{id}/dismiss returns 409 for Expired rows.
/// Uses Testcontainers PostgreSQL + MongoDB (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class WeeklyCheckInExpirySweeperTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "expiry") =>
        $"{Guid.NewGuid():N}@{tag}-test.com";

    // ── Setup helpers ─────────────────────────────────────────────────────────

    private async Task<(Guid TrainerUserId, Guid ClientUserId)>
        SetupTrainerAndClientAsync(string trainerTag = "trainer", string clientTag = "client")
    {
        var trainerHttp = factory.CreateClient();
        var trainerEmail = UniqueEmail(trainerTag);
        await TestHelpers.RegisterAsync(trainerHttp, trainerEmail, "TestPass1!", "Expiry", "Trainer", "Trainer");

        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail(clientTag);
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, "TestPass1!", "Expiry", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var trainerUser = await db.Users.FirstAsync(u => u.Email == trainerEmail,
            TestContext.Current.CancellationToken);
        var clientUser = await db.Users.FirstAsync(u => u.Email == clientEmail,
            TestContext.Current.CancellationToken);

        trainerUser.TimeZone = "UTC";

        var profProfile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == trainerUser.Id, TestContext.Current.CancellationToken);
        var clientProfile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == clientUser.Id, TestContext.Current.CancellationToken);

        db.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = profProfile.Id,
            ClientProfileId = clientProfile.Id,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewTrainingPlans = true,
            CanViewNutritionPlans = false,
            DateCreated = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (trainerUser.Id, clientUser.Id);
    }

    private async Task<WeeklyCheckInSetting> CreateSettingAsync(
        Guid trainerUserId,
        int deadlineOffsetHours = 72)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var setting = new WeeklyCheckInSetting
        {
            UserId = trainerUserId,
            Profession = Profession.Training,
            DayOfWeek = DayOfWeek.Monday,
            TimeOfDay = TimeSpan.FromHours(10),
            Enabled = true,
            DeadlineOffsetHours = deadlineOffsetHours,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };
        db.WeeklyCheckInSettings.Add(setting);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return setting;
    }

    private async Task<WeeklyCheckIn> InsertCheckInAsync(
        Guid clientUserId,
        Guid trainerUserId,
        WeeklyCheckInStatus status = WeeklyCheckInStatus.Pending,
        DateTime? dueAt = null,
        DateTime? respondedAt = null,
        DateTime? dismissedAt = null,
        DateTime? reviewedAt = null,
        DateTime? expiredAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        // use a future week to avoid collisions with other tests
        var monday = today.AddDays(-days).AddDays(7);

        var sentAt = DateTime.UtcNow.AddHours(-1);
        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = trainerUserId,
            Profession = Profession.Training,
            WeekStartDate = monday,
            SentAt = sentAt,
            Status = status,
            DueAt = dueAt,
            RespondedAt = respondedAt,
            DismissedByClientAt = dismissedAt,
            ReviewedByTrainerAt = reviewedAt,
            ExpiredAt = expiredAt,
            DateCreated = sentAt,
            DateModified = sentAt
        };
        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn;
    }

    private async Task<(HttpClient Http, Guid ClientUserId)>
        SetupAuthenticatedClientAsync(Guid existingClientUserId = default)
    {
        // This overload is used when we need the authenticated HTTP client for a specific user.
        // We create a fresh registration + login tied to the seeded userId.
        // The factory uses Testcontainers so every test runs against the same DB.
        var http = factory.CreateClient();
        var email = UniqueEmail("auth-client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Auth", "Client", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email,
            TestContext.Current.CancellationToken);

        return (http, user.Id);
    }

    private static DateOnly NextWeekMonday()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysFromMonday = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return today.AddDays(-daysFromMonday + 7);
    }

    // ── DueAt stamping at creation ────────────────────────────────────────────

    [Fact]
    public async Task Scheduler_OnCreate_StampsDueAt_WithDefaultOffset()
    {
        // Arrange: trainer with setting using default 72h offset
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientAsync("dt1", "dc1");
        await CreateSettingAsync(trainerUserId, deadlineOffsetHours: 72);

        // Position the scheduler to fire Monday 10:00 UTC
        var now = DateTime.UtcNow;
        var daysToLastMonday = ((int)now.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var fireAt = now.Date.AddDays(-daysToLastMonday).AddHours(10);
        if (fireAt >= now) fireAt = fireAt.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();
        scheduler.ResetCursor();
        scheduler.SetLastTickAt(fireAt.AddHours(-1));
        scheduler.OverrideNow = fireAt.AddMinutes(5);

        // Act
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Assert
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var checkIn = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        checkIn.Should().NotBeNull("scheduler must have created a check-in");
        checkIn!.DueAt.Should().NotBeNull("DueAt must be stamped");
        checkIn.DueAt!.Value.Should().BeCloseTo(
            fireAt.AddMinutes(5).AddHours(72),
            precision: TimeSpan.FromSeconds(10),
            because: "DueAt = SentAt + 72h default offset");
        checkIn.Status.Should().Be(WeeklyCheckInStatus.Pending);
    }

    [Fact]
    public async Task Scheduler_OnCreate_StampsDueAt_WithCustomOffset()
    {
        // Arrange: trainer with setting using custom 24h offset
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientAsync("dt2", "dc2");
        await CreateSettingAsync(trainerUserId, deadlineOffsetHours: 24);

        var now = DateTime.UtcNow;
        var daysToLastMonday = ((int)now.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var fireAt = now.Date.AddDays(-daysToLastMonday).AddHours(10);
        if (fireAt >= now) fireAt = fireAt.AddDays(-7);
        // prevent collision with other tests by adjusting by 11 minutes
        fireAt = fireAt.AddMinutes(11);
        if (fireAt >= now) fireAt = fireAt.AddDays(-7).AddMinutes(11);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();
        scheduler.ResetCursor();
        scheduler.SetLastTickAt(fireAt.AddHours(-1));
        scheduler.OverrideNow = fireAt.AddMinutes(5);

        // Act
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Assert
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var checkIn = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        checkIn.Should().NotBeNull("scheduler must have created a check-in");
        checkIn!.DueAt.Should().NotBeNull("DueAt must be stamped with custom 24h offset");
        checkIn.DueAt!.Value.Should().BeCloseTo(
            scheduler.OverrideNow.Value.AddHours(24),
            precision: TimeSpan.FromSeconds(10),
            because: "DueAt = SentAt + 24h custom offset");
    }

    // ── SweepExpiredAsync behavior ─────────────────────────────────────────────

    [Fact]
    public async Task Sweeper_TransitionsPastDuePending_ToExpired()
    {
        // Arrange: a Pending check-in with DueAt in the past
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientAsync("sw1t", "sw1c");
        var checkIn = await InsertCheckInAsync(
            clientUserId, trainerUserId,
            status: WeeklyCheckInStatus.Pending,
            dueAt: DateTime.UtcNow.AddHours(-1));

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // Act
        await scheduler.SweepExpiredAsync(DateTime.UtcNow, TestContext.Current.CancellationToken);

        // Assert
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var updated = await db.WeeklyCheckIns
            .FirstOrDefaultAsync(c => c.Id == checkIn.Id, TestContext.Current.CancellationToken);

        updated!.Status.Should().Be(WeeklyCheckInStatus.Expired, "past-due Pending rows must be expired");
        updated.ExpiredAt.Should().NotBeNull("ExpiredAt must be set when transitioning to Expired");
    }

    [Fact]
    public async Task Sweeper_LeavesTerminalStatesAlone()
    {
        // Arrange: one row in each terminal state with DueAt in the past
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientAsync("sw2t", "sw2c");
        var now = DateTime.UtcNow;
        var pastDue = now.AddHours(-2);

        // We need distinct week start dates to avoid unique-index violations.
        // Use separate helpers per row.
        var respondedCheckIn = await InsertCheckInWithWeekAsync(
            clientUserId, trainerUserId, DateOnly.FromDateTime(now).AddDays(7),
            WeeklyCheckInStatus.Responded, pastDue, respondedAt: now.AddHours(-1));

        var dismissedCheckIn = await InsertCheckInWithWeekAsync(
            clientUserId, trainerUserId, DateOnly.FromDateTime(now).AddDays(14),
            WeeklyCheckInStatus.Dismissed, pastDue, dismissedAt: now.AddHours(-1));

        var reviewedCheckIn = await InsertCheckInWithWeekAsync(
            clientUserId, trainerUserId, DateOnly.FromDateTime(now).AddDays(21),
            WeeklyCheckInStatus.Reviewed, pastDue, reviewedAt: now.AddHours(-1));

        var alreadyExpiredCheckIn = await InsertCheckInWithWeekAsync(
            clientUserId, trainerUserId, DateOnly.FromDateTime(now).AddDays(28),
            WeeklyCheckInStatus.Expired, pastDue, expiredAt: now.AddHours(-1));

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // Act
        await scheduler.SweepExpiredAsync(now, TestContext.Current.CancellationToken);

        // Assert: all terminal states unchanged
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var ids = new[] { respondedCheckIn.Id, dismissedCheckIn.Id, reviewedCheckIn.Id, alreadyExpiredCheckIn.Id };
        var rows = await db.WeeklyCheckIns
            .Where(c => ids.Contains(c.Id))
            .ToListAsync(TestContext.Current.CancellationToken);

        rows.First(r => r.Id == respondedCheckIn.Id).Status.Should().Be(WeeklyCheckInStatus.Responded);
        rows.First(r => r.Id == dismissedCheckIn.Id).Status.Should().Be(WeeklyCheckInStatus.Dismissed);
        rows.First(r => r.Id == reviewedCheckIn.Id).Status.Should().Be(WeeklyCheckInStatus.Reviewed);
        rows.First(r => r.Id == alreadyExpiredCheckIn.Id).Status.Should().Be(WeeklyCheckInStatus.Expired);
    }

    [Fact]
    public async Task Sweeper_IsIdempotent()
    {
        // Arrange: one past-due Pending check-in
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientAsync("sw3t", "sw3c");
        var checkIn = await InsertCheckInAsync(
            clientUserId, trainerUserId,
            status: WeeklyCheckInStatus.Pending,
            dueAt: DateTime.UtcNow.AddHours(-2));

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();
        var firstSweepNow = DateTime.UtcNow;

        // Act: run sweep twice
        await scheduler.SweepExpiredAsync(firstSweepNow, TestContext.Current.CancellationToken);
        await scheduler.SweepExpiredAsync(DateTime.UtcNow.AddMinutes(5), TestContext.Current.CancellationToken);

        // Assert: ExpiredAt is from the FIRST sweep, not overwritten
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var updated = await db.WeeklyCheckIns
            .FirstOrDefaultAsync(c => c.Id == checkIn.Id, TestContext.Current.CancellationToken);

        updated!.Status.Should().Be(WeeklyCheckInStatus.Expired);
        updated.ExpiredAt.Should().BeCloseTo(firstSweepNow, precision: TimeSpan.FromSeconds(10),
            because: "second sweep must NOT overwrite ExpiredAt — idempotency guard");
    }

    // ── GetCurrentClientCheckIns excludes Expired ──────────────────────────────

    [Fact]
    public async Task GetCurrentClientCheckIns_FiltersExpiredOut()
    {
        // Arrange: one Pending + one Expired check-in for the current week
        var (clientHttp, clientUserId) = await SetupAuthenticatedClientAsync();
        var (trainerUserId, _) = await SetupTrainerAndClientAsync("gcf-t", "gcf-c2");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var thisMonday = today.AddDays(-days);

        using var insertScope = factory.Services.CreateScope();
        var db = insertScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Pending check-in (should appear)
        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = trainerUserId,
            Profession = Profession.Training,
            WeekStartDate = thisMonday,
            SentAt = DateTime.UtcNow.AddHours(-3),
            DueAt = DateTime.UtcNow.AddHours(69),
            Status = WeeklyCheckInStatus.Pending,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });

        // Second trainer for Expired check-in
        var (trainerUserId2, _) = await SetupTrainerAndClientAsync("gcf-t2", "gcf-c3");

        // Expired check-in (must NOT appear)
        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = trainerUserId2,
            Profession = Profession.Nutrition,
            WeekStartDate = thisMonday,
            SentAt = DateTime.UtcNow.AddHours(-80),
            DueAt = DateTime.UtcNow.AddHours(-8),
            Status = WeeklyCheckInStatus.Expired,
            ExpiredAt = DateTime.UtcNow.AddHours(-8),
            DateCreated = DateTime.UtcNow.AddHours(-80),
            DateModified = DateTime.UtcNow.AddHours(-8)
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var response = await clientHttp.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().HaveCount(1, "expired check-in must be filtered out by the server");
        body.CheckIns[0].Profession.Should().Be("Training", "only the Pending Training check-in should appear");
    }

    // ── 409 on Expired rows ───────────────────────────────────────────────────

    [Fact]
    public async Task Respond_OnExpired_Returns409()
    {
        // Arrange: authenticated client + expired check-in in DB
        var (clientHttp, clientUserId) = await SetupAuthenticatedClientAsync();
        var (trainerUserId, _) = await SetupTrainerAndClientAsync("re1t", "re1c");

        var expiredCheckIn = await InsertCheckInForClientAsync(
            clientUserId, trainerUserId,
            WeeklyCheckInStatus.Expired,
            dueAt: DateTime.UtcNow.AddHours(-1));

        // Act
        var response = await clientHttp.PostAsJsonAsync(
            $"/client/weekly-check-ins/{expiredCheckIn.Id}/respond",
            new { Flags = new string[0], Note = (string?)null },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, "responding to an expired check-in must return 409");
    }

    [Fact]
    public async Task Dismiss_OnExpired_Returns409()
    {
        // Arrange: authenticated client + expired check-in
        var (clientHttp, clientUserId) = await SetupAuthenticatedClientAsync();
        var (trainerUserId, _) = await SetupTrainerAndClientAsync("de1t", "de1c");

        var expiredCheckIn = await InsertCheckInForClientAsync(
            clientUserId, trainerUserId,
            WeeklyCheckInStatus.Expired,
            dueAt: DateTime.UtcNow.AddHours(-1));

        // Act
        var response = await clientHttp.PostAsJsonAsync(
            $"/client/weekly-check-ins/{expiredCheckIn.Id}/dismiss",
            new { },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, "dismissing an expired check-in must return 409");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Inserts a check-in using the NEXT Monday + N-week offset to avoid unique-index
    /// collisions between tests that share the same client + trainer pair.
    /// </summary>
    private async Task<WeeklyCheckIn> InsertCheckInWithWeekAsync(
        Guid clientUserId,
        Guid professionalUserId,
        DateOnly weekStartDate,
        WeeklyCheckInStatus status,
        DateTime? dueAt,
        DateTime? respondedAt = null,
        DateTime? dismissedAt = null,
        DateTime? reviewedAt = null,
        DateTime? expiredAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var sentAt = DateTime.UtcNow.AddHours(-2);
        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = Profession.Training,
            WeekStartDate = weekStartDate,
            SentAt = sentAt,
            Status = status,
            DueAt = dueAt,
            RespondedAt = respondedAt,
            DismissedByClientAt = dismissedAt,
            ReviewedByTrainerAt = reviewedAt,
            ExpiredAt = expiredAt,
            DateCreated = sentAt,
            DateModified = sentAt
        };
        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn;
    }

    /// <summary>
    /// Inserts a check-in that belongs to the authenticated client user (for endpoint tests).
    /// Uses a unique (next+2) Monday to avoid collisions.
    /// </summary>
    private async Task<WeeklyCheckIn> InsertCheckInForClientAsync(
        Guid clientUserId,
        Guid professionalUserId,
        WeeklyCheckInStatus status,
        DateTime? dueAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysFromMonday = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var monday = today.AddDays(-daysFromMonday + 14); // two weeks ahead to avoid collisions

        var sentAt = DateTime.UtcNow.AddHours(-3);
        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = Profession.Training,
            WeekStartDate = monday,
            SentAt = sentAt,
            Status = status,
            DueAt = dueAt ?? sentAt.AddHours(-1),
            ExpiredAt = status == WeeklyCheckInStatus.Expired ? DateTime.UtcNow.AddHours(-1) : null,
            DateCreated = sentAt,
            DateModified = sentAt
        };
        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn;
    }

    // ── Local DTOs ─────────────────────────────────────────────────────────────
    private record CheckInsWrapper(List<CheckInDto> CheckIns);
    private record CheckInDto(Guid Id, Guid ProfessionalUserId, string ProfessionalName, string Profession, DateOnly WeekStartDate, DateTime SentAt);
}
