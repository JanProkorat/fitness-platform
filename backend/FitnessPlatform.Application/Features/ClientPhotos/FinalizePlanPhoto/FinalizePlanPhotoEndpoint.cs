using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.PhotoDiaryRequests;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;

/// <summary>
/// Finalizes a plan photo upload by inserting a <see cref="PlanPhoto"/> row in PostgreSQL.
/// The caller must have already uploaded the image to blob storage using the pre-signed URL
/// from POST /client/plans/{planId}/photos/upload-url.
///
/// Ownership: looks up the plan in NutritionPlans first; falls back to TrainingPlans.
/// Returns 404 if neither exists for the given client.
/// After a successful insert, when the resolved professional still holds a live link that
/// grants the plan's domain capability (F6 residual — plan authorship is permanent, the link
/// is not):
/// <list type="bullet">
///   <item>Emits a <c>planPhotoUploaded</c> SignalR event to the owning professional.</item>
///   <item>When <see cref="FinalizePlanPhotoRequest.DiaryRequestId"/> is set, additionally emits
///     a <c>photoDiaryPhotoUploaded</c> event to the same professional group so the trainer/
///     nutritionist can track diary progress in real time.</item>
/// </list>
/// Both broadcasts (and the capability check itself) are best-effort: a failure does not fail
/// the HTTP response — the PlanPhoto row is already committed.
/// </summary>
/// <param name="mongo">MongoDB context for plan lookup.</param>
/// <param name="db">Relational database context for profile lookup and photo insert.</param>
/// <param name="notifier">Realtime notifier for pushing the SignalR events.</param>
/// <param name="linkAuthorizationService">Link capability service — gates both professional-addressed broadcasts.</param>
/// <param name="logger">Logger.</param>
/// <param name="blobStorage">Blob storage service — converts the newly-persisted BlobUrl into a
/// short-lived pre-signed read URL before echoing it back in the 201 response (F9).</param>
public class FinalizePlanPhotoEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IClientLinkAuthorizationService linkAuthorizationService,
    ILogger<FinalizePlanPhotoEndpoint> logger,
    IBlobStorageService blobStorage)
    : Endpoint<FinalizePlanPhotoRequest, PlanPhotoResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/plans/{PlanId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Finalize plan photo upload";
            s.Description =
                "Inserts a PlanPhoto row after the client has PUT the blob to the pre-signed URL. "
                + "The plan is looked up in NutritionPlans first; if not found, TrainingPlans. "
                + "Returns 404 if neither exists for this client. "
                + "Sets PlanType and LinkId automatically from the found plan. "
                + "When DiaryRequestId is provided the photo is linked to the diary request; "
                + "the request must be owned by the calling client and in Accepted or InProgress "
                + "status. The first photo upload for an Accepted request transitions it to InProgress.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FinalizePlanPhotoRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        var emailClaim = User.FindFirstValue(AppClaims.Email);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        // Normalise to the canonical stored form before persisting — a client may echo back the
        // short-lived DisplayUrl issued by GenerateReadUrlAsync (or, from an app build that
        // predates the identity/presentation split, a value that used to BE the permanent
        // BlobUrl). Without this the signed query string becomes the permanently stored value,
        // and once the signature lapses GenerateReadUrlAsync can no longer resolve it back to a
        // container path (F9 follow-up). The validator already confirms req.BlobUrl matches this
        // plan's storage prefix; this only re-derives the canonical form, it does not widen what
        // is accepted.
        var canonicalBlobUrl = blobStorage.NormalizeToCanonicalUrl(req.BlobUrl);
        if (canonicalBlobUrl is null)
        {
            await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                "Photo URL is not a recognised blob storage URL.", ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == callerUserId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve plan type, link, and owning professional: nutrition first, training fallback
        var (planType, linkId, professionalUserId) = await ResolvePlanAsync(req.PlanId, clientId, ct);

        if (planType is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // ── Diary request validation (only when DiaryRequestId is provided) ──
        PhotoDiaryRequest? diaryRequest = null;
        if (req.DiaryRequestId.HasValue)
        {
            diaryRequest = await db.PhotoDiaryRequests
                .Include(r => r.Link)
                    .ThenInclude(l => l!.ClientProfile)
                        .ThenInclude(cp => cp.User)
                .Include(r => r.PendingInvite)
                .FirstOrDefaultAsync(r => r.Id == req.DiaryRequestId.Value, ct);

            // 404 if not found or owned by another client — don't leak existence
            if (diaryRequest is null || !PhotoDiaryRequestOwnership.IsOwnedByClient(diaryRequest, callerUserId, emailClaim))
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // 409 if status is not Accepted or InProgress
            if (diaryRequest.Status is not (PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress))
            {
                await this.SendProblemAsync(409, ErrorCodes.PhotoDiaryRequestInvalidStatus,
                    "Photos can only be uploaded against diary requests in Accepted or InProgress status.", ct);
                return;
            }
        }

        var now = DateTime.UtcNow;

        var photo = new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            PlanId = req.PlanId,
            PlanType = planType,
            LinkId = linkId,
            Category = req.Category,
            BlobUrl = canonicalBlobUrl,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            MealLogId = req.Category == PlanPhotoCategory.Food ? req.MealLogId : null,
            TakenAt = req.TakenAt ?? now,
            UploadedByUserId = callerUserId,
            DiaryRequestId = req.DiaryRequestId,
            DateCreated = now,
            DateUpdated = now
        };

        db.PlanPhotos.Add(photo);

        // Transition Accepted → InProgress on first photo upload
        if (diaryRequest is { Status: PhotoDiaryStatus.Accepted })
        {
            diaryRequest.Status = PhotoDiaryStatus.InProgress;
            diaryRequest.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        // Gate both broadcasts below on the professional's CURRENT link capability, not mere
        // plan authorship (F6 residual): professionalUserId is resolved from a permanent plan
        // field, but the underlying ClientProfessionalLink is not — a professional whose
        // collaboration ended must stop receiving the client's plan photos. Evaluated once,
        // and any failure here only skips the broadcast — it never fails the already-committed
        // write.
        var professionalHasAccess = false;
        if (professionalUserId.HasValue)
        {
            try
            {
                // professionalUserId / clientId are both ApplicationUser.Id (#840) — the
                // UserId-addressed overload; the professional here is the plan's permanent
                // author, not the caller. planType decides which domain flag is required.
                var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
                    professionalUserId.Value, clientId, ct);
                professionalHasAccess = planType == PlanPhotoType.Training
                    ? capabilities is { CanViewTrainingPlans: true }
                    : capabilities is { CanViewNutritionPlans: true };
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to verify professional {ProfessionalId} link capability for client {ClientId}; planPhotoUploaded/photoDiaryPhotoUploaded events skipped",
                    professionalUserId.Value, clientId);
            }
        }

        // Emit planPhotoUploaded to the owning professional (best-effort).
        if (professionalUserId.HasValue && professionalHasAccess)
        {
            try
            {
                await notifier.NotifyAsync(
                    professionalUserId.Value,
                    "planphotouploaded",
                    new PlanPhotoUploadedEvent
                    {
                        PlanId = photo.PlanId,
                        PhotoId = photo.PublicId,
                        Category = photo.Category,
                        TakenAt = photo.TakenAt
                    },
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to emit planPhotoUploaded for photo {PhotoId} to professional {ProfessionalId}",
                    photo.PublicId, professionalUserId.Value);
            }
        }
        else if (professionalUserId.HasValue)
        {
            logger.LogWarning(
                "Professional {ProfessionalId} lacks a live capable link to client {ClientId}; planPhotoUploaded event skipped",
                professionalUserId.Value, clientId);
        }
        else
        {
            logger.LogWarning(
                "Could not resolve owning professional for PlanId={PlanId}; planPhotoUploaded event skipped",
                req.PlanId);
        }

        // Emit photoDiaryPhotoUploaded when this photo is linked to a diary request (best-effort).
        // Recipient: request.ProfessionalId  →  nutritionist/trainer group.
        if (diaryRequest is not null && professionalUserId.HasValue && professionalHasAccess)
        {
            try
            {
                var clientName = ResolveClientNameFromDiaryRequest(diaryRequest, callerUserId, emailClaim);
                var dayIndex = diaryRequest.AcceptedAt.HasValue
                    ? Math.Max(1, (DateTimeOffset.UtcNow - diaryRequest.AcceptedAt.Value).Days + 1)
                    : 1;

                await notifier.NotifyAsync(
                    diaryRequest.ProfessionalId,  // → professional group
                    "photodiaryphotouploaded",
                    new PhotoDiaryPhotoUploadedEvent
                    {
                        RequestId = diaryRequest.Id,
                        PhotoId = photo.PublicId,
                        ClientName = clientName,
                        DayIndex = dayIndex,
                        Caption = photo.Description,
                        UploadedAt = DateTimeOffset.UtcNow,
                    },
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to emit photoDiaryPhotoUploaded for request {RequestId} to professional {ProfessionalId}",
                    diaryRequest.Id, diaryRequest.ProfessionalId);
            }
        }

        var response = MapToResponse(photo);

        // A stored BlobUrl is no longer publicly fetchable — mint a short-lived DisplayUrl
        // before echoing it back to the caller who just uploaded it (F9). BlobUrl itself stays
        // the canonical, permanent identity value.
        response.DisplayUrl = await blobStorage.GenerateReadUrlAsync(response.BlobUrl, ct) ?? string.Empty;

        HttpContext.Response.Headers.Location =
            $"/client/plans/{req.PlanId}/photos/{photo.PublicId}";
        await Send.ResponseAsync(response, StatusCodes.Status201Created, ct);
    }

    private async Task<(PlanPhotoType? planType, Guid? linkId, Guid? professionalUserId)> ResolvePlanAsync(
        Guid planId, Guid clientId, CancellationToken ct)
    {
        // Try nutrition plan
        var nutritionFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId));

        var nutritionCursor = await mongo.NutritionPlans.FindAsync(nutritionFilter, cancellationToken: ct);
        var nutritionPlan = await nutritionCursor.FirstOrDefaultAsync(ct);

        if (nutritionPlan is not null)
            return (PlanPhotoType.Nutrition, nutritionPlan.ExternalId,
                nutritionPlan.NutritionistId != Guid.Empty ? nutritionPlan.NutritionistId : null);

        // Fall back to training plan
        var trainingFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId));

        var trainingCursor = await mongo.TrainingPlans.FindAsync(trainingFilter, cancellationToken: ct);
        var trainingPlan = await trainingCursor.FirstOrDefaultAsync(ct);

        if (trainingPlan is not null)
            return (PlanPhotoType.Training, trainingPlan.ExternalId,
                trainingPlan.TrainerId != Guid.Empty ? trainingPlan.TrainerId : null);

        return (null, null, null);
    }

    private static PlanPhotoResponse MapToResponse(PlanPhoto photo) => new()
    {
        Id = photo.PublicId,
        BlobUrl = photo.BlobUrl,
        Category = photo.Category,
        Description = photo.Description,
        TakenAt = photo.TakenAt,
        MealLogId = photo.MealLogId,
        PlanId = photo.PlanId,
        PlanType = photo.PlanType,
        DateCreated = photo.DateCreated,
        UploadedByUserId = photo.UploadedByUserId,
        DiaryRequestId = photo.DiaryRequestId
    };

    /// <summary>
    /// Resolves a display name for the client from the diary request's navigation properties.
    /// </summary>
    private static string ResolveClientNameFromDiaryRequest(
        PhotoDiaryRequest request,
        Guid callerUserId,
        string? clientEmail)
    {
        if (request.Link?.ClientProfile?.User is { } user)
            return $"{user.FirstName} {user.LastName}".Trim();

        if (request.PendingInvite is { } invite)
            return $"{invite.FirstName} {invite.LastName}".Trim();

        return clientEmail ?? string.Empty;
    }
}
