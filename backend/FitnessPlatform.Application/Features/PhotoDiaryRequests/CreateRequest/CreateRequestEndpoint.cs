using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// POST /trainer/photo-diary-requests
/// Creates a new photo diary request attached to an existing client link or pending invite.
/// After a successful save, emits a <c>photoDiaryRequested</c> SignalR event to the
/// <b>client</b> group so the client sees the new banner in real time:
/// <list type="bullet">
///   <item>Link-based: notified via <c>link.ClientProfile.UserId</c> (client group).</item>
///   <item>Invite-based + existing user: notified via the user found by the invite e-mail.</item>
///   <item>Invite-based + no registered user yet: no notification — the banner surfaces naturally
///     on next sign-in via the pending-banner query (#93).</item>
/// </list>
/// Broadcast failures are best-effort and never fail the HTTP response.
/// </summary>
public class CreateRequestEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IRealtimeNotifier notifier,
    UserManager<ApplicationUser> userManager,
    ILogger<CreateRequestEndpoint> logger)
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
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == professionalId, ct);

        if (professionalProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.TrainerProfileMissing, "Professional profile not found.");
            return;
        }

        // ClientProfile.UserId (ApplicationUser.Id) for plan-ownership lookups — Mongo
        // NutritionPlan/TrainingPlan store ClientId as the client's ApplicationUser.Id
        // since #840.
        ClientProfessionalLink? link = null;
        Guid? clientUserId = null;
        string? inviteEmail = null;

        if (req.LinkId.HasValue)
        {
            // Verify the link is owned by this professional and is active
            link = await db.ClientProfessionalLinks
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

            inviteEmail = invite.Email;
            // clientUserId resolved below after save (only if user is already registered)
        }

        // Validate planId ownership if provided (check both nutrition and training plans).
        // clientUserId is only set here on the link-based path (the invite path resolves it,
        // if at all, only after the save below), so `link` is guaranteed non-null whenever this
        // block runs. Beyond ownership, the caller's link must also carry the capability flag
        // matching the plan's domain — scoping a diary request to a plan the caller's own link
        // denies is the same cross-domain association the plan-addressed routes gate on.
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
                planBelongsToClient = nutritionPlan.ClientId == clientUserId.Value
                    && link is not null && link.CanViewNutritionPlans;
            }
            else
            {
                var trainingFilter = Builders<Domain.Documents.TrainingPlan>.Filter
                    .Eq(p => p.ExternalId, planId);
                var trainingPlan = await (await mongo.TrainingPlans
                    .FindAsync(trainingFilter, cancellationToken: ct))
                    .FirstOrDefaultAsync(ct);

                planBelongsToClient = trainingPlan is not null && trainingPlan.ClientId == clientUserId.Value
                    && link is not null && link.CanViewTrainingPlans;
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

        // ── Emit photoDiaryRequested to the client group (best-effort) ───────────
        // Link-based: client is already known.
        // Invite-based: resolve the registered user by e-mail; skip if not yet registered.
        if (clientUserId is null && inviteEmail is not null)
        {
            var invitedUser = await userManager.FindByEmailAsync(inviteEmail);
            clientUserId = invitedUser?.Id;
        }

        if (clientUserId.HasValue)
        {
            try
            {
                var professionalName =
                    $"{professionalProfile.User.FirstName} {professionalProfile.User.LastName}".Trim();

                // Resolve the professional's role from the claims (Trainer or Nutritionist).
                // FastEndpoints encodes roles under the short "role" claim type, not ClaimTypes.Role.
                var professionalRole = User.FindFirstValue("role")
                    ?? string.Empty;

                await notifier.NotifyAsync(
                    clientUserId.Value,   // → client group
                    "photodiaryrequested",
                    new PhotoDiaryRequestedEvent
                    {
                        RequestId = request.Id,
                        ProfessionalName = professionalName,
                        ProfessionalRole = professionalRole,
                        DurationDays = request.DurationDays,
                        PlanId = request.PlanId,
                        CreatedAt = request.CreatedAt,
                    },
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to emit photoDiaryRequested for request {RequestId} to client {ClientId}",
                    request.Id, clientUserId.Value);
            }
        }
        else if (inviteEmail is not null)
        {
            // No registered user for the invite e-mail yet — notification skipped intentionally.
            logger.LogDebug(
                "Skipping photoDiaryRequested for request {RequestId}: invite e-mail {Email} has no registered user yet",
                request.Id, inviteEmail);
        }

        // Send 200 (not 201) — the project's NSwag-generated TypeScript client only handles
        // 200 as the success branch; a 201 response would be treated as an error and surface
        // in an error toast on the web. The rest of the codebase's POST endpoints follow
        // this same pragmatic convention.
        await Send.OkAsync(new CreateRequestResponse
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
