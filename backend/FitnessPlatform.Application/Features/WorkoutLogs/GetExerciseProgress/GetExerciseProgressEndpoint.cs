using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;

/// <summary>
/// Returns a time series of a client's performance for a specific exercise.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates trainer-client relationship.</param>
public class GetExerciseProgressEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper)
    : Endpoint<GetExerciseProgressRequest, GetExerciseProgressResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/clients/{ClientId}/progress/{ExerciseId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get exercise progress";
            s.Description = "Returns a time series of a client's performance for a specific exercise.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetExerciseProgressRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var hasLink = await authHelper.HasActiveLinkAsync(trainerId, req.ClientId, ct);
        if (!hasLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find all completed workout logs for this client
        var filter = Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, req.ClientId)
                     & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true);

        var options = new FindOptions<WorkoutLog>
        {
            Sort = Builders<WorkoutLog>.Sort.Ascending(w => w.StartedAt)
        };

        using var cursor = await mongo.WorkoutLogs.FindAsync(filter, options, ct);
        var logs = await cursor.ToListAsync(ct);

        var exerciseName = "";
        var dataPoints = new List<ExerciseProgressPoint>();

        foreach (var log in logs)
        {
            var exercise = log.Exercises
                .FirstOrDefault(e => e.ExerciseExternalId == req.ExerciseId);

            if (exercise is null) continue;

            if (string.IsNullOrEmpty(exerciseName))
                exerciseName = exercise.ExerciseName;

            decimal? bestWeight = null;
            int? bestReps = null;
            decimal totalVolume = 0;
            var hasPR = false;

            foreach (var set in exercise.Sets)
            {
                if (set.WeightKg.HasValue && (bestWeight is null || set.WeightKg.Value > bestWeight.Value))
                {
                    bestWeight = set.WeightKg.Value;
                    bestReps = set.Reps;
                }

                if (set.WeightKg.HasValue && set.Reps.HasValue)
                    totalVolume += set.WeightKg.Value * set.Reps.Value;

                if (set.IsPR) hasPR = true;
            }

            dataPoints.Add(new ExerciseProgressPoint
            {
                Date = log.StartedAt,
                BestWeightKg = bestWeight,
                BestReps = bestReps,
                TotalVolume = totalVolume,
                HasPR = hasPR
            });
        }

        await Send.OkAsync(new GetExerciseProgressResponse
        {
            ExerciseName = exerciseName,
            DataPoints = dataPoints
        }, ct);
    }
}
