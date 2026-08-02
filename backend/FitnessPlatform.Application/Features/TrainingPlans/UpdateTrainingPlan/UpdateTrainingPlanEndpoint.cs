using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Full-state update of a training plan: replaces name, description, and all weeks/sessions/exercises/sets.
/// Preserves per-week Status and DatePublished. Uses optimistic concurrency.
/// For published sessions with content changes, an active Editing lock held by this trainer is required.
/// Draft-week sessions are always editable without a lock.
/// Emits <c>sessioneditlockchanged</c> (state=Stable) to both client and trainer for each diff-gated
/// session whose Editing lock is auto-released after a successful save.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service for diff-gate enforcement.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
/// <param name="guard">Shared version-gated fetch-check-replace-409 skeleton.</param>
/// <param name="db">PostgreSQL context — resolves the client's PublicId for the response.</param>
public class UpdateTrainingPlanEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IRealtimeNotifier notifier,
    PlanConcurrencyGuard guard,
    IApplicationDbContext db)
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

        var lookupFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);
        var replaceFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        // Populated inside the mutate delegate (diff-gate), consumed after a confirmed
        // successful replace to auto-release Editing locks.
        var changedSessionIds = new List<Guid>();

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.TrainingPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            async (plan, mutateCt) =>
            {
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
                    return false;
                }

                // Start date validation
                var today = DateOnly.FromDateTime(DateTime.UtcNow);

                if (plan.StartDate.HasValue && req.StartDate?.Date != plan.StartDate.Value.Date)
                {
                    // Trying to change or clear an existing start date
                    if (DateOnly.FromDateTime(plan.StartDate.Value) < today)
                    {
                        ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be changed after it has arrived.");
                        return false;
                    }

                    // Clearing: only allowed if no weeks are published
                    if (!req.StartDate.HasValue && plan.Weeks.Any(w => w.Status == WeekStatus.Published))
                    {
                        ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be cleared when weeks are published.");
                        return false;
                    }
                }

                if (req.StartDate.HasValue)
                {
                    if (req.StartDate.Value.DayOfWeek != System.DayOfWeek.Monday)
                    {
                        ThrowError(ErrorCodes.StartDateNotMonday, "Start date must be a Monday.");
                        return false;
                    }

                    // Only enforce "not in past" when the start date is being set or changed.
                    // A plan that has already started naturally has a past start date in every
                    // subsequent save — that must not block editing of other fields.
                    var isStartDateNewOrChanged = !plan.StartDate.HasValue
                        || req.StartDate.Value.Date != plan.StartDate.Value.Date;
                    if (isStartDateNewOrChanged && DateOnly.FromDateTime(req.StartDate.Value) < today)
                    {
                        ThrowError(ErrorCodes.StartDateInPast, "Start date cannot be in the past.");
                        return false;
                    }
                }

                // ── Diff-gate: check published sessions for content changes ──────────
                //
                // Ordering per spec §6 and design-review directives:
                //   1. After the Version check (guard, above).
                //   2. Before ReplaceOneAsync (guard, below).
                //   3. Auto-release Editing locks only after ModifiedCount > 0 (post-guard, below).
                //
                // Key change-detection on stable SessionId; do NOT diff on freshly-assigned
                // SectionId Guids (they are minted at map time and are not stable).
                //
                // Draft weeks are never gated.

                // Build a map of stored published sessions keyed by SessionId.
                var storedPublishedSessions = plan.Weeks
                    .Where(w => w.Status == WeekStatus.Published)
                    .SelectMany(w => w.Sessions)
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
                    return false;
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
                    var activeLocks = await lockService.GetStateAsync(changedSessionIds, mutateCt);
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
                            mutateCt);
                        return false;
                    }

                    // ── Section-finished guard (issue #465) ───────────────────────────────
                    // For each locked session, check whether any changed section has already been
                    // completed by the client. #841: both signals (finished live workout, home-
                    // checkbox completion) now live on the SAME SessionExecution document — one
                    // query covers both. If any changed section is finished → 409 SECTION_ALREADY_COMPLETED.
                    //
                    // Only runs for sessions that have an Editing lock (editingLocksBySession).
                    // Sessions without a lock have already been rejected above.

                    var lockedChangedSessionIds = changedSessionIds
                        .Where(sid => editingLocksBySession.Contains(sid))
                        .ToList();

                    if (lockedChangedSessionIds.Count > 0)
                    {
                        var clientId = plan.ClientId;

                        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                                               & Builders<SessionExecution>.Filter.In(c => c.SessionId, lockedChangedSessionIds.Cast<Guid?>());
                        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: mutateCt);
                        var executionDocs = await executionCursor.ToListAsync(mutateCt);
                        var bestExecutionBySession = executionDocs
                            .GroupBy(c => c.SessionId)
                            .ToDictionary(g => g.Key!.Value,
                                g => g.OrderByDescending(c => c.DateUpdated ?? c.DateCreated).First());

                        // Check each locked session for section-level completions.
                        foreach (var sessionId in lockedChangedSessionIds)
                        {
                            if (!storedPublishedSessions.TryGetValue(sessionId, out var storedSession))
                                continue;
                            if (!incomingPublishedSessions.TryGetValue(sessionId, out var incomingSession))
                                continue;

                            bestExecutionBySession.TryGetValue(sessionId, out var bestExecution);

                            // Skip sessions with no completion data (nothing to guard).
                            if (bestExecution is null) continue;

                            // Build a lookup of incoming sections by SectionId (only those with a non-null SectionId).
                            var incomingSectionsBySectionId = incomingSession.Sections
                                .Where(rs => rs.SectionId.HasValue)
                                .ToDictionary(rs => rs.SectionId!.Value);

                            foreach (var storedSection in storedSession.Workouts)
                            {
                                // Determine whether this section's content has changed.
                                bool sectionChanged;
                                if (!incomingSectionsBySectionId.TryGetValue(storedSection.WorkoutId, out var incomingSectionValue))
                                {
                                    // Section removed from incoming request — counts as changed.
                                    sectionChanged = true;
                                }
                                else
                                {
                                    sectionChanged = HasSectionContentChanged(storedSection, incomingSectionValue);
                                }

                                if (!sectionChanged) continue;

                                // Section content changed — check if it's already completed.
                                var sectionIsCompleted = bestExecution.IsWorkoutComplete(storedSession, storedSection);

                                if (sectionIsCompleted)
                                {
                                    await this.SendProblemAsync(
                                        409,
                                        ErrorCodes.SectionAlreadyCompleted,
                                        $"Section {storedSection.WorkoutId} in session {sessionId} has already been completed by the client and cannot be edited.",
                                        mutateCt);
                                    return false;
                                }
                            }
                        }
                    }
                    // ── End section-finished guard ────────────────────────────────────────
                }
                // ── End diff-gate ─────────────────────────────────────────────────────

                // Map request to domain
                plan.Name = req.Name;
                plan.StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null;
                plan.Description = req.Description?.Trim();
                // Transitional guard: web/mobile clients built against the pre-#493 Swagger do not
                // yet send Goal/TargetWeightKg in their update payloads, so the fields arrive as
                // null. Blindly assigning would clobber a goal set at create-time or via the
                // backfill migration. Preserve the stored value whenever the caller omits the field.
                // Explicit clear-to-null will be supported once regen-api ships the updated contract.
                if (req.Goal.HasValue) plan.Goal = req.Goal;
                if (req.TargetWeightKg.HasValue) plan.TargetWeightKg = req.TargetWeightKg;
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
                            Workouts = rs.Sections.Select(rsec => new TrainingWorkout
                            {
                                WorkoutId = rsec.SectionId ?? Guid.NewGuid(),
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

                return true;
            },
            ct);

        switch (guardResult.Outcome)
        {
            case PlanConcurrencyOutcome.NotFound:
                await Send.NotFoundAsync(ct);
                return;
            case PlanConcurrencyOutcome.VersionConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.ReplaceConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.HandledByMutator:
                // Response already written directly inside the mutate delegate
                // (SessionLocked / SectionAlreadyCompleted 409s).
                return;
        }

        var plan = guardResult.Document!;

        // Auto-release Editing locks for the changed sessions — ONLY after a successful save
        // (ModifiedCount > 0). A version-conflict loss must NOT release the lock.
        // Only emit sessioneditlockchanged when ReleaseAsync returns true — emitting Stable
        // for a session that had no lock would be spurious fan-out (the session may have been
        // unlocked, saved, and already auto-released by a previous request).
        foreach (var sessionId in changedSessionIds)
        {
            var released = await lockService.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);

            if (released)
            {
                var payload = new SessionLockChangedPayload(
                    plan.ExternalId,
                    sessionId,
                    "Stable",
                    "Coach");

                await notifier.NotifyAsync(plan.ClientId, "sessioneditlockchanged", payload, ct);
                await notifier.NotifyAsync(trainerId, "sessioneditlockchanged", payload, ct);
            }
        }

        // Response ClientId must stay the client-facing ClientProfile.PublicId (pre-#840
        // contract) — plan.ClientId is the internal ApplicationUser.Id storage key.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan, clientPublicId), ct);
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
        var storedSections = stored.Workouts.OrderBy(s => s.Order).ToList();
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
    /// Returns true when the content of a single stored section differs from the incoming
    /// update request section. Keyed on <see cref="TrainingWorkout.WorkoutId"/> (caller's
    /// responsibility). Compares Order, Name, Format, Notes, FormatConfig, and all exercises
    /// and their sets (by positional order within the section).
    /// </summary>
    private static bool HasSectionContentChanged(TrainingWorkout stored, UpdateSectionRequest incoming)
    {
        if (stored.Order != incoming.Order) return true;
        if (stored.Name != incoming.Name) return true;
        if (stored.Format != incoming.Format) return true;
        if (stored.Notes?.Trim() != incoming.Notes?.Trim()) return true;
        if (!FormatConfigEqual(stored.FormatConfig, incoming.FormatConfig)) return true;

        var storedExercises = stored.Exercises.OrderBy(e => e.Order).ToList();
        var incomingExercises = incoming.Exercises.OrderBy(e => e.Order).ToList();

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
