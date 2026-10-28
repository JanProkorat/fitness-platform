namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Outcome of activating the client-professional link for an accepted invite.
/// </summary>
public enum ClientLinkActivationOutcome
{
    /// <summary>No link existed for the pair; a new one was added.</summary>
    Created,

    /// <summary>An ended link existed for the pair and was switched back on with the invite's terms.</summary>
    Reactivated,

    /// <summary>The link is already active and the invite adds nothing; nothing was changed.</summary>
    AlreadyActive,

    /// <summary>The link is already active and the invite widened it with a plan type it did not cover yet.</summary>
    Extended,

    /// <summary>The coach role the invite grants was removed, so no link may be granted.</summary>
    CoachRoleRemoved,

    /// <summary>Another active professional holds the profession slot the link would occupy.</summary>
    SlotTaken,
}
