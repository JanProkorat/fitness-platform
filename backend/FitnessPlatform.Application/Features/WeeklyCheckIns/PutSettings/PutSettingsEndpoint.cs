using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutSettings;

/// <summary>
/// Upserts the weekly check-in setting for a given profession of the authenticated trainer.
/// The trainer must hold the role that corresponds to the requested profession:
/// Trainer role → Training, Nutritionist role → Nutrition.
/// </summary>
/// <param name="db">Database context.</param>
public class PutSettingsEndpoint(IApplicationDbContext db)
    : Endpoint<PutSettingsRequest, PutSettingsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/weekly-check-ins/settings");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Upsert weekly check-in setting";
            s.Description = "Creates or updates the weekly check-in reminder setting for the authenticated trainer's specified profession. The profession must correspond to the trainer's role (Trainer → Training, Nutritionist → Nutrition).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PutSettingsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);
        var profession = Enum.Parse<Profession>(req.Profession, ignoreCase: true);

        // Validate that the caller's role covers the requested profession.
        // Trainer role → may configure Training; Nutritionist role → may configure Nutrition.
        if (!IsRoleAllowedForProfession(User, profession))
        {
            this.ThrowErrorWithCode(ErrorCodes.ProfessionNotSpecialized,
                $"Profession '{req.Profession}' does not match your role.");
        }

        // Ensure a professional profile exists.
        var profileExists = await db.ProfessionalProfiles
            .AsNoTracking()
            .AnyAsync(p => p.UserId == trainerUserId, ct);

        if (!profileExists)
        {
            this.ThrowErrorWithCode(ErrorCodes.TrainerProfileMissing, "Trainer profile not found.");
            return;
        }

        // Upsert the setting.
        var existing = await db.WeeklyCheckInSettings
            .FirstOrDefaultAsync(s => s.UserId == trainerUserId && s.Profession == profession, ct);

        if (existing is null)
        {
            var setting = new WeeklyCheckInSetting
            {
                UserId = trainerUserId,
                Profession = profession,
                DayOfWeek = (DayOfWeek)req.DayOfWeek,
                TimeOfDay = req.TimeOfDay,
                Enabled = req.Enabled,
                DefaultAddendum = req.DefaultAddendum,
                DateCreated = DateTime.UtcNow,
                DateModified = DateTime.UtcNow
            };

            db.WeeklyCheckInSettings.Add(setting);
            await db.SaveChangesAsync(ct);

            await Send.CreatedAtAsync<GetSettings.GetSettingsEndpoint>(
                null,
                new PutSettingsResponse
                {
                    Id = setting.Id,
                    Profession = setting.Profession.ToString(),
                    DayOfWeek = (int)setting.DayOfWeek,
                    TimeOfDay = setting.TimeOfDay,
                    Enabled = setting.Enabled,
                    DefaultAddendum = setting.DefaultAddendum
                }, generateAbsoluteUrl: false, cancellation: ct);
        }
        else
        {
            existing.DayOfWeek = (DayOfWeek)req.DayOfWeek;
            existing.TimeOfDay = req.TimeOfDay;
            existing.Enabled = req.Enabled;
            existing.DefaultAddendum = req.DefaultAddendum;
            existing.DateModified = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);

            await Send.OkAsync(new PutSettingsResponse
            {
                Id = existing.Id,
                Profession = existing.Profession.ToString(),
                DayOfWeek = (int)existing.DayOfWeek,
                TimeOfDay = existing.TimeOfDay,
                Enabled = existing.Enabled,
                DefaultAddendum = existing.DefaultAddendum
            }, ct);
        }
    }

    /// <summary>
    /// Returns true when the caller's role is compatible with the requested profession.
    /// A user registered as Trainer can set Training; Nutritionist can set Nutrition.
    /// A user with both roles (if that ever occurs) can set both.
    /// </summary>
    private static bool IsRoleAllowedForProfession(ClaimsPrincipal user, Profession profession)
    {
        return profession switch
        {
            Profession.Training => user.IsInRole(AppRoles.Trainer),
            Profession.Nutrition => user.IsInRole(AppRoles.Nutritionist),
            _ => false
        };
    }
}
