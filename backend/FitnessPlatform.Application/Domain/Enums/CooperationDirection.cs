namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Whether the caller sent or received a cooperation proposal.
/// </summary>
public enum CooperationDirection
{
    /// <summary>The caller sent it.</summary>
    Sent = 0,

    /// <summary>The caller received it.</summary>
    Received = 1
}
