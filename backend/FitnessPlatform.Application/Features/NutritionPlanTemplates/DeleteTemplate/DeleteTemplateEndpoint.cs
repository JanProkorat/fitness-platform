using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.DeleteTemplate;

/// <summary>
/// Hard-deletes a nutrition plan template. Owner-only — readable-but-not-owned (another owner's
/// Public entry) returns 403; unreadable (another owner's Private entry) returns 404,
/// indistinguishable from a genuinely missing template.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteTemplateEndpoint(IMongoContext mongo) : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/plan-templates/{TemplateId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete a nutrition plan template";
            s.Description = "Hard-deletes the template. Owner-only.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);
        var templateId = Route<Guid>("TemplateId");

        var template = await this.LoadLibraryEntryForWriteOrRespondAsync(
            mongo.NutritionPlanTemplates, templateId, ownerId, NutritionPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        await mongo.NutritionPlanTemplates.DeleteOneAsync(
            Builders<NutritionPlanTemplate>.Filter.Eq(t => t.ExternalId, template.ExternalId), ct);

        await Send.NoContentAsync(ct);
    }
}
