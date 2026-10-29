using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ReviewAllClientOfflineSyncConflicts;

/// <summary>
/// Marks every unreviewed offline-sync conflict of a linked client on one of the caller's plans reviewed.
/// The caller needs a live link with effective nutrition access.
/// </summary>
/// <param name="mongo">Document data source.</param>
/// <param name="db">Relational data source.</param>
/// <param name="linkAuthorizationService">Resolves the caller's link to the client.</param>
/// <param name="coachDiscipline">Narrows the link flags to the disciplines the caller still holds a role for.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class ReviewAllClientOfflineSyncConflictsEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    ICoachDisciplineAccess coachDiscipline,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<ReviewAllClientOfflineSyncConflictsRequest, ReviewAllClientOfflineSyncConflictsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientId}/offline-sync-conflicts/review-all");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Description(b => b.ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces<ReviewAllClientOfflineSyncConflictsResponse>(StatusCodes.Status200OK));
        Summary(s =>
        {
            s.Summary = "Mark all of a client's conflicts on a plan reviewed";
            s.Description = "Marks every unreviewed conflict on the given plan reviewed and returns how many changed.";
            s.Responses[StatusCodes.Status200OK] = "Number of conflicts newly marked reviewed";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The link does not grant nutrition access";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found or not linked to the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReviewAllClientOfflineSyncConflictsRequest req, CancellationToken ct)
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

        var filter = Builders<OfflineSyncConflict>.Filter.Eq(c => c.ClientId, clientUserId)
                     & Builders<OfflineSyncConflict>.Filter.Eq(c => c.PlanId, req.PlanId)
                     & Builders<OfflineSyncConflict>.Filter.Eq(c => c.PlanAuthorId, coachUserId)
                     & Builders<OfflineSyncConflict>.Filter.Eq(c => c.ReviewedAt, null);

        var update = Builders<OfflineSyncConflict>.Update
            .Set(c => c.ReviewedAt, timeProvider.GetUtcNow().UtcDateTime)
            .Set(c => c.ReviewedByUserId, coachUserId)
            .Inc(c => c.Version, 1);

        var result = await mongo.OfflineSyncConflicts.UpdateManyAsync(filter, update, cancellationToken: ct);

        await audit.LogAsync(
            coachUserId,
            "Update",
            "OfflineSyncConflicts",
            req.ClientId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new ReviewAllClientOfflineSyncConflictsResponse
        {
            ReviewedCount = (int)result.ModifiedCount,
        }, ct);
    }
}
