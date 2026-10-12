using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Authorization;

/// <summary>
/// Declares how a coach write endpoint behaves once the caller's coach role is removed. The role form covers a
/// single-discipline endpoint; the role-less form covers an endpoint gated to both coach roles and applies when
/// the caller has no active coach role left. Read by <c>RemovedCoachRoleMiddleware</c>; an unannotated write
/// fails closed as <see cref="RemovedCoachRoleMode.Refuse"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class RemovedCoachRoleAttribute : Attribute
{
    /// <summary>Single-discipline form: the endpoint's coach role (Trainer or Nutritionist).</summary>
    /// <param name="role">The endpoint's single coach role.</param>
    /// <param name="mode">Behaviour once that role is removed.</param>
    public RemovedCoachRoleAttribute(string role, RemovedCoachRoleMode mode)
    {
        Role = role;
        Mode = mode;
    }

    /// <summary>Role-less form for dual-discipline endpoints: Refuse or Exempt only.</summary>
    /// <param name="mode">Behaviour once the caller has no active coach role.</param>
    public RemovedCoachRoleAttribute(RemovedCoachRoleMode mode)
    {
        if (mode == RemovedCoachRoleMode.WhilePlanInProgress)
        {
            throw new ArgumentException("The role-less form supports only Refuse or Exempt.", nameof(mode));
        }

        Mode = mode;
    }

    /// <summary>The coach role the endpoint is gated to; null for the role-less (any coach role) form.</summary>
    public string? Role { get; }

    /// <summary>Behaviour once the role is removed.</summary>
    public RemovedCoachRoleMode Mode { get; }

    /// <summary>Why the endpoint is exempt; required for <see cref="RemovedCoachRoleMode.Exempt"/>.</summary>
    public string? Reason { get; init; }
}
