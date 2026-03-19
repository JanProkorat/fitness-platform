namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Gym membership or gym access availability.
/// </summary>
public enum GymAccess
{
    /// <summary>
    /// Has a gym membership and attends regularly.
    /// </summary>
    Yes,

    /// <summary>
    /// Has occasional or limited access to a gym.
    /// </summary>
    Sometimes,

    /// <summary>
    /// No gym access; trains at home or outdoors only.
    /// </summary>
    No
}
