using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Features.Recipes.UpdateRecipe;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Tests for <see cref="UpdateRecipeEndpoint"/>.
/// </summary>
public class UpdateRecipeEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_OwnerFlipsVisibility_Succeeds()
    {
        var recipeId = Guid.NewGuid();
        var foodId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(
            externalId: recipeId,
            nutritionistId: _nutritionistId,
            visibility: RecipeVisibility.Public);
        var food = new Food
        {
            ExternalId = foodId,
            Name = "Chicken",
            NutrientValue = new NutrientValue { Kcal = 100, Protein = 20, Carbs = 0, Fat = 2 }
        };
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe], foods: [food]);

        var ep = Factory.Create<UpdateRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var request = new UpdateRecipeRequest
        {
            RecipeId = recipeId,
            Name = "Same Name",
            Visibility = RecipeVisibility.Private,
            Foods = [new RecipeFoodDto { FoodExternalId = foodId, AmountGrams = 100 }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        await mongo.Recipes.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Recipe>>(),
            Arg.Is<Recipe>(r => r.Visibility == RecipeVisibility.Private),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotOwner_Returns404()
    {
        var recipeId = Guid.NewGuid();
        // Recipe belongs to a different nutritionist — owner filter returns nothing.
        var mongo = RecipeTestHelpers.CreateMockMongo();

        var ep = Factory.Create<UpdateRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var request = new UpdateRecipeRequest
        {
            RecipeId = recipeId,
            Name = "Hacked",
            Foods = []
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
