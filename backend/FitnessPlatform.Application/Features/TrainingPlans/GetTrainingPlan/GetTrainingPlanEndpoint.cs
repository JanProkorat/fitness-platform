using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Retrieves a single training plan with full detail (weeks, sessions, exercises, sets).
/// Also returns per-session WorkoutLog execution data so the web layer can render
/// completed / skipped / not-yet-reached indicators on each set.
/// Also enriches each session with its current edit-lock state (Stable/Editing/Live) and
/// holder (Coach/Client/null) via a single batch <c>GetStateAsync</c> call on the lock service.
/// This gives the trainer plan editor the initial lock state on page load, so the Live
/// in-progress badge and unlock affordance are correct before any SignalR events arrive.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service — used to batch-fetch lock state.</param>
public class GetTrainingPlanEndpoint(IMongoContext mongo, ISessionLockService lockService) : Endpoint<GetTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get a training plan";
            s.Description = "Returns the full training plan with all weeks, sessions, exercises, sets, " +
                             "and per-session workout-log execution data (completed/skipped set indicators).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        // Ownership gate: treat "not mine" as "not found" to avoid existence leak.
        if (plan is null || plan.TrainerId != trainerId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var response = GetTrainingPlanResponse.FromDocument(plan);

        // ── 1. TrainingCompletion fold-in (existing behaviour, unchanged) ─────────
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, plan.ClientId);
        var completionSort = Builders<TrainingCompletion>.Sort
            .Ascending(c => c.Date)
            .Ascending(c => c.SessionId);
        var completionCursor = await mongo.TrainingCompletions.FindAsync(
            completionFilter,
            new FindOptions<TrainingCompletion> { Sort = completionSort },
            ct);
        var completions = await completionCursor.ToListAsync(ct);

        // Build a session lookup for read-time backfill of legacy completions.
        // Keys are SessionId; sessions are already backfilled by FromDocument().
        var sessionLookup = plan.Weeks
            .SelectMany(w => w.Sessions)
            .ToDictionary(s => s.SessionId);

        response.Completions = completions
            .Select(c =>
            {
                Dictionary<Guid, List<Guid>> bySection;
                if (sessionLookup.TryGetValue(c.SessionId, out var session))
                {
                    var effective = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(c, session);
                    bySection = effective.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.ToList());
                }
                else
                {
                    // Session no longer in plan — return whatever is in the dict, or empty.
                    // Keys are stored as lowercase Guid strings; parse back to Guid, skipping malformed entries.
                    bySection = c.CompletedExerciseIdsBySection?
                        .Where(kvp => Guid.TryParse(kvp.Key, out _))
                        .ToDictionary(kvp => Guid.Parse(kvp.Key), kvp => kvp.Value.ToList()) ?? new();
                }

                return new TrainingPlanCompletionDto
                {
                    Date = DateOnly.FromDateTime(c.Date),
                    SessionId = c.SessionId,
                    CompletedExerciseIds = c.CompletedExerciseIds,
                    CompletedExerciseIdsBySection = bySection,
                    CompletedSectionIds = c.CompletedSectionIds ?? [],
                    Version = c.Version
                };
            })
            .ToList();

        // ── 2. WorkoutLog fold-in — builds SessionExecutions ─────────────────────
        // Query WorkoutLogs by PlanId only. Ownership is already validated above
        // (plan.TrainerId == trainerId), so there is no IDOR risk here.
        //
        // WorkoutLog.ClientId stores ApplicationUser.Id (not ClientProfile.PublicId),
        // but since we filter by PlanId the data cannot belong to a different client.
        var logFilter = Builders<WorkoutLog>.Filter.Eq(l => l.PlanId, req.PlanId);
        var logCursor = await mongo.WorkoutLogs.FindAsync(logFilter, cancellationToken: ct);
        var workoutLogs = await logCursor.ToListAsync(ct);

        if (workoutLogs.Count > 0)
        {
            // Deduplicate per sessionId:
            //   - Prefer the most-recently-updated FINALISED log (IsCompleted=true).
            //   - Fall back to the most recent in-progress log.
            //   This mirrors the precedence rule in the client GetFullPlan endpoint.
            var bestLogBySession = workoutLogs
                .Where(l => l.SessionId.HasValue)
                .GroupBy(l => l.SessionId!.Value)
                .Select(g =>
                {
                    var finalised = g
                        .Where(l => l.IsCompleted)
                        .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
                        .FirstOrDefault();

                    return finalised ?? g
                        .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
                        .First();
                })
                .ToList();

            response.SessionExecutions = bestLogBySession
                .Select(log =>
                {
                    // Apply schema-on-read backfill for legacy flat-exercise documents.
                    log.WithBackfilledSections();

                    // Build the per-exercise map of completed set numbers.
                    // A set is "completed" iff its WorkoutSet.CompletedAt is non-null.
                    var completedSetsByExercise = new Dictionary<Guid, List<int>>();

                    foreach (var ex in log.Exercises)
                    {
                        var completedSetNumbers = ex.Sets
                            .Where(s => s.CompletedAt.HasValue)
                            .Select(s => s.SetNumber)
                            .OrderBy(n => n)
                            .ToList();

                        if (completedSetNumbers.Count > 0)
                            completedSetsByExercise[ex.ExerciseExternalId] = completedSetNumbers;
                    }

                    return new SessionExecutionDto
                    {
                        SessionId = log.SessionId!.Value,
                        IsSessionFinished = log.IsCompleted,
                        CompletedSetsByExercise = completedSetsByExercise
                    };
                })
                .ToList();
        }

        // ── 3. TrainingCompletion-based finished state fold-in ───────────────────
        // The mobile "mark whole day complete" checkbox writes a TrainingCompletion document
        // but NOT a WorkoutLog. Without this step, sessions finished via that path would
        // never appear as IsSessionFinished=true on the trainer portal (fix for issue #429).
        //
        // For each session that has at least one fully-complete TrainingCompletion (any date),
        // ensure a SessionExecutionDto entry exists with IsSessionFinished=true.
        // A TrainingCompletion is "fully complete" iff IsSessionComplete() returns true —
        // that uses the same logic as the MarkSessionComplete idempotency check.
        //
        // Date-scoping: we match the most-complete TrainingCompletion per session regardless
        // of date, mirroring the WorkoutLog dedup which also collapses across dates. The
        // finished-state is a permanent property of the session — it does not reset between
        // scheduled occurrences for the same session definition.
        if (completions.Count > 0)
        {
            // sessionLookup sessions are already backfilled by FromDocument() — WithBackfilledSections()
            // was called there on the same plan object. IsSessionComplete() can be called directly.

            // Find sessions whose TrainingCompletion is fully done (any date — finished state is permanent).
            var finishedByCompletion = completions
                .Where(c => sessionLookup.TryGetValue(c.SessionId, out var s) && c.IsSessionComplete(s))
                .Select(c => c.SessionId)
                .ToHashSet();

            if (finishedByCompletion.Count > 0)
            {
                // Index existing SessionExecutions by SessionId for O(1) lookup.
                var executionsBySession = response.SessionExecutions
                    .ToDictionary(e => e.SessionId);

                foreach (var sessionId in finishedByCompletion)
                {
                    if (executionsBySession.TryGetValue(sessionId, out var existing))
                    {
                        // Session has a WorkoutLog entry — OR-in the completion-based flag
                        // (covers the edge case where the WorkoutLog isn't finalised but the
                        // home-checkbox completion says it's done).
                        if (!existing.IsSessionFinished)
                            existing.IsSessionFinished = true;
                    }
                    else
                    {
                        // No WorkoutLog for this session — emit a synthetic entry so the trainer
                        // portal renders the session as finished and hides the unlock affordance.
                        response.SessionExecutions.Add(new SessionExecutionDto
                        {
                            SessionId = sessionId,
                            IsSessionFinished = true,
                            CompletedSetsByExercise = new Dictionary<Guid, List<int>>()
                        });
                    }
                }
            }
        }

        // ── 4. Batch-fetch session lock state ────────────────────────────────────
        // Single Mongo round-trip — not one per session. Mirrors the pattern used
        // in GetFullTrainingPlanEndpoint (client read) so the shape is consistent.
        var allSessionIds = plan.Weeks
            .SelectMany(w => w.Sessions)
            .Select(s => s.SessionId)
            .ToList();

        if (allSessionIds.Count > 0)
        {
            var lockDocs = await lockService.GetStateAsync(allSessionIds, ct);

            response.SessionLockStates = lockDocs
                .Select(l => new SessionLockStateDto
                {
                    SessionId = l.SessionId,
                    LockState = l.Type.ToString(),
                    LockHolder = l.Holder.ToString()
                })
                .ToList();
        }

        await Send.OkAsync(response, ct);
    }
}
