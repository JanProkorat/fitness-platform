using FormUp.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FormUp.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="PendingNotificationEmail"/>.
/// </summary>
public class PendingNotificationEmailConfiguration : IEntityTypeConfiguration<PendingNotificationEmail>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<PendingNotificationEmail> builder)
    {
        builder.ToTable("pending_notification_emails");

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.RecipientUserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One open burst per recipient, event and group; the upsert's ON CONFLICT targets it.
        builder.HasIndex(p => new { p.RecipientUserId, p.Event, p.GroupId })
            .IsUnique()
            .HasDatabaseName("ux_pending_notification_emails_recipient_event_group");

        // The scheduler's claim of the earliest due row.
        builder.HasIndex(p => p.DueAt)
            .HasDatabaseName("ix_pending_notification_emails_due_at");
    }
}
