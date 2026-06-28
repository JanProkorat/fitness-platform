using FastEndpoints;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Seed;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Testing.Reset;

/// <summary>
/// POST /test/reset — drops and recreates the Postgres schema (via EF migrations),
/// drops all MongoDB collections, and re-runs the QA seed fixture.
///
/// SECURITY NOTE: This endpoint intentionally has NO [Authorize] attribute.
/// The single gate (Testing:Enabled=true) is enforced at REQUEST TIME in HandleAsync.
/// When the condition fails, the endpoint returns 404 so its existence is not advertised
/// via 405/401. A future reviewer must NOT add [Authorize] here — it would break the
/// "wiped DB has no users" use-case where the endpoint is called immediately after
/// reset before any user exists.
///
/// The Testing:Enabled flag is the sole protection. Production deployments must never
/// set this flag — render.yaml and the production app settings intentionally omit it.
/// The environment name is no longer checked; callers in CI test harnesses that run
/// under a non-Development environment name (e.g. "Testing") are now permitted as long
/// as the flag is set.
///
/// The endpoint is always registered in the route table (no startup-time filter)
/// so that test WebApplicationFactory instances that share the FastEndpoints static
/// route cache do not inadvertently exclude it from a later factory configured with
/// Testing:Enabled=true (FastEndpoints 8.x builds the route table once per process).
///
/// SWAGGER NOTE: This endpoint is hidden from the generated OpenAPI document in all
/// environments via <c>Description(b => b.ExcludeFromDescription())</c>. Even though
/// app.UseSwaggerGen() is unconditional in Program.cs, the /test/reset route will
/// never appear in the swagger.json schema.
/// </summary>
public class ResetTestStateEndpoint(
    ApplicationDbContext db,
    IMongoDatabase mongoDatabase,
    IServiceProvider serviceProvider,
    IConfiguration configuration) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/test/reset");
        AllowAnonymous();
        Description(b => b.ExcludeFromDescription());
        Summary(s =>
        {
            s.Summary = "Reset test state";
            s.Description = "Drops and recreates PostgreSQL schema, drops MongoDB collections, and re-seeds QA fixture. " +
                             "Only available when Testing:Enabled=true. The environment name is not checked.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        // Single gate evaluated at request time:
        //   Testing:Enabled must be true in configuration.
        // The environment name is NOT checked — the absent flag is the sole production
        // protection. Production deployments must never set Testing:Enabled=true.
        // When the gate fails, return 404 so the response surface is identical to the
        // endpoint not existing at all.
        var testingEnabled = configuration.GetValue<bool>("Testing:Enabled");
        if (!testingEnabled)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 1. Drop + recreate Postgres schema via raw SQL + EF migrations.
        //    EnsureDeletedAsync drops the whole database, which fails in Postgres
        //    when other connections exist (error 55006: "cannot drop the currently
        //    open database"). Instead we nuke the public schema and recreate it,
        //    then re-apply all EF migrations to rebuild the full schema fresh.
        await db.Database.ExecuteSqlRawAsync("DROP SCHEMA public CASCADE", ct);
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA public", ct);
        await db.Database.MigrateAsync(ct);

        // 2. Drop + recreate Mongo collections
        var collectionNames = await (await mongoDatabase.ListCollectionNamesAsync(cancellationToken: ct)).ToListAsync(cancellationToken: ct);
        foreach (var name in collectionNames)
        {
            await mongoDatabase.DropCollectionAsync(name, ct);
        }

        // 3. Re-seed roles (Identity roles must exist before QaSeedRunner assigns them)
        await ApplicationDbContextSeed.SeedAsync(serviceProvider);

        // 4. Re-seed QA users + Mongo data
        await QaSeedRunner.SeedAsync(serviceProvider);
        await MongoSeeder.SeedAsync(serviceProvider);

        await Send.NoContentAsync(ct);
    }
}
