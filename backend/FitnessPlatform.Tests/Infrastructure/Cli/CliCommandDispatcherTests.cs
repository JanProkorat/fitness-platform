using FitnessPlatform.Application.Infrastructure.Cli;
using FluentAssertions;

namespace FitnessPlatform.Tests.Infrastructure.Cli;

/// <summary>
/// Unit tests for <see cref="CliCommandDispatcher.ParseCommand"/> — the pure
/// argument-matching function that replaced four independent
/// <c>args.Contains(...)</c> checks. Covers the one behaviour-change vector
/// identified in review: precedence order, position independence, exact
/// element matching, and the empty-args case the
/// <c>WebApplicationFactory&lt;Program&gt;</c> test host boots with.
/// </summary>
public class CliCommandDispatcherTests
{
    [Fact]
    public void ParseCommand_EmptyArgs_ReturnsNone()
    {
        var result = CliCommandDispatcher.ParseCommand([]);

        result.Should().Be(CliCommand.None);
    }

    [Fact]
    public void ParseCommand_NoRecognizedFlag_ReturnsNone()
    {
        var result = CliCommandDispatcher.ParseCommand(["--unrelated-flag"]);

        result.Should().Be(CliCommand.None);
    }

    [Fact]
    public void ParseCommand_SeedFlag_ReturnsSeed()
    {
        var result = CliCommandDispatcher.ParseCommand(["--seed"]);

        result.Should().Be(CliCommand.Seed);
    }

    [Fact]
    public void ParseCommand_QaSeedFlag_ReturnsQaSeed()
    {
        var result = CliCommandDispatcher.ParseCommand(["--qa-seed"]);

        result.Should().Be(CliCommand.QaSeed);
    }

    [Fact]
    public void ParseCommand_BackfillPhotoDescriptionsFlag_ReturnsBackfillPhotoDescriptions()
    {
        var result = CliCommandDispatcher.ParseCommand(["--backfill-photo-descriptions"]);

        result.Should().Be(CliCommand.BackfillPhotoDescriptions);
    }

    [Fact]
    public void ParseCommand_BackfillPlanGoalsFlag_ReturnsBackfillPlanGoals()
    {
        var result = CliCommandDispatcher.ParseCommand(["--backfill-plan-goals"]);

        result.Should().Be(CliCommand.BackfillPlanGoals);
    }

    [Fact]
    public void ParseCommand_DropLegacyTrainingCollectionsFlag_ReturnsDropLegacyTrainingCollections()
    {
        var result = CliCommandDispatcher.ParseCommand(["--drop-legacy-training-collections"]);

        result.Should().Be(CliCommand.DropLegacyTrainingCollections);
    }

    [Fact]
    public void ParseCommand_NoFlag_DoesNotTriggerTheDestructiveDrop()
    {
        // The only destructive command in the seam must never be selected by a boot with
        // no flags (the WebApplicationFactory<Program> test host boots with an empty array)
        // nor by an unrelated flag.
        CliCommandDispatcher.ParseCommand([]).Should().Be(CliCommand.None);
        CliCommandDispatcher.ParseCommand(["--seed"]).Should().Be(CliCommand.Seed);
        CliCommandDispatcher.ParseCommand(["--drop-legacy"]).Should().Be(CliCommand.None);
    }

    [Fact]
    public void ParseCommand_QaSeedFlag_DoesNotTriggerSeed()
    {
        // --qa-seed must NOT be treated as --seed via a substring/prefix match —
        // exact element matching only.
        var result = CliCommandDispatcher.ParseCommand(["--qa-seed"]);

        result.Should().Be(CliCommand.QaSeed);
    }

    [Fact]
    public void ParseCommand_FlagNotFirstElement_StillMatches()
    {
        // Matching is position-independent — args.Contains(...) over the whole array.
        var result = CliCommandDispatcher.ParseCommand(["--verbose", "--backfill-plan-goals"]);

        result.Should().Be(CliCommand.BackfillPlanGoals);
    }

    [Fact]
    public void ParseCommand_MultipleFlagsPresent_FirstInFixedOrderWins()
    {
        // Fixed precedence: --seed > --qa-seed > --backfill-photo-descriptions >
        // --backfill-plan-goals, regardless of array order.
        var result = CliCommandDispatcher.ParseCommand(
            ["--backfill-plan-goals", "--backfill-photo-descriptions", "--qa-seed", "--seed"]);

        result.Should().Be(CliCommand.Seed);
    }

    [Fact]
    public void ParseCommand_QaSeedAndBackfillFlags_QaSeedWins()
    {
        var result = CliCommandDispatcher.ParseCommand(
            ["--backfill-plan-goals", "--qa-seed"]);

        result.Should().Be(CliCommand.QaSeed);
    }
}
