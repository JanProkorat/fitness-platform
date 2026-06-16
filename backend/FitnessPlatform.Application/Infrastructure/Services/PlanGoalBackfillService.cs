using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// One-shot, idempotent backfill that copies goal and targetWeightKg from each
/// client's <see cref="Domain.Entities.ClientOnboardingData"/> onto existing
/// <see cref="NutritionPlan"/> and <see cref="TrainingPlan"/> documents that
/// were created before the plan-level goal fields were introduced.
///
/// <para>
/// Safety guarantees:
/// <list type="bullet">
///   <item>Only plans with a <c>null</c> Goal <strong>AND</strong> null TargetWeightKg are
///     touched — documents that already have either field set are never overwritten.</item>
///   <item>Running the method twice in a row is a no-op the second time (idempotent).</item>
///   <item>PostgreSQL is read-only — no EF writes are made.</item>
///   <item>No schema changes or EF migrations are required.</item>
/// </list>
/// </para>
///
/// <para>
/// Join key: <c>plan.ClientId</c> is the <c>ClientProfile.PublicId</c> Guid.
/// It is <strong>NOT</strong> <c>ClientProfile.UserId</c> (the ApplicationUser.Id).
/// <c>CreatePlanEndpoint</c> writes <c>plan.ClientId = clientProfile.PublicId</c>,
/// so the join must resolve via <c>ClientProfile.PublicId</c>.
/// </para>
/// </summary>
public class PlanGoalBackfillService(
    IApplicationDbContext db,
    IMongoContext mongo,
    ILogger<PlanGoalBackfillService> logger)
{
    /// <summary>
    /// Runs both backfill passes (nutrition plans then training plans) and
    /// returns a summary of how many documents were updated.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple with the count of nutrition plans and training plans updated.
    /// </returns>
    public async Task<(int NutritionPlansUpdated, int TrainingPlansUpdated)> BackfillAsync(
        CancellationToken ct = default)
    {
        var nutritionCount = await BackfillNutritionPlansAsync(ct);
        var trainingCount  = await BackfillTrainingPlansAsync(ct);
        return (nutritionCount, trainingCount);
    }

    // ── Pass A — NutritionPlans ──────────────────────────────────────────────

    private async Task<int> BackfillNutritionPlansAsync(CancellationToken ct)
    {
        // Find all NutritionPlan documents where both Goal and TargetWeightKg are null.
        // These are plans that pre-date the plan-level goal feature.
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.Goal, null),
            Builders<NutritionPlan>.Filter.Eq(p => p.TargetWeightKg, null));

        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        if (candidates.Count == 0)
        {
            logger.LogInformation(
                "Pass A (nutrition plans): no candidates found (all plans already have Goal or TargetWeightKg set), skipping");
            return 0;
        }

        logger.LogInformation(
            "Pass A (nutrition plans): found {Count} candidate plans to inspect",
            candidates.Count);

        // Collect all unique ClientIds (which are ClientProfile.PublicId Guids) from the candidate plans.
        var clientIds = candidates.Select(p => p.ClientId).Distinct().ToList();

        // Resolve ClientProfile.PublicId -> OnboardingData in a single Postgres query.
        // CRITICAL: plan.ClientId == ClientProfile.PublicId (NOT ClientProfile.UserId).
        var onboardingByPublicId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => clientIds.Contains(cp.PublicId) && cp.OnboardingData != null)
            .Select(cp => new
            {
                cp.PublicId,
                cp.OnboardingData!.PrimaryGoal,
                cp.OnboardingData.TargetWeightKg
            })
            .ToDictionaryAsync(cp => cp.PublicId, ct);

        var updatedCount = 0;

        foreach (var plan in candidates)
        {
            if (!onboardingByPublicId.TryGetValue(plan.ClientId, out var od))
                continue;

            // PrimaryGoal is a non-nullable enum so we always have a value to write.
            // Only skip if onboarding data has no target weight AND goal is unset
            // (the goal is always set since it is required on the onboarding form).
            var update = Builders<NutritionPlan>.Update
                .Set(p => p.Goal, (PrimaryGoal?)od.PrimaryGoal)
                .Set(p => p.TargetWeightKg, od.TargetWeightKg);

            // Idempotent guard: only update documents still null in both fields.
            var idempotentFilter = Builders<NutritionPlan>.Filter.And(
                Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
                Builders<NutritionPlan>.Filter.Eq(p => p.Goal, null),
                Builders<NutritionPlan>.Filter.Eq(p => p.TargetWeightKg, null));

            var result = await mongo.NutritionPlans.UpdateOneAsync(idempotentFilter, update, cancellationToken: ct);
            if (result.ModifiedCount > 0)
                updatedCount++;
        }

        logger.LogInformation(
            "Pass A (nutrition plans): backfilled {Count} plans with goal/targetWeightKg from onboarding data",
            updatedCount);

        return updatedCount;
    }

    // ── Pass B — TrainingPlans ───────────────────────────────────────────────

    private async Task<int> BackfillTrainingPlansAsync(CancellationToken ct)
    {
        // Find all TrainingPlan documents where both Goal and TargetWeightKg are null.
        var filter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.Goal, null),
            Builders<TrainingPlan>.Filter.Eq(p => p.TargetWeightKg, null));

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        if (candidates.Count == 0)
        {
            logger.LogInformation(
                "Pass B (training plans): no candidates found (all plans already have Goal or TargetWeightKg set), skipping");
            return 0;
        }

        logger.LogInformation(
            "Pass B (training plans): found {Count} candidate plans to inspect",
            candidates.Count);

        var clientIds = candidates.Select(p => p.ClientId).Distinct().ToList();

        // CRITICAL: plan.ClientId == ClientProfile.PublicId (NOT ClientProfile.UserId).
        var onboardingByPublicId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => clientIds.Contains(cp.PublicId) && cp.OnboardingData != null)
            .Select(cp => new
            {
                cp.PublicId,
                cp.OnboardingData!.PrimaryGoal,
                cp.OnboardingData.TargetWeightKg
            })
            .ToDictionaryAsync(cp => cp.PublicId, ct);

        var updatedCount = 0;

        foreach (var plan in candidates)
        {
            if (!onboardingByPublicId.TryGetValue(plan.ClientId, out var od))
                continue;

            var update = Builders<TrainingPlan>.Update
                .Set(p => p.Goal, (PrimaryGoal?)od.PrimaryGoal)
                .Set(p => p.TargetWeightKg, od.TargetWeightKg);

            var idempotentFilter = Builders<TrainingPlan>.Filter.And(
                Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
                Builders<TrainingPlan>.Filter.Eq(p => p.Goal, null),
                Builders<TrainingPlan>.Filter.Eq(p => p.TargetWeightKg, null));

            var result = await mongo.TrainingPlans.UpdateOneAsync(idempotentFilter, update, cancellationToken: ct);
            if (result.ModifiedCount > 0)
                updatedCount++;
        }

        logger.LogInformation(
            "Pass B (training plans): backfilled {Count} plans with goal/targetWeightKg from onboarding data",
            updatedCount);

        return updatedCount;
    }
}
