using System.Runtime.CompilerServices;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.PhotoDiaryRequests;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

[assembly: InternalsVisibleTo("FitnessPlatform.Tests")]

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Background service that fires a daily reminder to clients in an active photo-diary
/// workflow when the client has not yet uploaded any photo for the current day.
/// The scheduler ticks once per hour (aligned to :00) and checks each active
/// workflow-mode diary request to see whether the client's local-time noon falls
/// within the last tick window.
///
/// <para><b>Idempotency:</b> a <see cref="PhotoDiaryReminderLog"/> row is inserted
/// per (DiaryRequestId, ClientLocalDate) under a unique constraint.  A duplicate
/// insert (Postgres error 23505) means the reminder already fired — skip silently.</para>
///
/// <para><b>Auto-finalize:</b> requests that have exceeded their window
/// (<c>now &gt; AcceptedAt + (DurationDays + 1) days</c>) are automatically
/// transitioned to <see cref="PhotoDiaryStatus.Completed"/> and the
/// <c>photoDiarySubmitted</c> event is emitted to the professional.</para>
/// </summary>
public class PhotoDiaryReminderScheduler(
    IServiceScopeFactory scopeFactory,
    ILogger<PhotoDiaryReminderScheduler> logger) : BackgroundService
{
    // Exposed for unit/integration tests — drive the scheduler with a virtual clock.
    internal DateTime? OverrideNow { get; set; }

    private DateTime _lastTickAt;
    private bool _cursorInitialized;

    /// <summary>
    /// Resets the scheduler's cursor state so the next <see cref="TickAsync"/> call
    /// re-seeds from the DB. Use between tests that share the same singleton instance.
    /// </summary>
    internal void ResetCursor()
    {
        _cursorInitialized = false;
        _lastTickAt = default;
    }

    /// <summary>
    /// Force-sets the last-tick cursor to a specific point in time WITHOUT re-seeding from DB.
    /// Use in tests that need to position the window precisely without resetting
    /// <see cref="_cursorInitialized"/>.
    /// </summary>
    internal void SetLastTickAt(DateTime lastTickAt)
    {
        _cursorInitialized = true;
        _lastTickAt = lastTickAt;
    }

    /// <summary>
    /// Entry point used by tests: execute one scheduler cycle treating <paramref name="now"/>
    /// as the current UTC time.  The internal cursor is seeded on first call.
    /// </summary>
    internal async Task TickAsync(DateTime now, CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        if (!_cursorInitialized)
        {
            _lastTickAt = await SeedCursorAsync(db, now, ct);
            _cursorInitialized = true;
        }

        await ProcessTickAsync(db, scope.ServiceProvider, now, ct);
        _lastTickAt = now;
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Align first tick to the next :00 boundary.
        var now = UtcNow();
        var delay = TimeSpan.FromMinutes(60 - now.Minute)
                            .Subtract(TimeSpan.FromSeconds(now.Second))
                            .Subtract(TimeSpan.FromMilliseconds(now.Millisecond));

        if (delay.TotalMilliseconds > 0)
        {
            logger.LogInformation(
                "PhotoDiaryReminderScheduler: first tick in {Delay:mm\\:ss} (aligning to :00).", delay);
            await Task.Delay(delay, stoppingToken);
        }

        // Seed cursor from DB so a cold start doesn't re-fire the last hour.
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            _lastTickAt = await SeedCursorAsync(db, UtcNow(), stoppingToken);
        }

        _cursorInitialized = true;

        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));

        while (!stoppingToken.IsCancellationRequested)
        {
            var tickNow = UtcNow();
            logger.LogDebug("PhotoDiaryReminderScheduler: tick at {TickNow:u}.", tickNow);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                await ProcessTickAsync(db, scope.ServiceProvider, tickNow, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex,
                    "PhotoDiaryReminderScheduler: unhandled error on tick at {TickNow:u}.", tickNow);
            }

            _lastTickAt = tickNow;

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private async Task<DateTime> SeedCursorAsync(
        IApplicationDbContext db, DateTime now, CancellationToken ct)
    {
        var maxSentAt = await db.PhotoDiaryReminderLogs
            .AsNoTracking()
            .MaxAsync(l => (DateTime?)l.SentAt, ct);

        var oneHourAgo = now.AddHours(-1);

        if (maxSentAt.HasValue)
        {
            var seedFrom = maxSentAt.Value.AddMinutes(-1);
            var cursor = seedFrom < oneHourAgo ? oneHourAgo : seedFrom;
            logger.LogInformation(
                "PhotoDiaryReminderScheduler: seeding cursor to {Cursor:u} (maxSentAt={MaxSentAt:u}).",
                cursor, maxSentAt.Value);
            return cursor;
        }

        logger.LogInformation(
            "PhotoDiaryReminderScheduler: no previous reminders; seeding cursor to {Cursor:u}.", oneHourAgo);
        return oneHourAgo;
    }

    private async Task ProcessTickAsync(
        IApplicationDbContext db,
        IServiceProvider services,
        DateTime now,
        CancellationToken ct)
    {
        // Load all active workflow-mode diary requests in the acceptance/in-progress window,
        // joined with the client user so we can read their time zone.
        // Use AsNoTracking — the candidate list is read-only; writes happen in per-candidate scopes.
        var candidates = await db.PhotoDiaryRequests
            .AsNoTracking()
            .Where(r => r.Mode == PhotoDiaryMode.Workflow
                        && (r.Status == PhotoDiaryStatus.Accepted || r.Status == PhotoDiaryStatus.InProgress))
            .Include(r => r.Link)
                .ThenInclude(l => l!.ClientProfile)
                    .ThenInclude(cp => cp.User)
            .Include(r => r.PendingInvite)
            .ToListAsync(ct);

        if (candidates.Count == 0) return;

        var notifier = services.GetRequiredService<IRealtimeNotifier>();

        foreach (var request in candidates)
        {
            // ── Resolve client user (needed for TZ and UserId) ────────────────
            var (clientUserId, clientUserTz) = ResolveClientInfo(request);
            if (clientUserId == Guid.Empty)
            {
                // Invite-based request with no registered user yet — skip.
                continue;
            }

            // ── Auto-finalize check: window expired ───────────────────────────
            // If now > AcceptedAt + (DurationDays + 1) days, auto-complete.
            if (request.AcceptedAt.HasValue
                && now > request.AcceptedAt.Value.UtcDateTime.AddDays(request.DurationDays + 1))
            {
                // Candidate B: auto-finalize in its own scope so failures don't affect siblings.
                using var finalizeScope = scopeFactory.CreateScope();
                var finalizeDb = finalizeScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                await AutoFinalizeAsync(finalizeDb, services, request, clientUserId, now, ct);
                continue;  // request is now Completed — no reminder needed
            }

            // ── Skip if past the valid window but not yet day N+1 ────────────
            // If now >= AcceptedAt + DurationDays we're inside the finalize-grace day — still remind.
            if (!request.AcceptedAt.HasValue) continue;

            // ── TZ & noon computation ─────────────────────────────────────────
            var tz = GetTimeZoneInfo(clientUserTz);
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, tz);
            var noonLocal = localNow.Date.Add(TimeSpan.FromHours(12));
            var noonUtc = TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(noonLocal, DateTimeKind.Unspecified), tz);

            // Fire only if noon crossed within the half-open window (_lastTickAt, now].
            if (noonUtc <= _lastTickAt || noonUtc > now)
                continue;

            // ── Check if client already uploaded a photo today ────────────────
            // "today" = [start-of-local-day, end-of-local-day) in UTC.
            var localDayStart = localNow.Date;
            var localDayEnd   = localDayStart.AddDays(1);

            var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(localDayStart, DateTimeKind.Unspecified), tz);
            var dayEndUtc = TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(localDayEnd, DateTimeKind.Unspecified), tz);

            var alreadyUploaded = await db.PlanPhotos
                .AsNoTracking()
                .AnyAsync(p => p.DiaryRequestId == request.Id
                               && p.DateCreated >= dayStartUtc
                               && p.DateCreated < dayEndUtc,
                          ct);

            if (alreadyUploaded)
            {
                logger.LogDebug(
                    "PhotoDiaryReminderScheduler: client {ClientUserId} already uploaded " +
                    "today for request {RequestId} — skip.",
                    clientUserId, request.Id);
                continue;
            }

            // ── Day index (1-based) ───────────────────────────────────────────
            var acceptedAtLocal = TimeZoneInfo.ConvertTimeFromUtc(
                request.AcceptedAt.Value.UtcDateTime, tz);
            var dayIndex = (localNow.Date - acceptedAtLocal.Date).Days + 1;
            if (dayIndex < 1) dayIndex = 1;

            var clientLocalDate = DateOnly.FromDateTime(localNow.Date);

            // ── Candidate B: per-candidate scope ─────────────────────────────
            // Each candidate gets its own IApplicationDbContext scope so that a 23505
            // unique-violation (or any other DbUpdateException) on one candidate's
            // SaveChanges cannot corrupt the change tracker and cascade to the next
            // candidate's inserts.  This is the architecturally correct fix: after
            // a failed SaveChanges the EF change tracker is in an undefined state;
            // disposing the scope is the only safe recovery.
            using var candidateScope = scopeFactory.CreateScope();
            var candidateDb = candidateScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

            // ── Idempotency: insert log row ────────────────────────────────────
            var logEntry = new PhotoDiaryReminderLog
            {
                DiaryRequestId = request.Id,
                ClientLocalDate = clientLocalDate,
                SentAt = now
            };

            candidateDb.PhotoDiaryReminderLogs.Add(logEntry);

            try
            {
                await candidateDb.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                // Duplicate — reminder already fired for this (DiaryRequestId, date).
                // The candidateScope is disposed at end-of-block; no tracker cleanup needed.
                logger.LogWarning(
                    "PhotoDiaryReminderScheduler: duplicate reminder skipped for " +
                    "request={RequestId} date={Date}.",
                    request.Id, clientLocalDate);
                continue;
            }

            // ── Create in-app + push notification (best-effort), localized to the
            // client's stored Language (#788 — no HTTP request here, so CreateAsync's
            // recipient-language lookup via the persisted ApplicationUser.Language
            // column is the mechanism that makes this possible). Resolved from the
            // SAME candidateScope as candidateDb so NotificationService shares the
            // already-open DbContext/change tracker.
            var notifications = candidateScope.ServiceProvider.GetRequiredService<INotificationService>();

            Notification notification;
            try
            {
                notification = await notifications.CreateAsync(
                    clientUserId,
                    NotificationType.PhotoDiaryReminder,
                    new Dictionary<string, string>
                    {
                        ["dayIndex"] = dayIndex.ToString(),
                        ["durationDays"] = request.DurationDays.ToString(),
                        ["requestId"] = request.Id.ToString(),
                    },
                    ct: ct);
            }
            catch (Exception ex)
            {
                // Covers both the DB persist and the recipient-language lookup —
                // push failures never throw here (ExpoPushNotificationService
                // self-swallows its own errors internally).
                logger.LogWarning(ex,
                    "PhotoDiaryReminderScheduler: failed to create notification for client {ClientUserId} " +
                    "on request {RequestId}.", clientUserId, request.Id);
                continue;
            }

            // ── SignalR broadcast (best-effort) ───────────────────────────────
            try
            {
                await notifier.NotifyAsync(
                    clientUserId,
                    "newnotification",
                    new
                    {
                        id = notification.Id,
                        type = NotificationType.PhotoDiaryReminder.ToString(),
                        data = notification.Data
                    },
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "PhotoDiaryReminderScheduler: failed to broadcast newnotification to " +
                    "client {ClientUserId} for request {RequestId}.", clientUserId, request.Id);
            }

            logger.LogInformation(
                "PhotoDiaryReminderScheduler: fired reminder for request {RequestId} " +
                "client={ClientUserId} dayIndex={DayIndex}.",
                request.Id, clientUserId, dayIndex);
        }
    }

    /// <summary>
    /// Transitions a timed-out diary request to Completed, persists it, and emits
    /// <c>photoDiarySubmitted</c> to the professional. Idempotent — once the request is
    /// Completed the scheduler's candidate query excludes it.
    /// </summary>
    private async Task AutoFinalizeAsync(
        IApplicationDbContext db,
        IServiceProvider services,
        PhotoDiaryRequest request,
        Guid clientUserId,
        DateTime now,
        CancellationToken ct)
    {
        // Re-load with tracking to apply the mutation.
        var tracked = await db.PhotoDiaryRequests
            .Where(r => r.Id == request.Id
                        && (r.Status == PhotoDiaryStatus.Accepted || r.Status == PhotoDiaryStatus.InProgress))
            .FirstOrDefaultAsync(ct);

        if (tracked is null)
        {
            // Already finalized by another path (race / concurrent tick).
            return;
        }

        tracked.Status = PhotoDiaryStatus.Completed;
        tracked.CompletedAt = new DateTimeOffset(now, TimeSpan.Zero);
        tracked.UpdatedAt = new DateTimeOffset(now, TimeSpan.Zero);

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "PhotoDiaryReminderScheduler: auto-finalized request {RequestId} for client {ClientUserId}.",
            request.Id, clientUserId);

        // Emit photoDiarySubmitted to the professional (best-effort).
        var notifier = services.GetRequiredService<IRealtimeNotifier>();
        try
        {
            // Resolve client display name.
            string clientName;
            if (request.Link?.ClientProfile?.User is { } user)
                clientName = $"{user.FirstName} {user.LastName}".Trim();
            else if (request.PendingInvite is { } invite)
                clientName = $"{invite.FirstName} {invite.LastName}".Trim();
            else
                clientName = clientUserId.ToString();

            var photoCount = await db.PlanPhotos
                .AsNoTracking()
                .CountAsync(p => p.DiaryRequestId == request.Id, ct);

            await notifier.NotifyAsync(
                request.ProfessionalId,
                "photodiarysubmitted",
                new PhotoDiarySubmittedEvent
                {
                    RequestId = request.Id,
                    ClientName = clientName,
                    PhotoCount = photoCount,
                    SubmittedAt = tracked.CompletedAt!.Value
                },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "PhotoDiaryReminderScheduler: failed to emit photoDiarySubmitted for " +
                "request {RequestId} to professional {ProfessionalId}.",
                request.Id, request.ProfessionalId);
        }
    }

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves the client's <see cref="Guid"/> UserId and IANA time-zone string
    /// from a <see cref="PhotoDiaryRequest"/>.
    /// Returns (<see cref="Guid.Empty"/>, &quot;Europe/Prague&quot;) when the client
    /// user cannot be determined (e.g. unaccepted invite with no registered user).
    /// </summary>
    private static (Guid UserId, string TimeZone) ResolveClientInfo(PhotoDiaryRequest request)
    {
        if (request.Link?.ClientProfile?.User is { } user)
            return (user.Id, user.TimeZone);

        // PendingInvite-based requests don't have a registered user yet.
        return (Guid.Empty, "Europe/Prague");
    }

    private DateTime UtcNow() => OverrideNow ?? DateTime.UtcNow;

    private TimeZoneInfo GetTimeZoneInfo(string ianaId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            logger.LogWarning(
                "PhotoDiaryReminderScheduler: unknown time zone '{IanaId}'; falling back to UTC.", ianaId);
            return TimeZoneInfo.Utc;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505";
}
