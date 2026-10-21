using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// The newest invite or client request between the caller and the other participant.
/// </summary>
public class ConversationCooperationDto
{
    /// <summary>Invite (sent by a professional) or Request (sent by a client).</summary>
    public CooperationType Type { get; set; }

    /// <summary>Whether the caller sent it or received it.</summary>
    public CooperationDirection Direction { get; set; }

    /// <summary>Current status. A rejected request reads Declined; an invite past its validity reads Expired.</summary>
    public CooperationCardStatus Status { get; set; }

    /// <summary>Public id of the invite or request, the same value as a message's <c>eventSourceId</c>.</summary>
    public Guid SourceId { get; set; }

    /// <summary>The scope an invite asked for, when set. Null for a request.</summary>
    public LinkCapabilityScope? RequestedScope { get; set; }
}
