using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ReviewClientOfflineSyncConflict;

/// <summary>
/// Marks one offline-sync conflict of a linked client reviewed. Repeating the call is a no-op.
/// The caller needs a live link with effective nutrition access and must be the plan's author.
/// </summary>
/// <param name="mongo">Document data source.</param>
/// <param name="db">Relational data source.</param>
/// <param name="linkAuthorizationService">Resolves the caller's link to the client.</param>
/// <param name="coachDiscipline">Narrows the link flags to the disciplines the caller still holds a role for.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class ReviewClientOfflineSyncConflictEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    ICoachDisciplineAccess coachDiscipline,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<ReviewClientOfflineSyncConflictRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientId}/offline-sync-conflicts/{ConflictId}/review");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Mark an offline-sync conflict reviewed";
            s.Description = "Sets the conflict's reviewed time once. Reviewing an already reviewed conflict succeeds without changing it. Clients post an empty JSON body.";
            s.Responses[StatusCodes.Status204NoContent] = "Conflict reviewed (or already reviewed)";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The link does not grant nutrition access";
            s.Responses[StatusCodes.Status404NotFound] = "Client not linked to the caller, or conflict not found for the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReviewClientOfflineSyncConflictRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var coachUserId = Guid.Parse(userId);

        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            coachUserId, req.ClientId, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var effective = await coachDiscipline.GetEffectiveAsync(coachUserId, capabilities.Value, ct);

        if (!effective.CanViewNutritionPlans)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        // Mongo documents key the client on ApplicationUser.Id, not on the public profile id (#840).
        var clientUserId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => cp.PublicId == req.ClientId)
            .Select(cp => cp.UserId)
            .FirstAsync(ct);

        var ownedFilter = Builders<OfflineSyncConflict>.Filter.Eq(c => c.ExternalId, req.ConflictId)
                          & Builders<OfflineSyncConflict>.Filter.Eq(c => c.ClientId, clientUserId)
                          & Builders<OfflineSyncConflict>.Filter.Eq(c => c.PlanAuthorId, coachUserId);

        var update = Builders<OfflineSyncConflict>.Update
            .Set(c => c.ReviewedAt, timeProvider.GetUtcNow().UtcDateTime)
            .Set(c => c.ReviewedByUserId, coachUserId)
            .Inc(c => c.Version, 1);

        var result = await mongo.OfflineSyncConflicts.UpdateOneAsync(
            ownedFilter & Builders<OfflineSyncConflict>.Filter.Eq(c => c.ReviewedAt, null),
            update,
            cancellationToken: ct);

        if (result.MatchedCount == 0
            && await mongo.OfflineSyncConflicts.CountDocumentsAsync(ownedFilter, cancellationToken: ct) == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await audit.LogAsync(
            coachUserId,
            "Update",
            "OfflineSyncConflicts",
            req.ClientId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.NoContentAsync(ct);
    }
}
