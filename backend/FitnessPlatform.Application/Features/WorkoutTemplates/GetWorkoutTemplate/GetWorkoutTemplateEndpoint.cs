using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.GetWorkoutTemplate;

/// <summary>
/// Returns a single workout template owned by the calling trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetWorkoutTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetWorkoutTemplateRequest, WorkoutTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/workout-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get workout template";
            s.Description = "Returns a single workout template. Another trainer's template returns 404, identical to a genuinely missing template.";
            s.Responses[StatusCodes.Status200OK] = "Workout template detail";
            s.Responses[StatusCodes.Status404NotFound] = "Workout template not found, or not owned by the caller";
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

        if (template is null || template.OwnerTrainerId != trainerId)
        {
            await this.SendProblemAsync(404, ErrorCodes.WorkoutTemplateNotFound, WorkoutTemplateErrors.NotFoundDetail, ct);
            return;
        }

        await Send.OkAsync(WorkoutTemplateResponse.FromDocument(template), ct);
    }
}
