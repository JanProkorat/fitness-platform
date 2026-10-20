namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Lifecycle state of a <see cref="Entities.PendingInvite"/>. <see cref="Expired"/> is derived
/// on read (see <c>PendingInviteStatusResolver</c>) and is never stored.
/// </summary>
public enum PendingInviteStatus
{
    /// <summary>The invite is awaiting the recipient's answer.</summary>
    Pending = 0,

    /// <summary>The recipient accepted the invite.</summary>
    Accepted = 1,

    /// <summary>The recipient declined the invite.</summary>
    Declined = 2,

    /// <summary>The professional cancelled the invite.</summary>
    Cancelled = 3,

    /// <summary>The invite stayed pending past its validity window. Derived, never stored.</summary>
    Expired = 4
}
