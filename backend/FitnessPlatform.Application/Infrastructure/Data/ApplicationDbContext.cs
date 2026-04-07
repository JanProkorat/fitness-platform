using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Data;

/// <summary>
/// Main database context for the fitness platform, extending ASP.NET Identity context.
/// </summary>
/// <param name="options">Database context options.</param>
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options), IApplicationDbContext
{

    /// <summary>
    /// Professional profiles (trainers and nutritionists).
    /// </summary>
    public virtual DbSet<ProfessionalProfile> ProfessionalProfiles { get; set; } = null!;

    /// <summary>
    /// Client profiles.
    /// </summary>
    public virtual DbSet<ClientProfile> ClientProfiles { get; set; } = null!;

    /// <summary>
    /// Client-professional relationships.
    /// </summary>
    public virtual DbSet<ClientProfessionalLink> ClientProfessionalLinks { get; set; } = null!;

    /// <summary>
    /// Body measurement records.
    /// </summary>
    public virtual DbSet<BodyMeasurement> BodyMeasurements { get; set; } = null!;

    /// <summary>
    /// Progress photos.
    /// </summary>
    public virtual DbSet<ProgressPhoto> ProgressPhotos { get; set; } = null!;

    /// <summary>
    /// Refresh tokens for JWT authentication.
    /// </summary>
    public virtual DbSet<RefreshToken> RefreshTokens { get; set; } = null!;

    /// <summary>
    /// Invitation tokens for client onboarding.
    /// </summary>
    public virtual DbSet<InvitationToken> InvitationTokens { get; set; } = null!;

    /// <summary>
    /// Audit log entries for GDPR compliance.
    /// </summary>
    public virtual DbSet<AuditLog> AuditLogs { get; set; } = null!;

    /// <summary>
    /// Client onboarding questionnaire data.
    /// </summary>
    public virtual DbSet<ClientOnboardingData> ClientOnboardingData { get; set; } = null!;

    /// <inheritdoc />
    public virtual DbSet<Notification> Notifications { get; set; } = null!;

    /// <summary>
    /// Pending invitations sent by professionals to prospective clients.
    /// </summary>
    public virtual DbSet<PendingInvite> PendingInvites { get; set; } = null!;

    /// <summary>
    /// Questionnaire templates created by professionals.
    /// </summary>
    public virtual DbSet<Questionnaire> Questionnaires { get; set; } = null!;

    /// <summary>
    /// Questions within questionnaire templates.
    /// </summary>
    public virtual DbSet<QuestionnaireQuestion> QuestionnaireQuestions { get; set; } = null!;

    /// <summary>
    /// Client responses to questionnaires.
    /// </summary>
    public virtual DbSet<QuestionnaireResponse> QuestionnaireResponses { get; set; } = null!;

    /// <summary>
    /// Individual answers within questionnaire responses.
    /// </summary>
    public virtual DbSet<QuestionnaireAnswer> QuestionnaireAnswers { get; set; } = null!;

    /// <summary>
    /// Client requests to join a professional's roster.
    /// </summary>
    public virtual DbSet<ClientRequest> ClientRequests { get; set; } = null!;

    /// <summary>
    /// Email verification tokens.
    /// </summary>
    public virtual DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; } = null!;

    /// <inheritdoc />
    public virtual DbSet<DevicePushToken> DevicePushTokens { get; set; } = null!;

    /// <inheritdoc />
    public virtual DbSet<Conversation> Conversations { get; set; } = null!;

    /// <inheritdoc />
    public virtual DbSet<ChatMessage> ChatMessages { get; set; } = null!;

    /// <inheritdoc />
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        optionsBuilder.ConfigureWarnings(w =>
            w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    }

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Remap ASP.NET Identity tables to snake_case
        builder.Entity<ApplicationUser>().ToTable("users");
        builder.Entity<ApplicationRole>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");

        builder.Entity<Questionnaire>()
            .HasIndex(q => q.ProfessionalId);

        builder.Entity<Conversation>(e =>
        {
            e.HasIndex(c => new { c.ProfessionalUserId, c.ClientUserId }).IsUnique();
            e.HasOne(c => c.Professional).WithMany().HasForeignKey(c => c.ProfessionalUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.Client).WithMany().HasForeignKey(c => c.ClientUserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ChatMessage>(e =>
        {
            e.HasOne(m => m.Conversation).WithMany(c => c.Messages).HasForeignKey(m => m.ConversationId);
            e.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(m => new { m.ConversationId, m.DateCreated });
        });

        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }

    /// <inheritdoc />
    public override int SaveChanges()
    {
        ApplyTimestamps();
        return base.SaveChanges();
    }

    /// <inheritdoc />
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Automatically sets DateCreated and DateUpdated on tracked entities.
    /// </summary>
    private void ApplyTimestamps()
    {
        var entries = ChangeTracker.Entries<ITimestampable>();

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.DateCreated = DateTime.UtcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.DateUpdated = DateTime.UtcNow;
            }
        }

        var publicEntries = ChangeTracker.Entries<IPublicEntity>();

        foreach (var entry in publicEntries)
        {
            if (entry.State == EntityState.Added && entry.Entity.PublicId == Guid.Empty)
            {
                entry.Entity.PublicId = Guid.NewGuid();
            }
        }
    }
}
