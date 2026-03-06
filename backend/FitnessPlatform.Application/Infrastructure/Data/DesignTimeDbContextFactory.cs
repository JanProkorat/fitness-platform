using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FitnessPlatform.Application.Infrastructure.Data;

/// <summary>
/// Factory for creating <see cref="ApplicationDbContext"/> at design time (e.g., for EF Core migrations).
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    /// <inheritdoc />
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=fitness_dev;Username=fitness_admin;Password=fitness_dev_password")
            .UseSnakeCaseNamingConvention();
        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
