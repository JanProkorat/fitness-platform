using System.Runtime.CompilerServices;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

[assembly: InternalsVisibleTo("FitnessPlatform.Tests")]

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Background service that periodically reaps stale <c>SocialLoginNonce</c> rows from
/// the database to prevent unbounded table growth.
///
/// <para><b>Deletion predicate (honours the audit grace window):</b></para>
/// <list type="bullet">
///   <item>Expired unconsumed nonces: <c>ExpiresAt &lt; now</c></item>
///   <item>Consumed nonces past the grace window: <c>ConsumedAt &lt; now - grace</c></item>
/// </list>
/// <para>Still-valid unconsumed nonces and recently-consumed nonces within the grace
/// window are never deleted.</para>
///
/// <para><b>Configuration keys (with defaults):</b></para>
/// <list type="bullet">
///   <item><c>Auth:NonceReapIntervalMinutes</c> — how often the sweep runs (default: 60)</item>
///   <item><c>Auth:NonceConsumedGraceHours</c> — how long to retain consumed nonces after
///     consumption for audit purposes (default: 1)</item>
/// </list>
/// </summary>
public class SocialLoginNonceReaperService(
    IServiceScopeFactory scopeFactory,
    ILogger<SocialLoginNonceReaperService> logger,
    IConfiguration configuration) : BackgroundService
{
    /// <summary>
    /// Default sweep interval in minutes. Override via <c>Auth:NonceReapIntervalMinutes</c>
    /// in configuration (primarily for tests that need deterministic ticks).
    /// </summary>
    internal const int DefaultReapIntervalMinutes = 60;

    /// <summary>
    /// Default grace window in hours for consumed nonces. Override via
    /// <c>Auth:NonceConsumedGraceHours</c> in configuration.
    /// </summary>
    internal const int DefaultConsumedGraceHours = 1;

    // Exposed for unit/integration tests — drive the sweeper with a virtual clock.
    internal DateTime? OverrideNow { get; set; }

    private TimeSpan ReapInterval =>
        TimeSpan.FromMinutes(
            configuration.GetValue("Auth:NonceReapIntervalMinutes", DefaultReapIntervalMinutes));

    private TimeSpan ConsumedGrace =>
        TimeSpan.FromHours(
            configuration.GetValue("Auth:NonceConsumedGraceHours", DefaultConsumedGraceHours));

    /// <summary>
    /// Entry point used by tests: execute one sweep cycle treating <paramref name="now"/>
    /// as the current UTC time.
    /// </summary>
    internal async Task SweepAsync(DateTime now, CancellationToken ct = default)
    {
        var grace = ConsumedGrace;
        var consumedCutoff = now - grace;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var deleted = await db.SocialLoginNonces
            .Where(n => n.ExpiresAt < now
                        || (n.ConsumedAt != null && n.ConsumedAt < consumedCutoff))
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
        {
            logger.LogInformation(
                "SocialLoginNonceReaperService: reaped {Count} stale nonce row(s) at {Now:u}. " +
                "Predicate: ExpiresAt < {Now:u} OR (ConsumedAt < {ConsumedCutoff:u}).",
                deleted, now, now, consumedCutoff);
        }
        else
        {
            logger.LogDebug(
                "SocialLoginNonceReaperService: sweep at {Now:u} — no stale rows found.", now);
        }
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = ReapInterval;

        logger.LogInformation(
            "SocialLoginNonceReaperService: starting with interval={Interval}, consumedGrace={Grace}.",
            interval, ConsumedGrace);

        using var timer = new PeriodicTimer(interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = OverrideNow ?? DateTime.UtcNow;
            logger.LogDebug("SocialLoginNonceReaperService: tick at {Now:u}.", now);

            try
            {
                await SweepAsync(now, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex,
                    "SocialLoginNonceReaperService: unhandled error on sweep at {Now:u}.", now);
            }

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        logger.LogInformation("SocialLoginNonceReaperService: stopped.");
    }
}
