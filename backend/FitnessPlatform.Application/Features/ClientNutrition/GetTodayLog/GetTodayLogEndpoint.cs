using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;

/// <summary>
/// Endpoint that returns the client's meal log for today, including consumed and remaining nutrients.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetTodayLogEndpoint(IMongoContext mongo, IApplicationDbContext db) : EndpointWithoutRequest<GetTodayLogResponse>
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

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;
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

        // Resolve today's plan day so we can use pre-computed MealTotals
        // (which include both foods AND recipes, matching the mobile optimistic
        // update). Without this, totals are computed from FoodsEaten only and
        // miss recipe kcal contributions.
        PlanDay? todayPlanDay = null;
        if (plan is not null)
        {
            var publishedWeeks = plan.Weeks
                .Where(w => w.Status == WeekStatus.Published)
                .ToList();

            if (publishedWeeks.Count > 0)
            {
                if (plan.StartDate.HasValue)
                {
                    var daysSinceStart = (int)(todayUtc - plan.StartDate.Value.Date).TotalDays;
                    if (daysSinceStart >= 0)
                    {
                        var weekNum = daysSinceStart / 7 + 1;
                        var dayIdx = daysSinceStart % 7;
                        var todayWeek = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum)
                                        ?? publishedWeeks[^1];
                        if (dayIdx < todayWeek.Days.Count)
                            todayPlanDay = todayWeek.Days[dayIdx];
                    }
                }
                else if (plan.DatePublished.HasValue)
                {
                    var daysSincePublish = (int)(todayUtc - plan.DatePublished.Value.Date).TotalDays;
                    if (daysSincePublish >= 0)
                    {
                        var totalDays = publishedWeeks.Count * 7;
                        var currentDayIndex = daysSincePublish % totalDays;
                        var weekIdx = currentDayIndex / 7;
                        var dayIdx = currentDayIndex % 7;
                        var todayWeek = publishedWeeks[weekIdx];
                        if (dayIdx < todayWeek.Days.Count)
                            todayPlanDay = todayWeek.Days[dayIdx];
                    }
                }
            }
        }

        // Build lookup: MealId → plan meal (for name + pre-computed totals)
        var planMeals = new Dictionary<Guid, PlanMeal>();
        if (todayPlanDay is not null)
        {
            foreach (var meal in todayPlanDay.Meals)
                planMeals.TryAdd(meal.MealId, meal);
        }
        else if (plan is not null)
        {
            // Fallback: scan all weeks for meal names (no MealTotals guarantee)
            foreach (var meal in plan.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Meals))
                planMeals.TryAdd(meal.MealId, meal);
        }

        // Map logs to DTOs — use plan MealTotals when available, fall back to
        // computing from FoodsEaten for meals not found in today's plan day.
        var mealsEaten = logs.Select(log =>
        {
            planMeals.TryGetValue(log.MealId, out var planMeal);
            var totals = planMeal?.MealTotals ?? CalculateTotals(log.FoodsEaten);

            return new MealLogDto
            {
                MealId = log.MealId,
                MealName = planMeal?.Kind.ToString() ?? string.Empty,
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
            Fat = mealsEaten.Sum(m => m.Totals.Fat),
            Fiber = mealsEaten.Sum(m => m.Totals.Fiber)
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
                Fat = (gs.FatGrams ?? 0) - totalConsumed.Fat,
                Fiber = (gs.FiberGrams ?? 0) - totalConsumed.Fiber
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
