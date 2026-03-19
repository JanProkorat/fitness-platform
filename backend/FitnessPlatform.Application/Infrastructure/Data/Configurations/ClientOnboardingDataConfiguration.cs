using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientOnboardingData"/>.
/// </summary>
public class ClientOnboardingDataConfiguration : IEntityTypeConfiguration<ClientOnboardingData>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientOnboardingData> builder)
    {
        builder.HasOne(d => d.ClientProfile)
            .WithOne(cp => cp.OnboardingData)
            .HasForeignKey<ClientOnboardingData>(d => d.ClientProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.ClientProfileId).IsUnique();

        builder.Property(d => d.HeightCm).HasPrecision(5, 1);
        builder.Property(d => d.WeightKg).HasPrecision(5, 2);
        builder.Property(d => d.TargetWeightKg).HasPrecision(5, 2);
    }
}
