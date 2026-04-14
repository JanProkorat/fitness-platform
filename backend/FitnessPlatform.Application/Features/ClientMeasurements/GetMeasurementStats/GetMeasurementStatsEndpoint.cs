using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurementStats;

/// <summary>
/// Returns aggregated weight statistics for the authenticated client's measurements.
/// </summary>
/// <param name="db">Database context.</param>
public class GetMeasurementStatsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<MeasurementStatsResponse>
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

        var targetWeightKg = clientProfile.OnboardingData?.TargetWeightKg;

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
