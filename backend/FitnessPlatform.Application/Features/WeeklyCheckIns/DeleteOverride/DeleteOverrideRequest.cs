namespace FitnessPlatform.Application.Features.WeeklyCheckIns.DeleteOverride;

/// <summary>
/// Request model for DELETE /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}.
/// Route parameters identify the override to remove.
/// </summary>
public class DeleteOverrideRequest
{
    /// <summary>The client's ApplicationUser.Id (route parameter).</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Profession ("Training" or "Nutrition") (route parameter).</summary>
    public string Profession { get; set; } = string.Empty;
}
