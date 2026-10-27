using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;
using FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Integration tests (real MongoDB) for <c>PUT /client/nutrition/plan/shopping-list/ticks</c> and
/// the tick state and food category returned by <c>GET /client/nutrition/plan/shopping-list</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class ShoppingListTicksEndpointTests(FitnessApiFactory factory)
{
    private static readonly DateTime Start = ClientNutritionFixtures.CurrentWeekMondayUtc();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private Task<NutritionPlan> InsertTwoWeekPlanAsync(Actor client, MealFood food) =>
        ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active, Start, null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, food)),
            ClientNutritionFixtures.Week(2, WeekStatus.Published, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, food)));

    private static Task<HttpResponseMessage> TickAsync(Actor client, int week, Guid foodId, bool isTicked) =>
        client.Http.PutAsJsonAsync("/client/nutrition/plan/shopping-list/ticks",
            new SetShoppingListItemTickedRequest { WeekNumber = week, FoodExternalId = foodId, IsTicked = isTicked },
            TestContext.Current.CancellationToken);

    private static async Task<List<ShoppingListItem>> GetListAsync(Actor client, string query = "")
    {
        var response = await client.Http.GetAsync($"/client/nutrition/plan/shopping-list{query}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<GetShoppingListResponse>(Json, TestContext.Current.CancellationToken))!.Items;
    }

    private async Task<long> CountTicksAsync(Guid clientId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.ShoppingListTicks.CountDocumentsAsync(t => t.ClientId == clientId, cancellationToken: TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Tick_ThenUntick_IsReflectedInShoppingList_AndRepeatsAreIdempotent()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Oats");
        await InsertTwoWeekPlanAsync(client, food);

        (await GetListAsync(client, "?weekFrom=1&weekTo=1")).Single().IsTicked.Should().BeFalse();

        (await TickAsync(client, 1, food.FoodExternalId, true)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await TickAsync(client, 1, food.FoodExternalId, true)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await CountTicksAsync(client.UserId)).Should().Be(1);
        (await GetListAsync(client, "?weekFrom=1&weekTo=1")).Single().IsTicked.Should().BeTrue();

        (await TickAsync(client, 1, food.FoodExternalId, false)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await TickAsync(client, 1, food.FoodExternalId, false)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await CountTicksAsync(client.UserId)).Should().Be(0);
        (await GetListAsync(client, "?weekFrom=1&weekTo=1")).Single().IsTicked.Should().BeFalse();
    }

    [Fact]
    public async Task Tick_ConcurrentSameItem_LeavesExactlyOneDocument_AndUniqueIndexRejectsDuplicates()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Beans");
        var plan = await InsertTwoWeekPlanAsync(client, food);

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => TickAsync(client, 1, food.FoodExternalId, true)));

        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.NoContent);
        (await CountTicksAsync(client.UserId)).Should().Be(1);

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var duplicate = async () => await mongo.ShoppingListTicks.InsertOneAsync(
            new ShoppingListTick
            {
                ClientId = client.UserId,
                PlanId = plan.ExternalId,
                WeekNumber = 1,
                FoodExternalId = food.FoodExternalId,
            },
            cancellationToken: TestContext.Current.CancellationToken);

        (await duplicate.Should().ThrowAsync<MongoWriteException>())
            .Which.WriteError.Category.Should().Be(ServerErrorCategory.DuplicateKey);
    }

    [Fact]
    public async Task ShoppingList_MultiWeekRange_IsTickedOnlyWhenTickedInEveryWeek()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Rice");
        await InsertTwoWeekPlanAsync(client, food);

        await TickAsync(client, 1, food.FoodExternalId, true);

        (await GetListAsync(client, "?weekFrom=1&weekTo=2")).Single().IsTicked.Should().BeFalse();
        (await GetListAsync(client, "?weekFrom=1&weekTo=1")).Single().IsTicked.Should().BeTrue();
        (await GetListAsync(client, "?weekFrom=2&weekTo=2")).Single().IsTicked.Should().BeFalse();

        await TickAsync(client, 2, food.FoodExternalId, true);

        (await GetListAsync(client, "?weekFrom=1&weekTo=2")).Single().IsTicked.Should().BeTrue();
    }

    [Fact]
    public async Task ShoppingList_AnotherClientsTicks_DoNotLeak()
    {
        var owner = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Eggs");
        await InsertTwoWeekPlanAsync(owner, food);
        await InsertTwoWeekPlanAsync(other, food);

        await TickAsync(owner, 1, food.FoodExternalId, true);

        (await GetListAsync(other, "?weekFrom=1&weekTo=1")).Single().IsTicked.Should().BeFalse();
    }

    [Fact]
    public async Task Tick_WithoutActivePlan_Returns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await TickAsync(client, 1, Guid.NewGuid(), true);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Tick_WeekOutsidePlan_Returns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood();
        await InsertTwoWeekPlanAsync(client, food);

        var response = await TickAsync(client, 3, food.FoodExternalId, true);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await CountTicksAsync(client.UserId)).Should().Be(0);
    }

    [Fact]
    public async Task Tick_FoodNotOnThatWeeksList_Returns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await InsertTwoWeekPlanAsync(client, PlanTestHelpers.CreateMealFood());

        var response = await TickAsync(client, 1, Guid.NewGuid(), true);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await CountTicksAsync(client.UserId)).Should().Be(0);
    }

    [Fact]
    public async Task Tick_InvalidWeekNumber_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await TickAsync(client, 0, Guid.NewGuid(), true);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ShoppingList_Category_UsesSnapshotThenFoodLookupThenOther()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var snapshot = PlanTestHelpers.CreateMealFood(foodName: "A Snapshot");
        snapshot.FoodCategory = "Dairy";
        var lookedUp = await ClientNutritionFixtures.InsertFoodAsync(factory, category: FoodCategory.Fruit);
        var fromFood = PlanTestHelpers.CreateMealFood(foodExternalId: lookedUp.ExternalId, foodName: "B Lookup");
        var missing = PlanTestHelpers.CreateMealFood(foodName: "C Missing");

        await ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active, Start, null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published,
                ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, snapshot, fromFood, missing)));

        var items = await GetListAsync(client);

        items.Select(i => (i.FoodName, i.FoodCategory)).Should().Equal(
            ("A Snapshot", "Dairy"),
            ("B Lookup", "Fruit"),
            ("C Missing", "Other"));
    }
}
