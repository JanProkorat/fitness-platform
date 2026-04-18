using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Thread-safe fake implementation of <see cref="IRealtimeNotifier"/> for integration tests.
/// Records all <c>NotifyAsync</c> calls so tests can assert on event names, recipients, and payloads.
/// </summary>
public class FakeRealtimeNotifier : IRealtimeNotifier
{
    private readonly List<NotifyCall> _calls = [];
    private readonly Lock _lock = new();

    /// <summary>
    /// Returns a snapshot of all recorded <c>NotifyAsync</c> invocations.
    /// </summary>
    public IReadOnlyList<NotifyCall> Calls
    {
        get
        {
            lock (_lock) return _calls.ToList();
        }
    }

    /// <inheritdoc />
    public Task NotifyAsync(Guid userId, string eventType, object payload, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _calls.Add(new NotifyCall(userId, eventType, payload));
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Clears all recorded calls. Call between tests if the notifier is shared.
    /// </summary>
    public void Reset()
    {
        lock (_lock) _calls.Clear();
    }

    /// <summary>
    /// A single recorded invocation of <c>NotifyAsync</c>.
    /// </summary>
    public record NotifyCall(Guid UserId, string EventType, object Payload);
}
