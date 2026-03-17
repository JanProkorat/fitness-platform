using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;

/// <summary>
/// Endpoint that returns the client's meal log for today, including consumed and remaining nutrients.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTodayLogEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetTodayLogResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/log/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's meal log";
            s.Description = "Returns all meals logged today with nutrient totals and remaining targets.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        // Fetch today's meal logs
        var logFilter = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Gte(l => l.EatenAt, todayUtc),
            Builders<MealLog>.Filter.Lt(l => l.EatenAt, tomorrowUtc));

        var logCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var logs = await logCursor.ToListAsync(ct);

        // Fetch active plan for meal names and global settings
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        // Build a lookup of meal names from the plan
        var mealNames = new Dictionary<Guid, string>();
        if (plan is not null)
        {
            foreach (var meal in plan.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Meals))
            {
                mealNames.TryAdd(meal.MealId, meal.Name);
            }
        }

        // Map logs to DTOs with computed totals
        var mealsEaten = logs.Select(log =>
        {
            var totals = CalculateTotals(log.FoodsEaten);
            mealNames.TryGetValue(log.MealId, out var name);

            return new MealLogDto
            {
                MealId = log.MealId,
                MealName = name ?? string.Empty,
                EatenAt = log.EatenAt,
                Totals = totals
            };
        }).ToList();

        // Sum all meal totals
        var totalConsumed = new NutrientTotals
        {
            Kcal = mealsEaten.Sum(m => m.Totals.Kcal),
            Protein = mealsEaten.Sum(m => m.Totals.Protein),
            Carbs = mealsEaten.Sum(m => m.Totals.Carbs),
            Fat = mealsEaten.Sum(m => m.Totals.Fat)
        };

        // Calculate remaining if global settings exist
        NutrientTotals? remaining = null;
        if (plan?.GlobalSettings is not null)
        {
            var gs = plan.GlobalSettings;
            remaining = new NutrientTotals
            {
                Kcal = (gs.DailyKcal ?? 0) - totalConsumed.Kcal,
                Protein = (gs.ProteinGrams ?? 0) - totalConsumed.Protein,
                Carbs = (gs.CarbsGrams ?? 0) - totalConsumed.Carbs,
                Fat = (gs.FatGrams ?? 0) - totalConsumed.Fat
            };
        }

        await Send.OkAsync(new GetTodayLogResponse
        {
            MealsEaten = mealsEaten,
            TotalConsumed = totalConsumed,
            Remaining = remaining
        }, ct);
    }

    /// <summary>
    /// Calculates nutrient totals from a list of foods based on their amount and per-100g values.
    /// </summary>
    /// <param name="foods">The foods to calculate totals for.</param>
    /// <returns>Aggregated nutrient totals.</returns>
    private static NutrientTotals CalculateTotals(List<MealFood> foods)
    {
        var totals = new NutrientTotals();

        foreach (var food in foods)
        {
            var ratio = food.AmountGrams / 100m;
            totals.Kcal += food.NutrientValuePer100Grams.Kcal * ratio;
            totals.Protein += food.NutrientValuePer100Grams.Protein * ratio;
            totals.Carbs += food.NutrientValuePer100Grams.Carbs * ratio;
            totals.Fat += food.NutrientValuePer100Grams.Fat * ratio;
        }

        return totals;
    }
}
