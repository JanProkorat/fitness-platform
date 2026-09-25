namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Bounded, in-process fire-and-forget queue for outbound emails (#702, #1109).
/// Introduced to close the timing-enumeration oracle on the anonymous
/// resend-verification endpoint: only the branch that actually sends an email used to
/// await the SMTP round-trip in the request path, creating a load-dependent latency
/// delta the other (no-op) branches never paid. Enqueuing here is always non-blocking.
///
/// <para>
/// Extended in #1109 to also carry client-invitation sends (<see cref="InvitationEmailWorkItem"/>)
/// alongside verification sends (<see cref="VerificationEmailWorkItem"/>) — see
/// <see cref="EmailDispatchWorkItem"/> for the shared base type both queue through.
/// </para>
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
    ///
    /// <para>
    /// Idempotent (#866): the shutdown path closes the queue from two places — the worker's
    /// <c>StopAsync</c> override and its <c>stoppingToken</c> registration, whichever runs
    /// first — so a second call must be a no-op rather than throwing.
    /// </para>
    /// </summary>
    void Complete();

    /// <summary>
    /// Number of items enqueued but not yet fully processed — still sitting in the
    /// channel, or dequeued and currently being sent. Test-only observability seam;
    /// production request-path code never needs to read this.
    /// </summary>
    int PendingCount { get; }
}
