namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Sort direction for a <see cref="FoodSortField"/>. Named to avoid ambiguity with
/// <c>MongoDB.Driver.SortDirection</c>, which is in scope wherever Mongo sort builders are used.
/// </summary>
public enum FoodSortDirection
{
    /// <summary>Lowest/earliest first.</summary>
    Ascending,

    /// <summary>Highest/latest first.</summary>
    Descending
}
