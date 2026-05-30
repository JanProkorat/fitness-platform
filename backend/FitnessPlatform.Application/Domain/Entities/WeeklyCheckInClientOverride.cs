using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Per-client override of a professional's weekly check-in setting.
/// Nullable fields mean "inherit from the professional's default setting".
/// One row per (client user, professional user, profession) triple.
/// </summary>
public class WeeklyCheckInClientOverride
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// The client whose reminders are being tuned.
    /// Foreign key → <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid ClientUserId { get; set; }

    /// <summary>
    /// The professional who owns this override.
    /// Foreign key → <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>
    /// The professional capacity this override applies to (Training or Nutrition).
    /// </summary>
    public Profession Profession { get; set; }

    /// <summary>
    /// Override day of week. Null = inherit from the professional's setting.
    /// </summary>
    public DayOfWeek? DayOfWeek { get; set; }

    /// <summary>
    /// Override time of day (hour-aligned). Null = inherit from the professional's setting.
    /// </summary>
    public TimeSpan? TimeOfDay { get; set; }

    /// <summary>
    /// Override enabled flag. Null = inherit from the professional's setting.
    /// </summary>
    public bool? Enabled { get; set; }

    /// <summary>
    /// Override addendum. When set, replaces <see cref="WeeklyCheckInSetting.DefaultAddendum"/> for this client. ≤ 200 characters.
    /// </summary>
    [MaxLength(200)]
    public string? Addendum { get; set; }

    /// <summary>
    /// Override deadline offset in hours. Null = inherit from
    /// <see cref="WeeklyCheckInSetting.DeadlineOffsetHours"/>.
    /// When set, replaces the professional's default for this specific client.
    /// </summary>
    public int? DeadlineOffsetHours { get; set; }

    /// <summary>UTC timestamp of row creation.</summary>
    public DateTime DateCreated { get; set; }

    /// <summary>UTC timestamp of last modification.</summary>
    public DateTime DateModified { get; set; }

    /// <summary>Navigation property to the client user.</summary>
    public ApplicationUser ClientUser { get; set; } = null!;

    /// <summary>Navigation property to the professional user.</summary>
    public ApplicationUser ProfessionalUser { get; set; } = null!;
}
