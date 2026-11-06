using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.Users.EmailLinks.Shared;

/// <summary>
/// What a notification email link changed: the account it belongs to and the event whose email switch it set.
/// </summary>
/// <param name="UserId">The account's user id; safe to log.</param>
/// <param name="Email">The account's email address; shown to the person who followed the link, never logged.</param>
/// <param name="Event">The notification event whose email switch was set.</param>
internal sealed record EmailLinkOutcome(Guid UserId, string Email, NotificationEvent Event);
