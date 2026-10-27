namespace FitnessPlatform.Application.Features.ClientNutrition.GetWeekMealLog;

/// <summary>
/// The meal log of one plan week: eaten state and photos per meal per day.
/// </summary>
public class GetWeekMealLogResponse
{
    /// <summary>Public id of the client's active plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>1-based week number within the plan.</summary>
    public int WeekNumber { get; set; }

    /// <summary>First day (Monday) of the week.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>Last day (Sunday) of the week.</summary>
    public DateOnly WeekEndDate { get; set; }

    /// <summary>The client-local today.</summary>
    public DateOnly Today { get; set; }

    /// <summary>The seven days of the week in date order.</summary>
    public List<GetWeekMealLogDayDto> Days { get; set; } = [];
}

/// <summary>
/// One calendar day of the week.
/// </summary>
public class GetWeekMealLogDayDto
{
    /// <summary>The calendar date.</summary>
    public DateOnly Date { get; set; }

    /// <summary>Whether photos may be added to this day (the date is not after the client-local today).</summary>
    public bool CanAddPhotos { get; set; }

    /// <summary>Meals that have a log row on this day. Meals without a row are absent.</summary>
    public List<GetWeekMealLogMealDto> Meals { get; set; } = [];
}

/// <summary>
/// The merged log state of one meal on one day.
/// </summary>
public class GetWeekMealLogMealDto
{
    /// <summary>Id of the plan meal.</summary>
    public Guid MealId { get; set; }

    /// <summary>True when any row for the meal and day is marked eaten.</summary>
    public bool Eaten { get; set; }

    /// <summary>Earliest eaten instant (UTC) across the rows, when eaten.</summary>
    public DateTime? EatenAt { get; set; }

    /// <summary>Diary note on the meal, when present.</summary>
    public string? Note { get; set; }

    /// <summary>Photos attached to the meal on this day, unioned across rows.</summary>
    public List<GetWeekMealLogPhotoDto> Photos { get; set; } = [];
}

/// <summary>
/// A meal photo.
/// </summary>
public class GetWeekMealLogPhotoDto
{
    /// <summary>Canonical stored blob URL — echo it back to the save-photos endpoint.</summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>Short-lived signed URL for rendering the photo.</summary>
    public string DisplayUrl { get; set; } = string.Empty;

    /// <summary>When the photo was saved (UTC).</summary>
    public DateTime UploadedAt { get; set; }

    /// <summary>Per-photo caption, when present.</summary>
    public string? Note { get; set; }
}
