namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Why a package, with an optional discount, cannot be given to a client.
/// </summary>
public enum PackageTermsFailure
{
    /// <summary>The package and discount can be used.</summary>
    None,

    /// <summary>The coach's subscription does not include payments.</summary>
    NotEntitled,

    /// <summary>The package is unknown or belongs to another coach.</summary>
    PackageNotFound,

    /// <summary>The package is archived.</summary>
    PackageArchived,

    /// <summary>The discount is unknown or belongs to another coach.</summary>
    DiscountNotFound,

    /// <summary>The discount is archived.</summary>
    DiscountArchived,

    /// <summary>The discount's scope does not cover the package.</summary>
    DiscountPackageInvalid,

    /// <summary>A fixed discount is in another currency than the package.</summary>
    CurrencyMismatch
}
