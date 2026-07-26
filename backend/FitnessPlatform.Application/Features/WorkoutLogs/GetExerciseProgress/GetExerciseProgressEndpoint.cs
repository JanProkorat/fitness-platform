using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;

/// <summary>
/// Returns a time series of a client's performance for a specific exercise.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates trainer-client relationship.</param>
/// <param name="db">PostgreSQL context — used to resolve ClientProfile.UserId from the public id.</param>
public class GetExerciseProgressEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper, IApplicationDbContext db)
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

        // req.ClientId is ClientProfile.PublicId; WorkoutLog.ClientId stores ApplicationUser.Id (UserId).
        // Resolve the client's UserId before filtering Mongo.
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find all completed session executions (that carry Performance data) for this client
        var filter = Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientProfile.UserId)
                     & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Completed)
                     & Builders<SessionExecution>.Filter.Exists(w => w.Performance);

        var options = new FindOptions<SessionExecution>
        {
            Sort = Builders<SessionExecution>.Sort.Ascending(w => w.Performance!.StartedAt)
        };

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, options, ct);
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
                Date = log.Performance!.StartedAt,
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
