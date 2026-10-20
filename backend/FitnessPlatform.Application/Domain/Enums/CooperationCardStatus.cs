namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Current state of the invite or request a chat cooperation card refers to.
/// </summary>
public enum CooperationCardStatus
{
    /// <summary>Still awaiting an answer.</summary>
    Pending = 0,

    /// <summary>Accepted.</summary>
    Accepted = 1,

    /// <summary>Declined (an invite) or rejected (a request).</summary>
    Declined = 2,

    /// <summary>Cancelled or withdrawn by its author.</summary>
    Cancelled = 3,

    /// <summary>An invite that stayed pending past its validity window.</summary>
    Expired = 4
}
