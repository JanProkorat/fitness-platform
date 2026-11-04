using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;

/// <summary>
/// Returns the authenticated client's own check-in history across all professionals,
/// newest week first. Total count is in the <c>X-Total-Count</c> response header.
/// </summary>
/// <param name="db">Relational database context (PostgreSQL via EF Core).</param>
/// <param name="timeProvider">Clock, used to tell an expired check-in from a pending one.</param>
public class GetMyCheckInHistoryEndpoint(IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<GetMyCheckInHistoryRequest, GetMyCheckInHistoryResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/weekly-check-ins/history");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List my check-in history (client)";
            s.Description =
                "Returns a paginated list of the authenticated client's check-in forms of every " +
                "status, ordered by week, sent time, then id (all descending). Client answers " +
                "are not included. Total count is in X-Total-Count.";
            s.Responses[StatusCodes.Status200OK] = "Page of check-in history";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid page or pageSize";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetMyCheckInHistoryRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientUserId = Guid.Parse(userId);

        var query = db.QuestionnaireResponses
            .AsNoTracking()
            .AllCheckIns()
            .Where(r => r.ClientId == clientUserId);

        var totalCount = await query.CountAsync(ct);

        var rows = await query
            .OrderBy(r => r.CheckInWeekStart == null)
            .ThenByDescending(r => r.CheckInWeekStart)
            .ThenByDescending(r => r.DateCreated)
            .ThenByDescending(r => r.Id)
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(r => new
            {
                r.PublicId,
                r.ProfessionalId,
                ProfessionalName = r.Link.ProfessionalProfile.User.FirstName + " " + r.Link.ProfessionalProfile.User.LastName,
                r.Link.ProfessionalRole,
                r.CheckInWeekStart,
                r.DateCreated,
                r.Status,
                r.SubmittedAt,
                r.CheckInDueAtUtc,
                r.ReviewedByCoachAtUtc,
            })
            .ToListAsync(ct);

        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        var items = rows.Select(r =>
        {
            var status = CheckInResponses.ResolveStatus(r.Status, r.ReviewedByCoachAtUtc, r.CheckInDueAtUtc, nowUtc);

            return new MyCheckInHistoryItem
            {
                Id = r.PublicId,
                ProfessionalUserId = r.ProfessionalId,
                ProfessionalName = r.ProfessionalName,
                Profession = CheckInResponses.ProfessionOf(r.ProfessionalRole).ToString(),
                WeekStartDate = CheckInResponses.WeekStartOf(r.CheckInWeekStart, r.DateCreated),
                SentAt = r.DateCreated,
                Status = status.ToString(),
                RespondedAt = r.SubmittedAt,
                DismissedAt = null,
                ExpiredAt = status == WeeklyCheckInStatus.Expired ? r.CheckInDueAtUtc : null,
                DueAt = r.CheckInDueAtUtc,
                ReviewedAt = r.ReviewedByCoachAtUtc,
            };
        }).ToList();

        HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        await Send.OkAsync(new GetMyCheckInHistoryResponse { Items = items }, ct);
    }
}
