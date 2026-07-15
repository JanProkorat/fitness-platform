namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Fixed identifiers for the platform's system/attribution accounts.
/// Distinct from the QA fixture GUID family (<c>11111111-...</c>, <c>22222222-...</c>)
/// used by <see cref="FitnessPlatform.Application.Seed.QaSeedRunner"/>.
/// </summary>
public static class SystemUsers
{
    /// <summary>
    /// Fixed <c>ApplicationUser.Id</c> for the non-loginable system admin account that owns the
    /// seeded public catalog (recipes, workout templates). Foods and exercises are deliberately
    /// left owner-less (<c>null</c>) — see the public-catalog-seeding design spec §2 for the
    /// ownership rationale.
    /// </summary>
    public static readonly Guid AdminId = Guid.Parse("aa000000-0000-0000-0000-000000000001");

    /// <summary>
    /// Email address for the system admin account. Never used to log in — the account is created
    /// with a cryptographically random password that is never logged or revealed.
    /// </summary>
    public const string AdminEmail = "system@goodfellas.local";
}
