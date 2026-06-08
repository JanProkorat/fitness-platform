using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Computes the on-track verdict and supporting dashboard signals for a single client.
/// Aggregates data from PostgreSQL (BodyMeasurement) and MongoDB (NutritionPlan, TrainingPlan,
/// WorkoutLog, MealLog, PersonalRecord) without duplicating compliance calculation logic.
/// </summary>
public class ClientVerdictService(
    IApplicationDbContext db,
    IMongoContext mongo,
    IComplianceService complianceService)
    : IClientVerdictService
{
    /// <inheritdoc />
    public async Task<ClientVerdictResult> ComputeAsync(
        Guid clientUserId,
        long clientProfileId,
        Guid clientPublicId,
        decimal? targetWeightKg,
        CancellationToken ct)
    {
        // Run all data queries in parallel to minimize latency.
        var complianceTask = ComputeComplianceAsync(clientUserId, ct);
        var weightTask = ComputeWeightSignalAsync(clientProfileId, targetWeightKg, ct);
        var trainingTask = ComputeTrainingFrequencyAsync(clientUserId, ct);
        var lastActiveAtTask = ComputeLastActiveAtAsync(clientUserId, clientProfileId, ct);
        var prCountTask = ComputePrCountThisMonthAsync(clientUserId, ct);

        await Task.WhenAll(complianceTask, weightTask, trainingTask, lastActiveAtTask, prCountTask);

        var (compliancePercent, hasActiveNutritionPlan) = complianceTask.Result;
        var (weightDeltaToGoal, weightDirection, hasWeightSignal) = weightTask.Result;
        var (frequencyActual, frequencyPrescribed, hasActiveTrainingPlan) = trainingTask.Result;
        var lastActiveAt = lastActiveAtTask.Result;
        var prCountThisMonth = prCountTask.Result;

        var verdict = ComputeVerdict(
            compliancePercent, hasActiveNutritionPlan,
            weightDirection, weightDeltaToGoal, hasWeightSignal,
            frequencyActual, frequencyPrescribed, hasActiveTrainingPlan,
            lastActiveAt);

        return new ClientVerdictResult
        {
            Verdict = verdict,
            CompliancePercent = hasActiveNutritionPlan ? compliancePercent : null,
            WeightDeltaToGoal = hasWeightSignal ? weightDeltaToGoal : null,
            WeightDirection = weightDirection,
            TrainingFrequencyActual = hasActiveTrainingPlan ? frequencyActual : null,
            TrainingFrequencyPrescribed = hasActiveTrainingPlan ? frequencyPrescribed : null,
            LastActiveAt = lastActiveAt,
            PrCountThisMonth = prCountThisMonth
        };
    }

    // ── Signal computation ──────────────────────────────────────────────────

    private async Task<(decimal? compliancePercent, bool hasActivePlan)> ComputeComplianceAsync(
        Guid clientUserId, CancellationToken ct)
    {
        // Check for an active nutrition plan first to avoid collapsing to 0% when no plan exists.
        var nutritionPlanFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        using var planCursor = await mongo.NutritionPlans.FindAsync(nutritionPlanFilter, cancellationToken: ct);
        var activePlan = await planCursor.FirstOrDefaultAsync(ct);

        if (activePlan is null)
            return (null, false);

        // Use NutritionCompliancePercent (not combined CompliancePercent) as specified in AC.
        // Calculate over the last 30 days to cover most nutrition plan periods.
        var from = DateTime.UtcNow.Date.AddDays(-30);
        var to = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
        var complianceResult = await complianceService.CalculateComplianceAsync(clientUserId, from, to, ct);

        return (complianceResult.NutritionCompliancePercent, true);
    }

    private async Task<(decimal? weightDeltaToGoal, WeightDirection weightDirection, bool hasSignal)> ComputeWeightSignalAsync(
        long clientProfileId, decimal? targetWeightKg, CancellationToken ct)
    {
        if (targetWeightKg is null)
            return (null, WeightDirection.Stable, false);

        // Get the two most recent measurements to derive direction.
        var measurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfileId && bm.WeightKg != null)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => new { bm.WeightKg, bm.MeasuredAt })
            .Take(2)
            .ToListAsync(ct);

        if (measurements.Count == 0)
            return (null, WeightDirection.Stable, false);

        var latestWeight = measurements[0].WeightKg!.Value;
        var deltaToGoal = latestWeight - targetWeightKg.Value;
        var absDelta = Math.Abs(deltaToGoal);

        WeightDirection direction;

        if (measurements.Count < 2)
        {
            // Only one measurement: can only compute delta, direction is Stable.
            direction = WeightDirection.Stable;
        }
        else
        {
            var previousWeight = measurements[1].WeightKg!.Value;
            var change = latestWeight - previousWeight;

            if (Math.Abs(change) < ClientDashboardConstants.WeightStableBandKg)
            {
                direction = WeightDirection.Stable;
            }
            else
            {
                // "Towards" means moving closer to target.
                // If target < current (need to lose weight), weight going down is Towards.
                // If target > current (need to gain weight), weight going up is Towards.
                var movingTowardTarget = (targetWeightKg.Value < latestWeight && change < 0)
                    || (targetWeightKg.Value > latestWeight && change > 0);

                direction = movingTowardTarget ? WeightDirection.Towards : WeightDirection.Away;
            }
        }

        return (deltaToGoal, direction, true);
    }

    private async Task<(int? actual, int? prescribed, bool hasActivePlan)> ComputeTrainingFrequencyAsync(
        Guid clientUserId, CancellationToken ct)
    {
        // Check for an active training plan.
        var trainingPlanFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
            & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(trainingPlanFilter, cancellationToken: ct);
        var activePlan = await planCursor.FirstOrDefaultAsync(ct);

        if (activePlan is null)
            return (null, null, false);

        // Derive prescribed sessions: count sessions in any published week.
        // Use the first published week as the representative weekly schedule.
        var publishedWeek = activePlan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .FirstOrDefault();

        int prescribed = publishedWeek?.Sessions.Count ?? 0;

        // Actual sessions this ISO week (Monday–Sunday).
        var today = DateTime.UtcNow.Date;
        var dayOfWeek = (int)today.DayOfWeek;
        if (dayOfWeek == 0) dayOfWeek = 7; // Sunday = 7
        var weekStart = today.AddDays(-(dayOfWeek - 1));
        var weekEnd = weekStart.AddDays(7);

        var workoutFilter = Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientUserId)
            & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
            & Builders<WorkoutLog>.Filter.Gte(w => w.CompletedAt, (DateTime?)weekStart)
            & Builders<WorkoutLog>.Filter.Lt(w => w.CompletedAt, (DateTime?)weekEnd);

        using var workoutCursor = await mongo.WorkoutLogs.FindAsync(workoutFilter, cancellationToken: ct);
        var completedLogs = await workoutCursor.ToListAsync(ct);
        int actual = completedLogs.Count;

        return (actual, prescribed, true);
    }

    private async Task<DateTime?> ComputeLastActiveAtAsync(
        Guid clientUserId, long clientProfileId, CancellationToken ct)
    {
        // 1. Latest completed workout log
        var workoutFilter = Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientUserId)
            & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true);

        using var workoutCursor = await mongo.WorkoutLogs.FindAsync(
            workoutFilter,
            new FindOptions<WorkoutLog> { Sort = Builders<WorkoutLog>.Sort.Descending(w => w.CompletedAt), Limit = 1 },
            ct);
        var latestWorkout = await workoutCursor.FirstOrDefaultAsync(ct);

        // 2. Latest meal log — sort by EatenAt (prefer) then LogDate as fallback
        var mealFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientUserId);
        using var mealCursor = await mongo.MealLogs.FindAsync(
            mealFilter,
            new FindOptions<MealLog> { Sort = Builders<MealLog>.Sort.Descending(l => l.LogDate), Limit = 1 },
            ct);
        var latestMealLog = await mealCursor.FirstOrDefaultAsync(ct);

        // 3. Latest body measurement (PostgreSQL, keyed on ClientProfileId)
        var latestMeasurementDate = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfileId)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => (DateTime?)bm.MeasuredAt)
            .FirstOrDefaultAsync(ct);

        // Coalesce to the most recent timestamp across all three sources.
        var candidates = new List<DateTime?>();
        candidates.Add(latestWorkout?.CompletedAt);
        // Use EatenAt when available, fall back to LogDate for legacy entries
        candidates.Add(latestMealLog is not null ? (latestMealLog.EatenAt ?? latestMealLog.LogDate) : null);
        candidates.Add(latestMeasurementDate);

        var validDates = candidates
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .OrderByDescending(d => d)
            .ToList();

        return validDates.Count > 0 ? validDates[0] : null;
    }

    private async Task<int> ComputePrCountThisMonthAsync(Guid clientUserId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        // PersonalRecord.ClientId is the client's ApplicationUser.Id (same as clientUserId)
        var prFilter = Builders<PersonalRecord>.Filter.Eq(r => r.ClientId, clientUserId)
            & Builders<PersonalRecord>.Filter.Gte(r => r.AchievedAt, monthStart)
            & Builders<PersonalRecord>.Filter.Lt(r => r.AchievedAt, monthEnd);

        using var prCursor = await mongo.PersonalRecords.FindAsync(prFilter, cancellationToken: ct);
        var prs = await prCursor.ToListAsync(ct);
        return prs.Count;
    }

    // ── Verdict logic ───────────────────────────────────────────────────────

    private static ClientVerdict ComputeVerdict(
        decimal? compliancePercent, bool hasActiveNutritionPlan,
        WeightDirection weightDirection, decimal? weightDeltaToGoal, bool hasWeightSignal,
        int? frequencyActual, int? frequencyPrescribed, bool hasActiveTrainingPlan,
        DateTime? lastActiveAt)
    {
        // ── OffTrack hard thresholds (any one triggers OffTrack) ─────────────

        // Inactivity threshold: no activity in N days
        if (lastActiveAt.HasValue)
        {
            var daysSinceActivity = (DateTime.UtcNow - lastActiveAt.Value).TotalDays;
            if (daysSinceActivity > ClientDashboardConstants.InactivityThresholdDays)
                return ClientVerdict.OffTrack;
        }
        else
        {
            // No activity at all counts as inactive; only flag OffTrack if any active plan exists
            if (hasActiveNutritionPlan || hasActiveTrainingPlan)
                return ClientVerdict.OffTrack;
        }

        // Compliance below 60% is OffTrack
        if (hasActiveNutritionPlan && compliancePercent.HasValue && compliancePercent.Value < ClientDashboardConstants.ComplianceNeedsAttentionThreshold)
            return ClientVerdict.OffTrack;

        // Weight Away with delta > 1 kg is OffTrack
        if (hasWeightSignal && weightDirection == WeightDirection.Away && weightDeltaToGoal.HasValue
            && Math.Abs(weightDeltaToGoal.Value) > ClientDashboardConstants.WeightOffTrackDeltaKg)
            return ClientVerdict.OffTrack;

        // ── Count signals that are "off" (but not OffTrack level) ────────────

        var offSignals = 0;

        // Compliance 60-84 is a NeedsAttention signal
        if (hasActiveNutritionPlan && compliancePercent.HasValue
            && compliancePercent.Value < ClientDashboardConstants.ComplianceOnTrackThreshold)
            offSignals++;

        // Weight Stable or Away (even small Away) is a NeedsAttention signal
        if (hasWeightSignal && weightDirection != WeightDirection.Towards)
            offSignals++;

        // Training actual < prescribed is a NeedsAttention signal
        if (hasActiveTrainingPlan && frequencyActual.HasValue && frequencyPrescribed.HasValue
            && frequencyActual.Value < frequencyPrescribed.Value)
            offSignals++;

        if (offSignals == 0)
            return ClientVerdict.OnTrack;

        if (offSignals == 1)
            return ClientVerdict.NeedsAttention;

        // More than one signal off but not OffTrack level -> NeedsAttention
        // (The spec says OffTrack only for specific hard thresholds; multiple soft misses = NeedsAttention)
        return ClientVerdict.NeedsAttention;
    }
}
