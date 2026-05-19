using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Smoke tests for <see cref="FitnessApiFactory"/> configuration correctness.
/// These are the "would have caught the QA regression" tests that verify the
/// hosted-service descriptor removal predicate actually works against the
/// factory-registered shape used in Program.cs lines 199-200.
/// </summary>
[Collection(TestCollection.Name)]
public class FitnessApiFactoryTests(FitnessApiFactory factory)
{
    /// <summary>
    /// Verifies that the <see cref="PhotoDiaryReminderScheduler"/> is NOT exposed as
    /// an <see cref="IHostedService"/> in the test host.
    ///
    /// Regression guard for the factory-registered descriptor shape:
    ///   AddHostedService(sp => sp.GetRequiredService&lt;PhotoDiaryReminderScheduler&gt;())
    /// produces a ServiceDescriptor with ImplementationType == null (ImplementationFactory != null),
    /// so a predicate that only checks ImplementationType is a no-op and the scheduler
    /// continues to run autonomously, racing the clock on the :00 boundary in CI.
    /// </summary>
    [Fact]
    public void PhotoDiaryReminderScheduler_IsNotRegisteredAsHostedService()
    {
        var hostedServices = factory.Services.GetServices<IHostedService>();

        hostedServices
            .Should().NotContain(
                s => s is PhotoDiaryReminderScheduler,
                "the scheduler must be removed from IHostedService registrations " +
                "so it cannot race the real clock during integration tests");
    }

    /// <summary>
    /// Verifies that the <see cref="PhotoDiaryReminderScheduler"/> singleton is still
    /// resolvable from DI after the IHostedService descriptor is removed.
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
}
