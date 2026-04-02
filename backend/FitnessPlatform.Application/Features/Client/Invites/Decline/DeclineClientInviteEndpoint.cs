using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.Decline;

/// <summary>
/// Client declines a pending invite. Marks it as accepted (consumed) without creating a link.
/// </summary>
public class DeclineClientInviteEndpoint(IApplicationDbContext db) : Endpoint<DeclineClientInviteRequest>
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

        var invite = await db.PendingInvites
            .FirstOrDefaultAsync(pi => pi.PublicId == req.Id && !pi.IsAccepted, ct);

        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Mark as consumed so it no longer appears as pending
        invite.IsAccepted = true;
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

public class DeclineClientInviteRequest
{
    public Guid Id { get; set; }
}
