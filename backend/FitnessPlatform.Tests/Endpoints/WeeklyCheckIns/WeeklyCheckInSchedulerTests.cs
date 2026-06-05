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

    // ── Sub-hour precision tests ──────────────────────────────────────────────

    /// <summary>
    /// AC: a setting configured at a non-hour time (18:30) fires when the scheduler
    /// ticks past that minute boundary.
    /// </summary>
    [Fact]
    public async Task Tick_NonHourFireTime_18h30_CreatesCheckIn()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Wednesday,
            new TimeSpan(18, 30, 0), // 18:30:00 UTC
            "UTC");

        var utcNow = DateTime.UtcNow;
        var daysToLastWed = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Wednesday + 7) % 7;
        var lastWed1830 = utcNow.Date.AddDays(-daysToLastWed)
                                     .AddHours(18).AddMinutes(30);
        if (lastWed1830 >= utcNow) lastWed1830 = lastWed1830.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // Position cursor just before the fire time so 18:30 is in the upcoming window.
        scheduler.SetLastTickAt(lastWed1830.AddMinutes(-10));

        // Tick just after 18:30 — scheduler must fire.
        scheduler.OverrideNow = lastWed1830.AddMinutes(3);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIns = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkIns.Should().HaveCount(1,
            "a non-hour fire time (18:30) must trigger exactly one check-in when the window crosses it");
    }

    /// <summary>
    /// AC: a setting configured at 09:15 fires correctly.
    /// </summary>
    [Fact]
    public async Task Tick_NonHourFireTime_09h15_CreatesCheckIn()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Thursday,
            new TimeSpan(9, 15, 0), // 09:15:00 UTC
            "UTC");

        var utcNow = DateTime.UtcNow;
        var daysToLastThu = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Thursday + 7) % 7;
        var lastThu0915 = utcNow.Date.AddDays(-daysToLastThu)
                                      .AddHours(9).AddMinutes(15);
        if (lastThu0915 >= utcNow) lastThu0915 = lastThu0915.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        scheduler.SetLastTickAt(lastThu0915.AddMinutes(-10));
        scheduler.OverrideNow = lastThu0915.AddMinutes(5);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIns = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkIns.Should().HaveCount(1,
            "a non-hour fire time (09:15) must trigger exactly one check-in when the window crosses it");
    }

    /// <summary>
    /// AC: multiple sub-hour ticks within the same fire window do NOT produce duplicate check-ins.
    /// The unique-key dedup (23505 catch) must hold even when ticking every few minutes.
    /// </summary>
    [Fact]
    public async Task Tick_MultipleSubHourTicksAcrossSameFireMinute_DoesNotDuplicate()
    {
        var (trainerUserId, clientUserId) = await SetupTrainerAndClientWithSettingAsync(
            DayOfWeek.Monday,
            new TimeSpan(14, 30, 0), // 14:30:00 UTC
            "UTC");

        var utcNow = DateTime.UtcNow;
        var daysToLastMon = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var lastMon1430 = utcNow.Date.AddDays(-daysToLastMon)
                                      .AddHours(14).AddMinutes(30);
        if (lastMon1430 >= utcNow) lastMon1430 = lastMon1430.AddDays(-7);

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        // Tick before fire time — nothing should fire.
        scheduler.SetLastTickAt(lastMon1430.AddMinutes(-10));
        scheduler.OverrideNow = lastMon1430.AddMinutes(-5);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // First tick past 14:30 — fires once.
        scheduler.OverrideNow = lastMon1430.AddMinutes(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Second tick — still within same week's window; unique key prevents duplicate.
        scheduler.OverrideNow = lastMon1430.AddMinutes(6);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Third tick — still same week.
        scheduler.OverrideNow = lastMon1430.AddMinutes(11);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIns = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientUserId && c.ProfessionalUserId == trainerUserId)
            .ToListAsync(TestContext.Current.CancellationToken);

        checkIns.Should().HaveCount(1,
            "multiple sub-hour ticks across the same fire minute must produce exactly one check-in " +
            "— the half-open window + unique-key dedup together prevent duplication");
    }

    /// <summary>
    /// Regression test for the EF Core change-tracker cascade (issue #280).
    ///
    /// When two candidates (clients A and B linked to the same trainer) are processed
    /// in the same tick and the FIRST candidate's WeeklyCheckIn insert violates the
    /// unique constraint (Postgres 23505), the SECOND candidate must still receive its
    /// check-in row, in-app notification, and push notification.
    ///
    /// Before the fix: the catch block called db.WeeklyCheckIns.Remove(checkIn) on a
    /// never-persisted entity, leaving the shared DbContext's change tracker in a
    /// corrupted state.  The second candidate's SaveChanges would then fail with a
    /// cascade exception.
    ///
    /// After the fix: each candidate runs inside its own IServiceScope / IApplicationDbContext,
    /// so a failed SaveChanges disposes that scope and the next candidate starts clean.
    /// </summary>
    [Fact]
    public async Task Tick_UniqueViolationOnFirstCandidate_DoesNotCascadeToSecondCandidate()
    {
        // Arrange: one trainer with two clients, both fire at the same UTC time (Friday 14:00 UTC).
        var utcNow = DateTime.UtcNow;
        var daysToLastFriday = ((int)utcNow.DayOfWeek - (int)DayOfWeek.Friday + 7) % 7;
        var lastFriday = utcNow.Date.AddDays(-daysToLastFriday).AddHours(14);
        if (lastFriday >= utcNow) lastFriday = lastFriday.AddDays(-7);

        var weekStartDate = WeeklyCheckInScheduler.NextIsoMonday(lastFriday);

        // Register trainer
        var trainerEmail = UniqueEmail("cascade-trainer");
        var trainerHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(trainerHttp, trainerEmail, "TestPass1!", "Cascade", "Trainer", "Trainer");

        // Register client A
        var clientAEmail = UniqueEmail("cascade-clientA");
        var clientAHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(clientAHttp, clientAEmail, "TestPass1!", "Cascade", "ClientA", "Client");

        // Register client B
        var clientBEmail = UniqueEmail("cascade-clientB");
        var clientBHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(clientBHttp, clientBEmail, "TestPass1!", "Cascade", "ClientB", "Client");

        Guid trainerUserId, clientAId, clientBId;

        using (var setupScope = factory.Services.CreateScope())
        {
            var setupDb = setupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var trainerUser = await setupDb.Users.FirstAsync(
                u => u.Email == trainerEmail, TestContext.Current.CancellationToken);
            var clientAUser = await setupDb.Users.FirstAsync(
                u => u.Email == clientAEmail, TestContext.Current.CancellationToken);
            var clientBUser = await setupDb.Users.FirstAsync(
                u => u.Email == clientBEmail, TestContext.Current.CancellationToken);

            trainerUserId = trainerUser.Id;
            clientAId = clientAUser.Id;
            clientBId = clientBUser.Id;

            // Set timezone to UTC so fire time = 14:00 UTC directly.
            trainerUser.TimeZone = "UTC";

            var profProfile = await setupDb.ProfessionalProfiles.FirstAsync(
                p => p.UserId == trainerUserId, TestContext.Current.CancellationToken);

            var clientAProfile = await setupDb.ClientProfiles.FirstAsync(
                cp => cp.UserId == clientAId, TestContext.Current.CancellationToken);
            var clientBProfile = await setupDb.ClientProfiles.FirstAsync(
                cp => cp.UserId == clientBId, TestContext.Current.CancellationToken);

            // Link both clients to trainer.
            setupDb.ClientProfessionalLinks.Add(new ClientProfessionalLink
            {
                PublicId = Guid.NewGuid(),
                ProfessionalProfileId = profProfile.Id,
                ClientProfileId = clientAProfile.Id,
                ProfessionalRole = UserRole.Trainer,
                IsActive = true,
                CanViewTrainingPlans = true,
                CanViewNutritionPlans = false,
                DateCreated = DateTime.UtcNow
            });
            setupDb.ClientProfessionalLinks.Add(new ClientProfessionalLink
            {
                PublicId = Guid.NewGuid(),
                ProfessionalProfileId = profProfile.Id,
                ClientProfileId = clientBProfile.Id,
                ProfessionalRole = UserRole.Trainer,
                IsActive = true,
                CanViewTrainingPlans = true,
                CanViewNutritionPlans = false,
                DateCreated = DateTime.UtcNow
            });

            // One setting fires every Friday at 14:00 UTC.
            setupDb.WeeklyCheckInSettings.Add(new WeeklyCheckInSetting
            {
                UserId = trainerUserId,
                Profession = Profession.Training,
                DayOfWeek = DayOfWeek.Friday,
                TimeOfDay = TimeSpan.FromHours(14),
                Enabled = true,
                DateCreated = DateTime.UtcNow,
                DateModified = DateTime.UtcNow
            });

            await setupDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Pre-seed a WeeklyCheckIn row for client A's (ClientUserId, ProfessionalUserId, Profession,
        // WeekStartDate) so that A's insert will hit the 23505 unique violation.
        using (var seedScope = factory.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            seedDb.WeeklyCheckIns.Add(new WeeklyCheckIn
            {
                ClientUserId = clientAId,
                ProfessionalUserId = trainerUserId,
                Profession = Profession.Training,
                WeekStartDate = weekStartDate,
                SentAt = lastFriday.AddHours(-1),   // pre-existing row for this week
                DateCreated = lastFriday.AddHours(-1),
                DateModified = lastFriday.AddHours(-1)
            });
            await seedDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var push = factory.Services.GetRequiredService<FakePushNotificationService>();
        push.Reset();

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();
        scheduler.ResetCursor();

        // Position cursor one hour before fire time so Friday 14:00 UTC is in the window.
        scheduler.SetLastTickAt(lastFriday.AddHours(-1));
        scheduler.OverrideNow = lastFriday.AddMinutes(30);

        // Act — one tick processes both candidates (A hits 23505, B must succeed).
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Assert
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Candidate A: only the pre-seeded row remains — duplicate was rejected cleanly.
        var checkInsForA = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientAId
                        && c.ProfessionalUserId == trainerUserId
                        && c.WeekStartDate == weekStartDate)
            .ToListAsync(TestContext.Current.CancellationToken);
        checkInsForA.Should().HaveCount(1,
            "candidate A had a pre-existing row — the unique violation must be swallowed, " +
            "not crash the scheduler, and the existing row must not be deleted");

        // Candidate B: check-in row must be inserted (no cascade from A's failure).
        var checkInsForB = await db.WeeklyCheckIns
            .Where(c => c.ClientUserId == clientBId
                        && c.ProfessionalUserId == trainerUserId
                        && c.WeekStartDate == weekStartDate)
            .ToListAsync(TestContext.Current.CancellationToken);
        checkInsForB.Should().HaveCount(1,
            "candidate B's check-in insert must succeed despite A's 23505 violation");

        // Candidate B: in-app notification must be created.
        var notificationForB = await db.Notifications
            .Where(n => n.RecipientUserId == clientBId
                        && n.Type == NotificationType.WeeklyCheckInRequested)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
        notificationForB.Should().NotBeNull(
            "candidate B's in-app notification must be persisted — it must not be affected by A's failure");

        // Candidate A: no new in-app notification (check-in was skipped as duplicate).
        var notificationForA = await db.Notifications
            .Where(n => n.RecipientUserId == clientAId
                        && n.Type == NotificationType.WeeklyCheckInRequested)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
        notificationForA.Should().BeNull(
            "candidate A's notification must NOT be created — the check-in was a duplicate and was skipped");

        // Push must be invoked exactly once (for candidate B only).
        var cascadePushCalls = push.Calls
            .Where(c => c.UserId == clientAId || c.UserId == clientBId)
            .ToList();
        cascadePushCalls.Should().HaveCount(1,
            "push must be sent for candidate B only — candidate A's check-in was a duplicate");
        cascadePushCalls[0].UserId.Should().Be(clientBId,
            "the push must target candidate B's client");

        // SignalR broadcast must fire exactly once (for candidate B's newnotification).
        var newNotificationCalls = notifier.Calls
            .Where(c => (c.UserId == clientAId || c.UserId == clientBId)
                        && c.EventType == "newnotification")
            .ToList();
        newNotificationCalls.Should().HaveCount(1,
            "newnotification must be broadcast once (for candidate B) — candidate A was skipped");
        newNotificationCalls[0].UserId.Should().Be(clientBId);
    }
}
