using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.MarkCheckInReviewed;

/// <summary>
/// Trainer marks a check-in as reviewed. A repeat call keeps the first timestamp.
/// Broadcasts <c>weeklycheckinupdated</c> to both the professional and the client.
/// </summary>
/// <remarks>
/// An expired or still unanswered check-in can be marked reviewed too: clearing a backlog for the
/// record is a normal coach flow.
/// </remarks>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Pushes the realtime event.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class MarkCheckInReviewedEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    TimeProvider timeProvider)
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
                "Sets the reviewed time on the check-in's form response, keeping the first time on a repeat call. " +
                "Broadcasts weeklycheckinupdated to both sides.";
            s.Responses[StatusCodes.Status200OK] = "Reviewed time of the check-in";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Not a check-in, or not the caller's";
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

        var response = await db.QuestionnaireResponses
            .FirstOrDefaultAsync(r => r.PublicId == req.Id
                                      && r.Kind == QuestionnaireResponseKind.CheckIn
                                      && r.ProfessionalId == professionalUserId, ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (response.ReviewedByCoachAtUtc is null)
        {
            response.ReviewedByCoachAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }

        var reviewedAt = response.ReviewedByCoachAtUtc.Value;

        // Broadcast to both sides so each open tab/screen can update immediately.
        var broadcastPayload = new
        {
            id = response.PublicId,
            reviewedAt
        };

        await notifier.NotifyAsync(professionalUserId, "weeklycheckinupdated", broadcastPayload, ct);
        await notifier.NotifyAsync(response.ClientId, "weeklycheckinupdated", broadcastPayload, ct);

        await Send.OkAsync(new MarkCheckInReviewedResponse
        {
            Id = response.PublicId,
            ReviewedAt = reviewedAt
        }, ct);
    }
}
