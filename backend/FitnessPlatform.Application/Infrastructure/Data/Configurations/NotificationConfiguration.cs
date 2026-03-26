using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="Notification"/>.
/// </summary>
public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasIndex(n => new { n.RecipientUserId, n.IsRead })
            .HasDatabaseName("ix_notifications_recipient_read");

        builder.HasIndex(n => new { n.IsSent, n.DateCreated })
            .HasDatabaseName("ix_notifications_unsent");

        builder.HasOne(n => n.Recipient)
            .WithMany()
            .HasForeignKey(n => n.RecipientUserId)
            .HasPrincipalKey(u => u.Id);
    }
}
