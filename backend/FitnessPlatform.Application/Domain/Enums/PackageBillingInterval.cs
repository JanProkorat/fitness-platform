namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How often a coach package is billed.
/// </summary>
public enum PackageBillingInterval
{
    /// <summary>Billed once per calendar month.</summary>
    Monthly = 1,

    /// <summary>Billed every N weeks (N is the package's interval weeks).</summary>
    EveryNWeeks = 2,

    /// <summary>Billed once.</summary>
    OneOff = 3
}
