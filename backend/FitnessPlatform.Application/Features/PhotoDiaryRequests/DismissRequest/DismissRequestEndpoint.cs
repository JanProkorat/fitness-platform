using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.DismissRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/dismiss
/// Transitions a Pending request to Dismissed, optionally recording a reason.
/// Mutually exclusive with accept: once accepted the request is no longer Pending.
/// </summary>
public class DismissRequestEndpoint(IApplicationDbContext db)
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
            .Include(r => r.PendingInvite)
            .FirstOrDefaultAsync(r => r.Id == req.Id, ct);

        // 404 if not found — do not leak existence for IDOR
        if (request is null || !IsOwnedByClient(request, clientUserId, emailClaim))
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

        await Send.OkAsync(new DismissRequestResponse
        {
            Id = request.Id,
            Status = request.Status,
            DismissReason = request.DismissReason,
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
