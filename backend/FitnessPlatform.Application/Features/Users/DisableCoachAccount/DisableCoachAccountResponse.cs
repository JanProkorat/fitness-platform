namespace FitnessPlatform.Application.Features.Users.DisableCoachAccount;

/// <summary>
/// Outcome of disabling the caller's coach account.
/// </summary>
public class DisableCoachAccountResponse
{
    /// <summary>When the coach account stops being active (UTC). At or before now means it already ended.</summary>
    public DateTime ActiveUntil { get; set; }

    /// <summary>Coach roles removed by this call; empty while the disable is only pending.</summary>
    public List<string> RolesRemoved { get; set; } = [];
}
