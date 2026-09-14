using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;

/// <summary>
/// Retrieves a single session template by its public identifier. Trainers see their own
/// templates at any visibility and other trainers' public templates.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class GetSessionTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetSessionTemplateRequest, SessionTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/session-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(GetSessionTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Get session template";
            s.Description = "Returns full detail of a session template. Trainers can read their own templates (any visibility) and public templates owned by others; other trainers' private templates return 404, identical to a genuinely missing template.";
            s.Responses[StatusCodes.Status200OK] = "Session template detail";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Session template not found, or not readable by the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSessionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.SessionTemplates, req.TemplateId, trainerId, SessionTemplateErrors.Denial, ct);

        if (template is null)
        {
            return;
        }

        await Send.OkAsync(SessionTemplateDetailResponse.FromDocument(template, trainerId), ct);
    }
}
