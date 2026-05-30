using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.MarkCheckInReviewed;

/// <summary>
/// Trainer marks a check-in as reviewed.
/// Broadcasts <c>weeklycheckinupdated</c> to both the professional and the client
/// so the client's read-only view can become locked immediately.
/// </summary>
/// <remarks>
/// <para>
/// Design decision (#357): this endpoint INTENTIONALLY does NOT guard against
/// <see cref="WeeklyCheckInStatus.Expired"/> — a trainer can still mark an
/// expired check-in as Reviewed. This is asymmetric with
/// <c>RespondToCheckInEndpoint</c> and <c>DismissCheckInEndpoint</c>, which both
/// return <c>409 CHECK_IN_EXPIRED</c> on terminal rows.
/// </para>
/// <para>
/// Rationale:
/// <list type="bullet">
///   <item>Different actor. Respond/Dismiss are client-side actions on a live
///         check-in; the client engaging with an already-expired prompt is a
///         workflow error worth rejecting. Review is a coach-side action that
///         operates on stale data routinely — "clean up the backlog and mark
///         these as reviewed-for-the-record" is a normal flow.</item>
///   <item>Audit preservation. The transition sets
///         <c>Status = Reviewed</c> but does NOT clear <c>ExpiredAt</c>.
///         The historical timeline ("expired at T1, then reviewed by trainer at T2")
///         is fully preserved on the row.</item>
///   <item>Matches #331 AC5 ("Expired records are retained for history and are
///         never silently deleted") — preserving means the trainer can still
///         action them, not that the row becomes read-only forever.</item>
/// </list>
/// </para>
/// </remarks>
public class MarkCheckInReviewedEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier)
    : Endpoint<MarkCheckInReviewedRequest, MarkCheckInReviewedResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/weekly-check-ins/{id}/mark-reviewed");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Mark a check-in as reviewed (trainer)";
            s.Description =
                "Sets ReviewedByTrainerAt on the check-in. " +
                "After this the client can no longer edit their response. " +
                "Broadcasts weeklycheckinupdated to both sides.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkCheckInReviewedRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);

        var checkIn = await db.WeeklyCheckIns
            .FirstOrDefaultAsync(c => c.Id == req.Id, ct);

        if (checkIn is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (checkIn.ProfessionalUserId != professionalUserId)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;
        checkIn.ReviewedByTrainerAt = now;
        checkIn.Status = WeeklyCheckInStatus.Reviewed;
        checkIn.DateModified = now;

        await db.SaveChangesAsync(ct);

        // Broadcast to both sides so each open tab/screen can update immediately.
        var broadcastPayload = new
        {
            id = checkIn.Id,
            reviewedAt = checkIn.ReviewedByTrainerAt
        };

        await notifier.NotifyAsync(professionalUserId, "weeklycheckinupdated", broadcastPayload, ct);
        await notifier.NotifyAsync(checkIn.ClientUserId, "weeklycheckinupdated", broadcastPayload, ct);

        await Send.OkAsync(new MarkCheckInReviewedResponse
        {
            Id = checkIn.Id,
            ReviewedAt = checkIn.ReviewedByTrainerAt.Value
        }, ct);
    }
}
