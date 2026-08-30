using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlans;

/// <summary>
/// Lists training plans for the authenticated trainer with optional filtering and pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="linkAuthorizationService">Resolves the trainer-client link's CanViewTrainingPlans permission when filtering by client.</param>
/// <param name="db">Relational database context — resolves the client's public id to
/// ApplicationUser.Id, the canonical clientId key for Mongo documents (#840).</param>
public class GetTrainingPlansEndpoint(
    IMongoContext mongo, IClientLinkAuthorizationService linkAuthorizationService, IApplicationDbContext db)
    : Endpoint<GetTrainingPlansRequest, GetTrainingPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List training plans";
            s.Description = "Returns a paginated list of training plans owned by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlansRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Server-side enforcement of CanViewTrainingPlans (#590) — mirrors the ownership +
        // permission-flag check used elsewhere (e.g. ListClientPlansEndpoint). Explicit 403 when
        // the caller names a client they cannot see.
        if (req.ClientId.HasValue)
        {
            var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
                trainerId, req.ClientId.Value, ct);

            if (capabilities is not { CanViewTrainingPlans: true })
            {
                await Send.ForbiddenAsync(ct);
                return;
            }
        }

        var filterBuilder = Builders<TrainingPlan>.Filter;

        // Authorship alone is not access: TrainerId is permanent, the link is not. Scope the list
        // to the clients the caller is still actively linked to with training access, so a plan
        // whose collaboration has ended stops being served — and stops handing out its ExternalId.
        var accessibleClients = await linkAuthorizationService.GetAccessibleClientsAsync(
            trainerId, ct, LinkCapabilityScope.TrainingOnly);

        var filter = filterBuilder.Eq(p => p.TrainerId, trainerId)
                     & filterBuilder.In(p => p.ClientId, accessibleClients.Select(c => c.ClientUserId));

        if (req.ClientId.HasValue)
        {
            // req.ClientId is the client's public id — resolve to ApplicationUser.Id before
            // filtering TrainingPlan.ClientId (#840). No match means the plan list is empty,
            // not an error — mirrors the "not found leaks nothing" style used elsewhere.
            var clientProfile = await db.ClientProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId.Value, ct);

            filter &= filterBuilder.Eq(p => p.ClientId, clientProfile?.UserId ?? Guid.Empty);
        }

        if (req.Status.HasValue)
        {
            filter &= filterBuilder.Eq(p => p.Status, req.Status.Value);
        }

        var totalCount = await mongo.TrainingPlans.CountDocumentsAsync(filter, cancellationToken: ct);

        var sort = Builders<TrainingPlan>.Sort.Descending(p => p.DateCreated);
        var options = new FindOptions<TrainingPlan>
        {
            Sort = sort,
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        var cursor = await mongo.TrainingPlans.FindAsync(filter, options, ct);
        var plans = await cursor.ToListAsync(ct);

        // Batch-resolve ClientId (internal ApplicationUser.Id since #840) back to the
        // client-facing ClientProfile.PublicId for the response — one query for the whole
        // page, not one per plan.
        var clientPublicIds = await db.ResolveClientPublicIdsAsync(plans.Select(p => p.ClientId), ct);

        await Send.OkAsync(new GetTrainingPlansResponse
        {
            Plans = plans
                .Select(p => TrainingPlanSummaryDto.FromDocument(
                    p,
                    clientPublicIds.GetValueOrDefault(p.ClientId, p.ClientId)))
                .ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
