using FormUp.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FormUp.Application.Infrastructure.Data.Configurations;

/// <summary>
/// EF Core configuration for <see cref="SubscriptionPlan"/>.
/// </summary>
public class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<SubscriptionPlan> builder)
    {
        builder.HasIndex(sp => sp.Code)
            .IsUnique();
    }
}
