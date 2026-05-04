using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FitnessPlatform.Application.Infrastructure.HealthChecks;

public sealed class PostgresHealthCheck(IServiceScopeFactory scopeFactory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("postgres reachable")
                : HealthCheckResult.Unhealthy("postgres CanConnect returned false");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("postgres unreachable", ex);
        }
    }
}
