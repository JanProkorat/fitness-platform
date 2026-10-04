using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="ClientTagAssignment"/>.
/// </summary>
public class ClientTagAssignmentConfiguration : IEntityTypeConfiguration<ClientTagAssignment>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ClientTagAssignment> builder)
    {
        // A tag may be assigned to a given link at most once.
        builder.HasIndex(a => new { a.ClientTagId, a.ClientProfessionalLinkId })
            .IsUnique();

        builder.HasOne(a => a.ClientTag)
            .WithMany(t => t.Assignments)
            .HasForeignKey(a => a.ClientTagId);

        builder.HasOne(a => a.ClientProfessionalLink)
            .WithMany()
            .HasForeignKey(a => a.ClientProfessionalLinkId);
    }
}
