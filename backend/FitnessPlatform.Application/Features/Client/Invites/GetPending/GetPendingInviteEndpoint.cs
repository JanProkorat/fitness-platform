using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.GetPending;

/// <summary>
/// Returns the most recent pending invite for the authenticated client (by email match).
/// Returns null body when no invite exists.
/// </summary>
public class GetPendingInviteEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager) : EndpointWithoutRequest<PendingInviteResponse?>
{
    public override void Configure()
    {
        Get("/client/invites/pending");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get pending invite";
            s.Description = "Returns the most recent pending invitation for the authenticated client, or null if none.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid, ct);

        if (user is null) { await Send.UnauthorizedAsync(ct); return; }

        // Check if client already has an active link — if so, no pending invite matters
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is not null)
        {
            var hasActiveLink = await db.ClientProfessionalLinks
                .AnyAsync(l => l.ClientProfileId == clientProfile.Id && l.IsActive, ct);

            if (hasActiveLink)
            {
                await Send.OkAsync(null, ct);
                return;
            }
        }

        // Find pending invite by email
        var invite = await db.PendingInvites
            .AsNoTracking()
            .Include(pi => pi.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(pi => pi.Email == user.Email && !pi.IsAccepted)
            .OrderByDescending(pi => pi.SentAt)
            .FirstOrDefaultAsync(ct);

        if (invite is null)
        {
            await Send.OkAsync(null, ct);
            return;
        }

        var prof = invite.ProfessionalProfile;
        var profUser = prof.User;

        var profRoles = await userManager.GetRolesAsync(profUser);
        var role = profRoles.Contains(AppRoles.Nutritionist) ? "Nutritionist" : "Trainer";

        await Send.OkAsync(new PendingInviteResponse
        {
            Id = invite.PublicId.ToString(),
            TrainerId = prof.PublicId.ToString(),
            TrainerName = $"{profUser.FirstName} {profUser.LastName}",
            TrainerRole = role,
            TrainerCity = prof.City ?? string.Empty,
            Message = null
        }, ct);
    }
}

public class PendingInviteResponse
{
    public string Id { get; set; } = string.Empty;
    public string TrainerId { get; set; } = string.Empty;
    public string TrainerName { get; set; } = string.Empty;
    public string TrainerRole { get; set; } = string.Empty;
    public string TrainerCity { get; set; } = string.Empty;
    public string? Message { get; set; }
}
