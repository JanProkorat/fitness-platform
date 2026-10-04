using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Real-Mongo integration tests for recipe tags: <c>PUT /trainer/recipes/{RecipeId}/tags</c>, the
/// <c>tagId</c> search filter, per-coach scoping and the delete cleanups. The unit mocks ignore
/// filters, so owner scoping is proven here.
/// </summary>
[Collection(TestCollection.Name)]
public class RecipeTagIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    [Fact]
    public async Task Replace_OwnSystemAndOthersPublicRecipe_Returns200WithNameSortedTags()
    {
        var coach = await NewCoachAsync();
        var other = await NewCoachAsync();
        var zebra = await CreateTagAsync(coach.Http, "Zebra");
        var apple = await CreateTagAsync(coach.Http, "apple");

        var own = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        var system = await InsertRecipeAsync(SystemUsers.AdminId, RecipeVisibility.Public);
        var othersPublic = await InsertRecipeAsync(other.UserId, RecipeVisibility.Public);

        foreach (var recipeId in new[] { own, system, othersPublic })
        {
            var response = await ReplaceAsync(coach.Http, recipeId, zebra, apple);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var body = await response.Content.ReadFromJsonAsync<ReplaceResponseDto>(
                JsonOptions, TestContext.Current.CancellationToken);
            body!.RecipeId.Should().Be(recipeId);
            body.Tags.Select(t => t.Name).Should().Equal("apple", "Zebra");
        }
    }

    [Fact]
    public async Task Replace_Twice_ReplacesTheSetWholesaleWithOneAssignmentDocument()
    {
        var coach = await NewCoachAsync();
        var first = await CreateTagAsync(coach.Http, "First");
        var second = await CreateTagAsync(coach.Http, "Second");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);

        (await ReplaceAsync(coach.Http, recipeId, first)).StatusCode.Should().Be(HttpStatusCode.OK);
        var response = await ReplaceAsync(coach.Http, recipeId, second);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var stored = await FindAssignmentsAsync(a => a.RecipeExternalId == recipeId);
        stored.Should().ContainSingle();
        stored[0].TagIds.Should().Equal(second);
    }

    [Fact]
    public async Task Replace_EmptyTagIds_ClearsTags()
    {
        var coach = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Clearable");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        await ReplaceAsync(coach.Http, recipeId, tag);

        var response = await ReplaceAsync(coach.Http, recipeId);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await GetRecipeAsync(coach.Http, recipeId)).Tags.Should().BeEmpty();
        var summary = await SearchAsync(coach.Http, $"tagId={tag}");
        summary.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Replace_AnotherCoachsPrivateRecipe_Returns404AndWritesNothing()
    {
        var owner = await NewCoachAsync();
        var tagger = await NewCoachAsync();
        var tag = await CreateTagAsync(tagger.Http, "Mine");
        var recipeId = await InsertRecipeAsync(owner.UserId, RecipeVisibility.Private);

        var response = await ReplaceAsync(tagger.Http, recipeId, tag);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await FindAssignmentsAsync(a => a.RecipeExternalId == recipeId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Replace_MissingRecipe_Returns404()
    {
        var coach = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Orphan");

        var response = await ReplaceAsync(coach.Http, Guid.NewGuid(), tag);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Replace_TagOwnedByAnotherCoach_Returns404FoodTagNotFoundAndKeepsAssignment()
    {
        var coach = await NewCoachAsync();
        var other = await NewCoachAsync();
        var ownTag = await CreateTagAsync(coach.Http, "Own");
        var foreignTag = await CreateTagAsync(other.Http, "Foreign");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        await ReplaceAsync(coach.Http, recipeId, ownTag);

        var response = await ReplaceAsync(coach.Http, recipeId, foreignTag);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Should().Contain(ErrorCodes.FoodTagNotFound);
        var stored = await FindAssignmentsAsync(a => a.RecipeExternalId == recipeId);
        stored.Should().ContainSingle().Which.TagIds.Should().Equal(ownTag);
    }

    [Fact]
    public async Task Replace_DuplicateTagIds_Returns400()
    {
        var coach = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Duplicated");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);

        var response = await ReplaceAsync(coach.Http, recipeId, tag, tag);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Get_AnotherCoachsTagsOnAPublicRecipe_AreNeverShown()
    {
        var coachA = await NewCoachAsync();
        var coachB = await NewCoachAsync();
        var tagA = await CreateTagAsync(coachA.Http, "Coach A tag");
        var tagB = await CreateTagAsync(coachB.Http, "Coach B tag");
        var recipeId = await InsertRecipeAsync(coachA.UserId, RecipeVisibility.Public);
        await ReplaceAsync(coachA.Http, recipeId, tagA);
        await ReplaceAsync(coachB.Http, recipeId, tagB);

        var seenByA = await GetRecipeAsync(coachA.Http, recipeId);
        var seenByB = await GetRecipeAsync(coachB.Http, recipeId);

        seenByA.Tags.Select(t => t.TagId).Should().Equal(tagA);
        seenByB.Tags.Select(t => t.TagId).Should().Equal(tagB);
    }

    [Fact]
    public async Task Search_ByAnotherCoachsTagId_ReturnsNoRows()
    {
        var coachA = await NewCoachAsync();
        var coachB = await NewCoachAsync();
        var tagA = await CreateTagAsync(coachA.Http, "Only A");
        var recipeId = await InsertRecipeAsync(coachA.UserId, RecipeVisibility.Public);
        await ReplaceAsync(coachA.Http, recipeId, tagA);

        var forB = await SearchAsync(coachB.Http, $"tagId={tagA}");
        var forA = await SearchAsync(coachA.Http, $"tagId={tagA}");

        forB.TotalCount.Should().Be(0);
        forB.Recipes.Should().BeEmpty();
        forA.Recipes.Should().ContainSingle(r => r.RecipeId == recipeId);
    }

    [Fact]
    public async Task Search_MultipleTagIds_MatchesAnyAndCarriesTagsOnRows()
    {
        var coach = await NewCoachAsync();
        var red = await CreateTagAsync(coach.Http, "Red");
        var blue = await CreateTagAsync(coach.Http, "Blue");
        var green = await CreateTagAsync(coach.Http, "Green");
        var redRecipe = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        var blueRecipe = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        var greenRecipe = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        await ReplaceAsync(coach.Http, redRecipe, red);
        await ReplaceAsync(coach.Http, blueRecipe, blue, red);
        await ReplaceAsync(coach.Http, greenRecipe, green);

        var result = await SearchAsync(coach.Http, $"tagId={red}&tagId={blue}");

        result.TotalCount.Should().Be(2);
        result.Recipes.Select(r => r.RecipeId).Should().BeEquivalentTo([redRecipe, blueRecipe]);
        result.Recipes.Single(r => r.RecipeId == blueRecipe).Tags.Select(t => t.Name).Should().Equal("Blue", "Red");
    }

    [Fact]
    public async Task Search_TagWithNoAssignments_ReturnsEmptyPageNotUnfilteredList()
    {
        var coach = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Unused");
        await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);

        var result = await SearchAsync(coach.Http, $"tagId={tag}");

        result.TotalCount.Should().Be(0);
        result.Recipes.Should().BeEmpty();
    }

    [Fact]
    public async Task Search_MoreThanTwentyTagIds_Returns400()
    {
        var coach = await NewCoachAsync();
        var query = string.Join("&", Enumerable.Range(0, 21).Select(_ => $"tagId={Guid.NewGuid()}"));

        var response = await coach.Http.GetAsync($"/recipes?{query}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeleteFoodTag_PullsTagFromRecipeAssignments()
    {
        var coach = await NewCoachAsync();
        var doomed = await CreateTagAsync(coach.Http, "Doomed");
        var kept = await CreateTagAsync(coach.Http, "Kept");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Private);
        await ReplaceAsync(coach.Http, recipeId, doomed, kept);

        var delete = await coach.Http.DeleteAsync($"/trainer/food-tags/{doomed}", TestContext.Current.CancellationToken);

        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetRecipeAsync(coach.Http, recipeId)).Tags.Select(t => t.TagId).Should().Equal(kept);
        var stored = await FindAssignmentsAsync(a => a.RecipeExternalId == recipeId);
        stored.Single().TagIds.Should().Equal(kept);
    }

    [Fact]
    public async Task DeleteRecipe_RemovesEveryCoachsAssignmentForIt()
    {
        var coach = await NewCoachAsync();
        var other = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Mine");
        var otherTag = await CreateTagAsync(other.Http, "Theirs");
        var recipeId = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Public);
        var survivor = await InsertRecipeAsync(coach.UserId, RecipeVisibility.Public);
        await ReplaceAsync(coach.Http, recipeId, tag);
        await ReplaceAsync(other.Http, recipeId, otherTag);
        await ReplaceAsync(coach.Http, survivor, tag);

        var delete = await coach.Http.DeleteAsync($"/recipes/{recipeId}", TestContext.Current.CancellationToken);

        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FindAssignmentsAsync(a => a.RecipeExternalId == recipeId)).Should().BeEmpty();
        (await FindAssignmentsAsync(a => a.RecipeExternalId == survivor)).Should().ContainSingle();
    }

    [Fact]
    public async Task Update_ResponseCarriesCallersCurrentTags_AndCreateReturnsNone()
    {
        var coach = await NewCoachAsync();
        var tag = await CreateTagAsync(coach.Http, "Sticky");
        var foodId = await InsertFoodAsync(coach.UserId);

        var create = await coach.Http.PostAsJsonAsync("/recipes", new
        {
            Name = $"Tagged {Guid.NewGuid():N}",
            MealTypes = new[] { "Lunch" },
            Foods = new[] { new { FoodExternalId = foodId, AmountGrams = 100m } },
        }, TestContext.Current.CancellationToken);
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await create.Content.ReadFromJsonAsync<RecipeDetailDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        created!.Tags.Should().BeEmpty();

        await ReplaceAsync(coach.Http, created.RecipeId, tag);

        var update = await coach.Http.PutAsJsonAsync($"/recipes/{created.RecipeId}", new
        {
            Name = "Renamed",
            Version = created.Version,
            MealTypes = new[] { "Lunch" },
            Foods = new[] { new { FoodExternalId = foodId, AmountGrams = 150m } },
        }, TestContext.Current.CancellationToken);

        update.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await update.Content.ReadFromJsonAsync<RecipeDetailDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        updated!.Tags.Select(t => t.TagId).Should().Equal(tag);
    }

    private async Task<Actor> NewCoachAsync() =>
        await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);

    private static Task<HttpResponseMessage> ReplaceAsync(HttpClient http, Guid recipeId, params Guid[] tagIds) =>
        http.PutAsJsonAsync($"/trainer/recipes/{recipeId}/tags", new { TagIds = tagIds }, TestContext.Current.CancellationToken);

    private static async Task<Guid> CreateTagAsync(HttpClient http, string name)
    {
        var response = await http.PostAsJsonAsync("/trainer/food-tags",
            new { Name = name, Description = (string?)null, ColorHex = "#3b82f6" },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<TagDto>(JsonOptions, TestContext.Current.CancellationToken);
        return body!.TagId;
    }

    private static async Task<RecipeDetailDto> GetRecipeAsync(HttpClient http, Guid recipeId)
    {
        var response = await http.GetAsync($"/recipes/{recipeId}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<RecipeDetailDto>(
            JsonOptions, TestContext.Current.CancellationToken))!;
    }

    private static async Task<SearchDto> SearchAsync(HttpClient http, string query)
    {
        var response = await http.GetAsync($"/recipes?{query}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<SearchDto>(
            JsonOptions, TestContext.Current.CancellationToken))!;
    }

    private async Task<Guid> InsertRecipeAsync(Guid ownerId, RecipeVisibility visibility)
    {
        var recipeId = Guid.NewGuid();
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Recipes.InsertOneAsync(new Recipe
        {
            ExternalId = recipeId,
            NutritionistId = ownerId,
            Name = $"Tag Test Recipe {recipeId:N}",
            Visibility = visibility,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);
        return recipeId;
    }

    private async Task<Guid> InsertFoodAsync(Guid ownerId)
    {
        var foodId = Guid.NewGuid();
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Foods.InsertOneAsync(new Food
        {
            ExternalId = foodId,
            Name = $"Tag Test Food {foodId:N}",
            NutritionistId = ownerId,
            Visibility = FoodVisibility.Private,
            IsDeleted = false,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);
        return foodId;
    }

    private async Task<List<RecipeTagAssignment>> FindAssignmentsAsync(
        System.Linq.Expressions.Expression<Func<RecipeTagAssignment, bool>> predicate)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.RecipeTagAssignments.Find(predicate).ToListAsync(TestContext.Current.CancellationToken);
    }

    private sealed class TagDto
    {
        public Guid TagId { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    private sealed class ReplaceResponseDto
    {
        public Guid RecipeId { get; set; }
        public List<TagDto> Tags { get; set; } = [];
    }

    private sealed class RecipeDetailDto
    {
        public Guid RecipeId { get; set; }
        public int Version { get; set; }
        public List<TagDto> Tags { get; set; } = [];
    }

    private sealed class SearchDto
    {
        public List<RecipeRowDto> Recipes { get; set; } = [];
        public long TotalCount { get; set; }
    }

    private sealed class RecipeRowDto
    {
        public Guid RecipeId { get; set; }
        public List<TagDto> Tags { get; set; } = [];
    }
}
