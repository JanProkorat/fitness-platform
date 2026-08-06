using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Verifies professional ↔ client relationships and plan view permissions.
/// Cross-database: reads PostgreSQL (professional/client profiles, links) to authorize MongoDB plan access.
/// </summary>
public class ProfessionalAuthHelper(IApplicationDbContext db)
{
    /// <summary>
    /// Verifies that the professional (by ApplicationUser.Id) has an active link to the client (by ClientProfile.PublicId).
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists.</returns>
    public virtual async Task<bool> HasActiveLinkAsync(Guid professionalUserId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null) return false;

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == clientPublicId, ct);

        if (clientProfile is null) return false;

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(cpl =>
                cpl.ProfessionalProfileId == professionalProfile.Id &&
                cpl.ClientProfileId == clientProfile.Id &&
                cpl.IsActive &&
                cpl.CanViewTrainingPlans, ct);
    }

    /// <summary>
    /// Verifies that the professional has an active link to the client that grants at least
    /// one plan-view capability (training or nutrition). Intended only for the small,
    /// deliberately dual-readable set of endpoints (e.g. client progress) that both Trainers
    /// and Nutritionists may call — do not use this in place of <see cref="HasActiveLinkAsync"/>
    /// or <see cref="HasPlanAccessAsync"/> for single-role-scoped operations.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists with at least one capability flag granted.</returns>
    public virtual async Task<bool> HasAnyPlanAccessAsync(Guid professionalUserId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null) return false;

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == clientPublicId, ct);

        if (clientProfile is null) return false;

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(cpl =>
                cpl.ProfessionalProfileId == professionalProfile.Id &&
                cpl.ClientProfileId == clientProfile.Id &&
                cpl.IsActive &&
                (cpl.CanViewTrainingPlans || cpl.CanViewNutritionPlans), ct);
    }

    /// <summary>
    /// Verifies that the professional has an active link with the specific plan view permission.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="requireTrainingPlanAccess">If true, checks CanViewTrainingPlans; if false, checks CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link with the required permission exists.</returns>
    public virtual async Task<bool> HasPlanAccessAsync(Guid professionalUserId, Guid clientPublicId, bool requireTrainingPlanAccess, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null) return false;

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == clientPublicId, ct);

        if (clientProfile is null) return false;

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(cpl =>
                cpl.ProfessionalProfileId == professionalProfile.Id &&
                cpl.ClientProfileId == clientProfile.Id &&
                cpl.IsActive &&
                (requireTrainingPlanAccess ? cpl.CanViewTrainingPlans : cpl.CanViewNutritionPlans), ct);
    }
}
