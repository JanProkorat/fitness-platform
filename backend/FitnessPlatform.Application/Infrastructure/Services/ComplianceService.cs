using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Calculates nutrition and training compliance scores, streaks, and weekly macro averages
/// by querying meal logs, nutrition plans, training plans, and training completion records from MongoDB.
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
        var nutritionPlan = await FindActivePlanAsync(clientId, ct);
        var trainingPlan = await FindActiveTrainingPlanAsync(clientId, ct);

        // ── Nutrition side ──────────────────────────────────────────────
        int mealsPlanned = 0;
        int mealsLogged = 0;
        decimal nutritionPercent = 0m;

        if (nutritionPlan is not null && nutritionPlan.StartDate.HasValue)
        {
            mealsPlanned = CountPlannedMeals(nutritionPlan, from, to);

            var logFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId)
                & Builders<MealLog>.Filter.Gte(l => l.EatenAt, from)
                & Builders<MealLog>.Filter.Lt(l => l.EatenAt, to.AddDays(1));

            using var logCursor = await _mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
            var logs = await logCursor.ToListAsync(ct);
            mealsLogged = logs.Count;

            nutritionPercent = mealsPlanned == 0
                ? 0m
                : Math.Round((decimal)mealsLogged / mealsPlanned * 100, 1);
        }

        // ── Training side ───────────────────────────────────────────────
        int trainingsPlanned = 0;
        int trainingsCompleted = 0;
        decimal trainingPercent = 0m;

        if (trainingPlan is not null && trainingPlan.StartDate.HasValue)
        {
            for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
            {
                var sessions = GetPlannedSessionsForDate(trainingPlan, date);
                trainingsPlanned += sessions.Count;

                foreach (var session in sessions)
                {
                    if (await IsSessionCompleteForDateAsync(clientId, session, date, ct))
                        trainingsCompleted++;
                }
            }

            trainingPercent = trainingsPlanned == 0
                ? 0m
                : Math.Round((decimal)trainingsCompleted / trainingsPlanned * 100, 1);
        }

        // ── Combined roll-up ────────────────────────────────────────────
        // Weighted by plan presence: the plan with more scheduled items weighs more.
        // If only one plan type is active, combined == that plan's percentage.
        decimal combinedPercent;
        var totalWeights = mealsPlanned + trainingsPlanned;

        if (totalWeights == 0)
        {
            combinedPercent = 0m;
        }
        else
        {
            combinedPercent = Math.Round(
                (mealsPlanned * nutritionPercent + trainingsPlanned * trainingPercent) / totalWeights, 1);
        }

        return new ComplianceResult
        {
            CompliancePercent = combinedPercent,
            MealsPlanned = mealsPlanned,
            MealsLogged = mealsLogged,
            NutritionCompliancePercent = nutritionPercent,
            TrainingsPlanned = trainingsPlanned,
            TrainingsCompleted = trainingsCompleted,
            TrainingCompliancePercent = trainingPercent
        };
    }

    /// <inheritdoc />
    public Task<int> CalculateStreakAsync(Guid clientId, CancellationToken ct)
        => CalculateStreakAsync(clientId, ComplianceDiscipline.Both, ct);

    /// <inheritdoc />
    public async Task<int> CalculateStreakAsync(Guid clientId, ComplianceDiscipline discipline, CancellationToken ct)
    {
        var nutritionPlan = discipline == ComplianceDiscipline.TrainingOnly
            ? null
            : await FindActivePlanAsync(clientId, ct);

        var trainingPlan = discipline == ComplianceDiscipline.NutritionOnly
            ? null
            : await FindActiveTrainingPlanAsync(clientId, ct);

        // Determine the floor: the earliest date either plan started a published week
        DateTime? floorDate = null;

        if (nutritionPlan?.StartDate.HasValue == true)
        {
            var earliest = nutritionPlan.Weeks
                .Where(w => w.Status == WeekStatus.Published)
                .OrderBy(w => w.WeekNumber)
                .FirstOrDefault();

            if (earliest is not null)
            {
                var nutritionFloor = nutritionPlan.StartDate.Value.Date
                    .AddDays((earliest.WeekNumber - 1) * 7);
                floorDate = floorDate is null ? nutritionFloor : new DateTime(Math.Min(floorDate.Value.Ticks, nutritionFloor.Ticks));
            }
        }

        if (trainingPlan?.StartDate.HasValue == true)
        {
            var earliest = trainingPlan.Weeks
                .Where(w => w.Status == WeekStatus.Published)
                .OrderBy(w => w.WeekNumber)
                .FirstOrDefault();

            if (earliest is not null)
            {
                var trainingFloor = trainingPlan.StartDate.Value.Date
                    .AddDays((earliest.WeekNumber - 1) * 7);
                floorDate = floorDate is null ? trainingFloor : new DateTime(Math.Min(floorDate.Value.Ticks, trainingFloor.Ticks));
            }
        }

        if (floorDate is null)
            return 0;

        var streak = 0;
        var today = DateTime.UtcNow.Date;
        var currentDate = today;

        while (currentDate >= floorDate.Value)
        {
            var nutritionPlanned = nutritionPlan is not null
                ? GetPlannedMealCountForDate(nutritionPlan, currentDate)
                : 0;

            var trainingSessions = trainingPlan is not null
                ? GetPlannedSessionsForDate(trainingPlan, currentDate)
                : [];

            var trainingPlannedCount = trainingSessions.Count;

            var nutritionActive = nutritionPlanned > 0;
            var trainingActive = trainingPlannedCount > 0;

            if (!nutritionActive && !trainingActive)
            {
                // Rest day / nothing planned — skip without breaking
                currentDate = currentDate.AddDays(-1);
                continue;
            }

            // Check nutrition compliance for this day (≥1 meal logged)
            bool nutritionDone = false;
            if (nutritionActive)
            {
                var dayStart = currentDate;
                var dayEnd = currentDate.AddDays(1);

                var dayFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId)
                    & Builders<MealLog>.Filter.Gte(l => l.EatenAt, dayStart)
                    & Builders<MealLog>.Filter.Lt(l => l.EatenAt, dayEnd);

                using var dayCursor = await _mongo.MealLogs.FindAsync(dayFilter, cancellationToken: ct);
                var dayLogs = await dayCursor.ToListAsync(ct);
                nutritionDone = dayLogs.Count >= 1;
            }

            // Check training compliance for this day (≥1 session fully complete — any-pattern)
            bool trainingDone = false;
            if (trainingActive)
            {
                foreach (var session in trainingSessions)
                {
                    if (await IsSessionCompleteForDateAsync(clientId, session, currentDate, ct))
                    {
                        trainingDone = true;
                        break;
                    }
                }
            }

            // Lenient OR rule: a day counts if at least one active plan side was satisfied.
            // Only-nutrition day: nutritionDone. Only-training day: trainingDone.
            // Both active: nutritionDone OR trainingDone.
            bool dayComplete = nutritionActive && trainingActive
                ? nutritionDone || trainingDone
                : nutritionActive ? nutritionDone : trainingDone;

            if (dayComplete)
            {
                streak++;
                currentDate = currentDate.AddDays(-1);
            }
            else if (currentDate == today)
            {
                // Today hasn't finished yet — don't break the streak, just skip today
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

        // Logs that passed the EatenAt range filter will have EatenAt set; fall back
        // to LogDate for any photo-only docs that slip through (defensive coding).
        var dailyTotals = logs
            .GroupBy(l => (l.EatenAt ?? l.LogDate).Date)
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
    private async Task<NutritionPlan?> FindActivePlanAsync(Guid clientId, CancellationToken ct)
    {
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        using var cursor = await _mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Finds the active training plan for a client.
    /// </summary>
    private async Task<TrainingPlan?> FindActiveTrainingPlanAsync(Guid clientId, CancellationToken ct)
    {
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
            & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var cursor = await _mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Checks whether a session is complete for the given date. Reads the unified
    /// <see cref="SessionExecution"/> collection (#841) — a session is done when its execution's
    /// <c>Status</c> is <c>Completed</c> (either a finished live workout, or every exercise/section
    /// marked complete via the checkbox flags). See <see cref="SessionExecutionExtensions.IsSessionComplete"/>.
    /// </summary>
    private async Task<bool> IsSessionCompleteForDateAsync(
        Guid clientId, TrainingSession session, DateTime date, CancellationToken ct)
    {
        if (session.Sections.Count == 0)
            return false;

        var dateUtc = date.Date == date ? date : date.Date;

        var filter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                     & Builders<SessionExecution>.Filter.Eq(c => c.Date, dateUtc)
                     & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, session.SessionId);

        using var cursor = await _mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var execution = await cursor.FirstOrDefaultAsync(ct);

        return execution is not null && execution.IsSessionComplete(session);
    }

    /// <summary>
    /// Returns the list of training sessions scheduled for a specific calendar date,
    /// based on the plan's week cycle and published weeks.
    /// Returns an empty list for rest days, unpublished weeks, or before plan start.
    /// </summary>
    private static IReadOnlyList<TrainingSession> GetPlannedSessionsForDate(TrainingPlan plan, DateTime date)
    {
        if (!plan.StartDate.HasValue)
            return [];

        var target = date.Date;
        var startDate = plan.StartDate.Value.Date;

        if (target < startDate)
            return [];

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
            return [];

        var resolved = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            target);

        if (resolved is null)
            return [];

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == resolved.Value);
        if (week is null || week.Status != WeekStatus.Published)
            return [];

        // ISO day-of-week: 1=Monday … 7=Sunday
        var dow = (int)target.DayOfWeek;
        dow = dow == 0 ? 7 : dow;

        return week.Sessions.Where(s => s.DayOfWeek == dow).ToList();
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
