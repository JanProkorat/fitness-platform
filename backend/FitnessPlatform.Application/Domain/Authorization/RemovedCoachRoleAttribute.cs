using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Authorization;

/// <summary>
/// Declares how a single-discipline write endpoint behaves after the caller removed that coach role.
/// Read by <c>RemovedCoachRolePreProcessor</c>; an unannotated write fails closed as <see cref="RemovedCoachRoleMode.Refuse"/>.
/// </summary>
/// <param name="role">The endpoint's single coach role (Trainer or Nutritionist).</param>
/// <param name="mode">Behaviour once that role is removed.</param>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class RemovedCoachRoleAttribute(string role, RemovedCoachRoleMode mode) : Attribute
{
    /// <summary>The coach role the endpoint is gated to.</summary>
    public string Role { get; } = role;

    /// <summary>Behaviour once the role is removed.</summary>
    public RemovedCoachRoleMode Mode { get; } = mode;

    /// <summary>Why the endpoint is exempt; required for <see cref="RemovedCoachRoleMode.Exempt"/>.</summary>
    public string? Reason { get; init; }
}
