using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Classifies a client roster row against the six-way filter chip set shared by the trainer's
/// clients list and the inbox's conversation filter, and computes chip counts for either
/// surface's dropdown. Extracted from <c>GetClientsEndpoint</c> (#1095) so the two surfaces can
/// never disagree about what a chip means — same precedent as <see cref="ClientStatusClassifier"/>
/// (#1094).
/// </summary>
/// <remarks>
/// Pure — no <c>DbContext</c>, no Mongo. Callers resolve every per-row fact themselves (unread
/// message presence, conversation emptiness, check-in flags, plan-ending-soon) via their own
/// correlated-subquery roster pass, then pass the already-resolved facts in. Each caller keeps
/// its own wire DTO for the chip counts (<c>ClientFilterCounts</c> for the clients list,
/// <c>GetConversationFilterCountsResponse</c> for the inbox) — this type returns a plain tuple,
/// never a shared response shape, so neither slice imports the other's DTO.
/// </remarks>
public static class ClientRosterFilterClassifier
{
    /// <summary>
    /// Whether a roster row with the given facts matches the requested filter. <see langword="null"/>
    /// or <see cref="ClientListFilter.All"/> matches everything.
    /// </summary>
    public static bool Matches(
        ClientListFilter? filter,
        bool hasUnreadMessages,
        bool hasNoMessages,
        bool hasNewCheckIn,
        bool hasMissingCheckIn,
        bool isEndingSoon) =>
        filter switch
        {
            null or ClientListFilter.All => true,
            ClientListFilter.UnreadMessages => hasUnreadMessages,
            ClientListFilter.NoMessages => hasNoMessages,
            ClientListFilter.NewCheckIns => hasNewCheckIn,
            ClientListFilter.MissingCheckIns => hasMissingCheckIn,
            ClientListFilter.EndingSoon => isEndingSoon,
            _ => true
        };

    /// <summary>
    /// Computes the six chip counts over <paramref name="rows"/>, each fact selected from a row
    /// via the supplied selector. Every count is the number of rows for which
    /// <see cref="Matches"/> would return <see langword="true"/> for that named filter.
    /// </summary>
    public static (int All, int UnreadMessages, int NoMessages, int NewCheckIns, int MissingCheckIns, int EndingSoon)
        ComputeCounts<TRow>(
            IReadOnlyCollection<TRow> rows,
            Func<TRow, bool> hasUnreadMessages,
            Func<TRow, bool> hasNoMessages,
            Func<TRow, bool> hasNewCheckIn,
            Func<TRow, bool> hasMissingCheckIn,
            Func<TRow, bool> isEndingSoon) =>
        (
            rows.Count,
            rows.Count(hasUnreadMessages),
            rows.Count(hasNoMessages),
            rows.Count(hasNewCheckIn),
            rows.Count(hasMissingCheckIn),
            rows.Count(isEndingSoon)
        );
}
