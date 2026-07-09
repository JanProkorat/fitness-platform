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
    /// Streams queued items for the background worker to consume. Completes when
    /// <paramref name="ct"/> is cancelled, OR when <see cref="Complete"/> has been called
    /// and every already-buffered item has been yielded (graceful-drain path, #705) —
    /// whichever happens first.
    /// </summary>
    IAsyncEnumerable<EmailDispatchWorkItem> ReadAllAsync(CancellationToken ct);

    /// <summary>
    /// Marks one previously-enqueued item as fully processed (sent or failed). Called by
    /// the worker after each item, never by request-path code.
    /// </summary>
    void MarkProcessed();

    /// <summary>
    /// Marks the queue complete: no further items may ever be enqueued (#705, graceful
    /// shutdown drain). After this call, <see cref="TryEnqueue"/> always returns
    /// <c>false</c> — a write to a completed channel fails cleanly rather than throwing —
    /// so callers that already treat a <c>false</c> return as "log and continue" (see the
    /// anonymous resend-verification endpoint) keep working unchanged, preserving the
    /// no-enumeration contract from #679 even after shutdown has begun. Items enqueued
    /// before this call are still delivered by <see cref="ReadAllAsync"/> until drained;
    /// this only closes the door on new writes.
    /// </summary>
    void Complete();

    /// <summary>
    /// Number of items enqueued but not yet fully processed — still sitting in the
    /// channel, or dequeued and currently being sent. Test-only observability seam;
    /// production request-path code never needs to read this.
    /// </summary>
    int PendingCount { get; }
}
