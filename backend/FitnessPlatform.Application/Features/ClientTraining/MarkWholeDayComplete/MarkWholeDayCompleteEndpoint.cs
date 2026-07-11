using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;

/// <summary>
/// Marks every training session scheduled for a given calendar day complete.
/// Resolves which sessions apply to the date by mapping the date to a plan week/day-of-week,
/// then upserts a <see cref="TrainingCompletion"/> document for each session.
/// Idempotent: sessions that are already fully complete are skipped.
/// Slides the Live lock TTL forward for each session resolved for the day (keep-alive).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="lockService">Session lock service — used to refresh Live TTLs on activity.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="logger">Logger.</param>
public class MarkWholeDayCompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    ILogger<MarkWholeDayCompleteEndpoint> logger)
    : Endpoint<MarkWholeDayCompleteRequest, MarkWholeDayCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/day/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark all training sessions for a day complete";
            s.Description = "Marks every session scheduled on the specified date complete. Resolves the plan week and day-of-week mapping. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkWholeDayCompleteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;
        var targetDateOnly = req.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var targetDate = targetDateOnly.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Find the active training plan
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.NoActiveTrainingPlan, "No active training plan found.", ct);
            return;
        }

        // Resolve which sessions are scheduled for the target date
        var sessionsForDay = ResolveSessions(plan, targetDateOnly);

        // Slide Live lock TTLs forward for each resolved session (keep-alive for active workouts).
        // Safe no-op per session when no Live lock exists. Failures are not surfaced to caller.
        var liveTtl = TimeSpan.FromHours(lockOptions.Value.LiveTtlHours);
        foreach (var session in sessionsForDay)
        {
            await lockService.RefreshAsync(session.SessionId, LockType.Live, liveTtl, ct);
        }

        var summaries = new List<SessionCompletionSummary>();

        // ── Batch-fetch existing TrainingCompletion docs for the day ──────────
        // One round trip covering every session resolved for the day, instead of
        // a per-session FindAsync inside the loop below. Mirrors the pattern used
        // by GetTodaySessionEndpoint and TrainingProgressBroadcaster.CountCompletedSessionsAsync.
        // Only the READ is batched — writes below stay per-session so the Version
        // bump, the fan-out version-conflict skip, and the 11000 duplicate-key
        // retry all keep their original per-session semantics.
        var completionsBySessionId = new Dictionary<Guid, TrainingCompletion>();
        if (sessionsForDay.Count > 0)
        {
            var sessionIds = sessionsForDay.Select(s => s.SessionId).ToList();
            var batchFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                              & Builders<TrainingCompletion>.Filter.In(c => c.SessionId, sessionIds);

            using var batchCursor = await mongo.TrainingCompletions.FindAsync(batchFilter, cancellationToken: ct);
            var existingCompletions = await batchCursor.ToListAsync(ct);
            completionsBySessionId = existingCompletions.ToDictionary(c => c.SessionId);
        }

        foreach (var session in sessionsForDay)
        {
            session.WithBackfilledSections();
            var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();
            var allSectionIds = session.Sections.Select(s => s.SectionId).ToList();
            // Per-section attribution map: each section explicitly carries the
            // exercise ids that belong to IT. Required because the read-time
            // backfill in `TrainingCompletionBackfill` falls back to "first
            // section that contains this id" — when the same exercise id is
            // referenced from multiple sections (e.g. two AMRAPs sharing
            // "Bench"), the duplicate would get attributed to only the first
            // section and the others would read as not-done after refresh.
            // Mirrors MarkSessionCompleteEndpoint so the whole-day mark and the
            // per-session mark write identical section-aware state.
            var completedBySection = session.Sections.ToDictionary(
                s => s.SectionId.ToString(),
                s => s.Exercises.Select(e => e.ExerciseExternalId).ToList());

            var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                                   & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                                   & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, session.SessionId);

            completionsBySessionId.TryGetValue(session.SessionId, out var existing);

            int version;

            if (existing is not null)
            {
                // Already fully complete — idempotent (per-section rule mirrors ComplianceService)
                var alreadyComplete = session.Sections.All(sec =>
                    sec.Exercises.Count > 0
                        ? sec.Exercises.All(e => existing.CompletedExerciseIds.Contains(e.ExerciseExternalId))
                        : (existing.CompletedSectionIds ?? []).Contains(sec.SectionId));
                if (alreadyComplete)
                {
                    summaries.Add(new SessionCompletionSummary
                    {
                        SessionId = session.SessionId,
                        CompletedExerciseCount = existing.CompletedExerciseIds.Count,
                        TotalExerciseCount = allExerciseIds.Count,
                        Version = existing.Version
                    });
                    continue;
                }

                var newVersion = existing.Version + 1;
                var versionedFilter = completionFilter
                                      & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

                var update = Builders<TrainingCompletion>.Update
                    .Set(c => c.CompletedExerciseIds, allExerciseIds)
                    .Set(c => c.CompletedExerciseIdsBySection, completedBySection)
                    .Set(c => c.CompletedSectionIds, allSectionIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, newVersion);

                var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

                // If version conflict on fan-out, skip this session — don't fail the whole batch
                version = updateResult.ModifiedCount > 0 ? newVersion : existing.Version;
            }
            else
            {
                var completion = new TrainingCompletion
                {
                    ExternalId = Guid.NewGuid(),
                    ClientId = clientId,
                    Date = targetDate,
                    SessionId = session.SessionId,
                    CompletedExerciseIds = allExerciseIds,
                    CompletedExerciseIdsBySection = completedBySection,
                    CompletedSectionIds = allSectionIds,
                    DateCreated = DateTime.UtcNow,
                    Version = 1
                };

                try
                {
                    await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
                    version = 1;
                }
                catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
                {
                    // Duplicate-key: concurrent request inserted first — re-read and retry once.
                    using var retryCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
                    existing = await retryCursor.FirstOrDefaultAsync(ct);

                    if (existing is null)
                    {
                        throw;
                    }

                    var retryAlreadyComplete = session.Sections.All(sec =>
                        sec.Exercises.Count > 0
                            ? sec.Exercises.All(e => existing.CompletedExerciseIds.Contains(e.ExerciseExternalId))
                            : (existing.CompletedSectionIds ?? []).Contains(sec.SectionId));
                    if (retryAlreadyComplete)
                    {
                        version = existing.Version;
                    }
                    else
                    {
                        var retryVersion = existing.Version + 1;
                        var retryVersionedFilter = completionFilter
                            & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);
                        var retryUpdate = Builders<TrainingCompletion>.Update
                            .Set(c => c.CompletedExerciseIds, allExerciseIds)
                            .Set(c => c.CompletedExerciseIdsBySection, completedBySection)
                            .Set(c => c.CompletedSectionIds, allSectionIds)
                            .Set(c => c.DateUpdated, DateTime.UtcNow)
                            .Set(c => c.Version, retryVersion);
                        var retryResult = await mongo.TrainingCompletions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);
                        // If version conflict on fan-out retry, use the existing version — don't fail the whole batch
                        version = retryResult.ModifiedCount > 0 ? retryVersion : existing.Version;
                    }
                }
            }

            summaries.Add(new SessionCompletionSummary
            {
                SessionId = session.SessionId,
                CompletedExerciseCount = allExerciseIds.Count,
                TotalExerciseCount = allExerciseIds.Count,
                Version = version
            });
        }

        // Broadcast once for all sessions updated in this request
        if (summaries.Count > 0)
        {
            var aggregateCompleted = summaries.Sum(s => s.CompletedExerciseCount);
            var aggregateTotal = summaries.Sum(s => s.TotalExerciseCount);

            await TrainingProgressBroadcaster.BroadcastWholeDayAsync(
                notifier, compliance, mongo, plan, clientId,
                targetDateOnly, aggregateCompleted, aggregateTotal,
                logger, ct);
        }

        await Send.OkAsync(new MarkWholeDayCompleteResponse
        {
            Date = targetDateOnly,
            Sessions = summaries
        }, ct);
    }

    /// <summary>
    /// Maps a calendar date to the sessions in the plan scheduled for that date,
    /// using the same week-resolution logic as <c>GetTodaySession</c>.
    /// Returns an empty list if the plan hasn't started, the target week isn't published,
    /// or there are no sessions for that day of week.
    /// </summary>
    private static IReadOnlyList<TrainingSession> ResolveSessions(TrainingPlan plan, DateOnly targetDate)
    {
        if (!plan.StartDate.HasValue || plan.Weeks.Count == 0)
            return [];

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
            return [];

        var resolvedWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        if (resolvedWeek is null)
            return [];

        // Past the last published week → no sessions for this date.
        // See GetTodaySessionEndpoint for the full rationale.
        if (resolvedWeek.Value > publishedWeeks[^1].WeekNumber)
            return [];

        var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == resolvedWeek.Value);
        if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
        {
            // Gap-skip: use the latest published week that's not after the
            // calculated one. Returns no sessions if no such week exists.
            currentWeek = publishedWeeks.LastOrDefault(w => w.WeekNumber <= resolvedWeek.Value);
            if (currentWeek is null) return [];
        }

        // Map DateOnly DayOfWeek (0=Sunday) to ISO 1=Monday…7=Sunday
        var dow = (int)targetDate.DayOfWeek;
        dow = dow == 0 ? 7 : dow;

        return currentWeek.Sessions
            .Where(s => s.DayOfWeek == dow)
            .OrderBy(s => s.Order)
            .ToList();
    }
}
