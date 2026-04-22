using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Removes the avatar from the calling professional's own profile record.
/// </summary>
/// <param name="db">Database context.</param>
public class DeleteProfessionalAvatarEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/professionals/me/avatar");
        Roles(AppRoles.TrainerOrNutritionist);
        Summary(s =>
        {
            s.Summary = "Delete professional avatar";
            s.Description = "Clears the AvatarBlobUrl on the caller's professional profile record.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
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

        profile.AvatarBlobUrl = null;
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
