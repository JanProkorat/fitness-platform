namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// A single background email-send work item (#702). Carries only value-copied data —
/// never a request-scoped service or the originating HTTP request's
/// <see cref="CancellationToken"/> — so the background worker can safely process it well
/// after the request that enqueued it has already completed.
/// </summary>
/// <param name="Email">Recipient email address.</param>
/// <param name="Token">The already-persisted verification token value to send.</param>
/// <param name="Language">Two-letter language code (en, cs, de) for the email template.</param>
public record EmailDispatchWorkItem(string Email, string Token, string Language);

/// <summary>
/// Bounded, in-process fire-and-forget queue for outbound verification emails (#702).
/// Introduced to close the timing-enumeration oracle on the anonymous
/// resend-verification endpoint: only the branch that actually sends an email used to
/// await the SMTP round-trip in the request path, creating a load-dependent latency
/// delta the other (no-op) branches never paid. Enqueuing here is always non-blocking.
/// </summary>
public interface IBackgroundEmailQueue
{
    /// <summary>
    /// Attempts to enqueue a work item without blocking. Returns <c>false</c> if the
    /// bounded channel is already full — callers MUST log and continue in that case.
    /// Never fall back to an awaited write on a full channel: that would only add
    /// latency on the send branch, reintroducing exactly the timing oracle this queue
    /// exists to remove.
    /// </summary>
    bool TryEnqueue(EmailDispatchWorkItem item);

    /// <summary>
    /// Streams queued items for the background worker to consume. Completes only when
    /// <paramref name="ct"/> (the worker's own stopping token) is cancelled.
    /// </summary>
    IAsyncEnumerable<EmailDispatchWorkItem> ReadAllAsync(CancellationToken ct);

    /// <summary>
    /// Marks one previously-enqueued item as fully processed (sent or failed). Called by
    /// the worker after each item, never by request-path code.
    /// </summary>
    void MarkProcessed();

    /// <summary>
    /// Number of items enqueued but not yet fully processed — still sitting in the
    /// channel, or dequeued and currently being sent. Test-only observability seam;
    /// production request-path code never needs to read this.
    /// </summary>
    int PendingCount { get; }
}
