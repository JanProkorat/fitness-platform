using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FormUp.Application.Domain.Enums;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using FluentAssertions;

namespace FormUp.Tests.Endpoints.NutritionPlans;

/// <summary>
/// The coach plan view reads a meal's eaten state from the live plan items, so partly eaten meals
/// show as their own state. Real Mongo: the rows are read by plan id, but the state is derived per row.
/// </summary>
[Collection(TestCollection.Name)]
public class GetPlanPartlyEatenIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private async Task<(Actor Coach, Actor Client, SeededItemMeal Seeded)> SeedAsync()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync();
        var client = await TestActors.Client(factory).CreateAsync();
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await MealItemPlanSeeder.SetNutritionistAsync(factory, seeded.PlanId, coach.UserId);

        return (coach, client, seeded);
    }

    private async Task<MealStatusDto?> MealStatusAsync(Actor coach, SeededItemMeal seeded)
    {
        var response = await coach.Http.GetAsync($"/nutrition/plans/{seeded.PlanId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var plan = (await response.Content.ReadFromJsonAsync<PlanDto>(JsonOptions, TestContext.Current.CancellationToken))!;

        return plan.MealLogs.SingleOrDefault(log => log.MealId == seeded.MealId);
    }

    [Fact]
    public async Task GetPlan_PartlyEatenRowWithoutEatenAt_ReportsPartlyEatenWithItsItems()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null, seeded.FoodAId, seeded.FoodBId);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.PartlyEaten);
        meal.IsEaten.Should().BeFalse();
        meal.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId, seeded.FoodBId]);
        meal.EatenAt.Should().BeNull();
    }

    [Fact]
    public async Task GetPlan_FullyEatenRow_ReportsEatenWithEatenAt()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(
            factory, client.UserId, seeded, DateTime.UtcNow, seeded.FoodAId, seeded.FoodBId, seeded.RecipeId);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.Eaten);
        meal.IsEaten.Should().BeTrue();
        meal.EatenAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetPlan_LegacyEatenRowWithoutItemIds_ReportsEatenWithEveryItem()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, DateTime.UtcNow);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.Eaten);
        meal.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId, seeded.FoodBId, seeded.RecipeId]);
    }

    [Fact]
    public async Task GetPlan_PhotoOnlyRow_ReportsNotEaten()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.NotEaten);
        meal.IsEaten.Should().BeFalse();
        meal.EatenItemIds.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPlan_CoachAddsItemAfterFullEat_ReportsPartlyEaten()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(
            factory, client.UserId, seeded, DateTime.UtcNow, seeded.FoodAId, seeded.FoodBId, seeded.RecipeId);
        await MealItemPlanSeeder.AddFoodAsync(factory, seeded);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.PartlyEaten);
        meal.IsEaten.Should().BeFalse();
        meal.EatenAt.Should().BeNull();
    }

    [Fact]
    public async Task GetPlan_CoachRemovesTheOnlyUneatenItem_ReportsEatenEvenWithoutEatenAt()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null, seeded.FoodAId, seeded.FoodBId);
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.RecipeId);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenState.Should().Be(MealEatenState.Eaten);
        meal.IsEaten.Should().BeTrue();
    }

    [Fact]
    public async Task GetPlan_StoredIdOfRemovedItem_IsNotReturned()
    {
        var (coach, client, seeded) = await SeedAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null, seeded.FoodAId, seeded.RecipeId);
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.RecipeId);

        var meal = await MealStatusAsync(coach, seeded);

        meal!.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId]);
        meal.EatenState.Should().Be(MealEatenState.PartlyEaten);
    }

    [Fact]
    public async Task GetPlan_NutritionistWithoutLinkToTheClient_Returns404()
    {
        var (_, client, seeded) = await SeedAsync();
        var stranger = await TestActors.Nutritionist(factory).CreateAsync();
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null, seeded.FoodAId);

        var response = await stranger.Http.GetAsync($"/nutrition/plans/{seeded.PlanId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private record PlanDto(List<MealStatusDto> MealLogs);

    private record MealStatusDto(
        Guid MealId, bool IsEaten, MealEatenState EatenState, List<Guid> EatenItemIds, DateTime? EatenAt);
}
