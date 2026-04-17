using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.CreateRecipe;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Tests for <see cref="CreateRecipeEndpoint"/> focused on the visibility default/override behaviour.
/// </summary>
public class CreateRecipeEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_VisibilityOmitted_DefaultsToPublic()
    {
        var foodId = Guid.NewGuid();
        var food = new Food
        {
            ExternalId = foodId,
            Name = "Chicken",
            NutrientValue = new NutrientValue { Kcal = 100, Protein = 20, Carbs = 0, Fat = 2 }
        };
        var mongo = RecipeTestHelpers.CreateMockMongo(foods: [food]);

        var ep = Factory.Create<CreateRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var request = new CreateRecipeRequest
        {
            Name = "Default Public Recipe",
            Foods = [new RecipeFoodDto { FoodExternalId = foodId, AmountGrams = 150 }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.Recipes.Received(1).InsertOneAsync(
            Arg.Is<Recipe>(r => r.Visibility == RecipeVisibility.Public && r.NutritionistId == _nutritionistId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_VisibilityPrivate_IsPersisted()
    {
        var foodId = Guid.NewGuid();
        var food = new Food
        {
            ExternalId = foodId,
            Name = "Chicken",
            NutrientValue = new NutrientValue { Kcal = 100, Protein = 20, Carbs = 0, Fat = 2 }
        };
        var mongo = RecipeTestHelpers.CreateMockMongo(foods: [food]);

        var ep = Factory.Create<CreateRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var request = new CreateRecipeRequest
        {
            Name = "Secret Recipe",
            Visibility = RecipeVisibility.Private,
            Foods = [new RecipeFoodDto { FoodExternalId = foodId, AmountGrams = 150 }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        await mongo.Recipes.Received(1).InsertOneAsync(
            Arg.Is<Recipe>(r => r.Visibility == RecipeVisibility.Private),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = RecipeTestHelpers.CreateMockMongo();
        var ep = Factory.Create<CreateRecipeEndpoint>(mongo);

        await ep.HandleAsync(
            new CreateRecipeRequest { Name = "Unauth", Foods = [] },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
