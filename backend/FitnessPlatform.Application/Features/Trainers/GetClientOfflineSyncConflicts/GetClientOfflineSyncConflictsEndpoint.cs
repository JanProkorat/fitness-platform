using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.GetClientOfflineSyncConflicts;

/// <summary>
/// Lists the offline-sync conflicts of a linked client on plans the caller authored, newest first.
/// The caller needs a live link with effective nutrition access.
/// </summary>
/// <param name="mongo">Document data source.</param>
/// <param name="db">Relational data source.</param>
/// <param name="linkAuthorizationService">Resolves the caller's link to the client.</param>
/// <param name="coachDiscipline">Narrows the link flags to the disciplines the caller still holds a role for.</param>
/// <param name="audit">Audit logging service.</param>
internal sealed class GetClientOfflineSyncConflictsEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    ICoachDisciplineAccess coachDiscipline,
    IAuditService audit)
    : Endpoint<GetClientOfflineSyncConflictsRequest, GetClientOfflineSyncConflictsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/offline-sync-conflicts");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List a client's offline-sync conflicts";
            s.Description = "Returns paginated client actions that collided with a plan change, newest first. Sets X-Total-Count.";
            s.Responses[StatusCodes.Status200OK] = "One page of conflicts";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid paging parameters";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The link does not grant nutrition access";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found or not linked to the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientOfflineSyncConflictsRequest req, CancellationToken ct)
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
                     & Builders<OfflineSyncConflict>.Filter.Eq(c => c.PlanAuthorId, coachUserId);

        var total = await mongo.OfflineSyncConflicts.CountDocumentsAsync(filter, cancellationToken: ct);
        HttpContext.Response.Headers["X-Total-Count"] = total.ToString();

        var page = await mongo.OfflineSyncConflicts
            .Find(filter)
            .SortByDescending(c => c.DateCreated)
            .Skip((req.Page - 1) * req.PageSize)
            .Limit(req.PageSize)
            .ToListAsync(ct);

        await audit.LogAsync(
            coachUserId,
            "Read",
            "OfflineSyncConflicts",
            req.ClientId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new GetClientOfflineSyncConflictsResponse
        {
            Items = page.Select(OfflineSyncConflictDto.FromDocument).ToList(),
        }, ct);
    }
}
