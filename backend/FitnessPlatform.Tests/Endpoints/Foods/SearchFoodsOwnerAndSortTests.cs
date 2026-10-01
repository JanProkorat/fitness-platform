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

    /// <summary>
    /// #1139 rework (maintainer decision, 2026-10-01): Category sorts alphabetically by the
    /// translated label in the caller's language (<see cref="FoodCategoryLabels"/>), not by a
    /// fixed server-defined order — and Czech collation applies to the label the same way it
    /// already does for Name. Exercises all 13 categories against the maintainer's own stated
    /// order: Doplňky stravy, Luštěniny, Maso, Mléčné výrobky, Nápoje, Obiloviny, Oleje a tuky,
    /// Ořechy a semena, Ostatní, Ovoce, Ryby a mořské plody, Sladkosti a svačiny, Zelenina.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByCategoryAscending_Czech_OrdersAlphabeticallyByLabel()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Category Cs Meat", callerId, FoodVisibility.Private, category: FoodCategory.Meat),
            MakeFood("Category Cs Fruit", callerId, FoodVisibility.Private, category: FoodCategory.Fruit),
            MakeFood("Category Cs Vegetables", callerId, FoodVisibility.Private, category: FoodCategory.Vegetables),
            MakeFood("Category Cs FishAndSeafood", callerId, FoodVisibility.Private, category: FoodCategory.FishAndSeafood),
            MakeFood("Category Cs Dairy", callerId, FoodVisibility.Private, category: FoodCategory.Dairy),
            MakeFood("Category Cs GrainsAndCereals", callerId, FoodVisibility.Private, category: FoodCategory.GrainsAndCereals),
            MakeFood("Category Cs Legumes", callerId, FoodVisibility.Private, category: FoodCategory.Legumes),
            MakeFood("Category Cs NutsAndSeeds", callerId, FoodVisibility.Private, category: FoodCategory.NutsAndSeeds),
            MakeFood("Category Cs OilsAndFats", callerId, FoodVisibility.Private, category: FoodCategory.OilsAndFats),
            MakeFood("Category Cs SweetsAndSnacks", callerId, FoodVisibility.Private, category: FoodCategory.SweetsAndSnacks),
            MakeFood("Category Cs Beverages", callerId, FoodVisibility.Private, category: FoodCategory.Beverages),
            MakeFood("Category Cs Supplements", callerId, FoodVisibility.Private, category: FoodCategory.Supplements),
            MakeFood("Category Cs Other", callerId, FoodVisibility.Private, category: FoodCategory.Other),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId, acceptLanguage: "cs");
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Category, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal(
            "Category Cs Supplements",      // Doplňky stravy
            "Category Cs Legumes",          // Luštěniny
            "Category Cs Meat",             // Maso
            "Category Cs Dairy",            // Mléčné výrobky
            "Category Cs Beverages",        // Nápoje
            "Category Cs GrainsAndCereals", // Obiloviny
            "Category Cs OilsAndFats",      // Oleje a tuky
            "Category Cs NutsAndSeeds",     // Ořechy a semena
            "Category Cs Other",            // Ostatní
            "Category Cs Fruit",            // Ovoce
            "Category Cs FishAndSeafood",   // Ryby a mořské plody
            "Category Cs SweetsAndSnacks",  // Sladkosti a svačiny
            "Category Cs Vegetables");      // Zelenina
    }

    /// <summary>
    /// English labels (Dairy, Fruit, Meat) happen to already be alphabetical — unlike the old
    /// fixed order (Fruit, Dairy, Meat) — which is exactly the point: the sort now follows
    /// whichever language's label table applies, not a hardcoded ranking.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByCategoryAscending_English_OrdersAlphabeticallyByLabel()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        await _foods.InsertManyAsync(
        [
            MakeFood("Category En Meat", callerId, FoodVisibility.Private, category: FoodCategory.Meat),
            MakeFood("Category En Dairy", callerId, FoodVisibility.Private, category: FoodCategory.Dairy),
            MakeFood("Category En Fruit", callerId, FoodVisibility.Private, category: FoodCategory.Fruit),
        ], cancellationToken: ct);

        var ep = CreateEndpoint(callerId, acceptLanguage: "en");
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.Category, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal(
            "Category En Dairy", "Category En Fruit", "Category En Meat");
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
    /// With no <c>sortBy</c>, results are Name ascending (maintainer decision, 2026-10-01) — the
    /// same default this endpoint had before #1139 introduced explicit sorting; future callers
    /// (e.g. a plan food picker) get alphabetical results by default. "No Sort Zucchini" is the
    /// newest-created food and "No Sort Apple" the oldest — name order and creation order
    /// deliberately disagree, so a result ordered by insertion or by <c>dateCreated</c> would fail
    /// this assertion.
    /// </summary>
    [Fact]
    public async Task SearchFoods_NoSortBy_ReturnsNameAscending()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var newer = MakeFood("No Sort Zucchini", callerId, FoodVisibility.Private);
        newer.DateCreated = DateTime.UtcNow;
        var older = MakeFood("No Sort Apple", callerId, FoodVisibility.Private);
        older.DateCreated = DateTime.UtcNow.AddMinutes(-10);

        await _foods.InsertManyAsync([newer, older], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(new SearchFoodsRequest(), ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("No Sort Apple", "No Sort Zucchini");
    }

    // ── sort: date created ───────────────────────────────────────────────────

    /// <summary>
    /// #1139 rework: no-sortBy no longer means newest-first — a caller wanting that (e.g. the web
    /// portal's cleared-sort state) must request <see cref="FoodSortField.DateCreated"/> /
    /// <see cref="FoodSortDirection.Descending"/> explicitly.
    /// </summary>
    [Fact]
    public async Task SearchFoods_SortByDateCreatedDescending_ReturnsNewestFirst()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var older = MakeFood("Date Created Older", callerId, FoodVisibility.Private);
        older.DateCreated = DateTime.UtcNow.AddMinutes(-10);
        var newer = MakeFood("Date Created Newer", callerId, FoodVisibility.Private);
        newer.DateCreated = DateTime.UtcNow;

        await _foods.InsertManyAsync([older, newer], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.DateCreated, SortDir = FoodSortDirection.Descending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Date Created Newer", "Date Created Older");
    }

    [Fact]
    public async Task SearchFoods_SortByDateCreatedAscending_ReturnsOldestFirst()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var older = MakeFood("Date Created Asc Older", callerId, FoodVisibility.Private);
        older.DateCreated = DateTime.UtcNow.AddMinutes(-10);
        var newer = MakeFood("Date Created Asc Newer", callerId, FoodVisibility.Private);
        newer.DateCreated = DateTime.UtcNow;

        await _foods.InsertManyAsync([older, newer], cancellationToken: ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchFoodsRequest { SortBy = FoodSortField.DateCreated, SortDir = FoodSortDirection.Ascending }, ct);

        ep.Response.Foods.Select(f => f.Name).Should().Equal("Date Created Asc Older", "Date Created Asc Newer");
    }
}
