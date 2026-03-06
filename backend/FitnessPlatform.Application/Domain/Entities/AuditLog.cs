using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Records access and modifications to sensitive client data for GDPR compliance.
/// </summary>
public class AuditLog : BaseEntity
{
    /// <summary>
    /// ID of the user who performed the action, or <c>null</c> for system actions.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Description of the action performed (e.g., "Read", "Update", "Delete").
    /// </summary>
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Type name of the entity that was accessed or modified.
    /// </summary>
    [MaxLength(150)]
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Public ID of the entity that was accessed or modified.
    /// </summary>
    public Guid? EntityId { get; set; }

    /// <summary>
    /// JSON representation of the old values before modification.
    /// </summary>
    [MaxLength(500)]
    public string? OldValues { get; set; }

    /// <summary>
    /// JSON representation of the new values after modification.
    /// </summary>
    [MaxLength(500)]
    public string? NewValues { get; set; }

    /// <summary>
    /// IP address of the client that initiated the action.
    /// </summary>
    [MaxLength(50)]
    public string? IpAddress { get; set; }

    /// <summary>
    /// Date and time when the action occurred.
    /// </summary>
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
}
