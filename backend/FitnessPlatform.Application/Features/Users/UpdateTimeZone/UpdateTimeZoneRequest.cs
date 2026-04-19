namespace FitnessPlatform.Application.Features.Users.UpdateTimeZone;

/// <summary>
/// Request model for updating the authenticated user's time zone.
/// </summary>
public class UpdateTimeZoneRequest
{
    /// <summary>
    /// IANA time zone identifier (e.g. "Europe/Prague", "America/New_York").
    /// </summary>
    public string TimeZone { get; set; } = string.Empty;
}
