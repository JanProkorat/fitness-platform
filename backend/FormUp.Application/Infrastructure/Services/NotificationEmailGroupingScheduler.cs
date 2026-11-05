using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// Background worker that sends grouped notification emails. Each tick it claims the bursts that have fallen
/// due, one committed transaction per burst, so stopping the host only cancels the loop and a half-handled
/// burst is claimed again later.
/// </summary>
/// <param name="scopeFactory">Opens a scope per burst.</param>
/// <param name="timeProvider">Clock.</param>
/// <param name="configuration">Configuration; <c>NotificationEmailGroupingTickIntervalSeconds</c> sets the tick.</param>
/// <param name="logger">Logger.</param>
public class NotificationEmailGroupingScheduler(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IConfiguration configuration,
    ILogger<NotificationEmailGroupingScheduler> logger) : BackgroundService
{
    /// <summary>Default tick interval in seconds.</summary>
    internal const int DefaultTickIntervalSeconds = 60;

    private const int MaxClaimsPerTick = 500;

    /// <summary>
    /// Sends every burst that is due right now. The hosted loop calls this every tick; tests call it directly
    /// instead of waiting for <see cref="ExecuteAsync"/>, which the host may never start.
    /// </summary>
    /// <param name="nowUtc">The instant to run as; null reads the clock.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task RunDueNowAsync(DateTime? nowUtc = null, CancellationToken ct = default)
    {
        var now = DateTime.SpecifyKind(nowUtc ?? timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Utc);

        try
        {
            for (var claimed = 0; claimed < MaxClaimsPerTick; claimed++)
            {
                using var scope = scopeFactory.CreateScope();

                if (!await scope.ServiceProvider.GetRequiredService<NotificationEmailGroupProcessor>().ProcessNextAsync(now, ct))
                {
                    return;
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // An escaped exception would fault ExecuteAsync and stop the host; the next tick tries again.
            logger.LogError(ex, "NotificationEmailGroupingScheduler: the tick failed.");
        }
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(
            configuration.GetValue("NotificationEmailGroupingTickIntervalSeconds", DefaultTickIntervalSeconds)));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunDueNowAsync(null, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // The host is stopping.
        }
    }
}
