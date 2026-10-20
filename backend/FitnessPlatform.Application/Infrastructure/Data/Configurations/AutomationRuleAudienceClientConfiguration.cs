using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="AutomationRuleAudienceClient"/>.
/// </summary>
public class AutomationRuleAudienceClientConfiguration : IEntityTypeConfiguration<AutomationRuleAudienceClient>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AutomationRuleAudienceClient> builder)
    {
        builder.ToTable("automation_rule_audience_clients");

        builder.HasIndex(a => new { a.AutomationRuleId, a.ClientProfileId }).IsUnique();
        builder.HasIndex(a => a.ClientProfileId);

        builder.HasOne(a => a.AutomationRule)
            .WithMany(r => r.AudienceClients)
            .HasForeignKey(a => a.AutomationRuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.ClientProfile)
            .WithMany()
            .HasForeignKey(a => a.ClientProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
