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

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurementStats;

/// <summary>
/// Returns aggregated weight statistics for the authenticated client's measurements.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="mongo">MongoDB context for reading target weight from the active nutrition plan.</param>
public class GetMeasurementStatsEndpoint(IApplicationDbContext db, IMongoContext mongo) : EndpointWithoutRequest<MeasurementStatsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/measurements/stats");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get measurement statistics";
            s.Description = "Returns aggregated weight statistics including min, max, average, latest, and 30-day change.";
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

        var clientProfile = await db.ClientProfiles
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.UserId == clientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var weightMeasurements = db.BodyMeasurements
            .Where(m => m.ClientProfileId == clientProfile.Id && m.WeightKg != null);

        var totalCount = await db.BodyMeasurements
            .CountAsync(m => m.ClientProfileId == clientProfile.Id, ct);

        var hasWeightData = await weightMeasurements.AnyAsync(ct);

        // Query the Active NutritionPlan whose date window contains today to source
        // targetWeightKg plan-first. Fallback to OnboardingData only when the plan value is
        // null. Key: plan.ClientId == clientProfile.UserId — ApplicationUser.Id is the
        // canonical clientId for Mongo documents (#840). A client may hold several
        // sequential, non-overlapping Active plans (#780), so pick the one whose window
        // contains today rather than the most recent.
        decimal? planTargetWeightKg = null;
        try
        {
            var planFilter = Builders<NutritionPlan>.Filter.And(
                Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientProfile.UserId),
                Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

            using var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
            var activePlans = await planCursor.ToListAsync(ct);
            var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientProfile.UserId, ct);
            var activePlan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayLocalUtc);
            planTargetWeightKg = activePlan?.TargetWeightKg;
        }
        catch (MongoDB.Driver.MongoException ex)
        {
            // Active plan query is optional — log and fall back to onboarding if Mongo is unavailable
            Logger.LogWarning(ex, "Mongo query for active NutritionPlan failed for client {ClientPublicId}; falling back to onboarding data", clientProfile.PublicId);
        }

        // Plan-first: prefer plan's targetWeightKg; fall back to onboarding baseline.
        var targetWeightKg = planTargetWeightKg ?? clientProfile.OnboardingData?.TargetWeightKg;

        if (!hasWeightData)
        {
            await Send.OkAsync(new MeasurementStatsResponse { TotalCount = totalCount, TargetWeightKg = targetWeightKg }, ct);
            return;
        }

        var minWeight = await weightMeasurements.MinAsync(m => m.WeightKg, ct);
        var maxWeight = await weightMeasurements.MaxAsync(m => m.WeightKg, ct);
        var avgWeight = await weightMeasurements.AverageAsync(m => m.WeightKg!.Value, ct);

        var latestMeasurement = await weightMeasurements
            .OrderByDescending(m => m.MeasuredAt)
            .FirstAsync(ct);

        var thirtyDaysAgo = latestMeasurement.MeasuredAt.AddDays(-30);

        // Find the measurement closest to 30 days ago
        var oldMeasurement = await weightMeasurements
            .Where(m => m.MeasuredAt <= thirtyDaysAgo)
            .OrderByDescending(m => m.MeasuredAt)
            .FirstOrDefaultAsync(ct);

        decimal? weightChange30Days = oldMeasurement is not null
            ? latestMeasurement.WeightKg - oldMeasurement.WeightKg
            : null;

        await Send.OkAsync(new MeasurementStatsResponse
        {
            MinWeight = minWeight,
            MaxWeight = maxWeight,
            AvgWeight = Math.Round(avgWeight, 2),
            LatestWeight = latestMeasurement.WeightKg,
            WeightChange30Days = weightChange30Days,
            TotalCount = totalCount,
            TargetWeightKg = targetWeightKg
        }, ct);
    }
}
