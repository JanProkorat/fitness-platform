using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.FinishSession;

/// <summary>
/// Allows a trainer to retroactively finish a skipped or untouched session in their client's
/// training plan. Produces a completed <see cref="WorkoutLog"/> (materializing from the session
/// template when no log exists), runs PR detection, and fans out a <see cref="TrainingCompletion"/>
/// document so that compliance/streak attribution lands on the correct calendar day.
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
                "Materializes a WorkoutLog from the session template when none exists. " +
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

        // 4. Look for an existing WorkoutLog for this (PlanId, SessionId).
        var logFilter = Builders<WorkoutLog>.Filter.Eq(l => l.PlanId, req.PlanId)
                        & Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, req.SessionId);
        using var logCursor = await mongo.WorkoutLogs.FindAsync(logFilter, cancellationToken: ct);
        var existingLogs = await logCursor.ToListAsync(ct);

        // 4a. If there is already a completed log, reject — idempotent-safe message.
        var completedLog = existingLogs.FirstOrDefault(l => l.IsCompleted);
        if (completedLog is not null)
        {
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session already has a completed workout log.", ct);
            return;
        }

        // 5. Use the most-recently-updated in-progress log if one exists; otherwise materialize
        //    a new WorkoutLog from the session template.
        var log = existingLogs
            .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
            .FirstOrDefault();

        if (log is null)
        {
            log = MaterializeFromTemplate(plan, session, completedAt, ct);
            await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);
        }

        // 6. Delegate the full completion pipeline to the shared service.
        //    The completedAt instant drives BOTH log.CompletedAt and the TrainingCompletion date key,
        //    so that backdated finishes are attributed to the correct calendar day.
        try
        {
            await completionService.CompleteAsync(log, completedAt, ct);
        }
        catch (WorkoutAlreadyCompletedException)
        {
            // TOCTOU backstop: the in-process guard above (step 4a) is the fast path.
            // This catch handles the rare case where two concurrent requests both passed
            // the in-process check and the partial unique index rejected the loser's write.
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session was already completed on that day by a concurrent request.", ct);
            return;
        }

        await Send.OkAsync(new FinishSessionResponse
        {
            WorkoutLogId = log.ExternalId,
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            CompletedAt = completedAt
        }, ct);
    }

    /// <summary>
    /// Creates a new <see cref="WorkoutLog"/> from the session template, with all sets
    /// initialized from the plan's <see cref="ExerciseSet"/> prescription and
    /// <see cref="WorkoutSet.CompletedAt"/> stamped with the supplied instant.
    /// </summary>
    private static WorkoutLog MaterializeFromTemplate(
        TrainingPlan plan,
        TrainingSession session,
        DateTime completedAt,
        CancellationToken _)
    {
        // Backfill legacy flat-exercise sessions into the section structure first.
        session.WithBackfilledSections();

        var workoutSections = session.Sections
            .Select(section => new WorkoutSection
            {
                SectionId = section.SectionId,
                Order = section.Order,
                Name = section.Name,
                Format = section.Format,
                Exercises = section.Exercises
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
                                IsPR = false
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .ToList();

        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = session.SessionId,
            StartedAt = completedAt,
            IsCompleted = false, // will be set to true by completionService.CompleteAsync
            Sections = workoutSections,
            DateCreated = DateTime.UtcNow
        };
    }
}
