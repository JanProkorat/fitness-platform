using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.SearchProfessionals;

/// <summary>
/// Searches for professionals (trainers/nutritionists) visible in the marketplace.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class SearchProfessionalsEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : Endpoint<SearchProfessionalsRequest, SearchProfessionalsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/professionals/search");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Search professionals";
            s.Description = "Returns a paginated list of professionals visible in the marketplace.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchProfessionalsRequest req, CancellationToken ct)
    {
        // Clamp page size
        if (req.PageSize is < 1 or > 50) req.PageSize = 20;
        if (req.Page < 1) req.Page = 1;

        var query = db.ProfessionalProfiles
            .Include(p => p.User)
            .Where(p => p.ShowInSearch && p.AcceptNewClients)
            .AsQueryable();

        // Filter by city (case-insensitive contains)
        if (!string.IsNullOrWhiteSpace(req.City))
        {
            var city = req.City.Trim();
            query = query.Where(p => p.City != null && p.City.ToLower().Contains(city.ToLower()));
        }

        // Filter by specialization (JSON contains)
        if (!string.IsNullOrWhiteSpace(req.Specialization))
        {
            var spec = req.Specialization.Trim();
            query = query.Where(p => p.Specializations != null && p.Specializations.ToLower().Contains(spec.ToLower()));
        }

        // Filter by name search (case-insensitive contains on first or last name)
        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var search = req.Search.Trim().ToLower();
            query = query.Where(p =>
                p.User.FirstName.ToLower().Contains(search) ||
                p.User.LastName.ToLower().Contains(search));
        }

        // Materialize the filtered profiles (professional count is expected to be small)
        var profiles = await query
            .OrderBy(p => p.User.LastName)
            .ThenBy(p => p.User.FirstName)
            .ToListAsync(ct);

        // Resolve roles in memory (Identity tables are not easily joinable in LINQ)
        var items = new List<ProfessionalSummaryDto>();

        foreach (var profile in profiles)
        {
            var allRoles = await userManager.GetRolesAsync(profile.User);
            var professionalRoles = allRoles
                .Where(r => r is AppRoles.Trainer or AppRoles.Nutritionist)
                .ToList();

            // Filter by role if requested
            if (!string.IsNullOrWhiteSpace(req.Role) &&
                !professionalRoles.Any(r => r.Equals(req.Role.Trim(), StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            items.Add(new ProfessionalSummaryDto
            {
                PublicId = profile.PublicId,
                FirstName = profile.User.FirstName,
                LastName = profile.User.LastName,
                Bio = profile.Bio,
                Specializations = ParseJsonArray(profile.Specializations),
                City = profile.City,
                EstimatedPrice = profile.EstimatedPrice,
                CollaborationType = profile.CollaborationType,
                Languages = ParseJsonArray(profile.Languages),
                Roles = professionalRoles,
                // Fall back to the underlying user's avatar when the
                // professional-profile-specific one hasn't been set. Most
                // trainers only upload one photo (their personal profile
                // photo) — the discover page should surface it regardless.
                AvatarBlobUrl = profile.AvatarBlobUrl ?? profile.User.AvatarBlobUrl
            });
        }

        var totalCount = items.Count;
        var paged = items
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .ToList();

        await Send.OkAsync(new SearchProfessionalsResponse
        {
            Items = paged,
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
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
