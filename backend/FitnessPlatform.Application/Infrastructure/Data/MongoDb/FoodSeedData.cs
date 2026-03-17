using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the foods collection — common foods with accurate per-100g macros.
/// Sources: USDA FoodData Central, Czech food composition tables.
/// </summary>
public static class FoodSeedData
{
    /// <summary>
    /// Returns a list of common food items for initial database population.
    /// </summary>
    public static List<Food> GetFoods()
    {
        var now = DateTime.UtcNow;

        return
        [
            // ── Proteins ──────────────────────────────────────────────
            Create("Chicken Breast (raw)", 120, 22.5m, 0, 2.6m, servings: [("1 breast (~175g)", 175)], now: now),
            Create("Chicken Thigh (raw)", 177, 17.3m, 0, 11.5m, servings: [("1 thigh (~115g)", 115)], now: now),
            Create("Turkey Breast (raw)", 104, 23.7m, 0, 0.7m, servings: [("1 portion (150g)", 150)], now: now),
            Create("Beef Sirloin (raw)", 143, 21.3m, 0, 6.3m, servings: [("1 steak (~200g)", 200)], now: now),
            Create("Pork Loin (raw)", 143, 21.1m, 0, 6.1m, servings: [("1 chop (~150g)", 150)], now: now),
            Create("Salmon Fillet (raw)", 208, 20.4m, 0, 13.4m, fiber: 0, saturatedFat: 3.0m, servings: [("1 fillet (~125g)", 125)], now: now),
            Create("Tuna (canned, drained)", 116, 25.5m, 0, 0.8m, servings: [("1 can (~150g)", 150)], now: now),
            Create("Cod Fillet (raw)", 82, 17.8m, 0, 0.7m, servings: [("1 fillet (~150g)", 150)], now: now),
            Create("Shrimp (raw)", 85, 20.1m, 0.2m, 0.5m, servings: [("10 medium (~60g)", 60)], now: now),

            // ── Dairy & Eggs ──────────────────────────────────────────
            Create("Whole Egg", 143, 12.6m, 0.7m, 9.9m, servings: [("1 large (~60g)", 60)], allergens: ["eggs"], now: now),
            Create("Egg White", 52, 10.9m, 0.7m, 0.2m, servings: [("1 white (~33g)", 33)], allergens: ["eggs"], now: now),
            Create("Greek Yogurt (0% fat)", 59, 10.2m, 3.6m, 0.4m, sugar: 3.2m, servings: [("1 cup (~170g)", 170)], allergens: ["milk"], now: now),
            Create("Greek Yogurt (full fat)", 97, 9.0m, 3.6m, 5.0m, sugar: 3.2m, servings: [("1 cup (~170g)", 170)], allergens: ["milk"], now: now),
            Create("Cottage Cheese (low fat)", 72, 12.4m, 2.7m, 1.0m, servings: [("1 cup (~226g)", 226)], allergens: ["milk"], now: now),
            Create("Mozzarella", 280, 27.5m, 3.1m, 17.1m, servings: [("1 ball (~125g)", 125)], allergens: ["milk"], now: now),
            Create("Cheddar Cheese", 403, 24.9m, 1.3m, 33.1m, servings: [("1 slice (~28g)", 28)], allergens: ["milk"], now: now),
            Create("Whole Milk (3.5%)", 64, 3.3m, 4.8m, 3.5m, sugar: 4.8m, servings: [("1 glass (~250ml)", 250)], allergens: ["milk"], now: now),
            Create("Whey Protein Powder", 380, 80.0m, 6.0m, 4.0m, servings: [("1 scoop (~30g)", 30)], allergens: ["milk"], now: now),

            // ── Grains & Starches ─────────────────────────────────────
            Create("White Rice (dry)", 360, 6.6m, 79.3m, 0.6m, fiber: 1.3m, servings: [("1 cup dry (~185g)", 185)], now: now),
            Create("Brown Rice (dry)", 362, 7.5m, 76.2m, 2.7m, fiber: 3.4m, servings: [("1 cup dry (~185g)", 185)], now: now),
            Create("Oats (rolled, dry)", 379, 13.2m, 67.7m, 6.5m, fiber: 10.1m, servings: [("1 cup (~80g)", 80)], allergens: ["gluten"], now: now),
            Create("Whole Wheat Bread", 252, 12.4m, 43.1m, 3.5m, fiber: 6.0m, servings: [("1 slice (~30g)", 30)], allergens: ["gluten"], now: now),
            Create("White Pasta (dry)", 357, 12.5m, 72.2m, 1.5m, fiber: 2.5m, servings: [("1 portion (~80g)", 80)], allergens: ["gluten"], now: now),
            Create("Potato", 77, 2.0m, 17.5m, 0.1m, fiber: 2.2m, servings: [("1 medium (~150g)", 150)], now: now),
            Create("Sweet Potato", 86, 1.6m, 20.1m, 0.1m, fiber: 3.0m, sugar: 4.2m, servings: [("1 medium (~130g)", 130)], now: now),
            Create("Quinoa (dry)", 368, 14.1m, 64.2m, 6.1m, fiber: 7.0m, servings: [("1 cup dry (~170g)", 170)], now: now),
            Create("Couscous (dry)", 376, 12.8m, 77.4m, 0.6m, fiber: 5.0m, servings: [("1 cup dry (~175g)", 175)], allergens: ["gluten"], now: now),

            // ── Fruits ────────────────────────────────────────────────
            Create("Banana", 89, 1.1m, 22.8m, 0.3m, fiber: 2.6m, sugar: 12.2m, servings: [("1 medium (~120g)", 120)], now: now),
            Create("Apple", 52, 0.3m, 13.8m, 0.2m, fiber: 2.4m, sugar: 10.4m, servings: [("1 medium (~180g)", 180)], now: now),
            Create("Blueberries", 57, 0.7m, 14.5m, 0.3m, fiber: 2.4m, sugar: 10.0m, servings: [("1 cup (~150g)", 150)], now: now),
            Create("Strawberries", 32, 0.7m, 7.7m, 0.3m, fiber: 2.0m, sugar: 4.9m, servings: [("1 cup (~152g)", 152)], now: now),
            Create("Orange", 47, 0.9m, 11.8m, 0.1m, fiber: 2.4m, sugar: 9.4m, servings: [("1 medium (~130g)", 130)], now: now),
            Create("Avocado", 160, 2.0m, 8.5m, 14.7m, fiber: 6.7m, saturatedFat: 2.1m, servings: [("1 half (~68g)", 68)], now: now),

            // ── Vegetables ────────────────────────────────────────────
            Create("Broccoli", 34, 2.8m, 6.6m, 0.4m, fiber: 2.6m, servings: [("1 cup chopped (~91g)", 91)], now: now),
            Create("Spinach (raw)", 23, 2.9m, 3.6m, 0.4m, fiber: 2.2m, servings: [("1 cup (~30g)", 30)], now: now),
            Create("Tomato", 18, 0.9m, 3.9m, 0.2m, fiber: 1.2m, sugar: 2.6m, servings: [("1 medium (~123g)", 123)], now: now),
            Create("Cucumber", 15, 0.7m, 3.6m, 0.1m, fiber: 0.5m, servings: [("1 medium (~300g)", 300)], now: now),
            Create("Carrot", 41, 0.9m, 9.6m, 0.2m, fiber: 2.8m, sugar: 4.7m, servings: [("1 medium (~61g)", 61)], now: now),
            Create("Bell Pepper (red)", 31, 1.0m, 6.0m, 0.3m, fiber: 2.1m, sugar: 4.2m, servings: [("1 medium (~120g)", 120)], now: now),

            // ── Legumes & Nuts ────────────────────────────────────────
            Create("Chickpeas (cooked)", 164, 8.9m, 27.4m, 2.6m, fiber: 7.6m, servings: [("1 cup (~164g)", 164)], now: now),
            Create("Lentils (cooked)", 116, 9.0m, 20.1m, 0.4m, fiber: 7.9m, servings: [("1 cup (~198g)", 198)], now: now),
            Create("Almonds", 579, 21.2m, 21.7m, 49.9m, fiber: 12.2m, saturatedFat: 3.7m, servings: [("1 handful (~28g)", 28)], allergens: ["tree nuts"], now: now),
            Create("Peanut Butter", 588, 25.1m, 20.0m, 50.4m, fiber: 6.0m, saturatedFat: 10.3m, servings: [("1 tbsp (~16g)", 16)], allergens: ["peanuts"], now: now),
            Create("Walnuts", 654, 15.2m, 13.7m, 65.2m, fiber: 6.7m, saturatedFat: 6.1m, servings: [("1 handful (~28g)", 28)], allergens: ["tree nuts"], now: now),

            // ── Oils & Fats ───────────────────────────────────────────
            Create("Olive Oil", 884, 0, 0, 100.0m, saturatedFat: 13.8m, servings: [("1 tbsp (~14g)", 14)], now: now),
            Create("Butter", 717, 0.9m, 0.1m, 81.1m, saturatedFat: 51.4m, servings: [("1 tbsp (~14g)", 14)], allergens: ["milk"], now: now),
            Create("Coconut Oil", 862, 0, 0, 100.0m, saturatedFat: 82.5m, servings: [("1 tbsp (~14g)", 14)], now: now),

            // ── Other ─────────────────────────────────────────────────
            Create("Honey", 304, 0.3m, 82.4m, 0, sugar: 82.1m, servings: [("1 tbsp (~21g)", 21)], now: now),
            Create("Dark Chocolate (70%)", 598, 7.8m, 45.9m, 42.6m, fiber: 10.9m, sugar: 24.0m, saturatedFat: 24.5m, servings: [("1 square (~10g)", 10)], allergens: ["milk", "soy"], now: now),
            Create("White Rice (cooked)", 130, 2.7m, 28.2m, 0.3m, fiber: 0.4m, servings: [("1 cup (~158g)", 158)], now: now),
        ];
    }

    private static Food Create(
        string name,
        decimal kcal, decimal protein, decimal carbs, decimal fat,
        decimal? fiber = null, decimal? sugar = null, decimal? saturatedFat = null, decimal? salt = null,
        List<(string label, decimal weightGrams)>? servings = null,
        List<string>? allergens = null,
        DateTime now = default)
    {
        return new Food
        {
            ExternalId = Guid.NewGuid(),
            Name = name,
            Source = "system",
            IsVerified = true,
            NutrientValue = new NutrientValue
            {
                Kcal = kcal,
                Protein = protein,
                Carbs = carbs,
                Fat = fat,
                Fiber = fiber,
                Sugar = sugar,
                SaturatedFat = saturatedFat,
                Salt = salt
            },
            CommonServings = servings?
                .Select(s => new ServingSize { Label = s.label, WeightGrams = s.weightGrams })
                .ToList() ?? [],
            Allergens = allergens ?? [],
            DateCreated = now
        };
    }
}
