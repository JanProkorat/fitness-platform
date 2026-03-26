using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;

/// <summary>
/// Completes a workout session: runs PR detection, creates notifications, and marks as done.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="prDetection">Personal record detection service.</param>
/// <param name="notifications">Notification creation service.</param>
public class CompleteWorkoutEndpoint(
    IMongoContext mongo,
    IPrDetectionService prDetection,
    INotificationService notifications) : Endpoint<CompleteWorkoutRequest, WorkoutLogDetail>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs/{LogId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Complete a workout";
            s.Description = "Marks the workout as completed, runs PR detection, and creates trainer notifications.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CompleteWorkoutRequest req, CancellationToken ct)
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

        // Run PR detection
        var prDescriptions = await prDetection.DetectAndMarkPRsAsync(log, ct);

        // Mark as completed
        log.CompletedAt = DateTime.UtcNow;
        log.IsCompleted = true;
        log.DateUpdated = DateTime.UtcNow;

        await mongo.WorkoutLogs.ReplaceOneAsync(
            w => w.ExternalId == req.LogId,
            log,
            cancellationToken: ct);

        // Create trainer notification if any PRs detected (throttled: max 1 per workout)
        if (prDescriptions.Count > 0)
        {
            // Find the trainer via the training plan
            if (log.PlanId.HasValue)
            {
                var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
                using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
                var plan = await planCursor.FirstOrDefaultAsync(ct);

                if (plan is not null)
                {
                    var prSummary = string.Join(", ", prDescriptions.Take(3));
                    var data = JsonSerializer.Serialize(new { workoutLogId = log.ExternalId, clientId });

                    await notifications.CreateAsync(
                        plan.TrainerId,
                        NotificationType.PersonalRecord,
                        "New Personal Record!",
                        prSummary,
                        data,
                        ct);
                }
            }
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }
}
