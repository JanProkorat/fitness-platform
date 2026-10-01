using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Localized display labels for <see cref="FoodCategory"/>, copied verbatim from the
/// <c>foods.category*</c> keys in <c>web/src/i18n/locales/{cs,en,de}.json</c>. Backs the
/// alphabetical-by-label category sort in <c>SearchFoodsEndpoint</c> (#1139) — if a label ever
/// changes in those locale files, update the matching entry here too.
/// </summary>
public static class FoodCategoryLabels
{
    /// <summary>Czech labels, keyed by <see cref="FoodCategory"/> member.</summary>
    public static readonly IReadOnlyDictionary<FoodCategory, string> Cs = new Dictionary<FoodCategory, string>
    {
        [FoodCategory.Fruit] = "Ovoce",
        [FoodCategory.Vegetables] = "Zelenina",
        [FoodCategory.Meat] = "Maso",
        [FoodCategory.FishAndSeafood] = "Ryby a mořské plody",
        [FoodCategory.Dairy] = "Mléčné výrobky",
        [FoodCategory.GrainsAndCereals] = "Obiloviny",
        [FoodCategory.Legumes] = "Luštěniny",
        [FoodCategory.NutsAndSeeds] = "Ořechy a semena",
        [FoodCategory.OilsAndFats] = "Oleje a tuky",
        [FoodCategory.SweetsAndSnacks] = "Sladkosti a svačiny",
        [FoodCategory.Beverages] = "Nápoje",
        [FoodCategory.Supplements] = "Doplňky stravy",
        [FoodCategory.Other] = "Ostatní"
    };

    /// <summary>English labels, keyed by <see cref="FoodCategory"/> member.</summary>
    public static readonly IReadOnlyDictionary<FoodCategory, string> En = new Dictionary<FoodCategory, string>
    {
        [FoodCategory.Fruit] = "Fruit",
        [FoodCategory.Vegetables] = "Vegetables",
        [FoodCategory.Meat] = "Meat",
        [FoodCategory.FishAndSeafood] = "Fish & Seafood",
        [FoodCategory.Dairy] = "Dairy",
        [FoodCategory.GrainsAndCereals] = "Grains & Cereals",
        [FoodCategory.Legumes] = "Legumes",
        [FoodCategory.NutsAndSeeds] = "Nuts & Seeds",
        [FoodCategory.OilsAndFats] = "Oils & Fats",
        [FoodCategory.SweetsAndSnacks] = "Sweets & Snacks",
        [FoodCategory.Beverages] = "Beverages",
        [FoodCategory.Supplements] = "Supplements",
        [FoodCategory.Other] = "Other"
    };

    /// <summary>German labels, keyed by <see cref="FoodCategory"/> member.</summary>
    public static readonly IReadOnlyDictionary<FoodCategory, string> De = new Dictionary<FoodCategory, string>
    {
        [FoodCategory.Fruit] = "Obst",
        [FoodCategory.Vegetables] = "Gemüse",
        [FoodCategory.Meat] = "Fleisch",
        [FoodCategory.FishAndSeafood] = "Fisch & Meeresfrüchte",
        [FoodCategory.Dairy] = "Milchprodukte",
        [FoodCategory.GrainsAndCereals] = "Getreide",
        [FoodCategory.Legumes] = "Hülsenfrüchte",
        [FoodCategory.NutsAndSeeds] = "Nüsse & Samen",
        [FoodCategory.OilsAndFats] = "Öle & Fette",
        [FoodCategory.SweetsAndSnacks] = "Süßigkeiten & Snacks",
        [FoodCategory.Beverages] = "Getränke",
        [FoodCategory.Supplements] = "Nahrungsergänzung",
        [FoodCategory.Other] = "Sonstiges"
    };

    /// <summary>
    /// Resolves the label table for a language code ("cs"/"en"/"de", case-insensitive),
    /// defaulting to Czech for anything else — matches the fallback used for the Name sort's
    /// collation.
    /// </summary>
    public static IReadOnlyDictionary<FoodCategory, string> ForLanguage(string? language) =>
        language?.ToLowerInvariant() switch
        {
            "en" => En,
            "de" => De,
            _ => Cs
        };
}
