using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SectionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SectionTemplates.UpdateSectionTemplate;

/// <summary>
/// Full-state update of a section template. Uses optimistic concurrency via the Version field.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateSectionTemplateEndpoint(IMongoContext mongo)
    : Endpoint<UpdateSectionTemplateRequest, SectionTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/section-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Update section template";
            s.Description = "Replaces name, format, and default exercises. Uses optimistic concurrency via the Version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSectionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Load
        using var cursor = await mongo.SectionTemplates.FindAsync(
            Builders<SectionTemplate>.Filter.Eq(t => t.ExternalId, req.TemplateId),
            cancellationToken: ct);
        var template = await cursor.FirstOrDefaultAsync(ct);

        if (template is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateNotFound, "Section template not found.");
            return;
        }

        // Ownership check
        if (template.OwnerTrainerId != trainerId)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateNotOwned, "Section template belongs to another trainer.");
            return;
        }

        // Optimistic concurrency — check version before mutating
        if (template.Version != req.Version)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateVersionConflict, "Version conflict. The template was modified by another request.");
            return;
        }

        // Mutate
        template.Name = req.Name.Trim();
        template.Notes = req.Notes?.Trim();
        template.DefaultFormat = req.DefaultFormat;
        template.DefaultFormatConfig = req.DefaultFormatConfig;
        template.DefaultExercises = req.DefaultExercises.Select(e => new SessionExercise
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
        }).ToList();
        template.UpdatedAt = DateTime.UtcNow;
        template.Version += 1;

        // Persist with version check (double-check at DB level)
        var versionFilter = Builders<SectionTemplate>.Filter.Eq(t => t.ExternalId, req.TemplateId)
                            & Builders<SectionTemplate>.Filter.Eq(t => t.Version, req.Version);

        var result = await mongo.SectionTemplates.ReplaceOneAsync(versionFilter, template, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateVersionConflict, "Version conflict. The template was modified by another request.");
            return;
        }

        await Send.OkAsync(SectionTemplateResponse.FromDocument(template), ct);
    }
}
