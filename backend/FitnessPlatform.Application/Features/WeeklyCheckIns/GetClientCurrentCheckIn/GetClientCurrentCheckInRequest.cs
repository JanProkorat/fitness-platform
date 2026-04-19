namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCurrentCheckIn;

/// <summary>
/// Request for GET /trainer/clients/{clientUserId}/weekly-check-ins/current.
/// </summary>
public class GetClientCurrentCheckInRequest
{
    /// <summary>Client's ApplicationUser.Id (route parameter).</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>
    /// Profession to filter by ("Training" or "Nutrition"). Optional.
    /// When omitted, returns check-ins for all professions.
    /// </summary>
    public string? Profession { get; set; }
}
