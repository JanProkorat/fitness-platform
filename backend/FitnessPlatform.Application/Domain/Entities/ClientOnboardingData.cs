using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Stores all client onboarding questionnaire answers (one-to-one with ClientProfile).
/// </summary>
public class ClientOnboardingData : TimestampableEntity
{
    /// <summary>Foreign key to the associated <see cref="ClientProfile"/>.</summary>
    public long ClientProfileId { get; set; }

    // --- Step 1: Basics ---
    /// <summary>Client's date of birth (derived from age input).</summary>
    public DateTime DateOfBirth { get; set; }
    /// <summary>Biological sex for BMR calculation.</summary>
    public BiologicalSex Sex { get; set; }
    /// <summary>Height in centimeters.</summary>
    public decimal HeightCm { get; set; }
    /// <summary>Current weight in kilograms.</summary>
    public decimal WeightKg { get; set; }
    /// <summary>Target weight in kilograms (optional).</summary>
    public decimal? TargetWeightKg { get; set; }
    /// <summary>Somatotype / body constitution.</summary>
    public BodyType BodyType { get; set; }

    // --- Step 2: Goal ---
    /// <summary>Primary fitness/health goal.</summary>
    public PrimaryGoal PrimaryGoal { get; set; }
    /// <summary>Desired time horizon for achieving the goal.</summary>
    public TimeHorizon TimeHorizon { get; set; }

    // --- Step 3: Lifestyle ---
    /// <summary>Type of daily job activity.</summary>
    public JobType JobType { get; set; }
    /// <summary>Average hours of sleep per night (4–10).</summary>
    public int SleepHours { get; set; }
    /// <summary>Self-reported stress level (1–5).</summary>
    public int StressLevel { get; set; }

    // --- Step 4: Activity ---
    /// <summary>Current training frequency over last 4 weeks.</summary>
    public CurrentTrainingFrequency CurrentTrainingFrequency { get; set; }
    /// <summary>Desired realistic training frequency.</summary>
    public DesiredTrainingFrequency DesiredTrainingFrequency { get; set; }
    /// <summary>Self-rated fitness level (1–10).</summary>
    public int FitnessRating { get; set; }

    // --- Step 5: Equipment & Preferences ---
    /// <summary>Gym membership / access level.</summary>
    public GymAccess GymAccess { get; set; }
    /// <summary>Preferred activity types (comma-separated: strength,cardio,hiit,yoga,cycling,martial_arts).</summary>
    [MaxLength(200)]
    public string PreferredActivities { get; set; } = string.Empty;
    /// <summary>Physical injuries or limitations (comma-separated: none,back,knees,shoulders).</summary>
    [MaxLength(200)]
    public string Injuries { get; set; } = string.Empty;

    // --- Step 6: Nutrition ---
    /// <summary>Number of meals per day.</summary>
    public MealsPerDay MealsPerDay { get; set; }
    /// <summary>Dietary style preference.</summary>
    public DietaryStyle DietaryStyle { get; set; }
    /// <summary>Food allergies/intolerances (comma-separated: none,lactose,gluten,nuts).</summary>
    [MaxLength(200)]
    public string Allergies { get; set; } = string.Empty;
    /// <summary>Self-rated diet quality (1–5).</summary>
    public int DietRating { get; set; }

    // --- Step 7: Motivation ---
    /// <summary>Prior experience with structured fitness/nutrition plans.</summary>
    public PlanExperience PlanExperience { get; set; }
    /// <summary>Past blockers to fitness progress (comma-separated: time,motivation,knowledge,slow_results,none).</summary>
    [MaxLength(200)]
    public string PastBlockers { get; set; } = string.Empty;
    /// <summary>Primary source of motivation.</summary>
    public PrimaryMotivation PrimaryMotivation { get; set; }

    // --- Computed Nutrition Targets (auto-calculated on submit) ---

    /// <summary>Derived activity level used for TDEE calculation.</summary>
    public ActivityLevel DerivedActivityLevel { get; set; }

    /// <summary>Derived nutrition goal used for caloric adjustment.</summary>
    public NutritionGoal DerivedNutritionGoal { get; set; }

    /// <summary>Basal Metabolic Rate (Mifflin-St Jeor), kcal/day.</summary>
    public decimal Bmr { get; set; }

    /// <summary>Total Daily Energy Expenditure, kcal/day.</summary>
    public decimal Tdee { get; set; }

    /// <summary>Goal-adjusted daily calories.</summary>
    public decimal AdjustedKcal { get; set; }

    /// <summary>Daily protein target in grams.</summary>
    public decimal ProteinGrams { get; set; }

    /// <summary>Daily carbohydrate target in grams.</summary>
    public decimal CarbsGrams { get; set; }

    /// <summary>Daily fat target in grams.</summary>
    public decimal FatGrams { get; set; }

    /// <summary>Daily dietary fiber target in grams.</summary>
    public decimal FiberGrams { get; set; }

    /// <summary>Meal distribution percentages as JSON (e.g. {"breakfast":25,"snack1":10,"lunch":30,"snack2":10,"dinner":25}).</summary>
    [MaxLength(500)]
    public string? MealDistribution { get; set; }

    // --- Navigation ---
    /// <summary>Navigation property to the associated client profile.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
