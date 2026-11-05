using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

/// <summary>
/// Returns a week-by-week check-in history for a linked client, scoped to the authenticated professional
/// and the current collaboration.
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
                "of the caller's check-ins for the client in the current collaboration.";
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

        var rows = await db.QuestionnaireResponses
            .AsNoTracking()
            .CurrentCollaborationCheckIns()
            .Where(r => r.ClientId == req.ClientUserId && r.ProfessionalId == professionalUserId)
            .Select(r => new { r.CheckInWeekStart, r.DateCreated, r.Status, r.CheckInDueAtUtc })
            .ToListAsync(ct);

        var weekRows = rows
            .Select(r => (
                Week: CheckInResponses.WeekStartOf(r.CheckInWeekStart, r.DateCreated),
                Status: RowStatus(r.Status, r.CheckInDueAtUtc, now),
                SentAt: r.DateCreated))
            .ToList();

        var winnerByWeek = weekRows
            .GroupBy(r => r.Week)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(r => Rank(r.Status))
                    .ThenByDescending(r => r.SentAt)
                    .First());

        var anchor = winnerByWeek.Count > 0
            ? winnerByWeek.Keys.Max()
            : CheckInResponses.WeekStartOf(null, now);

        var weeks = Enumerable.Range(0, req.Weeks)
            .Select(offset => anchor.AddDays(-7 * (req.Weeks - 1 - offset)))
            .Select(monday => winnerByWeek.TryGetValue(monday, out var winner)
                ? new CheckInHistoryWeekDto
                {
                    WeekStartDate = monday,
                    Status = winner.Status,
                    SentAt = winner.SentAt,
                    HungerScore = null
                }
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

    private static string RowStatus(QuestionnaireResponseStatus status, DateTime? dueAt, DateTime utcNow)
    {
        if (status == QuestionnaireResponseStatus.Submitted)
        {
            return Answered;
        }

        return dueAt is null || dueAt > utcNow ? Waiting : Missed;
    }

    private static int Rank(string status) => status switch
    {
        Answered => 0,
        Waiting => 1,
        _ => 2
    };
}
