using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCurrentClientCheckIns;

/// <summary>
/// Returns the client's active weekly check-ins — active meaning not yet responded, not
/// dismissed, not expired, and still within the response deadline (<c>DueAt</c>). This is
/// independent of calendar-week boundaries: check-ins are prospective (they cover the
/// upcoming week), so the response window spans the tail of the current week rather than
/// the week named by <c>WeekStartDate</c>. At most one active check-in per
/// <see cref="Profession"/> is returned — if more than one satisfies the active-window
/// predicate (e.g. a stalled expiry sweeper, or a deadline offset configured longer than a
/// week), the most recently sent one wins; see
/// <see cref="LoadNewestActiveCheckInAsync"/> for the tie-break.
/// </summary>
public class GetCurrentClientCheckInsEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetCurrentClientCheckInsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/weekly-check-ins/current");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get active check-ins (client)";
            s.Description =
                "Returns up to 2 active weekly check-ins (not responded, not dismissed, not " +
                "expired, and still within the response deadline) for the authenticated " +
                "client — at most one per profession, newest SentAt wins on a collision.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientUserId = Guid.Parse(userId);
        var now = DateTime.UtcNow;

        // EF Core cannot translate a GroupBy that selects a whole element out of a
        // grouping (`GroupBy(...).Select(g => g.OrderByDescending(...).First())`) — it
        // throws rather than client-evaluating since EF Core 3.0. DistinctBy has no SQL
        // translation at all. So query each profession separately, fully server-side,
        // and take the newest active check-in for that profession.
        //
        // Professions are ordered alphabetically by name — not enum ordinal — because
        // Profession is persisted as a string column and clients render the response
        // array positionally. Iterating Enum.GetValues here (rather than hardcoding the
        // two current members) means a third Profession is included automatically.
        var checkIns = new List<CheckInSummary>();

        foreach (var profession in Enum.GetValues<Profession>().OrderBy(p => p.ToString()))
        {
            var checkIn = await LoadNewestActiveCheckInAsync(clientUserId, profession, now, ct);

            if (checkIn is not null)
            {
                checkIns.Add(checkIn);
            }
        }

        await Send.OkAsync(new GetCurrentClientCheckInsResponse { CheckIns = checkIns }, ct);
    }

    /// <summary>
    /// Loads the newest active check-in for one profession, or <see langword="null"/> if
    /// none are active. Tie-break on a SentAt collision (e.g. same scheduler tick, or a
    /// backfilled batch) is newest <c>WeekStartDate</c>, then <c>Id</c> — a deterministic
    /// total order so the response is stable across repeated calls.
    /// </summary>
    private async Task<CheckInSummary?> LoadNewestActiveCheckInAsync(
        Guid clientUserId, Profession profession, DateTime now, CancellationToken ct)
    {
        return await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ClientUserId == clientUserId &&
                c.Profession == profession &&
                c.RespondedAt == null &&
                c.DismissedByClientAt == null &&
                c.Status != WeeklyCheckInStatus.Expired &&
                (c.DueAt == null || c.DueAt > now))
            .OrderByDescending(c => c.SentAt)
            .ThenByDescending(c => c.WeekStartDate)
            .ThenByDescending(c => c.Id)
            .Select(c => new CheckInSummary
            {
                Id = c.Id,
                ProfessionalUserId = c.ProfessionalUserId,
                ProfessionalName = c.ProfessionalUser.FirstName + " " + c.ProfessionalUser.LastName,
                Profession = c.Profession.ToString(),
                WeekStartDate = c.WeekStartDate,
                SentAt = c.SentAt
            })
            .FirstOrDefaultAsync(ct);
    }
}
