using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Services;
using FluentAssertions;

namespace FormUp.Tests.Services;

/// <summary>
/// The eaten share of a meal: eaten current items over current items.
/// </summary>
public class MealItemEatenStateTests
{
    private static readonly Guid FoodId = Guid.NewGuid();
    private static readonly Guid RecipeId = Guid.NewGuid();

    private static PlanMeal Meal() => new()
    {
        MealId = Guid.NewGuid(),
        Foods = [new MealFood { ItemId = FoodId }],
        Recipes = [new MealRecipe { ItemId = RecipeId }],
    };

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 0.5)]
    [InlineData(2, 1)]
    public void EatenShare_CountsEatenCurrentItems(int eatenCount, double expected)
    {
        var eaten = new[] { FoodId, RecipeId }.Take(eatenCount).ToList();

        MealItemEatenState.EatenShare(Meal(), eaten).Should().Be((decimal)expected);
    }

    [Fact]
    public void EatenShare_IgnoresIdsOfRemovedItems()
    {
        MealItemEatenState.EatenShare(Meal(), [FoodId, Guid.NewGuid(), Guid.NewGuid()]).Should().Be(0.5m);
    }

    [Theory]
    [InlineData(true, 1)]
    [InlineData(false, 0)]
    public void EatenShare_MealWithoutItems_FollowsTheEatenMarker(bool markedEaten, double expected)
    {
        var empty = new PlanMeal { MealId = Guid.NewGuid() };

        MealItemEatenState.EatenShare(empty, [], markedEaten).Should().Be((decimal)expected);
    }
}
