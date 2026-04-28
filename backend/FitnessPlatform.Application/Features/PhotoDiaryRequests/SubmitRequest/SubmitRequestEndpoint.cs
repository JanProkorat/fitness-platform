using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.SubmitRequest;

/// <summary>
/// POST /client/photo-diary-requests/{id}/submit
/// Transitions an Accepted or InProgress request to Completed, recording CompletedAt.
/// </summary>
public class SubmitRequestEndpoint(IApplicationDbContext db)
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
            .Include(r => r.PendingInvite)
            .FirstOrDefaultAsync(r => r.Id == req.Id, ct);

        // 404 if not found — do not leak existence for IDOR
        if (request is null || !IsOwnedByClient(request, clientUserId, emailClaim))
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

        await Send.OkAsync(new SubmitRequestResponse
        {
            Id = request.Id,
            Status = request.Status,
            CompletedAt = request.CompletedAt,
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
