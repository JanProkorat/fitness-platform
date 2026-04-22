using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Persists the avatar blob URL on the calling professional's own profile record.
/// Ownership is guaranteed by scoping the route to <c>/professionals/me/...</c> — the caller
/// can only ever set their own professional avatar.
/// </summary>
/// <param name="db">Database context.</param>
public class ConfirmProfessionalAvatarEndpoint(IApplicationDbContext db)
    : Endpoint<ConfirmProfessionalAvatarRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/professionals/me/avatar");
        Roles(AppRoles.TrainerOrNutritionist);
        Summary(s =>
        {
            s.Summary = "Confirm professional avatar upload";
            s.Description = "Sets the AvatarBlobUrl on the caller's professional profile after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /professionals/me/avatar/upload-url.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ConfirmProfessionalAvatarRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var profile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(p => p.UserId == callerUserId, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        profile.AvatarBlobUrl = req.BlobUrl;
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
