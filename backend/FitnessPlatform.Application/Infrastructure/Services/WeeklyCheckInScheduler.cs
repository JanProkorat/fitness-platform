using System.Runtime.CompilerServices;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

[assembly: InternalsVisibleTo("FitnessPlatform.Tests")]

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Background service that fires weekly check-in reminders on an hourly tick.
/// For each enabled <see cref="WeeklyCheckInSetting"/> (with optional per-client overrides),
/// it checks whether the configured fire time fell within the last tick window and, if so,
/// inserts a <see cref="WeeklyCheckIn"/> row, creates a push notification, and broadcasts
/// via SignalR.
/// Also runs <see cref="SweepExpiredAsync"/> on every tick to transition past-due Pending
/// check-ins to <see cref="WeeklyCheckInStatus.Expired"/>.
/// </summary>
public class WeeklyCheckInScheduler(
    IServiceScopeFactory scopeFactory,
    ILogger<WeeklyCheckInScheduler> logger) : BackgroundService
{
    /// <summary>
    /// Default deadline offset in hours. Applied when neither a per-client override nor
    /// the professional's <see cref="WeeklyCheckInSetting.DeadlineOffsetHours"/> is set.
    /// </summary>
    internal const int DefaultDeadlineOffsetHours = 72;
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
                "WeeklyCheckInScheduler: first tick in {Delay:mm\\:ss} (aligning to :00).", delay);
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
            logger.LogDebug("WeeklyCheckInScheduler: tick at {TickNow:u}.", tickNow);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                await ProcessTickAsync(db, scope.ServiceProvider, tickNow, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "WeeklyCheckInScheduler: unhandled error on tick at {TickNow:u}.", tickNow);
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
        // Seed the cursor so that settings whose fire time fell in the last hour
        // before startup are not re-fired (they already ran, and we would duplicate).
        // We back off by 1 minute to ensure a setting whose fire time was at :00
        // is not skipped on the very first tick after startup.
        var maxSentAt = await db.WeeklyCheckIns
            .AsNoTracking()
            .MaxAsync(c => (DateTime?)c.SentAt, ct);

        var oneHourAgo = now.AddHours(-1);

        if (maxSentAt.HasValue)
        {
            var seedFrom = maxSentAt.Value.AddMinutes(-1);
            var cursor = seedFrom < oneHourAgo ? oneHourAgo : seedFrom;
            logger.LogInformation(
                "WeeklyCheckInScheduler: seeding cursor to {Cursor:u} (maxSentAt={MaxSentAt:u}).",
                cursor, maxSentAt.Value);
            return cursor;
        }

        logger.LogInformation(
            "WeeklyCheckInScheduler: no previous check-ins; seeding cursor to {Cursor:u}.", oneHourAgo);
        return oneHourAgo;
    }

    private async Task ProcessTickAsync(
        IApplicationDbContext db,
        IServiceProvider services,
        DateTime now,
        CancellationToken ct)
    {
        // Run the expiry sweeper first so that any past-due Pending rows are marked Expired
        // before we evaluate new check-in candidates.
        await SweepExpiredAsync(now, ct);

        // Load all enabled settings with their associated professional users
        // and optional per-client overrides.
        // Use AsNoTracking — the candidate list is read-only; writes happen in per-candidate scopes.
        var settings = await db.WeeklyCheckInSettings
            .AsNoTracking()
            .Where(s => s.Enabled)
            .Include(s => s.User)
            .ToListAsync(ct);

        if (settings.Count == 0) return;

        var professionalUserIds = settings.Select(s => s.UserId).Distinct().ToList();

        // Load all active client links for these professionals.
        // We need the client's UserId (Guid) — walk via ProfessionalProfile.
        var professionalProfiles = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => professionalUserIds.Contains(p.UserId))
            .Include(p => p.ClientLinks.Where(l => l.IsActive))
                .ThenInclude(l => l.ClientProfile)
                    .ThenInclude(cp => cp.User)
            .ToListAsync(ct);

        var profProfileById = professionalProfiles.ToDictionary(p => p.UserId);

        // Load all relevant overrides at once.
        var overrides = await db.WeeklyCheckInClientOverrides
            .AsNoTracking()
            .Where(o => professionalUserIds.Contains(o.ProfessionalUserId))
            .ToListAsync(ct);

        // Index overrides for quick lookup.
        var overrideIndex = overrides.ToDictionary(
            o => (o.ProfessionalUserId, o.ClientUserId, o.Profession));

        var notifier = services.GetRequiredService<IRealtimeNotifier>();
        var push = services.GetRequiredService<IPushNotificationService>();

        foreach (var setting in settings)
        {
            if (!profProfileById.TryGetValue(setting.UserId, out var profProfile))
                continue;

            foreach (var link in profProfile.ClientLinks.Where(l => l.IsActive))
            {
                var clientUserId = link.ClientProfile.UserId;

                overrideIndex.TryGetValue(
                    (setting.UserId, clientUserId, setting.Profession),
                    out var clientOverride);

                // Override wins if present and non-null; otherwise fall back to setting.
                var effectiveEnabled = clientOverride?.Enabled ?? setting.Enabled;
                if (!effectiveEnabled) continue;

                var effectiveDayOfWeek = clientOverride?.DayOfWeek ?? setting.DayOfWeek;
                var effectiveTimeOfDay = clientOverride?.TimeOfDay ?? setting.TimeOfDay;

                // Compute nextFireAt in the professional's time zone.
                var professionalTz = GetTimeZoneInfo(setting.User.TimeZone);
                var nextFireAt = ComputeNextFireAt(
                    effectiveDayOfWeek, effectiveTimeOfDay, professionalTz, now);

                // Fire if nextFireAt falls within the half-open window (_lastTickAt, now].
                if (nextFireAt <= _lastTickAt || nextFireAt > now)
                    continue;

                // WeekStartDate = Monday of the ISO week AFTER the fire moment.
                var weekStartDate = NextIsoMonday(nextFireAt);

                // ── Candidate: per-candidate scope ────────────────────────────
                // Each candidate gets its own IApplicationDbContext scope so that a 23505
                // unique-violation (or any other DbUpdateException) on one candidate's
                // SaveChanges cannot corrupt the change tracker and cascade to the next
                // candidate's inserts.  This is the architecturally correct fix: after
                // a failed SaveChanges the EF change tracker is in an undefined state;
                // disposing the scope is the only safe recovery.
                using var candidateScope = scopeFactory.CreateScope();
                var candidateDb = candidateScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

                // Resolve the effective deadline offset:
                // client override → professional setting → default constant (72h).
                var effectiveDeadlineOffsetHours =
                    clientOverride?.DeadlineOffsetHours
                    ?? setting.DeadlineOffsetHours;

                var checkIn = new WeeklyCheckIn
                {
                    ClientUserId = clientUserId,
                    ProfessionalUserId = setting.UserId,
                    Profession = setting.Profession,
                    WeekStartDate = weekStartDate,
                    SentAt = now,
                    DueAt = now.AddHours(effectiveDeadlineOffsetHours),
                    Status = WeeklyCheckInStatus.Pending,
                    DateCreated = now,
                    DateModified = now
                };

                candidateDb.WeeklyCheckIns.Add(checkIn);

                try
                {
                    await candidateDb.SaveChangesAsync(ct);
                }
                catch (DbUpdateException ex)
                    when (IsUniqueViolation(ex))
                {
                    // Duplicate — check-in already exists for this (ClientUserId, ProfessionalUserId,
                    // Profession, WeekStartDate). The candidateScope is disposed at end-of-block;
                    // no tracker cleanup needed.
                    logger.LogWarning(
                        "WeeklyCheckInScheduler: duplicate check-in skipped for " +
                        "client={ClientUserId} professional={ProfessionalUserId} " +
                        "profession={Profession} week={WeekStartDate}.",
                        clientUserId, setting.UserId, setting.Profession, weekStartDate);
                    continue;
                }

                // Create in-app notification for the client.
                var professionalName =
                    $"{setting.User.FirstName} {setting.User.LastName}".Trim();

                var notificationData = JsonSerializer.Serialize(new
                {
                    weeklyCheckInId = checkIn.Id,
                    profession = setting.Profession.ToString(),
                    professionalName
                });

                var notification = new Notification
                {
                    RecipientUserId = clientUserId,
                    Type = NotificationType.WeeklyCheckInRequested,
                    Title = "Planning next week",
                    Body = $"{professionalName} is planning next week. Let them know if anything special is coming up.",
                    Data = notificationData
                };

                // ── Persist in-app notification (best-effort) ────────────────
                try
                {
                    candidateDb.Notifications.Add(notification);
                    await candidateDb.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex,
                        "WeeklyCheckInScheduler: failed to persist notification for client {ClientUserId}.",
                        clientUserId);
                    continue;
                }

                // Send push notification.
                try
                {
                    await push.SendAsync(
                        clientUserId,
                        "Planning next week",
                        $"{professionalName} is planning next week. Let them know if anything special is coming up.",
                        new { type = "WeeklyCheckInRequested", weeklyCheckInId = checkIn.Id },
                        ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex,
                        "WeeklyCheckInScheduler: failed to send push to client {ClientUserId}.", clientUserId);
                }

                // Broadcast via SignalR to the client's connection group.
                try
                {
                    await notifier.NotifyAsync(
                        clientUserId,
                        "newnotification",
                        new
                        {
                            id = notification.Id,
                            type = NotificationType.WeeklyCheckInRequested.ToString(),
                            data = notificationData
                        },
                        ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex,
                        "WeeklyCheckInScheduler: failed to broadcast newnotification to client {ClientUserId}.",
                        clientUserId);
                }

                logger.LogInformation(
                    "WeeklyCheckInScheduler: fired check-in {CheckInId} client={ClientUserId} professional={ProfessionalUserId} profession={Profession} week={WeekStartDate}.",
                    checkIn.Id, clientUserId, setting.UserId, setting.Profession, weekStartDate);
            }
        }
    }

    // ── Expiry sweeper ────────────────────────────────────────────────────────

    /// <summary>
    /// Transitions all <see cref="WeeklyCheckInStatus.Pending"/> check-ins whose
    /// <see cref="WeeklyCheckIn.DueAt"/> is in the past to
    /// <see cref="WeeklyCheckInStatus.Expired"/>.
    /// <para>
    /// Uses a fresh <see cref="IApplicationDbContext"/> scope per invocation so that
    /// a save failure does not corrupt the change tracker for the caller's scope.
    /// </para>
    /// <para>
    /// Idempotent: the filter explicitly targets only <c>Status == Pending</c> rows,
    /// so running the sweep twice will not re-stamp <c>ExpiredAt</c> on already-expired rows.
    /// </para>
    /// </summary>
    internal async Task SweepExpiredAsync(DateTime now, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        // Use EF Core 9 ExecuteUpdateAsync for a single bulk UPDATE — avoids materializing
        // the rows into memory.
        var affected = await db.WeeklyCheckIns
            .Where(c => c.Status == WeeklyCheckInStatus.Pending
                        && c.DueAt != null
                        && c.DueAt <= now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(c => c.Status, WeeklyCheckInStatus.Expired)
                .SetProperty(c => c.ExpiredAt, now)
                .SetProperty(c => c.DateModified, now),
                ct);

        if (affected > 0)
        {
            logger.LogInformation(
                "WeeklyCheckInScheduler: swept {Count} expired check-in(s) at {Now:u}.",
                affected, now);
        }
    }

    // ── Pure helpers (testable in isolation) ─────────────────────────────────

    /// <summary>
    /// Computes the most recent past occurrence of <paramref name="dayOfWeek"/>
    /// at <paramref name="timeOfDay"/> in the given <paramref name="timeZone"/>,
    /// relative to <paramref name="utcNow"/>, then returns it as UTC.
    /// "Most recent" means the latest moment ≤ utcNow that matches the day+time combination.
    /// </summary>
    internal static DateTime ComputeNextFireAt(
        DayOfWeek dayOfWeek,
        TimeSpan timeOfDay,
        TimeZoneInfo timeZone,
        DateTime utcNow)
    {
        // Convert now to local time so we can reason about day+time in the professional's zone.
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);

        // Walk back from today to find the last occurrence of the desired day.
        var localDate = localNow.Date;
        var daysBack = ((int)localDate.DayOfWeek - (int)dayOfWeek + 7) % 7;
        var localFireDate = localDate.AddDays(-daysBack);
        var localFireAt = localFireDate + timeOfDay;

        // If this occurrence is in the future relative to localNow, step back by a week.
        if (localFireAt > localNow)
            localFireAt = localFireAt.AddDays(-7);

        // Convert back to UTC.
        return TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(localFireAt, DateTimeKind.Unspecified),
            timeZone);
    }

    /// <summary>
    /// Returns the Monday of the ISO week that follows the week containing
    /// <paramref name="referenceDate"/>. Always returns a <see cref="DateOnly"/>.
    /// ISO weeks start on Monday (DayOfWeek.Monday = 1, Sunday = 0).
    /// </summary>
    internal static DateOnly NextIsoMonday(DateTime referenceDate)
    {
        var date = DateOnly.FromDateTime(referenceDate);
        // How many days back from date to reach the Monday of the current ISO week.
        // DayOfWeek.Monday = 1, Sunday = 0 → treat Sunday as day 7 for ISO.
        var dayIndex = date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
        var daysFromMonday = dayIndex - 1; // 0 for Monday, 6 for Sunday
        // Monday of current week + 7 = Monday of next ISO week.
        return date.AddDays(-daysFromMonday + 7);
    }

    private DateTime UtcNow() => OverrideNow ?? DateTime.UtcNow;

    private TimeZoneInfo GetTimeZoneInfo(string ianaId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
        }
        catch
        {
            logger.LogWarning(
                "WeeklyCheckInScheduler: unknown time zone '{IanaId}'; falling back to UTC.", ianaId);
            return TimeZoneInfo.Utc;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        return ex.InnerException is PostgresException pgEx
               && pgEx.SqlState == "23505"; // unique_violation
    }
}
