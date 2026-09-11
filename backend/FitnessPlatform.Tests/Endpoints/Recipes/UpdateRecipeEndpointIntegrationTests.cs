using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Drives <see cref="FitnessPlatform.Application.Features.Recipes.UpdateRecipe.UpdateRecipeEndpoint"/>
/// itself (via the real HTTP + Testcontainers stack) against a raw, field-absent legacy recipe
/// document — unlike <see cref="RecipeVersionLegacyIntegrationTests"/>, which only proves the
/// standalone filter shape behaves correctly and never instantiates the endpoint. That gap means
/// the four tests in that file cannot detect the <c>Not(Exists(Version))</c> clause being removed
/// from the endpoint itself; this test closes it.
///
/// <c>UpdateRecipe</c> returns 200/409 (never 201), so it does not need the <c>LinkGenerator</c>
/// that the lightweight <c>Factory.Create&lt;TEndpoint&gt;()</c> host lacks — <c>FitnessApiFactory</c>
/// is used anyway here specifically to exercise the real Mongo driver's CAS filter behavior.
/// </summary>
[Collection(TestCollection.Name)]
public class UpdateRecipeEndpointIntegrationTests(FitnessApiFactory factory)
{
    /// <summary>
    /// Seeds a raw legacy recipe (no <c>version</c> BSON element — the state of every recipe
    /// stored before #1032) directly into the collection the running app reads from, then drives
    /// <c>PUT /recipes/{id}</c> with <c>Version = 1</c> through real HTTP. RED before the endpoint
    /// fix (a bare <c>Eq(version, 1)</c> filter matches zero documents), GREEN after.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LegacyRecipeMissingVersionField_Version1_Succeeds()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = factory.CreateClient();

        var email = $"{Guid.NewGuid():N}@recipe-legacy-endpoint.test";
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Nutritionist", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");

        Guid nutritionistId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, ct);
            nutritionistId = user.Id;
        }

        var recipeId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var rawRecipes = mongo.Recipes.Database.GetCollection<BsonDocument>(
                mongo.Recipes.CollectionNamespace.CollectionName);

            await rawRecipes.InsertOneAsync(new BsonDocument
            {
                { "externalId", new BsonBinaryData(recipeId, GuidRepresentation.Standard) },
                { "nutritionistId", new BsonBinaryData(nutritionistId, GuidRepresentation.Standard) },
                { "name", "Legacy Recipe" },
                { "visibility", RecipeVisibility.Public.ToString() },
                { "dateCreated", DateTime.UtcNow }
                // NOTE: NO version element — simulates every recipe stored before #1032.
            }, cancellationToken: ct);
        }

        TestHelpers.SetBearerToken(client, accessToken);

        var foodResponse = await client.PostAsJsonAsync("/foods", new
        {
            Name = $"Test Food {Guid.NewGuid():N}",
            NutrientValue = new { Kcal = 100m, Protein = 20m, Carbs = 0m, Fat = 2m },
            Allergens = Array.Empty<string>(),
            CommonServings = Array.Empty<object>()
        }, ct);

        foodResponse.StatusCode.Should().Be(HttpStatusCode.Created,
            "food creation must succeed so the recipe update can reference it");

        var foodBody = await foodResponse.Content.ReadFromJsonAsync<FoodRef>(cancellationToken: ct);

        var response = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}",
            new
            {
                Version = 1,
                Name = "Updated Legacy Recipe",
                Foods = new[]
                {
                    new { FoodExternalId = foodBody!.FoodId, AmountGrams = 100m }
                }
            },
            ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "a legacy recipe with no stored version element must be updatable on its first " +
            "write when the client echoes back Version = 1 — the Not(Exists(Version)) clause " +
            "in UpdateRecipeEndpoint's CAS filter is what makes this succeed");

        var body = await response.Content.ReadFromJsonAsync<RecipeVersionRef>(cancellationToken: ct);
        body!.Version.Should().Be(2,
            "the version field is stored for the first time on this write and bumped to 2");
    }

    private record FoodRef(Guid FoodId);

    private record RecipeVersionRef(int Version);
}
