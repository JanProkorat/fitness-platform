using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One entry in a client's terms history: the package, and the discount or custom price, that apply to
/// billing periods starting at or after <see cref="EffectiveFromUtc"/>.
/// </summary>
public class ClientPaymentTerms : BaseEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientPaymentAssignment"/>.
    /// </summary>
    public long ClientPaymentAssignmentId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="CoachPackage"/> the client pays for.
    /// </summary>
    public long CoachPackageId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="CoachDiscount"/> applied to the package price; null for none.
    /// Never set together with <see cref="CustomPrice"/>.
    /// </summary>
    public long? CoachDiscountId { get; set; }

    /// <summary>
    /// A price replacing the package price and any discount for this client only; null for none.
    /// </summary>
    public decimal? CustomPrice { get; set; }

    /// <summary>
    /// When the terms take effect (UTC).
    /// </summary>
    public DateTime EffectiveFromUtc { get; set; }

    /// <summary>
    /// When the collaboration ended and the terms stopped applying (UTC); null while they are open-ended.
    /// </summary>
    public DateTime? EndsAtUtc { get; set; }

    /// <summary>
    /// Navigation property to the assignment.
    /// </summary>
    public ClientPaymentAssignment ClientPaymentAssignment { get; set; } = null!;

    /// <summary>
    /// Navigation property to the package.
    /// </summary>
    public CoachPackage CoachPackage { get; set; } = null!;

    /// <summary>
    /// Navigation property to the discount.
    /// </summary>
    public CoachDiscount? CoachDiscount { get; set; }
}
