namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// The surviving filter chips on the trainer's clients list. Each chip narrows the current tab's
/// rows; its own count is computed with search and tag filters applied but the chip itself not
/// applied, so a zero-count chip can be greyed out on the client.
/// </summary>
public enum ClientListFilter
{
    /// <summary>No additional filter — the current tab as-is.</summary>
    All,

    /// <summary>The client has sent at least one unread message.</summary>
    UnreadMessages,

    /// <summary>No conversation exists, or one exists with zero messages.</summary>
    NoMessages,

    /// <summary>The client has responded to a weekly check-in the trainer has not reviewed yet.</summary>
    NewCheckIns,

    /// <summary>A weekly check-in expired unanswered, or is overdue with no response.</summary>
    MissingCheckIns,

    /// <summary>An active plan's window ends within 14 days.</summary>
    EndingSoon
}
