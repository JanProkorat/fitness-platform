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

        // Conflicts are read only after the ownership gate above, and by plan AND client, never by meal id alone.
        var conflictFilter = Builders<OfflineSyncConflict>.Filter.Eq(c => c.PlanId, plan.ExternalId)
                             & Builders<OfflineSyncConflict>.Filter.Eq(c => c.ClientId, plan.ClientId);
        var conflictCursor = await mongo.OfflineSyncConflicts.FindAsync(conflictFilter, cancellationToken: ct);
        var conflictByMeal = (await conflictCursor.ToListAsync(ct))
            .GroupBy(conflict => conflict.MealId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(conflict => conflict.ReviewedAt.HasValue)
                    .ThenByDescending(conflict => conflict.DateCreated)
                    .First());

        response.MealLocks = PlanMealLockResolver.ResolveIncludingRemoved(plan, mealLogs, response.ClientToday)
            .Select(mealLock => new MealLockDto
            {
                MealId = mealLock.Meal.MealId,
                WeekNumber = mealLock.WeekNumber,
                DayOfWeek = mealLock.DayOfWeek,
                Date = mealLock.Date,
                IsLocked = mealLock.IsLocked,
                LockState = mealLock.State,
                EatenItemIds = mealLock.EatenItemIds.ToList(),
                EatenSnapshot = mealLock.IsLocked ? mealLock.EatenSnapshot?.ToList() : null,
                IsRemovedFromPlan = mealLock.IsRemovedFromPlan,
                MealKind = mealLock.Meal.Kind,
                Conflict = mealLock.IsLocked && conflictByMeal.TryGetValue(mealLock.Meal.MealId, out var conflict)
                    ? ToConflictDto(conflict, plan.Version, mealLock.IsRemovedFromPlan ? null : mealLock.Meal)
                    : null
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }

    private static MealLockConflictDto ToConflictDto(OfflineSyncConflict conflict, int currentPlanVersion, PlanMeal? coachMeal) => new()
    {
        ConflictId = conflict.ExternalId,
        Kind = conflict.Kind,
        BasedOnPlanVersion = conflict.BasedOnPlanVersion,
        CurrentPlanVersion = currentPlanVersion,
        Reviewed = conflict.ReviewedAt.HasValue,
        ItemTags = BuildItemTags(coachMeal, conflict.SeenItems)
    };

    /// <summary>
    /// Tags each item that differs between what the client saw and the coach's current meal. A null
    /// meal (removed from the plan) tags every seen item as removed.
    /// </summary>
    private static List<MealItemConflictTagDto> BuildItemTags(PlanMeal? coachMeal, IReadOnlyCollection<SeenMealItem> seenItems)
    {
        if (seenItems.Count == 0)
        {
            return [];
        }

        var coachItems = coachMeal is null
            ? new Dictionary<Guid, EatenMealItem>()
            : MealItemEatenState.BuildSnapshot(coachMeal).ToDictionary(item => item.ItemId);
        var seenIds = seenItems.Select(item => item.ItemId).ToHashSet();
        var tags = new List<MealItemConflictTagDto>();

        foreach (var seen in seenItems)
        {
            if (!coachItems.TryGetValue(seen.ItemId, out var coachItem))
            {
                tags.Add(new MealItemConflictTagDto { ItemId = seen.ItemId, Tag = MealItemConflictTag.Removed });
            }
            else if (DiffersFromCoachItem(seen, coachItem))
            {
                tags.Add(new MealItemConflictTagDto { ItemId = seen.ItemId, Tag = MealItemConflictTag.Changed });
            }
        }

        tags.AddRange(coachItems.Keys
            .Where(itemId => !seenIds.Contains(itemId))
            .Select(itemId => new MealItemConflictTagDto { ItemId = itemId, Tag = MealItemConflictTag.Added }));

        return tags;
    }

    /// <summary>
    /// Whether the seen item is a different food, amount or nutrient set. Nutrients tolerate rounding
    /// differences between the client's display values and the stored ones.
    /// </summary>
    private static bool DiffersFromCoachItem(SeenMealItem seen, EatenMealItem coach)
    {
        const decimal tolerance = 0.5m;

        return seen.RefId != coach.RefId
               || seen.Amount != coach.Amount
               || Math.Abs(seen.Kcal - coach.Kcal) > tolerance
               || Math.Abs(seen.Protein - coach.Protein) > tolerance
               || Math.Abs(seen.Carbs - coach.Carbs) > tolerance
               || Math.Abs(seen.Fat - coach.Fat) > tolerance
               || Math.Abs(seen.Fibre - coach.Fibre) > tolerance;
    }
}
