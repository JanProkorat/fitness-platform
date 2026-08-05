using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Regression coverage for #906. <see cref="WeeklyCheckInScheduler"/> and
/// <see cref="PhotoDiaryReminderScheduler"/> used to seed their tick cursor in an unguarded
/// block sitting between the alignment delay and the tick loop. That was the only
/// DB-touching call in either service that could throw out of <c>ExecuteAsync</c>: the tick
/// bodies inside the loop were already wrapped. A throw there faults the
/// <c>ExecuteAsync</c> task, and <c>HostOptions.BackgroundServiceExceptionBehavior</c>
/// (<c>StopHost</c> by default) then terminates the whole process.
///
/// These tests pin the seed as the throwing call, so that a future refactor which moves it
/// back outside the guard fails here rather than in CI as an unexplained
/// <c>ECONNREFUSED</c> from a dead API.
///
/// Scope note, stated deliberately: nothing in this suite runs these schedulers as hosted
/// services, and per #726 nothing should — a faulting scheduler combined with
/// <c>StopHost</c> cascades across xUnit collections, which is why
/// <c>RemoveBackgroundHostedServices()</c> strips them from every test factory. So no test
/// here asserts end-to-end that "the host did not stop". What is asserted is the property
/// that decides it: whether the seed's exception can escape the guard.
///
/// Uses a dedicated container and a minimal DI graph rather than the shared
/// <c>FitnessApiFactory</c> on purpose — dropping <c>weekly_check_ins</c> inside the shared
/// fixture would poison every sibling in <c>TestCollection</c>.
/// </summary>
public class SchedulerResilienceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .Build();

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();

        await using var db = BuildContext();
        await db.Database.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    private ApplicationDbContext BuildContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Builds a DI graph carrying only the database, which is all the cursor seed needs.
    /// The seed runs before <c>ProcessTickAsync</c>, so the services that the fuller tick
    /// would resolve are deliberately absent — if the seed ever stopped throwing here, the
    /// test would fail on a missing service rather than silently passing.
    /// </summary>
    private IServiceScopeFactory BuildScopeFactory()
    {
        var services = new ServiceCollection();
        services.AddScoped<ApplicationDbContext>(_ => BuildContext());
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private static IConfiguration EmptyConfiguration() =>
        new ConfigurationBuilder().AddInMemoryCollection().Build();

    private async Task DropTableAsync(string table)
    {
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP TABLE {table} CASCADE;";
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task WeeklyCheckInScheduler_TickWithMissingTable_ThrowsFromTheSeedSoTheGuardMustCatchIt()
    {
        await DropTableAsync("weekly_check_ins");

        var scheduler = new WeeklyCheckInScheduler(
            BuildScopeFactory(),
            NullLogger<WeeklyCheckInScheduler>.Instance,
            EmptyConfiguration());

        var tick = async () => await scheduler.TickAsync(
            new DateTime(2026, 8, 5, 12, 0, 0, DateTimeKind.Utc),
            TestContext.Current.CancellationToken);

        // 42P01 = undefined_table. This is the exact exception that used to escape
        // ExecuteAsync and stop the host; it now happens inside the loop's try/catch.
        (await tick.Should().ThrowAsync<PostgresException>())
            .Which.SqlState.Should().Be("42P01",
                "the cursor seed reads weekly_check_ins, so a dropped table must surface as undefined_table");
    }

    [Fact]
    public async Task PhotoDiaryReminderScheduler_TickWithMissingTable_ThrowsFromTheSeedSoTheGuardMustCatchIt()
    {
        await DropTableAsync("photo_diary_reminder_logs");

        var scheduler = new PhotoDiaryReminderScheduler(
            BuildScopeFactory(),
            NullLogger<PhotoDiaryReminderScheduler>.Instance);

        var tick = async () => await scheduler.TickAsync(
            new DateTime(2026, 8, 5, 12, 0, 0, DateTimeKind.Utc),
            TestContext.Current.CancellationToken);

        (await tick.Should().ThrowAsync<PostgresException>())
            .Which.SqlState.Should().Be("42P01",
                "the cursor seed reads photo_diary_reminder_logs, so a dropped table must surface as undefined_table");
    }
}
