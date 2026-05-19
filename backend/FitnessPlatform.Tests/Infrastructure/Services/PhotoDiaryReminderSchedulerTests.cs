using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Integration tests for <see cref="PhotoDiaryReminderScheduler"/> using a virtual clock.
/// Uses Testcontainers PostgreSQL + MongoDB (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class PhotoDiaryReminderSchedulerTests(FitnessApiFactory factory)
{
    // ── Helper: unique emails ──────────────────────────────────────────────────

    private static string UniqueEmail(string tag = "sched") =>
        $"{Guid.NewGuid():N}@{tag}-reminder-test.com";

    // ── Setup: register nutritionist + client, link them, insert diary request ─

    /// <summary>
    /// Creates a nutritionist and a client, links them, and inserts a workflow-mode
    /// PhotoDiaryRequest with the given status and acceptedAt.
    /// Returns the nutritionist UserId, client UserId, and the diary request Id.
    /// </summary>
    private async Task<(Guid ProfessionalId, Guid ClientUserId, Guid RequestId, long LinkId)>
        SetupWorkflowRequestAsync(
            PhotoDiaryStatus status = PhotoDiaryStatus.Accepted,
            DateTimeOffset? acceptedAt = null,
            int durationDays = 7,
            string clientTimeZone = "Europe/Prague")
    {
        var profEmail = UniqueEmail("prof");
        var clientEmail = UniqueEmail("client");

        var profHttp = factory.CreateClient();
        var clientHttp = factory.CreateClient();

        await TestHelpers.RegisterAsync(profHttp, profEmail, "TestPass1!", "Nutritionist", "Reminder", "Nutritionist");
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, "TestPass1!", "Client", "Reminder", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var profUser = await db.Users.FirstAsync(u => u.Email == profEmail, TestContext.Current.CancellationToken);
        var clientUser = await db.Users.FirstAsync(u => u.Email == clientEmail, TestContext.Current.CancellationToken);

        // Set client timezone
        clientUser.TimeZone = clientTimeZone;

        var profProfile = await db.ProfessionalProfiles
            .FirstAsync(p => p.UserId == profUser.Id, TestContext.Current.CancellationToken);
        var clientProfile = await db.ClientProfiles
            .FirstAsync(p => p.UserId == clientUser.Id, TestContext.Current.CancellationToken);

        // Link client to nutritionist
        var link = new ClientProfessionalLink
        {
            ClientProfileId = clientProfile.Id,
            ProfessionalProfileId = profProfile.Id,
            ProfessionalRole = UserRole.Nutritionist,
            IsActive = true,
            CanViewNutritionPlans = true,
            CanViewTrainingPlans = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        db.ClientProfessionalLinks.Add(link);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Insert the diary request
        var now = DateTimeOffset.UtcNow;
        var resolvedAcceptedAt = acceptedAt ?? now.AddDays(-1);

        var request = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = profUser.Id,
            LinkId = link.Id,
            Mode = PhotoDiaryMode.Workflow,
            Status = status,
            DurationDays = durationDays,
            AcceptedAt = resolvedAcceptedAt,
            CompletedAt = status == PhotoDiaryStatus.Completed ? now : null,
            DismissReason = status == PhotoDiaryStatus.Dismissed ? "test" : null,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (profUser.Id, clientUser.Id, request.Id, link.Id);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Tick_BeforeNoon_DoesNotFire()
    {
        // Europe/Prague CEST (UTC+2): noon = 12:00 Prague = 10:00 UTC.
        // Seed cursor at 10:30 UTC (AFTER noon) so noon is NOT in the next tick window.
        // Use real UTC today as the virtual date and AcceptedAt = yesterday so window is valid.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date;
        var afterNoonPrague = virtualDate.AddHours(10).AddMinutes(30); // 10:30 UTC (noon Prague CEST)

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "Europe/Prague");

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to 10:30 UTC (after noon Prague = 10:00 UTC).
        scheduler.SetLastTickAt(afterNoonPrague);

        // Tick at 11:30 UTC: window is (10:30, 11:30]. Noon = 10:00 UTC is NOT in the window.
        scheduler.OverrideNow = afterNoonPrague.AddHours(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().BeEmpty("noon already passed before the tick window — reminder must not fire");
    }

    [Fact]
    public async Task Tick_AtNoon_Prague_Fires()
    {
        // Europe/Prague CEST (UTC+2): noon = 12:00 Prague = 10:00 UTC.
        // Tick window: _lastTickAt=09:00 UTC, now=10:30 UTC → noon (10:00) is inside window → FIRES.
        // Use real UTC today as the virtual date and AcceptedAt = yesterday.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date;
        var beforeNoonPrague = virtualDate.AddHours(9);   // 09:00 UTC
        var afterNoonPrague  = virtualDate.AddHours(10).AddMinutes(30); // 10:30 UTC

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "Europe/Prague");

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to 09:00 UTC (before noon Prague = 10:00 UTC).
        scheduler.SetLastTickAt(beforeNoonPrague);

        // Tick at 10:30 UTC: window (09:00, 10:30]. Noon (10:00) IS inside → FIRES.
        scheduler.OverrideNow = afterNoonPrague;
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().HaveCount(1, "noon crossed in this tick window → should fire once");

        var notification = await db.Notifications
            .Where(n => n.RecipientUserId == clientUserId && n.Type == NotificationType.PhotoDiaryReminder)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        notification.Should().NotBeNull("in-app notification must be created");

        var signalRCalls = notifier.Calls
            .Where(c => c.UserId == clientUserId && c.EventType == "newnotification")
            .ToList();

        signalRCalls.Should().HaveCount(1, "scheduler must broadcast exactly one newnotification to the client");
    }

    [Fact]
    public async Task Tick_PhotoAlreadyUploadedToday_DoesNotFire()
    {
        // If the client already uploaded a photo for the diary request today, no reminder.
        // Strategy: use real UTC time so ApplyTimestamps stamps the photo with DateCreated = today,
        // then use real UTC noon as the virtual clock.  UTC timezone = no DST offset.
        var utcNow = DateTime.UtcNow;

        // AcceptedAt = yesterday so the request is inside its 7-day window.
        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "UTC");

        using var setupScope = factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var clientProfile = await setupDb.ClientProfiles
            .FirstAsync(p => p.UserId == clientUserId, TestContext.Current.CancellationToken);

        // ApplyTimestamps will set DateCreated = real UtcNow — that's "today" in UTC.
        var photo = new PlanPhoto
        {
            ClientProfileId = clientProfile.Id,
            DiaryRequestId = requestId,
            BlobUrl = "https://example.com/photo.jpg",
            Category = PlanPhotoCategory.Food,
            TakenAt = utcNow,
            UploadedByUserId = clientUserId,
        };
        setupDb.PlanPhotos.Add(photo);
        await setupDb.SaveChangesAsync(TestContext.Current.CancellationToken);

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Virtual noon UTC = today's noon UTC.
        var noonUtcToday = utcNow.Date.AddHours(12);
        // Seed cursor to one hour before noon so noon is within the second tick window.
        var seedTime = noonUtcToday.AddHours(-1);

        scheduler.OverrideNow = seedTime;
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Tick at noon + 30 min: noon IS in window, but photo already uploaded → no reminder.
        scheduler.OverrideNow = noonUtcToday.AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().BeEmpty("client already uploaded a photo today — reminder must be skipped");
    }

    [Fact]
    public async Task Tick_StatusNotAcceptedOrInProgress_DoesNotFire()
    {
        // Completed requests are excluded by the candidate query.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date;

        var (_, _, requestId, _) = await SetupWorkflowRequestAsync(
            status: PhotoDiaryStatus.Completed,
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "Europe/Prague");

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Window: (09:00, 10:30] UTC → noon Prague (10:00) inside, but request is Completed → skip.
        scheduler.SetLastTickAt(virtualDate.AddHours(9));
        scheduler.OverrideNow = virtualDate.AddHours(10).AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().BeEmpty("Completed requests must not fire reminders");
    }

    [Fact]
    public async Task Tick_ModeBulk_DoesNotFire()
    {
        // Bulk-mode requests must not trigger the workflow reminder.
        var profEmail = UniqueEmail("bulk-prof");
        var clientEmail = UniqueEmail("bulk-client");

        var profHttp = factory.CreateClient();
        var clientHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(profHttp, profEmail, "TestPass1!", "N", "Bulk", "Nutritionist");
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, "TestPass1!", "C", "Bulk", "Client");

        using var setupScope = factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var profUser = await setupDb.Users.FirstAsync(u => u.Email == profEmail, TestContext.Current.CancellationToken);
        var clientUser = await setupDb.Users.FirstAsync(u => u.Email == clientEmail, TestContext.Current.CancellationToken);
        var profProfile = await setupDb.ProfessionalProfiles.FirstAsync(p => p.UserId == profUser.Id, TestContext.Current.CancellationToken);
        var clientProfile = await setupDb.ClientProfiles.FirstAsync(p => p.UserId == clientUser.Id, TestContext.Current.CancellationToken);

        var link = new ClientProfessionalLink
        {
            ClientProfileId = clientProfile.Id,
            ProfessionalProfileId = profProfile.Id,
            ProfessionalRole = UserRole.Nutritionist,
            IsActive = true,
            CanViewNutritionPlans = true,
            CanViewTrainingPlans = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        setupDb.ClientProfessionalLinks.Add(link);
        await setupDb.SaveChangesAsync(TestContext.Current.CancellationToken);

        var utcNowForBulk = DateTimeOffset.UtcNow;
        var bulkRequest = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = profUser.Id,
            LinkId = link.Id,
            Mode = PhotoDiaryMode.Bulk,  // ← Bulk, not Workflow
            Status = PhotoDiaryStatus.Accepted,
            DurationDays = 7,
            AcceptedAt = utcNowForBulk.AddDays(-1),
            CreatedAt = utcNowForBulk,
            UpdatedAt = utcNowForBulk,
        };
        setupDb.PhotoDiaryRequests.Add(bulkRequest);
        await setupDb.SaveChangesAsync(TestContext.Current.CancellationToken);

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Window: (09:00, 10:30] UTC today → noon Prague (10:00) inside, but Bulk → no reminder.
        var todayUtc = utcNowForBulk.UtcDateTime.Date;
        scheduler.SetLastTickAt(todayUtc.AddHours(9));
        scheduler.OverrideNow = todayUtc.AddHours(10).AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await verifyDb.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == bulkRequest.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().BeEmpty("Bulk-mode requests must not fire workflow reminders");
    }

    [Fact]
    public async Task Tick_Idempotent_TwoTicksSameDay_OnlyOneReminder()
    {
        // Simulates a scheduler restart mid-tick: the first run inserts the log but
        // _lastTickAt was not persisted. On restart we force the cursor back to before noon
        // so the scheduler tries to fire again — the unique constraint must catch it.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date;
        // Noon Prague CEST (UTC+2) = 10:00 UTC.
        var beforeNoon = virtualDate.AddHours(9);   // 09:00 UTC
        var afterNoon  = virtualDate.AddHours(10).AddMinutes(30); // 10:30 UTC

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "Europe/Prague");

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // First run: seed cursor to 09:00, tick to 10:30 → fires.
        scheduler.SetLastTickAt(beforeNoon);
        scheduler.OverrideNow = afterNoon;
        await scheduler.TickAsync(afterNoon, TestContext.Current.CancellationToken);

        // Simulate restart: force cursor back to before noon on the same day.
        scheduler.SetLastTickAt(beforeNoon);
        scheduler.OverrideNow = afterNoon.AddMinutes(30);  // 11:00 UTC — noon still in (09:00, 11:00]
        await scheduler.TickAsync(afterNoon.AddMinutes(30), TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().HaveCount(1, "unique index must prevent a second reminder on the same day");

        var notifications = await db.Notifications
            .Where(n => n.RecipientUserId == clientUserId && n.Type == NotificationType.PhotoDiaryReminder)
            .ToListAsync(TestContext.Current.CancellationToken);

        notifications.Should().HaveCount(1, "only one notification must be created despite the retry");
    }

    [Fact]
    public async Task Tick_NewYorkTimezone_FiresAtNoonEastern()
    {
        // America/New_York in April 2026 = EDT (UTC-4).
        // Noon New York = 12:00 EDT = 16:00 UTC.
        // Window: _lastTickAt=15:00 UTC, now=16:30 UTC → noon NY (16:00) inside window → FIRES.
        //
        // Use real UTC today as the virtual date so AcceptedAt (yesterday) is inside the
        // 7-day window AND the auto-finalize threshold (AcceptedAt + 8 days) is in the future.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date; // today UTC
        var virtualNoonNY = virtualDate.AddHours(16);  // noon New York EDT = 16:00 UTC

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "America/New_York");

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to 15:00 UTC today (before noon NY).
        var seedTime = virtualDate.AddHours(15);
        scheduler.SetLastTickAt(seedTime);

        // Tick at 16:30 UTC today = 12:30 New York EDT — noon (16:00 UTC) is inside (15:00, 16:30].
        scheduler.OverrideNow = virtualNoonNY.AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().HaveCount(1, "noon New York should trigger a reminder for EDT clients");
    }

    [Fact]
    public async Task Tick_NewYorkTimezone_BeforeNoonEastern_DoesNotFire()
    {
        // America/New_York EDT (UTC-4). Noon NY = 16:00 UTC.
        // Seed cursor at 16:30 UTC (AFTER noon) → noon is NOT in next window.
        // Use real UTC today so the window period is safe.
        var utcNow = DateTime.UtcNow;
        var virtualDate = utcNow.Date;
        var afterNoonNY = virtualDate.AddHours(16).AddMinutes(30); // 16:30 UTC = 12:30 NY

        var (_, _, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "America/New_York");

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to 16:30 UTC (AFTER noon NY).
        scheduler.SetLastTickAt(afterNoonNY);

        // Tick at 17:30 UTC: window is (16:30, 17:30]. Noon (16:00) is NOT in the window.
        scheduler.OverrideNow = afterNoonNY.AddHours(1);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var reminderLogs = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestId)
            .ToListAsync(TestContext.Current.CancellationToken);

        reminderLogs.Should().BeEmpty("noon already passed before this tick window — no reminder");
    }

    [Fact]
    public async Task Tick_AutoFinalizeAtDayNPlusOne()
    {
        // A request accepted 9 days ago (DurationDays=7) should be auto-finalized.
        // AcceptedAt + (7+1) days = 8 days after acceptance. Use 9 days so we're clearly past.
        var acceptedAt = new DateTimeOffset(DateTime.UtcNow.AddDays(-9));

        var (professionalId, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: acceptedAt,
            durationDays: 7,
            clientTimeZone: "Europe/Prague");

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Use real-time-relative noon UTC to avoid the DateCreated photo issue.
        var noonUtcToday = DateTime.UtcNow.Date.AddHours(12);
        var seedTime = noonUtcToday.AddHours(-1);

        scheduler.OverrideNow = seedTime;
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Tick at noon+30min: the auto-finalize condition triggers (9 days > 8 days threshold).
        scheduler.OverrideNow = noonUtcToday.AddMinutes(30);
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var request = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);

        request.Status.Should().Be(PhotoDiaryStatus.Completed, "request should be auto-finalized");
        request.CompletedAt.Should().NotBeNull("CompletedAt must be set on auto-finalize");

        // Verify photoDiarySubmitted emitted to the professional.
        var submittedEvents = notifier.Calls
            .Where(c => c.UserId == professionalId && c.EventType == "photoDiarySubmitted")
            .ToList();

        submittedEvents.Should().HaveCount(1, "photoDiarySubmitted must be emitted to the professional");
    }

    [Fact]
    public async Task Tick_DayIndexInPayload_CorrectValue()
    {
        // AcceptedAt = 2 days ago in Prague local time → today is day 3.
        var prague = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");
        var utcNow = DateTime.UtcNow;
        var virtualNow = utcNow.Date.AddHours(10).AddMinutes(30); // 10:30 UTC (after noon Prague CEST)

        var virtualNowPrague = TimeZoneInfo.ConvertTimeFromUtc(virtualNow, prague);

        // AcceptedAt = 2 days ago local (at 09:00 local).
        var acceptedAtLocal = virtualNowPrague.Date.AddDays(-2).Add(TimeSpan.FromHours(9));
        var acceptedAtUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(acceptedAtLocal, DateTimeKind.Unspecified), prague);

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(acceptedAtUtc),
            clientTimeZone: "Europe/Prague");

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to before noon Prague (09:00 UTC).
        scheduler.SetLastTickAt(utcNow.Date.AddHours(9));

        // Tick at 10:30 UTC (after noon Prague = 10:00 UTC) → fires.
        scheduler.OverrideNow = virtualNow;
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var notification = await db.Notifications
            .Where(n => n.RecipientUserId == clientUserId && n.Type == NotificationType.PhotoDiaryReminder)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        notification.Should().NotBeNull("notification must be created");
        notification!.Data.Should().Contain("\"dayIndex\":3",
            "day index must be 3 when AcceptedAt was 2 local days ago");
    }

    [Fact]
    public async Task Tick_PushFailure_DoesNotBlockNotificationPersistence()
    {
        // If the push service throws, the in-app notification must still be persisted
        // and no exception should bubble out.
        // Use UTC timezone + real-time based noon so AcceptedAt and window stay valid.
        var utcNow = DateTime.UtcNow;
        var noonUtcToday = utcNow.Date.AddHours(12);

        var (_, clientUserId, requestId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: new DateTimeOffset(utcNow.AddDays(-1)),
            clientTimeZone: "UTC");

        var push = factory.Services.GetRequiredService<FakePushNotificationService>();
        push.SimulateThrowOnNextCall();

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to one hour before noon.
        scheduler.SetLastTickAt(noonUtcToday.AddHours(-1));

        var act = async () =>
        {
            // Tick at noon + 30 min: noon (12:00 UTC) is in window.
            scheduler.OverrideNow = noonUtcToday.AddMinutes(30);
            await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);
        };

        await act.Should().NotThrowAsync("push failure must not propagate out of the scheduler");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var notification = await db.Notifications
            .Where(n => n.RecipientUserId == clientUserId && n.Type == NotificationType.PhotoDiaryReminder)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        notification.Should().NotBeNull("in-app notification must still be persisted despite push failure");
    }

    /// <summary>
    /// Regression test for the EF Core change-tracker cascade (issue #278).
    ///
    /// When two candidates are processed in the same tick and the FIRST candidate's
    /// reminder-log insert violates the unique constraint (ix_photo_diary_reminder_logs_request_date,
    /// Postgres 23505), the SECOND candidate must still receive its reminder log,
    /// in-app notification, and push notification.
    ///
    /// Before the fix: the catch block called db.Remove(logEntry) on a never-persisted entity,
    /// leaving the shared DbContext's change tracker in a corrupted state.  The second candidate's
    /// SaveChanges would then fail with a cascade exception.
    ///
    /// After the fix: each candidate runs inside its own IServiceScope / IApplicationDbContext,
    /// so a failed SaveChanges disposes that scope and the next candidate starts clean.
    ///
    /// This test exercises the error_path from the design handoff:
    ///   "Scheduler tick: first candidate's reminder-log insert violates the unique constraint.
    ///    After the catch, the same DbContext is used for the second candidate — its SaveChanges
    ///    must succeed cleanly (no cascade from the first failure)."
    /// </summary>
    [Fact]
    public async Task Tick_UniqueViolationOnFirstCandidate_DoesNotCascadeToSecondCandidate()
    {
        // Arrange: two active diary requests, both in UTC so noon = 12:00 UTC.
        var utcNow = DateTime.UtcNow;
        var noonUtc = utcNow.Date.AddHours(12);
        var acceptedAt = new DateTimeOffset(utcNow.AddDays(-1));

        var (_, clientAId, requestAId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: acceptedAt,
            clientTimeZone: "UTC");

        var (_, clientBId, requestBId, _) = await SetupWorkflowRequestAsync(
            acceptedAt: acceptedAt,
            clientTimeZone: "UTC");

        // Pre-seed a PhotoDiaryReminderLog row for candidate A's (DiaryRequestId, ClientLocalDate)
        // so its insert will hit the 23505 unique violation.
        var clientLocalDate = DateOnly.FromDateTime(utcNow.Date);
        using (var seedScope = factory.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            seedDb.PhotoDiaryReminderLogs.Add(new PhotoDiaryReminderLog
            {
                DiaryRequestId = requestAId,
                ClientLocalDate = clientLocalDate,
                SentAt = noonUtc.AddHours(-1)   // pre-existing log for today
            });
            await seedDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var push = factory.Services.GetRequiredService<FakePushNotificationService>();
        push.Reset();

        var notifier = factory.Services.GetRequiredService<FakeRealtimeNotifier>();
        notifier.Reset();

        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();
        scheduler.ResetCursor();

        // Seed cursor to one hour before noon so noon (12:00 UTC) is in the tick window.
        scheduler.SetLastTickAt(noonUtc.AddHours(-1));
        scheduler.OverrideNow = noonUtc.AddMinutes(30);

        // Act — one tick processes both candidates (A hits 23505, B must succeed).
        await scheduler.TickAsync(scheduler.OverrideNow.Value, TestContext.Current.CancellationToken);

        // Assert
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Candidate A: no new log row (the pre-seeded one remains, duplicate was rejected).
        var logsForA = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestAId && l.ClientLocalDate == clientLocalDate)
            .ToListAsync(TestContext.Current.CancellationToken);
        logsForA.Should().HaveCount(1,
            "candidate A had a pre-existing log row — the unique violation must be swallowed, " +
            "not crash the scheduler, and the existing row must not be deleted");

        // Candidate B: reminder log must be inserted (no cascade from A's failure).
        var logsForB = await db.PhotoDiaryReminderLogs
            .Where(l => l.DiaryRequestId == requestBId && l.ClientLocalDate == clientLocalDate)
            .ToListAsync(TestContext.Current.CancellationToken);
        logsForB.Should().HaveCount(1,
            "candidate B's reminder-log insert must succeed despite A's 23505 violation");

        // Candidate B: in-app notification must be created.
        var notificationForB = await db.Notifications
            .Where(n => n.RecipientUserId == clientBId && n.Type == NotificationType.PhotoDiaryReminder)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
        notificationForB.Should().NotBeNull(
            "candidate B's in-app notification must be persisted — it must not be affected by A's failure");

        // Candidate A: no in-app notification (reminder was skipped as duplicate).
        var notificationForA = await db.Notifications
            .Where(n => n.RecipientUserId == clientAId && n.Type == NotificationType.PhotoDiaryReminder)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
        notificationForA.Should().BeNull(
            "candidate A's notification must NOT be created — the reminder was a duplicate and was skipped");

        // Push must be invoked exactly once (for candidate B only).
        push.Calls.Should().HaveCount(1,
            "push must be sent for candidate B only — candidate A's reminder was a duplicate");
        push.Calls[0].UserId.Should().Be(clientBId,
            "the push must target candidate B's client");

        // SignalR broadcast must fire exactly once (for candidate B's newnotification).
        var newNotificationCalls = notifier.Calls
            .Where(c => c.EventType == "newnotification")
            .ToList();
        newNotificationCalls.Should().HaveCount(1,
            "newnotification must be broadcast once (for candidate B) — candidate A was skipped");
        newNotificationCalls[0].UserId.Should().Be(clientBId);
    }
}
