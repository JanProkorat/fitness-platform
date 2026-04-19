using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetSettings;

/// <summary>
/// Returns the weekly check-in reminder settings for the authenticated trainer (0–2 items).
/// </summary>
/// <param name="db">Database context.</param>
public class GetSettingsEndpoint(IApplicationDbContext db)
    : Endpoint<GetSettingsRequest, GetSettingsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/weekly-check-ins/settings");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get weekly check-in settings";
            s.Description = "Returns the trainer's weekly check-in reminder settings (0–2 entries, one per profession).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSettingsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        var settings = await db.WeeklyCheckInSettings
            .AsNoTracking()
            .Where(s => s.UserId == trainerUserId)
            .OrderBy(s => s.Profession)
            .Select(s => new CheckInSettingDto
            {
                Id = s.Id,
                Profession = s.Profession.ToString(),
                DayOfWeek = (int)s.DayOfWeek,
                TimeOfDay = s.TimeOfDay,
                Enabled = s.Enabled,
                DefaultAddendum = s.DefaultAddendum
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetSettingsResponse { Settings = settings }, ct);
    }
}
