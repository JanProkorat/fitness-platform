namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// What became of one occurrence the worker tried to send.
/// </summary>
public enum AutomationSendOutcome
{
    /// <summary>Nothing was recorded: the rule is gone or disabled, or the client is no longer reachable.</summary>
    NotEligible = 0,

    /// <summary>The occurrence already has a run; nothing was sent. After a lost race the transaction is aborted and must be rolled back.</summary>
    Duplicate = 1,

    /// <summary>The request was delivered and a Sent run recorded.</summary>
    Sent = 2,

    /// <summary>A Skipped run was recorded with its reason; nothing was sent.</summary>
    Skipped = 3,

    /// <summary>A Failed run was recorded; nothing was sent.</summary>
    Failed = 4,
}
