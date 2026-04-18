using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.SearchRecipes;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Tests for <see cref="SearchRecipesEndpoint"/> focused on visibility-aware summaries.
/// </summary>
public class SearchRecipesEndpointTests
{
    [Fact]
    public async Task HandleAsync_OwnedRecipe_IsOwnedFlagIsTrue()
    {
        var ownerId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(
            nutritionistId: ownerId,
            name: "Mine",
            visibility: RecipeVisibility.Private);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<SearchRecipesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchRecipesRequest(), TestContext.Current.CancellationToken);

        ep.Response.Recipes.Should().HaveCount(1);
        ep.Response.Recipes[0].IsOwnedByCurrentUser.Should().BeTrue();
        ep.Response.Recipes[0].Visibility.Should().Be(RecipeVisibility.Private);
    }

    [Fact]
    public async Task HandleAsync_PublicRecipeFromOther_IsOwnedFlagIsFalse()
    {
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(
            nutritionistId: ownerId,
            name: "Shared",
            visibility: RecipeVisibility.Public);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<SearchRecipesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchRecipesRequest(), TestContext.Current.CancellationToken);

        ep.Response.Recipes.Should().HaveCount(1);
        ep.Response.Recipes[0].IsOwnedByCurrentUser.Should().BeFalse();
        ep.Response.Recipes[0].Visibility.Should().Be(RecipeVisibility.Public);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = RecipeTestHelpers.CreateMockMongo();
        var ep = Factory.Create<SearchRecipesEndpoint>(mongo);

        await ep.HandleAsync(new SearchRecipesRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
