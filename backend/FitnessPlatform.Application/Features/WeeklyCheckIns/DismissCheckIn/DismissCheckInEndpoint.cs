using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.DismissCheckIn;

/// <summary>
/// Client dismisses a weekly check-in for the week.
/// No trainer notification is created. A <c>weeklycheckinupdated</c> event is broadcast
/// so the client's open tab can remove the banner immediately.
/// </summary>
public class DismissCheckInEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier)
    : Endpoint<DismissCheckInRequest, DismissCheckInResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/weekly-check-ins/{id}/dismiss");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Dismiss a weekly check-in";
            s.Description =
                "Marks the weekly check-in as dismissed by the client. " +
                "No trainer notification is created.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DismissCheckInRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientUserId = Guid.Parse(userId);

        var checkIn = await db.WeeklyCheckIns
            .FirstOrDefaultAsync(c => c.Id == req.Id, ct);

        if (checkIn is null || checkIn.ClientUserId != clientUserId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;
        checkIn.DismissedByClientAt = now;
        checkIn.DateModified = now;

        await db.SaveChangesAsync(ct);

        // Broadcast to the client (and to the professional in case they're watching).
        var broadcastPayload = new
        {
            id = checkIn.Id,
            dismissedAt = checkIn.DismissedByClientAt
        };

        await notifier.NotifyAsync(clientUserId, "weeklycheckinupdated", broadcastPayload, ct);
        await notifier.NotifyAsync(checkIn.ProfessionalUserId, "weeklycheckinupdated", broadcastPayload, ct);

        await Send.OkAsync(new DismissCheckInResponse
        {
            Id = checkIn.Id,
            DismissedAt = checkIn.DismissedByClientAt.Value
        }, ct);
    }
}
