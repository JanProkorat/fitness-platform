using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="UserExternalLogin"/>.
/// </summary>
public class UserExternalLoginConfiguration : IEntityTypeConfiguration<UserExternalLogin>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<UserExternalLogin> builder)
    {
        builder.HasOne(el => el.User)
            .WithMany()
            .HasForeignKey(el => el.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(el => new { el.Provider, el.Subject }).IsUnique();
    }
}
