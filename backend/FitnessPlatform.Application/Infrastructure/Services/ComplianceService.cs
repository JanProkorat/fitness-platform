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

        if (plan is null || !plan.StartDate.HasValue)
            return new ComplianceResult { CompliancePercent = 0, MealsPlanned = 0, MealsLogged = 0 };

        var mealsPlanned = CountPlannedMeals(plan, from, to);

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

        if (plan is null || !plan.StartDate.HasValue)
            return 0;

        // Floor: the Monday of the earliest published week. Walking past this
        // point means there was no active plan yet — stop the scan.
        var earliestPublishedWeek = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .FirstOrDefault();

        if (earliestPublishedWeek is null)
            return 0;

        var planStart = plan.StartDate.Value.Date;
        var floorDate = planStart.AddDays((earliestPublishedWeek.WeekNumber - 1) * 7);

        var streak = 0;
        var today = DateTime.UtcNow.Date;
        var currentDate = today;

        while (currentDate >= floorDate)
        {
            var plannedCount = GetPlannedMealCountForDate(plan, currentDate);

            if (plannedCount == 0)
            {
                // Rest day / no meals planned — skip without breaking.
                currentDate = currentDate.AddDays(-1);
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

            if (loggedCount >= 1)
            {
                streak++;
                currentDate = currentDate.AddDays(-1);
            }
            else if (currentDate == today)
            {
                // Today hasn't reached the threshold yet — user can still log
                // more meals. Don't count it, but don't break the streak either.
                currentDate = currentDate.AddDays(-1);
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
            return new NutrientTotals { Kcal = 0, Protein = 0, Carbs = 0, Fat = 0, Fiber = 0 };

        var dailyTotals = logs
            .GroupBy(l => l.EatenAt.Date)
            .Select(group =>
            {
                var dayKcal = 0m;
                var dayProtein = 0m;
                var dayCarbs = 0m;
                var dayFat = 0m;
                var dayFiber = 0m;

                foreach (var log in group)
                {
                    foreach (var food in log.FoodsEaten)
                    {
                        var factor = food.AmountGrams / 100m;
                        dayKcal += food.NutrientValuePer100Grams.Kcal * factor;
                        dayProtein += food.NutrientValuePer100Grams.Protein * factor;
                        dayCarbs += food.NutrientValuePer100Grams.Carbs * factor;
                        dayFat += food.NutrientValuePer100Grams.Fat * factor;
                        dayFiber += (food.NutrientValuePer100Grams.Fiber ?? 0m) * factor;
                    }
                }

                return new { Kcal = dayKcal, Protein = dayProtein, Carbs = dayCarbs, Fat = dayFat, Fiber = dayFiber };
            })
            .ToList();

        var dayCount = dailyTotals.Count;

        return new NutrientTotals
        {
            Kcal = Math.Round(dailyTotals.Sum(d => d.Kcal) / dayCount, 1),
            Protein = Math.Round(dailyTotals.Sum(d => d.Protein) / dayCount, 1),
            Carbs = Math.Round(dailyTotals.Sum(d => d.Carbs) / dayCount, 1),
            Fat = Math.Round(dailyTotals.Sum(d => d.Fat) / dayCount, 1),
            Fiber = Math.Round(dailyTotals.Sum(d => d.Fiber) / dayCount, 1)
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
    /// Counts total planned meals for published weeks within a date range.
    /// </summary>
    private static int CountPlannedMeals(NutritionPlan plan, DateTime from, DateTime to)
    {
        var mealsPlanned = 0;

        for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
        {
            mealsPlanned += GetPlannedMealCountForDate(plan, date);
        }

        return mealsPlanned;
    }

    /// <summary>
    /// Gets the number of planned meals for a specific date based on the plan's
    /// <see cref="NutritionPlan.StartDate"/> and the set of currently Published weeks.
    /// A date that falls in a non-published week (or before the plan started) counts
    /// as zero planned meals.
    /// </summary>
    private static int GetPlannedMealCountForDate(NutritionPlan plan, DateTime date)
    {
        if (!plan.StartDate.HasValue)
            return 0;

        var startDate = plan.StartDate.Value.Date;
        var target = date.Date;

        if (target < startDate)
            return 0;

        var daysSinceStart = (int)(target - startDate).TotalDays;
        var weekNumber = daysSinceStart / 7 + 1;
        // PlanDay.DayOfWeek is 1=Monday … 7=Sunday to match ISO week days.
        var dayOfWeek = daysSinceStart % 7 + 1;

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == weekNumber);
        if (week is null || week.Status != WeekStatus.Published)
            return 0;

        var day = week.Days.FirstOrDefault(d => d.DayOfWeek == dayOfWeek);
        return day?.Meals.Count ?? 0;
    }
}
