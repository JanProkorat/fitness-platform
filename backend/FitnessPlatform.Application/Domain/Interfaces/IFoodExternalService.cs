using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// External food data provider (e.g. Open Food Facts).
/// Barcode lookups are cache-first: checks MongoDB before calling the external API.
/// </summary>
public interface IFoodExternalService
{
    /// <summary>
    /// Looks up a food by barcode. Checks MongoDB cache first (hit if &lt; 30 days old),
    /// then falls back to the external API, stores the result, and returns it.
    /// </summary>
    /// <param name="barcode">EAN/UPC barcode string.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The matching food, or <c>null</c> if not found.</returns>
    Task<Food?> SearchByBarcodeAsync(string barcode, CancellationToken ct = default);

    /// <summary>
    /// Searches for foods by name via the external API.
    /// </summary>
    /// <param name="query">Free-text search query.</param>
    /// <param name="limit">Maximum number of results to return.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A list of matching foods (mapped to internal document format).</returns>
    Task<List<Food>> SearchByNameAsync(string query, int limit, CancellationToken ct = default);
}
