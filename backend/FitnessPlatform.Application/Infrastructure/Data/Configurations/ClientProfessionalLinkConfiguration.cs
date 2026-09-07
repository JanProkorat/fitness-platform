using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientProfessionalLink"/>.
/// </summary>
public class ClientProfessionalLinkConfiguration : IEntityTypeConfiguration<ClientProfessionalLink>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientProfessionalLink> builder)
    {
        builder.HasIndex(cpl => new { cpl.ClientProfileId, cpl.ProfessionalProfileId })
            .IsUnique();

        builder.HasOne(cpl => cpl.ClientProfile)
            .WithMany(cp => cp.ProfessionalLinks)
            .HasForeignKey(cpl => cpl.ClientProfileId);

        builder.HasOne(cpl => cpl.ProfessionalProfile)
            .WithMany(pp => pp.ClientLinks)
            .HasForeignKey(cpl => cpl.ProfessionalProfileId);

        builder.Property(cpl => cpl.CanViewNutritionPlans)
            .HasDefaultValue(false);

        builder.Property(cpl => cpl.CanViewTrainingPlans)
            .HasDefaultValue(false);
    }
}
