using System.Globalization;
using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Extensions;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FormUp.Application.Features.PhotoDiaryRequests.SubmitRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/submit
/// Transitions an Accepted or InProgress request to Completed, recording CompletedAt.
/// After a successful transition emits a <c>photoDiarySubmitted</c> SignalR event to the
/// <b>professional</b> group (<see cref="Domain.Entities.PhotoDiaryRequest.ProfessionalId"/>)
/// so the trainer/nutritionist sees the completed diary in real time.
/// Broadcast failures are best-effort and never fail the HTTP response.
/// </summary>
public class SubmitRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    INotificationEmailSender notificationEmails,
    ILogger<SubmitRequestEndpoint> logger)
    : Endpoint<SubmitRequestRequest, SubmitRequestResponse>
{
    public override void Configure()
    {
        Post("/client/photo-diary-requests/{id}/submit");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Submit / finalize a photo diary";
            s.Description = "Transitions an Accepted or InProgress photo diary request to Completed.";
        });
    }

    public override async Task HandleAsync(SubmitRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        var emailClaim = User.FindFirstValue(AppClaims.Email);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var clientUserId = Guid.Parse(userId);

        var request = await db.PhotoDiaryRequests
            .Include(r => r.Link)
                .ThenInclude(l => l!.ClientProfile)
                    .ThenInclude(cp => cp.User)
            .Include(r => r.PendingInvite)
            .FirstOrDefaultAsync(r => r.Id == req.Id, ct);

        // 404 if not found — do not leak existence for IDOR
        if (request is null || !PhotoDiaryRequestOwnership.IsOwnedByClient(request, clientUserId, emailClaim))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 409 if not in a submittable status
        if (request.Status is not (PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress))
        {
            await this.SendProblemAsync(409, ErrorCodes.PhotoDiaryRequestInvalidStatus,
                "This request must be in Accepted or InProgress status to be submitted.", ct);
            return;
        }

        request.Status = PhotoDiaryStatus.Completed;
        request.CompletedAt = DateTimeOffset.UtcNow;
        request.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // ── Emit photoDiarySubmitted to the professional group (best-effort) ─────
        // Recipient: request.ProfessionalId  →  nutritionist/trainer group.
        try
        {
            var clientName = ResolveClientName(request, emailClaim);
            var photoCount = await db.PlanPhotos
                .CountAsync(p => p.DiaryRequestId == request.Id, ct);

            await notifier.NotifyAsync(
                request.ProfessionalId,   // → professional group
                "photodiarysubmitted",
                new PhotoDiarySubmittedEvent
                {
                    RequestId = request.Id,
                    ClientName = clientName,
                    PhotoCount = photoCount,
                    SubmittedAt = request.CompletedAt!.Value,
                },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to emit photoDiarySubmitted for request {RequestId} to professional {ProfessionalId}",
                request.Id, request.ProfessionalId);
        }

        await NotifyProfessionalAsync(request, clientUserId, emailClaim, ct);

        await Send.OkAsync(new SubmitRequestResponse
        {
            Id = request.Id,
            Status = request.Status,
            CompletedAt = request.CompletedAt,
        }, ct);
    }

    /// <summary>
    /// In-app notice plus email for the professional. Best-effort: the submit already succeeded.
    /// Also covers food-diary requests, so the copy says photos generically.
    /// </summary>
    private async Task NotifyProfessionalAsync(
        Domain.Entities.PhotoDiaryRequest request, Guid clientUserId, string? clientEmail, CancellationToken ct)
    {
        try
        {
            var clientProfilePublicId = request.Link?.ClientProfile?.PublicId
                ?? await db.ClientProfiles
                    .AsNoTracking()
                    .Where(cp => cp.UserId == clientUserId)
                    .Select(cp => (Guid?)cp.PublicId)
                    .FirstOrDefaultAsync(ct);
            var clientName = ResolveClientName(request, clientEmail);
            var photoCount = await db.PlanPhotos.CountAsync(p => p.DiaryRequestId == request.Id, ct);

            var noticeParameters = new Dictionary<string, string>
            {
                ["clientName"] = clientName,
                ["photoCount"] = photoCount.ToString(CultureInfo.InvariantCulture),
                ["requestId"] = request.Id.ToString(),
            };
            var emailValues = new Dictionary<string, string>
            {
                [NotificationEmailWorkItem.ClientNameKey] = clientName,
                [NotificationEmailWorkItem.PhotoCountKey] = photoCount.ToString(CultureInfo.InvariantCulture),
                [NotificationEmailWorkItem.RequestDateKey] = request.CreatedAt.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            };

            if (clientProfilePublicId is { } publicId)
            {
                noticeParameters["clientId"] = publicId.ToString();
                emailValues[NotificationEmailWorkItem.ClientPublicIdKey] = publicId.ToString();
            }

            await notificationService.CreateAsync(
                request.ProfessionalId, NotificationType.ProgressPhotosSubmitted, noticeParameters, ct: ct);
            await notificationEmails.SendAsync(
                request.ProfessionalId, NotificationEvent.ProgressPhotosSubmitted, emailValues, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Failed to notify professional {ProfessionalId} of submitted photos for request {RequestId}",
                request.ProfessionalId, request.Id);
        }
    }

    /// <summary>
    /// Resolves a display name for the client from the ClientProfile.User navigation.
    /// Falls back to the email claim if nothing else is available.
    /// </summary>
    private static string ResolveClientName(
        Domain.Entities.PhotoDiaryRequest request,
        string? clientEmail)
    {
        if (request.Link?.ClientProfile?.User is { } user)
            return $"{user.FirstName} {user.LastName}".Trim();

        return clientEmail ?? string.Empty;
    }
}
