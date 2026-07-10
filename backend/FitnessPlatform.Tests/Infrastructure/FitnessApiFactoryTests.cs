using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Smoke tests for <see cref="FitnessApiFactory"/> configuration correctness.
/// </summary>
[Collection(TestCollection.Name)]
public class FitnessApiFactoryTests(FitnessApiFactory factory)
{
    /// <summary>
    /// Verifies that the <see cref="PhotoDiaryReminderScheduler"/> singleton is still
    /// resolvable from DI in the test host.
    /// Tests that drive the scheduler directly via TickAsync must be able to call
    /// factory.Services.GetRequiredService&lt;PhotoDiaryReminderScheduler&gt;().
    /// </summary>
    [Fact]
    public void PhotoDiaryReminderScheduler_IsStillResolvableAsSingleton()
    {
        var scheduler = factory.Services.GetRequiredService<PhotoDiaryReminderScheduler>();

        scheduler.Should().NotBeNull(
            "the singleton must remain resolvable so tests can drive TickAsync directly");
    }

    /// <summary>
    /// Verifies that the <see cref="WeeklyCheckInScheduler"/> singleton is still
    /// resolvable from DI in the test host after the per-candidate-scope refactor (#280).
    /// Tests that drive the scheduler directly via TickAsync must be able to call
    /// factory.Services.GetRequiredService&lt;WeeklyCheckInScheduler&gt;().
    /// </summary>
    [Fact]
    public void WeeklyCheckInScheduler_IsStillResolvableAsSingleton()
    {
        var scheduler = factory.Services.GetRequiredService<WeeklyCheckInScheduler>();

        scheduler.Should().NotBeNull(
            "the singleton must remain resolvable so tests can drive TickAsync directly");
    }

    /// <summary>
    /// Root-cause regression test for #726: the four long-running background
    /// schedulers/worker must never appear in the resolved <see cref="IHostedService"/>
    /// set for a Testcontainers-backed test host, or their zombie timers can tick
    /// against a disposed container after their own collection tears down (see
    /// <see cref="TestHostedServiceExtensions"/> for the full explanation).
    /// </summary>
    [Fact]
    public void BackgroundHostedServices_AreNotRegistered_InTestHost()
    {
        var hostedServiceTypes = factory.Services.GetServices<IHostedService>()
            .Select(s => s.GetType())
            .ToList();

        hostedServiceTypes.Should().NotContain(typeof(WeeklyCheckInScheduler),
            "the scheduler's BackgroundService loop must not auto-start in a test host");
        hostedServiceTypes.Should().NotContain(typeof(PhotoDiaryReminderScheduler),
            "the scheduler's BackgroundService loop must not auto-start in a test host");
        hostedServiceTypes.Should().NotContain(typeof(SocialLoginNonceReaperService),
            "the reaper's BackgroundService loop must not auto-start in a test host");
        hostedServiceTypes.Should().NotContain(typeof(EmailDispatchWorker),
            "the worker's BackgroundService loop must not auto-start in a test host — it races FakeEmailService's shared static store");
    }

    /// <summary>
    /// <see cref="MongoIndexInitializer"/> must remain a registered
    /// <see cref="IHostedService"/> — unlike the four background loops above, it is
    /// a one-shot startup task (not a <see cref="BackgroundService"/>) and several
    /// integration tests depend on the indexes it creates (e.g. the partial unique
    /// index exercised by WorkoutLogCompletionUniquenessTests).
    /// </summary>
    [Fact]
    public void MongoIndexInitializer_IsStillRegistered_InTestHost()
    {
        var hostedServiceTypes = factory.Services.GetServices<IHostedService>()
            .Select(s => s.GetType())
            .ToList();

        hostedServiceTypes.Should().Contain(typeof(MongoIndexInitializer),
            "index creation must still run at test-host startup — it is a one-shot task, not a recurring background loop");
    }
}
