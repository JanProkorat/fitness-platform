using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutOverride;

/// <summary>
/// Upserts a per-client weekly check-in override for the authenticated trainer.
/// The trainer must have an active link to the specified client.
/// </summary>
/// <param name="db">Database context.</param>
public class PutOverrideEndpoint(IApplicationDbContext db)
    : Endpoint<PutOverrideRequest, PutOverrideResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/weekly-check-ins/overrides/{clientUserId}/{profession}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Upsert per-client override";
            s.Description = "Creates or updates the weekly check-in override for a specific client. The trainer must have an active link to the client. Null values in the body inherit from the trainer's default setting.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PutOverrideRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);
        var profession = Enum.Parse<Profession>(req.Profession, ignoreCase: true);

        // Verify the trainer has an active link to the specified client.
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await this.SendProblemAsync(StatusCodes.Status404NotFound, ErrorCodes.TrainerProfileMissing, "Trainer profile not found.", ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == req.ClientUserId, ct);

        if (clientProfile is null)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var hasLink = await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(l =>
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.ClientProfileId == clientProfile.Id &&
                l.IsActive, ct);

        if (!hasLink)
        {
            await this.SendProblemAsync(
                StatusCodes.Status403Forbidden,
                ErrorCodes.NotLinkedToClient,
                "You do not have an active relationship with this client.",
                ct);
            return;
        }

        // Upsert the override.
        var existing = await db.WeeklyCheckInClientOverrides
            .FirstOrDefaultAsync(o =>
                o.ClientUserId == req.ClientUserId &&
                o.ProfessionalUserId == trainerUserId &&
                o.Profession == profession, ct);

        if (existing is null)
        {
            var newOverride = new WeeklyCheckInClientOverride
            {
                ClientUserId = req.ClientUserId,
                ProfessionalUserId = trainerUserId,
                Profession = profession,
                DayOfWeek = req.DayOfWeek.HasValue ? (DayOfWeek)req.DayOfWeek.Value : null,
                TimeOfDay = req.TimeOfDay,
                Enabled = req.Enabled,
                Addendum = req.Addendum,
                DateCreated = DateTime.UtcNow,
                DateModified = DateTime.UtcNow
            };

            db.WeeklyCheckInClientOverrides.Add(newOverride);
            await db.SaveChangesAsync(ct);

            await Send.CreatedAtAsync<GetOverrides.GetOverridesEndpoint>(
                null,
                new PutOverrideResponse
                {
                    Id = newOverride.Id,
                    ClientUserId = newOverride.ClientUserId,
                    Profession = newOverride.Profession.ToString(),
                    DayOfWeek = newOverride.DayOfWeek.HasValue ? (int?)newOverride.DayOfWeek.Value : null,
                    TimeOfDay = newOverride.TimeOfDay,
                    Enabled = newOverride.Enabled,
                    Addendum = newOverride.Addendum
                }, generateAbsoluteUrl: false, cancellation: ct);
        }
        else
        {
            existing.DayOfWeek = req.DayOfWeek.HasValue ? (DayOfWeek)req.DayOfWeek.Value : null;
            existing.TimeOfDay = req.TimeOfDay;
            existing.Enabled = req.Enabled;
            existing.Addendum = req.Addendum;
            existing.DateModified = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);

            await Send.OkAsync(new PutOverrideResponse
            {
                Id = existing.Id,
                ClientUserId = existing.ClientUserId,
                Profession = existing.Profession.ToString(),
                DayOfWeek = existing.DayOfWeek.HasValue ? (int?)existing.DayOfWeek.Value : null,
                TimeOfDay = existing.TimeOfDay,
                Enabled = existing.Enabled,
                Addendum = existing.Addendum
            }, ct);
        }
    }
}
