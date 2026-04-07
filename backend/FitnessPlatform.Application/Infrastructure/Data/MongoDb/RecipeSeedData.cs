using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the recipes collection — Czech breakfast recipes.
/// Food references are resolved at runtime from the seeded foods collection.
/// </summary>
public static class RecipeSeedData
{
    /// <summary>
    /// Returns a list of recipes to seed. Each recipe references foods by their Czech name
    /// which is resolved to the actual food document at seed time.
    /// </summary>
    public static List<RecipeSeedEntry> GetRecipes()
    {
        return
        [
            new("Avokádo talíř", "Avocado Plate", "Avokádový talíř mit Ei",
                "Pečivo s avokádem, cottage sýrem, vejcem a mozzarellou.",
                10, 500, 30, 34, 27, 2,
                [
                    ("Žitné kváskové pečivo", 50),
                    ("Avokádo", 40),
                    ("Cottage", 50),
                    ("Vejce", 60),
                    ("Mozzarella", 62),
                    ("Sezamová semínka", 5),
                    ("Zelenina", 100),
                ]),

            new("Banánové ovesné lívance", "Banana Oat Pancakes", "Bananen-Hafer-Pfannkuchen",
                "Lívance z banánu a ovesných vloček s tvarohem a chia marmeládou.",
                15, 420, 22, 55, 12, 5,
                [
                    ("Banán", 120),
                    ("Ovesné vločky", 70),
                    ("Vejce", 60),
                    ("Skořice", 2),
                    ("Kokosový olej", 5),
                    ("Tvaroh (nízkotučný)", 125),
                ]),

            new("Domácí granola", "Homemade Granola", "Selbstgemachtes Granola",
                "Ovesné vločky s medem, ořechy a semínky zapečené v troubě.",
                30, 110, 2.5m, 12, 5.5m, 1.5m,
                [
                    ("Ovesné vločky", 250),
                    ("Med", 42),
                    ("Kokosový olej", 28),
                    ("Ořechy", 100),
                    ("Chia semínka", 50),
                    ("Sušené ovoce", 50),
                ]),

            new("Řecký jogurt s domácí granolou a ovocem", "Greek Yogurt with Granola & Fruit", "Griechischer Joghurt mit Granola & Obst",
                "Řecký jogurt s domácí granolou a čerstvým ovocem.",
                5, 355, 20, 33, 15, 3,
                [
                    ("Řecký jogurt", 150),
                    ("Granola", 40),
                    ("Ovoce", 100),
                ]),

            new("Tiramisu chia pudink", "Tiramisu Chia Pudding", "Tiramisu-Chia-Pudding",
                "Chia pudink s espressem, tvarohem a kakaem ve stylu tiramisu.",
                5, 270, 20, 29, 7, 8,
                [
                    ("Piškoty", 30),
                    ("Tvaroh (nízkotučný)", 250),
                    ("Chia semínka", 40),
                    ("Espresso", 30),
                    ("Sladidlo", 8),
                    ("Kakao", 5),
                ]),

            new("Scrambled oats", "Scrambled Oats", "Scrambled Oats",
                "Vločky smíchané s banánem a vejcem na pánvi.",
                10, 225, 13, 30, 6, 4,
                [
                    ("Ovesné vločky", 60),
                    ("Banán", 120),
                    ("Vejce", 60),
                    ("Protein", 30),
                    ("Skořice", 2),
                    ("Kokosový olej", 5),
                ]),

            new("Proteinový chia pudink", "Protein Chia Pudding", "Protein-Chia-Pudding",
                "Chia semínka s mlékem a proteinem — jednoduchá příprava přes noc.",
                5, 350, 27, 19, 16, 11,
                [
                    ("Chia semínka", 40),
                    ("Mléko", 200),
                    ("Protein", 30),
                ]),

            new("Obložený sýrový talíř", "Cheese Plate", "Käseplatte",
                "Žitný chléb s lučinou, vejcem, cottage sýrem, eidamem a zeleninou.",
                5, 650, 37, 66, 27, 5,
                [
                    ("Žitný chléb", 50),
                    ("Lučina", 20),
                    ("Vejce", 60),
                    ("Cottage", 75),
                    ("Eidam 30%", 60),
                    ("Zelenina", 100),
                    ("Jablko", 45),
                ]),

            new("Tvaroh s horkým lesním ovocem a čokoládou", "Quark with Hot Berries & Chocolate", "Quark mit heißen Beeren & Schokolade",
                "Tvaroh s horkým lesním ovocem, hořkou čokoládou, ořechy a chia semínky.",
                5, 500, 36, 23, 26, 8,
                [
                    ("Tvaroh (nízkotučný)", 125),
                    ("Tvaroh (nízkotučný)", 50),
                    ("Mražené ovoce", 150),
                    ("Hořká čokoláda", 10),
                    ("Ořechy", 20),
                    ("Chia semínka", 10),
                    ("Skořice", 2),
                ]),

            new("Overnight protein oats", "Overnight Protein Oats", "Overnight Protein Oats",
                "Ovesné vločky s chia semínky, proteinem a tvarohem připravené přes noc.",
                10, 530, 32, 37, 27, 7,
                [
                    ("Ovesné vločky", 25),
                    ("Chia semínka", 10),
                    ("Protein", 15),
                    ("Mléko", 150),
                    ("Tvaroh (nízkotučný)", 125),
                    ("Ořechy", 15),
                    ("Ovoce", 80),
                    ("Hořká čokoláda", 10),
                ]),

            new("Kokosové řezy", "Coconut Slices", "Kokosschnitten",
                "Piškoty s tvarohem, kokosovým pudinkem a strouhaným kokosem.",
                15, 350, 18, 40, 12, 3,
                [
                    ("Piškoty", 62),
                    ("Tvaroh (nízkotučný)", 250),
                    ("Pudinkový prášek", 40),
                    ("Mléko", 500),
                    ("Strouhaný kokos", 40),
                    ("Protein", 30),
                ]),

            new("Mugcake", "Mug Cake", "Tassenkuchen",
                "Rychlý koláček z mikrovlnky z ovesných vloček, tvarohu a banánu.",
                5, 480, 24, 60, 15, 5,
                [
                    ("Vejce", 60),
                    ("Ovesné vločky", 50),
                    ("Tvaroh (nízkotučný)", 80),
                    ("Banán", 120),
                    ("Kypřící prášek", 5),
                    ("Sladidlo", 8),
                ]),

            new("Croissant dvou tváří", "Two-Faced Croissant", "Croissant zwei Seiten",
                "Croissant plněný lučinou, eidamem a šunkou + řecký jogurt s chia marmeládou.",
                5, 510, 33, 33, 27, 2,
                [
                    ("Croissant", 60),
                    ("Lučina", 20),
                    ("Eidam 30%", 60),
                    ("Šunka", 40),
                    ("Polníčkový salát", 30),
                    ("Řecký jogurt", 70),
                ]),

            new("Palačinky", "Pancakes", "Pfannkuchen",
                "Tenké palačinky ze špaldové mouky s ovocem, tvarohem a medem.",
                15, 140, 7, 11, 7, 2,
                [
                    ("Mléko", 125),
                    ("Vejce", 180),
                    ("Špaldová mouka", 70),
                    ("Kokosový olej", 7),
                    ("Ovoce", 80),
                    ("Tvaroh (nízkotučný)", 50),
                    ("Med", 15),
                ]),

            new("Ovesná kaše s proteinem", "Protein Oatmeal", "Protein-Haferbrei",
                "Ovesná kaše s proteinem, hořkou čokoládou a ořechy.",
                5, 545, 35, 43, 24, 8,
                [
                    ("Ovesné vločky", 50),
                    ("Chia semínka", 10),
                    ("Protein", 30),
                    ("Hořká čokoláda", 10),
                    ("Ořechy", 15),
                    ("Mléko", 100),
                    ("Ovoce", 80),
                ]),

            new("Kefírové smoothie", "Kefir Smoothie", "Kefir-Smoothie",
                "Kefír s ovocem, proteinem a vodou.",
                5, 185, 20, 15, 4, 1,
                [
                    ("Kefír", 250),
                    ("Mražené ovoce", 80),
                    ("Protein", 15),
                    ("Voda", 150),
                ]),

            new("Overnight chia oats", "Overnight Chia Oats", "Overnight Chia Oats",
                "Ovesné vločky s chia semínky a kefírovým mlékem přes noc.",
                10, 550, 34, 35, 28, 8,
                [
                    ("Ovesné vločky", 30),
                    ("Chia semínka", 10),
                    ("Kefírové mléko", 100),
                    ("Tvaroh (nízkotučný)", 125),
                    ("Ořechy", 15),
                    ("Ovoce", 80),
                    ("Hořká čokoláda", 10),
                ]),

            new("Krémová Ovesná kaše s proteinem", "Creamy Protein Oatmeal", "Cremiger Protein-Haferbrei",
                "Krémová ovesná kaše s vejcem, proteinem a hořkou čokoládou.",
                5, 625, 42, 44, 30, 8,
                [
                    ("Ovesné vločky", 50),
                    ("Chia semínka", 10),
                    ("Protein", 30),
                    ("Vejce", 60),
                    ("Hořká čokoláda", 10),
                    ("Ořechy", 15),
                    ("Mléko", 100),
                    ("Ovoce", 80),
                ]),

            new("Krémová Ovesná kaše", "Creamy Oatmeal", "Cremiger Haferbrei",
                "Krémová ovesná kaše s vejcem, medem a tvarohem.",
                5, 640, 31, 59, 28, 7,
                [
                    ("Ovesné vločky", 50),
                    ("Chia semínka", 10),
                    ("Vejce", 60),
                    ("Hořká čokoláda", 10),
                    ("Ořechy", 15),
                    ("Mléko", 100),
                    ("Med", 21),
                    ("Ovoce", 80),
                    ("Tvaroh (nízkotučný)", 70),
                ]),

            new("Zapečené tousty na sladko", "Sweet Baked Toasts", "Süße gebackene Toasts",
                "Toustový chléb zapečený s řeckým jogurtem, ovocem a pudinkovou směsí.",
                15, 380, 20, 50, 10, 2,
                [
                    ("Toustový chléb", 50),
                    ("Řecký jogurt", 200),
                    ("Ovoce", 80),
                    ("Vejce", 60),
                    ("Tvaroh (nízkotučný)", 60),
                    ("Pudinkový prášek", 20),
                    ("Sladidlo", 4),
                ]),

            new("Domácí chia marmeláda", "Homemade Chia Jam", "Hausgemachte Chia-Marmelade",
                "Jednoduchá marmeláda z ovoce a chia semínek bez přidaného cukru.",
                5, 130, 1.5m, 28, 1.5m, 6,
                [
                    ("Mražené ovoce", 250),
                    ("Chia semínka", 30),
                ]),
        ];
    }

    /// <summary>
    /// Builds Recipe documents from seed entries, resolving food references from the database.
    /// </summary>
    /// <param name="entries">The seed recipe definitions.</param>
    /// <param name="foodLookup">Map of Czech food name → Food document.</param>
    /// <param name="systemUserId">The system/admin user ID to assign as recipe owner.</param>
    public static List<Recipe> BuildRecipes(
        List<RecipeSeedEntry> entries,
        Dictionary<string, Food> foodLookup,
        Guid systemUserId)
    {
        var now = DateTime.UtcNow;
        var recipes = new List<Recipe>();

        foreach (var entry in entries)
        {
            var mealFoods = new List<MealFood>();

            foreach (var (foodNameCs, amountGrams) in entry.Ingredients)
            {
                if (!foodLookup.TryGetValue(foodNameCs, out var food))
                    continue; // Skip unresolved foods

                mealFoods.Add(new MealFood
                {
                    FoodExternalId = food.ExternalId,
                    FoodName = food.Name,
                    FoodNameCs = food.LocalizedNames?.Cs,
                    FoodNameEn = food.LocalizedNames?.En,
                    FoodNameDe = food.LocalizedNames?.De,
                    FoodCategory = food.Category.ToString(),
                    NutrientValuePer100Grams = food.NutrientValue,
                    AmountGrams = amountGrams,
                });
            }

            // Calculate totals from actual food data
            var totals = new NutrientTotals();
            foreach (var mf in mealFoods)
            {
                var ratio = mf.AmountGrams / 100m;
                totals.Kcal += mf.NutrientValuePer100Grams.Kcal * ratio;
                totals.Protein += mf.NutrientValuePer100Grams.Protein * ratio;
                totals.Carbs += mf.NutrientValuePer100Grams.Carbs * ratio;
                totals.Fat += mf.NutrientValuePer100Grams.Fat * ratio;
                totals.Fiber += (mf.NutrientValuePer100Grams.Fiber ?? 0) * ratio;
            }

            totals.Kcal = Math.Round(totals.Kcal, 1);
            totals.Protein = Math.Round(totals.Protein, 1);
            totals.Carbs = Math.Round(totals.Carbs, 1);
            totals.Fat = Math.Round(totals.Fat, 1);
            totals.Fiber = Math.Round(totals.Fiber, 1);

            recipes.Add(new Recipe
            {
                ExternalId = Guid.NewGuid(),
                NutritionistId = systemUserId,
                Name = entry.NameCs,
                Description = entry.Description,
                PrepTimeMinutes = entry.PrepTimeMinutes,
                Foods = mealFoods,
                TotalNutrients = totals,
                Visibility = RecipeVisibility.Private,
                DateCreated = now,
            });
        }

        return recipes;
    }
}

/// <summary>
/// A seed recipe definition with ingredient references by Czech food name.
/// </summary>
public record RecipeSeedEntry(
    string NameCs,
    string NameEn,
    string NameDe,
    string Description,
    int PrepTimeMinutes,
    decimal ExpectedKcal,
    decimal ExpectedProtein,
    decimal ExpectedCarbs,
    decimal ExpectedFat,
    decimal ExpectedFiber,
    List<(string FoodNameCs, decimal AmountGrams)> Ingredients);
