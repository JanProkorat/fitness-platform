using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.FinishSession;

/// <summary>
/// Allows a trainer to retroactively finish a skipped or untouched session in their client's
/// training plan. Produces a completed <see cref="SessionExecution"/> (materializing Performance
/// from the session template when none exists), runs PR detection, and sets the completion flags
/// so that compliance/streak attribution lands on the correct calendar day — all in one document.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="completionService">Shared workout completion pipeline.</param>
public class FinishSessionEndpoint(
    IMongoContext mongo,
    IWorkoutCompletionService completionService) : Endpoint<FinishSessionRequest, FinishSessionResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/training/plans/{PlanId}/sessions/{SessionId}/finish");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Finish a session on behalf of a client";
            s.Description =
                "Marks a skipped or untouched session as completed. " +
                "Materializes Performance data from the session template when none exists. " +
                "Accepts an optional backdated completedAt; defaults to now.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FinishSessionRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // 1. Load the plan and apply the ownership guard.
        //    Mirror GetTrainingPlanEndpoint: "not mine" is returned as NotFound to prevent existence leak.
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 2. Locate the session within the plan.
        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 3. Resolve the effective completion instant, normalizing to UTC so that
        //    DateOnly.FromDateTime(completedAt) always lands on the correct calendar day
        //    regardless of the DateTime.Kind the JSON binder assigned to the incoming value.
        var completedAt = (req.CompletedAt ?? DateTime.UtcNow).ToUniversalTime();

        // 3a. Guard: completedAt must not be before the plan's start date.
        //    When StartDate is null (plan created but not yet started), fall back to
        //    plan.DateCreated as the floor — a session cannot have been completed before
        //    the plan existed, and leaving this unchecked allows arbitrary backdating
        //    (e.g. year 1900), which fabricates historical compliance records.
        var completionFloor = plan.StartDate.HasValue
            ? plan.StartDate.Value
            : plan.DateCreated;

        if (completedAt < completionFloor)
        {
            await this.SendProblemAsync(422, ErrorCodes.CompletedAtBeforePlanStart,
                "completedAt must not be before the plan's start date (or creation date when no start date is set).", ct);
            return;
        }

        // 4. Reject if this session already has a completed execution (any date) — mirrors the
        //    prior "already has a completed WorkoutLog" guard.
        var completedGuardFilter = Builders<SessionExecution>.Filter.Eq(e => e.PlanId, req.PlanId)
                                   & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, req.SessionId)
                                   & Builders<SessionExecution>.Filter.Eq(e => e.Status, SessionExecutionStatus.Completed)
                                   & Builders<SessionExecution>.Filter.Exists(e => e.Performance);
        var alreadyCompletedCount = await mongo.SessionExecutions.CountDocumentsAsync(completedGuardFilter, cancellationToken: ct);

        if (alreadyCompletedCount > 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session already has a completed workout log.", ct);
            return;
        }

        // 5. Reuse the execution for this exact (clientId, sessionId, date) if one exists —
        //    the unified partial-unique index allows only one per day — otherwise materialize a
        //    fresh SessionExecution from the session template.
        var date = SessionExecution.ToCompletionDateUtc(completedAt);
        var executionFilter = Builders<SessionExecution>.Filter.Eq(e => e.ClientId, plan.ClientId)
                              & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, req.SessionId)
                              & Builders<SessionExecution>.Filter.Eq(e => e.Date, date);
        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var execution = await executionCursor.FirstOrDefaultAsync(ct);

        if (execution is null)
        {
            // TrainingPlan.ClientId is ApplicationUser.Id (#840) — same identifier
            // SessionExecution.ClientId has always used, so no ClientProfile translation
            // is needed here anymore (previously required a PublicId -> UserId lookup).
            execution = MaterializeFromTemplate(plan, session, completedAt, plan.ClientId);
            await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: ct);
        }
        else if (execution.Performance is null)
        {
            // A checkbox-only execution already exists for this day — attach Performance to it.
            execution.PlanId = plan.ExternalId;
            execution.Performance = BuildPerformanceFromTemplate(session, completedAt);
        }
        // else: reuse the existing (non-completed) draft's Performance as-is.

        // 6. Delegate the full completion pipeline to the shared service.
        //    The completedAt instant drives BOTH Performance.CompletedAt and the completion flags,
        //    so that backdated finishes are attributed to the correct calendar day.
        try
        {
            await completionService.CompleteAsync(execution, completedAt, ct);
        }
        catch (WorkoutAlreadyCompletedException)
        {
            // TOCTOU backstop: the in-process guard above (step 4) is the fast path.
            // This catch handles the rare case where two concurrent requests both passed
            // the in-process check and the partial unique index rejected the loser's write.
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session was already completed on that day by a concurrent request.", ct);
            return;
        }

        await Send.OkAsync(new FinishSessionResponse
        {
            WorkoutLogId = execution.ExternalId,
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            CompletedAt = completedAt
        }, ct);
    }

    /// <summary>
    /// Creates a new <see cref="SessionExecution"/> from the session template, with all sets
    /// initialized from the plan's <see cref="ExerciseSet"/> prescription and
    /// <see cref="WorkoutSet.CompletedAt"/> stamped with the supplied instant.
    /// </summary>
    private static SessionExecution MaterializeFromTemplate(
        TrainingPlan plan,
        TrainingSession session,
        DateTime completedAt,
        Guid clientUserId)
    {
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            SessionId = session.SessionId,
            Date = SessionExecution.ToCompletionDateUtc(completedAt),
            Performance = BuildPerformanceFromTemplate(session, completedAt),
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
    }

    /// <summary>
    /// Builds the <see cref="SessionExecutionPerformance"/> sub-document from the session
    /// template, with every set stamped as completed at the supplied instant.
    /// </summary>
    private static SessionExecutionPerformance BuildPerformanceFromTemplate(TrainingSession session, DateTime completedAt)
    {
        var loggedWorkouts = session.Workouts
            .Select(workout => new LoggedWorkout
            {
                WorkoutId = workout.WorkoutId,
                Order = workout.Order,
                Name = workout.Name,
                Format = workout.Format,
                Exercises = workout.Exercises
                    .Select(se => new WorkoutExercise
                    {
                        ExerciseExternalId = se.ExerciseExternalId,
                        ExerciseName = se.ExerciseName,
                        Sets = se.Sets
                            .Select(es => new WorkoutSet
                            {
                                SetNumber = es.SetNumber,
                                Reps = es.Reps,
                                WeightKg = es.WeightKg,
                                Rpe = es.Rpe,
                                DurationSeconds = es.DurationSeconds,
                                DistanceMeters = es.DistanceMeters,
                                // Stamp all sets as completed at the supplied instant.
                                // IsPR is left false — the completion service will set it via PR detection.
                                CompletedAt = completedAt,
                                IsPR = false,
                                // Snapshot: done-as-prescribed → planned == actual.
                                // When the trainer finishes a session retroactively the actual
                                // values ARE the prescription, so isModified stays false for every set.
                                PlannedReps = es.Reps,
                                PlannedWeightKg = es.WeightKg,
                                PlannedRpe = es.Rpe,
                                PlannedDurationSeconds = es.DurationSeconds,
                                PlannedDistanceMeters = es.DistanceMeters
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .ToList();

        return new SessionExecutionPerformance
        {
            StartedAt = completedAt,
            Workouts = loggedWorkouts
        };
    }
}
