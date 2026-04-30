using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Thread-safe fake implementation of <see cref="IPushNotificationService"/> for integration tests.
/// Records all <c>SendAsync</c> calls so tests can assert on recipients and payloads.
/// Optionally throws on the next call to simulate push-service outages.
/// </summary>
public class FakePushNotificationService : IPushNotificationService
{
    private readonly List<PushCall> _calls = [];
    private readonly Lock _lock = new();
    private bool _throwOnNextCall;

    /// <summary>
    /// Returns a snapshot of all recorded <c>SendAsync</c> invocations.
    /// </summary>
    public IReadOnlyList<PushCall> Calls
    {
        get
        {
            lock (_lock) return _calls.ToList();
        }
    }

    /// <inheritdoc />
    public Task SendAsync(Guid userId, string title, string body, object? data = null, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (_throwOnNextCall)
            {
                _throwOnNextCall = false;
                throw new InvalidOperationException("push service unavailable (simulated)");
            }

            _calls.Add(new PushCall(userId, title, body, data));
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Clears all recorded calls. Call between tests if the service is shared.
    /// </summary>
    public void Reset()
    {
        lock (_lock)
        {
            _calls.Clear();
            _throwOnNextCall = false;
        }
    }

    /// <summary>
    /// Configures the service to throw <see cref="InvalidOperationException"/> on the next
    /// <c>SendAsync</c> call. Use in tests that verify push failures are non-fatal.
    /// After the single throw the service returns to normal recording behaviour.
    /// </summary>
    public void SimulateThrowOnNextCall()
    {
        lock (_lock) _throwOnNextCall = true;
    }

    /// <summary>A single recorded invocation of <c>SendAsync</c>.</summary>
    public record PushCall(Guid UserId, string Title, string Body, object? Data);
}
