using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.LinkPlan;

/// <summary>
/// POST /trainer/photo-diary-requests/{RequestId}/link
/// Retroactively links an EXISTING photo diary request to a nutrition or training plan.
/// Unlike creation (<see cref="CreateRequest.CreateRequestEndpoint"/>), where PlanId can only be
/// set as a forward pointer at create time, this endpoint lets a trainer/nutritionist attach a
/// plan to a diary after the fact — diary-level (whole-diary) granularity, mirroring #777's
/// response-level linking rather than linking individual <c>PlanPhoto</c> rows.
/// </summary>
public class LinkPlanEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo) : Endpoint<LinkPlanRequest, LinkPlanResponse>
{
    public override void Configure()
    {
        Post("/trainer/photo-diary-requests/{RequestId}/link");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Retroactively link a photo diary request to a plan";
            s.Description = "Sets PlanId on an existing photo diary request so it shows up under the linked nutrition or training plan.";
        });
    }

    public override async Task HandleAsync(LinkPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var professionalId = Guid.Parse(userId);

        // Load the diary request with its link → client profile chain, needed to resolve the
        // client's PublicId for the plan-ownership check below.
        var request = await db.PhotoDiaryRequests
            .Include(r => r.Link)
                .ThenInclude(l => l!.ClientProfile)
            .FirstOrDefaultAsync(r => r.Id == req.RequestId, ct);

        if (request is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.PhotoDiaryRequestNotFound,
                "Photo diary request not found.", ct);
            return;
        }

        if (request.ProfessionalId != professionalId)
        {
            await this.SendProblemAsync(403, ErrorCodes.PhotoDiaryRequestForbidden,
                "This photo diary request does not belong to you.", ct);
            return;
        }

        // Resolve the client's ApplicationUser.Id (Mongo plan documents' ClientId key since
        // #840) so the plan-ownership check (below) can verify the target plan actually
        // belongs to this diary's client. Invite-based requests that haven't been accepted
        // into a link yet have no resolvable client — the plan can never be proven to belong
        // to them, so treat as not-owned.
        Guid? clientUserId = request.Link?.ClientProfile.UserId;

        var planBelongsToClient = false;
        if (clientUserId.HasValue)
        {
            // Ownership check mirrors CreateRequestEndpoint: check nutrition plans first, then
            // fall back to training plans — the request isn't scoped to a single plan kind.
            var nutritionFilter = Builders<Domain.Documents.NutritionPlan>.Filter
                .Eq(p => p.ExternalId, req.PlanId);
            var nutritionPlan = await (await mongo.NutritionPlans
                .FindAsync(nutritionFilter, cancellationToken: ct))
                .FirstOrDefaultAsync(ct);

            if (nutritionPlan is not null)
            {
                planBelongsToClient = nutritionPlan.ClientId == clientUserId.Value;
            }
            else
            {
                var trainingFilter = Builders<Domain.Documents.TrainingPlan>.Filter
                    .Eq(p => p.ExternalId, req.PlanId);
                var trainingPlan = await (await mongo.TrainingPlans
                    .FindAsync(trainingFilter, cancellationToken: ct))
                    .FirstOrDefaultAsync(ct);

                planBelongsToClient = trainingPlan is not null && trainingPlan.ClientId == clientUserId.Value;
            }
        }

        if (!planBelongsToClient)
        {
            await this.SendProblemAsync(404, ErrorCodes.PhotoDiaryRequestPlanNotOwned,
                "The specified plan was not found or does not belong to this client.", ct);
            return;
        }

        request.PlanId = req.PlanId;
        request.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new LinkPlanResponse
        {
            Id = request.Id,
            ProfessionalId = request.ProfessionalId,
            LinkId = request.LinkId,
            PendingInviteId = request.PendingInviteId,
            PlanId = request.PlanId,
            DurationDays = request.DurationDays,
            Status = request.Status,
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt,
        }, cancellation: ct);
    }
}
