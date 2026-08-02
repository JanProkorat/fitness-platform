using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.GetWorkoutTemplate;

/// <summary>
/// Returns a single section template owned by the calling trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetWorkoutTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetWorkoutTemplateRequest, WorkoutTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/section-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get section template";
            s.Description = "Returns a single section template. Returns 403 if the template belongs to another trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetWorkoutTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        using var cursor = await mongo.WorkoutTemplates.FindAsync(
            Builders<WorkoutTemplate>.Filter.Eq(t => t.ExternalId, req.TemplateId),
            cancellationToken: ct);
        var template = await cursor.FirstOrDefaultAsync(ct);

        if (template is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.WorkoutTemplateNotFound, "Section template not found.");
            return;
        }

        if (template.OwnerTrainerId != trainerId)
        {
            this.ThrowErrorWithCode(ErrorCodes.WorkoutTemplateNotOwned, "Section template belongs to another trainer.");
            return;
        }

        await Send.OkAsync(WorkoutTemplateResponse.FromDocument(template), ct);
    }
}
