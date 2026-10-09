using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Users.Shared;

/// <summary>
/// Defense-in-depth allow-list for roles a Trainer or Nutritionist may manage on their own
/// account via <c>/users/me/roles</c> (add and remove).
/// <para>
/// Both the validators and the handlers reference this list so that widening <em>either</em>
/// layer alone cannot open an Admin self-promotion path (#308). It is deliberately separate from
/// <c>RegisterValidator.PubliclyRegistrableRoles</c> and must not be promoted to <c>AppRoles</c>.
/// </para>
/// </summary>
internal static class SelfAssignableRoles
{
    private static readonly HashSet<string> Roles = new(StringComparer.OrdinalIgnoreCase)
    {
        AppRoles.Trainer,
        AppRoles.Nutritionist,
    };

    /// <summary>
    /// Returns <see langword="true"/> if <paramref name="role"/> may be self-managed. Case-insensitive.
    /// </summary>
    /// <param name="role">The role name to test.</param>
    public static bool Contains(string role) => Roles.Contains(role);
}
