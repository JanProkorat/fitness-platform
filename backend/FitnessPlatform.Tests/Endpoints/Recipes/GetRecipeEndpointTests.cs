using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.GetRecipe;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Tests for <see cref="GetRecipeEndpoint"/> focused on visibility behaviour.
/// </summary>
public class GetRecipeEndpointTests
{
    [Fact]
    public async Task HandleAsync_Owner_CanReadPrivateRecipe()
    {
        var ownerId = Guid.NewGuid();
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(
            externalId: recipeId,
            nutritionistId: ownerId,
            name: "Private Thing",
            visibility: RecipeVisibility.Private);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<GetRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetRecipeRequest { RecipeId = recipeId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Private Thing");
        ep.Response.Visibility.Should().Be(RecipeVisibility.Private);
        ep.Response.IsOwnedByCurrentUser.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_OtherNutritionist_CanReadPublicRecipe()
    {
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(
            externalId: recipeId,
            nutritionistId: ownerId,
            name: "Shared Salad",
            visibility: RecipeVisibility.Public);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<GetRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetRecipeRequest { RecipeId = recipeId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Shared Salad");
        ep.Response.Visibility.Should().Be(RecipeVisibility.Public);
        ep.Response.IsOwnedByCurrentUser.Should().BeFalse();
    }

    [Fact]
    public async Task HandleAsync_RecipeMissing_Returns404()
    {
        var mongo = RecipeTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetRecipeEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetRecipeRequest { RecipeId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
