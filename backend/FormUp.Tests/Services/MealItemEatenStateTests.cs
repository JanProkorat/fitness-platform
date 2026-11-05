using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
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

    private static MealLog SnapshotRow(Guid[] snapshotIds, params Guid[] eatenIds) => new()
    {
        EatenItemIds = eatenIds.ToList(),
        EatenSnapshot = snapshotIds.Select(id => new EatenMealItem { ItemId = id, Kcal = 100m }).ToList(),
    };

    [Fact]
    public void ItemIds_RowWithSnapshot_UsesTheSnapshotNotTheLiveMeal()
    {
        var removedId = Guid.NewGuid();
        var row = SnapshotRow([FoodId, removedId]);

        MealItemEatenState.ItemIds(row, Meal()).Should().BeEquivalentTo([FoodId, removedId]);
    }

    [Fact]
    public void ItemIds_LegacyRow_FallsBackToTheLiveMeal()
    {
        MealItemEatenState.ItemIds(new MealLog(), Meal()).Should().BeEquivalentTo([FoodId, RecipeId]);
    }

    [Fact]
    public void EffectiveEatenIds_SnapshotRow_KeepsIdsOfItemsTheLiveMealNoLongerHas()
    {
        var removedId = Guid.NewGuid();
        var row = SnapshotRow([FoodId, removedId], FoodId, removedId);

        MealItemEatenState.EffectiveEatenIds(row, Meal()).Should().BeEquivalentTo([FoodId, removedId]);
    }

    [Fact]
    public void EffectiveEatenIds_LegacyRow_StillDropsIdsOfRemovedItems()
    {
        var row = new MealLog { EatenItemIds = [FoodId, Guid.NewGuid()] };

        MealItemEatenState.EffectiveEatenIds(row, Meal()).Should().BeEquivalentTo([FoodId]);
    }

    [Fact]
    public void StateOf_SnapshotRow_JudgesAgainstTheSnapshotItems()
    {
        var addedLaterId = Guid.NewGuid();
        var meal = Meal();
        meal.Foods.Add(new MealFood { ItemId = addedLaterId });
        var row = SnapshotRow([FoodId, RecipeId], FoodId, RecipeId);
        var eaten = MealItemEatenState.EffectiveEatenIds(row, meal);

        MealItemEatenState.StateOf(MealItemEatenState.ItemIds(row, meal), eaten, markedEaten: true)
            .Should().Be(MealEatenState.Eaten, "an item the coach added later is not part of what was eaten");
        MealItemEatenState.StateOf(meal, eaten, markedEaten: true)
            .Should().Be(MealEatenState.PartlyEaten, "the live meal alone would call it partly eaten");
    }

    [Fact]
    public void BuildSnapshot_FoodsAndRecipes_ScalesNutrientsByAmount()
    {
        var meal = new PlanMeal
        {
            MealId = Guid.NewGuid(),
            Foods =
            [
                new MealFood
                {
                    ItemId = FoodId,
                    FoodExternalId = Guid.NewGuid(),
                    FoodName = "Rice",
                    AmountGrams = 150,
                    NutrientValuePer100Grams = new NutrientValue { Kcal = 130, Protein = 2.7m, Carbs = 28, Fat = 0.3m, Fiber = 0.4m },
                },
            ],
            Recipes =
            [
                new MealRecipe
                {
                    ItemId = RecipeId,
                    RecipeId = Guid.NewGuid(),
                    RecipeName = "Chili",
                    Servings = 2,
                    NutrientValuePerServing = new NutrientValue { Kcal = 400, Protein = 30, Carbs = 40, Fat = 12, Fiber = null },
                },
            ],
        };

        var snapshot = MealItemEatenState.BuildSnapshot(meal);

        var rice = snapshot.Single(item => item.ItemId == FoodId);
        rice.Kind.Should().Be(SeenMealItemKind.Food);
        rice.Kcal.Should().Be(195m);
        rice.Fibre.Should().Be(0.6m);
        var chili = snapshot.Single(item => item.ItemId == RecipeId);
        chili.Kind.Should().Be(SeenMealItemKind.Recipe);
        chili.Amount.Should().Be(2m);
        chili.Kcal.Should().Be(800m);
        chili.Protein.Should().Be(60m);
        chili.Fibre.Should().Be(0m);
    }

    [Fact]
    public void SnapshotTotals_SumsOnlyTheEatenItems_AndIsNullWithoutASnapshot()
    {
        var row = SnapshotRow([FoodId, RecipeId], FoodId);

        MealItemEatenState.SnapshotTotals(row.EatenSnapshot, [FoodId])!.Kcal.Should().Be(100m);
        MealItemEatenState.SnapshotTotals(null, [FoodId]).Should().BeNull();
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
