using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GetFullPlan;

/// <summary>
/// Returns the full structure of a specific training plan for the authenticated client.
/// Enriches each exercise with muscle-group data (batch-fetched from the Exercise collection)
/// and per-set completion state (derived from <see cref="WorkoutLog"/> documents AND
/// <see cref="TrainingCompletion"/> documents — the former is populated by the live-workout
/// assistant, the latter by the lightweight mark-complete toggles on the Today card).
/// Also enriches each session DTO with its current lock state (Stable/Editing/Live)
/// and holder (Coach/Client/null) via a single batch <c>GetStateAsync</c> call.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="lockService">Session lock service — used to batch-fetch lock state.</param>
public class GetFullTrainingPlanEndpoint(IMongoContext mongo, IApplicationDbContext db, ISessionLockService lockService)
    : EndpointWithoutRequest<GetFullTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/training/plans/{planId:guid}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get full training plan";
            s.Description =
                "Returns all published weeks of the specified training plan enriched with " +
                "muscle-group data and per-set completion state derived from workout logs.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // ── 1. Resolve ClientProfile ─────────────────────────────────────────────
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840) — WorkoutLog,
        // TrainingPlan, and TrainingCompletion all key on the same value now, so a
        // single variable serves every collection queried below.
        var clientId = clientProfile.UserId;
        var planId = Route<Guid>("planId");

        // ── 2. Fetch training plan (ownership check baked into filter) ────────────
        // Filtering on both ExternalId and ClientId means a plan belonging to
        // another client simply returns null — same response as "not found",
        // which avoids leaking existence to non-owners.
        var planFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId));

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // ── 3. Batch-fetch Exercise docs for muscle-group enrichment ──────────────
        var exerciseIds = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .SelectMany(s => s.Exercises)
            .Select(e => e.ExerciseExternalId)
            .Distinct()
            .ToList();

        Dictionary<Guid, List<MuscleGroup>> muscleGroupMap = new();

        if (exerciseIds.Count > 0)
        {
            var exerciseFilter = Builders<Exercise>.Filter.In(e => e.ExternalId, exerciseIds);
            var exerciseDocs = await mongo.Exercises
                .Find(exerciseFilter)
                .Project(e => new { e.ExternalId, e.MuscleGroups })
                .ToListAsync(ct);

            foreach (var ex in exerciseDocs)
                muscleGroupMap[ex.ExternalId] = ex.MuscleGroups;
        }

        // ── 4. Fetch all SessionExecution docs for this client + plan's sessions (#841) ──
        // Walk them once to build a lookup keyed by (sessionId, exerciseExternalId, setNumber).
        // A set is "completed" when it has a CompletedAt value in WorkoutSet (Performance data),
        // OR when the checkbox completion flags mark the exercise/set done (folded in below).
        // We prefer the earliest non-null CompletedAt per set if multiple executions exist for
        // the same session.
        var planSessionIds = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .Select(s => s.SessionId)
            .ToList();

        var executionFilter = Builders<SessionExecution>.Filter.And(
            Builders<SessionExecution>.Filter.Eq(l => l.ClientId, clientId),
            Builders<SessionExecution>.Filter.In(l => l.SessionId, planSessionIds.Cast<Guid?>()));

        var executions = await mongo.SessionExecutions
            .Find(executionFilter)
            .ToListAsync(ct);

        var executionsWithPerformance = executions.Where(e => e.Performance is not null).ToList();

        // Key: (sessionId, exerciseExternalId, setNumber) → completedAt
        // If a session was logged more than once we take the earliest non-null completedAt
        // per set so accidental duplicate logs don't wipe completion state.
        var completedSets = new Dictionary<(Guid sessionId, Guid exerciseId, int setNumber), DateTime>();

        // Extended lookup: (sessionId, exerciseId, setNumber) → WorkoutSet for actual+planned values.
        // We prefer the most-recently-updated execution per session (mirrors the dedup logic used
        // elsewhere). If two executions for the same session have the set, the "best" one wins.
        var loggedSets = new Dictionary<(Guid sessionId, Guid exerciseId, int setNumber), WorkoutSet>();

        // Deduplicate executions per sessionId: prefer most-recently-updated FINALISED, else most-recent.
        var bestLogBySession = executionsWithPerformance
            .Where(l => l.SessionId.HasValue)
            .GroupBy(l => l.SessionId!.Value)
            .Select(g =>
            {
                var finalised = g
                    .Where(l => l.Status == SessionExecutionStatus.Completed)
                    .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
                    .FirstOrDefault();
                return finalised ?? g.OrderByDescending(l => l.DateUpdated ?? l.DateCreated).First();
            })
            .ToList();

        foreach (var log in bestLogBySession)
        {
            var sessionId = log.SessionId!.Value;
            foreach (var ex in log.Exercises)
            {
                foreach (var set in ex.Sets)
                {
                    var key = (sessionId, ex.ExerciseExternalId, set.SetNumber);
                    loggedSets[key] = set;
                }
            }
        }

        foreach (var log in executionsWithPerformance)
        {
            if (log.SessionId is null) continue;
            var sessionId = log.SessionId.Value;

            foreach (var ex in log.Exercises)
            {
                foreach (var set in ex.Sets)
                {
                    if (set.CompletedAt is null) continue;

                    var key = (sessionId, ex.ExerciseExternalId, set.SetNumber);
                    if (!completedSets.ContainsKey(key) || set.CompletedAt < completedSets[key])
                        completedSets[key] = set.CompletedAt.Value;
                }
            }
        }

        // ── 4b. Fold in checkbox completion flags ─────────────────────────────────
        // The lightweight Today-card checkboxes (mark-exercise-complete / mark-session-complete)
        // write completion flags on the SAME SessionExecution document (#841). Merge those into
        // the same completedSets lookup so the plan-detail view reflects both surfaces.
        //
        // SessionId is globally unique within a plan, so we can match by sessionId
        // alone and skip the Date → WeekNumber mapping.

        // Inner dict is keyed by ExerciseExternalId, but the same catalog
        // exercise can legitimately appear in multiple sections of a single
        // session (e.g. "Bench press" in both a warm-up and the main block).
        // Plain `ToDictionary` would crash on the duplicate key — collapse
        // duplicates by taking the first occurrence per catalog id; downstream
        // code only needs ANY matching planned exercise to look up its set
        // list, and shared-catalog instances within one session have identical
        // set-number prescriptions when resolved via the section-aware map.
        var sessionExerciseLookup = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .ToDictionary(
                s => s.SessionId,
                s => s.Exercises
                    .GroupBy(e => e.ExerciseExternalId)
                    .ToDictionary(g => g.Key, g => g.First()));

        // Session lookup for resolving the section-aware completed-exercise view below.
        var sessionLookup = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .ToDictionary(s => s.SessionId);

        var completedSectionIdsBySession = executions
            .Where(e => e.SessionId.HasValue)
            .GroupBy(e => e.SessionId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.SelectMany(e => e.CompletedWorkoutIds ?? new List<Guid>()).ToHashSet());

        foreach (var execution in executions.Where(e => e.SessionId.HasValue))
        {
            var sessionId = execution.SessionId!.Value;

            if (!sessionExerciseLookup.TryGetValue(sessionId, out var exLookup))
                continue;

            var stampedAt = execution.DateUpdated ?? execution.DateCreated;

            // Fully-completed exercises: mark every planned set as complete.
            // Sourced from the flat CompletedExerciseInstanceIds list (#857 phase 3b) — mapped
            // back to catalog ExerciseExternalId via the session definition, since exLookup
            // (below) is keyed by ExerciseExternalId.
            var effectiveIds = sessionLookup.TryGetValue(sessionId, out var execSession)
                ? execSession.Exercises
                    .Where(e => execution.CompletedExerciseInstanceIds.Contains(e.ExerciseId))
                    .Select(e => e.ExerciseExternalId)
                    .ToHashSet()
                : [];

            foreach (var exerciseId in effectiveIds)
            {
                if (!exLookup.TryGetValue(exerciseId, out var planExercise))
                    continue;

                foreach (var set in planExercise.Sets)
                {
                    var key = (sessionId, exerciseId, set.SetNumber);
                    if (!completedSets.ContainsKey(key) || stampedAt < completedSets[key])
                        completedSets[key] = stampedAt;
                }
            }

            // Partially-completed exercises: mark only the listed set numbers.
            if (execution.CompletedSets is not null)
            {
                foreach (var (exIdString, setNumbers) in execution.CompletedSets)
                {
                    if (!Guid.TryParse(exIdString, out var exId)) continue;
                    if (!exLookup.ContainsKey(exId)) continue;

                    foreach (var setNumber in setNumbers)
                    {
                        var key = (sessionId, exId, setNumber);
                        if (!completedSets.ContainsKey(key) || stampedAt < completedSets[key])
                            completedSets[key] = stampedAt;
                    }
                }
            }
        }

        // ── 4c. Batch-fetch lock state for all plan sessions ─────────────────────
        // Single Mongo round-trip — not one per session.
        Dictionary<Guid, SessionLock> lockLookup = new();
        if (planSessionIds.Count > 0)
        {
            var lockDocs = await lockService.GetStateAsync(planSessionIds, ct);
            lockLookup = lockDocs.ToDictionary(l => l.SessionId);
        }

        // ── 5. Resolve current week ───────────────────────────────────────────────
        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        int? currentWeek = null;
        if (publishedWeeks.Count > 0)
        {
            currentWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
                plan.StartDate,
                publishedWeeks.Select(w => w.WeekNumber).ToList(),
                plan.Weeks.Count,
                publishedWeeks.First().DatePublished,
                plan.DateCreated,
                DateTime.UtcNow);
        }

        // ── 6. Build response ─────────────────────────────────────────────────────

        // Shared by a workout's nested exercises AND a session's standalone exercises (#857
        // phase 3a) — both are SessionExercise instances with identical completion/enrichment
        // rules, so the mapping lives in one place rather than being duplicated per call site.
        ExerciseDto BuildExerciseDto(SessionExercise ex, Guid sessionId)
        {
            var muscleGroups = muscleGroupMap.TryGetValue(ex.ExerciseExternalId, out var mg)
                ? mg
                : [];

            var setDtos = ex.Sets.Select(set =>
            {
                var key = (sessionId, ex.ExerciseExternalId, set.SetNumber);
                completedSets.TryGetValue(key, out var completedAt);
                loggedSets.TryGetValue(key, out var loggedSet);

                return new SetDto
                {
                    SetNumber = set.SetNumber,
                    Type = set.Type.ToString(),
                    Reps = set.Reps,
                    WeightKg = set.WeightKg,
                    DurationSeconds = set.DurationSeconds,
                    DistanceMeters = set.DistanceMeters,
                    RestSeconds = set.RestSeconds,
                    CompletedAt = completedAt == default ? null : completedAt,
                    // Actual values from the workout log (null when not yet logged).
                    ActualReps = loggedSet?.Reps,
                    ActualWeightKg = loggedSet?.WeightKg,
                    ActualRpe = loggedSet?.Rpe,
                    ActualDurationSeconds = loggedSet?.DurationSeconds,
                    ActualDistanceMeters = loggedSet?.DistanceMeters,
                    // Snapshot-planned values (null on legacy logs → isModified stays false).
                    PlannedReps = loggedSet?.PlannedReps,
                    PlannedWeightKg = loggedSet?.PlannedWeightKg,
                    PlannedRpe = loggedSet?.PlannedRpe,
                    PlannedDurationSeconds = loggedSet?.PlannedDurationSeconds,
                    PlannedDistanceMeters = loggedSet?.PlannedDistanceMeters,
                    IsModified = loggedSet?.IsModified ?? false
                };
            }).ToList();

            // An exercise is complete only when every planned set has a log entry.
            var isCompleted = setDtos.Count > 0 && setDtos.All(s => s.CompletedAt is not null);
            var hasModifications = setDtos.Any(s => s.IsModified);

            return new ExerciseDto
            {
                ExerciseId = ex.ExerciseId,
                ExerciseExternalId = ex.ExerciseExternalId,
                ExerciseName = ex.ExerciseName,
                Order = ex.Order,
                Notes = ex.Notes,
                RestSeconds = ex.RestSeconds,
                // Surface the movement type so the client can
                // pick the right summary template (reps /
                // duration / distance / reps-for-time).
                MovementType = ex.MovementType.ToString(),
                MuscleGroups = muscleGroups,
                IsCompleted = isCompleted,
                HasModifications = hasModifications,
                Sets = setDtos
            };
        }

        var weekDtos = publishedWeeks.Select(week =>
        {
            // Compute week start/end from StartDate when available.
            // Fall back to DatePublished for legacy plans; leave null when neither is set.
            DateTime? weekStart = null;
            DateTime? weekEnd = null;

            var anchor = plan.StartDate ?? week.DatePublished;
            if (anchor.HasValue)
            {
                weekStart = anchor.Value.Date.AddDays((week.WeekNumber - 1) * 7);
                weekEnd = weekStart.Value.AddDays(6);
            }

            var sessionDtos = week.Days
                .SelectMany(day => day.Sessions.Select(session => (day.DayOfWeek, Session: session)))
                .Select(x =>
            {
                var (dayOfWeek, session) = x;

                // Build per-workout DTOs, keeping each workout's own Order alongside it so the
                // flat merge below can interleave workouts and standalone exercises correctly.
                var workoutComponents = session.Workouts.OrderBy(workout => workout.Order).Select(workout =>
                {
                    var workoutExerciseDtos = workout.Exercises
                        .Select(ex => BuildExerciseDto(ex, session.SessionId))
                        .ToList();

                    var workoutIsCompleted = workoutExerciseDtos.Count > 0
                        ? workoutExerciseDtos.All(e => e.IsCompleted)
                        : completedSectionIdsBySession.TryGetValue(session.SessionId, out var completedSecs)
                            && completedSecs.Contains(workout.WorkoutId);

                    var dto = new WorkoutDto
                    {
                        WorkoutId = workout.WorkoutId,
                        Order = workout.Order,
                        Name = workout.Name,
                        Format = workout.Format?.ToString(),
                        FormatConfig = workout.FormatConfig,
                        Notes = workout.Notes,
                        IsCompleted = workoutIsCompleted,
                        Exercises = workoutExerciseDtos
                    };

                    return (workout.Order, Dto: dto);
                }).ToList();

                var workoutDtos = workoutComponents.Select(c => c.Dto).ToList();

                // Standalone exercises directly on the session (#857 phase 3a) — sit alongside
                // Workouts, sharing the same shared Order sequence (see UpdateTrainingPlanValidator's
                // cross-list duplicate-Order check).
                var standaloneComponents = session.StandaloneExercises
                    .Select(ex => (ex.Order, ExerciseDto: BuildExerciseDto(ex, session.SessionId)))
                    .ToList();

                var standaloneExerciseDtos = standaloneComponents.Select(c => c.ExerciseDto).ToList();

                // Flat exercise list — merges workout-nested and standalone exercises by the ONE
                // shared Order sequence they occupy within a session. Standalone exercises are
                // session content just like workouts, so they must appear here (and be counted in
                // TotalExerciseCount/CompletedExerciseCount below) — a standalone-only session was
                // previously invisible to this endpoint because this list only walked Workouts.
                var exerciseDtos = workoutComponents
                    .Select(c => (c.Order, Exercises: (IReadOnlyList<ExerciseDto>)c.Dto.Exercises))
                    .Concat(standaloneComponents.Select(c => (c.Order, Exercises: (IReadOnlyList<ExerciseDto>)[c.ExerciseDto])))
                    .OrderBy(c => c.Order)
                    .SelectMany(c => c.Exercises)
                    .ToList();

                var completedExerciseCount = exerciseDtos.Count(e => e.IsCompleted);
                var sessionHasModifications = exerciseDtos.Any(e => e.HasModifications);

                // Resolve lock state for this session (Stable if no active lock doc).
                var sessionLockState = "Stable";
                string? sessionLockHolder = null;
                if (lockLookup.TryGetValue(session.SessionId, out var sessionLock))
                {
                    sessionLockState = sessionLock.Type.ToString();
                    sessionLockHolder = sessionLock.Holder.ToString();
                }

                return new SessionDto
                {
                    SessionId = session.SessionId,
                    DayOfWeek = dayOfWeek,
                    Name = session.Name,
                    Order = session.Order,
                    Notes = session.Notes,
                    CompletedExerciseCount = completedExerciseCount,
                    TotalExerciseCount = exerciseDtos.Count,
                    EstimatedDurationMinutes = null, // deferred — requires product-defined set-duration heuristic
                    Workouts = workoutDtos,
                    Exercises = exerciseDtos,
                    StandaloneExercises = standaloneExerciseDtos,
                    LockState = sessionLockState,
                    LockHolder = sessionLockHolder,
                    HasModifications = sessionHasModifications
                };
            }).ToList();

            return new WeekDto
            {
                WeekNumber = week.WeekNumber,
                Status = week.Status.ToString(),
                DatePublished = week.DatePublished,
                WeekStartDate = weekStart,
                WeekEndDate = weekEnd,
                DayNotes = week.Days
                    .Where(d => d.Note is not null)
                    .ToDictionary(d => d.DayOfWeek, d => d.Note!),
                Sessions = sessionDtos
            };
        }).ToList();

        await Send.OkAsync(new GetFullTrainingPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            Status = plan.Status.ToString(),
            StartDate = plan.StartDate,
            CurrentWeek = currentWeek,
            TotalWeeks = plan.Weeks.Count,
            PublishedWeekCount = publishedWeeks.Count,
            QuestionnaireResponseId = plan.QuestionnaireResponseId,
            DateCompleted = plan.DateCompleted,
            Weeks = weekDtos
        }, ct);
    }
}
