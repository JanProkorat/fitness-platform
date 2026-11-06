using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;

/// <summary>
/// Tells the invite drawer, while the coach types, whether the invitee already has another
/// professional in a profession the caller holds. Never reveals anything about a coach-account
/// invitee, an unknown email or a profession the caller does not hold: all of those answer false.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">Identity user manager.</param>
public class CheckPendingInviteSlotEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager) : Endpoint<CheckPendingInviteSlotRequest, CheckPendingInviteSlotResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/pending-invites/slot-check");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Options(x => x.RequireRateLimiting(AppPolicies.PendingInviteSlotCheckRateLimit));
        Summary(s =>
        {
            s.Summary = "Check whether an invitee's profession slot is taken";
            s.Description = "For the caller's active professions, reports whether another professional already occupies the invitee's slot. Unknown emails, free slots, invitees without a client profile and coach accounts all answer false.";
            s.Response<CheckPendingInviteSlotResponse>(StatusCodes.Status200OK, "Per-profession slot occupancy");
            s.Responses[StatusCodes.Status400BadRequest] = "Missing, malformed or too long email";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status429TooManyRequests] = "Too many slot checks";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CheckPendingInviteSlotRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        var heldCoachRoles = new[] { AppRoles.Trainer, AppRoles.Nutritionist }.Where(User.IsInRole).ToList();

        if (professionalProfile is null
            || !CoachRoleStatus.TryResolveLinkGrant(
                null, heldCoachRoles, professionalProfile,
                out var holdsNutrition, out var holdsTraining))
        {
            await Send.OkAsync(new CheckPendingInviteSlotResponse(), ct);
            return;
        }

        var slots = await InviteeProfessionSlotCheck.CheckAsync(
            db, userManager, req.Email, professionalProfile.Id, holdsNutrition, holdsTraining, ct);

        await Send.OkAsync(new CheckPendingInviteSlotResponse
        {
            NutritionTaken = slots.NutritionTaken,
            TrainingTaken = slots.TrainingTaken,
        }, ct);
    }
}
