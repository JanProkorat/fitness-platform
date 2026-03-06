using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientProfile"/>.
/// </summary>
public class ClientProfileConfiguration : IEntityTypeConfiguration<ClientProfile>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientProfile> builder)
    {
        builder.Property(cp => cp.HeightCm).HasPrecision(5, 1);
        builder.Property(cp => cp.WeightKg).HasPrecision(5, 2);
    }
}
