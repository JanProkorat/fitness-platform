using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Tests for <see cref="MacroCalculatorService"/>.
/// </summary>
public class MacroCalculatorServiceTests
{
    private readonly MacroCalculatorService _sut = new();

    // ── BMR ──────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateBmr_Male_ReturnsCorrectValue()
    {
        // 80 kg, 180 cm, 30 years, male
        // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        var bmr = _sut.CalculateBmr(80m, 180m, 30, BiologicalSex.Male);

        bmr.Should().Be(1780m);
    }

    [Fact]
    public void CalculateBmr_Female_ReturnsCorrectValue()
    {
        // 60 kg, 165 cm, 25 years, female
        // BMR = 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
        var bmr = _sut.CalculateBmr(60m, 165m, 25, BiologicalSex.Female);

        bmr.Should().Be(1345.25m);
    }

    [Fact]
    public void CalculateBmr_HeavyMale_ReturnsCorrectValue()
    {
        // 100 kg, 190 cm, 40 years, male
        // BMR = 10*100 + 6.25*190 - 5*40 + 5 = 1000 + 1187.5 - 200 + 5 = 1992.5
        var bmr = _sut.CalculateBmr(100m, 190m, 40, BiologicalSex.Male);

        bmr.Should().Be(1992.5m);
    }

    [Fact]
    public void CalculateBmr_LightFemale_ReturnsCorrectValue()
    {
        // 50 kg, 155 cm, 20 years, female
        // BMR = 10*50 + 6.25*155 - 5*20 - 161 = 500 + 968.75 - 100 - 161 = 1207.75
        var bmr = _sut.CalculateBmr(50m, 155m, 20, BiologicalSex.Female);

        bmr.Should().Be(1207.75m);
    }

    // ── TDEE ─────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(ActivityLevel.Sedentary, 2136)]
    [InlineData(ActivityLevel.LightlyActive, 2448)]
    [InlineData(ActivityLevel.ModeratelyActive, 2759)]
    [InlineData(ActivityLevel.VeryActive, 3070)]
    [InlineData(ActivityLevel.ExtremelyActive, 3382)]
    public void CalculateTdee_AllActivityLevels_ReturnsCorrectValue(ActivityLevel level, decimal expected)
    {
        // BMR = 1780 (from male test above)
        var tdee = _sut.CalculateTdee(1780m, level);

        tdee.Should().Be(expected);
    }

    // ── Goal Adjustment ──────────────────────────────────────────────────

    [Fact]
    public void ApplyGoalAdjustment_Cut_Applies20PercentDeficit()
    {
        var result = _sut.ApplyGoalAdjustment(2500m, NutritionGoal.Cut);

        result.Should().Be(2000m);
    }

    [Fact]
    public void ApplyGoalAdjustment_Maintain_NoChange()
    {
        var result = _sut.ApplyGoalAdjustment(2500m, NutritionGoal.Maintain);

        result.Should().Be(2500m);
    }

    [Fact]
    public void ApplyGoalAdjustment_Bulk_Applies10PercentSurplus()
    {
        var result = _sut.ApplyGoalAdjustment(2500m, NutritionGoal.Bulk);

        result.Should().Be(2750m);
    }

    // ── Macro Split ──────────────────────────────────────────────────────

    [Fact]
    public void CalculateMacroSplit_DefaultRatios_ReturnsCorrectGrams()
    {
        // 2000 kcal, 30/45/25 split
        // Protein: 2000 * 0.30 / 4 = 150g
        // Carbs:   2000 * 0.45 / 4 = 225g
        // Fat:     2000 * 0.25 / 9 ≈ 56g
        var settings = _sut.CalculateMacroSplit(2000m);

        settings.DailyKcal.Should().Be(2000m);
        settings.ProteinGrams.Should().Be(150m);
        settings.CarbsGrams.Should().Be(225m);
        settings.FatGrams.Should().Be(56m);
    }

    [Fact]
    public void CalculateMacroSplit_CustomRatios_ReturnsCorrectGrams()
    {
        // 2400 kcal, 35/40/25 split
        // Protein: 2400 * 0.35 / 4 = 210g
        // Carbs:   2400 * 0.40 / 4 = 240g
        // Fat:     2400 * 0.25 / 9 ≈ 67g
        var settings = _sut.CalculateMacroSplit(2400m, 35m, 40m);

        settings.DailyKcal.Should().Be(2400m);
        settings.ProteinGrams.Should().Be(210m);
        settings.CarbsGrams.Should().Be(240m);
        settings.FatGrams.Should().Be(67m);
    }

    // ── Atwater ──────────────────────────────────────────────────────────

    [Fact]
    public void CalculateAtwaterKcal_StandardValues_ReturnsCorrectResult()
    {
        // 30g protein * 4 + 50g carbs * 4 + 10g fat * 9 = 120 + 200 + 90 = 410
        var kcal = _sut.CalculateAtwaterKcal(30m, 50m, 10m);

        kcal.Should().Be(410m);
    }

    [Fact]
    public void CalculateAtwaterKcal_ZeroValues_ReturnsZero()
    {
        var kcal = _sut.CalculateAtwaterKcal(0m, 0m, 0m);

        kcal.Should().Be(0m);
    }

    // ── RecalculateTotals ────────────────────────────────────────────────

    [Fact]
    public void RecalculateTotals_SingleMeal_CalculatesCorrectly()
    {
        var plan = CreatePlanWithMeal(
            new MealFood
            {
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Chicken Breast",
                NutrientValuePer100Grams = new NutrientValue { Kcal = 165, Protein = 31, Carbs = 0, Fat = 3.6m },
                AmountGrams = 200
            });

        _sut.RecalculateTotals(plan);

        var meal = plan.Weeks[0].Days[0].Meals[0];
        meal.MealTotals.Should().NotBeNull();
        meal.MealTotals!.Kcal.Should().Be(330m);
        meal.MealTotals.Protein.Should().Be(62m);
        meal.MealTotals.Carbs.Should().Be(0m);
        meal.MealTotals.Fat.Should().Be(7.2m);

        var day = plan.Weeks[0].Days[0];
        day.DayTotals.Should().NotBeNull();
        day.DayTotals!.Kcal.Should().Be(330m);
    }

    [Fact]
    public void RecalculateTotals_MultipleMeals_SumsDayCorrectly()
    {
        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1,
                            Meals =
                            [
                                new PlanMeal
                                {
                                    MealId = Guid.NewGuid(),
                                    Kind = MealKind.Breakfast,
                                    Order = 1,
                                    Foods =
                                    [
                                        new MealFood
                                        {
                                            FoodName = "Oats",
                                            NutrientValuePer100Grams = new NutrientValue { Kcal = 389, Protein = 16.9m, Carbs = 66.3m, Fat = 6.9m },
                                            AmountGrams = 100
                                        }
                                    ]
                                },
                                new PlanMeal
                                {
                                    MealId = Guid.NewGuid(),
                                    Kind = MealKind.Breakfast,
                                    Order = 2,
                                    Foods =
                                    [
                                        new MealFood
                                        {
                                            FoodName = "Rice",
                                            NutrientValuePer100Grams = new NutrientValue { Kcal = 130, Protein = 2.7m, Carbs = 28.2m, Fat = 0.3m },
                                            AmountGrams = 200
                                        },
                                        new MealFood
                                        {
                                            FoodName = "Chicken",
                                            NutrientValuePer100Grams = new NutrientValue { Kcal = 165, Protein = 31m, Carbs = 0, Fat = 3.6m },
                                            AmountGrams = 150
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        _sut.RecalculateTotals(plan);

        var day = plan.Weeks[0].Days[0];
        // Breakfast: oats 100g → 389 kcal, 16.9P, 66.3C, 6.9F
        // Lunch: rice 200g → 260 kcal, 5.4P, 56.4C, 0.6F + chicken 150g → 247.5 kcal, 46.5P, 0C, 5.4F
        // Lunch total: 507.5 kcal, 51.9P, 56.4C, 6.0F
        // Day total: 896.5 kcal, 68.8P, 122.7C, 12.9F
        day.DayTotals!.Kcal.Should().Be(896.5m);
        day.DayTotals.Protein.Should().Be(68.8m);
        day.DayTotals.Carbs.Should().Be(122.7m);
        day.DayTotals.Fat.Should().Be(12.9m);
    }

    [Fact]
    public void RecalculateTotals_EmptyPlan_DoesNotThrow()
    {
        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            Weeks = []
        };

        var act = () => _sut.RecalculateTotals(plan);

        act.Should().NotThrow();
    }

    [Fact]
    public void RecalculateTotals_MealWithNoFoods_ReturnsZeroTotals()
    {
        var plan = CreatePlanWithMeal();

        _sut.RecalculateTotals(plan);

        var meal = plan.Weeks[0].Days[0].Meals[0];
        meal.MealTotals!.Kcal.Should().Be(0m);
        meal.MealTotals.Protein.Should().Be(0m);
    }

    // ── Full Pipeline ────────────────────────────────────────────────────

    [Fact]
    public void FullPipeline_MaleClientBulk_CalculatesReasonableValues()
    {
        // 80 kg male, 180 cm, 30 years, moderately active, bulking
        var bmr = _sut.CalculateBmr(80m, 180m, 30, BiologicalSex.Male);
        var tdee = _sut.CalculateTdee(bmr, ActivityLevel.ModeratelyActive);
        var adjustedKcal = _sut.ApplyGoalAdjustment(tdee, NutritionGoal.Bulk);
        var macros = _sut.CalculateMacroSplit(adjustedKcal);

        bmr.Should().Be(1780m);
        tdee.Should().Be(2759m);
        adjustedKcal.Should().Be(3035m);
        macros.DailyKcal.Should().Be(3035m);
        macros.ProteinGrams.Should().BeGreaterThan(200m);
        macros.CarbsGrams.Should().BeGreaterThan(300m);
        macros.FatGrams.Should().BeGreaterThan(70m);
    }

    [Fact]
    public void FullPipeline_FemaleCut_CalculatesReasonableValues()
    {
        // 60 kg female, 165 cm, 25 years, lightly active, cutting
        var bmr = _sut.CalculateBmr(60m, 165m, 25, BiologicalSex.Female);
        var tdee = _sut.CalculateTdee(bmr, ActivityLevel.LightlyActive);
        var adjustedKcal = _sut.ApplyGoalAdjustment(tdee, NutritionGoal.Cut);
        var macros = _sut.CalculateMacroSplit(adjustedKcal);

        bmr.Should().Be(1345.25m);
        tdee.Should().Be(1850m);
        adjustedKcal.Should().Be(1480m);
        macros.DailyKcal.Should().Be(1480m);
        macros.ProteinGrams.Should().BeGreaterThan(100m);
        macros.CarbsGrams.Should().BeGreaterThan(150m);
        macros.FatGrams.Should().BeGreaterThan(30m);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static NutritionPlan CreatePlanWithMeal(params MealFood[] foods)
    {
        return new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1,
                            Meals =
                            [
                                new PlanMeal
                                {
                                    MealId = Guid.NewGuid(),
                                    Kind = MealKind.Breakfast,
                                    Order = 1,
                                    Foods = foods.ToList()
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }
}
