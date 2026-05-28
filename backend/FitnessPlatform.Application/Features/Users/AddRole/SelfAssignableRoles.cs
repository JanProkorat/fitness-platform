using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Users.AddRole;

/// <summary>
/// Defense-in-depth allow-list for roles that a Trainer or Nutritionist may
/// add to their own account via <c>POST /users/me/roles</c>.
/// <para>
/// This class is the single source of truth for the allow-list. Both the
/// <see cref="AddRoleValidator"/> (validator layer) and
/// <see cref="AddRoleEndpoint"/> (handler layer) reference it so that widening
/// <em>either</em> layer alone is insufficient to open an Admin self-promotion
/// path — both guards must be changed simultaneously. This mirrors the analogous
/// <c>RegisterValidator.PubliclyRegistrableRoles</c> pattern introduced in
/// issue #230 and extends it to the <c>AddRole</c> bounded context.
/// </para>
/// <para>
/// <b>Do not promote this list to <c>AppRoles.cs</c>.</b> The two allow-lists
/// are different bounded contexts: <c>PubliclyRegistrableRoles</c> governs what
/// roles exist at registration time; <c>SelfAssignableRoles</c> governs which
/// <em>already-registered</em> professionals may cross-upgrade. Merging them
/// would couple two unrelated policy points.
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
    /// Returns <see langword="true"/> if <paramref name="role"/> is a role that a
    /// Trainer or Nutritionist may self-assign via <c>POST /users/me/roles</c>.
    /// The check is case-insensitive.
    /// </summary>
    /// <param name="role">The role name to test.</param>
    public static bool Contains(string role) => Roles.Contains(role);
}
