using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="InvitationToken"/>.
/// </summary>
public class InvitationTokenConfiguration : IEntityTypeConfiguration<InvitationToken>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<InvitationToken> builder)
    {
        builder.HasOne(it => it.TrainerProfile)
            .WithMany(tp => tp.InvitationTokens)
            .HasForeignKey(it => it.TrainerProfileId);

        builder.HasIndex(it => it.Token).IsUnique();
    }
}
