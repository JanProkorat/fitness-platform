namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Payload for the <c>sessioneditlockchanged</c> SignalR event broadcast whenever
/// a session lock is acquired (state = Editing/Live) or released (state = Stable).
/// Emitted to BOTH the client and the trainer user-id groups for the affected plan.
/// </summary>
/// <param name="PlanId">The plan the session belongs to.</param>
/// <param name="SessionId">The locked/unlocked session.</param>
/// <param name="State">The new state: <c>Editing</c>, <c>Live</c>, or <c>Stable</c>.</param>
/// <param name="Holder">Who holds (or held) the lock: <c>Coach</c> or <c>Client</c>.</param>
public record SessionLockChangedPayload(
    Guid PlanId,
    Guid SessionId,
    string State,
    string Holder);
