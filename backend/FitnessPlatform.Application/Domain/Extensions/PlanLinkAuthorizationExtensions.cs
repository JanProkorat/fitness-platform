using FastEndpoints;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Plan-addressed loading and authorization for the professional-facing and client-facing
/// training/nutrition plan routes.
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
/// <see cref="IClientLinkAuthorizationService.GetCapabilitiesByClientUserIdAsync"/> directly, as
/// do the version-guarded mutations, whose fetch belongs to
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
    /// <param name="linkAuthorizationService">Resolves link capabilities.</param>
    /// <param name="planId">The plan's <c>ExternalId</c>.</param>
    /// <param name="nutritionistUserId">The caller's ApplicationUser.Id from JWT.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<NutritionPlan?> LoadOwnedNutritionPlanIfAllowedAsync(
        this IEndpoint endpoint,
        IMongoContext mongo,
        IClientLinkAuthorizationService linkAuthorizationService,
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

        // plan.ClientId is ApplicationUser.Id (#840) — the UserId-addressed overload.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            nutritionistUserId, plan.ClientId, ct);

        if (capabilities is not { CanViewNutritionPlans: true })
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
    /// <param name="linkAuthorizationService">Resolves link capabilities.</param>
    /// <param name="planId">The plan's <c>ExternalId</c>.</param>
    /// <param name="trainerUserId">The caller's ApplicationUser.Id from JWT.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<TrainingPlan?> LoadOwnedTrainingPlanIfAllowedAsync(
        this IEndpoint endpoint,
        IMongoContext mongo,
        IClientLinkAuthorizationService linkAuthorizationService,
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

        // plan.ClientId is ApplicationUser.Id (#840) — the UserId-addressed overload.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            trainerUserId, plan.ClientId, ct);

        if (capabilities is not { CanViewTrainingPlans: true })
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        return plan;
    }

    /// <summary>
    /// Resolves the calling CLIENT's own Active training plan whose date window contains the
    /// resolved as-of date — the repeated Postgres-link → Mongo-plan → <see cref="PlanWindowResolver"/>
    /// sequence duplicated across <c>GetTodaySession</c>'s Mark*/photo siblings (#938). Unlike the
    /// professional-facing <c>LoadOwned...IfAllowedAsync</c> helpers above, there is no link/capability
    /// check here — the caller is resolving their OWN data by <c>ApplicationUser.Id</c>, not a
    /// professional's access to someone else's.
    /// </summary>
    /// <remarks>
    /// Writes the route's usual bodiless 404 and returns <c>null</c> only when NO
    /// <see cref="Entities.ClientProfile"/> exists for <paramref name="callerUserId"/> — the caller
    /// must return immediately in that case. A missing/expired ACTIVE PLAN is a distinct, endpoint-
    /// specific outcome (some routes reply with a bare 404, some with a coded
    /// <c>NoActiveTrainingPlan</c> Problem Details, one folds it into a <c>HasSession=false</c> body)
    /// so it is surfaced as <c>Plan: null</c> in the returned tuple instead of being written here.
    /// </remarks>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="db">Relational database context.</param>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="callerUserId">The caller's <c>ApplicationUser.Id</c> from JWT.</param>
    /// <param name="explicitAsOfDate">
    /// An explicit as-of date supplied by the request (e.g. <c>Mark*</c> endpoints' optional
    /// backdating field), taking precedence over <paramref name="nowUtc"/> when present. Passing
    /// this through explicitly — rather than the helper always resolving "today" — is what keeps
    /// backdated marking working; hard-coding "now" here would silently break it.
    /// </param>
    /// <param name="nowUtc">
    /// The current instant (from the caller's injected <see cref="TimeProvider"/>), used to resolve
    /// the client's local calendar day when <paramref name="explicitAsOfDate"/> is <c>null</c>.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<(Guid ClientId, DateTime AsOfDate, TrainingPlan? Plan)?> LoadActiveTrainingPlanForClientAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        IMongoContext mongo,
        Guid callerUserId,
        DateTime? explicitAsOfDate,
        DateTime nowUtc,
        CancellationToken ct)
    {
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == callerUserId, ct);

        if (clientProfile is null)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        var asOfDate = explicitAsOfDate ?? await db.ResolveClientLocalDateUtcAsync(clientId, nowUtc, ct);

        // A client may hold several sequential, non-overlapping Active plans (#780) — resolve the
        // one whose date window actually contains asOfDate rather than the most recently created.
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                          & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, asOfDate);

        return (clientId, asOfDate, plan);
    }
}
