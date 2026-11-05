using FormUp.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FormUp.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="InvitationToken"/>.
/// </summary>
public class InvitationTokenConfiguration : IEntityTypeConfiguration<InvitationToken>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<InvitationToken> builder)
    {
        builder.HasOne(it => it.ProfessionalProfile)
            .WithMany(pp => pp.InvitationTokens)
            .HasForeignKey(it => it.ProfessionalProfileId);

        builder.HasIndex(it => it.Token).IsUnique();
    }
}
