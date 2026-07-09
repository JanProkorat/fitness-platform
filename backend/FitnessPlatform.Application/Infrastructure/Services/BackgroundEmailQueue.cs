using System.Runtime.CompilerServices;
using System.Threading.Channels;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Default <see cref="IBackgroundEmailQueue"/> implementation, wrapping a bounded
/// <see cref="Channel{T}"/> (#702). Registered as a singleton — see <c>Program.cs</c>.
/// </summary>
public class BackgroundEmailQueue : IBackgroundEmailQueue
{
    // Generous bounded capacity: large enough that a realistic burst of anonymous
    // resend requests never fills it (the endpoint is itself rate-limited to 10
    // requests / 15 min per IP — see AppPolicies.AuthRateLimit), small enough to bound
    // memory if the worker ever stalls. BoundedChannelFullMode is irrelevant to
    // TryWrite (it only affects the awaited WriteAsync path, which this queue never
    // uses — see IBackgroundEmailQueue.TryEnqueue).
    private const int Capacity = 1_000;

    private readonly Channel<EmailDispatchWorkItem> _channel = Channel.CreateBounded<EmailDispatchWorkItem>(
        new BoundedChannelOptions(Capacity)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
        });

    private int _pendingCount;

    /// <inheritdoc />
    public int PendingCount => Volatile.Read(ref _pendingCount);

    /// <inheritdoc />
    public bool TryEnqueue(EmailDispatchWorkItem item)
    {
        if (!_channel.Writer.TryWrite(item))
        {
            return false;
        }

        Interlocked.Increment(ref _pendingCount);
        return true;
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<EmailDispatchWorkItem> ReadAllAsync([EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var item in _channel.Reader.ReadAllAsync(ct))
        {
            yield return item;
        }
    }

    /// <inheritdoc />
    public void MarkProcessed() => Interlocked.Decrement(ref _pendingCount);
}
