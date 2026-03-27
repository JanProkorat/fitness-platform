using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Foods.CreateFood;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="CreateFoodEndpoint"/>.
/// </summary>
public class CreateFoodEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesFood()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();

        var ep = Factory.Create<CreateFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var request = new CreateFoodRequest
        {
            Name = "Custom Protein Bar",
            NutrientValue = new NutrientValueDto
            {
                Kcal = 200,
                Protein = 20,
                Carbs = 20,
                Fat = 5
            },
            Allergens = ["milk", "soy"],
            CommonServings = [new ServingSizeDto { Label = "1 bar", WeightGrams = 60 }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.Foods.Received(1).InsertOneAsync(
            Arg.Is<Food>(f =>
                f.Name == "Custom Protein Bar" &&
                f.NutritionistId == _nutritionistId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();
        var ep = Factory.Create<CreateFoodEndpoint>(mongo);

        await ep.HandleAsync(new CreateFoodRequest { Name = "Test" }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
