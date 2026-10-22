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
    /// The currency of a fixed amount; null for a percentage discount.
    /// </summary>
    public PaymentCurrency? Currency { get; set; }

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
    /// Which packages the discount can be used with; <see cref="Packages"/> lists them for
    /// <see cref="DiscountScope.SelectedPackages"/>.
    /// </summary>
    public DiscountScope Scope { get; set; } = DiscountScope.AllPackages;

    /// <summary>
    /// When the discount was archived (UTC); null while it is active.
    /// </summary>
    public DateTime? ArchivedAt { get; set; }

    /// <summary>
    /// Navigation property to the owning professional.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// The packages the discount is limited to; empty unless <see cref="Scope"/> is <see cref="DiscountScope.SelectedPackages"/>.
    /// </summary>
    public ICollection<CoachDiscountPackage> Packages { get; set; } = [];
}
