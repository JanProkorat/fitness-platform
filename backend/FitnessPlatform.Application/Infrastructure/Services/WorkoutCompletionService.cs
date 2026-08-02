using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Default implementation of <see cref="IWorkoutCompletionService"/>.
///
/// #841: previously fanned out a best-effort <c>TrainingCompletion</c> document after marking
/// the <c>WorkoutLog</c> complete (two collections, two writes, reconciled only best-effort).
/// Now both signals live on the SAME <see cref="SessionExecution"/> document — PR detection,
/// Performance completion, and the checkbox completion flags are set together and persisted in
/// ONE write. There is no fan-out step left to fail independently.
/// </summary>
public class WorkoutCompletionService(
    IMongoContext mongo,
    IPrDetectionService prDetection,
    INotificationService notifications,
    ILogger<WorkoutCompletionService> logger) : IWorkoutCompletionService
{
    /// <inheritdoc />
    public async Task<List<string>> CompleteAsync(
        SessionExecution execution,
        DateTime completedAtUtc,
        CancellationToken ct)
    {
        // 1. PR detection — mutates execution.Performance.Sections[].Exercises[].Sets[].IsPR in place.
        var prDescriptions = await prDetection.DetectAndMarkPRsAsync(execution, ct);

        // 2. Mark the execution as completed at the supplied instant.
        //    Date is set to midnight UTC on the same calendar day as completedAtUtc, using
        //    SessionExecution.ToCompletionDateUtc so a backdated finish is attributed correctly.
        execution.Performance!.CompletedAt = completedAtUtc;
        execution.Status = SessionExecutionStatus.Completed;
        execution.Date = SessionExecution.ToCompletionDateUtc(completedAtUtc);
        execution.DateUpdated = DateTime.UtcNow;

        // 3. For plan-bound sessions, populate the checkbox completion flags too — every
        //    exercise/section in the session definition is now "complete", in the SAME write
        //    as the Performance data. This replaces the retired best-effort cross-collection
        //    TrainingCompletion fan-out (#841).
        if (execution.SessionId.HasValue && execution.PlanId.HasValue)
        {
            await PopulateCompletionFlagsAsync(execution, ct);
        }

        try
        {
            await mongo.SessionExecutions.ReplaceOneAsync(
                w => w.ExternalId == execution.ExternalId,
                execution,
                cancellationToken: ct);
        }
        catch (MongoWriteException ex)
            when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new WorkoutAlreadyCompletedException(ex);
        }
        catch (MongoCommandException ex)
            when (ex.Code == 11000 /* E11000 */ || ex.CodeName == "DuplicateKey")
        {
            throw new WorkoutAlreadyCompletedException(ex);
        }

        // 4. Notify trainer when PRs were detected (throttled: max 1 per workout).
        if (prDescriptions.Count > 0 && execution.PlanId.HasValue)
        {
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, execution.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is not null)
            {
                var prSummary = string.Join(", ", prDescriptions.Take(3));

                await notifications.CreateAsync(
                    plan.TrainerId,
                    NotificationType.PersonalRecord,
                    new Dictionary<string, string>
                    {
                        ["summary"] = prSummary,
                        ["workoutLogId"] = execution.ExternalId.ToString(),
                        ["clientId"] = execution.ClientId.ToString(),
                    },
                    ct: ct);
            }
        }

        return prDescriptions;
    }

    // ── Checkbox completion-flag population (single-write replacement for the retired
    //    best-effort TrainingCompletion fan-out) ─────────────────────────────────────
    private async Task PopulateCompletionFlagsAsync(SessionExecution execution, CancellationToken ct)
    {
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, execution.PlanId!.Value);
        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            logger.LogWarning(
                "SessionExecution completion: plan {PlanId} not found for execution {ExternalId}.",
                execution.PlanId.Value, execution.ExternalId);
            return;
        }

        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == execution.SessionId!.Value);

        if (session is null)
        {
            logger.LogWarning(
                "SessionExecution completion: session {SessionId} not found in plan {PlanId} for execution {ExternalId}.",
                execution.SessionId!.Value, execution.PlanId!.Value, execution.ExternalId);
            return;
        }

        var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();
        var allSectionIds = session.Workouts.Select(s => s.WorkoutId).ToList();
        var completedBySection = session.Workouts.ToDictionary(
            s => s.WorkoutId.ToString(),
            s => s.Exercises.Select(e => e.ExerciseExternalId).ToList());

        execution.CompletedExerciseIds = allExerciseIds;
        execution.CompletedExerciseIdsBySection = completedBySection;
        execution.CompletedWorkoutIds = allSectionIds;
    }
}
