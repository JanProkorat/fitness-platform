using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;

/// <summary>
/// Updates an existing session template owned by the caller, with optimistic-concurrency CAS on
/// <c>Version</c>.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="guard">Shared version-gated fetch-check-replace skeleton.</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class UpdateSessionTemplateEndpoint(
    IMongoContext mongo,
    PlanConcurrencyGuard guard,
    TimeProvider timeProvider)
    : Endpoint<UpdateSessionTemplateRequest, SessionTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/session-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(UpdateSessionTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Update session template";
            s.Description = "Updates a session template owned by the calling trainer. Visibility grants read access only — writing always requires ownership.";
            s.Responses[StatusCodes.Status200OK] = "Session template updated";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Readable but owned by another trainer";
            s.Responses[StatusCodes.Status404NotFound] = "Session template not found, or another owner's private template";
            s.Responses[StatusCodes.Status409Conflict] = "Stale Version — the template was modified by another request";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSessionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var updated = await this.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            mongo.SessionTemplates,
            req.TemplateId,
            trainerId,
            SessionTemplateErrors.Denial,
            req.Version,
            guard,
            mutate: (template, _) =>
            {
                template.Name = req.Name;
                template.LocalizedNames = req.LocalizedNames;
                template.Description = req.Description;
                template.Difficulty = req.Difficulty;
                template.EstimatedDurationMinutes = req.EstimatedDurationMinutes;
                template.Format = req.Format;
                template.FormatConfig = req.FormatConfig;
                template.Workouts = req.Workouts;
                template.StandaloneExercises = req.StandaloneExercises;
                template.Visibility = req.Visibility;
                template.DateUpdated = timeProvider.GetUtcNow().UtcDateTime;
                template.Version += 1;
                return Task.FromResult(true);
            },
            ct);

        if (updated is null)
        {
            return;
        }

        await Send.OkAsync(SessionTemplateDetailResponse.FromDocument(updated, trainerId), ct);
    }
}
