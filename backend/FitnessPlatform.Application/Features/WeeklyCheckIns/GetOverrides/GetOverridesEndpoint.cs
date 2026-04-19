using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetOverrides;

/// <summary>
/// Returns all per-client weekly check-in overrides set by the authenticated trainer.
/// </summary>
/// <param name="db">Database context.</param>
public class GetOverridesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetOverridesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/weekly-check-ins/overrides");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get per-client overrides";
            s.Description = "Returns all per-client weekly check-in overrides set by the authenticated trainer.";
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

        var trainerUserId = Guid.Parse(userId);

        var overrides = await db.WeeklyCheckInClientOverrides
            .AsNoTracking()
            .Where(o => o.ProfessionalUserId == trainerUserId)
            .Include(o => o.ClientUser)
            .OrderBy(o => o.ClientUser.LastName)
            .ThenBy(o => o.ClientUser.FirstName)
            .ThenBy(o => o.Profession)
            .Select(o => new CheckInOverrideDto
            {
                Id = o.Id,
                ClientUserId = o.ClientUserId,
                ClientFirstName = o.ClientUser.FirstName,
                ClientLastName = o.ClientUser.LastName,
                Profession = o.Profession.ToString(),
                DayOfWeek = o.DayOfWeek.HasValue ? (int?)o.DayOfWeek.Value : null,
                TimeOfDay = o.TimeOfDay,
                Enabled = o.Enabled,
                Addendum = o.Addendum
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetOverridesResponse { Overrides = overrides }, ct);
    }
}
