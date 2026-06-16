using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="SocialLoginNonce"/>.
/// </summary>
public class SocialLoginNonceConfiguration : IEntityTypeConfiguration<SocialLoginNonce>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<SocialLoginNonce> builder)
    {
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Nonce)
            .IsRequired()
            .HasMaxLength(64);

        // Unique index so nonce lookups are fast and collisions are rejected by the DB.
        builder.HasIndex(n => n.Nonce)
            .IsUnique()
            .HasDatabaseName("ix_social_login_nonces_nonce");
    }
}
