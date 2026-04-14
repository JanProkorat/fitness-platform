namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// A single event in a client's activity timeline.
/// </summary>
public class ClientTimelineItem
{
    /// <summary>
    /// Stable unique identifier for this timeline entry.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Event kind — used on the client to pick icon/colour.
    /// One of: meal_day, workout, measurement, questionnaire,
    /// nutrition_plan_published, training_plan_published, linked.
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// When this event occurred (UTC).
    /// </summary>
    public DateTime OccurredAt { get; set; }

    /// <summary>
    /// Short, human-readable title (e.g. "Splnil jídelníček").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Optional secondary text (e.g. "5 z 5 jídel zaznamenáno").
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional emoji/icon hint for the client.
    /// </summary>
    public string? Icon { get; set; }
}

/// <summary>
/// Response returning a client's activity timeline, ordered newest first.
/// </summary>
public class GetClientTimelineResponse
{
    /// <summary>
    /// Timeline items, ordered by <see cref="ClientTimelineItem.OccurredAt"/> descending.
    /// </summary>
    public List<ClientTimelineItem> Items { get; set; } = [];
}
