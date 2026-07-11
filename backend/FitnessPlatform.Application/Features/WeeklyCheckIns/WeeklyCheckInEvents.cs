namespace FitnessPlatform.Application.Features.WeeklyCheckIns;

// ── Payload classes for weekly-check-in lifecycle SignalR events ───────────
//
// Routing summary:
//   weeklyCheckInRequested → client group (identified by clientUserId)
//
// Groups are per-user: each user has their own SignalR group named by userId.ToString().

/// <summary>
/// Payload for the <c>weeklycheckinrequested</c> SignalR event.
/// Emitted to the <b>client</b> when <see cref="Infrastructure.Services.WeeklyCheckInScheduler"/>
/// fires a new weekly check-in. Mirrors the <c>photodiaryrequested</c> event pattern
/// (see <see cref="PhotoDiaryRequests.PhotoDiaryRequestedEvent"/>) so the mobile app can
/// present a foreground local-notification banner and invalidate the current-check-ins
/// query without a manual refetch. Emitted additively alongside the existing generic
/// <c>newnotification</c> broadcast — it does not replace it.
/// </summary>
public class WeeklyCheckInRequestedEvent
{
    /// <summary>Public identifier of the newly-created weekly check-in.</summary>
    public Guid WeeklyCheckInId { get; init; }

    /// <summary>The profession the check-in is scoped to (e.g. "Training", "Nutrition").</summary>
    public string Profession { get; init; } = string.Empty;

    /// <summary>Display name of the professional requesting the check-in.</summary>
    public string ProfessionalName { get; init; } = string.Empty;
}
