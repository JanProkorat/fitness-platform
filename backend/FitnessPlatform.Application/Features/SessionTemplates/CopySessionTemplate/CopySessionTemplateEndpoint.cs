using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.SessionTemplates.CopySessionTemplate;

/// <summary>
/// Clones any readable session template (the caller's own, or another owner's public template)
/// into a fresh <see cref="LibraryVisibility.Private"/> template owned by the caller.
/// </summary>
/// <remarks>
/// This is a <b>read-guarded write</b>, not a write-guarded one: <c>copy</c> creates a new
/// document but is gated on read access, because another trainer's public template must remain
/// copyable — wiring the write guard here would wrongly 404/403 on a public template and break
/// copy-to-own. Also returns 404 (never 403) on another owner's Private source, per the
/// existence-non-disclosure rule — a read guard, not a write guard, naturally produces that
/// outcome since it never reaches the ownership check.
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class CopySessionTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CopySessionTemplateRequest, SessionTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/session-templates/{TemplateId}/copy");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(CopySessionTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Copy session template";
            s.Description = "Clones any readable session template (own, or another owner's public template) into a new Private template owned by the caller, with a fresh identifier. Leaves the source untouched.";
            s.Responses[StatusCodes.Status201Created] = "Copy created";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Source template not found, or another owner's private template";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CopySessionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var source = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.SessionTemplates, req.TemplateId, trainerId, SessionTemplateErrors.Denial, ct);

        if (source is null)
        {
            return;
        }

        var copy = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = trainerId,
            Name = source.Name,
            LocalizedNames = source.LocalizedNames,
            Description = source.Description,
            Difficulty = source.Difficulty,
            EstimatedDurationMinutes = source.EstimatedDurationMinutes,
            Format = source.Format,
            FormatConfig = source.FormatConfig,
            Workouts = source.Workouts,
            StandaloneExercises = source.StandaloneExercises,
            Visibility = LibraryVisibility.Private,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime,
            Version = 1
        };

        await mongo.SessionTemplates.InsertOneAsync(copy, cancellationToken: ct);

        await Send.CreatedAtAsync<GetSessionTemplateEndpoint>(
            new { TemplateId = copy.ExternalId },
            SessionTemplateDetailResponse.FromDocument(copy, trainerId),
            cancellation: ct);
    }
}
