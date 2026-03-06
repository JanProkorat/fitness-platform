namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Service for recording audit log entries when sensitive data is accessed or modified.
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Records an audit log entry.
    /// </summary>
    /// <param name="userId">ID of the user performing the action.</param>
    /// <param name="action">Action performed (e.g., "Read", "Update", "Delete").</param>
    /// <param name="entityType">Type of entity affected.</param>
    /// <param name="entityId">Public ID of the entity affected.</param>
    /// <param name="ipAddress">IP address of the request originator.</param>
    /// <param name="oldValues">JSON of old values (for updates/deletes).</param>
    /// <param name="newValues">JSON of new values (for creates/updates).</param>
    /// <param name="ct">Cancellation token.</param>
    Task LogAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        string? ipAddress = null,
        string? oldValues = null,
        string? newValues = null,
        CancellationToken ct = default);
}
