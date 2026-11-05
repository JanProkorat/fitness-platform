using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Services;
using FormUp.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// <see cref="EmailDispatchWorker"/> with coach notification emails: they are sent, and a provider failure
/// is logged by user id only and does not stop the items behind it.
/// </summary>
public class EmailDispatchWorkerNotificationTests
{
    private sealed class CapturingLogger : ILogger<EmailDispatchWorker>
    {
        public List<string> Errors { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Error)
            {
                Errors.Add(formatter(state, exception));
            }
        }
    }

    private static NotificationEmailWorkItem Item(Guid userId, string email) => new(
        email, "en", userId, NotificationEvent.WorkoutFinished,
        new Dictionary<string, string> { [NotificationEmailWorkItem.ClientNameKey] = "Petra" });

    [Fact]
    public async Task Drain_ProviderFailsForOneItem_LogsTheUserIdOnlyAndStillSendsTheNext()
    {
        var services = new ServiceCollection();
        services.AddSingleton<FakeEmailService>();
        services.AddSingleton<IEmailService>(sp => sp.GetRequiredService<FakeEmailService>());
        using var provider = services.BuildServiceProvider();
        var emailService = provider.GetRequiredService<FakeEmailService>();

        var failingUser = Guid.NewGuid();
        var healthyUser = Guid.NewGuid();
        var failingEmail = $"{Guid.NewGuid():N}@failing-notification.com";
        emailService.FailNotificationsFor(failingUser);

        var queue = new BackgroundEmailQueue();
        var logger = new CapturingLogger();
        var worker = new EmailDispatchWorker(queue, provider.GetRequiredService<IServiceScopeFactory>(), logger);
        queue.TryEnqueue(Item(failingUser, failingEmail)).Should().BeTrue();
        queue.TryEnqueue(Item(healthyUser, $"{Guid.NewGuid():N}@healthy-notification.com")).Should().BeTrue();

        await worker.StartAsync(TestContext.Current.CancellationToken);
        await worker.StopAsync(TestContext.Current.CancellationToken);

        emailService.SentNotifications.Should().ContainSingle(sent => sent.UserId == healthyUser);
        emailService.SentNotifications.Should().NotContain(sent => sent.UserId == failingUser);
        queue.PendingCount.Should().Be(0);
        logger.Errors.Should().ContainSingle()
            .Which.Should().Contain(failingUser.ToString()).And.NotContain(failingEmail);
    }
}
