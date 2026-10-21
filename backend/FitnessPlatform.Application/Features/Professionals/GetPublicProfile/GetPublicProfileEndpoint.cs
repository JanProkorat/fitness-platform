using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
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
/// <param name="timeProvider">Clock used to judge invite expiry.</param>
public class GetPublicProfileEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    TimeProvider timeProvider)
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
            s.Description = "Returns the public profile of a professional, including relationship status with the calling client. A profile hidden from search is returned only to a client holding a pending, unexpired invite from that professional.";
            s.Responses[StatusCodes.Status404NotFound] = "Profile not found, or hidden and the caller has no live invite from it";
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

        var callerUserId = Guid.Parse(userId);

        var profile = await db.ProfessionalProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.PublicId == req.PublicId, ct);

        // A hidden profile is reachable only through a live invite from that coach addressed to
        // the caller. Every other case reads as "not found" so a hidden profile does not leak.
        if (profile is null || (!profile.ShowInSearch && !await HasLiveInviteAsync(profile.Id, callerUserId, ct)))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Get calling client's profile
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
        var professionalRoles = CoachRoleStatus.ActiveRoles(allRoles, profile).ToList();

        await Send.OkAsync(new GetPublicProfileResponse
        {
            PublicId = profile.PublicId,
            FirstName = profile.User.FirstName,
            LastName = profile.User.LastName,
            Bio = profile.Bio,
            Specializations = ParseJsonArray(profile.Specializations),
            Certificates = ParseCertificateTitles(profile.Certificates),
            Languages = ParseJsonArray(profile.Languages),
            City = profile.City,
            EstimatedPrice = profile.EstimatedPrice,
            CollaborationType = profile.CollaborationType,
            LinkedIn = profile.LinkedIn,
            Instagram = profile.Instagram,
            Website = profile.Website,
            Roles = professionalRoles,
            HasPendingRequest = hasPendingRequest,
            IsLinked = isLinked,
            Online = profile.Online,
            AcceptNewClients = profile.AcceptNewClients,
            // Mirror the discover-list fallback (SearchProfessionalsEndpoint):
            // use the professional-profile avatar when set, otherwise the
            // underlying user's personal avatar so most trainers' single
            // uploaded photo shows up across all public surfaces.
            AvatarBlobUrl = profile.AvatarBlobUrl ?? profile.User.AvatarBlobUrl
        }, ct);
    }

    private async Task<bool> HasLiveInviteAsync(long professionalProfileId, Guid callerUserId, CancellationToken ct)
    {
        var normalizedEmail = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == callerUserId)
            .Select(u => u.NormalizedEmail ?? (u.Email != null ? u.Email.ToUpper() : null))
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrEmpty(normalizedEmail))
        {
            return false;
        }

        var validSince = PendingInviteStatusResolver.ValidSince(timeProvider.GetUtcNow().UtcDateTime);

        return await db.PendingInvites
            .AsNoTracking()
            .AnyAsync(pi => pi.ProfessionalProfileId == professionalProfileId
                            && pi.Email.ToUpper() == normalizedEmail
                            && pi.Status == PendingInviteStatus.Pending
                            && pi.SentAt >= validSince, ct);
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

    private static List<string> ParseCertificateTitles(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(json);

            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var titles = new List<string>();

            foreach (var element in document.RootElement.EnumerateArray())
            {
                var title = element.ValueKind switch
                {
                    JsonValueKind.String => element.GetString(),
                    JsonValueKind.Object when element.TryGetProperty("title", out var value)
                        && value.ValueKind == JsonValueKind.String => value.GetString(),
                    _ => null,
                };

                if (!string.IsNullOrWhiteSpace(title))
                {
                    titles.Add(title);
                }
            }

            return titles;
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
