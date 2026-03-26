using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Data;

/// <summary>
/// Abstraction over <see cref="ApplicationDbContext"/> for unit testing.
/// </summary>
public interface IApplicationDbContext
{
    /// <summary>
    /// Application users (from IdentityDbContext).
    /// </summary>
    DbSet<ApplicationUser> Users { get; }

    /// <summary>
    /// Professional profiles (trainers and nutritionists).
    /// </summary>
    DbSet<ProfessionalProfile> ProfessionalProfiles { get; set; }

    /// <summary>
    /// Client profiles.
    /// </summary>
    DbSet<ClientProfile> ClientProfiles { get; set; }

    /// <summary>
    /// Client-professional relationships.
    /// </summary>
    DbSet<ClientProfessionalLink> ClientProfessionalLinks { get; set; }

    /// <summary>
    /// Body measurement records.
    /// </summary>
    DbSet<BodyMeasurement> BodyMeasurements { get; set; }

    /// <summary>
    /// Progress photos.
    /// </summary>
    DbSet<ProgressPhoto> ProgressPhotos { get; set; }

    /// <summary>
    /// Refresh tokens for JWT authentication.
    /// </summary>
    DbSet<RefreshToken> RefreshTokens { get; set; }

    /// <summary>
    /// Invitation tokens for client onboarding.
    /// </summary>
    DbSet<InvitationToken> InvitationTokens { get; set; }

    /// <summary>
    /// Audit log entries for GDPR compliance.
    /// </summary>
    DbSet<AuditLog> AuditLogs { get; set; }

    /// <summary>
    /// Client onboarding questionnaire data.
    /// </summary>
    DbSet<ClientOnboardingData> ClientOnboardingData { get; set; }

    /// <summary>
    /// Notifications.
    /// </summary>
    DbSet<Notification> Notifications { get; set; }

    /// <summary>
    /// Saves all changes made in this context to the database.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
