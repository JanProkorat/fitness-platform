using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="AutomationClientOverride"/>.
/// </summary>
public class AutomationClientOverrideConfiguration : IEntityTypeConfiguration<AutomationClientOverride>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AutomationClientOverride> builder)
    {
        builder.ToTable("automation_client_overrides");

        builder.HasIndex(o => new { o.AutomationRuleId, o.ClientProfileId }).IsUnique();
        builder.HasIndex(o => o.ClientProfileId);

        builder.HasOne(o => o.AutomationRule)
            .WithMany(r => r.Overrides)
            .HasForeignKey(o => o.AutomationRuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(o => o.ClientProfile)
            .WithMany()
            .HasForeignKey(o => o.ClientProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
