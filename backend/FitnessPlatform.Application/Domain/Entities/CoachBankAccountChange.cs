using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One change of a coach's bank account, with the data needed to undo it from the emailed link.
/// </summary>
public class CoachBankAccountChange : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the owning <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// IBAN before the change. Null when this was the first account set.
    /// </summary>
    [MaxLength(34)]
    public string? PreviousIban { get; set; }

    /// <summary>
    /// Account holder before the change. Null when this was the first account set.
    /// </summary>
    [MaxLength(140)]
    public string? PreviousAccountHolder { get; set; }

    /// <summary>
    /// IBAN the change set.
    /// </summary>
    [MaxLength(34)]
    public string NewIban { get; set; } = string.Empty;

    /// <summary>
    /// Account holder the change set.
    /// </summary>
    [MaxLength(140)]
    public string NewAccountHolder { get; set; } = string.Empty;

    /// <summary>
    /// SHA-256 hex hash of the undo token. Null when there is nothing to undo to.
    /// </summary>
    [MaxLength(64)]
    public string? UndoTokenHash { get; set; }

    /// <summary>
    /// When the undo link stops working (UTC).
    /// </summary>
    public DateTime? UndoExpiresAt { get; set; }

    /// <summary>
    /// When the change was undone (UTC). Null while the undo link is unused.
    /// </summary>
    public DateTime? UndoneAt { get; set; }

    /// <summary>
    /// Navigation property to the owning professional.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
