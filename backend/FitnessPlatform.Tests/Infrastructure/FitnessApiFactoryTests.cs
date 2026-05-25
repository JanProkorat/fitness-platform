using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

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
}
