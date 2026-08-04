using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Represents a single week submitted when creating or full-state updating a nutrition plan
/// template.
/// </summary>
public class TemplateWeekRequest
{
    /// <summary>
    /// Week number within the template (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week.
    /// </summary>
    public List<TemplateDayRequest> Days { get; set; } = [];
}

/// <summary>
/// Represents a single day submitted when creating or full-state updating a nutrition plan
/// template.
/// </summary>
public class TemplateDayRequest
{
    /// <summary>
    /// Day of week (1 = Monday … 7 = Sunday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Optional note for this day.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Meals planned for this day.
    /// </summary>
    public List<TemplateMealRequest> Meals { get; set; } = [];
}

/// <summary>
/// Represents a single meal submitted when creating or full-state updating a nutrition plan
/// template.
/// </summary>
public class TemplateMealRequest
{
    /// <summary>
    /// Optional existing meal identifier. When provided the meal retains its identity;
    /// when <see langword="null"/> a new <see cref="Guid"/> is generated.
    /// </summary>
    public Guid? MealId { get; set; }

    /// <summary>
    /// Kind of meal (Breakfast, Lunch, Dinner, etc.).
    /// </summary>
    public MealKind Kind { get; set; }

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Suggested time for the meal (e.g. "08:00").
    /// </summary>
    public string? Time { get; set; }

    /// <summary>
    /// Optional note for this meal.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Foods included in this meal.
    /// </summary>
    public List<TemplateMealFoodRequest> Foods { get; set; } = [];

    /// <summary>
    /// Recipes included in this meal.
    /// </summary>
    public List<TemplateMealRecipeRequest> Recipes { get; set; } = [];
}

/// <summary>
/// Represents a single food entry submitted when creating or full-state updating a nutrition
/// plan template.
/// </summary>
public class TemplateMealFoodRequest
{
    /// <summary>
    /// External (public) identifier of the food item.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Display name of the food (snapshot at time of planning).
    /// </summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>Czech name.</summary>
    public string? FoodNameCs { get; set; }

    /// <summary>English name.</summary>
    public string? FoodNameEn { get; set; }

    /// <summary>German name.</summary>
    public string? FoodNameDe { get; set; }

    /// <summary>Food category snapshot.</summary>
    public string? FoodCategory { get; set; }

    /// <summary>
    /// Nutrient values per 100 grams for this food.
    /// </summary>
    public NutrientValue NutrientValuePer100Grams { get; set; } = new();

    /// <summary>
    /// Amount in grams to include in this meal.
    /// </summary>
    public decimal AmountGrams { get; set; }

    /// <summary>
    /// Optional note for this food in the template.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// Represents a single recipe entry submitted when creating or full-state updating a nutrition
/// plan template.
/// </summary>
public class TemplateMealRecipeRequest
{
    /// <summary>
    /// Recipe identifier.
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Display name of the recipe.
    /// </summary>
    public string RecipeName { get; set; } = string.Empty;

    /// <summary>
    /// Nutrient values per one serving.
    /// </summary>
    public NutrientValue NutrientValuePerServing { get; set; } = new();

    /// <summary>
    /// Number of servings.
    /// </summary>
    public decimal Servings { get; set; } = 1;

    /// <summary>
    /// Optional note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Distinct food categories from the recipe's ingredients (snapshot).
    /// </summary>
    public List<string>? FoodCategories { get; set; }
}
