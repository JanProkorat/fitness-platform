using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;

/// <summary>
/// Returns the authenticated client's own weekly check-in history across all professionals,
/// newest week first. Total count is in the <c>X-Total-Count</c> response header.
/// </summary>
/// <param name="db">Relational database context (PostgreSQL via EF Core).</param>
public class GetMyCheckInHistoryEndpoint(IApplicationDbContext db)
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
                "Returns a paginated list of the authenticated client's weekly check-ins of every " +
                "status, ordered by WeekStartDate, SentAt, then Id (all descending). Client answers " +
                "(flags, note, hunger score) are not included. Total count is in X-Total-Count.";
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

        var query = db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c => c.ClientUserId == clientUserId);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(c => c.WeekStartDate)
            .ThenByDescending(c => c.SentAt)
            .ThenByDescending(c => c.Id)
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(c => new MyCheckInHistoryItem
            {
                Id = c.Id,
                ProfessionalUserId = c.ProfessionalUserId,
                ProfessionalName = c.ProfessionalUser.FirstName + " " + c.ProfessionalUser.LastName,
                Profession = c.Profession.ToString(),
                WeekStartDate = c.WeekStartDate,
                SentAt = c.SentAt,
                Status = c.Status.ToString(),
                RespondedAt = c.RespondedAt,
                DismissedAt = c.DismissedByClientAt,
                ExpiredAt = c.ExpiredAt,
                DueAt = c.DueAt,
                ReviewedAt = c.ReviewedByTrainerAt,
            })
            .ToListAsync(ct);

        HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        await Send.OkAsync(new GetMyCheckInHistoryResponse { Items = items }, ct);
    }
}
