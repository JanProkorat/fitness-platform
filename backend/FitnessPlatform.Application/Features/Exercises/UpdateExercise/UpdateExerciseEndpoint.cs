using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.Exercises.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Exercises.UpdateExercise;

/// <summary>
/// Updates a custom exercise. Only the owning trainer can edit.
/// Uses optimistic concurrency — the client must supply the current Version and it is bumped on each write.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateExerciseEndpoint(IMongoContext mongo) : Endpoint<UpdateExerciseRequest, ExerciseSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/exercises/{ExerciseId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Update custom exercise";
            s.Description = "Updates a custom exercise. Only the trainer who created it can edit. " +
                            "Uses optimistic concurrency via the Version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateExerciseRequest req, CancellationToken ct)
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
            this.ThrowErrorWithCode(ErrorCodes.SystemExercise, "System exercises cannot be modified.");
            return;
        }

        if (exercise.TrainerId != trainerId)
        {
            this.ThrowErrorWithCode(ErrorCodes.ExerciseNotOwned, "You can only edit your own custom exercises.");
            return;
        }

        // Early optimistic concurrency check (in-memory, before the DB write)
        if (exercise.Version != req.Version)
        {
            await this.SendProblemAsync(409, ErrorCodes.ExerciseVersionConflict,
                "Version conflict. The exercise was modified by another request.", ct);
            return;
        }

        var localizedNames = (!string.IsNullOrWhiteSpace(req.NameEn) || !string.IsNullOrWhiteSpace(req.NameCs) || !string.IsNullOrWhiteSpace(req.NameDe))
            ? new LocalizedNames
            {
                En = req.NameEn?.Trim(),
                Cs = req.NameCs?.Trim(),
                De = req.NameDe?.Trim(),
            }
            : null;

        var newVersion = exercise.Version + 1;

        // Version-guarded update: filter includes current version to prevent concurrent writes
        var versionFilter = Builders<Exercise>.Filter.Eq(e => e.ExternalId, req.ExerciseId)
            & Builders<Exercise>.Filter.Eq(e => e.Version, req.Version);

        var update = Builders<Exercise>.Update
            .Set(e => e.Name, req.Name.Trim())
            .Set(e => e.LocalizedNames, localizedNames)
            .Set(e => e.Description, req.Description?.Trim())
            .Set(e => e.MuscleGroups, req.MuscleGroups)
            .Set(e => e.Equipment, req.Equipment)
            .Set(e => e.Category, req.Category)
            .Set(e => e.Difficulty, req.Difficulty)
            .Set(e => e.TechniqueNotes, req.TechniqueNotes?.Trim())
            .Set(e => e.DateUpdated, DateTime.UtcNow)
            .Set(e => e.Version, newVersion);

        var result = await mongo.Exercises.UpdateOneAsync(versionFilter, update, cancellationToken: ct);

        // Double-guard: if ModifiedCount == 0 a concurrent write beat us
        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.ExerciseVersionConflict,
                "Version conflict. The exercise was modified concurrently.", ct);
            return;
        }

        // Re-fetch for response so Version in the response reflects the bumped value
        using var updatedCursor = await mongo.Exercises.FindAsync(
            Builders<Exercise>.Filter.Eq(e => e.ExternalId, req.ExerciseId),
            cancellationToken: ct);
        var updated = await updatedCursor.FirstOrDefaultAsync(ct);

        await Send.OkAsync(ExerciseSummary.FromDocument(updated!), ct);
    }
}
