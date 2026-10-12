using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

/// <summary>
/// Returns a week-by-week check-in history for a linked client, scoped to the authenticated professional.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves the caller's link to the client.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class GetClientCheckInHistoryEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<GetClientCheckInHistoryRequest, GetClientCheckInHistoryResponse>
{
    private const string Answered = "answered";
    private const string Missed = "missed";
    private const string Waiting = "waiting";
    private const string None = "none";

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientUserId}/weekly-check-ins/history");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a client's weekly check-in history (trainer)";
            s.Description =
                "Returns the last N weekly slots (oldest first) ending at the newest check-in week, " +
                "each marked answered, missed, waiting or none, plus answered/total counts over all " +
                "of the caller's check-ins for the client.";
            s.Responses[StatusCodes.Status200OK] = "Check-in history";
            s.Responses[StatusCodes.Status400BadRequest] = "Weeks out of range";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "Link grants no capability";
            s.Responses[StatusCodes.Status404NotFound] = "No active link to the client";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientCheckInHistoryRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);

        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            professionalUserId, req.ClientUserId, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (capabilities.Value.GrantsNothing)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var anchor = await ResolveAnchorAsync(professionalUserId, now, ct);

        var rows = await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c => c.ClientUserId == req.ClientUserId && c.ProfessionalUserId == professionalUserId)
            .Select(c => new { c.WeekStartDate, c.RespondedAt, c.Status, c.DueAt, c.SentAt })
            .ToListAsync(ct);

        var winnerByWeek = rows
            .GroupBy(c => c.WeekStartDate)
            .ToDictionary(
                group => group.Key,
                group => group
                    .Select(c => (Status: RowStatus(c.RespondedAt, c.Status, c.DueAt, now), c.SentAt))
                    .OrderBy(c => Rank(c.Status))
                    .ThenByDescending(c => c.SentAt)
                    .First());

        var weeks = Enumerable.Range(0, req.Weeks)
            .Select(offset => anchor.AddDays(-7 * (req.Weeks - 1 - offset)))
            .Select(monday => winnerByWeek.TryGetValue(monday, out var winner)
                ? new CheckInHistoryWeekDto { WeekStartDate = monday, Status = winner.Status, SentAt = winner.SentAt }
                : new CheckInHistoryWeekDto { WeekStartDate = monday, Status = None })
            .ToList();

        var answeredCount = winnerByWeek.Values.Count(winner => winner.Status == Answered);
        var missedCount = winnerByWeek.Values.Count(winner => winner.Status == Missed);

        await Send.OkAsync(new GetClientCheckInHistoryResponse
        {
            Weeks = weeks,
            AnsweredCount = answeredCount,
            TotalCount = answeredCount + missedCount
        }, ct);
    }

    private async Task<DateOnly> ResolveAnchorAsync(Guid professionalUserId, DateTime utcNow, CancellationToken ct)
    {
        var timeZoneId = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == professionalUserId)
            .Select(u => u.TimeZone)
            .FirstOrDefaultAsync(ct);

        TimeZoneInfo timeZone;
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId ?? "UTC");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            timeZone = TimeZoneInfo.Utc;
        }

        return WeeklyCheckInScheduler.NextIsoMonday(TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone));
    }

    private static string RowStatus(DateTime? respondedAt, WeeklyCheckInStatus status, DateTime? dueAt, DateTime utcNow)
    {
        if (respondedAt is not null)
        {
            return Answered;
        }

        return status == WeeklyCheckInStatus.Pending && (dueAt is null || dueAt > utcNow) ? Waiting : Missed;
    }

    private static int Rank(string status) => status switch
    {
        Answered => 0,
        Waiting => 1,
        _ => 2
    };
}
