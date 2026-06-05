using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.WeeklyCheckIns.PutOverride;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Unit tests for <see cref="PutOverrideValidator"/>.
/// These run without Testcontainers (no Docker required).
/// </summary>
public class PutOverrideValidatorTests
{
    private readonly PutOverrideValidator _validator = new();

    private static PutOverrideRequest ValidRequest() => new()
    {
        ClientUserId = Guid.NewGuid(),
        Profession = "Training",
        DayOfWeek = null,            // inherit
        TimeOfDay = null,            // inherit
        Enabled = null,              // inherit
        Addendum = null,             // inherit
        DeadlineOffsetHours = null   // inherit
    };

    [Fact]
    public void ValidRequest_AllNulls_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_AllValuesSet_PassesValidation()
    {
        var req = ValidRequest();
        req.DayOfWeek = 3;
        req.TimeOfDay = TimeSpan.FromHours(10);
        req.Enabled = true;
        req.Addendum = "Extra note";
        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ClientUserId_Empty_Fails()
    {
        var req = ValidRequest();
        req.ClientUserId = Guid.Empty;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ClientUserId);
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
    public void Profession_Invalid_Fails()
    {
        var req = ValidRequest();
        req.Profession = "Yoga";
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Profession);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(7)]
    public void DayOfWeek_OutOfRange_Fails(int day)
    {
        var req = ValidRequest();
        req.DayOfWeek = day;
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
        // AC: minute-precision times must be accepted (e.g. 14:15)
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 14, 15, 0); // 14:15:00
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_HourAligned_Passes()
    {
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(14);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_NonHour_18h45_Passes()
    {
        var req = ValidRequest();
        req.TimeOfDay = new TimeSpan(0, 18, 45, 0); // 18:45:00
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.TimeOfDay = null;
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TimeOfDay);
    }

    [Fact]
    public void TimeOfDay_ExactlyTwentyFourHours_Fails_WithInvalidTimeOfDayCode()
    {
        // AC: >= 24:00 must be rejected even in override
        var req = ValidRequest();
        req.TimeOfDay = TimeSpan.FromHours(24);
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
    public void Addendum_ExceedsMaxLength_Fails()
    {
        var req = ValidRequest();
        req.Addendum = new string('a', 201);
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Addendum);
    }

    [Fact]
    public void Addendum_MaxLength_Passes()
    {
        var req = ValidRequest();
        req.Addendum = new string('a', 200);
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Addendum);
    }

    // ── DeadlineOffsetHours validation ────────────────────────────────────────

    [Fact]
    public void DeadlineOffsetHours_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.DeadlineOffsetHours = null;
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.DeadlineOffsetHours);
    }

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
    [InlineData(12)]
    [InlineData(36)]
    [InlineData(60)]
    [InlineData(96)]
    [InlineData(200)]
    public void DeadlineOffsetHours_DisallowedValues_Fail_WithInvalidDeadlineOffsetHoursCode(int hours)
    {
        var req = ValidRequest();
        req.DeadlineOffsetHours = hours;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DeadlineOffsetHours)
              .WithErrorCode(ErrorCodes.InvalidDeadlineOffsetHours);
    }
}
