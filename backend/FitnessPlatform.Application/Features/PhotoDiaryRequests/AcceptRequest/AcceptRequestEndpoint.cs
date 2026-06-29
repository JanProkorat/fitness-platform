using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/accept
/// Transitions a Pending request to Accepted, records the chosen Mode and AcceptedAt timestamp.
/// After a successful transition emits a <c>photoDiaryAccepted</c> SignalR event to the
/// <b>professional</b> group (<see cref="Domain.Entities.PhotoDiaryRequest.ProfessionalId"/>)
/// so the trainer/nutritionist's open diary card flips from Pending to Accepted in real time.
/// Broadcast failures are best-effort and never fail the HTTP response.
/// </summary>
public class AcceptRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ILogger<AcceptRequestEndpoint> logger)
    : Endpoint<AcceptRequestRequest, AcceptRequestResponse>
{
    public override void Configure()
    {
        Post("/client/photo-diary-requests/{id}/accept");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Accept a photo diary request";
            s.Description = "Transitions a Pending photo diary request to Accepted, recording the chosen mode.";
        });
    }

    public override async Task HandleAsync(AcceptRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        var emailClaim = User.FindFirstValue(AppClaims.Email);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var clientUserId = Guid.Parse(userId);

        // Load the request with the link/invite for ownership check.
        // ClientProfile.User is included so ResolveClientName can populate the
        // SignalR payload without a second round-trip.
        var request = await db.PhotoDiaryRequests
            .Include(r => r.Link)
                .ThenInclude(l => l!.ClientProfile)
                    .ThenInclude(cp => cp.User)
            .Include(r => r.PendingInvite)
            .FirstOrDefaultAsync(r => r.Id == req.Id, ct);

        // 404 if not found — do not leak existence for IDOR
        if (request is null || !IsOwnedByClient(request, clientUserId, emailClaim))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 409 if not in Pending status
        if (request.Status != PhotoDiaryStatus.Pending)
        {
            await this.SendProblemAsync(409, ErrorCodes.PhotoDiaryRequestInvalidStatus,
                "This request is not in Pending status and cannot be accepted.", ct);
            return;
        }

        request.Status = PhotoDiaryStatus.Accepted;
        request.Mode = req.Mode;
        request.AcceptedAt = DateTimeOffset.UtcNow;
        request.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // ── Emit photoDiaryAccepted to the professional group (best-effort) ─────
        // Recipient: request.ProfessionalId  →  nutritionist/trainer group.
        // The web AppShell handler invalidates ['diary-requests', planId] so the
        // open diary card flips from Pending to Accepted/InProgress immediately.
        try
        {
            var clientName = ResolveClientName(request, emailClaim);
            await notifier.NotifyAsync(
                request.ProfessionalId,   // → professional group
                "photodiaryaccepted",
                new PhotoDiaryAcceptedEvent
                {
                    RequestId = request.Id,
                    ClientName = clientName,
                    Mode = request.Mode.ToString(),
                    PlanId = request.PlanId,
                    AcceptedAt = request.UpdatedAt,
                },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to emit photoDiaryAccepted for request {RequestId} to professional {ProfessionalId}",
                request.Id, request.ProfessionalId);
        }

        await Send.OkAsync(new AcceptRequestResponse
        {
            Id = request.Id,
            Status = request.Status,
            Mode = request.Mode,
            AcceptedAt = request.AcceptedAt,
        }, ct);
    }

    private static bool IsOwnedByClient(
        Domain.Entities.PhotoDiaryRequest request,
        Guid clientUserId,
        string? clientEmail)
    {
        if (request.Link is not null)
            return request.Link.ClientProfile.UserId == clientUserId;

        if (request.PendingInvite is not null && clientEmail is not null)
            return string.Equals(request.PendingInvite.Email, clientEmail,
                StringComparison.OrdinalIgnoreCase);

        return false;
    }

    /// <summary>
    /// Resolves a display name for the client: link-based pulls from
    /// ClientProfile.User, invite-based pulls from PendingInvite first/last
    /// name. Falls back to the email claim if neither is populated.
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
