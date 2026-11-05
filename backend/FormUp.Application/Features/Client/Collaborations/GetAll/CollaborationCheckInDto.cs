using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.Client.Collaborations.GetAll;

/// <summary>
/// The weekday a professional's weekly check-in reaches this client.
/// </summary>
public class CollaborationCheckInDto
{
    /// <summary>Training or Nutrition.</summary>
    public Profession Profession { get; set; }

    /// <summary>Day of the week the check-in is sent, after any per-client override.</summary>
    public DayOfWeek DayOfWeek { get; set; }
}
