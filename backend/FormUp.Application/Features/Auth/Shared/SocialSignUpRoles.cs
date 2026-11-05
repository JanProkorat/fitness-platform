using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.Auth.Shared;

/// <summary>
/// Roles a brand-new Google or Apple account may ask for, and how a request's role list is read.
/// <see cref="UserRole.Admin"/> is never self-assignable.
/// </summary>
public static class SocialSignUpRoles
{
    /// <summary>Message returned when a requested role is not self-assignable.</summary>
    public const string InvalidRoleMessage = "Role must be one of: Trainer, Nutritionist, Client.";

    /// <summary>Message returned when Client is combined with a coach role.</summary>
    public const string ClientCoachMixMessage = "Cannot combine Client role with Trainer or Nutritionist.";

    /// <summary>Message returned when a coach sign-up sends a health-data consent.</summary>
    public const string CoachHealthDataConsentMessage = "Health data consent applies to client accounts only.";

    /// <summary>Message returned when a new client account does not grant health-data consent.</summary>
    public const string HealthDataConsentRequiredMessage = "Health data consent is required to create a client account.";

    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(UserRole.Trainer),
        nameof(UserRole.Nutritionist),
        nameof(UserRole.Client),
    };

    /// <summary>Whether the role name is one a new social account may ask for.</summary>
    /// <param name="role">Requested role name, any casing.</param>
    public static bool IsAllowed(string? role) => role is not null && Allowed.Contains(role);

    /// <summary>Whether the list mixes Client with Trainer or Nutritionist.</summary>
    /// <param name="roles">Requested role names, any casing.</param>
    public static bool MixesClientWithCoach(IEnumerable<string>? roles)
    {
        if (roles is null)
        {
            return false;
        }

        var requested = roles.ToList();

        return requested.Contains(nameof(UserRole.Client), StringComparer.OrdinalIgnoreCase)
            && requested.Any(IsCoach);
    }

    /// <summary>
    /// Canonical role names to provision. An empty or absent list means Client.
    /// Roles outside the allowlist are dropped even if no validator ran.
    /// </summary>
    /// <param name="roles">Requested role names, any casing.</param>
    public static List<string> Resolve(IEnumerable<string>? roles)
    {
        var resolved = (roles ?? [])
            .Where(IsAllowed)
            .Select(role => Enum.Parse<UserRole>(role, ignoreCase: true).ToString())
            .Distinct()
            .ToList();

        return resolved.Count == 0 ? [nameof(UserRole.Client)] : resolved;
    }

    /// <summary>Whether the canonical role list contains a coach role.</summary>
    /// <param name="roles">Canonical role names from <see cref="Resolve"/>.</param>
    public static bool HasCoachRole(IEnumerable<string> roles) => roles.Any(IsCoach);

    private static bool IsCoach(string role) =>
        string.Equals(role, nameof(UserRole.Trainer), StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, nameof(UserRole.Nutritionist), StringComparison.OrdinalIgnoreCase);
}
