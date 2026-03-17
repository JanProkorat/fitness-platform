using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Features.Foods.GetFood;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="GetFoodEndpoint"/>.
/// </summary>
public class GetFoodEndpointTests
{
    [Fact]
    public async Task HandleAsync_FoodExists_ReturnsFoodSummary()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, name: "Banana");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Banana");
        ep.Response.FoodId.Should().Be(foodId);
    }

    [Fact]
    public async Task HandleAsync_FoodNotFound_Returns404()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetFoodEndpoint>(mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
