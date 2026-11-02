using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Compliance scores a partly eaten meal by its eaten share. Runs against real Mongo because the
/// bug was in the row filter: a mock would return the row whatever the filter says.
/// </summary>
[Collection(TestCollection.Name)]
public class ComplianceServicePartlyEatenTests(FitnessApiFactory factory)
{
    private async Task<ComplianceResult> ComplianceAsync(Guid clientUserId)
    {
        using var scope = factory.Services.CreateScope();
        var compliance = scope.ServiceProvider.GetRequiredService<IComplianceService>();
        var today = MealItemPlanSeeder.Today;

        return await compliance.CalculateComplianceAsync(clientUserId, today, today, TestContext.Current.CancellationToken);
    }

    private async Task<int> StreakAsync(Guid clientUserId)
    {
        using var scope = factory.Services.CreateScope();
        var compliance = scope.ServiceProvider.GetRequiredService<IComplianceService>();

        return await compliance.CalculateStreakAsync(
            clientUserId, DateOnly.FromDateTime(MealItemPlanSeeder.Today), TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Compliance_PhotoOnlyRow_ScoresZero()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null);

        var result = await ComplianceAsync(clientId);

        result.MealsPlanned.Should().Be(1);
        result.MealsLogged.Should().Be(0);
        result.MealsPartlyEaten.Should().Be(0);
        result.MealsEatenShare.Should().Be(0m);
        result.NutritionCompliancePercent.Should().Be(0m);
    }

    [Fact]
    public async Task Compliance_PartlyEatenRowWithoutEatenAt_ScoresTheEatenShare()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null, seeded.FoodAId, seeded.FoodBId);

        var result = await ComplianceAsync(clientId);

        result.MealsLogged.Should().Be(0);
        result.MealsPartlyEaten.Should().Be(1);
        result.MealsEatenShare.Should().BeApproximately(2m / 3m, 0.0001m);
        result.NutritionCompliancePercent.Should().Be(66.7m);
    }

    [Fact]
    public async Task Compliance_FullyEatenRow_ScoresAWholeMeal()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(
            factory, clientId, seeded, DateTime.UtcNow, seeded.FoodAId, seeded.FoodBId, seeded.RecipeId);

        var result = await ComplianceAsync(clientId);

        result.MealsLogged.Should().Be(1);
        result.MealsPartlyEaten.Should().Be(0);
        result.MealsEatenShare.Should().Be(1m);
        result.NutritionCompliancePercent.Should().Be(100m);
    }

    [Fact]
    public async Task Compliance_LegacyEatenRowWithoutItemIds_ScoresAWholeMeal()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, DateTime.UtcNow);

        var result = await ComplianceAsync(clientId);

        result.MealsLogged.Should().Be(1);
        result.MealsEatenShare.Should().Be(1m);
        result.NutritionCompliancePercent.Should().Be(100m);
    }

    [Fact]
    public async Task Compliance_CoachAddsItemAfterFullEat_ScoresTheShareNotAWholeMeal()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(
            factory, clientId, seeded, DateTime.UtcNow, seeded.FoodAId, seeded.FoodBId, seeded.RecipeId);
        await MealItemPlanSeeder.AddFoodAsync(factory, seeded);

        var result = await ComplianceAsync(clientId);

        result.MealsLogged.Should().Be(0);
        result.MealsPartlyEaten.Should().Be(1);
        result.MealsEatenShare.Should().Be(0.75m);
        result.NutritionCompliancePercent.Should().Be(75m);
    }

    [Fact]
    public async Task Compliance_CoachRemovesTheOnlyUneatenItem_CountsAsEatenWithoutEatenAt()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null, seeded.FoodAId, seeded.FoodBId);
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.RecipeId);

        var result = await ComplianceAsync(clientId);

        result.MealsLogged.Should().Be(1);
        result.MealsPartlyEaten.Should().Be(0);
        result.NutritionCompliancePercent.Should().Be(100m);
    }

    [Fact]
    public async Task Compliance_StoredIdOfRemovedItem_IsIgnored()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null, seeded.FoodAId, Guid.NewGuid());

        var result = await ComplianceAsync(clientId);

        result.MealsEatenShare.Should().BeApproximately(1m / 3m, 0.0001m);
        result.MealsPartlyEaten.Should().Be(1);
    }

    [Fact]
    public async Task Streak_PartlyEatenMealToday_CountsTheDayAsLogged()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null, seeded.FoodAId);

        (await StreakAsync(clientId)).Should().Be(1);
    }

    [Fact]
    public async Task Streak_PhotoOnlyRowToday_DoesNotCountTheDay()
    {
        var clientId = Guid.NewGuid();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, clientId);
        await MealItemPlanSeeder.InsertLogAsync(factory, clientId, seeded, eatenAt: null);

        (await StreakAsync(clientId)).Should().Be(0);
    }
}
