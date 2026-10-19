namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// The result of one claim attempt.
/// </summary>
/// <param name="State">How the attempt ended.</param>
/// <param name="ScheduleId">Internal id of the claimed row; 0 when <see cref="AutomationClaimState.Idle"/>.</param>
public readonly record struct AutomationClaimResult(AutomationClaimState State, long ScheduleId);
