using System.Text.Json;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

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
    /// Plan-scoped photos (body progress, food, and free-form).
    /// Replaces the retired ProgressPhoto entity.
    /// </summary>
    public virtual DbSet<PlanPhoto> PlanPhotos { get; set; } = null!;

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

    /// <summary>
    /// Per-professional weekly check-in reminder settings.
    /// </summary>
    public virtual DbSet<WeeklyCheckInSetting> WeeklyCheckInSettings { get; set; } = null!;

    /// <summary>
    /// Per-client overrides for weekly check-in reminder settings.
    /// </summary>
    public virtual DbSet<WeeklyCheckInClientOverride> WeeklyCheckInClientOverrides { get; set; } = null!;

    /// <summary>
    /// Weekly check-in instances (scheduler → client response → trainer review lifecycle).
    /// </summary>
    public virtual DbSet<WeeklyCheckIn> WeeklyCheckIns { get; set; } = null!;

    /// <summary>
    /// Photo diary requests sent by nutritionists to clients.
    /// </summary>
    public virtual DbSet<PhotoDiaryRequest> PhotoDiaryRequests { get; set; } = null!;

    /// <summary>
    /// Idempotency log for the daily photo-diary reminder scheduler.
    /// </summary>
    public virtual DbSet<PhotoDiaryReminderLog> PhotoDiaryReminderLogs { get; set; } = null!;

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

        builder.Entity<WeeklyCheckInSetting>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Profession).HasConversion<string>();
            e.Property(s => s.DeadlineOffsetHours).HasDefaultValue(72);
            e.HasIndex(s => new { s.UserId, s.Profession }).IsUnique();
            e.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WeeklyCheckInClientOverride>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Profession).HasConversion<string>();
            e.HasIndex(o => new { o.ClientUserId, o.ProfessionalUserId, o.Profession }).IsUnique();
            e.HasOne(o => o.ClientUser)
                .WithMany()
                .HasForeignKey(o => o.ClientUserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(o => o.ProfessionalUser)
                .WithMany()
                .HasForeignKey(o => o.ProfessionalUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WeeklyCheckIn>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Profession).HasConversion<string>();
            e.Property(c => c.Status).HasConversion<string>().HasDefaultValue(WeeklyCheckInStatus.Pending);
            e.Property(c => c.WeekStartDate).HasColumnType("date");

            // Flags stored as a jsonb array of flag name strings
            var flagsConverter = new ValueConverter<List<CheckInFlag>, string>(
                flags => JsonSerializer.Serialize(flags.Select(f => f.ToString()).ToList(),
                    (JsonSerializerOptions?)null),
                json => JsonSerializer.Deserialize<List<string>>(json, (JsonSerializerOptions?)null)!
                    .Select(s => Enum.Parse<CheckInFlag>(s)).ToList());

            e.Property(c => c.Flags)
                .HasConversion(flagsConverter)
                .HasColumnType("jsonb");

            e.HasIndex(c => new
            {
                c.ClientUserId,
                c.ProfessionalUserId,
                c.Profession,
                c.WeekStartDate
            }).IsUnique();

            e.HasOne(c => c.ClientUser)
                .WithMany()
                .HasForeignKey(c => c.ClientUserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(c => c.ProfessionalUser)
                .WithMany()
                .HasForeignKey(c => c.ProfessionalUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PlanPhoto>(e =>
        {
            e.Property(p => p.Category).HasConversion<string>();
            e.Property(p => p.PlanType).HasConversion<string>();

            e.HasOne(p => p.ClientProfile)
                .WithMany(cp => cp.PlanPhotos)
                .HasForeignKey(p => p.ClientProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(p => p.UploadedByUser)
                .WithMany()
                .HasForeignKey(p => p.UploadedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(p => new { p.ClientProfileId, p.Category });
            e.HasIndex(p => p.PlanId);
            e.HasIndex(p => p.DiaryRequestId)
                .HasDatabaseName("ix_plan_photos_diary_request_id");
        });

        builder.Entity<PhotoDiaryReminderLog>(e =>
        {
            e.HasKey(l => l.Id);
            e.Property(l => l.ClientLocalDate).HasColumnType("date");

            e.HasOne(l => l.DiaryRequest)
                .WithMany()
                .HasForeignKey(l => l.DiaryRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            // Uniqueness constraint: at most one reminder log per (request, calendar day).
            e.HasIndex(l => new { l.DiaryRequestId, l.ClientLocalDate })
                .IsUnique()
                .HasDatabaseName("ix_photo_diary_reminder_logs_request_date");
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
