using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Integration tests (real MongoDB) for recipe ingredients and localized names on
/// <c>GET /client/nutrition/plan/shopping-list</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class GetShoppingListIntegrationTests(FitnessApiFactory factory)
{
    private static readonly DateTime Start = ClientNutritionFixtures.CurrentWeekMondayUtc();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static async Task<List<ShoppingListItem>> GetListAsync(Actor client)
    {
        var response = await client.Http.GetAsync("/client/nutrition/plan/shopping-list", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<GetShoppingListResponse>(Json, TestContext.Current.CancellationToken))!.Items;
    }

    private async Task<Recipe> InsertRecipeAsync(int servings, params MealFood[] foods)
    {
        var recipe = await ClientNutritionFixtures.InsertRecipeAsync(factory);
        recipe.Servings = servings;
        recipe.Foods = foods.ToList();

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Recipes.ReplaceOneAsync(r => r.ExternalId == recipe.ExternalId, recipe, cancellationToken: TestContext.Current.CancellationToken);
        return recipe;
    }

    private static PlanMeal MealWithRecipe(Recipe recipe, decimal servings)
    {
        var meal = ClientNutritionFixtures.MealWithRecipes(MealKind.Dinner, recipe);
        meal.Recipes[0].Servings = servings;
        return meal;
    }

    private Task InsertPlanAsync(Actor client, params PlanMeal[] meals) =>
        ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active, Start, null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, meals));

    [Fact]
    public async Task ShoppingList_RecipeIngredient_MergesWithPlainFoodAtScaledAmount()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var sharedFoodId = Guid.NewGuid();
        var recipe = await InsertRecipeAsync(4,
            PlanTestHelpers.CreateMealFood(foodExternalId: sharedFoodId, foodName: "Flour", amountGrams: 400));
        await InsertPlanAsync(client,
            ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, PlanTestHelpers.CreateMealFood(foodExternalId: sharedFoodId, foodName: "Flour", amountGrams: 50)),
            MealWithRecipe(recipe, 3));

        var items = await GetListAsync(client);

        // 400 g per 4 servings, 3 servings planned -> 300 g, plus 50 g plain.
        items.Should().ContainSingle().Which.TotalAmountGrams.Should().Be(350);
    }

    [Fact]
    public async Task ShoppingList_RecipeWithoutDocument_IsSkipped()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var existing = await InsertRecipeAsync(1, PlanTestHelpers.CreateMealFood(foodName: "Lentils", amountGrams: 120));
        var deleted = await ClientNutritionFixtures.InsertRecipeAsync(factory);
        deleted.Foods = [PlanTestHelpers.CreateMealFood(foodName: "Ghost")];
        await InsertPlanAsync(client, MealWithRecipe(existing, 1), MealWithRecipe(deleted, 1));

        var items = await GetListAsync(client);

        items.Select(i => i.FoodName).Should().Equal("Lentils");
    }

    [Fact]
    public async Task ShoppingList_LocalizedNames_AreReturned_AndMissingOnesStayNull()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var localized = PlanTestHelpers.CreateMealFood(foodName: "A Rice");
        localized.FoodNameCs = "Rýže";
        localized.FoodNameEn = "Rice";
        localized.FoodNameDe = "Reis";
        var plain = PlanTestHelpers.CreateMealFood(foodName: "B Plain");
        await InsertPlanAsync(client, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, localized, plain));

        var items = await GetListAsync(client);

        items[0].Should().Match<ShoppingListItem>(i => i.FoodNameCs == "Rýže" && i.FoodNameEn == "Rice" && i.FoodNameDe == "Reis");
        items[1].Should().Match<ShoppingListItem>(i => i.FoodNameCs == null && i.FoodNameEn == null && i.FoodNameDe == null);
    }
}
