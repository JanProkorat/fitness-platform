using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="AutomationRule"/>.
/// </summary>
public class AutomationRuleConfiguration : IEntityTypeConfiguration<AutomationRule>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AutomationRule> builder)
    {
        builder.ToTable("automation_rules");

        builder.HasOne(r => r.OwnerProfessionalProfile)
            .WithMany()
            .HasForeignKey(r => r.OwnerProfessionalProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ClientProfile)
            .WithMany()
            .HasForeignKey(r => r.ClientProfileId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.HasOne(r => r.Questionnaire)
            .WithMany()
            .HasForeignKey(r => r.QuestionnaireId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // A deleted tag leaves the rule in place with no audience tag; it then covers nobody.
        builder.HasOne(r => r.AudienceTag)
            .WithMany()
            .HasForeignKey(r => r.AudienceTagId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        builder.HasIndex(r => new { r.OwnerProfessionalProfileId, r.ClientProfileId });
        builder.HasIndex(r => r.ClientProfileId);
        builder.HasIndex(r => r.QuestionnaireId);
        builder.HasIndex(r => r.AudienceTagId);
    }
}
