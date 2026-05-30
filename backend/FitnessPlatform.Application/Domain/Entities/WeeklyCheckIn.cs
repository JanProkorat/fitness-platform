using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents one weekly check-in lifecycle — from scheduler dispatch through client response
/// to trainer review.
/// One row per (ClientUserId, ProfessionalUserId, Profession, WeekStartDate) — enforced by unique index.
/// </summary>
public class WeeklyCheckIn
{
    /// <summary>
    /// The lifecycle status of this check-in.
    /// <para>
    /// <see cref="WeeklyCheckInStatus.Pending"/> is the default for newly created rows.
    /// Audit timestamp columns (<see cref="RespondedAt"/>, <see cref="DismissedByClientAt"/>,
    /// <see cref="ReviewedByTrainerAt"/>, <see cref="ExpiredAt"/>) remain the source of truth
    /// for the "when". <see cref="Status"/> is the queryable single-column filter.
    /// </para>
    /// </summary>
    public WeeklyCheckInStatus Status { get; set; } = WeeklyCheckInStatus.Pending;

    /// <summary>
    /// UTC deadline by which the client must respond before the row transitions to
    /// <see cref="WeeklyCheckInStatus.Expired"/>.
    /// Set by the scheduler at check-in creation time as <c>SentAt + effectiveOffset</c>.
    /// Null for rows created before this feature was added (sweeper will leave them as-is
    /// until their DueAt is backfilled).
    /// </summary>
    public DateTime? DueAt { get; set; }

    /// <summary>
    /// UTC timestamp when the sweeper transitioned this check-in to
    /// <see cref="WeeklyCheckInStatus.Expired"/>. Null until expired.
    /// </summary>
    public DateTime? ExpiredAt { get; set; }
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// The client who receives this check-in.
    /// Foreign key → <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid ClientUserId { get; set; }

    /// <summary>
    /// The professional (trainer or nutritionist) who owns this check-in.
    /// Foreign key → <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>
    /// The professional capacity this check-in applies to (Training or Nutrition).
    /// </summary>
    public Profession Profession { get; set; }

    /// <summary>
    /// ISO-week Monday of the week being planned. Always a Monday.
    /// </summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>
    /// Flags selected by the client when responding. Stored as a jsonb array of strings.
    /// Empty list = no flags selected (valid response).
    /// </summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>
    /// Optional free-text note from the client. ≤ 500 characters.
    /// </summary>
    [MaxLength(500)]
    public string? Note { get; set; }

    /// <summary>UTC timestamp when the scheduler sent this check-in.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>UTC timestamp when the client submitted a response. Null until responded.</summary>
    public DateTime? RespondedAt { get; set; }

    /// <summary>UTC timestamp when the client dismissed this check-in for the week. Null until dismissed.</summary>
    public DateTime? DismissedByClientAt { get; set; }

    /// <summary>UTC timestamp when the professional marked this check-in as reviewed. Null until reviewed.</summary>
    public DateTime? ReviewedByTrainerAt { get; set; }

    /// <summary>UTC timestamp of row creation.</summary>
    public DateTime DateCreated { get; set; }

    /// <summary>UTC timestamp of last modification.</summary>
    public DateTime DateModified { get; set; }

    /// <summary>Navigation property to the client user.</summary>
    public ApplicationUser ClientUser { get; set; } = null!;

    /// <summary>Navigation property to the professional user.</summary>
    public ApplicationUser ProfessionalUser { get; set; } = null!;
}
