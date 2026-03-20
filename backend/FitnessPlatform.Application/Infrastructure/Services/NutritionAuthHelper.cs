using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Verifies trainer/nutritionist ↔ client relationships for nutrition plan operations.
/// Cross-database: reads PostgreSQL (trainer/client profiles, links) to authorize MongoDB plan access.
/// </summary>
public class NutritionAuthHelper(IApplicationDbContext db)
{
    /// <summary>
    /// Verifies that the nutritionist (by ApplicationUser.Id) has an active link to the client (by ClientProfile.PublicId).
    /// </summary>
    /// <param name="nutritionistUserId">The nutritionist's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists.</returns>
    public virtual async Task<bool> HasActiveLinkAsync(Guid nutritionistUserId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == nutritionistUserId, ct);

        if (professionalProfile is null) return false;

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == clientPublicId, ct);

        if (clientProfile is null) return false;

        return await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(ctl =>
                ctl.ProfessionalProfileId == professionalProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);
    }
}
