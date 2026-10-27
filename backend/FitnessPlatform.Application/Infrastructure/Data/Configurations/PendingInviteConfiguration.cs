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

        builder.Property(pi => pi.Email)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(pi => pi.ProfessionalProfileId);

        builder.HasOne(pi => pi.ProfessionalProfile)
            .WithMany(pp => pp.PendingInvites)
            .HasForeignKey(pi => pi.ProfessionalProfileId);

        // The coach's package or discount may be deleted with the coach; the invite then simply carries no terms.
        builder.HasOne(pi => pi.CoachPackage)
            .WithMany()
            .HasForeignKey(pi => pi.CoachPackageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(pi => pi.CoachDiscount)
            .WithMany()
            .HasForeignKey(pi => pi.CoachDiscountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(pi => pi.CoachPackageId);
        builder.HasIndex(pi => pi.CoachDiscountId);
    }
}
