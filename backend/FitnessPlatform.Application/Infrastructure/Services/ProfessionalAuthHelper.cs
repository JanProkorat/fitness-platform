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
    /// Verifies that the professional has an active link with the specific plan view permission
    /// to the client identified by their <c>ApplicationUser.Id</c> — the storage key every Mongo
    /// plan document's <c>ClientId</c> carries since #840.
    /// </summary>
    /// <remarks>
    /// This is the plan-addressed counterpart of <see cref="HasPlanAccessAsync"/>. Plan routes
    /// are addressed by plan id, not client id, so the only client identifier they hold is the
    /// document's <c>ClientId</c>; keying on it directly removes the
    /// <c>ApplicationUser.Id → ClientProfile.PublicId</c> round-trip each call site would
    /// otherwise hand-roll before it could ask the question.
    ///
    /// <para>
    /// Authorship (<c>plan.NutritionistId</c> / <c>plan.TrainerId</c>) is permanent; the link is
    /// not. Every plan-addressed route therefore confirms authorship AND calls this before it
    /// emits or mutates anything, so ending a collaboration ends access.
    /// </para>
    /// </remarks>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientUserId">The client's ApplicationUser.Id, as stored on the plan document.</param>
    /// <param name="requireTrainingPlanAccess">If true, checks CanViewTrainingPlans; if false, checks CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link with the required permission exists.</returns>
    public virtual async Task<bool> HasPlanAccessForClientUserAsync(
        Guid professionalUserId,
        Guid clientUserId,
        bool requireTrainingPlanAccess,
        CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null) return false;

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == clientUserId, ct);

        if (clientProfile is null) return false;

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(cpl =>
                cpl.ProfessionalProfileId == professionalProfile.Id &&
                cpl.ClientProfileId == clientProfile.Id &&
                cpl.IsActive &&
                (requireTrainingPlanAccess ? cpl.CanViewTrainingPlans : cpl.CanViewNutritionPlans), ct);
    }

    /// <summary>
    /// Returns the <c>ApplicationUser.Id</c> of every client the professional currently has an
    /// active link to that grants the requested domain capability. Used by the plan LIST routes,
    /// which are not addressed by a single plan and so cannot gate per document — they scope the
    /// query itself to the caller's live link set instead.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="requireTrainingPlanAccess">If true, requires CanViewTrainingPlans; if false, CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The accessible clients' ApplicationUser.Ids; empty when none.</returns>
    public virtual async Task<IReadOnlyList<Guid>> GetAccessibleClientUserIdsAsync(
        Guid professionalUserId,
        bool requireTrainingPlanAccess,
        CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == professionalUserId, ct);

        if (professionalProfile is null) return [];

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(cpl =>
                cpl.ProfessionalProfileId == professionalProfile.Id &&
                cpl.IsActive &&
                (requireTrainingPlanAccess ? cpl.CanViewTrainingPlans : cpl.CanViewNutritionPlans))
            .Join(db.ClientProfiles, cpl => cpl.ClientProfileId, cp => cp.Id, (cpl, cp) => cp.UserId)
            .ToListAsync(ct);
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
