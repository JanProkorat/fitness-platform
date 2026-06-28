using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Exercises.DeleteExercise;

/// <summary>
/// Soft-deletes a custom exercise. Only the owning trainer can delete.
/// Uses optimistic concurrency — the client must supply the current Version.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteExerciseEndpoint(IMongoContext mongo) : Endpoint<DeleteExerciseRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/exercises/{ExerciseId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Delete custom exercise";
            s.Description = "Soft-deletes a custom exercise. Only the trainer who created it can delete. " +
                            "Uses optimistic concurrency via the Version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteExerciseRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var filter = Builders<Exercise>.Filter.Eq(e => e.ExternalId, req.ExerciseId)
            & Builders<Exercise>.Filter.Eq(e => e.IsActive, true);

        using var cursor = await mongo.Exercises.FindAsync(filter, cancellationToken: ct);
        var exercise = await cursor.FirstOrDefaultAsync(ct);

        if (exercise is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!exercise.IsCustom)
        {
            this.ThrowErrorWithCode(ErrorCodes.SystemExercise, "System exercises cannot be deleted.");
            return;
        }

        if (exercise.TrainerId != trainerId)
        {
            this.ThrowErrorWithCode(ErrorCodes.ExerciseNotOwned, "You can only delete your own custom exercises.");
            return;
        }

        // Early optimistic concurrency check (in-memory, before the DB write)
        if (exercise.Version != req.Version)
        {
            await this.SendProblemAsync(409, ErrorCodes.ExerciseVersionConflict,
                "Version conflict. The exercise was modified by another request.", ct);
            return;
        }

        // Version-guarded soft-delete: filter includes current version to prevent concurrent writes
        var versionFilter = Builders<Exercise>.Filter.Eq(e => e.ExternalId, req.ExerciseId)
            & Builders<Exercise>.Filter.Eq(e => e.Version, req.Version);

        var update = Builders<Exercise>.Update
            .Set(e => e.IsActive, false)
            .Set(e => e.DateUpdated, DateTime.UtcNow)
            .Set(e => e.Version, exercise.Version + 1);

        var result = await mongo.Exercises.UpdateOneAsync(versionFilter, update, cancellationToken: ct);

        // Double-guard: if ModifiedCount == 0 a concurrent write beat us
        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.ExerciseVersionConflict,
                "Version conflict. The exercise was modified concurrently.", ct);
            return;
        }

        await Send.NoContentAsync(ct);
    }
}
