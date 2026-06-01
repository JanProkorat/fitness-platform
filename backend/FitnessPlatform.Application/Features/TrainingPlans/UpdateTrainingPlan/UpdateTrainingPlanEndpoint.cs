using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Full-state update of a training plan: replaces name, description, and all weeks/sessions/exercises/sets.
/// Preserves per-week Status and DatePublished. Uses optimistic concurrency.
/// For published sessions with content changes, an active Editing lock held by this trainer is required.
/// Draft-week sessions are always editable without a lock.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service for diff-gate enforcement.</param>
public class UpdateTrainingPlanEndpoint(IMongoContext mongo, ISessionLockService lockService)
    : Endpoint<UpdateTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Full-state update of a training plan";
            s.Description = "Replaces the plan's name, description, and all weeks/sessions/exercises/sets. " +
                            "Per-week publish status is preserved. Uses optimistic concurrency via version field. " +
                            "Published sessions with content changes require an active Editing lock.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Fetch current plan (ownership guard: TrainerId == trainerId).
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Optimistic concurrency check — must precede diff-gate.
        if (plan.Version != req.Version)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        // Build lookup of existing week statuses
        var existingWeeks = plan.Weeks.ToDictionary(w => w.WeekNumber);

        // Check that no published weeks are being removed
        var incomingWeekNumbers = req.Weeks.Select(w => w.WeekNumber).ToHashSet();
        var removedPublished = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published && !incomingWeekNumbers.Contains(w.WeekNumber))
            .ToList();

        if (removedPublished.Count > 0)
        {
            ThrowError($"Cannot remove published weeks: {string.Join(", ", removedPublished.Select(w => w.WeekNumber))}");
            return;
        }

        // Start date validation
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (plan.StartDate.HasValue && req.StartDate?.Date != plan.StartDate.Value.Date)
        {
            // Trying to change or clear an existing start date
            if (DateOnly.FromDateTime(plan.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be changed after it has arrived.");
                return;
            }

            // Clearing: only allowed if no weeks are published
            if (!req.StartDate.HasValue && plan.Weeks.Any(w => w.Status == WeekStatus.Published))
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be cleared when weeks are published.");
                return;
            }
        }

        if (req.StartDate.HasValue)
        {
            if (req.StartDate.Value.DayOfWeek != System.DayOfWeek.Monday)
            {
                ThrowError(ErrorCodes.StartDateNotMonday, "Start date must be a Monday.");
                return;
            }

            // Only enforce "not in past" when the start date is being set or changed.
            // A plan that has already started naturally has a past start date in every
            // subsequent save — that must not block editing of other fields.
            var isStartDateNewOrChanged = !plan.StartDate.HasValue
                || req.StartDate.Value.Date != plan.StartDate.Value.Date;
            if (isStartDateNewOrChanged && DateOnly.FromDateTime(req.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateInPast, "Start date cannot be in the past.");
                return;
            }
        }

        // ── Diff-gate: check published sessions for content changes ──────────
        //
        // Ordering per spec §6 and design-review directives:
        //   1. After the Version check (above).
        //   2. Before ReplaceOneAsync (below).
        //   3. Auto-release Editing locks only after ModifiedCount > 0.
        //
        // Run the projection on the backfilled section view for BOTH stored and
        // incoming sessions so legacy flat-exercise docs don't false-positive.
        // Key change-detection on stable SessionId; do NOT diff on freshly-assigned
        // SectionId Guids (they are minted at map time and are not stable).
        //
        // Draft weeks are never gated.

        // Build a map of stored published sessions keyed by SessionId.
        var storedPublishedSessions = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .SelectMany(w => w.Sessions)
            .Select(s => s.WithBackfilledSections())
            .ToDictionary(s => s.SessionId);

        // Pre-flight: every session in a published week must carry a non-null SessionId.
        // A null SessionId in a published week would create a new session while silently
        // dropping the stored published session — bypassing the diff-gate entirely (M1).
        var publishedWeekNumbersSet = existingWeeks
            .Where(kv => kv.Value.Status == WeekStatus.Published)
            .Select(kv => kv.Key)
            .ToHashSet();

        var publishedWeekSessionsMissingId = req.Weeks
            .Where(rw => publishedWeekNumbersSet.Contains(rw.WeekNumber))
            .SelectMany(rw => rw.Sessions)
            .Any(rs => !rs.SessionId.HasValue);

        if (publishedWeekSessionsMissingId)
        {
            ThrowError(
                "Every session in a published week must include a SessionId. " +
                "Omitting or nulling a SessionId in a published week is not allowed.");
            return;
        }

        // Build a map of incoming sessions for published weeks keyed by SessionId.
        // The pre-flight above guarantees all sessions in published weeks have a non-null
        // SessionId, so the .Where(HasValue) filter here is now a defensive no-op.
        var incomingPublishedSessions = req.Weeks
            .Where(rw => publishedWeekNumbersSet.Contains(rw.WeekNumber))
            .SelectMany(rw => rw.Sessions)
            .Where(rs => rs.SessionId.HasValue)
            .ToDictionary(rs => rs.SessionId!.Value);

        // Identify which stored published sessions have content changes OR have been removed/replaced.
        // A stored published session that is absent from the incoming map is treated the same as a
        // changed session — removing or replacing a published session requires an Editing lock (M1).
        var changedSessionIds = new List<Guid>();
        foreach (var (sessionId, storedSession) in storedPublishedSessions)
        {
            if (!incomingPublishedSessions.TryGetValue(sessionId, out var incomingSession))
            {
                // Session removed or replaced — gate it; removing a published session is a
                // structural change that requires an Editing lock.
                changedSessionIds.Add(sessionId);
                continue;
            }

            if (HasContentChanged(storedSession, incomingSession))
                changedSessionIds.Add(sessionId);
        }

        if (changedSessionIds.Count > 0)
        {
            // Load active Editing locks for the changed sessions.
            var activeLocks = await lockService.GetStateAsync(changedSessionIds, ct);
            var editingLocksBySession = activeLocks
                .Where(l => l.Type == LockType.Editing
                         && l.Holder == LockHolder.Coach
                         && l.TrainerId == trainerId)
                .Select(l => l.SessionId)
                .ToHashSet();

            // Any changed published session not currently in Editing by THIS trainer → 409.
            var ungatedSessions = changedSessionIds
                .Where(sid => !editingLocksBySession.Contains(sid))
                .ToList();

            if (ungatedSessions.Count > 0)
            {
                await this.SendProblemAsync(
                    409,
                    ErrorCodes.SessionLocked,
                    $"Published sessions must be unlocked for editing before saving changes. " +
                    $"Offending session IDs: {string.Join(", ", ungatedSessions)}",
                    ct);
                return;
            }
        }
        // ── End diff-gate ─────────────────────────────────────────────────────

        // Map request to domain
        plan.Name = req.Name;
        plan.StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null;
        plan.Description = req.Description?.Trim();
        plan.Weeks = req.Weeks.Select(rw =>
        {
            var existing = existingWeeks.GetValueOrDefault(rw.WeekNumber);
            return new TrainingWeek
            {
                WeekNumber = rw.WeekNumber,
                Status = existing?.Status ?? WeekStatus.Draft,
                DatePublished = existing?.DatePublished,
                DayNotes = rw.DayNotes?.Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                    .ToDictionary(kv => kv.Key, kv => kv.Value.Trim()),
                Sessions = rw.Sessions.Select(rs => new TrainingSession
                {
                    SessionId = rs.SessionId ?? Guid.NewGuid(),
                    DayOfWeek = rs.DayOfWeek,
                    Name = rs.Name,
                    Order = rs.Order,
                    Notes = rs.Notes?.Trim(),
                    Format = rs.Format,
                    FormatConfig = rs.FormatConfig,
                    Sections = rs.Sections.Select(rsec => new TrainingSection
                    {
                        SectionId = rsec.SectionId ?? Guid.NewGuid(),
                        Order = rsec.Order,
                        Name = rsec.Name,
                        Format = rsec.Format,
                        FormatConfig = rsec.FormatConfig,
                        Notes = rsec.Notes?.Trim(),
                        Exercises = rsec.Exercises.Select(re => new SessionExercise
                        {
                            ExerciseExternalId = re.ExerciseExternalId,
                            ExerciseName = re.ExerciseName,
                            Order = re.Order,
                            Notes = re.Notes?.Trim(),
                            RestSeconds = re.RestSeconds,
                            MovementType = re.MovementType,
                            Format = re.Format,
                            FormatConfig = re.FormatConfig,
                            Sets = re.Sets.Select(rset => new ExerciseSet
                            {
                                SetNumber = rset.SetNumber,
                                Type = rset.Type,
                                Reps = rset.Reps,
                                WeightKg = rset.WeightKg,
                                DurationSeconds = rset.DurationSeconds,
                                Rpe = rset.Rpe,
                                DistanceMeters = rset.DistanceMeters,
                                RestSeconds = rset.RestSeconds
                            }).ToList()
                        }).ToList()
                    }).ToList()
                }).ToList()
            };
        }).ToList();

        // Derive plan-level status from week statuses
        plan.Status = plan.Weeks.Any(w => w.Status == WeekStatus.Published)
            ? TrainingPlanStatus.Active
            : TrainingPlanStatus.Draft;

        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        // Persist with version check
        var versionFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.TrainingPlans.ReplaceOneAsync(
            versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        // Auto-release Editing locks for the changed sessions — ONLY after a successful save
        // (ModifiedCount > 0). A version-conflict loss must NOT release the lock.
        foreach (var sessionId in changedSessionIds)
        {
            await lockService.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);
        }

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }

    /// <summary>
    /// Computes a normalized content projection for a stored session and an incoming request
    /// session (both already backfilled to section view) and returns true if the content differs.
    /// Keys on section order/name/format/notes and exercise content; does NOT key on SectionId Guids
    /// (they are freshly-assigned at map time and are not stable identifiers).
    /// </summary>
    private static bool HasContentChanged(TrainingSession stored, UpdateSessionRequest incoming)
    {
        // Compare session-level content fields.
        if (stored.DayOfWeek != incoming.DayOfWeek) return true;
        if (stored.Name != incoming.Name) return true;
        if (stored.Order != incoming.Order) return true;
        if (stored.Notes?.Trim() != incoming.Notes?.Trim()) return true;
        if (stored.Format != incoming.Format) return true;
        if (!FormatConfigEqual(stored.FormatConfig, incoming.FormatConfig)) return true;

        // Compare sections by structural content (order, name, format, notes, exercises).
        // Do NOT compare SectionId — incoming sections may have newly-assigned Guids.
        var storedSections = stored.Sections.OrderBy(s => s.Order).ToList();
        var incomingSections = incoming.Sections.OrderBy(s => s.Order).ToList();

        if (storedSections.Count != incomingSections.Count) return true;

        for (var i = 0; i < storedSections.Count; i++)
        {
            var ss = storedSections[i];
            var rs = incomingSections[i];

            if (ss.Order != rs.Order) return true;
            if (ss.Name != rs.Name) return true;
            if (ss.Format != rs.Format) return true;
            if (ss.Notes?.Trim() != rs.Notes?.Trim()) return true;
            if (!FormatConfigEqual(ss.FormatConfig, rs.FormatConfig)) return true;

            // Compare exercises within this section.
            var storedExercises = ss.Exercises.OrderBy(e => e.Order).ToList();
            var incomingExercises = rs.Exercises.OrderBy(e => e.Order).ToList();

            if (storedExercises.Count != incomingExercises.Count) return true;

            for (var j = 0; j < storedExercises.Count; j++)
            {
                var se = storedExercises[j];
                var re = incomingExercises[j];

                if (se.ExerciseExternalId != re.ExerciseExternalId) return true;
                if (se.ExerciseName != re.ExerciseName) return true;
                if (se.Order != re.Order) return true;
                if (se.Notes?.Trim() != re.Notes?.Trim()) return true;
                if (se.RestSeconds != re.RestSeconds) return true;
                if (se.MovementType != re.MovementType) return true;
                if (se.Format != re.Format) return true;
                if (!FormatConfigEqual(se.FormatConfig, re.FormatConfig)) return true;

                // Compare sets.
                var storedSets = se.Sets.OrderBy(s => s.SetNumber).ToList();
                var incomingSets = re.Sets.OrderBy(s => s.SetNumber).ToList();

                if (storedSets.Count != incomingSets.Count) return true;

                for (var k = 0; k < storedSets.Count; k++)
                {
                    var storedSet = storedSets[k];
                    var incomingSet = incomingSets[k];

                    if (storedSet.SetNumber != incomingSet.SetNumber) return true;
                    if (storedSet.Type != incomingSet.Type) return true;
                    if (storedSet.Reps != incomingSet.Reps) return true;
                    if (storedSet.WeightKg != incomingSet.WeightKg) return true;
                    if (storedSet.DurationSeconds != incomingSet.DurationSeconds) return true;
                    if (storedSet.Rpe != incomingSet.Rpe) return true;
                    if (storedSet.DistanceMeters != incomingSet.DistanceMeters) return true;
                    if (storedSet.RestSeconds != incomingSet.RestSeconds) return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Equality check for <see cref="WodConfig"/> nullable pairs.
    /// </summary>
    private static bool FormatConfigEqual(WodConfig? a, WodConfig? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;

        return a.IntervalSeconds == b.IntervalSeconds
            && a.TimeCapSeconds == b.TimeCapSeconds
            && a.TotalRounds == b.TotalRounds
            && a.WorkSeconds == b.WorkSeconds
            && a.RestSeconds == b.RestSeconds;
    }
}
