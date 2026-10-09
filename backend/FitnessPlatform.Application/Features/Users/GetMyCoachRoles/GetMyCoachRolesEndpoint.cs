using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Users.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.GetMyCoachRoles;

/// <summary>
/// Lists the caller's active coach roles with per-role client counts.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="coachRoleStatus">Resolves which coach roles are active.</param>
internal sealed class GetMyCoachRolesEndpoint(IApplicationDbContext db, ICoachRoleStatus coachRoleStatus)
    : EndpointWithoutRequest<GetMyCoachRolesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/users/me/roles");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List my coach roles";
            s.Description = "Active coach roles with the number of active clients per role and how many of them are also served by the other role.";
            s.Responses[StatusCodes.Status200OK] = "Active coach roles with counts";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var profileId = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (long?)p.Id)
            .FirstOrDefaultAsync(ct);

        if (profileId is null)
        {
            await Send.OkAsync(new GetMyCoachRolesResponse(), ct);
            return;
        }

        var activeRoles = await coachRoleStatus.GetActiveRolesAsync(userId, ct);

        await Send.OkAsync(new GetMyCoachRolesResponse
        {
            Roles = await CoachRoleCounts.LoadAsync(db, profileId.Value, activeRoles, ct),
        }, ct);
    }
}
