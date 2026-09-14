using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.GetFood;
using FitnessPlatform.Application.Features.Foods.SearchFoods;
using FitnessPlatform.Application.Features.Recipes.GetRecipe;
using FitnessPlatform.Application.Features.Recipes.SearchRecipes;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Testcontainers integration tests for the own-or-public visibility filter guard added in #992
/// to <see cref="SearchRecipesEndpoint"/>, <see cref="GetRecipeEndpoint"/>, and
/// <see cref="SearchFoodsEndpoint"/>. Boots a real MongoDB container because
/// <see cref="RecipeTestHelpers.CreateMockMongo"/> stubs <c>FindAsync</c> to return every seeded
/// document regardless of the <c>FilterDefinition</c> passed in — the filter is never evaluated,
/// so a test written against that harness cannot fail no matter what the endpoint's filter does
/// and proves nothing about the <see cref="Guid.Empty"/>-caller guard. Mirrors
/// <see cref="FitnessPlatform.Tests.Services.LibrarySearchHelperTests"/>'s approach: an
/// <see cref="IMongoContext"/> substitute whose Recipes/Foods properties return real,
/// containerised collections.
/// </summary>
public class OwnerScopedVisibilityFilterTests : IAsyncLifetime
{
    // Wide timeout to absorb contention when the compose harness is also running.
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<Recipe> _recipes = null!;
    private IMongoCollection<Food> _foods = null!;
    private IMongoContext _mongoContext = null!;

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb = mongoClient.GetDatabase("fitness_ownerscopedvisibility_test");
        _recipes = mongoDb.GetCollection<Recipe>("recipes");
        _foods = mongoDb.GetCollection<Food>("foods");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.Recipes.Returns(_recipes);
        mongoContext.Foods.Returns(_foods);
        _mongoContext = mongoContext;
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static Recipe MakeRecipe(Guid nutritionistId, string name, RecipeVisibility visibility) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            NutritionistId = nutritionistId,
            Name = name,
            Visibility = visibility,
            TotalNutrients = new NutrientTotals(),
            DateCreated = DateTime.UtcNow,
        };

    // NutritionistId is explicitly Guid.Empty (never null) below — an absent/null field would
    // pass against the UNFIXED code too and prove nothing about the guard under test.
    private static Food MakeFood(Guid nutritionistId, string name, FoodVisibility visibility) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            Name = name,
            NutritionistId = nutritionistId,
            Visibility = visibility,
            IsDeleted = false,
            DateCreated = DateTime.UtcNow,
        };

    // NutritionistId is explicitly null — a system/seed food with no owning nutritionist.
    // Food.NutritionistId carries no [BsonIgnoreIfNull], so this stores an explicit BSON null
    // rather than omitting the element.
    private static Food MakeOwnerlessFood(string name, FoodVisibility visibility) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            Name = name,
            NutritionistId = null,
            Visibility = visibility,
            IsDeleted = false,
            DateCreated = DateTime.UtcNow,
        };

    // A nutritionist whose user-id claim cannot be parsed as a Guid, so GetFoodEndpoint's
    // Guid.TryParse leaves currentUserId null. Built inline rather than via
    // EndpointTestHelpers.FakeUserClaims, which only takes a well-formed Guid.
    private static Claim[] UnparsableCallerClaims() =>
    [
        new Claim(AppClaims.UserId, "not-a-guid"),
        new Claim(AppClaims.Email, "test@test.com"),
        new Claim(ClaimTypes.Role, AppRoles.Nutritionist)
    ];

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// #992 error path: a Private recipe whose <c>nutritionistId</c> is an explicit zero uuid must
    /// be excluded for an empty caller, while an unrelated Public recipe is still returned.
    /// </summary>
    [Fact]
    public async Task SearchRecipes_EmptyCallerId_ExcludesPrivateRecipeWithZeroUuidOwner_ButIncludesPublic()
    {
        var ct = TestContext.Current.CancellationToken;

        var zeroOwnerPrivate = MakeRecipe(Guid.Empty, "Zero Owner Private", RecipeVisibility.Private);
        var othersPublic = MakeRecipe(Guid.NewGuid(), "Others Public", RecipeVisibility.Public);

        await _recipes.InsertManyAsync([zeroOwnerPrivate, othersPublic], cancellationToken: ct);

        var ep = Factory.Create<SearchRecipesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.Empty, AppRoles.Nutritionist))),
            _mongoContext);

        await ep.HandleAsync(new SearchRecipesRequest(), ct);

        ep.Response.Recipes.Should().ContainSingle(r => r.Name == "Others Public");
        ep.Response.TotalCount.Should().Be(1);
    }

    /// <summary>
    /// #992 error path: a Private food whose <c>nutritionistId</c> is an explicit zero uuid (not
    /// null — <see cref="Food.NutritionistId"/> is <c>Guid?</c>) must be excluded for an empty
    /// caller, while an unrelated Public non-deleted food is still returned.
    /// </summary>
    [Fact]
    public async Task SearchFoods_EmptyCallerId_ExcludesPrivateFoodWithZeroUuidOwner_ButIncludesPublic()
    {
        var ct = TestContext.Current.CancellationToken;

        var zeroOwnerPrivate = MakeFood(Guid.Empty, "Zero Owner Private", FoodVisibility.Private);
        var othersPublic = MakeFood(Guid.NewGuid(), "Others Public", FoodVisibility.Public);

        await _foods.InsertManyAsync([zeroOwnerPrivate, othersPublic], cancellationToken: ct);

        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.Empty, AppRoles.Nutritionist))),
            _mongoContext);

        await ep.HandleAsync(new SearchFoodsRequest(), ct);

        ep.Response.Foods.Should().ContainSingle(f => f.Name == "Others Public");
        ep.Response.TotalCount.Should().Be(1);
    }

    /// <summary>
    /// #992 error path — the third own-or-public site found beyond the AC by shape-grep, and the
    /// highest-consequence: a single-document read gated solely by the disjunct. A Private recipe
    /// whose <c>nutritionistId</c> is an explicit zero uuid must 404 for an empty caller, while a
    /// Public recipe still resolves.
    /// </summary>
    [Fact]
    public async Task GetRecipe_EmptyCallerId_PrivateRecipeWithZeroUuidOwner_Returns404_PublicRecipe_Returns200()
    {
        var ct = TestContext.Current.CancellationToken;

        var zeroOwnerPrivate = MakeRecipe(Guid.Empty, "Zero Owner Private", RecipeVisibility.Private);
        var othersPublic = MakeRecipe(Guid.NewGuid(), "Others Public", RecipeVisibility.Public);

        await _recipes.InsertManyAsync([zeroOwnerPrivate, othersPublic], cancellationToken: ct);

        var privateEp = Factory.Create<GetRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.Empty, AppRoles.Nutritionist))),
            _mongoContext);

        await privateEp.HandleAsync(
            new GetRecipeRequest { RecipeId = zeroOwnerPrivate.ExternalId }, ct);

        privateEp.HttpContext.Response.StatusCode.Should().Be(404);

        var publicEp = Factory.Create<GetRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.Empty, AppRoles.Nutritionist))),
            _mongoContext);

        await publicEp.HandleAsync(
            new GetRecipeRequest { RecipeId = othersPublic.ExternalId }, ct);

        publicEp.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// #1010 error path: the fourth member of the own-or-public family. A Private food with NO
    /// owner must 404 for a nutritionist whose id claim could not be parsed. Before the fix the
    /// gate ran in memory as <c>food.NutritionistId != currentUserId</c> with both sides
    /// <see langword="null"/>, which evaluated false and returned the food as "owned by the
    /// caller".
    /// </summary>
    [Fact]
    public async Task GetFood_UnparsableCallerId_PrivateOwnerlessFood_Returns404()
    {
        var ct = TestContext.Current.CancellationToken;

        var ownerlessPrivate = MakeOwnerlessFood("Ownerless Private", FoodVisibility.Private);
        await _foods.InsertOneAsync(ownerlessPrivate, cancellationToken: ct);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(UnparsableCallerClaims())),
            _mongoContext);

        await ep.HandleAsync(new GetFoodRequest { FoodId = ownerlessPrivate.ExternalId }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// #1010 success path, so the test above cannot pass by blanket-denying an unparsable caller:
    /// a Public ownerless food still resolves for the same caller.
    /// </summary>
    [Fact]
    public async Task GetFood_UnparsableCallerId_PublicOwnerlessFood_Returns200()
    {
        var ct = TestContext.Current.CancellationToken;

        var ownerlessPublic = MakeOwnerlessFood("Ownerless Public", FoodVisibility.Public);
        await _foods.InsertOneAsync(ownerlessPublic, cancellationToken: ct);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(UnparsableCallerClaims())),
            _mongoContext);

        await ep.HandleAsync(new GetFoodRequest { FoodId = ownerlessPublic.ExternalId }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// #1010 regression guard: a nutritionist still reads their OWN Private food. Pins that the
    /// move from an in-memory post-filter to a Mongo-level Or clause did not narrow the reachable
    /// own-or-public behaviour.
    /// </summary>
    [Fact]
    public async Task GetFood_OwningNutritionist_PrivateOwnFood_Returns200()
    {
        var ct = TestContext.Current.CancellationToken;

        var ownerId = Guid.NewGuid();
        var ownPrivate = MakeFood(ownerId, "Own Private", FoodVisibility.Private);
        await _foods.InsertOneAsync(ownPrivate, cancellationToken: ct);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            _mongoContext);

        await ep.HandleAsync(new GetFoodRequest { FoodId = ownPrivate.ExternalId }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Moved here from <c>GetFoodEndpointTests.HandleAsync_PrivateFood_OtherNutritionistGets404</c>
    /// by #1010. That test ran against <c>FoodTestHelpers.CreateMockMongo</c>, whose
    /// <c>FindAsync</c> stub returns every seeded food without evaluating the
    /// <c>FilterDefinition</c>, so it could only observe a gate applied AFTER the read. Once the
    /// gate moved into the query it became structurally blind — it belongs on a real collection.
    /// </summary>
    [Fact]
    public async Task GetFood_OtherNutritionist_OthersPrivateFood_Returns404()
    {
        var ct = TestContext.Current.CancellationToken;

        var othersPrivate = MakeFood(Guid.NewGuid(), "Others Private 404", FoodVisibility.Private);
        await _foods.InsertOneAsync(othersPrivate, cancellationToken: ct);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Nutritionist))),
            _mongoContext);

        await ep.HandleAsync(new GetFoodRequest { FoodId = othersPrivate.ExternalId }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// #1010 regression guard: a Client reading a Private food referenced by their plan is still
    /// exempt from the visibility gate — the behaviour the endpoint's summary promises.
    /// </summary>
    [Fact]
    public async Task GetFood_ClientCaller_OthersPrivateFood_Returns200()
    {
        var ct = TestContext.Current.CancellationToken;

        var othersPrivate = MakeFood(Guid.NewGuid(), "Others Private", FoodVisibility.Private);
        await _foods.InsertOneAsync(othersPrivate, cancellationToken: ct);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Client))),
            _mongoContext);

        await ep.HandleAsync(new GetFoodRequest { FoodId = othersPrivate.ExternalId }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
