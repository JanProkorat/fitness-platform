using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;

/// <summary>
/// Creates a new section template for the calling trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class CreateWorkoutTemplateEndpoint(IMongoContext mongo)
    : Endpoint<CreateWorkoutTemplateRequest, WorkoutTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/section-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create section template";
            s.Description = "Creates a new reusable training section template owned by the calling trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateWorkoutTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);
        var now = DateTime.UtcNow;

        var template = new WorkoutTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerTrainerId = trainerId,
            Name = req.Name.Trim(),
            Notes = req.Notes?.Trim(),
            DefaultFormat = req.DefaultFormat,
            DefaultFormatConfig = req.DefaultFormatConfig,
            DefaultExercises = req.DefaultExercises.Select(e => new SessionExercise
            {
                ExerciseExternalId = e.ExerciseExternalId,
                ExerciseName = e.ExerciseName,
                Order = e.Order,
                Notes = e.Notes?.Trim(),
                RestSeconds = e.RestSeconds,
                MovementType = e.MovementType,
                Format = e.Format,
                FormatConfig = e.FormatConfig,
                Sets = e.Sets.Select(s => new ExerciseSet
                {
                    SetNumber = s.SetNumber,
                    Type = s.Type,
                    Reps = s.Reps,
                    WeightKg = s.WeightKg,
                    DurationSeconds = s.DurationSeconds,
                    Rpe = s.Rpe,
                    DistanceMeters = s.DistanceMeters,
                    RestSeconds = s.RestSeconds
                }).ToList()
            }).ToList(),
            CreatedAt = now,
            UpdatedAt = now,
            Version = 1
        };

        await mongo.WorkoutTemplates.InsertOneAsync(template, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            WorkoutTemplateResponse.FromDocument(template),
            201,
            cancellation: ct);
    }
}
