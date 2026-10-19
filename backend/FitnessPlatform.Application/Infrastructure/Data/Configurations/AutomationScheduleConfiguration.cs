using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="AutomationSchedule"/>.
/// </summary>
public class AutomationScheduleConfiguration : IEntityTypeConfiguration<AutomationSchedule>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AutomationSchedule> builder)
    {
        builder.ToTable("automation_schedules");

        builder.HasIndex(s => new { s.AutomationRuleId, s.ClientProfileId }).IsUnique();
        builder.HasIndex(s => s.ClientProfileId);

        // The worker's "what is due" scan.
        builder.HasIndex(s => s.NextRunAt);

        builder.HasOne(s => s.AutomationRule)
            .WithMany()
            .HasForeignKey(s => s.AutomationRuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.ClientProfile)
            .WithMany()
            .HasForeignKey(s => s.ClientProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
