using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.SearchFoods;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Thin per-collection handle onto the shared Mongo container (#1104 Phase B — see
/// <see cref="SharedTestContainers"/>).
/// </summary>
public class SearchFoodsOwnerAndSortMongoContainerFixture(SharedTestContainers sharedContainers)
{
    public string ConnectionString => sharedContainers.MongoConnectionString;

    public string DatabaseName { get; } = SharedTestContainers.CreateMongoDatabaseName("searchfoodsownerandsort");
}

[CollectionDefinition("SearchFoodsOwnerAndSort")]
public class SearchFoodsOwnerAndSortCollection : ICollectionFixture<SearchFoodsOwnerAndSortMongoContainerFixture>;

/// <summary>
/// Real-Mongo coverage for #1139's owner filter and every <see cref="FoodSortField"/> — these
/// cannot be proven against <see cref="FoodTestHelpers.CreateMockMongo(Food[])"/> (filters and
/// aggregation stages are never evaluated by that mock; see its own doc comment and
/// <see cref="FitnessPlatform.Tests.Endpoints.Recipes.OwnerScopedVisibilityFilterTests"/> for the
/// established pattern this mirrors).
/// </summary>
[Collection("SearchFoodsOwnerAndSort")]
public class SearchFoodsOwnerAndSortTests : IAsyncLifetime
{
    private readonly IMongoCollection<Food> _foods;
    private readonly IMongoCollection<FoodTag> _foodTags;
    private readonly IMongoCollection<FoodTagAssignment> _foodTagAssignments;
    private readonly IMongoContext _mongoContext;

    public SearchFoodsOwnerAndSortTests(SearchFoodsOwnerAndSortMongoContainerFixture containerFixture)
    {
        var mongoClient = new MongoClient(containerFixture.ConnectionString);
        var mongoDb = mongoClient.GetDatabase(containerFixture.DatabaseName);
        _foods = mongoDb.GetCollection<Food>("foods");
        _foodTags = mongoDb.GetCollection<FoodTag>("foodTags");
        _foodTagAssignments = mongoDb.GetCollection<FoodTagAssignment>("foodTagAssignments");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.Foods.Returns(_foods);
        mongoContext.FoodTags.Returns(_foodTags);
        mongoContext.FoodTagAssignments.Returns(_foodTagAssignments);
        _mongoContext = mongoContext;
    }

    public async ValueTask InitializeAsync()
    {
        await _foods.DeleteManyAsync(FilterDefinition<Food>.Empty);
        await _foodTags.DeleteManyAsync(FilterDefinition<FoodTag>.Empty);
        await _foodTagAssignments.DeleteManyAsync(FilterDefinition<FoodTagAssignment>.Empty);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    private SearchFoodsEndpoint CreateEndpoint(Guid callerId, string? acceptLanguage = null)
    {
        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(callerId, AppRoles.Nutritionist))),
            _mongoContext);

        if (acceptLanguage is not null)
        {
            ep.HttpContext.Request.Headers.AcceptLanguage = acceptLanguage;
        }

        return ep;
    }

    private static Food MakeFood(
        string name, Guid? nutritionistId, FoodVisibility visibility, FoodCategory category = FoodCategory.Other, decimal kcal = 100) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            Name = name,
            NutritionistId = nutritionistId,
            Visibility = visibility,
            Category = category,
            NutrientValue = new NutrientValue { Kcal = kcal },
            IsDeleted = false,
            DateCreated = DateTime.UtcNow,
        };

    // ── owner filter ─────────────────────────────────────────────────────────

    [Fact]
    public async Task SearchFoods_OwnerMine_ReturnsOnlyCallersOwnFoods()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Owner Filter Mine", callerId, FoodVisibility.Private),
            MakeFood("Owner Filter System", null, FoodVisibility.Public),
            MakeFood("Owner Filter Other Coach", Guid.NewGuid(), FoodVisibility.Public),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest { Owners = [FoodOwnerFilter.Mine] }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Owner Filter Mine");
    }

    [Fact]
    public async Task SearchFoods_OwnerSystem_ReturnsOnlyOwnerlessFoods()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("System Filter Mine", callerId, FoodVisibility.Private),
            MakeFood("System Filter System", null, FoodVisibility.Public),
            MakeFood("System Filter Other Coach", Guid.NewGuid(), FoodVisibility.Public),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest { Owners = [FoodOwnerFilter.System] }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("System Filter System");
    }

    [Fact]
    public async Task SearchFoods_OwnerOtherCoaches_ReturnsOnlyOtherCoachesPublicFoods()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Other Filter Mine", callerId, FoodVisibility.Private),
            MakeFood("Other Filter System", null, FoodVisibility.Public),
            MakeFood("Other Filter Other Coach", Guid.NewGuid(), FoodVisibility.Public),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest { Owners = [FoodOwnerFilter.OtherCoaches] }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Other Filter Other Coach");
    }

    [Fact]
    public async Task SearchFoods_MultipleOwnersSupplied_OrsThemTogether()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Multi Owner Mine", callerId, FoodVisibility.Private),
            MakeFood("Multi Owner System", null, FoodVisibility.Public),
            MakeFood("Multi Owner Other Coach", Guid.NewGuid(), FoodVisibility.Public),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { Owners = [FoodOwnerFilter.Mine, FoodOwnerFilter.System] }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().BeEquivalentTo(
            ["Multi Owner Mine", "Multi Owner System"]);
    }

    /// <summary>
    /// #1139 error path: a Private food owned by a different coach must never surface, even when
    /// explicitly filtering for <see cref="FoodOwnerFilter.OtherCoaches"/> — the own-or-public
    /// visibility gate (<c>FoodVisibilityFilter.BuildOwnOrPublic</c>) ANDs with the owner filter,
    /// it doesn't get bypassed by it.
    /// </summary>
    [Fact]
    public async Task SearchFoods_OwnerOtherCoaches_NeverLeaksAnotherCoachsPrivateFood()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();
        var otherCoachId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Leak Check Other Private", otherCoachId, FoodVisibility.Private),
            MakeFood("Leak Check Other Public", otherCoachId, FoodVisibility.Public),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest { Owners = [FoodOwnerFilter.OtherCoaches] }, ct);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Foods.Should().ContainSingle(f => f.Name == "Leak Check Other Public");
        ep.Response.Foods.Should().NotContain(f => f.Name == "Leak Check Other Private");
    }

    // ── sort: name (collation) ───────────────────────────────────────────────

    /// <summary>
    /// #1139 MAJOR: Czech collation orders 'č' immediately after 'c' (before 'd'), unlike a plain
    /// binary/codepoint comparison, which would put 'Č' (U+010C) after every ASCII letter
    /// including 'z'. "Čaj" sorting between "Cuketa" and "Datle" only happens when the Collation
    /// is actually applied to the $sort stage — a binary sort would yield
    /// Cuketa, Datle, Čaj instead.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByNameAscending_UsesCzechCollation()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Datle", callerId, FoodVisibility.Private),
            MakeFood("Čaj", callerId, FoodVisibility.Private),
            MakeFood("Cuketa", callerId, FoodVisibility.Private),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId, acceptLanguage: "cs");
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Name, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Cuketa", "Čaj", "Datle");
    }

    [Fact]
    public async Task SearchFoods_SortByNameDescending_ReversesOrder()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Apple", callerId, FoodVisibility.Private),
            MakeFood("Banana", callerId, FoodVisibility.Private),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Name, SortDir = FoodSortDirection.Descending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Banana", "Apple");
    }

    /// <summary>
    /// The name sort key falls back through the displayed name exactly as
    /// <c>LocalizedNames.Resolve</c> does: a food with no localized names at all sorts by its
    /// canonical <c>Name</c>, interleaved correctly against foods that do have one.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByName_FoodWithNoLocalizedNames_FallsBackToCanonicalName()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var withLocalized = MakeFood("Zucchini", callerId, FoodVisibility.Private);
        withLocalized.LocalizedNames = new LocalizedNames { En = "Apple Pie" };
        var withoutLocalized = MakeFood("Banana", callerId, FoodVisibility.Private);

        await _foods.InsertManyAsync([withLocalized, withoutLocalized], cancellationToken: ct);

        var ep = CreateEndpoint(callerId, acceptLanguage: "en");
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Name, SortDir = FoodSortDirection.Ascending }, ct);

        // "Apple Pie" (resolved display name of the Zucchini document) sorts before "Banana"
        // (canonical name, no localized override) — proves the sort key used the resolved name,
        // not the raw document name, for the first food.
        ep.Response.Foods.Select(f => f.RawName).Should().Equal("Zucchini", "Banana");
    }

    // ── sort: calories ────────────────────────────────────────────────────────

    /// <summary>
    /// #1139 MAJOR: kcal must sort numerically, not lexically. 52, 120, and 1000 are chosen
    /// specifically because a lexical/string sort would order them "1000", "120", "52" — the
    /// opposite of the numeric ascending order asserted here.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByCaloriesAscending_SortsNumerically_NotLexically()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Calories High", callerId, FoodVisibility.Private, kcal: 1000),
            MakeFood("Calories Low", callerId, FoodVisibility.Private, kcal: 52),
            MakeFood("Calories Mid", callerId, FoodVisibility.Private, kcal: 120),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Calories, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Calories Low", "Calories Mid", "Calories High");
    }

    // ── sort: category ────────────────────────────────────────────────────────

    [Fact]
    public async Task SearchFoods_SortByCategoryAscending_UsesFixedServerOrder_NotAlphabetical()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        // Alphabetically this would be Dairy, Fruit, Meat — the fixed order instead ranks
        // Fruit before Dairy before Meat.
        await _foods.InsertManyAsync(
        [
            MakeFood("Category Order Dairy", callerId, FoodVisibility.Private, category: FoodCategory.Dairy),
            MakeFood("Category Order Fruit", callerId, FoodVisibility.Private, category: FoodCategory.Fruit),
            MakeFood("Category Order Meat", callerId, FoodVisibility.Private, category: FoodCategory.Meat),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Category, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal(
            "Category Order Fruit", "Category Order Dairy", "Category Order Meat");
    }

    // ── sort: library ─────────────────────────────────────────────────────────

    [Fact]
    public async Task SearchFoods_SortByLibraryAscending_OrdersMineThenOtherCoachesThenSystem()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();
        var otherCoachId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Library Order System", null, FoodVisibility.Public),
            MakeFood("Library Order Other Coach", otherCoachId, FoodVisibility.Public),
            MakeFood("Library Order Mine", callerId, FoodVisibility.Private),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Library, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal(
            "Library Order Mine", "Library Order Other Coach", "Library Order System");
    }

    // ── no sort ───────────────────────────────────────────────────────────────

    /// <summary>
    /// With no <c>sortBy</c>, the AC requires newest-created foods first — a behaviour change
    /// from the pre-#1139 default of name ascending.
    /// </summary>
    [Fact]
    public async Task SearchFoods_NoSortBy_ReturnsNewestCreatedFirst()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var older = MakeFood("No Sort Older", callerId, FoodVisibility.Private);
        older.DateCreated = DateTime.UtcNow.AddMinutes(-10);
        var newer = MakeFood("No Sort Newer", callerId, FoodVisibility.Private);
        newer.DateCreated = DateTime.UtcNow;

        await _foods.InsertManyAsync([older, newer], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest(), ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("No Sort Newer", "No Sort Older");
    }
}
