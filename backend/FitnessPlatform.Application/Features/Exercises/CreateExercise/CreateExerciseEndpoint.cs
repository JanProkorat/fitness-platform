using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Exercises.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Application.Features.Exercises.CreateExercise;

/// <summary>
/// Creates a custom exercise owned by the authenticated trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class CreateExerciseEndpoint(IMongoContext mongo) : Endpoint<CreateExerciseRequest, ExerciseSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/exercises");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create custom exercise";
            s.Description = "Creates a new custom exercise. Only trainers can create custom exercises.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateExerciseRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var exercise = new Exercise
        {
            ExternalId = Guid.NewGuid(),
            Name = req.Name.Trim(),
            LocalizedNames = HasAnyLocalizedName(req) ? new LocalizedNames
            {
                En = req.NameEn?.Trim(),
                Cs = req.NameCs?.Trim(),
                De = req.NameDe?.Trim(),
            } : null,
            Description = req.Description?.Trim(),
            MuscleGroups = req.MuscleGroups,
            Equipment = req.Equipment,
            Category = req.Category,
            Difficulty = req.Difficulty,
            TechniqueNotes = req.TechniqueNotes?.Trim(),
            IsCustom = true,
            TrainerId = Guid.Parse(userId),
            IsActive = true,
            Source = "custom",
            DateCreated = DateTime.UtcNow
        };

        await mongo.Exercises.InsertOneAsync(exercise, cancellationToken: ct);

        await HttpContext.Response.SendAsync(ExerciseSummary.FromDocument(exercise), 201, cancellation: ct);
    }

    private static bool HasAnyLocalizedName(CreateExerciseRequest req) =>
        !string.IsNullOrWhiteSpace(req.NameEn) ||
        !string.IsNullOrWhiteSpace(req.NameCs) ||
        !string.IsNullOrWhiteSpace(req.NameDe);
}
