using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Verifies trainer/nutritionist ↔ client relationships for nutrition plan operations.
/// Cross-database: reads PostgreSQL (trainer/client profiles, links) to authorize MongoDB plan access.
/// </summary>
/// <remarks>
/// <see cref="HasActiveLinkAsync"/> is an <see cref="ObsoleteAttribute"/> thin delegating wrapper
/// over <see cref="ClientLinkAuthorizationService"/> (#958) — the consolidated entry point the
/// rest of the epic migrates call sites onto.
/// </remarks>
public class NutritionAuthHelper(IApplicationDbContext db)
{
    private readonly ClientLinkAuthorizationService _service = new(db);

    /// <summary>
    /// Verifies that the nutritionist (by ApplicationUser.Id) has an active link to the client (by ClientProfile.PublicId).
    /// </summary>
    /// <param name="nutritionistUserId">The nutritionist's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists.</returns>
    /// <remarks>
    /// The mirror of <see cref="ProfessionalAuthHelper.HasActiveLinkAsync"/> — this gates on
    /// <c>CanViewNutritionPlans</c>, not the training flag.
    /// </remarks>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync and read CanViewNutritionPlans off the result.")]
    public virtual async Task<bool> HasActiveLinkAsync(Guid nutritionistUserId, Guid clientPublicId, CancellationToken ct)
    {
        var capabilities = await _service.GetCapabilitiesByClientPublicIdAsync(nutritionistUserId, clientPublicId, ct);
        return capabilities?.CanViewNutritionPlans ?? false;
    }
}
