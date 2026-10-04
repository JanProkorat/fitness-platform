using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.SearchRecipes;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Thin per-collection handle onto the shared Mongo container (see <see cref="SharedTestContainers"/>).
/// </summary>
public class SearchRecipesFilterAndSortMongoContainerFixture(SharedTestContainers sharedContainers)
{
    public string ConnectionString => sharedContainers.MongoConnectionString;

    public string DatabaseName { get; } = SharedTestContainers.CreateMongoDatabaseName("searchrecipesfilterandsort");
}

[CollectionDefinition("SearchRecipesFilterAndSort")]
public class SearchRecipesFilterAndSortCollection : ICollectionFixture<SearchRecipesFilterAndSortMongoContainerFixture>;

/// <summary>
/// Real-Mongo coverage for <see cref="SearchRecipesEndpoint"/>'s summaries, filters and sort
/// columns. The mock Mongo harness never evaluates filters or aggregation stages, so none of this
/// can be proven against it.
/// </summary>
[Collection("SearchRecipesFilterAndSort")]
public class SearchRecipesFilterAndSortTests : IAsyncLifetime
{
    private readonly IMongoCollection<Recipe> _recipes;
    private readonly IMongoContext _mongoContext;

    public SearchRecipesFilterAndSortTests(SearchRecipesFilterAndSortMongoContainerFixture containerFixture)
    {
        var mongoDb = new MongoClient(containerFixture.ConnectionString).GetDatabase(containerFixture.DatabaseName);
        _recipes = mongoDb.GetCollection<Recipe>("recipes");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.Recipes.Returns(_recipes);
        _mongoContext = mongoContext;
    }

    public async ValueTask InitializeAsync() =>
        await _recipes.DeleteManyAsync(FilterDefinition<Recipe>.Empty);

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private SearchRecipesEndpoint CreateEndpoint(Guid callerId)
    {
        return Factory.Create<SearchRecipesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(callerId, AppRoles.Nutritionist))),
            _mongoContext);
    }

    private static Recipe MakeRecipe(
        string name,
        Guid ownerId,
        RecipeVisibility visibility = RecipeVisibility.Public,
        int servings = 1,
        decimal kcal = 100,
        string? description = null,
        string[]? mealTypes = null,
        string[]? dietaryPreferences = null,
        DateTime? dateCreated = null) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            NutritionistId = ownerId,
            Name = name,
            Description = description,
            Visibility = visibility,
            Servings = servings,
            MealTypes = mealTypes?.ToList(),
            DietaryPreferences = dietaryPreferences?.ToList() ?? [],
            TotalNutrients = new NutrientTotals { Kcal = kcal },
            DateCreated = dateCreated ?? DateTime.UtcNow
        };

    private async Task<List<string>> SearchNamesAsync(Guid callerId, SearchRecipesRequest request)
    {
        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(request, Ct);
        return ep.Response.Recipes.Select(r => r.Name).ToList();
    }

    // ── summaries ────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_OwnedRecipe_IsOwnedFlagIsTrue()
    {
        var ownerId = Guid.NewGuid();
        await _recipes.InsertOneAsync(MakeRecipe("Mine", ownerId, RecipeVisibility.Private), cancellationToken: Ct);

        var ep = CreateEndpoint(ownerId);
        await ep.HandleAsync(new SearchRecipesRequest(), Ct);

        ep.Response.Recipes.Should().ContainSingle();
        ep.Response.Recipes[0].IsOwnedByCurrentUser.Should().BeTrue();
        ep.Response.Recipes[0].Visibility.Should().Be(RecipeVisibility.Private);
    }

    [Fact]
    public async Task HandleAsync_PublicRecipeFromOther_IsOwnedFlagIsFalse()
    {
        await _recipes.InsertOneAsync(MakeRecipe("Shared", Guid.NewGuid()), cancellationToken: Ct);

        var ep = CreateEndpoint(Guid.NewGuid());
        await ep.HandleAsync(new SearchRecipesRequest(), Ct);

        ep.Response.Recipes.Should().ContainSingle();
        ep.Response.Recipes[0].IsOwnedByCurrentUser.Should().BeFalse();
        ep.Response.Recipes[0].IsSystem.Should().BeFalse();
    }

    [Fact]
    public async Task HandleAsync_OtherCoachesPrivateRecipe_IsNotReturned()
    {
        await _recipes.InsertOneAsync(MakeRecipe("Hidden", Guid.NewGuid(), RecipeVisibility.Private), cancellationToken: Ct);

        var names = await SearchNamesAsync(Guid.NewGuid(), new SearchRecipesRequest());

        names.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_Summary_CarriesServingsMealTypesCookTimeAndIsSystem()
    {
        var recipe = MakeRecipe("System Soup", SystemUsers.AdminId, servings: 3, mealTypes: ["lunch", "Dinner"]);
        recipe.CookTimeMinutes = 40;
        await _recipes.InsertOneAsync(recipe, cancellationToken: Ct);

        var ep = CreateEndpoint(Guid.NewGuid());
        await ep.HandleAsync(new SearchRecipesRequest(), Ct);

        var summary = ep.Response.Recipes.Should().ContainSingle().Subject;
        summary.IsSystem.Should().BeTrue();
        summary.Servings.Should().Be(3);
        summary.CookTimeMinutes.Should().Be(40);
        summary.MealTypes.Should().BeEquivalentTo([RecipeMealType.Lunch, RecipeMealType.Dinner]);
    }

    // ── filters ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_Search_MatchesNameAndDescription()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Banana pancakes", callerId),
            MakeRecipe("Plain oats", callerId, description: "Top with banana slices"),
            MakeRecipe("Rice", callerId)
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(callerId, new SearchRecipesRequest { Search = "banana" });

        names.Should().BeEquivalentTo("Banana pancakes", "Plain oats");
    }

    [Fact]
    public async Task HandleAsync_MealTypeFilter_MatchesAnyAndLegacyLowercaseSpelling()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Canonical Breakfast", callerId, mealTypes: ["Breakfast"]),
            MakeRecipe("Legacy Breakfast", callerId, mealTypes: ["breakfast"]),
            MakeRecipe("Dinner Only", callerId, mealTypes: ["Dinner"]),
            MakeRecipe("Snack Only", callerId, mealTypes: ["Snack"]),
            MakeRecipe("No Meal Types", callerId)
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId, new SearchRecipesRequest { MealTypes = [RecipeMealType.Breakfast, RecipeMealType.Dinner] });

        names.Should().BeEquivalentTo("Canonical Breakfast", "Legacy Breakfast", "Dinner Only");
    }

    [Fact]
    public async Task HandleAsync_DietaryPreferenceFilter_MatchesAllRequested()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Vegan And Gluten Free", callerId, dietaryPreferences: ["Vegan", "GlutenFree", "LowCarb"]),
            MakeRecipe("Vegan Only", callerId, dietaryPreferences: ["Vegan"]),
            MakeRecipe("Gluten Free Only", callerId, dietaryPreferences: ["GlutenFree"]),
            MakeRecipe("None", callerId)
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId,
            new SearchRecipesRequest { DietaryPreferences = [DietaryPreference.Vegan, DietaryPreference.GlutenFree] });

        names.Should().Equal("Vegan And Gluten Free");
    }

    [Theory]
    [InlineData(FoodOwnerFilter.Mine, "Mine")]
    [InlineData(FoodOwnerFilter.System, "System")]
    [InlineData(FoodOwnerFilter.OtherCoaches, "Other Coach")]
    public async Task HandleAsync_OwnerFilter_ReturnsOnlyThatBucket(FoodOwnerFilter owner, string expectedName)
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Mine", callerId, RecipeVisibility.Private),
            MakeRecipe("System", SystemUsers.AdminId),
            MakeRecipe("Other Coach", Guid.NewGuid())
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(callerId, new SearchRecipesRequest { Owners = [owner] });

        names.Should().Equal(expectedName);
    }

    [Fact]
    public async Task HandleAsync_OwnerFilter_MultipleBucketsAreOred()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Mine", callerId, RecipeVisibility.Private),
            MakeRecipe("System", SystemUsers.AdminId),
            MakeRecipe("Other Coach", Guid.NewGuid())
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId, new SearchRecipesRequest { Owners = [FoodOwnerFilter.Mine, FoodOwnerFilter.System] });

        names.Should().BeEquivalentTo("Mine", "System");
    }

    // ── sorting ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoSort_ReturnsNewestFirst()
    {
        var callerId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Oldest", callerId, dateCreated: now.AddDays(-2)),
            MakeRecipe("Newest", callerId, dateCreated: now),
            MakeRecipe("Middle", callerId, dateCreated: now.AddDays(-1))
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(callerId, new SearchRecipesRequest());

        names.Should().Equal("Newest", "Middle", "Oldest");
    }

    [Theory]
    [InlineData(FoodSortDirection.Ascending, new[] { "apple", "Banana", "cherry" })]
    [InlineData(FoodSortDirection.Descending, new[] { "cherry", "Banana", "apple" })]
    public async Task HandleAsync_SortByName_IsCaseInsensitiveInBothDirections(FoodSortDirection direction, string[] expected)
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("cherry", callerId),
            MakeRecipe("apple", callerId),
            MakeRecipe("Banana", callerId)
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId, new SearchRecipesRequest { SortBy = RecipeSortField.Name, SortDir = direction });

        names.Should().Equal(expected);
    }

    [Fact]
    public async Task HandleAsync_SortByCaloriesPerServing_DividesTotalByServings()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Heavy per serving", callerId, servings: 1, kcal: 600),   // 600
            MakeRecipe("Light per serving", callerId, servings: 4, kcal: 800),   // 200
            MakeRecipe("Medium per serving", callerId, servings: 2, kcal: 800)   // 400
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId,
            new SearchRecipesRequest { SortBy = RecipeSortField.CaloriesPerServing, SortDir = FoodSortDirection.Ascending });

        names.Should().Equal("Light per serving", "Medium per serving", "Heavy per serving");
    }

    [Fact]
    public async Task HandleAsync_SortByServings_TreatsLegacyDocumentWithoutServingsAsOne()
    {
        var callerId = Guid.NewGuid();
        var legacyId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Six", callerId, servings: 6),
            MakeRecipe("Two", callerId, servings: 2)
        ], cancellationToken: Ct);

        var rawRecipes = _recipes.Database.GetCollection<BsonDocument>("recipes");
        await rawRecipes.InsertOneAsync(new BsonDocument
        {
            { "externalId", new BsonBinaryData(legacyId, GuidRepresentation.Standard) },
            { "nutritionistId", new BsonBinaryData(callerId, GuidRepresentation.Standard) },
            { "name", "Legacy" },
            { "visibility", "Public" },
            { "dateCreated", DateTime.UtcNow }
        }, cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId,
            new SearchRecipesRequest { SortBy = RecipeSortField.Servings, SortDir = FoodSortDirection.Ascending });

        names.Should().Equal("Legacy", "Two", "Six");
    }

    [Fact]
    public async Task HandleAsync_SortByLibrary_PutsMineThenOtherCoachesThenSystem()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("System", SystemUsers.AdminId),
            MakeRecipe("Other Coach", Guid.NewGuid()),
            MakeRecipe("Mine", callerId, RecipeVisibility.Private)
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId, new SearchRecipesRequest { SortBy = RecipeSortField.Library, SortDir = FoodSortDirection.Ascending });

        names.Should().Equal("Mine", "Other Coach", "System");
    }

    [Fact]
    public async Task HandleAsync_SortByDateCreated_AscendingReturnsOldestFirst()
    {
        var callerId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("Newest", callerId, dateCreated: now),
            MakeRecipe("Oldest", callerId, dateCreated: now.AddDays(-2))
        ], cancellationToken: Ct);

        var names = await SearchNamesAsync(
            callerId, new SearchRecipesRequest { SortBy = RecipeSortField.DateCreated, SortDir = FoodSortDirection.Ascending });

        names.Should().Equal("Oldest", "Newest");
    }

    [Fact]
    public async Task HandleAsync_SortedPaging_ReturnsSecondPageWithoutLeakingSortKey()
    {
        var callerId = Guid.NewGuid();
        await _recipes.InsertManyAsync(
        [
            MakeRecipe("A", callerId, servings: 1),
            MakeRecipe("B", callerId, servings: 2),
            MakeRecipe("C", callerId, servings: 3)
        ], cancellationToken: Ct);

        var ep = CreateEndpoint(callerId);
        await ep.HandleAsync(
            new SearchRecipesRequest { SortBy = RecipeSortField.Servings, Page = 2, PageSize = 2 }, Ct);

        ep.Response.TotalCount.Should().Be(3);
        ep.Response.Recipes.Select(r => r.Name).Should().Equal("C");
    }
}
