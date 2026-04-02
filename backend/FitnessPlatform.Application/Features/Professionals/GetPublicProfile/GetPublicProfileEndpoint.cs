using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.GetPublicProfile;

/// <summary>
/// Returns the public profile of a professional by their PublicId.
/// Includes whether the calling client already has a pending request or active link.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class GetPublicProfileEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : Endpoint<GetPublicProfileRequest, GetPublicProfileResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/professionals/{PublicId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get professional public profile";
            s.Description = "Returns the public profile of a professional, including relationship status with the calling client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPublicProfileRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var profile = await db.ProfessionalProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.PublicId == req.PublicId && p.ShowInSearch, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Get calling client's profile
        var callerUserId = Guid.Parse(userId);
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == callerUserId, ct);

        var hasPendingRequest = false;
        var isLinked = false;

        if (clientProfile is not null)
        {
            hasPendingRequest = await db.ClientRequests.AnyAsync(
                r => r.ClientProfileId == clientProfile.Id
                     && r.ProfessionalProfileId == profile.Id
                     && r.Status == ClientRequestStatus.Pending,
                ct);

            isLinked = await db.ClientProfessionalLinks.AnyAsync(
                l => l.ClientProfileId == clientProfile.Id
                     && l.ProfessionalProfileId == profile.Id
                     && l.IsActive,
                ct);
        }

        // Resolve roles
        var allRoles = await userManager.GetRolesAsync(profile.User);
        var professionalRoles = allRoles
            .Where(r => r is AppRoles.Trainer or AppRoles.Nutritionist)
            .ToList();

        await Send.OkAsync(new GetPublicProfileResponse
        {
            PublicId = profile.PublicId,
            FirstName = profile.User.FirstName,
            LastName = profile.User.LastName,
            Bio = profile.Bio,
            Specializations = ParseJsonArray(profile.Specializations),
            Certificates = ParseJsonArray(profile.Certificates),
            Languages = ParseJsonArray(profile.Languages),
            City = profile.City,
            EstimatedPrice = profile.EstimatedPrice,
            CollaborationType = profile.CollaborationType,
            LinkedIn = profile.LinkedIn,
            Instagram = profile.Instagram,
            Website = profile.Website,
            Roles = professionalRoles,
            HasPendingRequest = hasPendingRequest,
            IsLinked = isLinked
        }, ct);
    }

    private static List<string> ParseJsonArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
