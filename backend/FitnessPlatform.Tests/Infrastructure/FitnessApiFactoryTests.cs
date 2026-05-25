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
}
