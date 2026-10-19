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
        CancellationToken ct,
        Guid? planAuthorUserId = null)
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
        // Every domain-scoped read is skipped outright, not filtered afterwards, when the caller's
        // link denies that domain. This is what makes the reduction land "for free": a skipped
        // compliance/training read yields hasActiveNutritionPlan=false / hasActiveTrainingPlan=false,
        // and every branch in ComputeVerdict already guards on those two booleans, so the verdict
        // scalar itself reduces to only the visible domain without any change to ComputeVerdict's
        // signature or logic. Weight and LastActiveAt are deliberately NOT gated here — they are
        // dual-readable per the response boundary below, so their reads always run.
        var complianceTask = capabilities.CanViewNutritionPlans
            ? ComputeComplianceAsync(clientUserId, planAuthorUserId, ct)
            : Task.FromResult<(decimal? compliancePercent, bool hasActivePlan)>((null, false));
        var trainingTask = capabilities.CanViewTrainingPlans
            ? ComputeTrainingFrequencyAsync(clientUserId, planAuthorUserId, ct)
            : Task.FromResult<(int? actual, int? prescribed, bool hasActivePlan)>((null, null, false));
        var latestWorkoutTask = FetchLatestWorkoutCompletedAtAsync(clientUserId, ct);
        var latestMealTask = FetchLatestMealLogTimestampAsync(clientUserId, ct);
        // The record count feeds nothing but its own response field, so there is no reason to read
        // a client's personal records for a caller who may not see them.
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

    /// <inheritdoc />
    public async Task<DateTime?> GetLastActiveAtAsync(Guid clientUserId, long clientProfileId, CancellationToken ct)
    {
        var lastActive = await GetLastActiveAtAsync([(clientUserId, clientProfileId)], ct);

        return lastActive[clientUserId];
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<Guid, DateTime?>> GetLastActiveAtAsync(
        IReadOnlyCollection<(Guid ClientUserId, long ClientProfileId)> clients,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, DateTime?>();

        if (clients.Count == 0)
        {
            return result;
        }

        var userIds = clients.Select(client => client.ClientUserId).Distinct().ToList();
        var profileIds = clients.Select(client => client.ClientProfileId).Distinct().ToList();

        var latestMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => profileIds.Contains(bm.ClientProfileId))
            .GroupBy(bm => bm.ClientProfileId)
            .Select(group => new { ClientProfileId = group.Key, MeasuredAt = group.Max(bm => bm.MeasuredAt) })
            .ToListAsync(ct);
        var measurementByProfile = latestMeasurements.ToDictionary(m => m.ClientProfileId, m => m.MeasuredAt);

        var workoutByUser = await FetchLatestWorkoutCompletedAtAsync(userIds, ct);
        var mealByUser = await FetchLatestMealLogTimestampAsync(userIds, ct);

        foreach (var (clientUserId, clientProfileId) in clients)
        {
            DateTime? measurementAt = measurementByProfile.TryGetValue(clientProfileId, out var measured) ? measured : null;
            DateTime? workoutAt = workoutByUser.TryGetValue(clientUserId, out var completed) ? completed : null;
            DateTime? mealAt = mealByUser.TryGetValue(clientUserId, out var eaten) ? eaten : null;

            result[clientUserId] = CoalesceLastActiveAt(workoutAt, mealAt, measurementAt);
        }

        return result;
    }

    // ── Signal computation ──────────────────────────────────────────────────

    private async Task<(decimal? compliancePercent, bool hasActivePlan)> ComputeComplianceAsync(
        Guid clientUserId, Guid? planAuthorUserId, CancellationToken ct)
    {
        // Check for an active nutrition plan first to avoid collapsing to 0% when no plan exists.
        var nutritionPlanFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        if (planAuthorUserId is { } nutritionistId)
        {
            nutritionPlanFilter &= Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        }

        using var planCursor = await mongo.NutritionPlans.FindAsync(nutritionPlanFilter, cancellationToken: ct);
        var activePlan = await planCursor.FirstOrDefaultAsync(ct);

        if (activePlan is null)
            return (null, false);

        // Use NutritionCompliancePercent (not combined CompliancePercent) as specified in AC.
        // Calculate over the last ComplianceWindowDays days to cover most nutrition plan periods.
        var from = DateTime.UtcNow.Date.AddDays(-ClientDashboardConstants.ComplianceWindowDays);
        var to = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
        var complianceResult = await complianceService.CalculateComplianceAsync(
            clientUserId, from, to, ct, planAuthorUserId);

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
        Guid clientUserId, Guid? planAuthorUserId, CancellationToken ct)
    {
        // Check for an active training plan.
        var trainingPlanFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
            & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        if (planAuthorUserId is { } trainerId)
        {
            trainingPlanFilter &= Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);
        }

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

    /// <summary>Latest completed-workout time per client, in one aggregation. Clients without one are absent.</summary>
    private async Task<Dictionary<Guid, DateTime>> FetchLatestWorkoutCompletedAtAsync(
        List<Guid> clientUserIds, CancellationToken ct)
    {
        var workoutFilter = Builders<SessionExecution>.Filter.In(w => w.ClientId, clientUserIds)
            & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Completed)
            & Builders<SessionExecution>.Filter.Exists(w => w.Performance);

        var latest = await mongo.SessionExecutions
            .Aggregate()
            .Match(workoutFilter)
            .Group(w => w.ClientId, group => new { ClientId = group.Key, CompletedAt = group.Max(w => w.Performance!.CompletedAt) })
            .ToListAsync(ct);

        return latest
            .Where(entry => entry.CompletedAt.HasValue)
            .ToDictionary(entry => entry.ClientId, entry => entry.CompletedAt!.Value);
    }

    /// <summary>
    /// Latest meal-log time per client, in one aggregation: the latest <c>EatenAt</c>, or when the client has
    /// none, the latest <c>LogDate</c> — the same rule as <see cref="FetchLatestMealLogTimestampAsync(Guid, CancellationToken)"/>.
    /// </summary>
    private async Task<Dictionary<Guid, DateTime>> FetchLatestMealLogTimestampAsync(
        List<Guid> clientUserIds, CancellationToken ct)
    {
        var latest = await mongo.MealLogs
            .Aggregate()
            .Match(Builders<MealLog>.Filter.In(l => l.ClientId, clientUserIds))
            .Group(l => l.ClientId, group => new
            {
                ClientId = group.Key,
                EatenAt = group.Max(l => l.EatenAt),
                LogDate = group.Max(l => l.LogDate),
            })
            .ToListAsync(ct);

        return latest.ToDictionary(entry => entry.ClientId, entry => entry.EatenAt ?? entry.LogDate);
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
