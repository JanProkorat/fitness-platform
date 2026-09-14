using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientNutritionTargets"/>.
/// </summary>
public class ClientNutritionTargetsConfiguration : IEntityTypeConfiguration<ClientNutritionTargets>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientNutritionTargets> builder)
    {
        builder.HasOne(t => t.ClientOnboardingData)
            .WithOne(od => od.NutritionTargets)
            .HasForeignKey<ClientNutritionTargets>(t => t.ClientOnboardingDataId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.ClientOnboardingDataId).IsUnique();
    }
}
