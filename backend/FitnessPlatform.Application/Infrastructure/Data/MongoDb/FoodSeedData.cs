using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

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
            // ── Meat ────────────────────────────────────────────────────
            Create("Chicken Breast (raw)", ("Chicken Breast (raw)", "Kuřecí prsa (syrová)", "Hähnchenbrust (roh)"),
                120, 22.5m, 0, 2.6m, category: FoodCategory.Meat, servings: [("1 breast (~175g)", 175)], now: now),
            Create("Chicken Thigh (raw)", ("Chicken Thigh (raw)", "Kuřecí stehno (syrové)", "Hähnchenschenkel (roh)"),
                177, 17.3m, 0, 11.5m, category: FoodCategory.Meat, servings: [("1 thigh (~115g)", 115)], now: now),
            Create("Turkey Breast (raw)", ("Turkey Breast (raw)", "Krůtí prsa (syrová)", "Putenbrust (roh)"),
                104, 23.7m, 0, 0.7m, category: FoodCategory.Meat, servings: [("1 portion (150g)", 150)], now: now),
            Create("Beef Sirloin (raw)", ("Beef Sirloin (raw)", "Hovězí svíčková (syrová)", "Rinderfilet (roh)"),
                143, 21.3m, 0, 6.3m, category: FoodCategory.Meat, servings: [("1 steak (~200g)", 200)], now: now),
            Create("Pork Loin (raw)", ("Pork Loin (raw)", "Vepřová panenka (syrová)", "Schweinelende (roh)"),
                143, 21.1m, 0, 6.1m, category: FoodCategory.Meat, servings: [("1 chop (~150g)", 150)], now: now),

            // ── Fish & Seafood ──────────────────────────────────────────
            Create("Salmon Fillet (raw)", ("Salmon Fillet (raw)", "Losos filet (syrový)", "Lachsfilet (roh)"),
                208, 20.4m, 0, 13.4m, category: FoodCategory.FishAndSeafood, fiber: 0, saturatedFat: 3.0m, servings: [("1 fillet (~125g)", 125)], now: now),
            Create("Tuna (canned, drained)", ("Tuna (canned, drained)", "Tuňák (konzervovaný, sceděný)", "Thunfisch (Dose, abgetropft)"),
                116, 25.5m, 0, 0.8m, category: FoodCategory.FishAndSeafood, servings: [("1 can (~150g)", 150)], now: now),
            Create("Cod Fillet (raw)", ("Cod Fillet (raw)", "Treska filet (syrová)", "Kabeljaufilet (roh)"),
                82, 17.8m, 0, 0.7m, category: FoodCategory.FishAndSeafood, servings: [("1 fillet (~150g)", 150)], now: now),
            Create("Shrimp (raw)", ("Shrimp (raw)", "Krevety (syrové)", "Garnelen (roh)"),
                85, 20.1m, 0.2m, 0.5m, category: FoodCategory.FishAndSeafood, servings: [("10 medium (~60g)", 60)], now: now),

            // ── Dairy & Eggs ────────────────────────────────────────────
            Create("Whole Egg", ("Whole Egg", "Celé vejce", "Ganzes Ei"),
                143, 12.6m, 0.7m, 9.9m, category: FoodCategory.Dairy, servings: [("1 large (~60g)", 60)], allergens: ["eggs"], now: now),
            Create("Egg White", ("Egg White", "Vaječný bílek", "Eiweiß"),
                52, 10.9m, 0.7m, 0.2m, category: FoodCategory.Dairy, servings: [("1 white (~33g)", 33)], allergens: ["eggs"], now: now),
            Create("Greek Yogurt (0% fat)", ("Greek Yogurt (0% fat)", "Řecký jogurt (0% tuku)", "Griechischer Joghurt (0% Fett)"),
                59, 10.2m, 3.6m, 0.4m, category: FoodCategory.Dairy, sugar: 3.2m, servings: [("1 cup (~170g)", 170)], allergens: ["milk"], now: now),
            Create("Greek Yogurt (full fat)", ("Greek Yogurt (full fat)", "Řecký jogurt (plnotučný)", "Griechischer Joghurt (vollfett)"),
                97, 9.0m, 3.6m, 5.0m, category: FoodCategory.Dairy, sugar: 3.2m, servings: [("1 cup (~170g)", 170)], allergens: ["milk"], now: now),
            Create("Cottage Cheese (low fat)", ("Cottage Cheese (low fat)", "Cottage sýr (nízkotučný)", "Hüttenkäse (fettarm)"),
                72, 12.4m, 2.7m, 1.0m, category: FoodCategory.Dairy, servings: [("1 cup (~226g)", 226)], allergens: ["milk"], now: now),
            Create("Mozzarella", ("Mozzarella", "Mozzarella", "Mozzarella"),
                280, 27.5m, 3.1m, 17.1m, category: FoodCategory.Dairy, servings: [("1 ball (~125g)", 125)], allergens: ["milk"], now: now),
            Create("Cheddar Cheese", ("Cheddar Cheese", "Čedar", "Cheddar-Käse"),
                403, 24.9m, 1.3m, 33.1m, category: FoodCategory.Dairy, servings: [("1 slice (~28g)", 28)], allergens: ["milk"], now: now),
            Create("Whole Milk (3.5%)", ("Whole Milk (3.5%)", "Plnotučné mléko (3,5%)", "Vollmilch (3,5%)"),
                64, 3.3m, 4.8m, 3.5m, category: FoodCategory.Dairy, sugar: 4.8m, servings: [("1 glass (~250ml)", 250)], allergens: ["milk"], now: now),

            // ── Supplements ─────────────────────────────────────────────
            Create("Whey Protein Powder", ("Whey Protein Powder", "Syrovátkový protein", "Whey-Proteinpulver"),
                380, 80.0m, 6.0m, 4.0m, category: FoodCategory.Supplements, servings: [("1 scoop (~30g)", 30)], allergens: ["milk"], now: now),

            // ── Grains & Cereals ────────────────────────────────────────
            Create("White Rice (dry)", ("White Rice (dry)", "Bílá rýže (suchá)", "Weißer Reis (trocken)"),
                360, 6.6m, 79.3m, 0.6m, category: FoodCategory.GrainsAndCereals, fiber: 1.3m, servings: [("1 cup dry (~185g)", 185)], now: now),
            Create("Brown Rice (dry)", ("Brown Rice (dry)", "Hnědá rýže (suchá)", "Brauner Reis (trocken)"),
                362, 7.5m, 76.2m, 2.7m, category: FoodCategory.GrainsAndCereals, fiber: 3.4m, servings: [("1 cup dry (~185g)", 185)], now: now),
            Create("Oats (rolled, dry)", ("Oats (rolled, dry)", "Ovesné vločky (suché)", "Haferflocken (trocken)"),
                379, 13.2m, 67.7m, 6.5m, category: FoodCategory.GrainsAndCereals, fiber: 10.1m, servings: [("1 cup (~80g)", 80)], allergens: ["gluten"], now: now),
            Create("Whole Wheat Bread", ("Whole Wheat Bread", "Celozrnný chléb", "Vollkornbrot"),
                252, 12.4m, 43.1m, 3.5m, category: FoodCategory.GrainsAndCereals, fiber: 6.0m, servings: [("1 slice (~30g)", 30)], allergens: ["gluten"], now: now),
            Create("White Pasta (dry)", ("White Pasta (dry)", "Bílé těstoviny (suché)", "Weiße Nudeln (trocken)"),
                357, 12.5m, 72.2m, 1.5m, category: FoodCategory.GrainsAndCereals, fiber: 2.5m, servings: [("1 portion (~80g)", 80)], allergens: ["gluten"], now: now),
            Create("Potato", ("Potato", "Brambora", "Kartoffel"),
                77, 2.0m, 17.5m, 0.1m, category: FoodCategory.Vegetables, fiber: 2.2m, servings: [("1 medium (~150g)", 150)], now: now),
            Create("Sweet Potato", ("Sweet Potato", "Batát", "Süßkartoffel"),
                86, 1.6m, 20.1m, 0.1m, category: FoodCategory.Vegetables, fiber: 3.0m, sugar: 4.2m, servings: [("1 medium (~130g)", 130)], now: now),
            Create("Quinoa (dry)", ("Quinoa (dry)", "Quinoa (suchá)", "Quinoa (trocken)"),
                368, 14.1m, 64.2m, 6.1m, category: FoodCategory.GrainsAndCereals, fiber: 7.0m, servings: [("1 cup dry (~170g)", 170)], now: now),
            Create("Couscous (dry)", ("Couscous (dry)", "Kuskus (suchý)", "Couscous (trocken)"),
                376, 12.8m, 77.4m, 0.6m, category: FoodCategory.GrainsAndCereals, fiber: 5.0m, servings: [("1 cup dry (~175g)", 175)], allergens: ["gluten"], now: now),

            // ── Fruits ──────────────────────────────────────────────────
            Create("Banana", ("Banana", "Banán", "Banane"),
                89, 1.1m, 22.8m, 0.3m, category: FoodCategory.Fruit, fiber: 2.6m, sugar: 12.2m, servings: [("1 medium (~120g)", 120)], now: now),
            Create("Apple", ("Apple", "Jablko", "Apfel"),
                52, 0.3m, 13.8m, 0.2m, category: FoodCategory.Fruit, fiber: 2.4m, sugar: 10.4m, servings: [("1 medium (~180g)", 180)], now: now),
            Create("Blueberries", ("Blueberries", "Borůvky", "Heidelbeeren"),
                57, 0.7m, 14.5m, 0.3m, category: FoodCategory.Fruit, fiber: 2.4m, sugar: 10.0m, servings: [("1 cup (~150g)", 150)], now: now),
            Create("Strawberries", ("Strawberries", "Jahody", "Erdbeeren"),
                32, 0.7m, 7.7m, 0.3m, category: FoodCategory.Fruit, fiber: 2.0m, sugar: 4.9m, servings: [("1 cup (~152g)", 152)], now: now),
            Create("Orange", ("Orange", "Pomeranč", "Orange"),
                47, 0.9m, 11.8m, 0.1m, category: FoodCategory.Fruit, fiber: 2.4m, sugar: 9.4m, servings: [("1 medium (~130g)", 130)], now: now),
            Create("Avocado", ("Avocado", "Avokádo", "Avocado"),
                160, 2.0m, 8.5m, 14.7m, category: FoodCategory.Fruit, fiber: 6.7m, saturatedFat: 2.1m, servings: [("1 half (~68g)", 68)], now: now),

            // ── Vegetables ──────────────────────────────────────────────
            Create("Broccoli", ("Broccoli", "Brokolice", "Brokkoli"),
                34, 2.8m, 6.6m, 0.4m, category: FoodCategory.Vegetables, fiber: 2.6m, servings: [("1 cup chopped (~91g)", 91)], now: now),
            Create("Spinach (raw)", ("Spinach (raw)", "Špenát (syrový)", "Spinat (roh)"),
                23, 2.9m, 3.6m, 0.4m, category: FoodCategory.Vegetables, fiber: 2.2m, servings: [("1 cup (~30g)", 30)], now: now),
            Create("Tomato", ("Tomato", "Rajče", "Tomate"),
                18, 0.9m, 3.9m, 0.2m, category: FoodCategory.Vegetables, fiber: 1.2m, sugar: 2.6m, servings: [("1 medium (~123g)", 123)], now: now),
            Create("Cucumber", ("Cucumber", "Okurka", "Gurke"),
                15, 0.7m, 3.6m, 0.1m, category: FoodCategory.Vegetables, fiber: 0.5m, servings: [("1 medium (~300g)", 300)], now: now),
            Create("Carrot", ("Carrot", "Mrkev", "Karotte"),
                41, 0.9m, 9.6m, 0.2m, category: FoodCategory.Vegetables, fiber: 2.8m, sugar: 4.7m, servings: [("1 medium (~61g)", 61)], now: now),
            Create("Bell Pepper (red)", ("Bell Pepper (red)", "Paprika (červená)", "Paprika (rot)"),
                31, 1.0m, 6.0m, 0.3m, category: FoodCategory.Vegetables, fiber: 2.1m, sugar: 4.2m, servings: [("1 medium (~120g)", 120)], now: now),

            // ── Legumes ─────────────────────────────────────────────────
            Create("Chickpeas (cooked)", ("Chickpeas (cooked)", "Cizrna (vařená)", "Kichererbsen (gekocht)"),
                164, 8.9m, 27.4m, 2.6m, category: FoodCategory.Legumes, fiber: 7.6m, servings: [("1 cup (~164g)", 164)], now: now),
            Create("Lentils (cooked)", ("Lentils (cooked)", "Čočka (vařená)", "Linsen (gekocht)"),
                116, 9.0m, 20.1m, 0.4m, category: FoodCategory.Legumes, fiber: 7.9m, servings: [("1 cup (~198g)", 198)], now: now),

            // ── Nuts & Seeds ────────────────────────────────────────────
            Create("Almonds", ("Almonds", "Mandle", "Mandeln"),
                579, 21.2m, 21.7m, 49.9m, category: FoodCategory.NutsAndSeeds, fiber: 12.2m, saturatedFat: 3.7m, servings: [("1 handful (~28g)", 28)], allergens: ["tree nuts"], now: now),
            Create("Peanut Butter", ("Peanut Butter", "Arašídové máslo", "Erdnussbutter"),
                588, 25.1m, 20.0m, 50.4m, category: FoodCategory.NutsAndSeeds, fiber: 6.0m, saturatedFat: 10.3m, servings: [("1 tbsp (~16g)", 16)], allergens: ["peanuts"], now: now),
            Create("Walnuts", ("Walnuts", "Vlašské ořechy", "Walnüsse"),
                654, 15.2m, 13.7m, 65.2m, category: FoodCategory.NutsAndSeeds, fiber: 6.7m, saturatedFat: 6.1m, servings: [("1 handful (~28g)", 28)], allergens: ["tree nuts"], now: now),

            // ── Oils & Fats ─────────────────────────────────────────────
            Create("Olive Oil", ("Olive Oil", "Olivový olej", "Olivenöl"),
                884, 0, 0, 100.0m, category: FoodCategory.OilsAndFats, saturatedFat: 13.8m, servings: [("1 tbsp (~14g)", 14)], now: now),
            Create("Butter", ("Butter", "Máslo", "Butter"),
                717, 0.9m, 0.1m, 81.1m, category: FoodCategory.OilsAndFats, saturatedFat: 51.4m, servings: [("1 tbsp (~14g)", 14)], allergens: ["milk"], now: now),
            Create("Coconut Oil", ("Coconut Oil", "Kokosový olej", "Kokosöl"),
                862, 0, 0, 100.0m, category: FoodCategory.OilsAndFats, saturatedFat: 82.5m, servings: [("1 tbsp (~14g)", 14)], now: now),

            // ── Sweets & Snacks ─────────────────────────────────────────
            Create("Honey", ("Honey", "Med", "Honig"),
                304, 0.3m, 82.4m, 0, category: FoodCategory.SweetsAndSnacks, sugar: 82.1m, servings: [("1 tbsp (~21g)", 21)], now: now),
            Create("Dark Chocolate (70%)", ("Dark Chocolate (70%)", "Hořká čokoláda (70%)", "Zartbitterschokolade (70%)"),
                598, 7.8m, 45.9m, 42.6m, category: FoodCategory.SweetsAndSnacks, fiber: 10.9m, sugar: 24.0m, saturatedFat: 24.5m, servings: [("1 square (~10g)", 10)], allergens: ["milk", "soy"], now: now),

            // ── Grains (cooked) ─────────────────────────────────────────
            Create("White Rice (cooked)", ("White Rice (cooked)", "Bílá rýže (vařená)", "Weißer Reis (gekocht)"),
                130, 2.7m, 28.2m, 0.3m, category: FoodCategory.GrainsAndCereals, fiber: 0.4m, servings: [("1 cup (~158g)", 158)], now: now),

            // ── Czech Recipe Ingredients ────────────────────────────────
            Create("Plain Yogurt", ("Plain Yogurt", "Bílý jogurt", "Naturjoghurt"),
                61, 3.5m, 4.7m, 3.3m, category: FoodCategory.Dairy, servings: [("1 cup (~150g)", 150)], allergens: ["milk"], now: now),
            Create("Cottage Cheese", ("Cottage Cheese", "Cottage", "Hüttenkäse"),
                98, 11.1m, 3.4m, 4.3m, category: FoodCategory.Dairy, servings: [("1 tub (~150g)", 150)], allergens: ["milk"], now: now),
            Create("Croissant", ("Croissant", "Croissant", "Croissant"),
                406, 8.2m, 45.8m, 21.0m, category: FoodCategory.GrainsAndCereals, fiber: 1.8m, servings: [("1 piece (~60g)", 60)], allergens: ["gluten", "milk"], now: now),
            Create("Edam Cheese (30%)", ("Edam Cheese (30%)", "Eidam 30%", "Edamer (30%)"),
                340, 26.0m, 0.5m, 26.0m, category: FoodCategory.Dairy, servings: [("1 slice (~30g)", 30)], allergens: ["milk"], now: now),
            Create("Espresso", ("Espresso", "Espresso", "Espresso"),
                2, 0.1m, 0, 0, category: FoodCategory.Other, servings: [("1 shot (~30ml)", 30)], now: now),
            Create("Granola", ("Granola", "Granola", "Granola"),
                471, 10.0m, 64.0m, 20.0m, category: FoodCategory.GrainsAndCereals, fiber: 4.5m, servings: [("1/2 cup (~40g)", 40)], allergens: ["gluten"], now: now),
            Create("Chia Jam", ("Chia Jam", "Chia marmeláda", "Chia-Marmelade"),
                130, 1.5m, 28.0m, 1.5m, category: FoodCategory.SweetsAndSnacks, fiber: 3.5m, servings: [("1 tbsp (~15g)", 15)], now: now),
            Create("Chia Seeds", ("Chia Seeds", "Chia semínka", "Chia-Samen"),
                486, 16.5m, 42.1m, 30.7m, category: FoodCategory.NutsAndSeeds, fiber: 34.4m, servings: [("1 tbsp (~10g)", 10)], now: now),
            Create("Cocoa Powder", ("Cocoa Powder", "Kakao", "Kakaopulver"),
                228, 19.6m, 57.9m, 13.7m, category: FoodCategory.Other, fiber: 33.2m, servings: [("1 tbsp (~5g)", 5)], now: now),
            Create("Kefir", ("Kefir", "Kefír", "Kefir"),
                63, 3.4m, 4.5m, 3.5m, category: FoodCategory.Dairy, servings: [("1 cup (~250ml)", 250)], allergens: ["milk"], now: now),
            Create("Kefir Milk", ("Kefir Milk", "Kefírové mléko", "Kefirmilch"),
                52, 3.0m, 4.2m, 1.8m, category: FoodCategory.Dairy, servings: [("1 cup (~250ml)", 250)], allergens: ["milk"], now: now),
            Create("Baking Powder", ("Baking Powder", "Kypřící prášek", "Backpulver"),
                53, 0, 27.7m, 0, category: FoodCategory.Other, servings: [("1 tsp (~5g)", 5)], now: now),
            Create("Lučina Cream Cheese", ("Lučina Cream Cheese", "Lučina", "Lučina Frischkäse"),
                175, 7.0m, 3.5m, 15.0m, category: FoodCategory.Dairy, servings: [("1 tbsp (~20g)", 20)], allergens: ["milk"], now: now),
            Create("Whole Milk", ("Whole Milk", "Mléko", "Vollmilch"),
                61, 3.2m, 4.7m, 3.3m, category: FoodCategory.Dairy, servings: [("1 glass (~250ml)", 250)], allergens: ["milk"], now: now),
            Create("Frozen Berries", ("Frozen Berries", "Mražené ovoce", "Tiefkühl-Obst"),
                50, 0.7m, 12.0m, 0.2m, category: FoodCategory.Fruit, fiber: 2.0m, servings: [("1 cup (~150g)", 150)], now: now),
            Create("Mixed Nuts", ("Mixed Nuts", "Ořechy", "Nussmischung"),
                654, 15.2m, 14.0m, 65.2m, category: FoodCategory.NutsAndSeeds, fiber: 6.7m, servings: [("1 handful (~28g)", 28)], allergens: ["tree nuts"], now: now),
            Create("Fresh Fruit", ("Fresh Fruit", "Ovoce", "Frisches Obst"),
                57, 0.7m, 14.0m, 0.2m, category: FoodCategory.Fruit, fiber: 2.0m, servings: [("1 portion (~150g)", 150)], now: now),
            Create("Sponge Biscuits", ("Sponge Biscuits", "Piškoty", "Löffelbiskuits"),
                385, 7.0m, 77.0m, 5.0m, category: FoodCategory.SweetsAndSnacks, fiber: 1.0m, servings: [("5 pieces (~30g)", 30)], allergens: ["gluten", "eggs"], now: now),
            Create("Lamb's Lettuce", ("Lamb's Lettuce", "Polníčkový salát", "Feldsalat"),
                21, 2.0m, 3.6m, 0.4m, category: FoodCategory.Vegetables, fiber: 1.6m, servings: [("1 cup (~30g)", 30)], now: now),
            Create("Pudding Powder", ("Pudding Powder", "Pudinkový prášek", "Puddingpulver"),
                349, 0.4m, 87.5m, 0.2m, category: FoodCategory.Other, fiber: 0.3m, servings: [("1 packet (~40g)", 40)], now: now),
            Create("Rapeseed Oil", ("Rapeseed Oil", "Řepkový olej", "Rapsöl"),
                884, 0, 0, 100.0m, category: FoodCategory.OilsAndFats, servings: [("1 tbsp (~14g)", 14)], now: now),
            Create("Sesame Seeds", ("Sesame Seeds", "Sezamová semínka", "Sesamkörner"),
                573, 17.7m, 23.4m, 49.7m, category: FoodCategory.NutsAndSeeds, fiber: 11.8m, servings: [("1 tbsp (~9g)", 9)], now: now),
            Create("Cinnamon", ("Cinnamon", "Skořice", "Zimt"),
                247, 4.0m, 80.6m, 1.2m, category: FoodCategory.Other, fiber: 53.1m, servings: [("1 tsp (~3g)", 3)], now: now),
            Create("Sweetener", ("Sweetener", "Sladidlo", "Süßstoff"),
                20, 0, 5.0m, 0, category: FoodCategory.SweetsAndSnacks, servings: [("1 tsp (~4g)", 4)], now: now),
            Create("Desiccated Coconut", ("Desiccated Coconut", "Strouhaný kokos", "Kokosraspeln"),
                660, 6.9m, 24.1m, 64.5m, category: FoodCategory.NutsAndSeeds, fiber: 16.3m, servings: [("1 tbsp (~10g)", 10)], now: now),
            Create("Dried Fruit", ("Dried Fruit", "Sušené ovoce", "Trockenobst"),
                282, 2.7m, 74.6m, 0.4m, category: FoodCategory.Fruit, fiber: 3.7m, servings: [("1 handful (~30g)", 30)], now: now),
            Create("Spelt Flour", ("Spelt Flour", "Špaldová mouka", "Dinkelmehl"),
                338, 14.6m, 70.2m, 2.4m, category: FoodCategory.GrainsAndCereals, fiber: 7.8m, servings: [("1 cup (~120g)", 120)], allergens: ["gluten"], now: now),
            Create("Ham", ("Ham", "Šunka", "Schinken"),
                145, 20.9m, 1.5m, 6.5m, category: FoodCategory.Meat, servings: [("2 slices (~40g)", 40)], now: now),
            Create("Toast Bread", ("Toast Bread", "Toustový chléb", "Toastbrot"),
                265, 9.0m, 49.0m, 3.3m, category: FoodCategory.GrainsAndCereals, fiber: 2.4m, servings: [("1 slice (~25g)", 25)], allergens: ["gluten"], now: now),
            Create("Quark (low fat)", ("Quark (low fat)", "Tvaroh (nízkotučný)", "Quark (mager)"),
                105, 12.4m, 3.6m, 5.0m, category: FoodCategory.Dairy, servings: [("1 tub (~250g)", 250)], allergens: ["milk"], now: now),
            Create("Mixed Vegetables", ("Mixed Vegetables", "Zelenina", "Gemüse"),
                35, 2.5m, 7.0m, 0.3m, category: FoodCategory.Vegetables, fiber: 2.8m, servings: [("1 cup (~150g)", 150)], now: now),
            Create("Rye Sourdough Bread", ("Rye Sourdough Bread", "Žitné kváskové pečivo", "Roggen-Sauerteigbrot"),
                210, 7.0m, 42.0m, 1.5m, category: FoodCategory.GrainsAndCereals, fiber: 5.8m, servings: [("1 slice (~50g)", 50)], allergens: ["gluten"], now: now),
            Create("Rye Bread", ("Rye Bread", "Žitný chléb", "Roggenbrot"),
                259, 8.5m, 48.3m, 3.3m, category: FoodCategory.GrainsAndCereals, fiber: 5.1m, servings: [("1 slice (~40g)", 40)], allergens: ["gluten"], now: now),
            Create("Water", ("Water", "Voda", "Wasser"),
                0, 0, 0, 0, category: FoodCategory.Other, servings: [("1 glass (~250ml)", 250)], now: now),
        ];
    }

    private static Food Create(
        string name,
        (string en, string cs, string de) localizedNames,
        decimal kcal, decimal protein, decimal carbs, decimal fat,
        FoodCategory category = FoodCategory.Other,
        decimal? fiber = null, decimal? sugar = null, decimal? saturatedFat = null, decimal? salt = null,
        List<(string label, decimal weightGrams)>? servings = null,
        List<string>? allergens = null,
        DateTime now = default)
    {
        return new Food
        {
            ExternalId = Guid.NewGuid(),
            Name = name,
            LocalizedNames = new LocalizedNames
            {
                En = localizedNames.en,
                Cs = localizedNames.cs,
                De = localizedNames.de,
            },
            Category = category,
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
