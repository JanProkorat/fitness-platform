using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;

/// <summary>
/// Response with today's planned training session.
/// </summary>
public class GetTodaySessionResponse
{
    /// <summary>Whether there is a session planned for today.</summary>
    public bool HasSession { get; set; }

    /// <summary>The training plan's public ID.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>The plan name.</summary>
    public string? PlanName { get; set; }

    /// <summary>Today's session, if any.</summary>
    public TrainingSession? Session { get; set; }

    /// <summary>Current week number in the plan cycle.</summary>
    public int? CurrentWeek { get; set; }

    /// <summary>Total number of weeks in the plan.</summary>
    public int? TotalWeeks { get; set; }
}
