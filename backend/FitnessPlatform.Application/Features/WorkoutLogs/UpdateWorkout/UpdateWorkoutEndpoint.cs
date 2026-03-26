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
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateWorkoutEndpoint(IMongoContext mongo) : Endpoint<UpdateWorkoutRequest, WorkoutLogDetail>
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

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }
}
