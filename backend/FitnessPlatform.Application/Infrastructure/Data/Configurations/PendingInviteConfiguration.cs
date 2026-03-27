using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="PendingInvite"/>.
/// </summary>
public class PendingInviteConfiguration : IEntityTypeConfiguration<PendingInvite>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<PendingInvite> builder)
    {
        builder.ToTable("pending_invites");

        builder.Property(pi => pi.FirstName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(pi => pi.LastName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(pi => pi.Email)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(pi => pi.ProfessionalProfileId);

        builder.HasOne(pi => pi.ProfessionalProfile)
            .WithMany(pp => pp.PendingInvites)
            .HasForeignKey(pi => pi.ProfessionalProfileId);
    }
}
