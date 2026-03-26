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
            s.Description = "Soft-deletes a custom exercise. Only the trainer who created it can delete.";
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

        var update = Builders<Exercise>.Update
            .Set(e => e.IsActive, false)
            .Set(e => e.DateUpdated, DateTime.UtcNow);

        await mongo.Exercises.UpdateOneAsync(
            e => e.ExternalId == req.ExerciseId,
            update,
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
