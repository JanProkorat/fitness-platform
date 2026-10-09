namespace FitnessPlatform.Application.Features.Users.KeepCoachAccount;

/// <summary>
/// Outcome of undoing a pending coach-account disable.
/// </summary>
public class KeepCoachAccountResponse
{
    /// <summary>The pending end date after the undo; always null because the disable is cleared.</summary>
    public DateTime? CoachAccountActiveUntil { get; set; }
}
