using FastEndpoints;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Plan-addressed authorization for the professional-facing nutrition and training plan routes.
/// </summary>
/// <remarks>
/// <para>
/// A plan document records who authored it (<c>NutritionistId</c> / <c>TrainerId</c>), and that
/// field never changes. The professional's right to the client's data does change — it lives on
/// <c>ClientProfessionalLink</c>, which <c>EndCollaborationEndpoint</c> deactivates. Authorizing a
/// plan route on the author field alone therefore keeps read and write access alive after the
/// collaboration has ended. These helpers make the link the authorization basis: authorship still
/// identifies the plan, the link decides access.
/// </para>
/// <para>
/// The load methods bundle the fetch-by-<c>ExternalId</c>, the authorship check, and the
/// capability check into one call and write the plain bodiless 404 those routes already return
/// for a plan that is missing or not the caller's. Routes whose "missing plan" response is a
/// differently-shaped Problem Details body (the sharing libraries' <c>SendLibraryNotFoundAsync</c>)
/// keep their own denial and call
/// <see cref="ProfessionalAuthHelper.HasPlanAccessForClientUserAsync"/> directly, as do the
/// version-guarded mutations, whose fetch belongs to
/// <see cref="Services.PlanConcurrencyGuard"/>. Status codes are deliberately left as each route
/// already had them.
/// </para>
/// </remarks>
public static class PlanLinkAuthorizationExtensions
{
    /// <summary>
    /// Loads a nutrition plan by its external id and authorizes the caller against BOTH the
    /// plan's author field AND the caller's current nutrition capability on the link to the
    /// plan's client. Writes the route's usual bodiless 404 and returns <c>null</c> when the plan
    /// is missing, authored by someone else, or the link no longer grants nutrition access — the
    /// caller must return immediately on <c>null</c>.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="authHelper">Link capability helper.</param>
    /// <param name="planId">The plan's <c>ExternalId</c>.</param>
    /// <param name="nutritionistUserId">The caller's ApplicationUser.Id from JWT.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<NutritionPlan?> LoadOwnedNutritionPlanIfAllowedAsync(
        this IEndpoint endpoint,
        IMongoContext mongo,
        ProfessionalAuthHelper authHelper,
        Guid planId,
        Guid nutritionistUserId,
        CancellationToken ct)
    {
        using var cursor = await mongo.NutritionPlans.FindAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId), cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistUserId)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
            nutritionistUserId, plan.ClientId, requireTrainingPlanAccess: false, ct);

        if (!hasAccess)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        return plan;
    }

    /// <summary>
    /// Loads a training plan by its external id and authorizes the caller against BOTH the plan's
    /// author field AND the caller's current training capability on the link to the plan's client.
    /// Writes the route's usual bodiless 404 and returns <c>null</c> when the plan is missing,
    /// authored by someone else, or the link no longer grants training access — the caller must
    /// return immediately on <c>null</c>.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="authHelper">Link capability helper.</param>
    /// <param name="planId">The plan's <c>ExternalId</c>.</param>
    /// <param name="trainerUserId">The caller's ApplicationUser.Id from JWT.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<TrainingPlan?> LoadOwnedTrainingPlanIfAllowedAsync(
        this IEndpoint endpoint,
        IMongoContext mongo,
        ProfessionalAuthHelper authHelper,
        Guid planId,
        Guid trainerUserId,
        CancellationToken ct)
    {
        using var cursor = await mongo.TrainingPlans.FindAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId), cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerUserId)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
            trainerUserId, plan.ClientId, requireTrainingPlanAccess: true, ct);

        if (!hasAccess)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        return plan;
    }
}
