namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Idempotency log for the <c>PhotoDiaryReminderScheduler</c>.
/// One row per (DiaryRequestId, ClientLocalDate) — enforced by a unique index.
/// The scheduler inserts this row before emitting any side-effects; a duplicate
/// <c>INSERT</c> (Postgres error 23505) means the reminder was already sent for
/// that calendar day, so the tick is silently skipped.
/// </summary>
public class PhotoDiaryReminderLog
{
    /// <summary>Primary key.</summary>
    public long Id { get; set; }

    /// <summary>FK to <see cref="PhotoDiaryRequest"/>.</summary>
    public Guid DiaryRequestId { get; set; }

    /// <summary>
    /// The client-local calendar date for which the reminder was emitted.
    /// Formatted as a <see cref="DateOnly"/> so TZ conversions are done in
    /// application code before insertion.
    /// </summary>
    public DateOnly ClientLocalDate { get; set; }

    /// <summary>UTC timestamp of row insertion.</summary>
    public DateTime SentAt { get; set; }

    // ── Navigation ────────────────────────────────────────────────────────────

    /// <summary>Navigation to the diary request.</summary>
    public PhotoDiaryRequest DiaryRequest { get; set; } = null!;
}
