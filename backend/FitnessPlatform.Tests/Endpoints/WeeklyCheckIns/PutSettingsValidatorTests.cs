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
    public void TimeOfDay_WithMinutes_Passes()
    {
        // AC: minute-precision times must be accepted (e.g. 18:30)
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 18, 30, 0); // 18:30:00
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_WithSeconds_Passes()
    {
        // AC: sub-minute precision must also be accepted (e.g. 18:00:45)
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 18, 0, 45); // 18:00:45
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_HourAligned_Passes()
    {
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(9);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Theory]
    [InlineData(0, 9, 15, 0)]    // 09:15:00
    [InlineData(0, 23, 59, 59)]  // 23:59:59 — boundary accepted
    [InlineData(0, 0, 0, 0)]     // 00:00:00 — midnight accepted
    public void TimeOfDay_ValidMinutePrecision_Passes(int days, int hours, int minutes, int seconds)
    {
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(days, hours, minutes, seconds);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_ExactlyTwentyFourHours_Fails_WithInvalidTimeOfDayCode()
    {
        // AC: >= 24:00 must be rejected
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(24);
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TimeOfDay)
              .WithErrorCode(ErrorCodes.InvalidTimeOfDay);
    }

    [Fact]
    public void TimeOfDay_GreaterThanTwentyFourHours_Fails_WithInvalidTimeOfDayCode()
    {
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(25);
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TimeOfDay)
              .WithErrorCode(ErrorCodes.InvalidTimeOfDay);
    }

    [Fact]
    public void TimeOfDay_Negative_Fails_WithInvalidTimeOfDayCode()
    {
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(-1);
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TimeOfDay)
              .WithErrorCode(ErrorCodes.InvalidTimeOfDay);
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
