using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A single message within a conversation.
/// </summary>
public class ChatMessage : PublicTimestampableEntity
{
    /// <summary>
    /// The conversation this message belongs to.
    /// </summary>
    public long ConversationId { get; set; }

    /// <summary>
    /// The user who sent this message.
    /// </summary>
    public Guid SenderUserId { get; set; }

    /// <summary>
    /// The message text content.
    /// </summary>
    [MaxLength(4000)]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Whether the recipient has read this message.
    /// </summary>
    public bool IsRead { get; set; }

    /// <summary>
    /// Navigation property to the conversation.
    /// </summary>
    public Conversation Conversation { get; set; } = null!;

    /// <summary>
    /// Navigation property to the sender user.
    /// </summary>
    public ApplicationUser Sender { get; set; } = null!;
}
