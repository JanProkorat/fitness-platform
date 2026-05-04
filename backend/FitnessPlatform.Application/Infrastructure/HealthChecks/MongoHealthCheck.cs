using Microsoft.Extensions.Diagnostics.HealthChecks;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.HealthChecks;

public sealed class MongoHealthCheck(IMongoDatabase database) : IHealthCheck
{
    private static readonly BsonDocument PingCommand = new("ping", 1);

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await database.RunCommandAsync<BsonDocument>(PingCommand, cancellationToken: cancellationToken);
            return HealthCheckResult.Healthy("mongodb reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("mongodb unreachable", ex);
        }
    }
}
