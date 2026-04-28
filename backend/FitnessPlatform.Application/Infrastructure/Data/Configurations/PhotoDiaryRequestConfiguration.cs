using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="PhotoDiaryRequest"/>.
/// Defines the table mapping, FK relationships, indexes, and CHECK constraints
/// that enforce the entity's invariants at the database level.
/// </summary>
public class PhotoDiaryRequestConfiguration : IEntityTypeConfiguration<PhotoDiaryRequest>
{
    // Numeric values of the status enum used in the SQL CHECK expressions.
    // Keep in sync with PhotoDiaryStatus.
    private const int StatusAccepted = (int)PhotoDiaryStatus.Accepted;
    private const int StatusDismissed = (int)PhotoDiaryStatus.Dismissed;
    private const int StatusInProgress = (int)PhotoDiaryStatus.InProgress;
    private const int StatusCompleted = (int)PhotoDiaryStatus.Completed;

    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<PhotoDiaryRequest> builder)
    {
        builder.ToTable("photo_diary_requests");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        // ── enum columns stored as integers ──────────────────────────────────
        builder.Property(r => r.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(r => r.Mode)
            .HasConversion<int?>();

        // ── DismissReason max-length (also enforced via data annotation) ─────
        builder.Property(r => r.DismissReason)
            .HasMaxLength(500);

        // ── FK: ProfessionalId → users.id ────────────────────────────────────
        builder.HasOne(r => r.Professional)
            .WithMany()
            .HasForeignKey(r => r.ProfessionalId)
            .OnDelete(DeleteBehavior.Restrict);

        // ── FK: LinkId → client_professional_links.id (nullable) ────────────
        builder.HasOne(r => r.Link)
            .WithMany()
            .HasForeignKey(r => r.LinkId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // ── FK: PendingInviteId → pending_invites.id (nullable) ─────────────
        builder.HasOne(r => r.PendingInvite)
            .WithMany()
            .HasForeignKey(r => r.PendingInviteId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // ── Indexes ───────────────────────────────────────────────────────────
        // Trainer's "my pending diary requests" list
        builder.HasIndex(r => new { r.ProfessionalId, r.Status })
            .HasDatabaseName("ix_photo_diary_requests_professional_status");

        // Client's pending diary requests via link
        builder.HasIndex(r => r.LinkId)
            .HasDatabaseName("ix_photo_diary_requests_link_id");

        // Client's pending diary requests via invite
        builder.HasIndex(r => r.PendingInviteId)
            .HasDatabaseName("ix_photo_diary_requests_pending_invite_id");

        // ── CHECK constraints (invariants) ────────────────────────────────────

        // 1. Exactly one of LinkId / PendingInviteId is set (XOR).
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_link_xor_invite",
            "(link_id IS NOT NULL AND pending_invite_id IS NULL) OR " +
            "(link_id IS NULL AND pending_invite_id IS NOT NULL)"));

        // 2. Mode is non-null iff Status ∈ {Accepted, InProgress, Completed}.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_mode_with_accepted_status",
            $"(status IN ({StatusAccepted},{StatusInProgress},{StatusCompleted}) AND mode IS NOT NULL) OR " +
            $"(status NOT IN ({StatusAccepted},{StatusInProgress},{StatusCompleted}) AND mode IS NULL)"));

        // 3. DismissReason is non-null only when Status = Dismissed.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_dismiss_reason_only_when_dismissed",
            $"(status = {StatusDismissed} OR dismiss_reason IS NULL)"));

        // 4. AcceptedAt is non-null iff Status ∈ {Accepted, InProgress, Completed}.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_accepted_at_with_accepted_status",
            $"(status IN ({StatusAccepted},{StatusInProgress},{StatusCompleted}) AND accepted_at IS NOT NULL) OR " +
            $"(status NOT IN ({StatusAccepted},{StatusInProgress},{StatusCompleted}) AND accepted_at IS NULL)"));

        // 5. CompletedAt is non-null iff Status = Completed.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_completed_at_only_when_completed",
            $"(status = {StatusCompleted} AND completed_at IS NOT NULL) OR " +
            $"(status != {StatusCompleted} AND completed_at IS NULL)"));

        // 6. DurationDays between 1 and 30.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_photo_diary_requests_duration_days_range",
            "duration_days >= 1 AND duration_days <= 30"));
    }
}
