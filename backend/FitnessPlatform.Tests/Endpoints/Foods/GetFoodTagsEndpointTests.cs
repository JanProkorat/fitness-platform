using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Foods.GetFoodTags;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="GetFoodTagsEndpoint"/>. Filter/visibility correctness is covered by
/// <see cref="FitnessPlatform.Tests.Endpoints.Recipes.OwnerScopedVisibilityFilterTests"/> since
/// <see cref="FoodTestHelpers.CreateMockMongo"/> ignores the filter passed to FindAsync — this
/// class only proves the distinct/sort logic over whatever documents the mock returns.
/// </summary>
public class GetFoodTagsEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_MultipleFoods_ReturnsDistinctSortedTags()
    {
        var foodA = FoodTestHelpers.CreateFood(name: "Food A");
        foodA.Tags = ["high-protein", "meal-prep"];
        var foodB = FoodTestHelpers.CreateFood(name: "Food B");
        foodB.Tags = ["Meal-Prep", "low-carb"];

        var mongo = FoodTestHelpers.CreateMockMongo(foodA, foodB);

        var ep = Factory.Create<GetFoodTagsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Tags.Should().Equal("high-protein", "low-carb", "meal-prep");
    }

    [Fact]
    public async Task HandleAsync_MissingUserIdClaim_Returns401()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(FoodTestHelpers.CreateFood());

        var ep = Factory.Create<GetFoodTagsEndpoint>(mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
