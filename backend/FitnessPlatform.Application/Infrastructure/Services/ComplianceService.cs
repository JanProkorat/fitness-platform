using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Calculates nutrition compliance scores, streaks, and weekly macro averages
/// by querying meal logs and nutrition plans from MongoDB.
/// </summary>
public class ComplianceService : IComplianceService
{
    /// <summary>
    /// MongoDB context for accessing collections.
    /// </summary>
    private readonly IMongoContext _mongo;

    /// <summary>
    /// Initializes a new instance of the <see cref="ComplianceService"/> class.
    /// </summary>
    /// <param name="mongo">MongoDB context.</param>
    public ComplianceService(IMongoContext mongo)
    {
        _mongo = mongo;
    }

    /// <inheritdoc />
    public async Task<ComplianceResult> CalculateComplianceAsync(
        Guid clientId, DateTime from, DateTime to, CancellationToken ct)
    {
        var plan = await FindActivePlanAsync(clientId, ct);

        if (plan is null)
            return new ComplianceResult { CompliancePercent = 0, MealsPlanned = 0, MealsLogged = 0 };

        var allDays = GetAllPlanDays(plan);
        var totalDays = allDays.Count;

        if (totalDays == 0)
            return new ComplianceResult { CompliancePercent = 0, MealsPlanned = 0, MealsLogged = 0 };

        var mealsPlanned = CountPlannedMeals(plan, allDays, totalDays, from, to);

        var logFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId)
            & Builders<MealLog>.Filter.Gte(l => l.EatenAt, from)
            & Builders<MealLog>.Filter.Lt(l => l.EatenAt, to.AddDays(1));

        using var logCursor = await _mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var logs = await logCursor.ToListAsync(ct);
        var mealsLogged = logs.Count;

        var compliancePercent = mealsPlanned == 0
            ? 0m
            : Math.Round((decimal)mealsLogged / mealsPlanned * 100, 1);

        return new ComplianceResult
        {
            CompliancePercent = compliancePercent,
            MealsPlanned = mealsPlanned,
            MealsLogged = mealsLogged
        };
    }

    /// <inheritdoc />
    public async Task<int> CalculateStreakAsync(Guid clientId, CancellationToken ct)
    {
        var plan = await FindActivePlanAsync(clientId, ct);

        if (plan is null)
            return 0;

        var allDays = GetAllPlanDays(plan);
        var totalDays = allDays.Count;

        if (totalDays == 0)
            return 0;

        var streak = 0;
        var currentDate = DateTime.UtcNow.Date.AddDays(-1);

        while (true)
        {
            var plannedCount = GetPlannedMealCountForDate(plan, allDays, totalDays, currentDate);

            if (plannedCount == 0)
            {
                // No meals planned for this day — skip but don't break the streak
                currentDate = currentDate.AddDays(-1);

                // Safety: don't go before the plan was published
                if (plan.DatePublished.HasValue && currentDate < plan.DatePublished.Value.Date)
                    break;

                continue;
            }

            var dayStart = currentDate;
            var dayEnd = currentDate.AddDays(1);

            var dayFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId)
                & Builders<MealLog>.Filter.Gte(l => l.EatenAt, dayStart)
                & Builders<MealLog>.Filter.Lt(l => l.EatenAt, dayEnd);

            using var dayCursor = await _mongo.MealLogs.FindAsync(dayFilter, cancellationToken: ct);
            var dayLogs = await dayCursor.ToListAsync(ct);
            var loggedCount = dayLogs.Count;

            var dayCompliance = (decimal)loggedCount / plannedCount;

            if (dayCompliance >= 0.8m)
            {
                streak++;
                currentDate = currentDate.AddDays(-1);

                // Safety: don't go before the plan was published
                if (plan.DatePublished.HasValue && currentDate < plan.DatePublished.Value.Date)
                    break;
            }
            else
            {
                break;
            }
        }

        return streak;
    }

    /// <inheritdoc />
    public async Task<NutrientTotals> CalculateAverageMacrosAsync(
        Guid clientId, DateTime from, DateTime to, CancellationToken ct)
    {
        var logFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId)
            & Builders<MealLog>.Filter.Gte(l => l.EatenAt, from)
            & Builders<MealLog>.Filter.Lt(l => l.EatenAt, to.AddDays(1));

        using var logCursor = await _mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var logs = await logCursor.ToListAsync(ct);

        if (logs.Count == 0)
            return new NutrientTotals { Kcal = 0, Protein = 0, Carbs = 0, Fat = 0 };

        var dailyTotals = logs
            .GroupBy(l => l.EatenAt.Date)
            .Select(group =>
            {
                var dayKcal = 0m;
                var dayProtein = 0m;
                var dayCarbs = 0m;
                var dayFat = 0m;

                foreach (var log in group)
                {
                    foreach (var food in log.FoodsEaten)
                    {
                        var factor = food.AmountGrams / 100m;
                        dayKcal += food.NutrientValuePer100Grams.Kcal * factor;
                        dayProtein += food.NutrientValuePer100Grams.Protein * factor;
                        dayCarbs += food.NutrientValuePer100Grams.Carbs * factor;
                        dayFat += food.NutrientValuePer100Grams.Fat * factor;
                    }
                }

                return new { Kcal = dayKcal, Protein = dayProtein, Carbs = dayCarbs, Fat = dayFat };
            })
            .ToList();

        var dayCount = dailyTotals.Count;

        return new NutrientTotals
        {
            Kcal = Math.Round(dailyTotals.Sum(d => d.Kcal) / dayCount, 1),
            Protein = Math.Round(dailyTotals.Sum(d => d.Protein) / dayCount, 1),
            Carbs = Math.Round(dailyTotals.Sum(d => d.Carbs) / dayCount, 1),
            Fat = Math.Round(dailyTotals.Sum(d => d.Fat) / dayCount, 1)
        };
    }

    /// <summary>
    /// Finds the active nutrition plan for a client.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The active plan, or null if none exists.</returns>
    private async Task<NutritionPlan?> FindActivePlanAsync(Guid clientId, CancellationToken ct)
    {
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        using var cursor = await _mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Extracts all plan days in order from the plan's weeks.
    /// </summary>
    /// <param name="plan">The nutrition plan.</param>
    /// <returns>Ordered list of plan days.</returns>
    private static List<PlanDay> GetAllPlanDays(NutritionPlan plan)
    {
        return plan.Weeks
            .OrderBy(w => w.WeekNumber)
            .SelectMany(w => w.Days.OrderBy(d => d.DayOfWeek))
            .ToList();
    }

    /// <summary>
    /// Counts total planned meals in a date range using the plan's cycling schedule.
    /// </summary>
    /// <param name="plan">The nutrition plan.</param>
    /// <param name="allDays">All plan days in order.</param>
    /// <param name="totalDays">Total number of cycling days.</param>
    /// <param name="from">Start date (inclusive).</param>
    /// <param name="to">End date (inclusive).</param>
    /// <returns>Total number of planned meals.</returns>
    private static int CountPlannedMeals(
        NutritionPlan plan, List<PlanDay> allDays, int totalDays, DateTime from, DateTime to)
    {
        var mealsPlanned = 0;

        for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
        {
            mealsPlanned += GetPlannedMealCountForDate(plan, allDays, totalDays, date);
        }

        return mealsPlanned;
    }

    /// <summary>
    /// Gets the number of planned meals for a specific date using the plan's cycling schedule.
    /// </summary>
    /// <param name="plan">The nutrition plan.</param>
    /// <param name="allDays">All plan days in order.</param>
    /// <param name="totalDays">Total number of cycling days.</param>
    /// <param name="date">The date to check.</param>
    /// <returns>Number of planned meals for the date.</returns>
    private static int GetPlannedMealCountForDate(
        NutritionPlan plan, List<PlanDay> allDays, int totalDays, DateTime date)
    {
        if (!plan.DatePublished.HasValue)
            return 0;

        var daysSincePublish = (int)(date.Date - plan.DatePublished.Value.Date).TotalDays;

        if (daysSincePublish < 0)
            return 0;

        var dayIndex = daysSincePublish % totalDays;
        return allDays[dayIndex].Meals.Count;
    }
}
