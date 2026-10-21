using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Derives the effective status of a pending invite, folding the 7-day validity window
/// into <see cref="PendingInviteStatus.Expired"/>.
/// </summary>
public static class PendingInviteStatusResolver
{
    /// <summary>How long an invite stays answerable after it was sent.</summary>
    public static readonly TimeSpan Validity = TimeSpan.FromDays(7);

    /// <summary>
    /// The earliest <c>SentAt</c> that is still valid at <paramref name="now"/>. A pending invite
    /// sent before this instant is expired. Usable inside EF queries as a plain comparison value.
    /// </summary>
    public static DateTime ValidSince(DateTime now) => now - Validity;

    /// <summary>When an invite sent at <paramref name="sentAt"/> stops being answerable.</summary>
    public static DateTime ExpiresAt(DateTime sentAt) => sentAt + Validity;

    /// <summary>
    /// Collapses stored-Pending invites to one per email: the live one when it exists, else the
    /// newest expired one (kept so the coach can still cancel it). Expired rows superseded by a
    /// re-invite (#1541) are dropped.
    /// </summary>
    public static List<T> OnePerEmail<T>(
        IEnumerable<T> storedPending, Func<T, string> email, Func<T, DateTime> sentAt, DateTime now)
    {
        var validSince = ValidSince(now);
        var result = new List<T>();

        foreach (var group in storedPending.GroupBy(i => email(i).ToLowerInvariant()))
        {
            var live = group.Where(i => sentAt(i) >= validSince).ToList();
            result.AddRange(live.Count > 0 ? live : [group.OrderByDescending(sentAt).First()]);
        }

        return result;
    }

    /// <summary>Resolves the effective status of an invite.</summary>
    public static PendingInviteStatus Resolve(PendingInviteStatus stored, DateTime sentAt, DateTime now) =>
        stored == PendingInviteStatus.Pending && sentAt < ValidSince(now)
            ? PendingInviteStatus.Expired
            : stored;
}
