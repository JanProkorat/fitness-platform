using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a messaging conversation between a professional and a client.
/// </summary>
public class Conversation : PublicTimestampableEntity
{
    /// <summary>
    /// The professional (trainer/nutritionist) participating in this conversation.
    /// </summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>
    /// The client participating in this conversation.
    /// </summary>
    public Guid ClientUserId { get; set; }

    /// <summary>
    /// Preview text of the last message for list display.
    /// </summary>
    [MaxLength(300)]
    public string? LastMessageText { get; set; }

    /// <summary>
    /// Timestamp of the last message in the conversation.
    /// </summary>
    public DateTime? LastMessageAt { get; set; }

    /// <summary>
    /// User ID of the last message sender.
    /// </summary>
    public Guid? LastMessageSenderId { get; set; }

    /// <summary>
    /// Navigation property to the professional user.
    /// </summary>
    public ApplicationUser Professional { get; set; } = null!;

    /// <summary>
    /// Navigation property to the client user.
    /// </summary>
    public ApplicationUser Client { get; set; } = null!;

    /// <summary>
    /// When the professional archived this conversation. Null = not archived.
    /// </summary>
    public DateTime? ArchivedByProfessionalAt { get; set; }

    /// <summary>
    /// When the client archived this conversation. Null = not archived.
    /// </summary>
    public DateTime? ArchivedByClientAt { get; set; }

    /// <summary>
    /// Whether the professional-client collaboration has ended.
    /// When true, new messages from the former trainer don't auto-unarchive.
    /// </summary>
    public bool IsFormer { get; set; }

    /// <summary>
    /// Messages in this conversation.
    /// </summary>
    public ICollection<ChatMessage> Messages { get; set; } = [];
}
