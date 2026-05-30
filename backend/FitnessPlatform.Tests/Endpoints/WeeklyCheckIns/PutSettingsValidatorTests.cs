using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.WeeklyCheckIns.PutSettings;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Unit tests for <see cref="PutSettingsValidator"/>.
/// These run without Testcontainers (no Docker required).
/// </summary>
public class PutSettingsValidatorTests
{
    private readonly PutSettingsValidator _validator = new();

    private static PutSettingsRequest ValidRequest() => new()
    {
        Profession = "Training",
        DayOfWeek = 1,                  // Monday
        TimeOfDay = TimeSpan.FromHours(18),
        Enabled = true,
        DefaultAddendum = null,
        DeadlineOffsetHours = 72        // default
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_NutritionProfession_PassesValidation()
    {
        var req = ValidRequest();
        req.Profession = "Nutrition";
        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Profession_Empty_Fails()
    {
        var req = ValidRequest();
        req.Profession = string.Empty;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Profession);
    }

    [Fact]
    public void Profession_InvalidValue_Fails()
    {
        var req = ValidRequest();
        req.Profession = "Yoga";
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Profession);
    }

    [Fact]
    public void DayOfWeek_BelowZero_Fails()
    {
        var req = ValidRequest();
        req.DayOfWeek = -1;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DayOfWeek);
    }

    [Fact]
    public void DayOfWeek_AboveSix_Fails()
    {
        var req = ValidRequest();
        req.DayOfWeek = 7;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DayOfWeek);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void DayOfWeek_BoundaryValues_Pass(int day)
    {
        var req = ValidRequest();
        req.DayOfWeek = day;
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.DayOfWeek);
    }

    [Fact]
    public void TimeOfDay_WithMinutes_Fails_WithInvalidTimeOfDayCode()
    {
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 18, 30, 0); // 18:30:00
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TimeOfDay)
              .WithErrorCode(ErrorCodes.InvalidTimeOfDay);
    }

    [Fact]
    public void TimeOfDay_WithSeconds_Fails_WithInvalidTimeOfDayCode()
    {
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 18, 0, 45); // 18:00:45
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TimeOfDay)
              .WithErrorCode(ErrorCodes.InvalidTimeOfDay);
    }

    [Fact]
    public void TimeOfDay_HourAligned_Passes()
    {
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(9);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void DefaultAddendum_ExceedsMaxLength_Fails()
    {
        var req = ValidRequest();
        req.DefaultAddendum = new string('x', 201);
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DefaultAddendum);
    }

    [Fact]
    public void DefaultAddendum_MaxLength_Passes()
    {
        var req = ValidRequest();
        req.DefaultAddendum = new string('x', 200);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.DefaultAddendum);
    }

    [Fact]
    public void DefaultAddendum_Null_Passes()
    {
        var req = ValidRequest();
        req.DefaultAddendum = null;
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.DefaultAddendum);
    }

    // ── DeadlineOffsetHours ───────────────────────────────────────────────────

    [Theory]
    [InlineData(24)]
    [InlineData(48)]
    [InlineData(72)]
    [InlineData(120)]
    [InlineData(168)]
    public void DeadlineOffsetHours_AllowedValues_Pass(int hours)
    {
        var req = ValidRequest();
        req.DeadlineOffsetHours = hours;
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.DeadlineOffsetHours);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(25)]
    [InlineData(49)]
    [InlineData(73)]
    [InlineData(721)]
    [InlineData(-1)]
    public void DeadlineOffsetHours_InvalidValues_Fail_WithOutOfRangeCode(int hours)
    {
        var req = ValidRequest();
        req.DeadlineOffsetHours = hours;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DeadlineOffsetHours)
              .WithErrorCode(ErrorCodes.OutOfRange);
    }
}
