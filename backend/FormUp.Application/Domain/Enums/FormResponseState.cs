namespace FormUp.Application.Domain.Enums;

/// <summary>
/// How a form shows to the coach: sent but not answered, answered, or a check-in whose deadline passed.
/// </summary>
public enum FormResponseState
{
    /// <summary>Sent to the client, not answered yet.</summary>
    Waiting = 0,

    /// <summary>The client submitted it.</summary>
    Answered = 1,

    /// <summary>A check-in that was never answered and is past its deadline.</summary>
    Missed = 2,
}
