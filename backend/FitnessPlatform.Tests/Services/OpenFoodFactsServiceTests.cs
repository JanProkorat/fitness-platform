using System.Net;
using System.Text;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="OpenFoodFactsService"/>.
/// </summary>
public class OpenFoodFactsServiceTests
{
    private readonly IMongoContext _mongo;
    private readonly IMongoCollection<Food> _foodsCollection;
    private readonly IConfiguration _config;

    public OpenFoodFactsServiceTests()
    {
        _mongo = Substitute.For<IMongoContext>();
        _foodsCollection = Substitute.For<IMongoCollection<Food>>();
        _mongo.Foods.Returns(_foodsCollection);

        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["OpenFoodFacts:CacheDays"] = "30"
            })
            .Build();
    }

    // ── Barcode: Cache hit ────────────────────────────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_CacheHit_ReturnsFromMongo()
    {
        var cached = new Food
        {
            Name = "Cached Product",
            Barcode = "1234567890",
            DateCreated = DateTime.UtcNow.AddDays(-5)
        };

        SetupFindReturns(cached);

        var httpClient = CreateHttpClient(_ => throw new InvalidOperationException("Should not call API"));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("1234567890");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Cached Product");
    }

    // ── Barcode: Stale cache → refresh from API ───────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_StaleCache_CallsApiAndUpserts()
    {
        var stale = new Food
        {
            Name = "Old Product",
            Barcode = "1234567890",
            DateCreated = DateTime.UtcNow.AddDays(-60)
        };

        SetupFindReturns(stale);

        var apiResponse = CreateProductResponse("Fresh Product", "1234567890", 250, 20, 30, 8);
        var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("1234567890");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Fresh Product");
        result.Source.Should().Be("openfoodfacts");
        result.IsVerified.Should().BeFalse();

        await _foodsCollection.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Food>>(),
            Arg.Is<Food>(f => f.Name == "Fresh Product"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Barcode: Cache miss, product found ────────────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_NoCache_ApiFound_ReturnsMappedFood()
    {
        SetupFindReturns(null);

        var apiResponse = CreateProductResponse("Nutella", "3017620422003", 539, 6.3m, 57.5m, 30.9m,
            fiber: 0, sugar: 56.3m, saturatedFat: 10.6m, salt: 0.107m);
        var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("3017620422003");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Nutella");
        result.Barcode.Should().Be("3017620422003");
        result.NutrientValue.Kcal.Should().Be(539);
        result.NutrientValue.Protein.Should().Be(6.3m);
        result.NutrientValue.Carbs.Should().Be(57.5m);
        result.NutrientValue.Fat.Should().Be(30.9m);
        result.NutrientValue.Sugar.Should().Be(56.3m);
        result.NutrientValue.SaturatedFat.Should().Be(10.6m);
        result.NutrientValue.Salt.Should().Be(0.107m);
    }

    // ── Barcode: Not found in API ─────────────────────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_ApiNotFound_ReturnsNull()
    {
        SetupFindReturns(null);

        var response = new OffProductResponse { Status = 0, Product = null };
        var httpClient = CreateHttpClient(_ => CreateJsonResponse(response));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("0000000000");

        result.Should().BeNull();
    }

    // ── Barcode: API failure with stale cache → return stale ──────

    [Fact]
    public async Task SearchByBarcodeAsync_ApiFailure_ReturnsStaleCache()
    {
        var stale = new Food
        {
            Name = "Stale Product",
            Barcode = "1234567890",
            DateCreated = DateTime.UtcNow.AddDays(-60)
        };

        SetupFindReturns(stale);

        var httpClient = CreateHttpClient(_ => throw new HttpRequestException("Network error"));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("1234567890");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Stale Product");
    }

    // ── Barcode: API failure, no cache → return null ──────────────

    [Fact]
    public async Task SearchByBarcodeAsync_ApiFailure_NoCache_ReturnsNull()
    {
        SetupFindReturns(null);

        var httpClient = CreateHttpClient(_ => throw new HttpRequestException("Network error"));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("0000000000");

        result.Should().BeNull();
    }

    // ── Name search: returns mapped results ───────────────────────

    [Fact]
    public async Task SearchByNameAsync_ReturnsMappedResults()
    {
        var searchResponse = new OffSearchResponse
        {
            Count = 2,
            Products =
            [
                new OffProduct
                {
                    Code = "111",
                    ProductName = "Banana Chips",
                    Nutriments = new OffNutriments { EnergyKcalPer100Grams = 520, ProteinsPer100Grams = 2, CarbohydratesPer100Grams = 58, FatPer100Grams = 30 }
                },
                new OffProduct
                {
                    Code = "222",
                    ProductName = "Banana Smoothie",
                    Nutriments = new OffNutriments { EnergyKcalPer100Grams = 80, ProteinsPer100Grams = 1, CarbohydratesPer100Grams = 18, FatPer100Grams = 0.5m }
                }
            ]
        };

        var httpClient = CreateHttpClient(_ => CreateJsonResponse(searchResponse));
        var sut = CreateService(httpClient);

        var results = await sut.SearchByNameAsync("banana", 10);

        results.Should().HaveCount(2);
        results[0].Name.Should().Be("Banana Chips");
        results[1].Name.Should().Be("Banana Smoothie");
        results.Should().AllSatisfy(f =>
        {
            f.Source.Should().Be("openfoodfacts");
            f.IsVerified.Should().BeFalse();
            f.ExternalId.Should().NotBeEmpty();
        });
    }

    // ── Name search: API failure → empty list ─────────────────────

    [Fact]
    public async Task SearchByNameAsync_ApiFailure_ReturnsEmptyList()
    {
        var httpClient = CreateHttpClient(_ => throw new HttpRequestException("Timeout"));
        var sut = CreateService(httpClient);

        var results = await sut.SearchByNameAsync("chicken", 10);

        results.Should().BeEmpty();
    }

    // ── Name search: skips products without name ──────────────────

    [Fact]
    public async Task SearchByNameAsync_SkipsProductsWithoutName()
    {
        var searchResponse = new OffSearchResponse
        {
            Count = 2,
            Products =
            [
                new OffProduct { Code = "111", ProductName = null, Nutriments = new OffNutriments() },
                new OffProduct { Code = "222", ProductName = "Real Product", Nutriments = new OffNutriments { EnergyKcalPer100Grams = 100, ProteinsPer100Grams = 5, CarbohydratesPer100Grams = 10, FatPer100Grams = 3 } }
            ]
        };

        var httpClient = CreateHttpClient(_ => CreateJsonResponse(searchResponse));
        var sut = CreateService(httpClient);

        var results = await sut.SearchByNameAsync("test", 10);

        results.Should().HaveCount(1);
        results[0].Name.Should().Be("Real Product");
    }

    // ── Allergen parsing ──────────────────────────────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_ParsesAllergens()
    {
        SetupFindReturns(null);

        var apiResponse = CreateProductResponse("Test", "1111", 100, 5, 10, 3);
        apiResponse.Product!.AllergensTags = ["en:gluten", "en:milk", "en:eggs"];
        var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("1111");

        result!.Allergens.Should().BeEquivalentTo(["gluten", "milk", "eggs"]);
    }

    // ── Serving size parsing ──────────────────────────────────────

    [Fact]
    public async Task SearchByBarcodeAsync_ParsesServingSize()
    {
        SetupFindReturns(null);

        var apiResponse = CreateProductResponse("Test", "2222", 100, 5, 10, 3);
        apiResponse.Product!.ServingSize = "1 bar (40g)";
        apiResponse.Product.ServingQuantity = 40;
        var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
        var sut = CreateService(httpClient);

        var result = await sut.SearchByBarcodeAsync("2222");

        result!.CommonServings.Should().HaveCount(1);
        result.CommonServings[0].Label.Should().Be("1 bar (40g)");
        result.CommonServings[0].WeightGrams.Should().Be(40);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private OpenFoodFactsService CreateService(HttpClient httpClient) =>
        new(httpClient, _mongo, _config, NullLogger<OpenFoodFactsService>.Instance);

    private void SetupFindReturns(Food? food)
    {
        var cursor = Substitute.For<IAsyncCursor<Food>>();
        var items = food is not null ? new List<Food> { food } : new List<Food>();
        var moved = false;
        cursor.Current.Returns(items);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });

        _foodsCollection.FindAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<FindOptions<Food, Food>>(),
                Arg.Any<CancellationToken>())
            .Returns(cursor);
    }

    private static OffProductResponse CreateProductResponse(
        string name, string barcode, decimal kcal, decimal protein, decimal carbs, decimal fat,
        decimal? fiber = null, decimal? sugar = null, decimal? saturatedFat = null, decimal? salt = null)
    {
        return new OffProductResponse
        {
            Status = 1,
            Product = new OffProduct
            {
                Code = barcode,
                ProductName = name,
                Nutriments = new OffNutriments
                {
                    EnergyKcalPer100Grams = kcal,
                    ProteinsPer100Grams = protein,
                    CarbohydratesPer100Grams = carbs,
                    FatPer100Grams = fat,
                    FiberPer100Grams = fiber,
                    SugarsPer100Grams = sugar,
                    SaturatedFatPer100Grams = saturatedFat,
                    SaltPer100Grams = salt
                }
            }
        };
    }

    private static HttpClient CreateHttpClient(Func<HttpRequestMessage, HttpResponseMessage> handler)
    {
        var messageHandler = new FakeHttpMessageHandler(handler);
        return new HttpClient(messageHandler)
        {
            BaseAddress = new Uri("https://world.openfoodfacts.org/")
        };
    }

    private static HttpResponseMessage CreateJsonResponse<T>(T content)
    {
        var json = JsonSerializer.Serialize(content);
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
    }

    /// <summary>
    /// Simple delegating handler for mocking HttpClient in tests.
    /// </summary>
    private sealed class FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(handler(request));
        }
    }
}
