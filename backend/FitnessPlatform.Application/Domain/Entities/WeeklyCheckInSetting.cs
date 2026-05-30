using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Per-professional default configuration for weekly check-in reminders.
/// One row per (professional user, profession) pair.
/// </summary>
public class WeeklyCheckInSetting
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// The professional (trainer or nutritionist) who owns this setting.
    /// Foreign key → <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The professional capacity this setting applies to (Training or Nutrition).
    /// </summary>
    public Profession Profession { get; set; }

    /// <summary>
    /// Day of the week on which the reminder fires.
    /// </summary>
    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>
    /// Hour-aligned local time of day when the reminder fires.
    /// Minutes, Seconds, and Milliseconds must be zero (enforced at API layer).
    /// </summary>
    public TimeSpan TimeOfDay { get; set; }

    /// <summary>
    /// Whether this reminder is enabled.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Optional addendum appended to the default reminder message. ≤ 200 characters.
    /// </summary>
    [MaxLength(200)]
    public string? DefaultAddendum { get; set; }

    /// <summary>
    /// Number of hours after <see cref="WeeklyCheckIn.SentAt"/> before the check-in expires.
    /// The scheduler stamps <see cref="WeeklyCheckIn.DueAt"/> = SentAt + this offset at creation time.
    /// Default is 72 hours (3 days).
    /// Per-client overrides can be set via <see cref="WeeklyCheckInClientOverride.DeadlineOffsetHours"/>.
    /// </summary>
    public int DeadlineOffsetHours { get; set; } = 72;

    /// <summary>UTC timestamp of row creation.</summary>
    public DateTime DateCreated { get; set; }

    /// <summary>UTC timestamp of last modification.</summary>
    public DateTime DateModified { get; set; }

    /// <summary>Navigation property to the professional user.</summary>
    public ApplicationUser User { get; set; } = null!;
}
