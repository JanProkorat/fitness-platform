using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Gracefully stops every registered <see cref="IHostedService"/> (schedulers,
/// background workers) on a test <c>WebApplicationFactory</c> WITHOUT disposing the
/// underlying <see cref="IServiceProvider"/>.
/// </summary>
/// <remarks>
/// Root cause (#726): <c>FitnessApiFactory</c> / <c>RateLimitEnabledFactory</c> /
/// <c>ResetEndpointFactoryBase</c> all deliberately skip <c>base.DisposeAsync()</c> to
/// keep FastEndpoints' process-global <c>ServiceResolver.Provider</c> alive (#296) — but
/// that also means the ASP.NET host itself, and every <see cref="IHostedService"/>
/// registered on it (<c>WeeklyCheckInScheduler</c>, <c>PhotoDiaryReminderScheduler</c>,
/// <c>SocialLoginNonceReaperService</c>, <c>EmailDispatchWorker</c>), is NEVER STOPPED.
/// Those hosted services keep running on the ThreadPool for the rest of the test
/// process, entirely independent of xUnit's own test-collection serialization
/// (<c>DisableTestParallelization</c>/<c>MaxParallelThreads</c> only govern when xUnit
/// dispatches the next test method — they do nothing to already-running ambient
/// BackgroundService continuations left behind by an earlier, "disposed" factory):
/// <list type="bullet">
/// <item>Schedulers eventually tick against the factory's own Postgres/Mongo
/// Testcontainers, which by then have already been torn down by the rest of
/// <c>DisposeAsync</c> — throwing <c>InvalidOperationException: Could not find resource
/// 'PostgreSqlContainer'</c> from a background thread, minutes after the owning test
/// collection finished.</item>
/// <item><c>EmailDispatchWorker</c> keeps draining (and writing to the shared static
/// <c>FakeEmailService</c> store) at an unpredictable later wall-clock time — the root
/// cause of the <c>EmailDispatchWorkerDrainTests</c> flake (expects 25 sends, finds 0
/// under full-suite load: an unrelated, still-live zombie worker's drain interleaves
/// with the currently-executing test's own read of that same static state).</item>
/// </list>
/// Calling <see cref="IHostedService.StopAsync"/> directly (inherited from
/// <c>BackgroundService</c>) cancels each service's internal stopping token and awaits
/// its <c>ExecuteAsync</c> task — the same graceful-shutdown path a real host shutdown
/// would trigger — without touching the <see cref="IServiceProvider"/> itself, so the
/// #296 workaround stays intact.
/// </remarks>
public static class TestHostedServiceShutdown
{
    /// <summary>
    /// Stops every <see cref="IHostedService"/> resolvable from <paramref name="services"/>.
    /// Best-effort per service: a service that fails or times out while stopping must
    /// never block the Testcontainers cleanup that follows this call.
    /// </summary>
    public static async Task StopAllAsync(IServiceProvider services, TimeSpan? timeout = null)
    {
        using var cts = new CancellationTokenSource(timeout ?? TimeSpan.FromSeconds(5));

        foreach (var hostedService in services.GetServices<IHostedService>())
        {
            try
            {
                await hostedService.StopAsync(cts.Token);
            }
            catch (Exception)
            {
                // Best-effort: proceed to the next hosted service / the container
                // cleanup regardless of an individual StopAsync failure.
            }
        }
    }
}
