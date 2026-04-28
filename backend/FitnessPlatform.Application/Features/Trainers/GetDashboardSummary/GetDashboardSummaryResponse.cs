namespace FitnessPlatform.Application.Features.Trainers.GetDashboardSummary;

/// <summary>
/// Aggregated dashboard data for the trainer's client list.
/// </summary>
public class GetDashboardSummaryResponse
{
    /// <summary>
    /// Per-client stats.
    /// </summary>
    public List<ClientDashboardItem> Clients { get; set; } = [];
}

/// <summary>
/// Dashboard-level stats for a single client.
/// </summary>
public class ClientDashboardItem
{
    /// <summary>Client's profile public ID.</summary>
    public Guid PublicId { get; set; }

    /// <summary>Client's first name.</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Client's last name.</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>Client's email address.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Optional MinIO blob URL for the client's avatar (from the user record). Null if no avatar uploaded.</summary>
    public string? AvatarBlobUrl { get; set; }

    /// <summary>Whether the trainer-client link is active.</summary>
    public bool IsActive { get; set; }

    /// <summary>Client's fitness goal text (from ClientProfile.Goals).</summary>
    public string? Goal { get; set; }

    /// <summary>7-day compliance percentage (0–100).</summary>
    public decimal CompliancePercent { get; set; }

    /// <summary>Current streak of consecutive compliant days.</summary>
    public int CurrentStreak { get; set; }

    /// <summary>Average daily kcal consumed over the last 7 days.</summary>
    public decimal AvgDailyKcal { get; set; }

    /// <summary>Kcal consumed today (from meal logs).</summary>
    public decimal TodayKcal { get; set; }

    /// <summary>Daily kcal target from the active nutrition plan (null if none).</summary>
    public decimal? KcalGoal { get; set; }

    /// <summary>Completed workouts this week (Mon–today).</summary>
    public int WorkoutsCompleted { get; set; }

    /// <summary>Planned training sessions this week (from active plan's current week).</summary>
    public int WorkoutsPlanned { get; set; }

    /// <summary>UTC timestamp of the client's most recent activity (meal log, workout, measurement).</summary>
    public DateTime? LastActivityAt { get; set; }

    /// <summary>Number of nutrition plans that have started, are not completed, and have at least one published week.</summary>
    public int ActiveNutritionPlansCount { get; set; }

    /// <summary>Whether the client has an active training plan.</summary>
    public bool HasActiveTrainingPlan { get; set; }
}
