using System.Runtime.CompilerServices;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

[assembly: InternalsVisibleTo("FitnessPlatform.Tests")]

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Computes the on-track verdict and supporting dashboard signals for a single client.
/// Aggregates data from PostgreSQL (BodyMeasurement) and MongoDB (NutritionPlan, TrainingPlan,
/// WorkoutLog, MealLog, PersonalRecord) without duplicating compliance calculation logic.
///
/// EF Core's DbContext is NOT thread-safe. All queries against <see cref="IApplicationDbContext"/>
/// are executed sequentially. MongoDB collections are thread-safe and may be queried in parallel.
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
        decimal? targetWeightKg,
        LinkCapabilities capabilities,
        CancellationToken ct)
    {
        // ── EF queries — must be serialized (DbContext is not thread-safe) ──
        // Fold both BodyMeasurements usages into a single query that serves:
        //   - ComputeWeightSignal: top-2 measurements with WeightKg != null
        //   - ComputeLastActiveAt: most recent MeasuredAt (any measurement)
        // We take the top-2 WeightKg-non-null rows, then separately the most-recent MeasuredAt.
        // Both filters share the clientProfileId predicate so one round-trip suffices.

        // Take the 2 most recent measurements that have a weight reading.
        var recentWeightMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfileId && bm.WeightKg != null)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => new { bm.WeightKg, bm.MeasuredAt })
            .Take(2)
            .ToListAsync(ct);

        // Also take the single most recent measurement regardless of whether WeightKg is set,
        // to capture lastActiveAt from a non-weight measurement (e.g. body-fat only).
        var latestAnyMeasurementDate = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfileId)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => (DateTime?)bm.MeasuredAt)
            .FirstOrDefaultAsync(ct);

        // ── MongoDB queries — thread-safe, run in parallel ──────────────────
        var complianceTask = ComputeComplianceAsync(clientUserId, ct);
        var trainingTask = ComputeTrainingFrequencyAsync(clientUserId, ct);
        var latestWorkoutTask = FetchLatestWorkoutCompletedAtAsync(clientUserId, ct);
        var latestMealTask = FetchLatestMealLogTimestampAsync(clientUserId, ct);
        // Skipped outright, not filtered afterwards, when the link denies training: the record
        // count feeds nothing but its own response field, so there is no reason to read a client's
        // personal records for a caller who may not see them. The compliance and training-frequency
        // reads below cannot be skipped the same way — ComputeVerdict consumes both, and the
        // verdict scalar is a pre-existing accepted leak whose value must not change here. Those
        // two are suppressed at the response boundary instead.
        var prCountTask = capabilities.CanViewTrainingPlans
            ? ComputePrCountThisMonthAsync(clientUserId, ct)
            : Task.FromResult(0);

        await Task.WhenAll(complianceTask, trainingTask, latestWorkoutTask, latestMealTask, prCountTask);

        var (compliancePercent, hasActiveNutritionPlan) = complianceTask.Result;
        var (frequencyActual, frequencyPrescribed, hasActiveTrainingPlan) = trainingTask.Result;
        DateTime? latestWorkoutAt = latestWorkoutTask.Result;
        DateTime? latestMealAt = latestMealTask.Result;
        var prCountThisMonth = prCountTask.Result;

        // ── Derive weight signal from the pre-fetched EF data ───────────────
        var (weightDeltaToGoal, weightDirection, hasWeightSignal) =
            DeriveWeightSignal(recentWeightMeasurements.Select(m => (m.WeightKg!.Value, m.MeasuredAt)).ToList(), targetWeightKg);

        // ── Coalesce lastActiveAt from all three sources ─────────────────────
        var lastActiveAt = CoalesceLastActiveAt(latestWorkoutAt, latestMealAt, latestAnyMeasurementDate);

        var verdict = ComputeVerdict(
            compliancePercent, hasActiveNutritionPlan,
            weightDirection, weightDeltaToGoal, hasWeightSignal,
            frequencyActual, frequencyPrescribed, hasActiveTrainingPlan,
            lastActiveAt);

        // Each itemised signal requires BOTH that the data exists and that the caller's link grants
        // its domain. Weight, and the coalesced last-active timestamp, stay dual-readable: body
        // measurements are standalone rather than hanging off a nutrition or training item, which
        // is how the timeline endpoint already classifies them.
        return new ClientVerdictResult
        {
            Verdict = verdict,
            CompliancePercent = hasActiveNutritionPlan && capabilities.CanViewNutritionPlans
                ? compliancePercent
                : null,
            WeightDeltaToGoal = hasWeightSignal ? weightDeltaToGoal : null,
            WeightDirection = weightDirection,
            TrainingFrequencyActual = hasActiveTrainingPlan && capabilities.CanViewTrainingPlans
                ? frequencyActual
                : null,
            TrainingFrequencyPrescribed = hasActiveTrainingPlan && capabilities.CanViewTrainingPlans
                ? frequencyPrescribed
                : null,
            LastActiveAt = lastActiveAt,
            PrCountThisMonth = capabilities.CanViewTrainingPlans ? prCountThisMonth : null
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
        // Calculate over the last ComplianceWindowDays days to cover most nutrition plan periods.
        var from = DateTime.UtcNow.Date.AddDays(-ClientDashboardConstants.ComplianceWindowDays);
        var to = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
        var complianceResult = await complianceService.CalculateComplianceAsync(clientUserId, from, to, ct);

        return (complianceResult.NutritionCompliancePercent, true);
    }

    /// <summary>
    /// Derives the weight signal from pre-fetched measurement rows.
    /// Pure computation — no I/O.
    /// </summary>
    private static (decimal? weightDeltaToGoal, WeightDirection weightDirection, bool hasSignal)
        DeriveWeightSignal(List<(decimal WeightKg, DateTime MeasuredAt)> measurements, decimal? targetWeightKg)
    {
        if (targetWeightKg is null || measurements.Count == 0)
            return (null, WeightDirection.Stable, false);

        var latestWeight = measurements[0].WeightKg;
        var deltaToGoal = latestWeight - targetWeightKg.Value;

        WeightDirection direction;

        if (measurements.Count < 2)
        {
            // Only one measurement: can only compute delta, direction is Stable.
            direction = WeightDirection.Stable;
        }
        else
        {
            var previousWeight = measurements[1].WeightKg;
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

        int prescribed = publishedWeek?.Days.Sum(d => d.Sessions.Count) ?? 0;

        // Actual sessions this ISO week (Monday–Sunday).
        var today = DateTime.UtcNow.Date;
        var dayOfWeek = (int)today.DayOfWeek;
        if (dayOfWeek == 0) dayOfWeek = 7; // Sunday = 7
        var weekStart = today.AddDays(-(dayOfWeek - 1));
        var weekEnd = weekStart.AddDays(7);

        // #841: only executions that carry Performance data (a live-training-assistant log) count
        // here — checkbox-only completions never appeared in the old WorkoutLogs collection either.
        var workoutFilter = Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientUserId)
            & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Completed)
            & Builders<SessionExecution>.Filter.Exists(w => w.Performance)
            & Builders<SessionExecution>.Filter.Gte(w => w.Performance!.CompletedAt, (DateTime?)weekStart)
            & Builders<SessionExecution>.Filter.Lt(w => w.Performance!.CompletedAt, (DateTime?)weekEnd);

        using var workoutCursor = await mongo.SessionExecutions.FindAsync(workoutFilter, cancellationToken: ct);
        var completedLogs = await workoutCursor.ToListAsync(ct);
        int actual = completedLogs.Count;

        return (actual, prescribed, true);
    }

    private async Task<DateTime?> FetchLatestWorkoutCompletedAtAsync(Guid clientUserId, CancellationToken ct)
    {
        var workoutFilter = Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientUserId)
            & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Completed)
            & Builders<SessionExecution>.Filter.Exists(w => w.Performance);

        using var workoutCursor = await mongo.SessionExecutions.FindAsync(
            workoutFilter,
            new FindOptions<SessionExecution> { Sort = Builders<SessionExecution>.Sort.Descending(w => w.Performance!.CompletedAt), Limit = 1 },
            ct);
        var latestWorkout = await workoutCursor.FirstOrDefaultAsync(ct);

        return latestWorkout?.Performance?.CompletedAt;
    }

    private async Task<DateTime?> FetchLatestMealLogTimestampAsync(Guid clientUserId, CancellationToken ct)
    {
        // Sort by EatenAt descending so the comparison field matches the sort field.
        // A backdated or edited entry cannot produce a stale lastActiveAt at the boundary.
        var mealFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientUserId)
            & Builders<MealLog>.Filter.Ne(l => l.EatenAt, (DateTime?)null);

        using var mealCursor = await mongo.MealLogs.FindAsync(
            mealFilter,
            new FindOptions<MealLog> { Sort = Builders<MealLog>.Sort.Descending(l => l.EatenAt), Limit = 1 },
            ct);
        var latestMealLog = await mealCursor.FirstOrDefaultAsync(ct);

        if (latestMealLog is not null)
            return latestMealLog.EatenAt;

        // Fall back: any meal log without EatenAt, sorted by LogDate.
        var fallbackFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientUserId);
        using var fallbackCursor = await mongo.MealLogs.FindAsync(
            fallbackFilter,
            new FindOptions<MealLog> { Sort = Builders<MealLog>.Sort.Descending(l => l.LogDate), Limit = 1 },
            ct);
        var fallbackLog = await fallbackCursor.FirstOrDefaultAsync(ct);
        return fallbackLog?.LogDate;
    }

    private async Task<int> ComputePrCountThisMonthAsync(Guid clientUserId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        // PersonalRecord.ClientId is the client's ApplicationUser.Id (same as clientUserId).
        var prFilter = Builders<PersonalRecord>.Filter.Eq(r => r.ClientId, clientUserId)
            & Builders<PersonalRecord>.Filter.Gte(r => r.AchievedAt, monthStart)
            & Builders<PersonalRecord>.Filter.Lt(r => r.AchievedAt, monthEnd);

        using var prCursor = await mongo.PersonalRecords.FindAsync(prFilter, cancellationToken: ct);
        var prs = await prCursor.ToListAsync(ct);
        return prs.Count;
    }

    /// <summary>
    /// Coalesces the three lastActiveAt sources into the most recent timestamp.
    /// Pure computation — no I/O.
    /// </summary>
    private static DateTime? CoalesceLastActiveAt(
        DateTime? latestWorkoutAt,
        DateTime? latestMealAt,
        DateTime? latestMeasurementAt)
    {
        var candidates = new[] { latestWorkoutAt, latestMealAt, latestMeasurementAt }
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .OrderByDescending(d => d)
            .ToList();

        return candidates.Count > 0 ? candidates[0] : null;
    }

    // ── Verdict logic ───────────────────────────────────────────────────────

    /// <summary>
    /// Computes the overall verdict from the pre-computed signals.
    /// Pure computation — no I/O. Internal visibility to allow direct unit testing.
    /// </summary>
    internal static ClientVerdict ComputeVerdict(
        decimal? compliancePercent, bool hasActiveNutritionPlan,
        WeightDirection weightDirection, decimal? weightDeltaToGoal, bool hasWeightSignal,
        int? frequencyActual, int? frequencyPrescribed, bool hasActiveTrainingPlan,
        DateTime? lastActiveAt)
    {
        // ── OffTrack hard thresholds (any one triggers OffTrack) ─────────────

        // Inactivity threshold: no activity in > N days (strict greater-than; exactly N days is NOT OffTrack).
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

        // One or more soft signals off but not OffTrack level -> NeedsAttention.
        // The spec says OffTrack only for specific hard thresholds; multiple soft misses = NeedsAttention.
        return ClientVerdict.NeedsAttention;
    }
}
