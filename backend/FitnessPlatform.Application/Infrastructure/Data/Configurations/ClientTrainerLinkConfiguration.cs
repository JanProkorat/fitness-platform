using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientTrainerLink"/>.
/// </summary>
public class ClientTrainerLinkConfiguration : IEntityTypeConfiguration<ClientTrainerLink>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientTrainerLink> builder)
    {
        builder.HasIndex(ctl => new { ctl.ClientProfileId, ctl.TrainerProfileId })
            .IsUnique();

        builder.HasOne(ctl => ctl.ClientProfile)
            .WithMany(cp => cp.TrainerLinks)
            .HasForeignKey(ctl => ctl.ClientProfileId);

        builder.HasOne(ctl => ctl.TrainerProfile)
            .WithMany(tp => tp.ClientLinks)
            .HasForeignKey(ctl => ctl.TrainerProfileId);
    }
}
