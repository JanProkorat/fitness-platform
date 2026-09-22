namespace FitnessPlatform.Application.Features.Messaging.GetConversationFilterCounts;

/// <summary>
/// Per-chip conversation counts for the inbox filter dropdown, over the caller's live client
/// roster (live links only, archived links excluded). Independent of the <c>archived</c> display
/// toggle — see <see cref="GetConversationFilterCountsEndpoint"/>.
/// </summary>
public class GetConversationFilterCountsResponse
{
    /// <summary>Total rows in the caller's live roster.</summary>
    public int All { get; set; }

    /// <summary>Rows with at least one unread message from the client.</summary>
    public int UnreadMessages { get; set; }

    /// <summary>Rows with no conversation, or a conversation with zero messages.</summary>
    public int NoMessages { get; set; }

    /// <summary>Rows with a responded, not-yet-reviewed weekly check-in.</summary>
    public int NewCheckIns { get; set; }

    /// <summary>Rows with an expired or overdue-unanswered weekly check-in.</summary>
    public int MissingCheckIns { get; set; }

    /// <summary>Rows whose active plan window ends within 14 days.</summary>
    public int EndingSoon { get; set; }
}
