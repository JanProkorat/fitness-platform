using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.PhotoDiaryRequests.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.DismissRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/dismiss
/// Transitions a Pending request to Dismissed, optionally recording a reason.
/// Mutually exclusive with accept: once accepted the request is no longer Pending.
/// After a successful transition emits a <c>photoDiaryDismissed</c> SignalR event to the
/// <b>professional</b> group (<see cref="Domain.Entities.PhotoDiaryRequest.ProfessionalId"/>)
/// so the trainer/nutritionist sees the update in real time.
/// Broadcast failures are best-effort and never fail the HTTP response.
/// </summary>
public class DismissRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ILogger<DismissRequestEndpoint> logger)
    : Endpoint<DismissRequestRequest, DismissRequestResponse>
{
    public override void Configure()
    {
        Post("/client/photo-diary-requests/{id}/dismiss");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Dismiss a photo diary request";
            s.Description = "Transitions a Pending photo diary request to Dismissed, optionally recording a reason.";
        });
    }

    public override async Task HandleAsync(DismissRequestRequest req, CancellationToken ct)
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

        // 409 if not in Pending status (also covers the mutually-exclusive accept case)
        if (request.Status != PhotoDiaryStatus.Pending)
        {
            await this.SendProblemAsync(409, ErrorCodes.PhotoDiaryRequestInvalidStatus,
                "This request is not in Pending status and cannot be dismissed.", ct);
            return;
        }

        request.Status = PhotoDiaryStatus.Dismissed;
        request.DismissReason = req.Reason;
        request.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // ── Emit photoDiaryDismissed to the professional group (best-effort) ─────
        // Recipient: request.ProfessionalId  →  nutritionist/trainer group.
        try
        {
            var clientName = ResolveClientName(request, emailClaim);
            await notifier.NotifyAsync(
                request.ProfessionalId,   // → professional group
                "photodiarydismissed",
                new PhotoDiaryDismissedEvent
                {
                    RequestId = request.Id,
                    ClientName = clientName,
                    DismissReason = request.DismissReason,
                    DismissedAt = request.UpdatedAt,
                },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to emit photoDiaryDismissed for request {RequestId} to professional {ProfessionalId}",
                request.Id, request.ProfessionalId);
        }

        await Send.OkAsync(new DismissRequestResponse
        {
            Id = request.Id,
            Status = request.Status,
            DismissReason = request.DismissReason,
        }, ct);
    }

    /// <summary>
    /// Resolves a display name for the client:
    /// link-based → from the ClientProfile.User navigation; invite-based → from PendingInvite names.
    /// Falls back to the email claim if nothing else is available.
    /// </summary>
    private static string ResolveClientName(
        Domain.Entities.PhotoDiaryRequest request,
        string? clientEmail)
    {
        if (request.Link?.ClientProfile?.User is { } user)
            return $"{user.FirstName} {user.LastName}".Trim();

        if (request.PendingInvite is { } invite)
            return $"{invite.FirstName} {invite.LastName}".Trim();

        return clientEmail ?? string.Empty;
    }
}
