using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/accept
/// Transitions a Pending request to Accepted, records the chosen Mode and AcceptedAt timestamp.
/// </summary>
public class AcceptRequestEndpoint(IApplicationDbContext db)
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

        // Load the request with the link/invite for ownership check
        var request = await db.PhotoDiaryRequests
            .Include(r => r.Link)
                .ThenInclude(l => l!.ClientProfile)
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
}
