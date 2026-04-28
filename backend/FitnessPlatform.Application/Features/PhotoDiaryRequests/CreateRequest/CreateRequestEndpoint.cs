using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// POST /trainer/photo-diary-requests
/// Creates a new photo diary request attached to an existing client link or pending invite.
/// </summary>
public class CreateRequestEndpoint(IApplicationDbContext db, IMongoContext mongo)
    : Endpoint<CreateRequestRequest, CreateRequestResponse>
{
    public override void Configure()
    {
        Post("/trainer/photo-diary-requests");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a photo diary request";
            s.Description = "Sends a photo diary request to a client via an existing link or a pending invite.";
        });
    }

    public override async Task HandleAsync(CreateRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var professionalId = Guid.Parse(userId);

        // Resolve the professional's profile (needed for ownership checks on link/invite)
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == professionalId, ct);

        if (professionalProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.TrainerProfileMissing, "Professional profile not found.");
            return;
        }

        Guid? clientUserId = null;

        if (req.LinkId.HasValue)
        {
            // Verify the link is owned by this professional and is active
            var link = await db.ClientProfessionalLinks
                .AsNoTracking()
                .Include(l => l.ClientProfile)
                .FirstOrDefaultAsync(l => l.Id == req.LinkId.Value, ct);

            if (link is null || link.ProfessionalProfileId != professionalProfile.Id || !link.IsActive)
            {
                await SendProblemDetailsAsync(404, ErrorCodes.PhotoDiaryRequestLinkNotOwned,
                    "Link not found or does not belong to you.", ct);
                return;
            }

            clientUserId = link.ClientProfile.UserId;
        }
        else if (req.PendingInviteId.HasValue)
        {
            // Verify the invite is owned by this professional
            var invite = await db.PendingInvites
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == req.PendingInviteId.Value, ct);

            if (invite is null || invite.ProfessionalProfileId != professionalProfile.Id)
            {
                await SendProblemDetailsAsync(404, ErrorCodes.PhotoDiaryRequestInviteNotOwned,
                    "Pending invite not found or does not belong to you.", ct);
                return;
            }

            // clientUserId remains null for invite-based requests until the invite is accepted
        }

        // Validate planId ownership if provided (check both nutrition and training plans)
        if (req.PlanId.HasValue && clientUserId.HasValue)
        {
            var planId = req.PlanId.Value;

            var nutritionFilter = Builders<Domain.Documents.NutritionPlan>.Filter
                .Eq(p => p.ExternalId, planId);
            var nutritionPlan = await (await mongo.NutritionPlans
                .FindAsync(nutritionFilter, cancellationToken: ct))
                .FirstOrDefaultAsync(ct);

            bool planBelongsToClient;
            if (nutritionPlan is not null)
            {
                planBelongsToClient = nutritionPlan.ClientId == clientUserId.Value;
            }
            else
            {
                var trainingFilter = Builders<Domain.Documents.TrainingPlan>.Filter
                    .Eq(p => p.ExternalId, planId);
                var trainingPlan = await (await mongo.TrainingPlans
                    .FindAsync(trainingFilter, cancellationToken: ct))
                    .FirstOrDefaultAsync(ct);

                planBelongsToClient = trainingPlan is not null && trainingPlan.ClientId == clientUserId.Value;
            }

            if (!planBelongsToClient)
            {
                await SendProblemDetailsAsync(404, ErrorCodes.PhotoDiaryRequestPlanNotOwned,
                    "The specified plan was not found or does not belong to this client.", ct);
                return;
            }
        }

        var request = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = professionalId,
            LinkId = req.LinkId,
            PendingInviteId = req.PendingInviteId,
            PlanId = req.PlanId,
            DurationDays = req.DurationDays,
            Status = PhotoDiaryStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(ct);

        await Send.CreatedAtAsync<CreateRequestEndpoint>(null, new CreateRequestResponse
        {
            Id = request.Id,
            ProfessionalId = request.ProfessionalId,
            LinkId = request.LinkId,
            PendingInviteId = request.PendingInviteId,
            PlanId = request.PlanId,
            DurationDays = request.DurationDays,
            Status = request.Status,
            CreatedAt = request.CreatedAt,
        }, cancellation: ct);
    }

    private async Task SendProblemDetailsAsync(int statusCode, string errorCode, string detail, CancellationToken ct)
    {
        await this.SendProblemAsync(statusCode, errorCode, detail, ct);
    }
}
