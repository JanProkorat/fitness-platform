using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.DeleteOverride;

/// <summary>
/// Removes the per-client weekly check-in override for the authenticated trainer,
/// reverting the client to the trainer's default setting.
/// The trainer must have an active link to the specified client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="linkAuthorizationService">Link capability resolver.</param>
public class DeleteOverrideEndpoint(IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<DeleteOverrideRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/weekly-check-ins/overrides/{clientUserId}/{profession}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete per-client override";
            s.Description = "Removes the per-client weekly check-in override, reverting the client to the trainer's default setting. The trainer must have an active link to the client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteOverrideRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        if (!Enum.TryParse<Profession>(req.Profession, ignoreCase: true, out var profession))
        {
            AddError("Profession must be 'Training' or 'Nutrition'.");
            ThrowIfAnyErrors();
        }

        // Verify active trainer-client link.
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

        // The professional and client profiles are already confirmed to exist above, so a null
        // result here can only mean "no active link" — not "no professional/client profile". No
        // capability flag is required, matching the pre-migration IsActive-only presence check —
        // the override applies regardless of which plan domains the link currently grants.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            trainerUserId, req.ClientUserId, ct);

        if (capabilities is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status403Forbidden,
                ErrorCodes.NotLinkedToClient,
                "You do not have an active relationship with this client.",
                ct);
            return;
        }

        var existing = await db.WeeklyCheckInClientOverrides
            .FirstOrDefaultAsync(o =>
                o.ClientUserId == req.ClientUserId &&
                o.ProfessionalUserId == trainerUserId &&
                o.Profession == profession, ct);

        if (existing is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        db.WeeklyCheckInClientOverrides.Remove(existing);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
