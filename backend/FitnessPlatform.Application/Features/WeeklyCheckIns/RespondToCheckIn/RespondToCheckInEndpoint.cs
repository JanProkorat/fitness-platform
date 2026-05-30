using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.RespondToCheckIn;

/// <summary>
/// Client submits (or re-submits) a response to a weekly check-in reminder.
/// Blocked when the trainer has already marked the check-in reviewed.
/// </summary>
public class RespondToCheckInEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier)
    : Endpoint<RespondToCheckInRequest, RespondToCheckInResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/weekly-check-ins/{id}/respond");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Respond to a weekly check-in";
            s.Description =
                "Persists the client's flags and note for a weekly check-in. " +
                "Returns 409 if the trainer already marked this check-in reviewed.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RespondToCheckInRequest req, CancellationToken ct)
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

        if (checkIn.Status == WeeklyCheckInStatus.Expired)
        {
            await this.SendProblemAsync(
                statusCode: 409,
                errorCode: ErrorCodes.CheckInExpired,
                detail: "This check-in has expired and can no longer be responded to.",
                ct);
            return;
        }

        if (checkIn.ReviewedByTrainerAt.HasValue)
        {
            await this.SendProblemAsync(
                statusCode: 409,
                errorCode: ErrorCodes.CheckInAlreadyReviewed,
                detail: "This check-in has already been reviewed by your trainer and can no longer be edited.",
                ct);
            return;
        }

        var now = DateTime.UtcNow;
        checkIn.Flags = req.Flags;
        checkIn.Note = req.Note;
        checkIn.RespondedAt = now;
        checkIn.Status = WeeklyCheckInStatus.Responded;
        checkIn.DateModified = now;

        // Create in-app notification for the professional (no push — in-app only).
        var notificationData = JsonSerializer.Serialize(new
        {
            weeklyCheckInId = checkIn.Id,
            profession = checkIn.Profession.ToString(),
            clientUserId
        });

        var notification = new Notification
        {
            RecipientUserId = checkIn.ProfessionalUserId,
            Type = NotificationType.WeeklyCheckInResponded,
            Title = "Client responded to check-in",
            Body = "A client has responded to their weekly check-in reminder.",
            Data = notificationData
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        // Broadcast to both the client and the professional so both open tabs refresh.
        var broadcastPayload = new
        {
            id = checkIn.Id,
            respondedAt = checkIn.RespondedAt
        };

        await notifier.NotifyAsync(clientUserId, "weeklycheckinupdated", broadcastPayload, ct);
        await notifier.NotifyAsync(checkIn.ProfessionalUserId, "weeklycheckinupdated", broadcastPayload, ct);

        // Notify the professional's notification bell in real time.
        await notifier.NotifyAsync(
            checkIn.ProfessionalUserId,
            "newnotification",
            new
            {
                id = notification.Id,
                type = NotificationType.WeeklyCheckInResponded.ToString(),
                data = notificationData
            },
            ct);

        await Send.OkAsync(new RespondToCheckInResponse
        {
            Id = checkIn.Id,
            Flags = checkIn.Flags,
            Note = checkIn.Note,
            RespondedAt = checkIn.RespondedAt.Value
        }, ct);
    }
}
