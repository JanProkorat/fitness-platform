using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Extensions;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FormUp.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Retrieves a single nutrition plan with full detail (weeks, days, meals, foods).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">PostgreSQL context — resolves the client's PublicId for the response.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities — authorship identifies the
/// plan, the caller's live link to its client decides access.</param>
/// <param name="timeProvider">Clock used to find the client's local today.</param>
public class GetPlanEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<GetPlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a nutrition plan";
            s.Description = "Returns the full nutrition plan with all weeks, days, meals, and foods.";
            s.Responses[StatusCodes.Status200OK] = "Nutrition plan detail";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Plan not found, or not readable by the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var plan = await this.LoadOwnedNutritionPlanIfAllowedAsync(mongo, linkAuthorizationService, req.PlanId, nutritionistId, ct);

        if (plan is null)
        {
            return;
        }

        // plan.ClientId is the internal ApplicationUser.Id storage key (#840); the response's
        // ClientId must stay the client-facing ClientProfile.PublicId (pre-#840 contract) since
        // web/mobile feed it into /trainer/clients/{clientId}/... routes.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        var response = GetPlanResponse.FromDocument(plan, clientPublicId);

        // ── MealLog fold-in ──────────────────────────────────────────────────────
        // Query MealLogs by PlanId only. Authorship AND the caller's live nutrition link to the
        // plan's client are both validated above, so there is no IDOR risk here.
        //
        // The eaten state is derived per meal and day from the live plan meal's current items: a row
        // with no ticked items (photo-only or note-only stub) is not eaten, some ticked is partly
        // eaten, every current item ticked is eaten (even when EatenAt is null).
        var logFilter = Builders<MealLog>.Filter.Eq(l => l.PlanId, req.PlanId);
        var logCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var mealLogs = await logCursor.ToListAsync(ct);

        response.MealLogs = MealLogMerger
            .Merge(mealLogs, (_, day, mealId) => NutritionPlanDayResolver.FindMeal(plan, day, mealId))
            .Select(meal => new MealEatenStatusDto
            {
                MealId = meal.MealId,
                LogDate = DateOnly.FromDateTime(meal.DayUtc),
                IsEaten = meal.State == MealEatenState.Eaten,
                EatenState = meal.State,
                EatenItemIds = meal.EatenItemIds.ToList(),
                EatenAt = meal.EatenAt
            })
            .ToList();

        var clientTimeZone = await db.ResolveClientTimeZoneAsync(plan.ClientId, ct);
        response.ClientToday = ClientLocalDateResolver.ResolveLocalDate(timeProvider.GetUtcNow().UtcDateTime, clientTimeZone);
        response.MealLocks = PlanMealLockResolver.Resolve(plan, mealLogs, response.ClientToday)
            .Select(mealLock => new MealLockDto
            {
                MealId = mealLock.Meal.MealId,
                WeekNumber = mealLock.WeekNumber,
                DayOfWeek = mealLock.DayOfWeek,
                Date = mealLock.Date,
                IsLocked = mealLock.IsLocked,
                LockState = mealLock.State,
                EatenItemIds = mealLock.EatenItemIds.ToList(),
                EatenSnapshot = mealLock.IsLocked ? mealLock.EatenSnapshot?.ToList() : null
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }
}
