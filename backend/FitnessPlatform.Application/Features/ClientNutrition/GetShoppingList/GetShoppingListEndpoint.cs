using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;

/// <summary>
/// Generates an aggregated shopping list from the client's active nutrition plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class GetShoppingListEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<GetShoppingListRequest, GetShoppingListResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/shopping-list");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get shopping list from active plan";
            s.Description = "Aggregates all food items from the client's active nutrition plan into a shopping list, optionally filtered by week range.";
            s.Responses[404] = "No active nutrition plan found";
            s.Description += " Each item carries its food category and tick state (ticked in every requested week it appears in).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetShoppingListRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Find the client's Active nutrition plan whose date window contains today — a client
        // may hold several sequential, non-overlapping Active plans (#780), so an arbitrary
        // FirstOrDefault would be wrong once more than one exists.
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId)
                   & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var activePlans = await cursor.ToListAsync(ct);
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);
        // Falls back to the earliest upcoming plan with a published week (browse before it starts).
        var plan = PlanWindowResolver.ResolveCurrentOrUpcomingPlan(
            activePlans,
            p => p.StartDate,
            p => p.Weeks.Count,
            p => p.Weeks.Any(w => w.Status == WeekStatus.Published),
            p => p.DateCreated,
            todayLocalUtc);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Filter weeks by range (WeekFrom defaults to 1, WeekTo defaults to all weeks)
        var weekTo = req.WeekTo ?? plan.Weeks.Count;

        var weeks = plan.Weeks
            .Where(w => w.WeekNumber >= req.WeekFrom && w.WeekNumber <= weekTo)
            .ToList();

        // Flatten all meals -> all foods (tagged with their week), group by FoodExternalId, sum amounts
        var groups = weeks
            .SelectMany(w => w.Days.SelectMany(d => d.Meals).SelectMany(m => m.Foods).Select(f => (w.WeekNumber, Food: f)))
            .GroupBy(entry => entry.Food.FoodExternalId)
            .ToList();

        var tickedKeys = await LoadTickedKeysAsync(clientId, plan.ExternalId, weeks.Select(w => w.WeekNumber).ToList(), ct);
        var fallbackCategories = await LoadFallbackCategoriesAsync(groups, ct);

        var items = groups
            .Select(g => new ShoppingListItem
            {
                FoodExternalId = g.Key,
                FoodName = g.First().Food.FoodName,
                TotalAmountGrams = g.Sum(entry => entry.Food.AmountGrams),
                FoodCategory = g.Select(entry => entry.Food.FoodCategory).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c))
                               ?? fallbackCategories.GetValueOrDefault(g.Key, OtherCategory),
                IsTicked = g.Select(entry => entry.WeekNumber).Distinct().All(week => tickedKeys.Contains((week, g.Key)))
            })
            .OrderBy(i => i.FoodName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        await Send.OkAsync(new GetShoppingListResponse { Items = items }, ct);
    }

    private const string OtherCategory = "Other";

    private async Task<HashSet<(int WeekNumber, Guid FoodExternalId)>> LoadTickedKeysAsync(
        Guid clientId, Guid planId, List<int> weekNumbers, CancellationToken ct)
    {
        var filter = Builders<ShoppingListTick>.Filter.And(
            Builders<ShoppingListTick>.Filter.Eq(t => t.ClientId, clientId),
            Builders<ShoppingListTick>.Filter.Eq(t => t.PlanId, planId),
            Builders<ShoppingListTick>.Filter.In(t => t.WeekNumber, weekNumbers));

        using var cursor = await mongo.ShoppingListTicks.FindAsync(filter, cancellationToken: ct);
        var ticks = await cursor.ToListAsync(ct);

        return ticks.Select(t => (t.WeekNumber, t.FoodExternalId)).ToHashSet();
    }

    /// <summary>
    /// One batched lookup of <c>Food.Category</c> for items whose plan snapshot has no category.
    /// </summary>
    private async Task<Dictionary<Guid, string>> LoadFallbackCategoriesAsync(
        List<IGrouping<Guid, (int WeekNumber, MealFood Food)>> groups, CancellationToken ct)
    {
        var missingIds = groups
            .Where(g => g.All(entry => string.IsNullOrWhiteSpace(entry.Food.FoodCategory)))
            .Select(g => g.Key)
            .ToList();

        if (missingIds.Count == 0)
        {
            return [];
        }

        using var cursor = await mongo.Foods.FindAsync(
            Builders<Food>.Filter.In(f => f.ExternalId, missingIds), cancellationToken: ct);
        var foods = await cursor.ToListAsync(ct);

        return foods.ToDictionary(f => f.ExternalId, f => f.Category.ToString());
    }
}
