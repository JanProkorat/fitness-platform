using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A discount a coach can apply to payments for some or all of their packages.
/// </summary>
public class CoachDiscount : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the owning <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Display name of the discount.
    /// </summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>
    /// Whether <see cref="Value"/> is a percentage or a fixed amount.
    /// </summary>
    public DiscountType Type { get; set; }

    /// <summary>
    /// The percentage (1-100) or the fixed amount taken off the price.
    /// </summary>
    public decimal Value { get; set; }

    /// <summary>
    /// How many payments the discount applies to.
    /// </summary>
    public DiscountDuration Duration { get; set; } = DiscountDuration.EveryPayment;

    /// <summary>
    /// Number of payments covered; set only when <see cref="Duration"/> is <see cref="DiscountDuration.FirstPayments"/>.
    /// </summary>
    public int? DurationPayments { get; set; }

    /// <summary>
    /// First payment due date the discount applies to (inclusive); null means no start limit.
    /// </summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>
    /// Last payment due date the discount applies to (inclusive); null means open-ended.
    /// </summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>
    /// Whether the discount applies to every package; when false <see cref="Packages"/> lists them.
    /// </summary>
    public bool AppliesToAllPackages { get; set; }

    /// <summary>
    /// When the discount was archived (UTC); null while it is active.
    /// </summary>
    public DateTime? ArchivedAt { get; set; }

    /// <summary>
    /// Navigation property to the owning professional.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// The packages the discount is limited to; empty when <see cref="AppliesToAllPackages"/> is true.
    /// </summary>
    public ICollection<CoachDiscountPackage> Packages { get; set; } = [];
}
