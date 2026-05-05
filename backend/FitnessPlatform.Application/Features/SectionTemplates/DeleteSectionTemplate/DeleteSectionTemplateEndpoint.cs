using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SectionTemplates.DeleteSectionTemplate;

/// <summary>
/// Deletes a section template owned by the calling trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteSectionTemplateEndpoint(IMongoContext mongo)
    : Endpoint<DeleteSectionTemplateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/training/section-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Delete section template";
            s.Description = "Permanently deletes a section template. Returns 403 if owned by another trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSectionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Load to verify ownership before deleting
        using var cursor = await mongo.SectionTemplates.FindAsync(
            Builders<SectionTemplate>.Filter.Eq(t => t.ExternalId, req.TemplateId),
            cancellationToken: ct);
        var template = await cursor.FirstOrDefaultAsync(ct);

        if (template is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateNotFound, "Section template not found.");
            return;
        }

        if (template.OwnerTrainerId != trainerId)
        {
            this.ThrowErrorWithCode(ErrorCodes.SectionTemplateNotOwned, "Section template belongs to another trainer.");
            return;
        }

        await mongo.SectionTemplates.DeleteOneAsync(
            Builders<SectionTemplate>.Filter.Eq(t => t.ExternalId, req.TemplateId),
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
