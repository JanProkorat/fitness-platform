using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One entry in a package's price history: the price that applies to billing periods starting at or after
/// <see cref="EffectiveFromUtc"/>.
/// </summary>
public class CoachPackagePrice : BaseEntity
{
    /// <summary>
    /// Foreign key to the <see cref="CoachPackage"/>.
    /// </summary>
    public long CoachPackageId { get; set; }

    /// <summary>
    /// The price per billing period.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// When the price takes effect (UTC).
    /// </summary>
    public DateTime EffectiveFromUtc { get; set; }

    /// <summary>
    /// Navigation property to the package.
    /// </summary>
    public CoachPackage CoachPackage { get; set; } = null!;
}
