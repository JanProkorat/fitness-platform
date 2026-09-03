using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitnessPlatform.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="CoachSubscription"/>.
/// </summary>
public class CoachSubscriptionConfiguration : IEntityTypeConfiguration<CoachSubscription>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<CoachSubscription> builder)
    {
        // A professional has at most one subscription.
        builder.HasIndex(cs => cs.ProfessionalProfileId)
            .IsUnique();

        builder.HasOne(cs => cs.ProfessionalProfile)
            .WithOne(pp => pp.CoachSubscription)
            .HasForeignKey<CoachSubscription>(cs => cs.ProfessionalProfileId);

        builder.HasOne(cs => cs.SubscriptionPlan)
            .WithMany()
            .HasForeignKey(cs => cs.SubscriptionPlanId);
    }
}
