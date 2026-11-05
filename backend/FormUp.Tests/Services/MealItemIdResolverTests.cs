using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Services;

namespace FormUp.Tests.Services;

public class MealItemIdResolverTests
{
    private static readonly Guid RiceRef = Guid.NewGuid();
    private static readonly Guid ChickenRef = Guid.NewGuid();

    private static PlanMeal StoredMeal(params (Guid ItemId, Guid Ref)[] foods) => new()
    {
        Foods = foods.Select(food => new MealFood { ItemId = food.ItemId, FoodExternalId = food.Ref }).ToList(),
    };

    [Fact]
    public void ResolveFoodIds_SentIdOfStoredMeal_IsKeptEvenWhenReordered()
    {
        var riceId = Guid.NewGuid();
        var chickenId = Guid.NewGuid();
        var stored = StoredMeal((riceId, RiceRef), (chickenId, ChickenRef));

        var ids = MealItemIdResolver.ResolveFoodIds(stored, [(chickenId, ChickenRef), (riceId, RiceRef)]);

        ids.Should().Equal(chickenId, riceId);
    }

    [Fact]
    public void ResolveFoodIds_NoSentId_MatchesByReferenceInOccurrenceOrder()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var stored = StoredMeal((first, RiceRef), (second, RiceRef));

        var ids = MealItemIdResolver.ResolveFoodIds(stored, [(null, RiceRef), (null, RiceRef)]);

        ids.Should().Equal(first, second);
    }

    [Fact]
    public void ResolveFoodIds_SentIdNotInStoredMeal_FallsBackToReferenceMatch()
    {
        var stored = StoredMeal((Guid.NewGuid(), RiceRef));

        var ids = MealItemIdResolver.ResolveFoodIds(stored, [(Guid.NewGuid(), RiceRef)]);

        ids.Should().Equal(stored.Foods[0].ItemId);
    }

    [Fact]
    public void ResolveFoodIds_DuplicateSentId_SecondOccurrenceGetsAnotherId()
    {
        var riceId = Guid.NewGuid();
        var stored = StoredMeal((riceId, RiceRef));

        var ids = MealItemIdResolver.ResolveFoodIds(stored, [(riceId, RiceRef), (riceId, RiceRef)]);

        ids[0].Should().Be(riceId);
        ids[1].Should().NotBe(Guid.Empty).And.NotBe(riceId);
    }

    [Fact]
    public void ResolveFoodIds_NoStoredMeal_MintsDistinctNewIds()
    {
        var ids = MealItemIdResolver.ResolveFoodIds(null, [(Guid.NewGuid(), RiceRef), (null, RiceRef)]);

        ids.Should().OnlyContain(id => id != Guid.Empty);
        ids.Distinct().Should().HaveCount(2);
    }

    [Fact]
    public void ResolveRecipeIds_MatchesRecipesSeparatelyFromFoods()
    {
        var recipeId = Guid.NewGuid();
        var recipeRef = Guid.NewGuid();
        var stored = new PlanMeal
        {
            Foods = [new MealFood { ItemId = Guid.NewGuid(), FoodExternalId = recipeRef }],
            Recipes = [new MealRecipe { ItemId = recipeId, RecipeId = recipeRef }],
        };

        var ids = MealItemIdResolver.ResolveRecipeIds(stored, [(null, recipeRef)]);

        ids.Should().Equal(recipeId);
    }
}
