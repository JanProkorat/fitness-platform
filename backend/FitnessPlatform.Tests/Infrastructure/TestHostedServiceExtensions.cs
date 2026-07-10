using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Test-only helper that prevents the app's long-running, DB-touching background
/// <see cref="BackgroundService"/> schedulers/reaper from ever starting inside a
/// <c>WebApplicationFactory&lt;Program&gt;</c> test host.
///
/// Root cause (#726): six factories (<see cref="FitnessApiFactory"/> and its
/// siblings) intentionally skip <c>base.DisposeAsync()</c> at teardown — see the
/// #296 comment in <see cref="FitnessApiFactory"/> — to keep FastEndpoints'
/// process-global <c>ServiceResolver.Provider</c> alive for concurrently running
/// standalone (no-collection) tests. That means the generic <c>IHost</c> itself,
/// and every <see cref="BackgroundService"/> registered on it
/// (<see cref="WeeklyCheckInScheduler"/>, <see cref="PhotoDiaryReminderScheduler"/>,
/// <see cref="SocialLoginNonceReaperService"/>), is left running for the
/// remaining lifetime of the test process — only their Testcontainers are
/// disposed at collection teardown. Because
/// <c>[assembly: CollectionBehavior(MaxParallelThreads = 1)]</c>
/// (see <c>TestAssemblyConfig.cs</c>) serializes collections rather than running
/// them concurrently, a long CI run gives these zombie timers enough elapsed
/// wall-clock time to fire a tick *after* their own collection's containers are
/// gone, throwing from a background thread
/// (<c>InvalidOperationException: Could not find resource 'PostgreSqlContainer'</c>).
/// With the default <c>BackgroundServiceExceptionBehavior=StopHost</c>, that
/// unhandled exception tears down the host that raised it, cascading failures
/// into whatever unrelated collection happens to be running at that moment.
///
/// The fix: never start these three DB-touching services in a test host at all.
/// None of the integration-test suite exercises their autonomous scheduling
/// behavior via the hosted-service pipeline — the scheduling/reaping logic
/// itself is covered by dedicated tests that resolve the singleton directly
/// (<c>Services.GetRequiredService&lt;WeeklyCheckInScheduler&gt;()</c>, etc. — see
/// <c>FitnessApiFactoryTests</c>) and drive its tick method by hand. Removing the
/// <see cref="IHostedService"/> registration only stops the background loop from
/// auto-starting; the underlying singleton registration
/// (<c>AddSingleton&lt;WeeklyCheckInScheduler&gt;()</c>, etc.) is left untouched,
/// so those direct-resolution tests are unaffected.
///
/// <see cref="EmailDispatchWorker"/> is intentionally NOT included in the
/// removal set (superseding an earlier #726 attempt that removed it too — CI
/// proved that over-broad: <c>AnonymousResendVerificationEndpointTests</c>
/// depends on this worker draining its fire-and-forget queue inside the shared
/// test host, since the endpoint enqueues the send and returns before it lands).
/// Unlike the three schedulers above, it never touches Postgres/Mongo — its only
/// dependency is <see cref="Domain.Interfaces.IEmailService"/> (<c>FakeEmailService</c>
/// in tests), so a zombie instance ticking after its host's Testcontainers are
/// gone cannot throw the <c>ObjectDisposedException</c>/container-not-found
/// cascade this class exists to prevent. The residual risk it does carry — a
/// zombie worker from one disposed factory racing another factory's assertions
/// against a shared store — is closed by giving <c>FakeEmailService</c> a
/// per-host singleton instance instead of a process-global static store (see
/// <c>FakeEmailService</c>'s remarks).
///
/// <see cref="MongoIndexInitializer"/> is intentionally NOT included in the
/// removal set either. It is a one-shot <see cref="IHostedService"/> (not a
/// <see cref="BackgroundService"/>) whose <c>StartAsync</c> runs to completion
/// during host startup — the generic host awaits it before the host is
/// considered started, so it can never "keep running" and tick against a
/// disposed container later. It is also a hard dependency for tests asserting
/// Mongo index/uniqueness behavior (e.g. the partial unique index
/// <c>WorkoutLogCompletionUniquenessTests</c> exercises) — removing it would
/// silently break those tests without addressing the flake.
/// </summary>
public static class TestHostedServiceExtensions
{
    private static readonly Type[] BackgroundServiceTypes =
    [
        typeof(WeeklyCheckInScheduler),
        typeof(PhotoDiaryReminderScheduler),
        typeof(SocialLoginNonceReaperService),
    ];

    /// <summary>
    /// Removes the <see cref="IHostedService"/> registrations for the app's
    /// long-running background schedulers/worker so they never start in a test
    /// host. Call this from each Testcontainers-backed factory's
    /// <c>ConfigureWebHost</c> → <c>ConfigureServices</c> callback.
    /// </summary>
    public static IServiceCollection RemoveBackgroundHostedServices(this IServiceCollection services)
    {
        var toRemove = services
            .Where(d => d.ServiceType == typeof(IHostedService))
            .Where(d => BackgroundServiceTypes.Contains(GetRegisteredImplementationType(d)))
            .ToList();

        foreach (var descriptor in toRemove)
            services.Remove(descriptor);

        return services;
    }

    /// <summary>
    /// Resolves the concrete implementation type a <see cref="ServiceDescriptor"/>
    /// will produce, regardless of which of the three registration shapes
    /// <c>AddHostedService</c> was called with in Program.cs:
    ///
    /// - <c>AddHostedService&lt;T&gt;()</c> → <c>ImplementationType == typeof(T)</c>.
    /// - <c>AddHostedService(sp => sp.GetRequiredService&lt;T&gt;())</c> (used for all
    ///   four schedulers/worker here, so the singleton stays independently
    ///   resolvable) → <c>ImplementationFactory</c> is set and
    ///   <c>ImplementationType</c> is null; the compiler infers the factory's
    ///   generic type argument <c>T</c> from the lambda's return expression, so
    ///   <c>ImplementationFactory.Method.ReturnType == typeof(T)</c>.
    /// - An already-constructed instance (rare) → <c>ImplementationInstance</c>.
    /// </summary>
    private static Type? GetRegisteredImplementationType(ServiceDescriptor descriptor)
    {
        if (descriptor.ImplementationType is not null)
            return descriptor.ImplementationType;

        if (descriptor.ImplementationInstance is not null)
            return descriptor.ImplementationInstance.GetType();

        return descriptor.ImplementationFactory?.Method.ReturnType;
    }
}
