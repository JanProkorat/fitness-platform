using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;

/// <summary>
/// Progressively updates a workout log with exercise/set data.
/// Designed for offline-first: replaces all exercise data with current state.
/// As a best-effort side-effect, detects newly-completed sets that beat the
/// client's historical best weight (tie-broken by reps) and writes a
/// <see cref="PersonalRecord"/> document for each one, then marks the
/// corresponding <see cref="WorkoutSet.IsPR"/> flag on the log.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="logger">Logger for best-effort PR warning messages.</param>
public class UpdateWorkoutEndpoint(
    IMongoContext mongo,
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

        var filter = Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, req.LogId)
                     & Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientId)
                     & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, false);

        using var cursor = await mongo.WorkoutLogs.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // ── Snapshot previously-completed sets BEFORE we overwrite them ──────────
        // Key: (exerciseExternalId, setNumber) → true if already completed.
        // Used downstream to determine which sets are *newly* completed this call.
        var previouslyCompleted = log.Exercises
            .SelectMany(e => e.Sets
                .Where(s => s.CompletedAt.HasValue)
                .Select(s => (e.ExerciseExternalId, s.SetNumber)))
            .ToHashSet();

        // ── Build new exercise list from request ──────────────────────────────────
        log.Mood = req.Mood;
        log.Notes = req.Notes?.Trim();
        log.Exercises = req.Exercises.Select(re => new WorkoutExercise
        {
            ExerciseExternalId = re.ExerciseExternalId,
            ExerciseName = re.ExerciseName,
            Sets = re.Sets.Select(rs => new WorkoutSet
            {
                SetNumber = rs.SetNumber,
                Reps = rs.Reps,
                WeightKg = rs.WeightKg,
                Rpe = rs.Rpe,
                DurationSeconds = rs.DurationSeconds,
                DistanceMeters = rs.DistanceMeters,
                CompletedAt = rs.CompletedAt
            }).ToList()
        }).ToList();
        log.DateUpdated = DateTime.UtcNow;

        await mongo.WorkoutLogs.ReplaceOneAsync(
            w => w.ExternalId == req.LogId,
            log,
            cancellationToken: ct);

        // ── Best-effort PR detection side-effect ──────────────────────────────────
        // The log update is already committed above. A failure here must NOT fail
        // the response — the client contract is the log update, not PR bookkeeping.
        try
        {
            var prFlagsChanged = await DetectAndPersistPRsAsync(
                log, clientId, previouslyCompleted, ct);

            // If any IsPR flags were set on the in-memory log object, persist them
            // back with a second replace so the response and DB stay consistent.
            if (prFlagsChanged)
            {
                log.DateUpdated = DateTime.UtcNow;
                await mongo.WorkoutLogs.ReplaceOneAsync(
                    w => w.ExternalId == req.LogId,
                    log,
                    cancellationToken: ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "PR detection side-effect failed for workout log {LogId}. Log update succeeded.",
                req.LogId);
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }

    // ── PR detection — inline helper, lives entirely within this slice ────────────
    // Returns true when at least one WorkoutSet.IsPR flag was flipped to true
    // (so the caller knows to persist the updated log).

    private async Task<bool> DetectAndPersistPRsAsync(
        WorkoutLog log,
        Guid clientId,
        HashSet<(Guid ExerciseExternalId, int SetNumber)> previouslyCompleted,
        CancellationToken ct)
    {
        // Collect newly-completed sets (CompletedAt moved null → non-null),
        // only for sets with both weight and reps recorded (required for comparison).
        var newlyCompletedByExercise = log.Exercises
            .SelectMany(e => e.Sets
                .Where(s =>
                    s.CompletedAt.HasValue &&
                    s.WeightKg.HasValue &&
                    s.Reps.HasValue &&
                    !previouslyCompleted.Contains((e.ExerciseExternalId, s.SetNumber)))
                .Select(s => (Exercise: e, Set: s)))
            .GroupBy(x => x.Exercise.ExerciseExternalId)
            .ToList();

        if (newlyCompletedByExercise.Count == 0)
            return false;

        var anyPrFlagged = false;

        foreach (var exerciseGroup in newlyCompletedByExercise)
        {
            var exerciseExternalId = exerciseGroup.Key;
            var exercise = exerciseGroup.First().Exercise;

            // ── 1. Historical max from prior COMPLETED workout logs ───────────────
            // Filter to logs that actually contain this exercise to minimise scan.
            var priorLogFilter = Builders<WorkoutLog>.Filter.And(
                Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientId),
                Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true),
                Builders<WorkoutLog>.Filter.Ne(w => w.ExternalId, log.ExternalId),
                Builders<WorkoutLog>.Filter.ElemMatch(
                    w => w.Exercises,
                    Builders<WorkoutExercise>.Filter.Eq(e => e.ExerciseExternalId, exerciseExternalId)));

            using var priorCursor = await mongo.WorkoutLogs.FindAsync(
                priorLogFilter,
                cancellationToken: ct);
            var priorLogs = await priorCursor.ToListAsync(ct);

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
            foreach (var (_, newSet) in exerciseGroup.OrderBy(x => x.Set.SetNumber))
            {
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
            }
        }

        return anyPrFlagged;
    }
}
