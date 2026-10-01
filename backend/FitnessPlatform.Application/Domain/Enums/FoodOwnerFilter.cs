namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Scopes a food search to a subset of owners — backs the Ingredients page's "Owner" filter
/// pill. Selecting several values ORs them together; none selected applies no owner filter.
/// </summary>
public enum FoodOwnerFilter
{
    /// <summary>Foods owned by the calling nutritionist, regardless of visibility.</summary>
    Mine,

    /// <summary>Foods with no owning nutritionist — platform/system catalog entries.</summary>
    System,

    /// <summary>Public foods owned by a different nutritionist.</summary>
    OtherCoaches
}
