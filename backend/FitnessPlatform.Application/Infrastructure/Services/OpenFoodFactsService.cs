using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Open Food Facts integration with MongoDB caching.
/// Barcode lookups check the local cache first (30-day TTL) before calling the external API.
/// </summary>
public class OpenFoodFactsService : IFoodExternalService
{
    private readonly HttpClient _httpClient;
    private readonly IMongoContext _mongo;
    private readonly ILogger<OpenFoodFactsService> _logger;
    private readonly int _cacheDays;

    /// <summary>
    /// Initializes a new instance of <see cref="OpenFoodFactsService"/>.
    /// </summary>
    public OpenFoodFactsService(
        HttpClient httpClient,
        IMongoContext mongo,
        IConfiguration configuration,
        ILogger<OpenFoodFactsService> logger)
    {
        _httpClient = httpClient;
        _mongo = mongo;
        _logger = logger;
        _cacheDays = configuration.GetValue("OpenFoodFacts:CacheDays", 30);
    }

    /// <inheritdoc />
    public async Task<Food?> SearchByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        // Check MongoDB cache first
        var cached = await _mongo.Foods
            .Find(f => f.Barcode == barcode && !f.IsDeleted)
            .FirstOrDefaultAsync(ct);

        if (cached is not null)
        {
            var age = DateTime.UtcNow - cached.DateCreated;
            if (age.TotalDays < _cacheDays)
            {
                _logger.LogDebug("Cache hit for barcode {Barcode} (age: {AgeDays}d)", barcode, (int)age.TotalDays);
                return cached;
            }

            _logger.LogDebug("Cache stale for barcode {Barcode} (age: {AgeDays}d), refreshing", barcode, (int)age.TotalDays);
        }

        // Call Open Food Facts API
        OffProductResponse? response;
        try
        {
            response = await _httpClient.GetFromJsonAsync<OffProductResponse>(
                $"api/v2/product/{barcode}.json",
                ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Open Food Facts API call failed for barcode {Barcode}", barcode);
            return cached; // return stale cache if available
        }

        if (response is not { Status: 1, Product: not null })
        {
            _logger.LogDebug("Barcode {Barcode} not found in Open Food Facts", barcode);
            return null;
        }

        var food = MapToFood(response.Product, barcode);

        // Upsert into MongoDB cache
        await _mongo.Foods.ReplaceOneAsync(
            f => f.Barcode == barcode,
            food,
            new ReplaceOptions { IsUpsert = true },
            ct);

        _logger.LogInformation("Cached food from Open Food Facts: {Name} (barcode: {Barcode})", food.Name, barcode);
        return food;
    }

    /// <inheritdoc />
    public async Task<List<Food>> SearchByNameAsync(string query, int limit, CancellationToken ct = default)
    {
        OffSearchResponse? response;
        try
        {
            response = await _httpClient.GetFromJsonAsync<OffSearchResponse>(
                $"cgi/search.pl?search_terms={Uri.EscapeDataString(query)}&search_simple=1&json=true&page_size={limit}",
                ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Open Food Facts search failed for query '{Query}'", query);
            return [];
        }

        if (response?.Products is null or { Count: 0 })
            return [];

        return response.Products
            .Where(p => !string.IsNullOrWhiteSpace(p.ProductName))
            .Select(p => MapToFood(p, p.Code))
            .ToList();
    }

    /// <summary>
    /// Maps an Open Food Facts product to the internal <see cref="Food"/> document.
    /// </summary>
    private static Food MapToFood(OffProduct product, string? barcode)
    {
        var n = product.Nutriments;
        var now = DateTime.UtcNow;

        var food = new Food
        {
            ExternalId = Guid.NewGuid(),
            Name = product.ProductName?.Trim() ?? "Unknown Product",
            Source = "openfoodfacts",
            Barcode = barcode,
            IsVerified = false,
            NutrientValue = new NutrientValue
            {
                Kcal = n?.EnergyKcalPer100Grams ?? 0,
                Protein = n?.ProteinsPer100Grams ?? 0,
                Carbs = n?.CarbohydratesPer100Grams ?? 0,
                Fat = n?.FatPer100Grams ?? 0,
                Fiber = n?.FiberPer100Grams,
                Sugar = n?.SugarsPer100Grams,
                SaturatedFat = n?.SaturatedFatPer100Grams,
                Salt = n?.SaltPer100Grams
            },
            Allergens = ParseAllergens(product.AllergensTags),
            CommonServings = ParseServings(product),
            DateCreated = now
        };

        return food;
    }

    /// <summary>
    /// Converts OFF allergen tags (e.g. "en:gluten") to simple names (e.g. "gluten").
    /// </summary>
    private static List<string> ParseAllergens(List<string>? tags)
    {
        if (tags is null or { Count: 0 })
            return [];

        return tags
            .Select(t =>
            {
                var colonIndex = t.IndexOf(':');
                return colonIndex >= 0 ? t[(colonIndex + 1)..] : t;
            })
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Distinct()
            .ToList();
    }

    /// <summary>
    /// Extracts serving size from OFF product data.
    /// </summary>
    private static List<ServingSize> ParseServings(OffProduct product)
    {
        if (product.ServingQuantity is > 0)
        {
            var label = !string.IsNullOrWhiteSpace(product.ServingSize)
                ? product.ServingSize
                : $"{product.ServingQuantity}g";

            return [new ServingSize { Label = label, WeightGrams = product.ServingQuantity.Value }];
        }

        return [];
    }
}
