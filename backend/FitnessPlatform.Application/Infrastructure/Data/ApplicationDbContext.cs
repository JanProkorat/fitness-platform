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
    /// Trainer profiles.
    /// </summary>
    public virtual DbSet<TrainerProfile> TrainerProfiles { get; set; } = null!;

    /// <summary>
    /// Client profiles.
    /// </summary>
    public virtual DbSet<ClientProfile> ClientProfiles { get; set; } = null!;

    /// <summary>
    /// Client-trainer relationships.
    /// </summary>
    public virtual DbSet<ClientTrainerLink> ClientTrainerLinks { get; set; } = null!;

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
