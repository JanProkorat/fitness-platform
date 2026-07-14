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
/// Returns 204 No Content when no invite exists.
/// </summary>
public class GetPendingInviteEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager) : EndpointWithoutRequest<PendingInviteResponse>
{
    public override void Configure()
    {
        Get("/client/invites/pending");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get pending invite";
            s.Description = "Returns the most recent pending invitation for the authenticated client, or 204 if none.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid, ct);

        if (user is null) { await Send.UnauthorizedAsync(ct); return; }

        // Use NormalizedEmail (uppercase, set by Identity) for reliable matching.
        // PendingInvite.Email stores the original casing from the trainer, so compare
        // using UPPER() on both sides.
        var normalizedEmail = user.NormalizedEmail ?? user.Email?.ToUpper() ?? string.Empty;

        var invite = await db.PendingInvites
            .AsNoTracking()
            .Include(pi => pi.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(pi => pi.Email.ToUpper() == normalizedEmail && !pi.IsAccepted)
            .OrderByDescending(pi => pi.SentAt)
            .FirstOrDefaultAsync(ct);

        if (invite is null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        var prof = invite.ProfessionalProfile;
        var profUser = prof.User;

        // Show ALL roles the inviting professional holds, not a single tie-broken
        // one (#771) — a professional can be both Trainer and Nutritionist. DTO
        // shape stays a single string (no client-side change needed); multiple
        // roles are joined for display.
        var profRoles = await userManager.GetRolesAsync(profUser);
        var roleLabels = new List<string>();
        if (profRoles.Contains(AppRoles.Trainer)) roleLabels.Add("Trainer");
        if (profRoles.Contains(AppRoles.Nutritionist)) roleLabels.Add("Nutritionist");
        var role = roleLabels.Count > 0 ? string.Join(" & ", roleLabels) : "Trainer";

        await Send.OkAsync(new PendingInviteResponse
        {
            Id = invite.PublicId.ToString(),
            TrainerId = prof.PublicId.ToString(),
            TrainerName = $"{profUser.FirstName} {profUser.LastName}",
            TrainerRole = role,
            TrainerCity = prof.City ?? string.Empty,
            Message = invite.Message
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
