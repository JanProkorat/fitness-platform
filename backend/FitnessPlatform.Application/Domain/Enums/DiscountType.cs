namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// What a coach discount's value means.
/// </summary>
public enum DiscountType
{
    /// <summary>The value is a percentage (1-100) taken off the price.</summary>
    Percentage = 1,

    /// <summary>The value is a fixed amount taken off the price.</summary>
    FixedAmount = 2
}
