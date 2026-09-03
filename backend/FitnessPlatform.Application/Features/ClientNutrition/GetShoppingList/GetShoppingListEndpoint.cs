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
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayLocalUtc);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Filter weeks by range (WeekFrom defaults to 1, WeekTo defaults to all weeks)
        var weekTo = req.WeekTo ?? plan.Weeks.Count;

        var weeks = plan.Weeks
            .Where(w => w.WeekNumber >= req.WeekFrom && w.WeekNumber <= weekTo);

        // Flatten all meals -> all foods, group by FoodExternalId, sum amounts
        var items = weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .SelectMany(m => m.Foods)
            .GroupBy(f => f.FoodExternalId)
            .Select(g => new ShoppingListItem
            {
                FoodExternalId = g.Key,
                FoodName = g.First().FoodName,
                TotalAmountGrams = g.Sum(f => f.AmountGrams)
            })
            .OrderBy(i => i.FoodName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        await Send.OkAsync(new GetShoppingListResponse { Items = items }, ct);
    }
}
