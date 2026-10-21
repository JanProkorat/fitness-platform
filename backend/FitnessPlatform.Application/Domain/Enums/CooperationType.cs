namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Which kind of cooperation proposal a conversation carries.
/// </summary>
public enum CooperationType
{
    /// <summary>A professional invited the client.</summary>
    Invite = 0,

    /// <summary>A client asked to join the professional.</summary>
    Request = 1
}
