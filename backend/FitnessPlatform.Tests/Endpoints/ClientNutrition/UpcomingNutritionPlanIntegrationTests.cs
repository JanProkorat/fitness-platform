using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Client.Plans.GetClientPlans;
using FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;
using FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;
using FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Integration tests (real MongoDB, which unit mocks cannot prove) for the upcoming-plan fallback of the
/// full-plan, shopping-list and tick endpoints, and for the per-client scoping of the plans list averages.
/// </summary>
[Collection(TestCollection.Name)]
public class UpcomingNutritionPlanIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static DateTime NextWeekMonday() => ClientNutritionFixtures.CurrentWeekMondayUtc().AddDays(7);

    private Task<NutritionPlan> InsertUpcomingPlanAsync(Guid clientId, MealFood food, DateTime? start = null) =>
        ClientNutritionFixtures.InsertPlanAsync(factory, clientId, NutritionPlanStatus.Active, start ?? NextWeekMonday(), null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, food)));

    [Fact]
    public async Task FullPlan_UpcomingPlanWithPublishedWeek_Returns200WithNullCurrentWeek()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var plan = await InsertUpcomingPlanAsync(client.UserId, PlanTestHelpers.CreateMealFood());

        var response = await client.Http.GetAsync("/client/nutrition/plan/full", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<GetFullPlanResponse>(Json, TestContext.Current.CancellationToken))!;
        body.PlanId.Should().Be(plan.ExternalId);
        body.CurrentWeek.Should().BeNull();
        body.CurrentDayOfWeek.Should().BeNull();
        body.Weeks.Should().ContainSingle();
    }

    [Fact]
    public async Task FullPlan_UpcomingPlanWithOnlyDraftWeek_Returns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active, NextWeekMonday(), null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Draft));

        var response = await client.Http.GetAsync("/client/nutrition/plan/full", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task FullPlan_NoPlan_Returns404_AndAnotherClientsUpcomingPlanIsNeverReturned()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await InsertUpcomingPlanAsync(other.UserId, PlanTestHelpers.CreateMealFood());

        var response = await client.Http.GetAsync("/client/nutrition/plan/full", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ShoppingList_UpcomingPlanWeek1_Returns200_AndNoPlanReturns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var stranger = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Rice");
        await InsertUpcomingPlanAsync(client.UserId, food);

        var response = await client.Http.GetAsync(
            "/client/nutrition/plan/shopping-list?weekFrom=1&weekTo=1", TestContext.Current.CancellationToken);
        var noPlanResponse = await stranger.Http.GetAsync(
            "/client/nutrition/plan/shopping-list?weekFrom=1&weekTo=1", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = (await response.Content.ReadFromJsonAsync<GetShoppingListResponse>(Json, TestContext.Current.CancellationToken))!;
        body.Items.Should().ContainSingle(i => i.FoodExternalId == food.FoodExternalId);
        noPlanResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TickShoppingListItem_UpcomingPlanWeek1_Returns204()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var food = PlanTestHelpers.CreateMealFood(foodName: "Lentils");
        await InsertUpcomingPlanAsync(client.UserId, food);

        var response = await client.Http.PutAsJsonAsync(
            "/client/nutrition/plan/shopping-list/ticks",
            new SetShoppingListItemTickedRequest { WeekNumber = 1, FoodExternalId = food.FoodExternalId, IsTicked = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task WeekPlan_UpcomingPlan_StillReturns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await InsertUpcomingPlanAsync(client.UserId, PlanTestHelpers.CreateMealFood());

        var response = await client.Http.GetAsync("/client/nutrition/plan/week", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ClientPlans_Averages_AreScopedToTheCaller()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var plan = await InsertUpcomingPlanAsync(client.UserId, PlanTestHelpers.CreateMealFood(kcal: 300, protein: 20, carbs: 30, fat: 10));
        await InsertUpcomingPlanAsync(other.UserId, PlanTestHelpers.CreateMealFood(kcal: 9000, protein: 900, carbs: 900, fat: 900));

        var response = await client.Http.GetAsync("/client/plans", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = (await response.Content.ReadFromJsonAsync<GetClientPlansResponse>(Json, TestContext.Current.CancellationToken))!.Items;
        var item = items.Should().ContainSingle().Subject;
        item.PlanId.Should().Be(plan.ExternalId);
        item.AvgKcalPerDay.Should().Be(300m);
        item.AvgProteinPerDay.Should().Be(20m);
        item.AvgCarbsPerDay.Should().Be(30m);
        item.AvgFatPerDay.Should().Be(10m);
    }
}
