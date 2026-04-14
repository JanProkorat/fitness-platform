using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;

/// <summary>
/// Response containing all published weeks of the client's active nutrition plan.
/// </summary>
public class GetFullPlanResponse
{
    /// <summary>External identifier of the nutrition plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Display name of the nutrition plan.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>The Monday when Week 1 begins, if set.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Global daily nutrition targets.</summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>Published weeks with pre-computed date ranges.</summary>
    public List<FullPlanWeek> Weeks { get; set; } = [];

    /// <summary>Number of published weeks.</summary>
    public int PublishedWeekCount { get; set; }

    /// <summary>Total number of weeks in the plan (including draft).</summary>
    public int TotalWeeks { get; set; }

    /// <summary>Current week number (null if plan is upcoming).</summary>
    public int? CurrentWeek { get; set; }

    /// <summary>Current day of week 1-7 (null if plan is upcoming).</summary>
    public int? CurrentDayOfWeek { get; set; }

    /// <summary>Plan status (Active, Completed, Archived).</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>Linked questionnaire response public ID, if any.</summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>When this plan was marked as completed, if applicable.</summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>
    /// Set of meal IDs that the client has logged as eaten.
    /// Meal IDs are unique across the plan, so a flat set covers all days.
    /// </summary>
    public HashSet<Guid> EatenMealIds { get; set; } = [];
}

/// <summary>
/// A published week with pre-computed start/end dates.
/// </summary>
public class FullPlanWeek
{
    /// <summary>1-based week number.</summary>
    public int WeekNumber { get; set; }

    /// <summary>ISO date string for the Monday this week starts.</summary>
    public string WeekStartDate { get; set; } = string.Empty;

    /// <summary>ISO date string for the Sunday this week ends.</summary>
    public string WeekEndDate { get; set; } = string.Empty;

    /// <summary>Days in this week.</summary>
    public List<PlanDay> Days { get; set; } = [];
}
