using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.GetProfile;

/// <summary>
/// Endpoint for retrieving the authenticated user's profile.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class GetProfileEndpoint(UserManager<ApplicationUser> userManager) : EndpointWithoutRequest<GetProfileResponse>
{

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/users/me");
        Summary(s =>
        {
            s.Summary = "Get current user profile";
            s.Description = "Returns the profile of the currently authenticated user.";
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

        var user = await userManager.FindByIdAsync(userId);

        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var roles = await userManager.GetRolesAsync(user);

        await Send.OkAsync(new GetProfileResponse
        {
            UserId = user.Id,
            Email = user.Email!,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Roles = roles.ToList(),
            DateCreated = user.DateCreated
        }, ct);
    }
}
