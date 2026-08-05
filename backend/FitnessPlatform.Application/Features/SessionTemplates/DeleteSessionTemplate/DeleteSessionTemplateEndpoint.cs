using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SessionTemplates.DeleteSessionTemplate;

/// <summary>
/// Permanently deletes a session template owned by the calling trainer. Hard delete — this
/// library has no archived/soft-delete member (see <c>ILibraryDocument</c>'s remarks).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class DeleteSessionTemplateEndpoint(IMongoContext mongo)
    : Endpoint<DeleteSessionTemplateRequest, object>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/training/session-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(DeleteSessionTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Delete session template";
            s.Description = "Permanently deletes a session template owned by the calling trainer. Visibility never grants write access.";
            s.Responses[StatusCodes.Status204NoContent] = "Session template deleted";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Readable but owned by another trainer";
            s.Responses[StatusCodes.Status404NotFound] = "Session template not found, or another owner's private template";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSessionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForWriteOrRespondAsync(
            mongo.SessionTemplates, req.TemplateId, trainerId, SessionTemplateErrors.Denial, ct);

        if (template is null)
        {
            return;
        }

        await mongo.SessionTemplates.DeleteOneAsync(
            Builders<SessionTemplate>.Filter.Eq(t => t.ExternalId, template.ExternalId), ct);

        await Send.NoContentAsync(ct);
    }
}
