using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientTag"/>.
/// </summary>
public class ClientTagConfiguration : IEntityTypeConfiguration<ClientTag>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientTag> builder)
    {
        // A coach may not have two tags with the same name.
        builder.HasIndex(t => new { t.OwnerProfessionalProfileId, t.Name })
            .IsUnique();

        builder.HasOne(t => t.OwnerProfessionalProfile)
            .WithMany()
            .HasForeignKey(t => t.OwnerProfessionalProfileId);
    }
}
