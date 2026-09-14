namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Currencies the platform's subscription billing supports. Deliberately not backed by a
/// NuGet ISO-4217 package — the platform only ever bills in these three, so a closed
/// allowlist is simpler and has no external dependency to track (#595).
/// </summary>
public static class SupportedCurrencies
{
    /// <summary>Czech koruna.</summary>
    public const string Czk = "CZK";

    /// <summary>Euro.</summary>
    public const string Eur = "EUR";

    /// <summary>US dollar.</summary>
    public const string Usd = "USD";

    /// <summary>
    /// All currencies the platform accepts for subscription billing.
    /// </summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Czk,
        Eur,
        Usd,
    };
}
