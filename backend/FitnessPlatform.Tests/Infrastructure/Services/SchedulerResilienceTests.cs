using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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
/// Two groups of tests, and the difference between them is load-bearing.
///
/// The two <c>ExecuteAsync</c> tests are the ones that protect this fix: they drive the code
/// the change actually touches, and they fail if the seed is hoisted back out of the guard.
/// Verified by reverting both production hunks and re-running — those two fail, the other
/// three pass.
///
/// The three <c>42P01</c> tests call <c>TickAsync</c>, which this change does NOT touch. They
/// establish that a dropped table produces an exception for the guard to absorb, and document
/// where it comes from: for <see cref="PhotoDiaryReminderScheduler"/> the seed is genuinely
/// isolated (table present but empty, so <c>ProcessTickAsync</c> returns early); for
/// <see cref="WeeklyCheckInScheduler"/> it is not, because <c>ProcessTickAsync</c> opens with
/// <c>SweepExpiredAsync</c>, which resolves only <see cref="IApplicationDbContext"/> and hits
/// the same dropped table — so a companion test isolates the sweep as that second reader.
/// These three do not discriminate the fix and are not claimed to.
///
/// On #726: it forbids leaving these schedulers registered as hosted services in a test
/// <c>WebApplicationFactory</c>, where a fault plus <c>StopHost</c> cascades across xUnit
/// collections — which is why <c>RemoveBackgroundHostedServices()</c> strips them from every
/// factory. It does NOT forbid <c>StartAsync</c> on a directly-constructed instance: no
/// <c>IHost</c> observes it, so <c>BackgroundServiceExceptionBehavior</c> never engages. That
/// is what makes the <c>ExecuteTask</c> assertion below both possible and safe.
///
/// No test here asserts end-to-end that a real host did not stop, because no real host is
/// involved. <c>ExecuteTask</c> not faulting is the complete proxy: <c>StopHost</c> has
/// exactly one trigger, and that is <c>ExecuteAsync</c>'s task faulting.
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
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP TABLE {table} CASCADE;";
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Named for what it actually pins: a missing table surfaces out of <c>TickAsync</c> as
    /// <c>42P01</c>, so the loop's guard has something to absorb. It does NOT isolate the
    /// seed — see the companion test below and this class's remarks.
    /// </summary>
    [Fact]
    public async Task WeeklyCheckInScheduler_TickWithMissingTable_Surfaces42P01ForTheGuardToAbsorb()
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
                "a dropped weekly_check_ins must surface as undefined_table for the guard to catch");
    }

    /// <summary>
    /// <c>SweepExpiredAsync</c> is a SECOND unguarded-if-hoisted DB call: it is the first
    /// statement of <c>ProcessTickAsync</c> and reads the same table as the seed. Skipping the
    /// seed via <see cref="WeeklyCheckInScheduler.SetLastTickAt"/> (which marks the cursor
    /// initialised without touching the database) isolates it, so the sweep is on record as a
    /// call that would also become fatal if anyone moved it outside the tick guard.
    /// </summary>
    [Fact]
    public async Task WeeklyCheckInScheduler_SweepWithMissingTable_ThrowsEvenWhenTheSeedIsSkipped()
    {
        await DropTableAsync("weekly_check_ins");

        var scheduler = new WeeklyCheckInScheduler(
            BuildScopeFactory(),
            NullLogger<WeeklyCheckInScheduler>.Instance,
            EmptyConfiguration());

        // Marks the cursor initialised, so TickAsync skips SeedCursorAsync entirely and the
        // only remaining reader of weekly_check_ins is the sweep.
        scheduler.SetLastTickAt(new DateTime(2026, 8, 5, 11, 55, 0, DateTimeKind.Utc));

        var tick = async () => await scheduler.TickAsync(
            new DateTime(2026, 8, 5, 12, 0, 0, DateTimeKind.Utc),
            TestContext.Current.CancellationToken);

        (await tick.Should().ThrowAsync<PostgresException>())
            .Which.SqlState.Should().Be("42P01",
                "the expiry sweep reads weekly_check_ins too, so it is fatal if hoisted out of the guard");
    }

    /// <summary>
    /// One of the two tests that fail on revert — see this class's remarks for why the
    /// <c>TickAsync</c> tests do not. <c>OverrideNow</c> is parked a millisecond short of a
    /// boundary with a one-minute interval, collapsing the alignment delay to ~1ms.
    /// </summary>
    [Fact]
    public async Task WeeklyCheckInScheduler_ExecuteAsyncWithMissingTable_LogsAndDoesNotFault()
    {
        await DropTableAsync("weekly_check_ins");

        var logger = new ErrorSignallingLogger<WeeklyCheckInScheduler>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CheckInTickIntervalMinutes"] = "1",
            })
            .Build();

        var scheduler = new WeeklyCheckInScheduler(BuildScopeFactory(), logger, configuration)
        {
            OverrideNow = new DateTime(2026, 8, 5, 12, 0, 59, 999, DateTimeKind.Utc),
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
