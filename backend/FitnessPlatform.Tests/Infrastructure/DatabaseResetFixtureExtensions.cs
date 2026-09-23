using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Test-only helper that resets a shared Postgres + Mongo pair back to a pristine,
/// freshly-migrated state — the same drop-schema/drop-collections technique the
/// app's own <c>ResetTestStateEndpoint</c> uses in production
/// (<c>Features/Testing/Reset/ResetTestStateEndpoint.cs</c>).
///
/// Part of #1104: several test classes used to boot a brand-new
/// <c>WebApplicationFactory</c> + Testcontainers pair per <c>[Fact]</c> so every test
/// started from a genuinely empty database. Converting those classes to a
/// collection-shared factory (one boot per class instead of per test) is a large
/// wall-clock win, but it means facts that assert exact counts or exercise
/// seed-idempotency now share state across the class — call this from the test
/// class's own <see cref="IAsyncLifetime.InitializeAsync"/> to restore that pristine
/// starting point before each fact.
/// </summary>
public static class DatabaseResetFixtureExtensions
{
    /// <summary>
    /// Drops and recreates the Postgres <c>public</c> schema (re-applying all EF
    /// migrations), drops every Mongo collection, then re-seeds Identity roles +
    /// the system admin user via <see cref="ApplicationDbContextSeed.SeedAsync"/>.
    /// </summary>
    /// <param name="services">The factory's root service provider.</param>
    public static async Task ResetPostgresAndMongoAsync(this IServiceProvider services)
    {
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.ExecuteSqlRawAsync("DROP SCHEMA public CASCADE");
            await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA public");

            var mongoDatabase = scope.ServiceProvider.GetRequiredService<IMongoDatabase>();
            var collectionNames = await (await mongoDatabase.ListCollectionNamesAsync()).ToListAsync();
            foreach (var name in collectionNames)
            {
                await mongoDatabase.DropCollectionAsync(name);
            }
        }

        // Re-applies migrations and re-seeds roles + the system admin user — mirrors
        // ResetTestStateEndpoint's own reset sequence in production.
        await ApplicationDbContextSeed.SeedAsync(services);
    }
}
