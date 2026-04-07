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
    /// Whether the professional has archived this conversation.
    /// </summary>
    public bool IsArchivedByProfessional { get; set; }

    /// <summary>
    /// Whether the client has archived this conversation.
    /// </summary>
    public bool IsArchivedByClient { get; set; }

    /// <summary>
    /// Messages in this conversation.
    /// </summary>
    public ICollection<ChatMessage> Messages { get; set; } = [];
}
