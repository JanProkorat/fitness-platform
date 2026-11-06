using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Services;
using FluentAssertions;

namespace FormUp.Tests.Services;

/// <summary>
/// <see cref="MealLogMerger"/> reads a row's snapshot first and falls back to the live plan meal.
/// </summary>
public class MealLogMergerTests
{
    private static readonly DateTime Day = new(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc);
    private static readonly Guid PlanId = Guid.NewGuid();
    private static readonly Guid MealId = Guid.NewGuid();
    private static readonly Guid FoodId = Guid.NewGuid();
    private static readonly Guid RecipeId = Guid.NewGuid();

    private static PlanMeal LiveMeal(params Guid[] itemIds) => new()
    {
        MealId = MealId,
        Foods = itemIds.Select(id => new MealFood { ItemId = id, AmountGrams = 100, NutrientValuePer100Grams = new NutrientValue { Kcal = 50 } }).ToList(),
    };

    private static MealLog Row(DateTime? eatenAt, List<Guid> eatenIds, List<EatenMealItem>? snapshot = null) => new()
    {
        PlanId = PlanId,
        MealId = MealId,
        LogDate = Day,
        EatenAt = eatenAt,
        EatenItemIds = eatenIds,
        EatenSnapshot = snapshot,
    };

    private static List<MergedMealLog> Merge(PlanMeal? live, params MealLog[] rows) =>
        MealLogMerger.Merge(rows, (_, _, _) => live);

    [Fact]
    public void Merge_SnapshotRow_IsEatenAgainstItsSnapshotWhenTheLivePlanGrewAnItem()
    {
        var snapshot = new List<EatenMealItem>
        {
            new() { ItemId = FoodId, Kcal = 120m },
            new() { ItemId = RecipeId, Kind = SeenMealItemKind.Recipe, Kcal = 300m },
        };
        var live = LiveMeal(FoodId, RecipeId, Guid.NewGuid());

        var merged = Merge(live, Row(Day, [FoodId, RecipeId], snapshot)).Single();

        merged.State.Should().Be(MealEatenState.Eaten);
        merged.Share.Should().Be(1m);
        merged.SnapshotTotals!.Kcal.Should().Be(420m);
    }

    [Fact]
    public void Merge_SnapshotRow_KeepsItsEatenItemsWhenTheLivePlanDroppedThem()
    {
        var snapshot = new List<EatenMealItem> { new() { ItemId = FoodId, Kcal = 120m }, new() { ItemId = RecipeId, Kcal = 300m } };

        var merged = Merge(LiveMeal(RecipeId), Row(null, [FoodId], snapshot)).Single();

        merged.State.Should().Be(MealEatenState.PartlyEaten);
        merged.Share.Should().Be(0.5m);
        merged.EatenItemIds.Should().BeEquivalentTo([FoodId]);
        merged.SnapshotTotals!.Kcal.Should().Be(120m);
    }

    [Fact]
    public void Merge_SnapshotRowWhoseMealLeftThePlan_StillCountsAsEaten()
    {
        var snapshot = new List<EatenMealItem> { new() { ItemId = FoodId, Kcal = 120m } };

        var merged = Merge(null, Row(Day, [FoodId], snapshot)).Single();

        merged.State.Should().Be(MealEatenState.Eaten);
        merged.SnapshotTotals!.Kcal.Should().Be(120m);
    }

    [Fact]
    public void Merge_LegacyRow_ReadsTheLiveMealAndHasNoSnapshotTotals()
    {
        var live = LiveMeal(FoodId, RecipeId);

        var merged = Merge(live, Row(null, [FoodId])).Single();

        merged.State.Should().Be(MealEatenState.PartlyEaten);
        merged.Share.Should().Be(0.5m);
        merged.SnapshotTotals.Should().BeNull();
    }

    [Fact]
    public void Merge_LegacyEatenRowWithoutItemIds_CountsEveryLiveItem()
    {
        var merged = Merge(LiveMeal(FoodId, RecipeId), Row(Day, [])).Single();

        merged.State.Should().Be(MealEatenState.Eaten);
        merged.EatenItemIds.Should().BeEquivalentTo([FoodId, RecipeId]);
        merged.SnapshotTotals.Should().BeNull();
    }
}
