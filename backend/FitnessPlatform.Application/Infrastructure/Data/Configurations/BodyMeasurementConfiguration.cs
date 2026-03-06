using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="BodyMeasurement"/>.
/// </summary>
public class BodyMeasurementConfiguration : IEntityTypeConfiguration<BodyMeasurement>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<BodyMeasurement> builder)
    {
        builder.HasOne(bm => bm.ClientProfile)
            .WithMany(cp => cp.BodyMeasurements)
            .HasForeignKey(bm => bm.ClientProfileId);

        builder.Property(bm => bm.WeightKg).HasPrecision(5, 2);
        builder.Property(bm => bm.BodyFatPercentage).HasPrecision(5, 2);
        builder.Property(bm => bm.ChestCm).HasPrecision(5, 1);
        builder.Property(bm => bm.WaistCm).HasPrecision(5, 1);
        builder.Property(bm => bm.HipsCm).HasPrecision(5, 1);
        builder.Property(bm => bm.BicepsCm).HasPrecision(5, 1);
        builder.Property(bm => bm.ThighsCm).HasPrecision(5, 1);
    }
}
