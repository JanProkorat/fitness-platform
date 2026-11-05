using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// Shared-container Postgres fixture for <see cref="SchedulerResilienceTests"/> (#1104 Phase B
/// — see <see cref="SharedTestContainers"/>): creates its own database inside the one shared
/// server once for the collection instead of per fact — each fact resets the schema back to
/// fully-migrated in its own <see cref="IAsyncLifetime.InitializeAsync"/> because every fact
/// drops a table (<c>weekly_check_ins</c> or <c>photo_diary_reminder_logs</c>) that must exist
/// before that fact runs.
/// </summary>
public class SchedulerResilienceContainerFixture(SharedTestContainers sharedContainers) : IAsyncLifetime
{
    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync() =>
        ConnectionString = await sharedContainers.CreatePostgresDatabaseAsync("scheduler_resilience");

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}

[CollectionDefinition("SchedulerResilience")]
public class SchedulerResilienceCollection : ICollectionFixture<SchedulerResilienceContainerFixture>;

/// <summary>
/// Regression coverage for #906. <see cref="PhotoDiaryReminderScheduler"/> used to seed its tick
/// cursor in an unguarded block between the alignment delay and the tick loop. A throw there faults
/// the <c>ExecuteAsync</c> task, and <c>HostOptions.BackgroundServiceExceptionBehavior</c>
/// (<c>StopHost</c> by default) then terminates the whole process.
///
/// The <c>ExecuteAsync</c> test protects the fix: it fails if the seed is hoisted back out of the
/// guard. The <c>TickAsync</c> test only documents that a dropped table surfaces as <c>42P01</c>
/// from the seed, and does not discriminate the fix.
///
/// Uses a dedicated container and a minimal DI graph rather than the shared
/// <c>FitnessApiFactory</c> on purpose — dropping a table inside the shared fixture would poison
/// every sibling in <c>TestCollection</c>. Directly-constructed instances are safe under #726: no
/// <c>IHost</c> observes them, so <c>BackgroundServiceExceptionBehavior</c> never engages.
/// </summary>
[Collection("SchedulerResilience")]
public class SchedulerResilienceTests(SchedulerResilienceContainerFixture containerFixture) : IAsyncLifetime
{
    private string ConnectionString => containerFixture.ConnectionString;

    public async ValueTask InitializeAsync()
    {
        await using var db = BuildContext();
        await db.Database.ExecuteSqlRawAsync("DROP SCHEMA IF EXISTS public CASCADE");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA public");
        await db.Database.MigrateAsync();
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    private ApplicationDbContext BuildContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString)
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Builds a DI graph carrying only the database. That is all either the cursor seed or
    /// <c>SweepExpiredAsync</c> needs, and it is deliberately too thin for the rest of a tick
    /// — anything reaching the notification or realtime services fails loudly on a missing
    /// registration rather than quietly doing real work against the test container.
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

    /// <summary>
    /// Signals the first Error-level log. Lets the ExecuteAsync tests below wait on the
    /// scheduler actually having caught something, rather than sleeping a fixed interval.
    /// </summary>
    private sealed class ErrorSignallingLogger<T> : ILogger<T>
    {
        private readonly TaskCompletionSource _firstError =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task FirstError => _firstError.Task;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Error)
            {
                _firstError.TrySetResult();
            }
        }
    }

    /// <summary>
    /// Races the scheduler logging an error (fixed behaviour) against <c>ExecuteAsync</c>
    /// completing — with a dropped table the latter means it faulted, which is the bug.
    /// Bounded, so a hang fails the test instead of stalling the suite.
    /// </summary>
    private static async Task WaitForErrorOrExitAsync(Task firstError, Task executeTask)
    {
        var timeout = Task.Delay(TimeSpan.FromSeconds(60));
        var finished = await Task.WhenAny(firstError, executeTask, timeout);

        finished.Should().NotBeSameAs(timeout,
            "the scheduler should either log the failure and keep running, or exit — not hang");
    }

    private async Task DropTableAsync(string table)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP TABLE {table} CASCADE;";
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Same discriminating check for the other scheduler. Its alignment is to <c>:00</c>, so
    /// parking <c>OverrideNow</c> at <c>11:59:59.999</c> collapses the delay to ~1ms.
    /// </summary>
    [Fact]
    public async Task PhotoDiaryReminderScheduler_ExecuteAsyncWithMissingTable_LogsAndDoesNotFault()
    {
        await DropTableAsync("photo_diary_reminder_logs");

        var logger = new ErrorSignallingLogger<PhotoDiaryReminderScheduler>();

        var scheduler = new PhotoDiaryReminderScheduler(BuildScopeFactory(), logger)
        {
            OverrideNow = new DateTime(2026, 8, 5, 11, 59, 59, 999, DateTimeKind.Utc),
        };

        await scheduler.StartAsync(CancellationToken.None);
        try
        {
            scheduler.ExecuteTask.Should().NotBeNull("StartAsync must have begun ExecuteAsync");
            await WaitForErrorOrExitAsync(logger.FirstError, scheduler.ExecuteTask!);

            scheduler.ExecuteTask!.IsFaulted.Should().BeFalse(
                "an unguarded cursor seed faults ExecuteAsync, which is what lets StopHost kill the API");
        }
        finally
        {
            await scheduler.StopAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Here the seed IS isolated: with <c>photo_diary_reminder_logs</c> gone but
    /// <c>photo_diary_requests</c> present and empty, <c>ProcessTickAsync</c> finds no
    /// candidates and returns before resolving any further service — so only a throwing seed
    /// can satisfy this assertion.
    /// </summary>
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
