using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.SearchFoods;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="SearchFoodsEndpoint"/>.
/// </summary>
public class SearchFoodsEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private SearchFoodsEndpoint CreateEndpoint(IMongoContext mongo)
        => Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

    [Fact]
    public async Task HandleAsync_LocalResults_ReturnsFoods()
    {
        var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Chicken Breast");
    }

    [Fact]
    public async Task HandleAsync_NoLocalResults_ReturnsEmpty()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // empty

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "quinoa", PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_NoQuery_ReturnsAll()
    {
        var food1 = FoodTestHelpers.CreateFood(name: "Apple");
        var food2 = FoodTestHelpers.CreateFood(name: "Banana");
        var mongo = FoodTestHelpers.CreateMockMongo(food1, food2);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_WithAcceptLanguageCzech_ReturnsCzechName()
    {
        var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
        food.LocalizedNames = new LocalizedNames
        {
            En = "Chicken Breast",
            Cs = "Kuřecí prsa",
        };
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = CreateEndpoint(mongo);
        ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Kuřecí prsa");
    }

    [Fact]
    public async Task HandleAsync_MissingUserIdClaim_Returns401()
    {
        var food = FoodTestHelpers.CreateFood(name: "Anything");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedOwner_IsOwnedFlagIsTrue()
    {
        var ownerId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            name: "My Private Food",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Private);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].IsOwnedByCurrentUser.Should().BeTrue();
        ep.Response.Foods[0].Visibility.Should().Be(FoodVisibility.Private);
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedNonOwner_IsOwnedFlagIsFalse()
    {
        var ownerId = Guid.NewGuid();
        var otherNutritionistId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            name: "Public Food",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Public);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherNutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].IsOwnedByCurrentUser.Should().BeFalse();
    }
}

/// <summary>
/// HTTP-level test for the <c>category</c> query param binding on <c>GET /foods/search</c>. A
/// direct <see cref="SearchFoodsEndpoint.HandleAsync"/> unit call skips FastEndpoints' own query
/// binding, so it cannot prove that a single <c>?category=Dairy</c> (the old link shape) still
/// binds into <see cref="SearchFoodsRequest.Categories"/> as a one-item list. Real HTTP through
/// <see cref="FitnessApiFactory"/> is required.
/// </summary>
[Collection(TestCollection.Name)]
public class SearchFoodsCategoryQueryBindingTests(FitnessApiFactory factory)
{
    [Fact]
    public async Task SearchFoods_SingleCategoryQueryParam_BindsAsOneItemList_AndFiltersResults()
    {
        var ct = TestContext.Current.CancellationToken;
        var nutritionist = await TestActors.Nutritionist(factory).CreateAsync(ct);

        var matchingFoodId = Guid.NewGuid();
        var otherFoodId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

            await mongo.Foods.InsertManyAsync(
            [
                new Food
                {
                    ExternalId = matchingFoodId,
                    Name = "Single Category Binding Dairy",
                    Category = FoodCategory.Dairy,
                    NutritionistId = nutritionist.UserId,
                    Visibility = FoodVisibility.Public,
                    IsDeleted = false,
                    DateCreated = DateTime.UtcNow,
                },
                new Food
                {
                    ExternalId = otherFoodId,
                    Name = "Single Category Binding Meat",
                    Category = FoodCategory.Meat,
                    NutritionistId = nutritionist.UserId,
                    Visibility = FoodVisibility.Public,
                    IsDeleted = false,
                    DateCreated = DateTime.UtcNow,
                },
            ], cancellationToken: ct);
        }

        var response = await nutritionist.Http.GetAsync("/foods/search?category=Dairy", ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // A local minimal shape, not SearchFoodsResponse — FoodSummary.Category/Visibility
        // serialize as strings via the app's globally-configured JsonStringEnumConverter
        // (rules/api-design.md#json-serialization), but HttpContent.ReadFromJsonAsync's default
        // JsonSerializerOptions has no such converter, so deserializing the real response type
        // throws. Only FoodId is needed for this assertion anyway.
        var body = await response.Content.ReadFromJsonAsync<SearchResultShim>(cancellationToken: ct);

        body.Should().NotBeNull();
        body!.Foods.Should().ContainSingle(f => f.FoodId == matchingFoodId);
        body.Foods.Should().NotContain(f => f.FoodId == otherFoodId);
    }

    private record SearchResultShim(List<FoodIdShim> Foods);

    private record FoodIdShim(Guid FoodId);
}
