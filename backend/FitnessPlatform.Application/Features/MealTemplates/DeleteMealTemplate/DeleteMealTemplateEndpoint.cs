using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.MealTemplates.DeleteMealTemplate;

/// <summary>
/// Permanently deletes a meal template owned by the calling nutritionist. Hard delete — this
/// library has no archived/soft-delete member (see <c>ILibraryDocument</c>'s remarks).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class DeleteMealTemplateEndpoint(IMongoContext mongo)
    : Endpoint<DeleteMealTemplateRequest, object>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/meal-templates/{TemplateId}");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(DeleteMealTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Delete meal template";
            s.Description = "Permanently deletes a meal template owned by the calling nutritionist. Visibility never grants write access.";
            s.Responses[StatusCodes.Status204NoContent] = "Meal template deleted";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Readable but owned by another nutritionist";
            s.Responses[StatusCodes.Status404NotFound] = "Meal template not found, or another owner's private template";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForWriteOrRespondAsync(
            mongo.MealTemplates, req.TemplateId, nutritionistId, MealTemplateErrors.Denial, ct);

        if (template is null)
        {
            return;
        }

        await mongo.MealTemplates.DeleteOneAsync(
            Builders<MealTemplate>.Filter.Eq(t => t.ExternalId, template.ExternalId), ct);

        await Send.NoContentAsync(ct);
    }
}
