using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Single entry point for "what may this professional see about this client" — the entry point
/// the rest of the link-authorization epic migrates onto. Consolidates the seven near-synonymous
/// checks that used to live on <c>ProfessionalAuthHelper</c> and <c>NutritionAuthHelper</c>, which
/// stay wired up as <c>[Obsolete]</c> thin delegating wrappers over this service.
/// Cross-database: reads PostgreSQL (professional/client profiles, links) to authorize MongoDB
/// plan access.
/// </summary>
public class ClientLinkAuthorizationService(IApplicationDbContext db) : IClientLinkAuthorizationService
{
    /// <inheritdoc />
    public async Task<LinkCapabilities?> GetCapabilitiesByClientPublicIdAsync(
        Guid professionalUserId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null)
        {
            return null;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == clientPublicId, ct);

        if (clientProfile is null)
        {
            return null;
        }

        return await LoadCapabilitiesAsync(professionalProfile.Id, clientProfile.Id, ct);
    }

    /// <inheritdoc />
    public async Task<LinkCapabilities?> GetCapabilitiesByClientUserIdAsync(
        Guid professionalUserId, Guid clientUserId, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null)
        {
            return null;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == clientUserId, ct);

        if (clientProfile is null)
        {
            return null;
        }

        return await LoadCapabilitiesAsync(professionalProfile.Id, clientProfile.Id, ct);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<(Guid ClientUserId, LinkCapabilities Capabilities)>> GetAccessibleClientsAsync(
        Guid professionalUserId, CancellationToken ct, bool? requireTrainingPlanAccess = null)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null)
        {
            return [];
        }

        var activeLinks = db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(cpl => cpl.ProfessionalProfileId == professionalProfile.Id && cpl.IsActive);

        // No filter means "every active link, including one that grants neither domain" — see
        // LinkCapabilities.GrantsNothing. Pushing a domain requirement down here (rather than
        // filtering the unfiltered result afterward) is what keeps the plan LIST routes' query a
        // single indexed lookup instead of an over-fetch.
        var filteredLinks = requireTrainingPlanAccess switch
        {
            true => activeLinks.Where(cpl => cpl.CanViewTrainingPlans),
            false => activeLinks.Where(cpl => cpl.CanViewNutritionPlans),
            null => activeLinks
        };

        var rows = await filteredLinks
            .Join(
                db.ClientProfiles,
                cpl => cpl.ClientProfileId,
                cp => cp.Id,
                (cpl, cp) => new { cp.UserId, cpl.CanViewNutritionPlans, cpl.CanViewTrainingPlans })
            .ToListAsync(ct);

        return rows
            .Select(row => (row.UserId, new LinkCapabilities(row.CanViewNutritionPlans, row.CanViewTrainingPlans)))
            .ToList();
    }

    /// <summary>
    /// Loads the capability flags for the active link between the given profile pair, keeping
    /// "no active link" (<see langword="null"/>) distinct from "an active link that grants
    /// neither domain" (a non-null <see cref="LinkCapabilities"/> whose
    /// <see cref="LinkCapabilities.GrantsNothing"/> is <see langword="true"/>).
    /// </summary>
    /// <remarks>
    /// Projected to an anonymous (reference) type deliberately: <see cref="LinkCapabilities"/> is a
    /// struct, so projecting straight to it would make a link carrying neither flag
    /// indistinguishable from no link at all — both would come back as <see langword="default"/>.
    /// </remarks>
    private async Task<LinkCapabilities?> LoadCapabilitiesAsync(
        long professionalProfileId, long clientProfileId, CancellationToken ct)
    {
        var flags = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(cpl =>
                cpl.ProfessionalProfileId == professionalProfileId &&
                cpl.ClientProfileId == clientProfileId &&
                cpl.IsActive)
            .Select(cpl => new { cpl.CanViewNutritionPlans, cpl.CanViewTrainingPlans })
            .FirstOrDefaultAsync(ct);

        return flags is null
            ? null
            : new LinkCapabilities(flags.CanViewNutritionPlans, flags.CanViewTrainingPlans);
    }
}
