namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Which packages a coach discount can be used with.
/// </summary>
public enum DiscountScope
{
    /// <summary>Every package of the coach.</summary>
    AllPackages = 0,

    /// <summary>Only the packages linked to the discount.</summary>
    SelectedPackages = 1,

    /// <summary>Every package that bills monthly.</summary>
    MonthlyPackages = 2
}
