using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Links a <see cref="CoachDiscount"/> to one package it applies to.
/// </summary>
public class CoachDiscountPackage : BaseEntity
{
    /// <summary>
    /// Foreign key to the <see cref="CoachDiscount"/>.
    /// </summary>
    public long CoachDiscountId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="CoachPackage"/>.
    /// </summary>
    public long CoachPackageId { get; set; }

    /// <summary>
    /// Navigation property to the discount.
    /// </summary>
    public CoachDiscount CoachDiscount { get; set; } = null!;

    /// <summary>
    /// Navigation property to the package.
    /// </summary>
    public CoachPackage CoachPackage { get; set; } = null!;
}
