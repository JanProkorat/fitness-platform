using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using MongoDB.Driver;
using NSubstitute;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests for <see cref="PlanPhotoContextResolver"/> (#1038). Boots a
/// real MongoDB container because the mock Mongo test harness used by the two consuming
/// endpoints' own test suites (<c>PlanTestHelpers.CreateMockMongo</c>) stubs <c>FindAsync</c> to
/// return every seeded document regardless of the <c>FilterDefinition</c> passed in — a test
/// written against it cannot fail no matter what the resolver's filter does, so it cannot prove
/// the <c>Eq(ClientId)</c> clause is actually applied. Mirrors
/// <see cref="LibrarySearchHelperTests"/> and
/// <see cref="FitnessPlatform.Tests.Endpoints.Recipes.OwnerScopedVisibilityFilterTests"/>: an
/// <see cref="IMongoContext"/> substitute whose NutritionPlans/TrainingPlans properties return
/// real, containerised collections.
/// </summary>
public class PlanPhotoContextResolverTests : IAsyncLifetime
{
    // Wide timeout to absorb contention when the compose harness is also running.
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<NutritionPlan> _nutritionPlans = null!;
    private IMongoCollection<TrainingPlan> _trainingPlans = null!;
    private IMongoContext _mongoContext = null!;

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb = mongoClient.GetDatabase("fitness_planphotocontextresolver_test");
        _nutritionPlans = mongoDb.GetCollection<NutritionPlan>("nutritionPlans");
        _trainingPlans = mongoDb.GetCollection<TrainingPlan>("trainingPlans");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.NutritionPlans.Returns(_nutritionPlans);
        mongoContext.TrainingPlans.Returns(_trainingPlans);
        _mongoContext = mongoContext;
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static NutritionPlan MakeNutritionPlan(Guid externalId, Guid clientId, Guid nutritionistId) =>
        new()
        {
            ExternalId = externalId,
            ClientId = clientId,
            NutritionistId = nutritionistId,
            Name = "Test Nutrition Plan",
            DateCreated = DateTime.UtcNow,
        };

    private static TrainingPlan MakeTrainingPlan(Guid externalId, Guid clientId, Guid trainerId) =>
        new()
        {
            ExternalId = externalId,
            ClientId = clientId,
            TrainerId = trainerId,
            Name = "Test Training Plan",
            DateCreated = DateTime.UtcNow,
        };

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Cross-client isolation (round-2 design gate's core AC): the plan id exists, but under a
    /// DIFFERENT client id. Must resolve to null — the case that catches a dropped
    /// <c>Eq(ClientId)</c> clause on the NUTRITION filter (resolver line 40), which the mock
    /// Mongo harness cannot.
    /// </summary>
    [Fact]
    public async Task ResolveAsync_PlanIdExistsUnderDifferentClientId_ReturnsNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var ownerClientId = Guid.NewGuid();
        var callerClientId = Guid.NewGuid();

        await _nutritionPlans.InsertOneAsync(
            MakeNutritionPlan(planId, ownerClientId, Guid.NewGuid()), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, callerClientId, ct);

        result.PlanType.Should().BeNull();
        result.LinkId.Should().BeNull();
        result.ProfessionalUserId.Should().BeNull();
    }

    /// <summary>
    /// Training-side companion to <see cref="ResolveAsync_PlanIdExistsUnderDifferentClientId_ReturnsNull"/>.
    /// Nothing is seeded in nutrition, so this exercises the TRAINING filter's <c>Eq(ClientId)</c>
    /// clause (resolver line 53) in isolation — a nutrition-only test cannot catch a dropped
    /// clause on the fallback filter, since the nutrition miss is what reaches it in the first
    /// place.
    /// </summary>
    [Fact]
    public async Task ResolveAsync_TrainingPlanIdExistsUnderDifferentClientId_ReturnsNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var ownerClientId = Guid.NewGuid();
        var callerClientId = Guid.NewGuid();

        await _trainingPlans.InsertOneAsync(
            MakeTrainingPlan(planId, ownerClientId, Guid.NewGuid()), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, callerClientId, ct);

        result.PlanType.Should().BeNull();
        result.LinkId.Should().BeNull();
        result.ProfessionalUserId.Should().BeNull();
    }

    /// <summary>
    /// Nutrition-first precedence: the same plan id seeded into BOTH collections for the same
    /// client must resolve to nutrition — the training collection must not decide the outcome.
    /// </summary>
    [Fact]
    public async Task ResolveAsync_PlanIdSeededInBothCollections_ResolvesToNutrition()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var nutritionistId = Guid.NewGuid();
        var trainerId = Guid.NewGuid();

        await _nutritionPlans.InsertOneAsync(
            MakeNutritionPlan(planId, clientId, nutritionistId), cancellationToken: ct);
        await _trainingPlans.InsertOneAsync(
            MakeTrainingPlan(planId, clientId, trainerId), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, clientId, ct);

        result.PlanType.Should().Be(PlanPhotoType.Nutrition);
        result.LinkId.Should().Be(planId);
        result.ProfessionalUserId.Should().Be(nutritionistId);
    }

    [Fact]
    public async Task ResolveAsync_NutritionPlanOnlyMatch_ResolvesToNutrition()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var nutritionistId = Guid.NewGuid();

        await _nutritionPlans.InsertOneAsync(
            MakeNutritionPlan(planId, clientId, nutritionistId), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, clientId, ct);

        result.PlanType.Should().Be(PlanPhotoType.Nutrition);
        result.LinkId.Should().Be(planId);
        result.ProfessionalUserId.Should().Be(nutritionistId);
    }

    [Fact]
    public async Task ResolveAsync_NoNutritionMatch_FallsBackToTraining()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var trainerId = Guid.NewGuid();

        await _trainingPlans.InsertOneAsync(
            MakeTrainingPlan(planId, clientId, trainerId), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, clientId, ct);

        result.PlanType.Should().Be(PlanPhotoType.Training);
        result.LinkId.Should().Be(planId);
        result.ProfessionalUserId.Should().Be(trainerId);
    }

    [Fact]
    public async Task ResolveAsync_NeitherCollectionMatches_ReturnsNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var clientId = Guid.NewGuid();

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, Guid.NewGuid(), clientId, ct);

        result.PlanType.Should().BeNull();
        result.LinkId.Should().BeNull();
        result.ProfessionalUserId.Should().BeNull();
    }

    /// <summary>
    /// A <see cref="Guid.Empty"/> <c>NutritionistId</c> must collapse to a null professional id.
    /// Nutrition-side only — the resolver applies the identical <c>!= Guid.Empty</c> collapse to
    /// <c>TrainerId</c>, but that branch has no dedicated test here.
    /// </summary>
    [Fact]
    public async Task ResolveAsync_NutritionistIdIsGuidEmpty_ProfessionalUserIdIsNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var planId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        await _nutritionPlans.InsertOneAsync(
            MakeNutritionPlan(planId, clientId, Guid.Empty), cancellationToken: ct);

        var result = await PlanPhotoContextResolver.ResolveAsync(_mongoContext, planId, clientId, ct);

        result.PlanType.Should().Be(PlanPhotoType.Nutrition);
        result.ProfessionalUserId.Should().BeNull();
    }
}
