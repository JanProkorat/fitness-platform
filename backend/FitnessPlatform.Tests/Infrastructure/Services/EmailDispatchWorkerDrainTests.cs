using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Unit tests for <see cref="EmailDispatchWorker"/>'s graceful-drain behavior on shutdown
/// (#705). The worker is constructed directly against a real <see cref="BackgroundEmailQueue"/>
/// and a minimal <see cref="IServiceScopeFactory"/> that resolves <see cref="FakeEmailService"/>
/// — no Docker/Testcontainers needed, since none of this touches Postgres or Mongo. Driving
/// the worker through its public <see cref="Microsoft.Extensions.Hosting.BackgroundService.StartAsync"/>
/// / <see cref="Microsoft.Extensions.Hosting.BackgroundService.StopAsync"/> lifecycle (rather
/// than calling a test-only method) exercises the exact shutdown path the host uses in
/// production: <c>StopAsync</c> cancels the worker's <c>stoppingToken</c> and then awaits its
/// <c>ExecuteAsync</c> task, so it does not return until the drain this issue introduces has
/// actually completed — no fixed <c>Task.Delay</c> sleep required for determinism.
/// </summary>
public class EmailDispatchWorkerDrainTests
{
    /// <summary>
    /// Builds a minimal DI container for the worker plus the <see cref="FakeEmailService"/>
    /// instance it will resolve. <see cref="FakeEmailService"/> is registered as a singleton
    /// (not scoped) so the worker's scope-per-item resolution (see
    /// <see cref="EmailDispatchWorker"/>'s remarks) always lands on the SAME instance this
    /// method hands back to the test — a per-instance store only works if every consumer
    /// shares one instance (#726 refinement; see <see cref="FakeEmailService"/>'s remarks
    /// for why the store moved off `static` fields).
    /// </summary>
    private static (IServiceScopeFactory ScopeFactory, FakeEmailService EmailService) BuildScopeFactory()
    {
        var services = new ServiceCollection();
        services.AddSingleton<FakeEmailService>();
        services.AddSingleton<IEmailService>(sp => sp.GetRequiredService<FakeEmailService>());
        var provider = services.BuildServiceProvider();
        return (provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<FakeEmailService>());
    }

    [Fact]
    public async Task StopAsync_DrainsAllBufferedItems_BeforeReturning()
    {
        var (scopeFactory, emailService) = BuildScopeFactory();

        var queue = new BackgroundEmailQueue();
        var worker = new EmailDispatchWorker(queue, scopeFactory, NullLogger<EmailDispatchWorker>.Instance);

        const int itemCount = 25;
        var runId = Guid.NewGuid().ToString("N");
        string Email(int i) => $"{runId}-{i}@drain-test.com";

        for (var i = 0; i < itemCount; i++)
        {
            queue.TryEnqueue(new EmailDispatchWorkItem(Email(i), $"token-{i}", "en")).Should().BeTrue(
                "enqueueing before shutdown begins must always succeed while capacity remains");
        }

        await worker.StartAsync(TestContext.Current.CancellationToken);

        // Trigger shutdown right away -- the worker has likely not drained everything on
        // its own yet. StopAsync must not return until ExecuteAsync's drain loop has
        // finished processing every buffered item (see the worker's Complete()-on-shutdown
        // registration), so no separate wait/poll is needed here.
        await worker.StopAsync(TestContext.Current.CancellationToken);

        emailService.SentVerifications.Count(v => v.Email.StartsWith(runId, StringComparison.Ordinal))
            .Should().Be(itemCount, "every item buffered before shutdown must be sent during the drain, not dropped");

        queue.PendingCount.Should().Be(0, "MarkProcessed must run for every drained item, including those processed during shutdown");
    }

    /// <summary>
    /// Regression test for #866. <see cref="BackgroundService.StartAsync"/> does not invoke
    /// <c>ExecuteAsync</c> inline — it schedules it as
    /// <c>Task.Run(() =&gt; ExecuteAsync(_stoppingCts.Token), _stoppingCts.Token)</c>, where
    /// <c>_stoppingCts</c> is linked to the token handed to <c>StartAsync</c>. When that token is
    /// cancelled before the thread pool dequeues the work item, <c>Task.Run</c> discards the
    /// delegate outright: <c>ExecuteAsync</c> never runs, so neither the drain loop nor its
    /// <c>Complete()</c> registration (nor any <c>catch</c>/<c>finally</c> placed inside it)
    /// can save the buffered items. Handing <c>StartAsync</c> an already-cancelled token
    /// reproduces that exact state deterministically, with no reliance on thread-pool timing —
    /// which is what made the original report look like a test-ordering flake.
    /// </summary>
    [Fact]
    public async Task StopAsync_DrainsBufferedItems_WhenExecuteAsyncNeverRan()
    {
        var (scopeFactory, emailService) = BuildScopeFactory();

        var queue = new BackgroundEmailQueue();
        var worker = new EmailDispatchWorker(queue, scopeFactory, NullLogger<EmailDispatchWorker>.Instance);

        const int itemCount = 25;
        var runId = Guid.NewGuid().ToString("N");

        for (var i = 0; i < itemCount; i++)
        {
            queue.TryEnqueue(new EmailDispatchWorkItem($"{runId}-{i}@drain-test.com", $"token-{i}", "en")).Should().BeTrue(
                "enqueueing before shutdown begins must always succeed while capacity remains");
        }

        using var alreadyCancelled = new CancellationTokenSource();
        await alreadyCancelled.CancelAsync();

        await worker.StartAsync(alreadyCancelled.Token);

        // Canary, not incidental detail: this is the precondition the whole test rests on. If a
        // future framework version goes back to running ExecuteAsync inline, this assertion fails
        // and tells the reader to re-derive the scenario rather than silently testing nothing.
        worker.ExecuteTask?.Status.Should().Be(TaskStatus.Canceled,
            "the scenario under test is a shutdown that beats the thread pool to the ExecuteAsync delegate");

        await worker.StopAsync(CancellationToken.None);

        emailService.SentVerifications.Count(v => v.Email.StartsWith(runId, StringComparison.Ordinal))
            .Should().Be(itemCount, "the shutdown drain must not depend on ExecuteAsync having been entered");

        queue.PendingCount.Should().Be(0, "MarkProcessed must run for every item the shutdown drain sends");
    }

    [Fact]
    public async Task StopAsync_WithNoBufferedItems_ReturnsPromptly()
    {
        var queue = new BackgroundEmailQueue();
        var (scopeFactory, _) = BuildScopeFactory();
        var worker = new EmailDispatchWorker(queue, scopeFactory, NullLogger<EmailDispatchWorker>.Instance);

        await worker.StartAsync(TestContext.Current.CancellationToken);
        await worker.StopAsync(TestContext.Current.CancellationToken);

        queue.PendingCount.Should().Be(0, "an empty queue drains trivially -- nothing left pending after shutdown");
    }

    [Fact]
    public void TryEnqueue_AfterComplete_ReturnsFalse_NeverThrows()
    {
        var queue = new BackgroundEmailQueue();

        queue.Complete();

        var act = () => queue.TryEnqueue(new EmailDispatchWorkItem("late@drain-test.com", "token", "en"));

        act.Should().NotThrow(
            "a write to a completed channel must fail cleanly so the caller's existing false-return handling (log + generic 200) keeps working");
        act().Should().BeFalse("no new item may be accepted once the queue has been marked complete");
    }
}
