using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
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
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="timeProvider">Clock used to judge invite expiry.</param>
/// <param name="linkAuthorizationService">Resolves whether the caller has a live link to the professional.</param>
public class GetPublicProfileEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    EntitlementService entitlementService,
    TimeProvider timeProvider,
    IClientLinkAuthorizationService linkAuthorizationService)
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
        var canSeeContacts = false;

        if (clientProfile is not null)
        {
            hasPendingRequest = await db.ClientRequests.AnyAsync(
                r => r.ClientProfileId == clientProfile.Id
                     && r.ProfessionalProfileId == profile.Id
                     && r.Status == ClientRequestStatus.Pending,
                ct);

            // The same live-link check as GetCoachBankDetailsEndpoint.
            var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
                profile.UserId, callerUserId, ct);

            isLinked = capabilities is not null;

            // Contact details need a link that still covers a coach role that has not been removed.
            canSeeContacts = capabilities is { } linked
                && ((linked.CanViewTrainingPlans && !CoachRoleStatus.IsRemoved(profile, AppRoles.Trainer))
                    || (linked.CanViewNutritionPlans && !CoachRoleStatus.IsRemoved(profile, AppRoles.Nutritionist)));
        }

        // Resolve roles
        var allRoles = await userManager.GetRolesAsync(profile.User);
        var professionalRoles = CoachRoleStatus.ActiveRoles(allRoles, profile).ToList();

        var fromPrices = await CoachPackagePricing.LoadFromPricesAsync(
            db, entitlementService, [profile.Id], ct);
        FromPrice? fromPrice = fromPrices.TryGetValue(profile.Id, out var found) ? found : null;

        var packages = await CoachPackagePricing.LoadProfilePackagesAsync(db, entitlementService, profile.Id, ct);

        await Send.OkAsync(new GetPublicProfileResponse
        {
            PublicId = profile.PublicId,
            FirstName = profile.User.FirstName,
            LastName = profile.User.LastName,
            Bio = profile.Bio,
            Specializations = ParseJsonArray(profile.Specializations),
            Certificates = ParseCertificateTitles(profile.Certificates),
            CertificateDetails = ParseCertificateDetails(profile.Certificates),
            Packages = packages
                .Select(package => new PublicProfilePackageDto
                {
                    Name = package.Name,
                    Billing = package.Billing,
                    IntervalWeeks = package.IntervalWeeks,
                    RunsForPayments = package.RunsForPayments,
                    Description = package.Description,
                    Price = package.Price,
                    Currency = package.Currency
                })
                .ToList(),
            // Contact details go only to a client whose live link covers a coach role still held.
            ContactEmail = canSeeContacts ? profile.User.Email : null,
            ContactPhone = canSeeContacts ? profile.User.PhoneNumber : null,
            Languages = ParseJsonArray(profile.Languages),
            City = profile.City,
            FromMonthlyPrice = fromPrice?.Amount,
            FromMonthlyPriceCurrency = fromPrice?.Currency,
            FromPriceBilling = fromPrice?.Billing,
            FromPriceIntervalWeeks = fromPrice?.IntervalWeeks,
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

    private static List<string> ParseCertificateTitles(string? json) =>
        ParseCertificateDetails(json).Select(certificate => certificate.Title).ToList();

    /// <summary>
    /// Reads the stored certificates: a legacy string entry is a title only, an object keeps its issuer and year.
    /// </summary>
    private static List<PublicCertificateDto> ParseCertificateDetails(string? json)
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

            var certificates = new List<PublicCertificateDto>();

            foreach (var element in document.RootElement.EnumerateArray())
            {
                var title = element.ValueKind switch
                {
                    JsonValueKind.String => element.GetString(),
                    JsonValueKind.Object => ReadText(element, "title"),
                    _ => null,
                };

                if (string.IsNullOrWhiteSpace(title))
                {
                    continue;
                }

                certificates.Add(new PublicCertificateDto
                {
                    Title = title,
                    Issuer = element.ValueKind == JsonValueKind.Object ? ReadText(element, "issuer") : null,
                    Year = element.ValueKind == JsonValueKind.Object ? ReadText(element, "year") : null
                });
            }

            return certificates;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string? ReadText(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value))
        {
            return null;
        }

        var text = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };

        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }
}
