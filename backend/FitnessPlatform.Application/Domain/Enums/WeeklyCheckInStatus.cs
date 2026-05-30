namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// The lifecycle status of a weekly check-in instance.
/// </summary>
public enum WeeklyCheckInStatus
{
    /// <summary>
    /// Scheduler dispatched; client has not responded or dismissed yet.
    /// The default state for all newly created check-ins.
    /// </summary>
    Pending,

    /// <summary>
    /// Client submitted a response (flags and/or note). Corresponds to RespondedAt IS NOT NULL.
    /// </summary>
    Responded,

    /// <summary>
    /// Client dismissed this check-in for the week. Corresponds to DismissedByClientAt IS NOT NULL.
    /// </summary>
    Dismissed,

    /// <summary>
    /// Trainer marked this check-in as reviewed. Corresponds to ReviewedByTrainerAt IS NOT NULL.
    /// </summary>
    Reviewed,

    /// <summary>
    /// DueAt has passed while the check-in was still Pending. The sweeper transitions rows here.
    /// Terminal state — client can no longer respond or dismiss.
    /// </summary>
    Expired
}
