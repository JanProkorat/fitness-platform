using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> — the
/// shared fetch-check-replace-409 skeleton extracted from the NutritionPlans/TrainingPlans
/// version-gated mutation endpoints (issue #659). Uses <see cref="NutritionPlan"/> as a stand-in
/// document type; the guard itself is generic and has no NutritionPlans-specific behavior.
/// No Docker required — the Mongo collection is mocked.
/// </summary>
public class PlanConcurrencyGuardTests
{
    private readonly PlanConcurrencyGuard _guard = new();

    private static NutritionPlan CreatePlan(Guid externalId, int version) =>
        new()
        {
            ExternalId = externalId,
            ClientId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = "Test Plan",
            Version = version,
            Weeks = []
        };

    private static IMongoCollection<NutritionPlan> CreateMockCollection(
        NutritionPlan? plan, long replaceModifiedCount = 1)
    {
        var collection = Substitute.For<IMongoCollection<NutritionPlan>>();

        var cursor = Substitute.For<IAsyncCursor<NutritionPlan>>();
        var docs = plan is null ? [] : new List<NutritionPlan> { plan };
        var moved = false;
        cursor.Current.Returns(docs);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });

        collection.FindAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<FindOptions<NutritionPlan, NutritionPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(cursor);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(replaceModifiedCount);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<NutritionPlan>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        return collection;
    }

    private static readonly FilterDefinition<NutritionPlan> AnyFilter = Builders<NutritionPlan>.Filter.Empty;

    [Fact]
    public async Task ReplaceWithVersionGuardAsync_DocumentNotFound_ReturnsNotFound()
    {
        var collection = CreateMockCollection(plan: null);
        var mutateCalled = false;

        var result = await _guard.ReplaceWithVersionGuardAsync(
            collection, AnyFilter, AnyFilter, expectedVersion: 1,
            getVersion: p => p.Version,
            mutate: (_, _) => { mutateCalled = true; return Task.FromResult(true); },
            ct: TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(PlanConcurrencyOutcome.NotFound);
        result.Document.Should().BeNull();
        mutateCalled.Should().BeFalse();
    }

    [Fact]
    public async Task ReplaceWithVersionGuardAsync_VersionMismatch_ReturnsVersionConflict_WithoutCallingMutate()
    {
        var plan = CreatePlan(Guid.NewGuid(), version: 2);
        var collection = CreateMockCollection(plan);
        var mutateCalled = false;

        var result = await _guard.ReplaceWithVersionGuardAsync(
            collection, AnyFilter, AnyFilter, expectedVersion: 1,
            getVersion: p => p.Version,
            mutate: (_, _) => { mutateCalled = true; return Task.FromResult(true); },
            ct: TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(PlanConcurrencyOutcome.VersionConflict);
        mutateCalled.Should().BeFalse();
        await collection.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReplaceWithVersionGuardAsync_MutateReturnsFalse_ReturnsHandledByMutator_WithoutReplacing()
    {
        var plan = CreatePlan(Guid.NewGuid(), version: 1);
        var collection = CreateMockCollection(plan);

        var result = await _guard.ReplaceWithVersionGuardAsync(
            collection, AnyFilter, AnyFilter, expectedVersion: 1,
            getVersion: p => p.Version,
            mutate: (_, _) => Task.FromResult(false),
            ct: TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(PlanConcurrencyOutcome.HandledByMutator);
        result.Document.Should().BeNull();
        await collection.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReplaceWithVersionGuardAsync_ReplaceModifiedCountZero_ReturnsReplaceConflict()
    {
        var plan = CreatePlan(Guid.NewGuid(), version: 1);
        var collection = CreateMockCollection(plan, replaceModifiedCount: 0);

        var result = await _guard.ReplaceWithVersionGuardAsync(
            collection, AnyFilter, AnyFilter, expectedVersion: 1,
            getVersion: p => p.Version,
            mutate: (_, _) => Task.FromResult(true),
            ct: TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(PlanConcurrencyOutcome.ReplaceConflict);
        result.Document.Should().BeNull();
    }

    [Fact]
    public async Task ReplaceWithVersionGuardAsync_Success_CallsMutateThenReplaces_AndReturnsDocument()
    {
        var plan = CreatePlan(Guid.NewGuid(), version: 1);
        var collection = CreateMockCollection(plan);

        var result = await _guard.ReplaceWithVersionGuardAsync(
            collection, AnyFilter, AnyFilter, expectedVersion: 1,
            getVersion: p => p.Version,
            mutate: (p, _) =>
            {
                p.Name = "Mutated Name";
                p.Version += 1;
                return Task.FromResult(true);
            },
            ct: TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(PlanConcurrencyOutcome.Success);
        result.Document.Should().NotBeNull();
        result.Document!.Name.Should().Be("Mutated Name");
        result.Document.Version.Should().Be(2);

        await collection.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Name == "Mutated Name"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
