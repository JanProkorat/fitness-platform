using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Detects personal records by comparing against previous best performances in MongoDB.
/// </summary>
public class PrDetectionService(IMongoContext mongo) : IPrDetectionService
{
    /// <inheritdoc />
    public async Task<List<string>> DetectAndMarkPRsAsync(WorkoutLog workoutLog, CancellationToken ct)
    {
        workoutLog.WithBackfilledSections();
        var prDescriptions = new List<string>();

        foreach (var exercise in workoutLog.Exercises)
        {
            // Get all previous completed workout logs for this client and exercise
            var filter = Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, workoutLog.ClientId)
                         & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
                         & Builders<WorkoutLog>.Filter.Ne(w => w.ExternalId, workoutLog.ExternalId);

            var cursor = await mongo.WorkoutLogs.FindAsync(filter, cancellationToken: ct);
            var previousLogs = await cursor.ToListAsync(ct);

            // Find previous best weight and reps for this exercise
            decimal? bestWeight = null;
            int? bestReps = null;

            foreach (var log in previousLogs)
            {
                log.WithBackfilledSections();
                var prevExercise = log.Exercises
                    .FirstOrDefault(e => e.ExerciseExternalId == exercise.ExerciseExternalId);

                if (prevExercise is null) continue;

                foreach (var set in prevExercise.Sets)
                {
                    if (set.WeightKg.HasValue && (bestWeight is null || set.WeightKg.Value > bestWeight.Value))
                        bestWeight = set.WeightKg.Value;

                    if (set.Reps.HasValue && set.WeightKg.HasValue && set.WeightKg.Value == bestWeight)
                    {
                        if (bestReps is null || set.Reps.Value > bestReps.Value)
                            bestReps = set.Reps.Value;
                    }
                }
            }

            // Check current sets for PRs
            foreach (var set in exercise.Sets)
            {
                var isPR = false;

                if (set.WeightKg.HasValue)
                {
                    if (bestWeight is null || set.WeightKg.Value > bestWeight.Value)
                    {
                        isPR = true;
                    }
                    else if (set.WeightKg.Value == bestWeight && set.Reps.HasValue)
                    {
                        if (bestReps is null || set.Reps.Value > bestReps.Value)
                        {
                            isPR = true;
                        }
                    }
                }

                if (isPR)
                {
                    set.IsPR = true;
                    var weightStr = set.WeightKg.HasValue ? $"{set.WeightKg.Value} kg" : "";
                    var repsStr = set.Reps.HasValue ? $"\u00d7 {set.Reps.Value}" : "";
                    prDescriptions.Add($"{exercise.ExerciseName}: {weightStr} {repsStr}".Trim());

                    // Update best for subsequent sets in the same exercise
                    if (set.WeightKg.HasValue)
                        bestWeight = set.WeightKg.Value;
                    if (set.Reps.HasValue)
                        bestReps = set.Reps.Value;
                }
            }
        }

        return prDescriptions;
    }
}
