namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// How an attempt to claim and run one due schedule row ended.
/// </summary>
public enum AutomationClaimState
{
    /// <summary>No row was due, or every due row is held by another worker.</summary>
    Idle = 0,

    /// <summary>A row was run and its transaction committed.</summary>
    Done = 1,

    /// <summary>Running the row threw; its transaction rolled back and it is still due.</summary>
    Failed = 2,

    /// <summary>Another worker already recorded an occurrence of the row; its transaction rolled back and it is still due.</summary>
    Duplicate = 3,
}
