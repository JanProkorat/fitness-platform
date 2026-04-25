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
    /// Plan-scoped photos (body progress, food, and free-form).
    /// Replaces the retired ProgressPhoto entity.
    /// </summary>
    DbSet<PlanPhoto> PlanPhotos { get; set; }

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
    /// Pending invitations sent by professionals to prospective clients.
    /// </summary>
    DbSet<PendingInvite> PendingInvites { get; set; }

    /// <summary>
    /// Questionnaire templates created by professionals.
    /// </summary>
    DbSet<Questionnaire> Questionnaires { get; set; }

    /// <summary>
    /// Questions within questionnaire templates.
    /// </summary>
    DbSet<QuestionnaireQuestion> QuestionnaireQuestions { get; set; }

    /// <summary>
    /// Client responses to questionnaires.
    /// </summary>
    DbSet<QuestionnaireResponse> QuestionnaireResponses { get; set; }

    /// <summary>
    /// Individual answers within questionnaire responses.
    /// </summary>
    DbSet<QuestionnaireAnswer> QuestionnaireAnswers { get; set; }

    /// <summary>
    /// Client requests to join a professional's roster.
    /// </summary>
    DbSet<ClientRequest> ClientRequests { get; set; }

    /// <summary>
    /// Email verification tokens.
    /// </summary>
    DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }

    /// <summary>
    /// Device push tokens for mobile notifications.
    /// </summary>
    DbSet<DevicePushToken> DevicePushTokens { get; set; }

    /// <summary>
    /// Messaging conversations between professionals and clients.
    /// </summary>
    DbSet<Conversation> Conversations { get; set; }

    /// <summary>
    /// Chat messages within conversations.
    /// </summary>
    DbSet<ChatMessage> ChatMessages { get; set; }

    /// <summary>
    /// Per-professional weekly check-in reminder settings.
    /// </summary>
    DbSet<WeeklyCheckInSetting> WeeklyCheckInSettings { get; set; }

    /// <summary>
    /// Per-client overrides for weekly check-in reminder settings.
    /// </summary>
    DbSet<WeeklyCheckInClientOverride> WeeklyCheckInClientOverrides { get; set; }

    /// <summary>
    /// Weekly check-in instances (scheduler → client response → trainer review lifecycle).
    /// </summary>
    DbSet<WeeklyCheckIn> WeeklyCheckIns { get; set; }

    /// <summary>
    /// Saves all changes made in this context to the database.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
