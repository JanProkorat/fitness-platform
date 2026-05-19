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
/// Integration tests for <see cref="WeeklyCheckInScheduler"/> using a virtual clock.
/// Uses Testcontainers PostgreSQL + MongoDB (Docker required). Excluded from CI.
/// </summary>
[Collection(TestCollection.Name)]
public class WeeklyCheckInSchedulerTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "scheduler") =>
        $"{Guid.NewGuid():N}@{tag}-test.com";

    /// <summary>
    /// Sets up a trainer user and an enabled weekly check-in setting for Training profession.
    /// Returns the trainer UserId and the setting.
    /// </summary>
    private async Task<(Guid TrainerUserId, Guid ClientUserId)>
        SetupTrainerAndClientWithSettingAsync(
            DayOfWeek dayOfWeek = DayOfWeek.Monday,
            TimeSpan? timeOfDay = null,
            string timeZone = "Europe/Prague")
    {
        // Register trainer
        var trainerEmail = UniqueEmail("trainer");
        var trainerHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(trainerHttp, trainerEmail, "TestPass1!", "Sched", "Trainer", "Trainer");

        // Register client
        var clientEmail = UniqueEmail("client");
        var clientHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, "TestPass1!", "Sched", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var trainerUser = await db.Users.FirstAsync(
            u => u.Email == trainerEmail, TestContext.Current.CancellationToken);
        var clientUser = await db.Users.FirstAsync(
            u => u.Email == clientEmail, TestContext.Current.CancellationToken);

        // Set timezone on trainer.
        trainerUser.TimeZone = timeZone;

        // Get professional profile (auto-created on registration).
        var profProfile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == trainerUser.Id, TestContext.Current.CancellationToken);

        // Get client profile.
        var clientProfile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == clientUser.Id, TestContext.Current.CancellationToken);

        // Link client to trainer.
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

        // Create the setting.
        db.WeeklyCheckInSettings.Add(new WeeklyCheckInSetting
        {
            UserId = trainerUser.Id,
            Profession = Profession.Training,
            DayOfWeek = dayOfWeek,
            TimeOfDay = timeOfDay ?? TimeSpan.FromHours(18),
            Enabled = true,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (trainerUser.Id, clientUser.Id);
    }

    // ── Core scheduler behavior ───────────────────────────────────────────────

    [Fact]
    public async Task Tick_PastFireTime_CreatesExactlyOneCheckIn()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Monday,
            TimeSpan.FromHours(18),
            "Europe/Prague");

        // Europe/Prague is UTC+2 in summer (CEST).
        // Monday 18:00 Prague = Monday 16:00 UTC.
        // So if "now" is just after Monday 16:00 UTC, the scheduler should fire.

        // Find the last (past) Monday at 16:00 UTC.
        var utcNow = DateTime.UtcNow;
        var daysToLastMonday = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var lastMonday = utcNow.Date.AddDays(-daysToLastMonday);
        // 18:00 Prague CEST = 16:00 UTC
        var fireAt = lastMonday.AddHours(16);
        // Ensure fireAt is in the past (back it up a week if today is exactly Monday 16:00 UTC).
        if (fireAt >= utcNow) fireAt = fireAt.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // Set cursor to just before the fire time so it falls within the window.
        scheduler.OverrideNow = fireAt.AddMinutes(-60);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Now tick PAST the fire time.
        scheduler.OverrideNow = fireAt.AddMinutes(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIns = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkIns.Should().HaveCount(1);
        checkIns[0].SentAt.Should().BeCloseTo(scheduler.OverrideNow!.Value, precision: TimeSpan.FromSeconds(5));

        // WeekStartDate should be the Monday of the NEXT ISO week after the fire moment.
        var expectedWeekStart = WeeklyCheckInScheduler.NextIsoMonday(fireAt);
        checkIns[0].WeekStartDate.Should().Be(expectedWeekStart);
    }

    [Fact]
    public async Task Tick_SameFireTime_Twice_DoesNotDuplicate()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Tuesday,
            TimeSpan.FromHours(10),
            "UTC");

        // Tuesday 10:00 UTC. Find last Tuesday.
        var utcNow = DateTime.UtcNow;
        var daysToLastTuesday = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Tuesday + 7) % 7;
        var lastTuesday = utcNow.Date.AddDays(-daysToLastTuesday).AddHours(10);
        if (lastTuesday >= utcNow) lastTuesday = lastTuesday.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // First tick: before fire.
        scheduler.OverrideNow = lastTuesday.AddMinutes(-5);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Second tick: past fire time → should create 1 check-in.
        scheduler.OverrideNow = lastTuesday.AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Third tick: same window → unique-index prevents duplication.
        scheduler.OverrideNow = lastTuesday.AddMinutes(45);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIns = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkIns.Should().HaveCount(1, "unique-index must prevent duplicates even across multiple ticks");
    }

    [Fact]
    public async Task Tick_CreatesNotificationRow()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Wednesday,
            TimeSpan.FromHours(9),
            "UTC");

        var utcNow = DateTime.UtcNow;
        var daysToLastWed = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Wednesday + 7) % 7;
        var lastWed = utcNow.Date.AddDays(-daysToLastWed).AddHours(9);
        if (lastWed >= utcNow) lastWed = lastWed.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        scheduler.OverrideNow = lastWed.AddMinutes(-30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        scheduler.OverrideNow = lastWed.AddMinutes(5);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var notification = await db.Notifications
            .Where(n =>
                n.RecipientUserId == clientUserId &&
                n.Type == NotificationType.WeeklyCheckInRequested)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        notification.Should().NotBeNull("the scheduler must create a WeeklyCheckInRequested notification");
    }

    /// <summary>
    /// Regression test for the EF-tracker cascade bug: if candidate A's insert hits a
    /// 23505 unique-violation, the per-candidate scope is disposed (EF tracker reset),
    /// and candidate B must still receive its check-in row and notification.
    ///
    /// This test is RED against the pre-fix scheduler (which shared a single DbContext
    /// and called db.WeeklyCheckIns.Remove() on a never-persisted entity, leaving the
    /// tracker corrupted) and GREEN against the fixed per-candidate-scope scheduler.
    /// </summary>
    [Fact]
    public async Task Tick_DuplicateCheckIn_DoesNotCascadeToNextCandidate()
    {
        // ── Arrange: two trainer+client pairs with overlapping fire times ─────────
        var (trainerAId, clientAId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Friday,
            TimeSpan.FromHours(14),
            "UTC");

        var (trainerBId, clientBId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Friday,
            TimeSpan.FromHours(14),
            "UTC");

        // Friday 14:00 UTC. Find the last Friday.
        var utcNow = DateTime.UtcNow;
        var daysToLastFriday = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Friday + 7) % 7;
        var lastFriday = utcNow.Date.AddDays(-daysToLastFriday).AddHours(14);
        if (lastFriday >= utcNow) lastFriday = lastFriday.AddDays(-7);

        var weekStartDate = WeeklyCheckInScheduler.NextIsoMonday(lastFriday);

        // Pre-seed a WeeklyCheckIn row for candidate A so its insert will hit the unique
        // constraint (23505) when the scheduler tries to insert the same tuple.
        using (var seedScope = factory.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            seedDb.WeeklyCheckIns.Add(new WeeklyCheckIn
            {
                ClientUserId = clientAId,
                ProfessionalUserId = trainerAId,
                Profession = Profession.Training,
                WeekStartDate = weekStartDate,
                SentAt = lastFriday.AddHours(-1), // earlier timestamp — same unique key
                DateCreated = lastFriday.AddHours(-1),
                DateModified = lastFriday.AddHours(-1)
            });
            await seedDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to just before fire time so the window covers the fire moment.
        scheduler.OverrideNow = lastFriday.AddMinutes(-60);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // ── Act: tick past the fire time — candidate A collides, candidate B should succeed
        scheduler.OverrideNow = lastFriday.AddMinutes(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // ── Assert ────────────────────────────────────────────────────────────────
        using var assertScope = factory.Services.CreateScope();
        var assertDb = assertScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Candidate A: still exactly one row (the pre-seeded one; scheduler skipped the duplicate).
        var checkInsA = await assertDb.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientAId && c.ProfessionalUserId == trainerAId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkInsA.Should().HaveCount(1,
            "candidate A already had a row; the scheduler must skip the duplicate without crashing");

        // Candidate B: must have exactly one newly created row.
        var checkInsB = await assertDb.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientBId && c.ProfessionalUserId == trainerBId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkInsB.Should().HaveCount(1,
            "candidate B must not be affected by candidate A's unique-violation");

        // Candidate B must also have a Notification row.
        var notificationB = await assertDb.Notifications
            .Where(n =>
                n.RecipientUserId == clientBId &&
                n.Type == NotificationType.WeeklyCheckInRequested)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        notificationB.Should().NotBeNull(
            "candidate B's notification must persist even when candidate A's insert collided");
    }

    [Fact]
    public async Task Tick_BroadcastsViaSignalR()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Thursday,
            TimeSpan.FromHours(20),
            "UTC");

        var utcNow = DateTime.UtcNow;
        var daysToLastThu = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Thursday + 7) % 7;
        var lastThu = utcNow.Date.AddDays(-daysToLastThu).AddHours(20);
        if (lastThu >= utcNow) lastThu = lastThu.AddDays(-7);

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        scheduler.OverrideNow = lastThu.AddMinutes(-60);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        scheduler.OverrideNow = lastThu.AddMinutes(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        var newNotificationCalls = notifier.Calls
            .Where(c => c.UserId == clientUserId && c.EventType == "newnotification")
            .ToList();

        newNotificationCalls.Should().HaveCount(1,
            "scheduler must broadcast exactly one newnotification to the client");
    }
}
