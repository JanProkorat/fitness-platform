using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GetFullPlan;

/// <summary>
/// Returns the full structure of a specific training plan for the authenticated client.
/// Enriches each exercise with muscle-group data (batch-fetched from the Exercise collection)
/// and per-set completion state (derived from WorkoutLog documents).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetFullTrainingPlanEndpoint(IMongoContext mongo, IApplicationDbContext db)
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

        var clientId = clientProfile.PublicId;
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
            .SelectMany(w => w.Sessions)
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

        // ── 4. Fetch all WorkoutLog docs for this client + plan ───────────────────
        // Walk them once to build a lookup keyed by (sessionId, exerciseExternalId, setNumber).
        // A set is "completed" when it has a CompletedAt value in WorkoutSet.
        // We prefer the most recent completion timestamp if multiple logs exist for the same session.
        var logFilter = Builders<WorkoutLog>.Filter.And(
            Builders<WorkoutLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<WorkoutLog>.Filter.Eq(l => l.PlanId, planId));

        var workoutLogs = await mongo.WorkoutLogs
            .Find(logFilter)
            .ToListAsync(ct);

        // Key: (sessionId, exerciseExternalId, setNumber) → completedAt
        // If a session was logged more than once we take the earliest non-null completedAt
        // per set so accidental duplicate logs don't wipe completion state.
        var completedSets = new Dictionary<(Guid sessionId, Guid exerciseId, int setNumber), DateTime>();

        foreach (var log in workoutLogs)
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

            var sessionDtos = week.Sessions.Select(session =>
            {
                var exerciseDtos = session.Exercises.Select(ex =>
                {
                    var muscleGroups = muscleGroupMap.TryGetValue(ex.ExerciseExternalId, out var mg)
                        ? mg
                        : [];

                    var setDtos = ex.Sets.Select(set =>
                    {
                        var key = (session.SessionId, ex.ExerciseExternalId, set.SetNumber);
                        completedSets.TryGetValue(key, out var completedAt);

                        return new SetDto
                        {
                            SetNumber = set.SetNumber,
                            Type = set.Type.ToString(),
                            Reps = set.Reps,
                            WeightKg = set.WeightKg,
                            DurationSeconds = set.DurationSeconds,
                            RestSeconds = set.RestSeconds,
                            CompletedAt = completedAt == default ? null : completedAt
                        };
                    }).ToList();

                    // An exercise is complete only when every planned set has a log entry.
                    var isCompleted = setDtos.Count > 0 && setDtos.All(s => s.CompletedAt is not null);

                    return new ExerciseDto
                    {
                        ExerciseExternalId = ex.ExerciseExternalId,
                        ExerciseName = ex.ExerciseName,
                        Order = ex.Order,
                        Notes = ex.Notes,
                        RestSeconds = ex.RestSeconds,
                        MuscleGroups = muscleGroups,
                        IsCompleted = isCompleted,
                        Sets = setDtos
                    };
                }).ToList();

                var completedExerciseCount = exerciseDtos.Count(e => e.IsCompleted);

                return new SessionDto
                {
                    SessionId = session.SessionId,
                    DayOfWeek = session.DayOfWeek,
                    Name = session.Name,
                    Order = session.Order,
                    Notes = session.Notes,
                    CompletedExerciseCount = completedExerciseCount,
                    TotalExerciseCount = exerciseDtos.Count,
                    EstimatedDurationMinutes = null, // deferred — requires product-defined set-duration heuristic
                    Exercises = exerciseDtos
                };
            }).ToList();

            return new WeekDto
            {
                WeekNumber = week.WeekNumber,
                Status = week.Status.ToString(),
                DatePublished = week.DatePublished,
                WeekStartDate = weekStart,
                WeekEndDate = weekEnd,
                DayNotes = week.DayNotes ?? new Dictionary<int, string>(),
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
