using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Writes audit log entries to the database for GDPR compliance.
/// </summary>
/// <param name="db">Database context.</param>
public class AuditService(IApplicationDbContext db) : IAuditService
{
    /// <inheritdoc />
    public async Task LogAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        string? ipAddress = null,
        string? oldValues = null,
        string? newValues = null,
        CancellationToken ct = default)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            IpAddress = ipAddress,
            OldValues = oldValues,
            NewValues = newValues,
            DateCreated = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
    }
}
