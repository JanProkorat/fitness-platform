using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Interfaces;

/// <summary>
/// What a valid notification email link says: whose email switch it controls and for which event.
/// </summary>
/// <param name="UserId">The <c>ApplicationUser.Id</c> the email was sent to.</param>
/// <param name="Event">The notification event whose email switch the link controls.</param>
public readonly record struct EmailTurnOffTokenClaims(Guid UserId, NotificationEvent Event);
