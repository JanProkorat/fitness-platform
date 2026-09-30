using FluentAssertions;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="NutrientValidation"/>.
/// </summary>
public class NutrientValidationTests
{
    [Fact]
    public void IsKcalConsistent_ExactMatch_ReturnsTrue()
    {
        // 20*4 + 30*4 + 10*9 = 80 + 120 + 90 = 290
        NutrientValidation.IsKcalConsistent(290, 20, 30, 10, null).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_Within10Percent_ReturnsTrue()
    {
        // Computed = 290, 290*1.09 ≈ 316
        NutrientValidation.IsKcalConsistent(316, 20, 30, 10, null).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_Over10Percent_ReturnsFalse()
    {
        // Computed = 290, 290*1.11 ≈ 322
        NutrientValidation.IsKcalConsistent(322, 20, 30, 10, null).Should().BeFalse();
    }

    [Fact]
    public void IsKcalConsistent_Under10Percent_ReturnsFalse()
    {
        // Computed = 290, 290*0.89 ≈ 258
        NutrientValidation.IsKcalConsistent(258, 20, 30, 10, null).Should().BeFalse();
    }

    [Fact]
    public void IsKcalConsistent_AllZeros_ReturnsTrue()
    {
        NutrientValidation.IsKcalConsistent(0, 0, 0, 0, null).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_ZeroMacrosNonZeroKcal_ReturnsFalse()
    {
        NutrientValidation.IsKcalConsistent(100, 0, 0, 0, null).Should().BeFalse();
    }

    [Fact]
    public void IsKcalConsistent_RealChickenBreast_ReturnsTrue()
    {
        // Chicken breast: 120 kcal, 22.5g P, 0g C, 2.6g F → 22.5*4 + 0*4 + 2.6*9 = 90+23.4 = 113.4
        // Ratio: 120/113.4 ≈ 1.058 → within 10%
        NutrientValidation.IsKcalConsistent(120, 22.5m, 0, 2.6m, null).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_ValidOnlyBecauseFibreCounts_ReturnsTrue()
    {
        // Without fibre: 10*4 + 10*4 + 0*9 = 80, ratio 100/80 = 1.25 → would fail.
        // With fibre: 80 + 10*2 = 100, exact match.
        NutrientValidation.IsKcalConsistent(100, 10, 10, 0, 10).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_FibreIncludedLowerBoundary_ReturnsTrue()
    {
        // Computed = 20*4 + 30*4 + 10*9 + 5*2 = 80 + 120 + 90 + 10 = 300, 300*0.9 = 270.
        NutrientValidation.IsKcalConsistent(270, 20, 30, 10, 5).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_FibreIncludedUpperBoundary_ReturnsTrue()
    {
        // Computed = 300, 300*1.1 = 330.
        NutrientValidation.IsKcalConsistent(330, 20, 30, 10, 5).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_WithinHalfKcalAllowance_ReturnsTrue()
    {
        // Computed = 0.1*4 = 0.4, kcal 0 → |0 - 0.4| = 0.4 <= 0.5.
        NutrientValidation.IsKcalConsistent(0, 0.1m, 0, 0, null).Should().BeTrue();
    }

    [Fact]
    public void IsKcalConsistent_WithinHalfKcalAllowanceAboveZero_ReturnsTrue()
    {
        // Computed = 0.35*4 = 1.4, kcal 1 → |1 - 1.4| = 0.4 <= 0.5.
        NutrientValidation.IsKcalConsistent(1, 0.35m, 0, 0, null).Should().BeTrue();
    }
}
