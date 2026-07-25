using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;

/// <summary>
/// Progressively updates a session execution's Performance data with exercise/set data.
/// Designed for offline-first: replaces all exercise data with current state.
/// As a best-effort side-effect, detects newly-completed sets that beat the
/// client's historical best weight (tie-broken by reps) and writes a
/// <see cref="PersonalRecord"/> document for each one, then marks the
/// corresponding <see cref="WorkoutSet.IsPR"/> flag on the execution.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">PostgreSQL context (used for trainer-link lookup).</param>
/// <param name="notifier">SignalR notifier for broadcasting PR events.</param>
/// <param name="logger">Logger for best-effort PR warning messages.</param>
public class UpdateWorkoutEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ILogger<UpdateWorkoutEndpoint> logger) : Endpoint<UpdateWorkoutRequest, WorkoutLogDetail>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/client/training/logs/{LogId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Update workout log";
            s.Description = "Progressively updates a workout with exercise and set data. Replaces all exercise data.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);

        var filter = Builders<SessionExecution>.Filter.Eq(w => w.ExternalId, req.LogId)
                     & Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientId)
                     & Builders<SessionExecution>.Filter.Exists(w => w.Performance)
                     & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Partial);

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var performance = log.Performance!;

        // ── Snapshot previously-completed sets BEFORE we overwrite them ──────────
        // Key: (sectionId, exerciseExternalId, setNumber) → true if already completed.
        // Used downstream to determine which sets are *newly* completed this call.
        var previouslyCompleted = performance.Sections
            .SelectMany(sec => sec.Exercises
                .SelectMany(e => e.Sets
                    .Where(s => s.CompletedAt.HasValue)
                    .Select(s => (sec.SectionId, e.ExerciseExternalId, s.SetNumber))))
            .ToHashSet();

        // ── Build snapshot lookup from the existing stored sets ──────────────────
        // Key: (SectionId, ExerciseExternalId, SetNumber) → stored WorkoutSet.
        // Used below to freeze Planned* fields on re-PUT: once a Planned* field has
        // a non-null value in the database it is immutable; later requests cannot
        // overwrite it even if they supply different planned values.
        //
        // Keying includes SectionId so that the same exercise repeated in two
        // different sections (e.g. standard + AMRAP) gets independent snapshots.
        var storedSetLookup = performance.Sections
            .SelectMany(sec => sec.Exercises
                .SelectMany(e => e.Sets.Select(s => (sec.SectionId, e.ExerciseExternalId, s))))
            .ToDictionary(
                x => (x.SectionId, x.ExerciseExternalId, x.s.SetNumber),
                x => x.s);

        // ── Determine whether all request exercises carry SectionId ───────────────
        // Legacy clients (no SectionId) → single-section fallback for backward compat.
        var allHaveSectionId = req.Exercises.Count > 0
                               && req.Exercises.All(e => e.SectionId.HasValue);

        performance.Mood = req.Mood;
        performance.Notes = req.Notes?.Trim();
        performance.WodResult = req.WodResult;

        if (allHaveSectionId)
        {
            // ── Section-aware path: exercises are routed to their designated section ──
            // Each exercise in the request carries the SectionId it belongs to.
            // We update or create sections as needed, preserving sections that the
            // request does not mention (empty sections remain in the document).
            //
            // Group request exercises by SectionId.
            var exercisesBySectionId = req.Exercises
                .GroupBy(e => e.SectionId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Walk existing sections and update their exercise lists.
            // Sections in the stored log that are not in the request remain untouched.
            foreach (var section in performance.Sections)
            {
                if (!exercisesBySectionId.TryGetValue(section.SectionId, out var sectionExercises))
                    continue;

                section.Exercises = sectionExercises.Select(re => new WorkoutExercise
                {
                    ExerciseExternalId = re.ExerciseExternalId,
                    ExerciseName = re.ExerciseName,
                    WodResult = re.WodResult,
                    Sets = re.Sets.Select(rs =>
                    {
                        storedSetLookup.TryGetValue(
                            (section.SectionId, re.ExerciseExternalId, rs.SetNumber), out var stored);

                        return new WorkoutSet
                        {
                            SetNumber = rs.SetNumber,
                            Reps = rs.Reps,
                            WeightKg = rs.WeightKg,
                            Rpe = rs.Rpe,
                            DurationSeconds = rs.DurationSeconds,
                            DistanceMeters = rs.DistanceMeters,
                            CompletedAt = rs.CompletedAt,
                            PlannedReps = stored?.PlannedReps ?? rs.PlannedReps,
                            PlannedWeightKg = stored?.PlannedWeightKg ?? rs.PlannedWeightKg,
                            PlannedRpe = stored?.PlannedRpe ?? rs.PlannedRpe,
                            PlannedDurationSeconds = stored?.PlannedDurationSeconds ?? rs.PlannedDurationSeconds,
                            PlannedDistanceMeters = stored?.PlannedDistanceMeters ?? rs.PlannedDistanceMeters
                        };
                    }).ToList()
                }).ToList();
            }

            // Handle exercises for sections that don't exist yet in the stored log
            // (can happen on first write if the document was just created with no sections).
            var existingSectionIds = performance.Sections.Select(s => s.SectionId).ToHashSet();
            foreach (var (sectionId, sectionExercises) in exercisesBySectionId)
            {
                if (existingSectionIds.Contains(sectionId))
                    continue;

                // New section for this log — add it at the end.
                performance.Sections.Add(new WorkoutSection
                {
                    SectionId = sectionId,
                    Order = performance.Sections.Count,
                    Name = "Hlavní",
                    Exercises = sectionExercises.Select(re => new WorkoutExercise
                    {
                        ExerciseExternalId = re.ExerciseExternalId,
                        ExerciseName = re.ExerciseName,
                        WodResult = re.WodResult,
                        Sets = re.Sets.Select(rs => new WorkoutSet
                        {
                            SetNumber = rs.SetNumber,
                            Reps = rs.Reps,
                            WeightKg = rs.WeightKg,
                            Rpe = rs.Rpe,
                            DurationSeconds = rs.DurationSeconds,
                            DistanceMeters = rs.DistanceMeters,
                            CompletedAt = rs.CompletedAt,
                            PlannedReps = rs.PlannedReps,
                            PlannedWeightKg = rs.PlannedWeightKg,
                            PlannedRpe = rs.PlannedRpe,
                            PlannedDurationSeconds = rs.PlannedDurationSeconds,
                            PlannedDistanceMeters = rs.PlannedDistanceMeters
                        }).ToList()
                    }).ToList()
                });
            }
        }
        else
        {
            // ── Legacy / single-section path (no SectionId in request) ─────────────
            // All exercises are placed into a single default section.
            // This preserves backward compatibility with clients that do not send SectionId.
            // For multi-section logs that already exist, all request exercises collapse
            // into the first section — this is the existing behaviour for legacy clients.
            var fallbackSectionId = performance.Sections.Count > 0
                ? performance.Sections[0].SectionId
                : Guid.NewGuid();

            var exercises = req.Exercises.Select(re => new WorkoutExercise
            {
                ExerciseExternalId = re.ExerciseExternalId,
                ExerciseName = re.ExerciseName,
                WodResult = re.WodResult,
                Sets = re.Sets.Select(rs =>
                {
                    // For the legacy path, try the stored section's SectionId first,
                    // then fall back to any section that has this exercise+set pair
                    // (handles the rare case of a section-keyed lookup on a legacy client call).
                    storedSetLookup.TryGetValue(
                        (fallbackSectionId, re.ExerciseExternalId, rs.SetNumber), out var stored);

                    return new WorkoutSet
                    {
                        SetNumber = rs.SetNumber,
                        Reps = rs.Reps,
                        WeightKg = rs.WeightKg,
                        Rpe = rs.Rpe,
                        DurationSeconds = rs.DurationSeconds,
                        DistanceMeters = rs.DistanceMeters,
                        CompletedAt = rs.CompletedAt,
                        PlannedReps = stored?.PlannedReps ?? rs.PlannedReps,
                        PlannedWeightKg = stored?.PlannedWeightKg ?? rs.PlannedWeightKg,
                        PlannedRpe = stored?.PlannedRpe ?? rs.PlannedRpe,
                        PlannedDurationSeconds = stored?.PlannedDurationSeconds ?? rs.PlannedDurationSeconds,
                        PlannedDistanceMeters = stored?.PlannedDistanceMeters ?? rs.PlannedDistanceMeters
                    };
                }).ToList()
            }).ToList();

            if (performance.Sections.Count == 1)
            {
                performance.Sections[0].Exercises = exercises;
            }
            else
            {
                performance.Sections =
                [
                    new WorkoutSection
                    {
                        SectionId = fallbackSectionId,
                        Order = 0,
                        Name = "Hlavní",
                        Exercises = exercises
                    }
                ];
            }
        }

        log.DateUpdated = DateTime.UtcNow;

        await mongo.SessionExecutions.ReplaceOneAsync(
            w => w.ExternalId == req.LogId,
            log,
            cancellationToken: ct);

        // ── Best-effort PR detection side-effect ──────────────────────────────────
        // The log update is already committed above. A failure here must NOT fail
        // the response — the client contract is the log update, not PR bookkeeping.
        try
        {
            var prFlagsChanged = await DetectAndPersistPRsAsync(
                log, clientId, previouslyCompleted, notifier, ct);

            // If any IsPR flags were set on the in-memory log object, persist them
            // back with a second replace so the response and DB stay consistent.
            if (prFlagsChanged)
            {
                log.DateUpdated = DateTime.UtcNow;
                await mongo.SessionExecutions.ReplaceOneAsync(
                    w => w.ExternalId == req.LogId,
                    log,
                    cancellationToken: ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "PR detection side-effect failed for session execution {LogId}. Log update succeeded.",
                req.LogId);
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }

    // ── PR detection — inline helper, lives entirely within this slice ────────────
    // Returns true when at least one WorkoutSet.IsPR flag was flipped to true
    // (so the caller knows to persist the updated log).

    private async Task<bool> DetectAndPersistPRsAsync(
        SessionExecution log,
        Guid clientId,
        HashSet<(Guid SectionId, Guid ExerciseExternalId, int SetNumber)> previouslyCompleted,
        IRealtimeNotifier realtimeNotifier,
        CancellationToken ct)
    {
        // Collect newly-completed sets (CompletedAt moved null → non-null),
        // only for sets with both weight and reps recorded (required for comparison).
        // Key lookup uses (SectionId, ExerciseExternalId, SetNumber) to match the updated snapshot.
        var newlyCompletedByExercise = log.Performance!.Sections
            .SelectMany(sec => sec.Exercises
                .SelectMany(e => e.Sets
                    .Where(s =>
                        s.CompletedAt.HasValue &&
                        s.WeightKg.HasValue &&
                        s.Reps.HasValue &&
                        !previouslyCompleted.Contains((sec.SectionId, e.ExerciseExternalId, s.SetNumber)))
                    .Select(s => (Exercise: e, Set: s))))
            .GroupBy(x => x.Exercise.ExerciseExternalId)
            .ToList();

        if (newlyCompletedByExercise.Count == 0)
            return false;

        // ── Historical logs for prior-max lookups — fetched ONCE per request ───────
        // Exercises now live inside sections, so ElemMatch on a flat exercises field is not
        // available. Filter by clientId + completed + carries Performance + not-this-log;
        // exercise lookup is done in-memory per exercise group below. This query does not vary
        // by exercise, so it is hoisted above the per-exercise loop (see #661).
        var priorLogFilter = Builders<SessionExecution>.Filter.And(
            Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientId),
            Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Completed),
            Builders<SessionExecution>.Filter.Exists(w => w.Performance),
            Builders<SessionExecution>.Filter.Ne(w => w.ExternalId, log.ExternalId));

        using var priorCursor = await mongo.SessionExecutions.FindAsync(
            priorLogFilter,
            cancellationToken: ct);
        var priorLogs = await priorCursor.ToListAsync(ct);

        var anyPrFlagged = false;

        foreach (var exerciseGroup in newlyCompletedByExercise)
        {
            var exerciseExternalId = exerciseGroup.Key;
            var exercise = exerciseGroup.First().Exercise;

            // ── 1. Historical max from prior COMPLETED session executions ─────────
            decimal runningBestWeight = 0m;
            int runningBestReps = 0;

            foreach (var priorLog in priorLogs)
            {
                var priorEx = priorLog.Exercises
                    .FirstOrDefault(e => e.ExerciseExternalId == exerciseExternalId);

                if (priorEx is null) continue;

                foreach (var s in priorEx.Sets.Where(
                    s => s.CompletedAt.HasValue && s.WeightKg.HasValue && s.Reps.HasValue))
                {
                    if (s.WeightKg!.Value > runningBestWeight ||
                        (s.WeightKg.Value == runningBestWeight && s.Reps!.Value > runningBestReps))
                    {
                        runningBestWeight = s.WeightKg.Value;
                        runningBestReps = s.Reps!.Value;
                    }
                }
            }

            // ── 2. Historical max from PersonalRecord collection ──────────────────
            var existingPrFilter = Builders<PersonalRecord>.Filter.And(
                Builders<PersonalRecord>.Filter.Eq(r => r.ClientId, clientId),
                Builders<PersonalRecord>.Filter.Eq(r => r.ExerciseExternalId, exerciseExternalId));

            var existingPrSort = Builders<PersonalRecord>.Sort
                .Descending(r => r.WeightKg)
                .Descending(r => r.Reps);

            using var prCursor = await mongo.PersonalRecords.FindAsync(
                existingPrFilter,
                new FindOptions<PersonalRecord> { Sort = existingPrSort, Limit = 1 },
                ct);
            var bestExistingPr = await prCursor.FirstOrDefaultAsync(ct);

            if (bestExistingPr is not null)
            {
                if (bestExistingPr.WeightKg > runningBestWeight ||
                    (bestExistingPr.WeightKg == runningBestWeight &&
                     bestExistingPr.Reps > runningBestReps))
                {
                    runningBestWeight = bestExistingPr.WeightKg;
                    runningBestReps = bestExistingPr.Reps;
                }
            }

            // ── 3. Evaluate each newly-completed set with a running max ───────────
            // Ordering by SetNumber ensures lower sets are evaluated before higher ones.
            // Using a running max means a single call can emit multiple PRs for strictly
            // ascending sets, but a lower set after a higher one does not re-win.
            foreach (var item in exerciseGroup.OrderBy(x => x.Set.SetNumber))
            {
                var newSet = item.Set;
                var setWeight = newSet.WeightKg!.Value;
                var setReps = newSet.Reps!.Value;

                var isPR = setWeight > runningBestWeight ||
                           (setWeight == runningBestWeight && setReps > runningBestReps);

                if (!isPR)
                    continue;

                // In-app idempotency check: if a PR row already exists for this
                // (workoutLogId, exerciseExternalId, setNumber) triple, the set was
                // already processed — skip the insert but still honour the running max.
                // The unique Mongo index on the same triple provides the final atomicity
                // guarantee in case of a race between concurrent requests.
                var idempotencyFilter = Builders<PersonalRecord>.Filter.And(
                    Builders<PersonalRecord>.Filter.Eq(r => r.WorkoutLogId, log.ExternalId),
                    Builders<PersonalRecord>.Filter.Eq(r => r.ExerciseExternalId, exerciseExternalId),
                    Builders<PersonalRecord>.Filter.Eq(r => r.SetNumber, newSet.SetNumber));

                using var dupCursor = await mongo.PersonalRecords.FindAsync(
                    idempotencyFilter,
                    new FindOptions<PersonalRecord> { Limit = 1 },
                    ct);
                var existingRecord = await dupCursor.FirstOrDefaultAsync(ct);

                if (existingRecord is not null)
                {
                    // Already recorded — mark in-memory and advance the running max.
                    newSet.IsPR = true;
                    anyPrFlagged = true;
                    runningBestWeight = setWeight;
                    runningBestReps = setReps;
                    continue;
                }

                // Insert the PersonalRecord document.
                var pr = new PersonalRecord
                {
                    ExternalId = Guid.NewGuid(),
                    ClientId = clientId,
                    ExerciseExternalId = exerciseExternalId,
                    ExerciseName = exercise.ExerciseName,
                    WeightKg = setWeight,
                    Reps = setReps,
                    AchievedAt = newSet.CompletedAt!.Value,
                    WorkoutLogId = log.ExternalId,
                    SetNumber = newSet.SetNumber,
                    Version = 1,
                    DateCreated = DateTime.UtcNow
                };

                await mongo.PersonalRecords.InsertOneAsync(pr, cancellationToken: ct);

                // Mark the in-memory set so it's included in the second log replace.
                newSet.IsPR = true;
                anyPrFlagged = true;
                runningBestWeight = setWeight;
                runningBestReps = setReps;

                // ── Broadcast personalrecordachieved to client + active trainers ───────
                // Best-effort: failure must NOT surface as a request error.
                // The insert already committed above — we broadcast exactly once
                // per newly-inserted PR. Idempotency-skipped PRs do NOT reach here.
                await BroadcastPrAchievedAsync(pr, realtimeNotifier, ct);
            }
        }

        return anyPrFlagged;
    }

    private async Task BroadcastPrAchievedAsync(
        PersonalRecord pr,
        IRealtimeNotifier realtimeNotifier,
        CancellationToken ct)
    {
        var payload = new
        {
            ClientId = pr.ClientId,
            ExerciseExternalId = pr.ExerciseExternalId,
            ExerciseName = pr.ExerciseName,
            WeightKg = pr.WeightKg,
            Reps = pr.Reps,
            AchievedAt = pr.AchievedAt
        };

        try
        {
            // Notify the client themselves.
            await realtimeNotifier.NotifyAsync(pr.ClientId, "personalrecordachieved", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to broadcast personalrecordachieved to client {ClientId}.", pr.ClientId);
        }

        // Notify each active trainer linked to this client.
        List<Guid> trainerUserIds;
        try
        {
            trainerUserIds = await db.ClientProfessionalLinks
                .AsNoTracking()
                .Where(l => l.ClientProfile.UserId == pr.ClientId && l.IsActive)
                .Select(l => l.ProfessionalProfile.UserId)
                .ToListAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to look up active trainers for client {ClientId} during PR broadcast.", pr.ClientId);
            return;
        }

        foreach (var trainerId in trainerUserIds)
        {
            try
            {
                await realtimeNotifier.NotifyAsync(trainerId, "personalrecordachieved", payload, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to broadcast personalrecordachieved to trainer {TrainerId}.", trainerId);
            }
        }
    }
}
