namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Events an automation rule can fire on. Payment events are not part of this set.
/// </summary>
public enum AutomationEventType
{
    /// <summary>The client accepted the coach's invite or request.</summary>
    ClientJoined = 0,

    /// <summary>A training or meal plan starts for the client (a plan event).</summary>
    PlanStarted = 1,

    /// <summary>A training or meal plan ends for the client (a plan event).</summary>
    PlanEnded = 2,

    /// <summary>The client missed a weekly check-in.</summary>
    CheckInMissed = 3,

    /// <summary>The client has been inactive for N days (the offset is N).</summary>
    ClientInactive = 4,

    /// <summary>The client answered a form.</summary>
    FormAnswered = 5,
}
