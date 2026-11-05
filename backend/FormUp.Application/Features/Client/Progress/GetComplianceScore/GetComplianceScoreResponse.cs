namespace FormUp.Application.Features.Client.Progress.GetComplianceScore;

/// <summary>
/// Response model containing a client's compliance score and related metrics.
/// </summary>
public class GetComplianceScoreResponse
{
    /// <summary>
    /// Compliance percentage (0-100), representing how many planned meals were logged.
    /// </summary>
    public decimal CompliancePercent { get; set; }

    /// <summary>
    /// Total number of meals planned in the date range.
    /// </summary>
    public int MealsPlanned { get; set; }

    /// <summary>
    /// Total number of meals logged in the date range.
    /// </summary>
    public int MealsLogged { get; set; }

    /// <summary>
    /// Number of partly eaten meals in the date range. Not included in <see cref="MealsLogged"/>.
    /// </summary>
    public int MealsPartlyEaten { get; set; }

    /// <summary>
    /// Sum of each logged meal's eaten share in the date range (partly eaten meals count their share).
    /// </summary>
    public decimal MealsEatenShare { get; set; }

    /// <summary>
    /// Current streak of consecutive compliant days.
    /// </summary>
    public int CurrentStreak { get; set; }

    /// <summary>
    /// Start date of the compliance calculation range.
    /// </summary>
    public DateTime From { get; set; }

    /// <summary>
    /// End date of the compliance calculation range.
    /// </summary>
    public DateTime To { get; set; }
}
