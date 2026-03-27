using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Represents a single week submitted in a full-state plan update.
/// </summary>
public class UpdateWeekRequest
{
    /// <summary>
    /// Week number within the plan (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week.
    /// </summary>
    public List<UpdateDayRequest> Days { get; set; } = [];
}

/// <summary>
/// Represents a single day submitted in a full-state plan update.
/// </summary>
public class UpdateDayRequest
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
    public List<UpdateMealRequest> Meals { get; set; } = [];
}

/// <summary>
/// Represents a single meal submitted in a full-state plan update.
/// </summary>
public class UpdateMealRequest
{
    /// <summary>
    /// Optional existing meal identifier. When provided the meal retains its identity;
    /// when <see langword="null"/> a new <see cref="Guid"/> is generated.
    /// </summary>
    public Guid? MealId { get; set; }

    /// <summary>
    /// Display name of the meal (e.g. "Breakfast").
    /// </summary>
    public string Name { get; set; } = string.Empty;

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
    public List<UpdateMealFoodRequest> Foods { get; set; } = [];

    /// <summary>
    /// Recipes included in this meal.
    /// </summary>
    public List<UpdateMealRecipeRequest> Recipes { get; set; } = [];
}

/// <summary>
/// Represents a recipe entry submitted in a full-state plan update.
/// </summary>
public class UpdateMealRecipeRequest
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
}

/// <summary>
/// Represents a single food entry submitted in a full-state plan update.
/// </summary>
public class UpdateMealFoodRequest
{
    /// <summary>
    /// External (public) identifier of the food item.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Display name of the food (snapshot at time of planning).
    /// </summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>
    /// Nutrient values per 100 grams for this food.
    /// </summary>
    public NutrientValue NutrientValuePer100Grams { get; set; } = new();

    /// <summary>
    /// Amount in grams to include in this meal.
    /// </summary>
    public decimal AmountGrams { get; set; }

    /// <summary>
    /// Optional note for this food in the plan.
    /// </summary>
    public string? Note { get; set; }
}
