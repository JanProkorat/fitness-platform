using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ProgressPhoto"/>.
/// </summary>
public class ProgressPhotoConfiguration : IEntityTypeConfiguration<ProgressPhoto>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ProgressPhoto> builder)
    {
        builder.HasOne(pp => pp.ClientProfile)
            .WithMany(cp => cp.ProgressPhotos)
            .HasForeignKey(pp => pp.ClientProfileId);
    }
}
