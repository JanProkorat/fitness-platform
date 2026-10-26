using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A paid offer a coach sells to clients (name, price and billing rhythm).
/// </summary>
public class CoachPackage : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the owning <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Display name of the package.
    /// </summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>
    /// What the package includes, shown to the coach only; null for none.
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// The current price per billing period. Earlier prices live in <see cref="Prices"/>.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// The currency of <see cref="Price"/> and of every earlier price.
    /// </summary>
    public PaymentCurrency Currency { get; set; } = PaymentCurrency.CZK;

    /// <summary>
    /// How often the package is billed.
    /// </summary>
    public PackageBillingInterval Billing { get; set; } = PackageBillingInterval.Monthly;

    /// <summary>
    /// Weeks between payments; set only when <see cref="Billing"/> is <see cref="PackageBillingInterval.EveryNWeeks"/>.
    /// </summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>
    /// Number of payments the package runs for; null means until cancelled. Never set for one-off packages.
    /// </summary>
    public int? RunsForPayments { get; set; }

    /// <summary>
    /// Days after issue that a payment falls due, overriding the coach's payment settings; null uses the default.
    /// </summary>
    public int? PaymentDueDaysOverride { get; set; }

    /// <summary>
    /// Whether the package price is shown on the coach's public profile.
    /// </summary>
    public bool ShowOnProfile { get; set; } = true;

    /// <summary>
    /// When the package was archived (UTC); null while it is active.
    /// </summary>
    public DateTime? ArchivedAt { get; set; }

    /// <summary>
    /// Navigation property to the owning professional.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// Price history, one row on creation and one per later price change.
    /// </summary>
    public ICollection<CoachPackagePrice> Prices { get; set; } = [];
}
