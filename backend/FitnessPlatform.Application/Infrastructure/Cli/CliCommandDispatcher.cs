using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Application.Seed;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Application.Infrastructure.Cli;

/// <summary>
/// Dispatches the four one-shot CLI commands. This is the only place these
/// commands are parsed and executed — <see cref="TryHandleAsync"/> is called
/// once from <c>Program.cs</c>, before <c>app.Run()</c>. A <c>true</c> return
/// means one of the commands ran and <c>Program.cs</c> MUST return
/// immediately, without falling through to the unconditional
/// <c>MongoIndexInitializer.StartAsync</c> call further down that file (or to
/// <c>app.Run()</c> itself) — see the reciprocal comment at that call site.
/// </summary>
internal static class CliCommandDispatcher
{
    /// <summary>
    /// Parses <paramref name="args"/> into a single <see cref="CliCommand"/>.
    /// Pure function, no side effects — matches the original inline
    /// <c>args.Contains(...)</c> checks exactly: each flag is looked up
    /// independently anywhere in the array (position-independent, exact
    /// element match — so <c>--qa-seed</c> never triggers <c>--seed</c>), the
    /// first match in this fixed order wins, and an empty or non-matching
    /// array yields <see cref="CliCommand.None"/>. Safe to call with the
    /// empty <c>args</c> the <c>WebApplicationFactory&lt;Program&gt;</c> test
    /// host boots with.
    /// </summary>
    internal static CliCommand ParseCommand(string[] args)
    {
        if (args.Contains("--seed"))
        {
            return CliCommand.Seed;
        }

        if (args.Contains("--qa-seed"))
        {
            return CliCommand.QaSeed;
        }

        if (args.Contains("--backfill-photo-descriptions"))
        {
            return CliCommand.BackfillPhotoDescriptions;
        }

        if (args.Contains("--backfill-plan-goals"))
        {
            return CliCommand.BackfillPlanGoals;
        }

        return CliCommand.None;
    }

    /// <summary>
    /// Runs the one-shot command <paramref name="args"/> selects, if any.
    /// Returns <c>true</c> when a command ran — the caller MUST return
    /// immediately in that case. Returns <c>false</c> when no one-shot flag
    /// was present, meaning normal web-host startup should continue.
    /// </summary>
    internal static async Task<bool> TryHandleAsync(WebApplication app, string[] args)
    {
        switch (ParseCommand(args))
        {
            case CliCommand.Seed:
                await RunSeedAsync(app);
                return true;

            case CliCommand.QaSeed:
                await RunQaSeedAsync(app);
                return true;

            case CliCommand.BackfillPhotoDescriptions:
                await RunBackfillPhotoDescriptionsAsync(app);
                return true;

            case CliCommand.BackfillPlanGoals:
                await RunBackfillPlanGoalsAsync(app);
                return true;

            case CliCommand.None:
            default:
                return false;
        }
    }

    private static async Task RunSeedAsync(WebApplication app)
    {
        // This command's caller (Program.cs) returns immediately once
        // TryHandleAsync reports true — see that call site's comment and this
        // type's own doc comment. That contract, not "further down this
        // file", is what guarantees MongoIndexInitializer.StartAsync runs
        // exactly once per process: the unconditional call near app.Run() is
        // never reached on this path. So the unique indexes (e.g. externalId)
        // need to be created explicitly here BEFORE MongoSeeder inserts
        // anything — otherwise the seeded catalog has no uniqueness
        // guarantee, and a stray duplicate in seed data would go unnoticed
        // instead of failing loudly. Index creation is idempotent, so
        // re-running --seed against an already-indexed database is safe too.
        using (var seedMigrationScope = app.Services.CreateScope())
        {
            var seedMigrationInitializer = seedMigrationScope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();
            await seedMigrationInitializer.StartAsync(CancellationToken.None);
        }

        await ApplicationDbContextSeed.SeedAsync(app.Services);
        await MongoSeeder.SeedAsync(app.Services);
    }

    private static async Task RunQaSeedAsync(WebApplication app)
    {
        // QA fixture for the docker-compose end-to-end harness. Order matters:
        // roles first (QaSeedRunner assigns roles to its users), then the QA users
        // themselves, then Mongo. Note (#809): MongoSeeder's catalog recipes/workout
        // templates no longer gate on a nutritionist existing — the old per-nutritionist
        // private-recipe cloning was removed; catalog recipes are public and owned by
        // the system admin user regardless of which (if any) nutritionists exist.
        // QaSeedRunner still runs before MongoSeeder here so the QA fixture users/plans
        // and the public catalog land in one deterministic pass on cold boot. Idempotent
        // across reruns.
        //
        // Same index-creation-before-seeders requirement as RunSeedAsync above — the
        // docker-compose e2e harness boots with --qa-seed, so this path is reachable in
        // our own tooling, not just a theoretical prod scenario. Same "runs exactly once
        // per process" guarantee via the TryHandleAsync(true) / Program.cs-returns
        // contract described in RunSeedAsync's remarks and this type's own doc comment.
        using (var qaSeedMigrationScope = app.Services.CreateScope())
        {
            var qaSeedMigrationInitializer = qaSeedMigrationScope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();
            await qaSeedMigrationInitializer.StartAsync(CancellationToken.None);
        }

        await ApplicationDbContextSeed.SeedAsync(app.Services);
        await QaSeedRunner.SeedAsync(app.Services);
        await MongoSeeder.SeedAsync(app.Services);
    }

    private static async Task RunBackfillPhotoDescriptionsAsync(WebApplication app)
    {
        // One-shot backfill: copy per-photo notes from MongoDB into PlanPhoto.Description in Postgres.
        // Usage: dotnet run -- --backfill-photo-descriptions
        using var scope = app.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<PhotoDescriptionBackfillService>();
        var (mealCount, dayCount) = await service.BackfillAsync();
        Console.WriteLine($"Meal photos updated: {mealCount}");
        Console.WriteLine($"Day photos updated:  {dayCount}");
    }

    private static async Task RunBackfillPlanGoalsAsync(WebApplication app)
    {
        // One-shot backfill: copy goal + targetWeightKg from ClientOnboardingData onto existing
        // NutritionPlan and TrainingPlan MongoDB documents that were created before the plan-level
        // goal fields were introduced.
        // Usage: dotnet run -- --backfill-plan-goals
        using var scope = app.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<PlanGoalBackfillService>();
        var (nutritionCount, trainingCount) = await service.BackfillAsync();
        Console.WriteLine($"Nutrition plans updated: {nutritionCount}");
        Console.WriteLine($"Training plans updated:  {trainingCount}");
    }
}
