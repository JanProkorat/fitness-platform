using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.Decline;

/// <summary>
/// Client declines a pending invite. Marks it as accepted (consumed) without creating a link.
/// </summary>
public class DeclineClientInviteEndpoint(IApplicationDbContext db, IRealtimeNotifier notifier) : Endpoint<DeclineClientInviteRequest>
{
    public override void Configure()
    {
        Post("/client/invites/{Id}/decline");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Decline a pending invite";
            s.Description = "Declines a pending invitation. The invite is consumed but no link is created.";
        });
    }

    public override async Task HandleAsync(DeclineClientInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var caller = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        if (caller is null) { await Send.UnauthorizedAsync(ct); return; }

        // Use NormalizedEmail (uppercase, set by Identity) for reliable matching.
        // PendingInvite.Email stores the original casing from the trainer, so compare
        // using UPPER() on both sides. Folding this into the lookup itself (rather than
        // checking after) means a GUID that belongs to someone else's invite falls
        // through to the same 404 as an unknown/consumed invite — never a distinct 403
        // that would confirm the GUID exists.
        var normalizedEmail = caller.NormalizedEmail ?? caller.Email?.ToUpper() ?? string.Empty;

        var invite = await db.PendingInvites
            .Include(pi => pi.ProfessionalProfile)
            .FirstOrDefaultAsync(pi => pi.PublicId == req.Id && !pi.IsAccepted
                && pi.Email.ToUpper() == normalizedEmail, ct);

        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Mark as consumed so it no longer appears as pending
        invite.IsAccepted = true;
        await db.SaveChangesAsync(ct);

        // Notify the professional that the invite was declined
        var clientName = $"{caller.FirstName} {caller.LastName}";

        await notifier.NotifyAsync(
            invite.ProfessionalProfile.UserId,
            "invitedeclined",
            new { clientName, inviteId = invite.PublicId },
            ct);

        await Send.NoContentAsync(ct);
    }
}

public class DeclineClientInviteRequest
{
    public Guid Id { get; set; }
}
