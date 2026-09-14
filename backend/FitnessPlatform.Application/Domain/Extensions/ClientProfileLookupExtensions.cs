using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Translates a client's internal storage key (<c>ApplicationUser.Id</c>) back to the
/// client-facing <c>ClientProfile.PublicId</c> for API responses.
/// </summary>
/// <remarks>
/// #840 standardised Mongo document <c>ClientId</c> fields (NutritionPlan, TrainingPlan,
/// TrainingCompletion, DayLog, MealLog, SessionLog, SessionLock) on
/// <c>ApplicationUser.Id</c> for internal storage and read/write filters — that change is
/// correct and untouched here. But web and mobile still consume the OUTWARD-facing
/// <c>clientId</c> field on plan-read responses as a <c>ClientProfile.PublicId</c> (e.g.
/// feeding it into <c>/trainer/clients/{{clientPublicId}}/...</c> routes, which are keyed on
/// <c>ClientProfile.PublicId</c>). These extensions restore that pre-#840 VALUE at the
/// response boundary — internal storage/filters are unaffected.
/// </remarks>
public static class ClientProfileLookupExtensions
{
    /// <summary>
    /// Resolves a single client's <c>ApplicationUser.Id</c> to their
    /// <see cref="FitnessPlatform.Application.Domain.Common.PublicTimestampableEntity.PublicId"/>
    /// (the <c>ClientProfile</c> entity's public identifier). Falls back to
    /// <paramref name="clientUserId"/> itself if no matching profile is found — this should
    /// not happen for well-formed data, but a fallback beats a null/exception on read paths.
    /// </summary>
    public static async Task<Guid> ResolveClientPublicIdAsync(
        this IApplicationDbContext db,
        Guid clientUserId,
        CancellationToken ct)
    {
        var publicId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => cp.UserId == clientUserId)
            .Select(cp => (Guid?)cp.PublicId)
            .FirstOrDefaultAsync(ct);

        return publicId ?? clientUserId;
    }

    /// <summary>
    /// Batch-resolves multiple clients' <c>ApplicationUser.Id</c> values to their
    /// <see cref="FitnessPlatform.Application.Domain.Common.PublicTimestampableEntity.PublicId"/>
    /// (the <c>ClientProfile</c> entity's public identifier) in a single query — use this for
    /// list responses to avoid N+1 lookups. Keys absent from the result had no matching
    /// <c>ClientProfile</c>; callers should fall back to the UserId for those.
    /// </summary>
    public static async Task<IReadOnlyDictionary<Guid, Guid>> ResolveClientPublicIdsAsync(
        this IApplicationDbContext db,
        IEnumerable<Guid> clientUserIds,
        CancellationToken ct)
    {
        var ids = clientUserIds.Distinct().ToList();

        if (ids.Count == 0)
            return new Dictionary<Guid, Guid>();

        var pairs = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => ids.Contains(cp.UserId))
            .Select(cp => new { cp.UserId, cp.PublicId })
            .ToListAsync(ct);

        return pairs.ToDictionary(p => p.UserId, p => p.PublicId);
    }
}
